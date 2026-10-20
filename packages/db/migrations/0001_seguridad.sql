-- ─────────────────────────────────────────────────────────────────────────────
-- Seguridad: roles, permisos, bitácora por triggers (append-only) y RLS.
-- Corre con el rol `migraciones` (dueño de las tablas). Los roles `app_panel` y
-- `lector_publico` deben existir (Docker los crea; en Neon se crean una vez a mano).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_panel') THEN CREATE ROLE app_panel NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lector_publico') THEN CREATE ROLE lector_publico NOLOGIN; END IF;
END $$;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS app;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public, app TO app_panel, lector_publico;
--> statement-breakpoint

-- FK circular documentos.version_actual_id → documento_versiones (diferida)
ALTER TABLE documentos
  ADD CONSTRAINT documentos_version_actual_fk
  FOREIGN KEY (version_actual_id) REFERENCES documento_versiones(id) DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint

-- ── Permisos de tablas ───────────────────────────────────────────────────────
-- app_panel: lee y escribe, pero NO borra (papelera lógica) salvo tablas operativas/auth.
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_panel;
--> statement-breakpoint
GRANT DELETE ON "session", "verification", "invitation", "account", "two_factor", "member",
  alcances_miembro, redes_sociales, indice_equivalencias, revalidaciones_pendientes TO app_panel;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_panel;
--> statement-breakpoint
-- lector_publico: solo lectura de lo que necesita el sitio (RLS filtra filas)
GRANT SELECT ON estados, tipos_sujeto_obligado, indice_versiones, indice_nodos, indice_equivalencias,
  configuracion, municipios, municipio_dominios, municipio_tema, sujetos_obligados, redes_sociales,
  documentos, documento_versiones, leyendas_sin_informacion TO lector_publico;
--> statement-breakpoint
-- Tablas futuras creadas por migraciones heredan los permisos
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO app_panel;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_panel;
--> statement-breakpoint

-- ── Bitácora: append-only ────────────────────────────────────────────────────
-- Nadie de la aplicación inserta directamente: lo hacen los triggers (SECURITY DEFINER).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON bitacora FROM app_panel, lector_publico, PUBLIC;
--> statement-breakpoint
REVOKE ALL ON SEQUENCE bitacora_id_seq FROM app_panel, lector_publico, PUBLIC;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.bitacora_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora es de solo escritura: no se puede % ', TG_OP USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
CREATE TRIGGER bitacora_sin_update_delete
  BEFORE UPDATE OR DELETE ON bitacora FOR EACH ROW EXECUTE FUNCTION app.bitacora_inmutable();
--> statement-breakpoint
CREATE TRIGGER bitacora_sin_truncate
  BEFORE TRUNCATE ON bitacora FOR EACH STATEMENT EXECUTE FUNCTION app.bitacora_inmutable();
--> statement-breakpoint

