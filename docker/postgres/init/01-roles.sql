-- Roles de Postgres de mínimo privilegio. En Neon se crean a mano una sola vez (ver README).
-- `postgres` (superusuario local) hace el papel del rol `migrator` en desarrollo.
CREATE ROLE migrator LOGIN PASSWORD 'migrator' CREATEROLE;
CREATE ROLE app_panel LOGIN PASSWORD 'app_panel';
CREATE ROLE public_reader LOGIN PASSWORD 'public_reader';
GRANT ALL PRIVILEGES ON DATABASE transparency TO migrator;
ALTER DATABASE transparency OWNER TO migrator;
