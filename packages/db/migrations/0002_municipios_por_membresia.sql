-- Un usuario puede leer los municipios donde tiene membresía aunque todavía no se hayan fijado
-- app.municipios_permitidos (es justo la consulta que calcula esa lista al iniciar sesión).
CREATE POLICY panel_select_miembro ON municipios FOR SELECT TO app_panel
  USING (EXISTS (
    SELECT 1 FROM "member" m
    WHERE m.organization_id = municipios.organization_id
      AND m.user_id = nullif(current_setting('app.usuario_id', true), '')
  ));