-- ── Función de contexto ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app.municipio_permitido(m uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT current_setting('app.rol', true) = 'superadmin'
      OR m = ANY (string_to_array(nullif(current_setting('app.municipios_permitidos', true), ''), ',')::uuid[])
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.municipio_publico() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.municipio_id', true), '')::uuid
$$;
--> statement-breakpoint

-- ── Trigger genérico de bitácora ─────────────────────────────────────────────
-- Argumentos: (modo 'estricto'|'laxo', entidad, [columna de actor alterno para modo laxo])
CREATE OR REPLACE FUNCTION app.registrar_bitacora() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app AS $$
DECLARE
  v_modo      text := coalesce(TG_ARGV[0], 'estricto');
  v_entidad   text := coalesce(TG_ARGV[1], TG_TABLE_NAME);
  v_col_actor text := TG_ARGV[2];
  v_actor     text := nullif(current_setting('app.usuario_id', true), '');
  v_rol       text := nullif(current_setting('app.rol', true), '');
  v_origen    text := coalesce(nullif(current_setting('app.origen', true), ''), 'panel');
  v_antes     jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_despues   jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  v_fila      jsonb := coalesce(v_despues, v_antes);
  v_cambios   jsonb := '{}'::jsonb;
  v_campo     text;
  v_municipio uuid;
  v_accion    text;
  v_sensibles text[] := ARRAY['password','secret','backup_codes','token','secreto_revalidacion_hash','actualizado_en','updated_at','updatedAt'];
BEGIN
  -- Actor
  IF v_actor IS NULL THEN
    IF v_modo = 'estricto' THEN
      RAISE EXCEPTION 'Escritura en % sin usuario en la sesión: usa conUsuario()', TG_TABLE_NAME
        USING ERRCODE = 'insufficient_privilege', HINT = 'Falta set_config(''app.usuario_id'')';
    END IF;
    v_actor := coalesce(v_fila ->> v_col_actor, 'sistema:auth');
    v_origen := 'auth';
  END IF;

  -- Municipio de la fila
  v_municipio := (v_fila ->> 'municipio_id')::uuid;
  IF v_municipio IS NULL AND v_fila ? 'organization_id' THEN
    SELECT id INTO v_municipio FROM municipios WHERE organization_id = v_fila ->> 'organization_id';
  END IF;
  IF v_municipio IS NULL AND v_entidad = 'municipio' THEN
    v_municipio := (v_fila ->> 'id')::uuid;
  END IF;

  -- Cambios campo por campo
  IF TG_OP = 'UPDATE' THEN
    FOR v_campo IN SELECT jsonb_object_keys(v_despues) LOOP
      IF v_campo = ANY (v_sensibles) THEN CONTINUE; END IF;
      IF v_antes -> v_campo IS DISTINCT FROM v_despues -> v_campo THEN
        v_cambios := v_cambios || jsonb_build_object(v_campo, jsonb_build_object('antes', v_antes -> v_campo, 'despues', v_despues -> v_campo));
      END IF;
    END LOOP;
    IF v_cambios = '{}'::jsonb THEN RETURN NULL; END IF; -- nada relevante cambió
  ELSIF TG_OP = 'INSERT' THEN
    v_cambios := (SELECT coalesce(jsonb_object_agg(k, jsonb_build_object('antes', NULL, 'despues', v)), '{}'::jsonb)
                  FROM jsonb_each(v_despues) AS e(k, v) WHERE NOT (k = ANY (v_sensibles)));
  ELSE
    v_cambios := (SELECT coalesce(jsonb_object_agg(k, jsonb_build_object('antes', v, 'despues', NULL)), '{}'::jsonb)
                  FROM jsonb_each(v_antes) AS e(k, v) WHERE NOT (k = ANY (v_sensibles)));
  END IF;

  -- Acción semántica
  v_accion := CASE TG_OP WHEN 'INSERT' THEN 'crear' WHEN 'DELETE' THEN 'eliminar' ELSE 'actualizar' END;
  IF TG_OP = 'UPDATE' AND v_entidad = 'documento' THEN
    v_accion := CASE
      WHEN v_cambios ? 'estado' THEN
        CASE v_despues ->> 'estado'
          WHEN 'papelera' THEN 'papelera'
          WHEN 'oculto' THEN 'ocultar'
          WHEN 'historico' THEN 'historico'
          WHEN 'publicado' THEN CASE WHEN v_antes ->> 'estado' = 'papelera' THEN 'restaurar' ELSE 'publicar' END
          ELSE 'actualizar' END
      WHEN v_cambios ? 'version_actual_id' THEN 'reemplazar'
      WHEN v_cambios ? 'nombre' THEN 'renombrar'
      WHEN v_cambios ? 'orden' THEN 'reordenar'
      WHEN v_cambios ? 'periodo_inicio' OR v_cambios ? 'periodo_fin' OR v_cambios ? 'periodo_etiqueta' THEN 'cambiar_periodo'
      ELSE 'actualizar' END;
  ELSIF TG_OP = 'UPDATE' AND v_entidad = 'miembro' AND v_cambios ? 'role' THEN
    v_accion := 'cambiar_rol';
  ELSIF v_entidad = 'leyenda' THEN
    v_accion := CASE TG_OP WHEN 'INSERT' THEN 'marcar_leyenda'
                  WHEN 'UPDATE' THEN CASE WHEN v_cambios ? 'eliminado_en' THEN 'desmarcar_leyenda' ELSE 'actualizar' END
                  ELSE 'eliminar' END;
  END IF;

  INSERT INTO bitacora (actor_id, actor_rol, municipio_id, entidad, entidad_id, accion, cambios, origen)
  VALUES (v_actor, v_rol, v_municipio, v_entidad,
          coalesce(v_fila ->> 'id', v_fila ->> 'municipio_id', v_fila ->> 'clave'), v_accion, v_cambios, v_origen);
  RETURN NULL;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.registrar_bitacora() FROM PUBLIC;
--> statement-breakpoint

-- Estricto: toda escritura exige app.usuario_id
CREATE TRIGGER bitacora_documentos AFTER INSERT OR UPDATE OR DELETE ON documentos
  FOR EACH ROW EXECUTE FUNCTION app.registrar_bitacora('estricto', 'documento');
--> statement-breakpoint
CREATE TRIGGER bitacora_documento_versiones AFTER INSERT OR UPDATE OR DELETE ON documento_versiones
  FOR EACH ROW EXECUTE FUNCTION app.registrar_bitacora('estricto', 'documento_version');
--> statement-breakpoint
CREATE TRIGGER bitacora_leyendas AFTER INSERT OR UPDATE OR DELETE ON leyendas_sin_informacion
  FOR EACH ROW EXECUTE FUNCTION app.registrar_bitacora('estricto', 'leyenda');
--> statement-breakpoint
CREATE TRIGGER bitacora_redes_sociales AFTER INSERT OR UPDATE OR DELETE ON redes_sociales
  FOR EACH ROW EXECUTE FUNCTION app.registrar_bitacora('estricto', 'red_social');
--> statement-breakpoint
CREATE TRIGGER bitacora_sujetos_obligados AFTER INSERT OR UPDATE OR DELETE ON sujetos_obligados
  FOR EACH ROW EXECUTE FUNCTION app.registrar_bitacora('estricto', 'sujeto_obligado');
--> statement-breakpoint
CREATE TRIGGER bitacora_municipio_tema AFTER INSERT OR UPDATE OR DELETE ON municipio_tema
  FOR EACH ROW EXECUTE FUNCTION app.registrar_bitacora('estricto', 'tema');
--> statement-breakpoint
CREATE TRIGGER bitacora_municipios AFTER INSERT OR UPDATE OR DELETE ON municipios
  FOR EACH ROW EXECUTE FUNCTION app.registrar_bitacora('estricto', 'municipio');
--> statement-breakpoint
CREATE TRIGGER bitacora_municipio_dominios AFTER INSERT OR UPDATE OR DELETE ON municipio_dominios
  FOR EACH ROW EXECUTE FUNCTION app.registrar_bitacora('estricto', 'dominio');
--> statement-breakpoint
CREATE TRIGGER bitacora_alcances AFTER INSERT OR UPDATE OR DELETE ON alcances_miembro
  FOR EACH ROW EXECUTE FUNCTION app.registrar_bitacora('estricto', 'alcance');
--> statement-breakpoint
CREATE TRIGGER bitacora_indice_versiones AFTER INSERT OR UPDATE OR DELETE ON indice_versiones
  FOR EACH ROW EXECUTE FUNCTION app.registrar_bitacora('estricto', 'indice_version');
--> statement-breakpoint
CREATE TRIGGER bitacora_exportaciones AFTER INSERT OR UPDATE ON exportaciones
  FOR EACH ROW EXECUTE FUNCTION app.registrar_bitacora('estricto', 'exportacion');
--> statement-breakpoint
CREATE TRIGGER bitacora_configuracion AFTER INSERT OR UPDATE OR DELETE ON configuracion
  FOR EACH ROW EXECUTE FUNCTION app.registrar_bitacora('estricto', 'configuracion');
--> statement-breakpoint
-- Laxo: tablas que también escribe Better Auth fuera del helper
CREATE TRIGGER bitacora_member AFTER INSERT OR UPDATE OR DELETE ON "member"
  FOR EACH ROW EXECUTE FUNCTION app.registrar_bitacora('laxo', 'miembro', 'user_id');
--> statement-breakpoint
CREATE TRIGGER bitacora_invitation AFTER INSERT OR UPDATE OR DELETE ON "invitation"
  FOR EACH ROW EXECUTE FUNCTION app.registrar_bitacora('laxo', 'invitacion', 'inviter_id');
--> statement-breakpoint
CREATE TRIGGER bitacora_user AFTER INSERT OR UPDATE ON "user"
  FOR EACH ROW EXECUTE FUNCTION app.registrar_bitacora('laxo', 'usuario', 'id');
--> statement-breakpoint
CREATE TRIGGER bitacora_organization AFTER INSERT OR UPDATE OR DELETE ON "organization"
  FOR EACH ROW EXECUTE FUNCTION app.registrar_bitacora('laxo', 'organizacion');
--> statement-breakpoint

-- ── Row Level Security ───────────────────────────────────────────────────────
-- El dueño (migraciones) no está sujeto (sin FORCE): scripts y respaldos funcionan.
-- app_panel y lector_publico sí lo están.
ALTER TABLE municipios ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY panel_select ON municipios FOR SELECT TO app_panel USING (app.municipio_permitido(id));
--> statement-breakpoint
CREATE POLICY panel_insert ON municipios FOR INSERT TO app_panel WITH CHECK (current_setting('app.rol', true) = 'superadmin');
--> statement-breakpoint
CREATE POLICY panel_update ON municipios FOR UPDATE TO app_panel USING (app.municipio_permitido(id)) WITH CHECK (app.municipio_permitido(id));
--> statement-breakpoint
CREATE POLICY publico_select ON municipios FOR SELECT TO lector_publico USING (id = app.municipio_publico());
--> statement-breakpoint

-- Macro repetida por tabla con municipio_id
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['municipio_dominios','municipio_tema','sujetos_obligados','redes_sociales',
                           'documentos','leyendas_sin_informacion','exportaciones','alcances_miembro',
                           'revalidaciones_pendientes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY panel_select ON %I FOR SELECT TO app_panel USING (app.municipio_permitido(municipio_id))', t);
    EXECUTE format('CREATE POLICY panel_insert ON %I FOR INSERT TO app_panel WITH CHECK (app.municipio_permitido(municipio_id))', t);
    EXECUTE format('CREATE POLICY panel_update ON %I FOR UPDATE TO app_panel USING (app.municipio_permitido(municipio_id)) WITH CHECK (app.municipio_permitido(municipio_id))', t);
    EXECUTE format('CREATE POLICY panel_delete ON %I FOR DELETE TO app_panel USING (app.municipio_permitido(municipio_id))', t);
  END LOOP;
END $$;
--> statement-breakpoint
-- documento_versiones no tiene municipio_id: hereda a través del documento
ALTER TABLE documento_versiones ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY panel_todo ON documento_versiones FOR ALL TO app_panel
  USING (EXISTS (SELECT 1 FROM documentos d WHERE d.id = documento_id AND app.municipio_permitido(d.municipio_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM documentos d WHERE d.id = documento_id AND app.municipio_permitido(d.municipio_id)));
--> statement-breakpoint
-- bitácora: cada quien ve la de sus municipios (y el superadmin todo)
ALTER TABLE bitacora ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY panel_select ON bitacora FOR SELECT TO app_panel
  USING (municipio_id IS NULL AND current_setting('app.rol', true) = 'superadmin' OR app.municipio_permitido(municipio_id));
--> statement-breakpoint

-- lector_publico: solo lo publicado de SU municipio
CREATE POLICY publico_select ON municipio_dominios FOR SELECT TO lector_publico USING (municipio_id = app.municipio_publico());
--> statement-breakpoint
CREATE POLICY publico_select ON municipio_tema FOR SELECT TO lector_publico USING (municipio_id = app.municipio_publico());
--> statement-breakpoint
CREATE POLICY publico_select ON sujetos_obligados FOR SELECT TO lector_publico USING (municipio_id = app.municipio_publico() AND activo);
--> statement-breakpoint
CREATE POLICY publico_select ON redes_sociales FOR SELECT TO lector_publico USING (municipio_id = app.municipio_publico() AND visible);
--> statement-breakpoint
CREATE POLICY publico_select ON documentos FOR SELECT TO lector_publico
  USING (municipio_id = app.municipio_publico() AND estado IN ('publicado', 'historico', 'papelera', 'oculto'));
--> statement-breakpoint
-- Nota: el sitio necesita saber si un /d/<id> está en papelera/histórico para mostrar la página adecuada;
-- la lectura pública de la LISTA filtra estado = 'publicado' en la consulta y la prueba lo verifica.
CREATE POLICY publico_select ON documento_versiones FOR SELECT TO lector_publico
  USING (vigente AND EXISTS (SELECT 1 FROM documentos d WHERE d.id = documento_id AND d.municipio_id = app.municipio_publico() AND d.estado = 'publicado'));
--> statement-breakpoint
CREATE POLICY publico_select ON leyendas_sin_informacion FOR SELECT TO lector_publico
  USING (municipio_id = app.municipio_publico() AND eliminado_en IS NULL);
