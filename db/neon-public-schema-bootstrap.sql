-- Neon / cloud Postgres: ensure objects land in public schema.
CREATE SCHEMA IF NOT EXISTS public;

GRANT USAGE ON SCHEMA public TO public;
GRANT CREATE ON SCHEMA public TO public;

SET search_path TO public;
