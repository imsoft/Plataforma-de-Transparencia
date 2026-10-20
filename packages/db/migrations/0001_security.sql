-- ─────────────────────────────────────────────────────────────────────────────
-- Seguridad: roles, permisos, bitácora por triggers (append-only) y RLS.
-- Corre con el rol `migrator` (dueño de las tablas). Los roles `app_panel` y
-- `public_reader` deben existir (Docker los crea; en Neon se crean una vez a mano).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_panel') THEN CREATE ROLE app_panel NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'public_reader') THEN CREATE ROLE public_reader NOLOGIN; END IF;
END $$;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS app;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public, app TO app_panel, public_reader;
--> statement-breakpoint

-- FK circular documents.current_version_id → document_versions (diferida)
ALTER TABLE documents
  ADD CONSTRAINT documents_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES document_versions(id) DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint

-- ── Permisos de tablas ───────────────────────────────────────────────────────
-- app_panel: lee y escribe, pero NO borra (papelera lógica) salvo tablas operativas/auth.
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_panel;
--> statement-breakpoint
GRANT DELETE ON "session", "verification", "invitation", "account", "two_factor", "member",
  member_scopes, social_networks, law_index_equivalences, pending_revalidations TO app_panel;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_panel;
--> statement-breakpoint
-- public_reader: solo lectura de lo que necesita el sitio (RLS filtra filas)
GRANT SELECT ON states, obligated_subject_types, law_index_versions, law_index_nodes, law_index_equivalences,
  settings, municipalities, municipality_domains, municipality_theme, obligated_subjects, social_networks,
  documents, document_versions, no_information_notices TO public_reader;
--> statement-breakpoint
-- Tablas futuras creadas por migraciones heredan los permisos
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO app_panel;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_panel;
--> statement-breakpoint

-- ── Bitácora (audit_log): append-only ────────────────────────────────────────
-- Nadie de la aplicación inserta directamente: lo hacen los triggers (SECURITY DEFINER).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON audit_log FROM app_panel, public_reader, PUBLIC;
--> statement-breakpoint
REVOKE ALL ON SEQUENCE audit_log_id_seq FROM app_panel, public_reader, PUBLIC;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.audit_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora es de solo escritura: no se puede % ', TG_OP USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION app.audit_log_immutable();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION app.audit_log_immutable();
--> statement-breakpoint

