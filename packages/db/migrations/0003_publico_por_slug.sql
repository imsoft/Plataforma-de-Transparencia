-- El sitio público solo conoce su slug (MUNICIPIO_SLUG); con esta política puede resolver su id
-- antes de fijar app.municipio_id para el resto de las lecturas.
CREATE POLICY publico_select_slug ON municipios FOR SELECT TO lector_publico
  USING (slug = nullif(current_setting('app.municipio_slug', true), ''));
