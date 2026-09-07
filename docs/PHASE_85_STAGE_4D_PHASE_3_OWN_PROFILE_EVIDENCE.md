# Phase 85 Stage 4D — Faz 3 Own Profile Update Evidence

**Date:** 2026-07-28  
**Branch:** `codex/stage-4c-remediation`  
**Scope:** Faz 3 only — `displayName` + `uiLanguage` self-scoped mutation

## Delivered

- `AppCapability`: `update_own_profile` for owner, admin, dietitian, assistant, auditor
- `PATCH /api/dietitian/preferences` — body `{ displayName?, uiLanguage? }`, response `{ profile, changedFields }`
- Migration `20260728120000_phase_85_stage_4d_own_profile.sql` — RPC `p85_stage4d_update_own_profile`
- Settings profile form with save, success/error, unsaved leave warning
- Dashboard language selector compatibility via profile merge in `use-manu-state`

## Security / data ownership

- RPC derives tenant/profile from `auth.uid()`; no client-supplied tenant/actor/profile IDs
- Active entitlement required; idempotent when values unchanged (no extra audit row)
- Audit metadata: `changedFields` + `minimized: true` only — no old/new display name or language values

## Tests added

- `phase-85-stage-4d-own-profile.test.ts` — validation, RPC mapping, fallback state idempotency
- `auth-context.test.ts` — five-role `update_own_profile` capability matrix
- `supabase-rls.integration.test.ts` — RPC positive/negative, cross-tenant isolation, idempotent audit, direct table update blocked

## Verification commands

```powershell
cd app
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:rls
```

Record actual pass/fail counts below after local run.

## Verification results

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` (changed files) | PASS |
| `npm run build` | PASS |
| `vitest` targeted own-profile + auth-context | 15/15 PASS |
| `npm run test:rls` | BLOCKED — local Supabase not running (`MANU_ALLOW_REMOTE_RLS_TESTS` required for remote) |

## Out of scope (unchanged)

- Production `NO-GO`, R-405 open
- Email, password, billing portal, PWA install actions
- Cross-user profile mutation, tenant/workspace edits