-- ── Funciones de contexto ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app.municipality_allowed(m uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT current_setting('app.role', true) = 'superadmin'
      OR m = ANY (string_to_array(nullif(current_setting('app.allowed_municipalities', true), ''), ',')::uuid[])
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.public_municipality() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.municipality_id', true), '')::uuid
$$;
--> statement-breakpoint

-- ── Trigger genérico de bitácora ─────────────────────────────────────────────
-- Argumentos: (modo 'strict'|'lax', entidad, [columna de actor alterno para modo lax])
CREATE OR REPLACE FUNCTION app.record_audit_log() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app AS $$
DECLARE
  v_mode         text := coalesce(TG_ARGV[0], 'strict');
  v_entity       text := coalesce(TG_ARGV[1], TG_TABLE_NAME);
  v_actor_col    text := TG_ARGV[2];
  v_actor        text := nullif(current_setting('app.user_id', true), '');
  v_role         text := nullif(current_setting('app.role', true), '');
  v_origin       text := coalesce(nullif(current_setting('app.origin', true), ''), 'panel');
  v_before       jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_after        jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  v_row          jsonb := coalesce(v_after, v_before);
  v_changes      jsonb := '{}'::jsonb;
  v_field        text;
  v_municipality uuid;
  v_action       text;
  v_sensitive    text[] := ARRAY['password','secret','backup_codes','token','revalidation_secret_hash','updated_at','updatedAt'];
BEGIN
  -- Actor
  IF v_actor IS NULL THEN
    IF v_mode = 'strict' THEN
      RAISE EXCEPTION 'Escritura en % sin usuario en la sesión: usa withUser()', TG_TABLE_NAME
        USING ERRCODE = 'insufficient_privilege', HINT = 'Falta set_config(''app.user_id'')';
    END IF;
    v_actor := coalesce(v_row ->> v_actor_col, 'system:auth');
    v_origin := 'auth';
  END IF;

  -- Municipio de la fila
  v_municipality := (v_row ->> 'municipality_id')::uuid;
  IF v_municipality IS NULL AND v_row ? 'organization_id' THEN
    SELECT id INTO v_municipality FROM municipalities WHERE organization_id = v_row ->> 'organization_id';
  END IF;
  IF v_municipality IS NULL AND v_entity = 'municipality' THEN
    v_municipality := (v_row ->> 'id')::uuid;
  END IF;

  -- Cambios campo por campo
  IF TG_OP = 'UPDATE' THEN
    FOR v_field IN SELECT jsonb_object_keys(v_after) LOOP
      IF v_field = ANY (v_sensitive) THEN CONTINUE; END IF;
      IF v_before -> v_field IS DISTINCT FROM v_after -> v_field THEN
        v_changes := v_changes || jsonb_build_object(v_field, jsonb_build_object('before', v_before -> v_field, 'after', v_after -> v_field));
      END IF;
    END LOOP;
    IF v_changes = '{}'::jsonb THEN RETURN NULL; END IF; -- nada relevante cambió
  ELSIF TG_OP = 'INSERT' THEN
    v_changes := (SELECT coalesce(jsonb_object_agg(k, jsonb_build_object('before', NULL, 'after', v)), '{}'::jsonb)
                  FROM jsonb_each(v_after) AS e(k, v) WHERE NOT (k = ANY (v_sensitive)));
  ELSE
    v_changes := (SELECT coalesce(jsonb_object_agg(k, jsonb_build_object('before', v, 'after', NULL)), '{}'::jsonb)
                  FROM jsonb_each(v_before) AS e(k, v) WHERE NOT (k = ANY (v_sensitive)));
  END IF;

  -- Acción semántica
  v_action := CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'DELETE' THEN 'delete' ELSE 'update' END;
  IF TG_OP = 'UPDATE' AND v_entity = 'document' THEN
    v_action := CASE
      WHEN v_changes ? 'status' THEN
        CASE v_after ->> 'status'
          WHEN 'trash' THEN 'trash'
          WHEN 'hidden' THEN 'hide'
          WHEN 'historical' THEN 'archive'
          WHEN 'published' THEN CASE WHEN v_before ->> 'status' = 'trash' THEN 'restore' ELSE 'publish' END
          ELSE 'update' END
      WHEN v_changes ? 'current_version_id' THEN 'replace'
      WHEN v_changes ? 'name' THEN 'rename'
      WHEN v_changes ? 'sort_order' THEN 'reorder'
      WHEN v_changes ? 'period_start' OR v_changes ? 'period_end' OR v_changes ? 'period_label' THEN 'change_period'
      ELSE 'update' END;
  ELSIF TG_OP = 'UPDATE' AND v_entity = 'member' AND v_changes ? 'role' THEN
    v_action := 'change_role';
  ELSIF v_entity = 'notice' THEN
    v_action := CASE TG_OP WHEN 'INSERT' THEN 'mark_notice'
                  WHEN 'UPDATE' THEN CASE WHEN v_changes ? 'deleted_at' THEN 'unmark_notice' ELSE 'update' END
                  ELSE 'delete' END;
  END IF;

  INSERT INTO audit_log (actor_id, actor_role, municipality_id, entity, entity_id, action, changes, origin)
  VALUES (v_actor, v_role, v_municipality, v_entity,
          coalesce(v_row ->> 'id', v_row ->> 'municipality_id', v_row ->> 'key'), v_action, v_changes, v_origin);
  RETURN NULL;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.record_audit_log() FROM PUBLIC;
--> statement-breakpoint

-- Estricto: toda escritura exige app.user_id
CREATE TRIGGER audit_documents AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_log('strict', 'document');
--> statement-breakpoint
CREATE TRIGGER audit_document_versions AFTER INSERT OR UPDATE OR DELETE ON document_versions
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_log('strict', 'document_version');
--> statement-breakpoint
CREATE TRIGGER audit_notices AFTER INSERT OR UPDATE OR DELETE ON no_information_notices
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_log('strict', 'notice');
--> statement-breakpoint
CREATE TRIGGER audit_social_networks AFTER INSERT OR UPDATE OR DELETE ON social_networks
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_log('strict', 'social_network');
--> statement-breakpoint
CREATE TRIGGER audit_obligated_subjects AFTER INSERT OR UPDATE OR DELETE ON obligated_subjects
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_log('strict', 'obligated_subject');
--> statement-breakpoint
CREATE TRIGGER audit_municipality_theme AFTER INSERT OR UPDATE OR DELETE ON municipality_theme
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_log('strict', 'theme');
--> statement-breakpoint
CREATE TRIGGER audit_municipalities AFTER INSERT OR UPDATE OR DELETE ON municipalities
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_log('strict', 'municipality');
--> statement-breakpoint
CREATE TRIGGER audit_municipality_domains AFTER INSERT OR UPDATE OR DELETE ON municipality_domains
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_log('strict', 'domain');
--> statement-breakpoint
CREATE TRIGGER audit_member_scopes AFTER INSERT OR UPDATE OR DELETE ON member_scopes
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_log('strict', 'scope');
--> statement-breakpoint
CREATE TRIGGER audit_law_index_versions AFTER INSERT OR UPDATE OR DELETE ON law_index_versions
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_log('strict', 'law_index_version');
--> statement-breakpoint
CREATE TRIGGER audit_export_jobs AFTER INSERT OR UPDATE ON export_jobs
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_log('strict', 'export');
--> statement-breakpoint
CREATE TRIGGER audit_settings AFTER INSERT OR UPDATE OR DELETE ON settings
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_log('strict', 'settings');
--> statement-breakpoint
-- Lax: tablas que también escribe Better Auth fuera del helper
CREATE TRIGGER audit_member AFTER INSERT OR UPDATE OR DELETE ON "member"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_log('lax', 'member', 'user_id');
--> statement-breakpoint
CREATE TRIGGER audit_invitation AFTER INSERT OR UPDATE OR DELETE ON "invitation"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_log('lax', 'invitation', 'inviter_id');
--> statement-breakpoint
CREATE TRIGGER audit_user AFTER INSERT OR UPDATE ON "user"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_log('lax', 'user', 'id');
--> statement-breakpoint
CREATE TRIGGER audit_organization AFTER INSERT OR UPDATE OR DELETE ON "organization"
  FOR EACH ROW EXECUTE FUNCTION app.record_audit_log('lax', 'organization');
--> statement-breakpoint

-- ── Row Level Security ───────────────────────────────────────────────────────
-- El dueño (migrator) no está sujeto (sin FORCE): scripts y respaldos funcionan.
-- app_panel y public_reader sí lo están.
ALTER TABLE municipalities ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY panel_select ON municipalities FOR SELECT TO app_panel USING (app.municipality_allowed(id));
--> statement-breakpoint
CREATE POLICY panel_insert ON municipalities FOR INSERT TO app_panel WITH CHECK (current_setting('app.role', true) = 'superadmin');
--> statement-breakpoint
CREATE POLICY panel_update ON municipalities FOR UPDATE TO app_panel USING (app.municipality_allowed(id)) WITH CHECK (app.municipality_allowed(id));
--> statement-breakpoint
CREATE POLICY public_select ON municipalities FOR SELECT TO public_reader USING (id = app.public_municipality());
--> statement-breakpoint
-- Un usuario puede leer los municipios donde tiene membresía aunque todavía no se hayan fijado
-- app.allowed_municipalities (es justo la consulta que calcula esa lista al iniciar sesión).
CREATE POLICY panel_select_member ON municipalities FOR SELECT TO app_panel
  USING (EXISTS (
    SELECT 1 FROM "member" m
    WHERE m.organization_id = municipalities.organization_id
      AND m.user_id = nullif(current_setting('app.user_id', true), '')
  ));
--> statement-breakpoint
-- El sitio público solo conoce su slug (MUNICIPALITY_SLUG); con esta política puede resolver su id
-- antes de fijar app.municipality_id para el resto de las lecturas.
CREATE POLICY public_select_slug ON municipalities FOR SELECT TO public_reader
  USING (slug = nullif(current_setting('app.municipality_slug', true), ''));
--> statement-breakpoint

-- Macro repetida por tabla con municipality_id
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['municipality_domains','municipality_theme','obligated_subjects','social_networks',
                           'documents','no_information_notices','export_jobs','member_scopes',
                           'pending_revalidations'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY panel_select ON %I FOR SELECT TO app_panel USING (app.municipality_allowed(municipality_id))', t);
    EXECUTE format('CREATE POLICY panel_insert ON %I FOR INSERT TO app_panel WITH CHECK (app.municipality_allowed(municipality_id))', t);
    EXECUTE format('CREATE POLICY panel_update ON %I FOR UPDATE TO app_panel USING (app.municipality_allowed(municipality_id)) WITH CHECK (app.municipality_allowed(municipality_id))', t);
    EXECUTE format('CREATE POLICY panel_delete ON %I FOR DELETE TO app_panel USING (app.municipality_allowed(municipality_id))', t);
  END LOOP;
END $$;
--> statement-breakpoint
-- document_versions no tiene municipality_id: hereda a través del documento
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY panel_all ON document_versions FOR ALL TO app_panel
  USING (EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND app.municipality_allowed(d.municipality_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND app.municipality_allowed(d.municipality_id)));
--> statement-breakpoint
-- bitácora: cada quien ve la de sus municipios (y el superadmin todo)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY panel_select ON audit_log FOR SELECT TO app_panel
  USING (municipality_id IS NULL AND current_setting('app.role', true) = 'superadmin' OR app.municipality_allowed(municipality_id));
--> statement-breakpoint

-- public_reader: solo lo publicado de SU municipio
CREATE POLICY public_select ON municipality_domains FOR SELECT TO public_reader USING (municipality_id = app.public_municipality());
--> statement-breakpoint
CREATE POLICY public_select ON municipality_theme FOR SELECT TO public_reader USING (municipality_id = app.public_municipality());
--> statement-breakpoint
CREATE POLICY public_select ON obligated_subjects FOR SELECT TO public_reader USING (municipality_id = app.public_municipality() AND active);
--> statement-breakpoint
CREATE POLICY public_select ON social_networks FOR SELECT TO public_reader USING (municipality_id = app.public_municipality() AND visible);
--> statement-breakpoint
CREATE POLICY public_select ON documents FOR SELECT TO public_reader
  USING (municipality_id = app.public_municipality() AND status IN ('published', 'historical', 'trash', 'hidden'));
--> statement-breakpoint
-- Nota: el sitio necesita saber si un /d/<id> está en papelera/histórico para mostrar la página adecuada;
-- la lectura pública de la LISTA filtra status = 'published' en la consulta y la prueba lo verifica.
CREATE POLICY public_select ON document_versions FOR SELECT TO public_reader
  USING (is_current AND EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND d.municipality_id = app.public_municipality() AND d.status = 'published'));
--> statement-breakpoint
CREATE POLICY public_select ON no_information_notices FOR SELECT TO public_reader
  USING (municipality_id = app.public_municipality() AND deleted_at IS NULL);
