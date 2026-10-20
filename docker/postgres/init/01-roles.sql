-- Roles de Postgres de mínimo privilegio. En Neon se crean a mano una sola vez (ver README).
-- `postgres` (superusuario local) hace el papel del rol `migraciones` en desarrollo.
CREATE ROLE migraciones LOGIN PASSWORD 'migraciones' CREATEROLE;
CREATE ROLE app_panel LOGIN PASSWORD 'app_panel';
CREATE ROLE lector_publico LOGIN PASSWORD 'lector_publico';
GRANT ALL PRIVILEGES ON DATABASE transparencia TO migraciones;
ALTER DATABASE transparencia OWNER TO migraciones;
