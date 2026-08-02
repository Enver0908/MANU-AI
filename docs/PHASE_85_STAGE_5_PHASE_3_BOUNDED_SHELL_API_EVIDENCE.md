# Phase 85 Stage 5 Phase 3 Bounded Shell API Evidence

Date: 2026-08-02

Branch: `codex/stage-4c-remediation`

Status: **COMPLETE locally — bounded shell HTTP APIs, read model store, bootstrap/search RPCs, and contract tests**.

This phase implements Stage 5 Faz 3 only: shell contracts, server store, five authenticated no-store routes, bounded SQL RPCs, shell rate-limit scopes, and targeted unit tests. It does not implement shell provider/UI (Faz 4), responsive navigation (Faz 5), active-client selector UI (Faz 6), offline lock, or manifest branding.

Production remains `NO-GO`. R-405 remains open. Push, PR, deploy, and production gates are out of scope.

## Scope

Implemented:

- `app/src/lib/phase-85-stage-5-shell-contracts.ts` — destination IDs, DTOs, parsers, role navigation/home-action projection, PHI key scan helper, rate-limit constants
- `app/src/lib/phase-85-stage-5-shell-store.ts` — bootstrap, client search, preferences update, version resolver
- `app/src/lib/phase-85-stage-5-shell-api.ts` — no-store JSON/error helpers
- `app/src/lib/phase-85-stage-5-shell-route.ts` — auth/entitlement guards and per-route rate limits
- HTTP routes:
  - `GET /api/shell/bootstrap?activeClientId=`
  - `GET /api/shell/clients?query=&limit=20`
  - `PATCH /api/shell/preferences`
  - `POST /api/session/activity`
  - `GET /api/shell/version?clientVersion=`
- Migration `app/supabase/migrations/20260802120000_phase_85_stage_5_shell_api_foundation.sql`
  - `p85_stage_5_load_shell_bootstrap_v1`
  - `p85_stage_5_search_shell_clients_v1`
  - `p85_stage_5_project_shell_active_client_v1`
  - shell rate-limit scopes on `consume_rate_limit`
- `app/src/lib/rate-limit.ts` shell scopes in `RATE_LIMITS`

Excluded (later Stage 5 phases):

- Dashboard layout/shell provider (Faz 4)
- Responsive bottom nav and SiriusAI branding (Faz 5)
- Active-client selector UI and home launcher components (Faz 6)
- Offline full-screen lock and PWA update flow (Faz 7)

## API Contract Summary

| Route | Rate limit | Notes |
| --- | --- | --- |
| `GET /api/shell/bootstrap` | 60/min | Fail-closed `503 shell_bootstrap_unavailable` on badge aggregation failure; invalid URL `activeClientId` yields warning `client_context_unavailable` without failing bootstrap |
| `GET /api/shell/clients` | 30/min | Empty query returns recent 20; query length 2–80; reference decode in store layer |
| `PATCH /api/shell/preferences` | 30/min | Requires `requestId` + `expectedRevision`; rejects client identity fields |
| `POST /api/session/activity` | 12/min | Touch-only; cannot unlock locked sessions |
| `GET /api/shell/version` | auth only | Compares `clientVersion` param to `SIRIUSAI_SHELL_MIN_CLIENT_VERSION` / `NEXT_PUBLIC_SIRIUSAI_APP_VERSION` default |

All shell responses use `Cache-Control: no-store` and `{ "error": "stable_code" }` failures.

`/api/app-state` remains the legacy compatibility path unchanged.

## Data Flow

1. Route resolves `resolveAccountTenantContext()` (assert-only session) or `resolveAccountTenantContextForSessionActivity()` (touch path).
2. `assertActiveCommercialEntitlement()` and `read_app_state` capability gate run before store/RPC work.
3. Store calls bounded RPCs; TypeScript layer adds `referenceShort`, navigation, home actions, and capabilities.
4. Provider/UI consumers (Faz 4+) will call these routes instead of broad `/api/app-state` for shell identity, badges, and active-client projection.

## Error And Boundary Cases

| Case | Behavior |
| --- | --- |
| Entitlement inactive | `403 entitlement_inactive` |
| Bootstrap badge query failure | `503 shell_bootstrap_unavailable` (no partial counts) |
| Unauthorized `activeClientId` in bootstrap URL | Bootstrap succeeds with `warnings: ["client_context_unavailable"]` |
| Stale preference `active_client_id` | RPC atomically clears preference before projection |
| Search query length 1 | `400 invalid_search_query` (route rejects before RPC) |
| Preferences without `requestId` / `expectedRevision` | `400` stable validation codes |
| Revision conflict | `409 preferences_revision_conflict` |
| Supabase store unavailable | `503 shell_bootstrap_unavailable` |
| Client version below minimum | `updateRequired: true` in version DTO |

## Verification

Executed from `app/` unless noted.

| Check | Result | Evidence |
| --- | --- | --- |
| Shell contracts Vitest | PASS | `npx vitest run src/lib/phase-85-stage-5-shell-contracts.test.ts` → 11 tests |
| Shell API Vitest | PASS | `npx vitest run src/lib/phase-85-stage-5-shell-api.test.ts` → 4 tests |
| Shell session Vitest | PASS | `npx vitest run src/lib/phase-85-stage-5-shell-session.test.ts` → 4 tests |
| Faz 2 migration contract Vitest | PASS | `npx vitest run src/lib/phase-85-stage-5-shell-migration-contract.test.ts` → 3 tests |
| Typecheck | PASS | `npm run typecheck` exited 0 |
| Bootstrap payload fixture | PASS | Contract test ≤ 20 KB, PHI key scan clean |
| Local Supabase reset | BLOCKED | Docker Desktop unavailable (`supabase db reset --local` not run) |
| RLS integration | BLOCKED | `npm run test:rls` requires local Supabase |

## Next Phase Entry

Stage 5 Faz 4 (authenticated shell provider and dashboard layout) may start after Faz 3 commit verification. Prefer local Supabase reset + RLS 0-skip before claiming full SQL closure when Docker becomes available.

## Changed Files

- `app/supabase/migrations/20260802120000_phase_85_stage_5_shell_api_foundation.sql`
- `app/src/lib/phase-85-stage-5-shell-contracts.ts`
- `app/src/lib/phase-85-stage-5-shell-contracts.test.ts`
- `app/src/lib/phase-85-stage-5-shell-store.ts`
- `app/src/lib/phase-85-stage-5-shell-api.ts`
- `app/src/lib/phase-85-stage-5-shell-api.test.ts`
- `app/src/lib/phase-85-stage-5-shell-route.ts`
- `app/src/lib/rate-limit.ts`
- `app/src/app/api/shell/bootstrap/route.ts`
- `app/src/app/api/shell/clients/route.ts`
- `app/src/app/api/shell/preferences/route.ts`
- `app/src/app/api/shell/version/route.ts`
- `app/src/app/api/session/activity/route.ts`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `PLAN.md`
- `README.md`
- `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`
