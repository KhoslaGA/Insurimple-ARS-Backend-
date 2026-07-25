# Insurimple-ARS Backend

NestJS + PostgreSQL BMS API for the Insurimple-ARS Rating & Quoting module. It serves the
party / policy / renewal / `quote_shop` / `quote_results` data that the `apps/bms` frontend
(in [KhoslaGA/Insurimple-ARS](https://github.com/KhoslaGA/Insurimple-ARS)) will consume.
Tenant-isolated via Postgres Row-Level Security.

## Domain

Mirrors `@insurimple/contracts`. The canonical risk (auto | property) is stored as JSON and
validated at the contracts edge; every tenant-scoped table carries `tenant_id`.

## Endpoints (Phase 1 — read)

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | liveness |
| GET | `/households/:id` | the party record |
| GET | `/households/:id/policies` | policies (each with its canonical `risk`) |
| GET | `/renewals` | the renewal queue |
| GET | `/shops/:id/results` | quote results for a shop |

## Endpoints (Phase 2 — write)

| Method | Path | Notes |
|---|---|---|
| POST | `/shops` | open a shop (one risk version → N carriers) |
| POST | `/shops/:id/results` | record a carrier's quote / referral / decline |
| POST | `/renewals/:id/outcome` | record a remarket outcome; computes the saved premium |

Write bodies are validated with zod at the trust boundary — the server re-checks the same
`quote_result` invariants the domain enforces (quoted ⟹ premium; a decline / referral ⟹ a
reason and no premium; a simulated result is never firm), because it must not trust the
client. There is deliberately **no bind / issue endpoint** — recording a quote or a remarket
decision never crosses into binding a policy.

All scoped endpoints require an `x-tenant-id` header (Phase 2 replaces this with the Clerk
org claim — tenant context must come from the verified token, never a request param). The
tenant flows into RLS through `PrismaService.forTenant`, which sets `app.current_tenant`
per transaction (`set_config(..., true)` — never a plain `SET`, which leaks across a pool).

## Run

```bash
npm install
cp .env.example .env             # set DATABASE_URL (a NON-owner app role)
npx prisma migrate deploy        # create the schema (or: npx prisma migrate dev)
npm run prisma:rls               # enable + FORCE RLS (prisma/rls.sql)
npm run seed                     # deterministic seed (the Okonkwo household)
npm run start:dev
```

The app must connect as a **non-owner** role so `FORCE ROW LEVEL SECURITY` applies (table
owners bypass RLS).

## Status

- **Phase 1:** scaffold + Prisma schema + RLS + read endpoints + seed.
- **Phase 2:** write endpoints (open shop, record result, record remarket outcome),
  zod-validated at the trust boundary; the typed API client in `@insurimple/contracts`
  (read + write) that `apps/bms` swaps its mock spine for; versioned migrations; CI.
- **Verified against a live Postgres 16**, not just compiled: migrations apply, RLS
  isolation holds as the non-owner role (6/6 in `test/rls.isolation.spec.ts`), the seed
  runs, and the API serves the seeded household / policies / renewals / quote results to
  `apps/bms` end to end.
- **Remaining:** Clerk auth + tenant context — the tenant must come from the verified org
  claim, replacing the `x-tenant-id` header. Then background job processing for carrier
  adapters (see below).

## Scaling notes

The data volume is modest — even at 100k clients this is a few million rows, which one
Postgres instance handles comfortably. The load-bearing concerns are elsewhere:

- **Carrier adapters must become background jobs.** Portal/API quotes take seconds to
  minutes, are rate-limited, and fail often; running them inside an HTTP request will not
  survive real volume. The `CarrierAdapter` seam means this is a swap behind an interface,
  not a rewrite. Needs retries, timeouts, idempotency, and per-carrier concurrency caps.
- **Isolation is verified, not assumed** — the RLS suite runs on every commit in CI.
- **Quote evidence is append-only**: the app role is granted SELECT/INSERT/UPDATE but not
  DELETE, so Take-All-Comers history can't be erased by application code.
