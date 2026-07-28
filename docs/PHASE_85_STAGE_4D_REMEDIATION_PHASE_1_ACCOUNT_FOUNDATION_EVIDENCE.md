# Phase 85 Stage 4D Remediation Phase 1 Account Foundation Evidence

Date: 2026-07-28
Branch: `codex/stage-4c-remediation`
Status: **IMPLEMENTED LOCALLY - not committed**

## Scope

Remediation Faz 1 closes the profile and tenant/account foundation findings from the Stage 4D post-closure audit. It does not implement Faz 2 auth/billing/PWA hardening and does not change production pilot posture.

Implemented:

- Canonical profile API: `GET /api/account/profile`, `PATCH /api/account/profile`.
- Legacy compatibility endpoint: `PATCH /api/dietitian/preferences` now uses account context, owner/admin/dietitian RBAC, and no longer mutates fallback demo state.
- Profile fields: `displayName`, `uiLanguage`, `timezone`.
- Profile RBAC: owner/admin/dietitian only; assistant/auditor denied.
- Account workspace foundation: `GET /api/account/workspace`, `PATCH /api/account/workspace`.
- Tenant workspace write CAS: `expectedSettingsRevision`, stale writes return conflict.
- Account members read foundation: `GET /api/account/members`, owner/admin only, ID-free read model.
- Append-only migration: `app/supabase/migrations/20260728170000_phase_85_stage_4d_remediation_account_foundation.sql`.

## Files Changed

- `app/src/lib/auth-context.ts`
- `app/src/lib/phase-85-stage-4d-own-profile.ts`
- `app/src/lib/phase-85-stage-4d-account-contracts.ts`
- `app/src/lib/phase-85-stage-4d-settings-contracts.ts`
- `app/src/lib/settings-server-read.ts`
- `app/src/lib/app-state-store.ts`
- `app/src/lib/supabase-store.ts`
- `app/src/app/api/account/profile/route.ts`
- `app/src/app/api/account/workspace/route.ts`
- `app/src/app/api/account/members/route.ts`
- `app/src/app/api/dietitian/preferences/route.ts`
- `app/src/components/settings/settings-profile-form.tsx`
- `app/src/components/settings/settings-sections.tsx`
- `app/src/lib/phase-85-stage-4d-settings-i18n.ts`
- `app/src/lib/phase-85-stage-4d-own-profile.test.ts`
- `app/src/lib/phase-85-stage-4d-account-contracts.test.ts`
- `app/src/lib/phase-85-stage-4d-settings-contracts.test.ts`
- `app/src/lib/supabase-rls.integration.test.ts`

## Architecture Evidence

- `resolveAccountTenantContext()` resolves authenticated user, first tenant membership, matching dietitian profile, and role without requiring active commercial entitlement. `resolveAppTenantContext()` still enforces active entitlement for clinical app workflows.
- `update_own_profile` capability now excludes assistant/auditor.
- Profile mutation authority is route and DB scoped by cookie-bound Supabase user context; client-supplied tenant/profile ids are not accepted.
- `p85_stage4d_update_own_profile_v2` validates timezone against `pg_timezone_names` and writes minimized audit metadata with field names only.
- `tenants.settings_revision` is append-only and defaults to `0`.
- `p85_stage4d_update_account_workspace` requires owner/admin and exact expected revision before tenant name mutation.
- `p85_stage4d_read_account_members` returns `displayName`, `role`, `membershipActive`, and `joinedAt` only; no user, tenant, membership, auth, or Stripe ids are returned.

## Verification

Passed:

- `npx vitest run src/lib/phase-85-stage-4d-own-profile.test.ts src/lib/phase-85-stage-4d-account-contracts.test.ts src/lib/phase-85-stage-4d-settings-contracts.test.ts --no-file-parallelism --maxWorkers=1`: 3 files passed, 12 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and 69 pre-existing Stage 4C warnings.
- `npm run build`: passed; build output includes `/api/account/profile`, `/api/account/workspace`, and `/api/account/members`.
- `git diff --check`: passed; repository CRLF conversion warnings only.
- Narrow secret scan over new/changed Faz 1 API, contract, migration, and evidence files: no matches.
- Cross-tenant/account scan over new account API and migration files: expected tenant/user constraints only; no client-supplied tenant authority found.
- Stale handoff scan: remaining Stage 4D closure/Faz 2 strings in updated authority files are labeled historical or superseded by remediation evidence.

Not passed:

- `npm run test:rls`: failed closed at preflight with 1 failed and 51 skipped because `MANU_ALLOW_REMOTE_RLS_TESTS` was not set and no approved local/remote RLS target was available. This is not counted as PASS.
- `npm run test`: started but did not complete in this run; the process was stopped after remaining silent for several minutes. This is not counted as PASS.

## Open Risks

- RLS migration behavior is not accepted until a clean Supabase reset and `npm run test:rls` pass with zero skipped mandatory tests.
- Remediation Faz 2 remains open for security route decoupling, durable auth rate limits, billing portal availability modeling, past-due recovery access, and PWA audit hardening.
- Production remains `NO-GO`; R-405 remains open; real WhatsApp, Telegram, external LLM, embedding, OCR, STT, live billing, monitoring, backup, secret-manager, and real health-data egress paths remain closed.
