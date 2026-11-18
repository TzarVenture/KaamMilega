-- km_app: the database user the backend server signs in as. It reads and writes rows in the
-- schema below and can't create, change or drop tables. Migrations keep running as the admin
-- user (postgres), which owns the tables.
--
-- The password is never in a migration. After this runs, set it once as the admin user:
--   ALTER ROLE km_app LOGIN PASSWORD '...';
-- and connect the server as km_app.<project ref> through the Supabase pooler.
--
-- BYPASSRLS: row level security is on for every table only to keep Supabase's public API roles
-- (anon, authenticated) out; they have no grants either. The server is the only client, so it
-- passes RLS, and a table added later needs no policy for the server to read it.
--
-- Roles belong to the whole database server, so tests that apply these migrations reuse it.
-- Two test runs can race to create it; whichever loses carries on.
DO $$
BEGIN
    CREATE ROLE km_app NOLOGIN BYPASSRLS;
EXCEPTION
    WHEN duplicate_object OR unique_violation THEN NULL;
END;
$$;

GRANT USAGE ON SCHEMA app TO km_app;
GRANT USAGE ON SCHEMA extensions TO km_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO km_app;

-- Tables created by later migrations (run as postgres) get the same rights automatically
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO km_app;
