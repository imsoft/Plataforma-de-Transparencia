-- Valores por defecto de identidad neutros (sin colores de partidos políticos)
ALTER TABLE municipio_tema ALTER COLUMN color_primario SET DEFAULT '#125c6a';
--> statement-breakpoint
ALTER TABLE municipio_tema ALTER COLUMN color_secundario SET DEFAULT '#35505e';
--> statement-breakpoint
ALTER TABLE municipio_tema ALTER COLUMN color_acento SET DEFAULT '#5b7a8c';
