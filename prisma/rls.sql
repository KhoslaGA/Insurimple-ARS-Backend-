-- Row-Level Security for Insurimple-ARS (run AFTER `prisma migrate deploy`).
--
-- Multi-tenancy from row one, vendor-blind. The app connects as a NON-owner role so
-- FORCE ROW LEVEL SECURITY applies to it (table owners bypass RLS). Tenant context is
-- set per transaction with `SELECT set_config('app.current_tenant', $1, true)` — never a
-- plain SET (which would leak across a pooled connection). See PrismaService.forTenant.
--
-- Usage:  psql "$DATABASE_URL" -v app_role=ars_app -f prisma/rls.sql
-- (DATABASE_URL must be the OWNER role here; app_role is the non-owner the API runs as.)

\if :{?app_role}
\else
  \set app_role app
\endif

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['household', 'policy', 'quote_shop', 'quote_result', 'renewal_transaction']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      $p$CREATE POLICY tenant_isolation ON %I
         USING (tenant_id = current_setting('app.current_tenant', true))
         WITH CHECK (tenant_id = current_setting('app.current_tenant', true));$p$,
      t
    );
  END LOOP;
END $$;

-- Privileges for the app role. RLS filters rows, but the role still needs table grants —
-- without these the API connects and sees nothing (permission denied), which is the usual
-- "RLS is on but the app is broken" trap.
--
-- DELETE is deliberately NOT granted: a quote_shop and its results are Take-All-Comers
-- evidence (who was approached, what came back, what was presented) and nothing in the
-- module deletes them. Withholding the privilege makes that an database-level guarantee
-- rather than a convention.
GRANT USAGE ON SCHEMA public TO :"app_role";
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO :"app_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"app_role";

-- Future tables created by later migrations inherit the same grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO :"app_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_role";
