# Hosted Sandbox Phase 1 Tenant Isolation Evidence

Date: 2026-08-25

Contract: `hosted-sandbox-environment-assurance-v1`

Phase: `HS-FAZ-1`

Independent review: `NOT_REQUESTED`

Production: `NO-GO`

## What this phase did

Faz 1 removed `ensureDemoData()` from hosted Supabase read/mutation paths, tightened tenant membership resolution to fail-closed (`403 no_tenant_membership`, `409 account_context_ambiguous`), gated demo login to `NODE_ENV=development` + localhost + `MANU_ALLOW_PUBLIC_DEMO_LOGIN=true`, and added an idempotent demo cleanup script with `--dry-run` default and explicit `--apply`.

Remote cleanup was not executed. Hosted data was not modified.

## Changed surfaces

- `app/src/lib/demo-fixture-access.ts`
- `app/src/lib/auth-context.ts`
- `app/src/lib/supabase-store.ts`
- `app/src/lib/phase-84b-public-website.ts`
- `app/src/app/api/demo-login/route.ts`
- `app/scripts/hosted-sandbox-demo-cleanup.mjs`
- `app/src/lib/hosted-sandbox-tenant-isolation.test.ts`
- `app/src/lib/auth-context.test.ts`
- `app/src/lib/phase-84b-public-website.test.ts`

## Commands

| Command | Exit code | Result |
| --- | --- | --- |
| `cd app && npx vitest run src/lib/hosted-sandbox-tenant-isolation.test.ts src/lib/auth-context.test.ts src/lib/phase-84b-public-website.test.ts` | 0 | PASS 30/30 |
| `cd app && npm run test:rls` | — | BLOCKED without Docker/local Supabase |
| `node app/scripts/hosted-sandbox-demo-cleanup.mjs --dry-run` | — | Not run; requires configured Supabase and is not required for local oracle PASS |

## Residual

- Cleanup script is verified by unit/oracle tests only; live `--dry-run` against hosted Supabase awaits explicit user approval in Faz 6.
- `test:rls` remains BLOCKED when Docker/local Supabase is unavailable.
- Production remains `NO-GO`.
- Independent review remains `NOT_REQUESTED`.
