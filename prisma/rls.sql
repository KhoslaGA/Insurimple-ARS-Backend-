-- Row-Level Security for Insurimple-ARS (run AFTER `prisma migrate deploy`).
--
-- Multi-tenancy from row one, vendor-blind. The app connects as a NON-owner role so
-- FORCE ROW LEVEL SECURITY applies to it (table owners bypass RLS). Tenant context is
-- set per transaction with `SELECT set_config('app.current_tenant', $1, true)` — never a
-- plain SET (which would leak across a pooled connection). See PrismaService.forTenant.

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
