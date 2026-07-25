/**
 * RLS tenant-isolation proof — the single most important test in this repo.
 *
 * A leak here is existential for a platform hosting multiple brokerages, so isolation is
 * VERIFIED on every commit rather than assumed. These assertions run as the real non-owner
 * app role against a real Postgres (FORCE ROW LEVEL SECURITY is bypassed by table owners,
 * so testing as the owner would prove nothing).
 *
 * Requires DATABASE_URL (owner, for fixtures) and APP_DATABASE_URL (the non-owner app role),
 * against a database that has had `prisma migrate deploy` + `prisma/rls.sql` applied.
 */
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';

const OWNER_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_DATABASE_URL;

// Fail loudly rather than fall back. If APP_DATABASE_URL were missing, Prisma would quietly
// use DATABASE_URL — the OWNER — and most assertions below would still pass while proving
// nothing about the role the API actually runs as. A silent pass is the one outcome this
// suite must never produce.
if (!OWNER_URL || !APP_URL) {
  throw new Error(
    'RLS suite needs DATABASE_URL (owner) and APP_DATABASE_URL (non-owner app role). ' +
      'Refusing to run: without both, this test can pass without proving isolation.',
  );
}
if (OWNER_URL === APP_URL) {
  throw new Error(
    'DATABASE_URL and APP_DATABASE_URL are identical. FORCE ROW LEVEL SECURITY is bypassed ' +
      'by table owners, so isolation must be proven as a separate NON-owner role.',
  );
}

const TENANT_A = 'tenant-rls-a';
const TENANT_B = 'tenant-rls-b';

const owner = new PrismaClient({ datasources: { db: { url: OWNER_URL } } });
/** The service the API actually uses, pointed at the NON-owner role. */
const app = new PrismaService({ datasources: { db: { url: APP_URL } } });

function household(id: string, tenantId: string) {
  return {
    id,
    tenantId,
    code: id,
    displayName: `Fixture ${id}`,
    primaryContact: {},
  };
}

beforeAll(async () => {
  await owner.tenant.upsert({ where: { id: TENANT_A }, update: {}, create: { id: TENANT_A, name: 'RLS A' } });
  await owner.tenant.upsert({ where: { id: TENANT_B }, update: {}, create: { id: TENANT_B, name: 'RLS B' } });

  // Even the owner must set the tenant GUC — FORCE ROW LEVEL SECURITY applies to owners.
  for (const [tenant, id] of [[TENANT_A, 'RLS-A-1'], [TENANT_B, 'RLS-B-1']] as const) {
    await owner.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenant}, true)`;
      await tx.household.upsert({ where: { id }, update: {}, create: household(id, tenant) });
    });
  }
});

afterAll(async () => {
  for (const [tenant, id] of [[TENANT_A, 'RLS-A-1'], [TENANT_B, 'RLS-B-1']] as const) {
    await owner.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenant}, true)`;
      await tx.household.deleteMany({ where: { id } });
    });
  }
  await owner.tenant.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } });
  await owner.$disconnect();
  await app.$disconnect();
});

describe('RLS tenant isolation (as the non-owner app role)', () => {
  it('a tenant sees its own rows', async () => {
    const rows = await app.forTenant(TENANT_A, (tx) => tx.household.findMany());
    expect(rows.map((r) => r.id)).toContain('RLS-A-1');
  });

  it('a tenant CANNOT see another tenant\'s rows', async () => {
    const rows = await app.forTenant(TENANT_A, (tx) => tx.household.findMany());
    expect(rows.map((r) => r.id)).not.toContain('RLS-B-1');
    expect(rows.every((r) => r.tenantId === TENANT_A)).toBe(true);
  });

  it('a targeted lookup of another tenant\'s row returns nothing (not the row)', async () => {
    // The dangerous case: a valid id from another tenant, guessed or leaked.
    const row = await app.forTenant(TENANT_A, (tx) =>
      tx.household.findUnique({ where: { id: 'RLS-B-1' } }),
    );
    expect(row).toBeNull();
  });

  it('with NO tenant context set, nothing is visible', async () => {
    // Not via forTenant — a raw query with no GUC, i.e. a code path that forgot to scope.
    const rows = await app.household.findMany();
    expect(rows).toHaveLength(0);
  });

  it('a write claiming another tenant is rejected by the policy WITH CHECK', async () => {
    await expect(
      app.forTenant(TENANT_A, (tx) =>
        tx.household.create({ data: household('RLS-SMUGGLED', TENANT_B) }),
      ),
    ).rejects.toThrow();

    // and nothing was written
    const smuggled = await owner.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant', ${TENANT_B}, true)`;
      return tx.household.findUnique({ where: { id: 'RLS-SMUGGLED' } });
    });
    expect(smuggled).toBeNull();
  });

  it('the app role cannot DELETE quote evidence (no privilege granted)', async () => {
    await expect(
      app.forTenant(TENANT_A, (tx) => tx.quoteResult.deleteMany({})),
    ).rejects.toThrow();
  });
});
