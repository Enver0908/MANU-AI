# Phase 85 Stage 4D Remediation Phase 2 Security, Billing and PWA Evidence

Date: 2026-07-29

Status: **RECLOSED LOCALLY AFTER PRE-FAZ 3 RLS REPAIR**.

This evidence covers only Stage 4D remediation Faz 2: Auth, Billing and PWA Hardening. It does not approve production, push, deploy, live billing, real WhatsApp/Telegram, external LLM, embedding, OCR, STT, monitoring, backup, secret-manager, or real health-data egress.

Production remains `NO-GO`. R-405 remains open. Remote RLS override was not used. RLS verification was re-run against local Supabase after Docker Desktop became available.

## Implemented Scope

- Account identity security routes now use account tenant context instead of active-entitlement dashboard context:
  - `app/src/app/api/auth/email-change/route.ts`
  - `app/src/app/api/auth/reauthenticate/route.ts`
  - `app/src/app/api/auth/password-reset/route.ts`
  - `app/src/app/api/auth/password/route.ts`
- Password update is split by proof:
  - Settings password change requires a Supabase nonce.
  - Recovery password set requires the signed short-lived `manu_account_recovery_flow` HttpOnly cookie.
  - `/auth/callback` sets that cookie only after a Supabase `recovery` OTP callback resolves a user.
- Auth redirect base URLs are HTTPS-only except localhost development.
- Auth route IP rate-limit keys trust proxy headers only when `MANU_TRUST_PROXY_HEADERS=true`.
- Auth/public rate limits can use durable global Supabase RPC buckets through `consume_global_rate_limit`.
- Billing portal access no longer depends on active dashboard entitlement:
  - owner/admin plus active or past-due entitlement can open the sandbox Stripe portal when a customer mapping exists.
  - missing sandbox config, missing customer, forbidden role, and provider failure remain explicit states.
  - `/account/billing` exists as a payment-recovery surface outside the dashboard gate.
- Settings billing read model now includes `billing.portalState`.
- PWA install blocked reasons exposed by `resolveMobileInstallAccess()` are sanitized enum codes.
- Mobile install audit is tenant-scoped rate-limited, verifies the authenticated user still matches the resolved access user, and writes daily idempotent audit rows.
- Append-only migration `app/supabase/migrations/20260728180000_phase_85_stage_4d_remediation_security_billing_pwa.sql` adds:
  - `global_rate_limit_buckets`
  - service-role-only `consume_global_rate_limit`
  - updated tenant rate-limit scope support for `commercial_mobile_install_audit`
  - `mobile_install_audit_events.event_day`
  - duplicate audit archive table `mobile_install_audit_event_duplicate_archive`
  - daily unique index on `(tenant_id, dietitian_id, auth_user_id, event_type, event_day)`
  - stricter insert RLS requiring tenant membership plus matching dietitian/user relation
- Append-only migration `app/supabase/migrations/20260728190000_phase_85_stage_4d_pre_faz3_rls_reclosure.sql` closes the pre-Faz 3 direct profile mutation gap by revoking direct `dietitians` insert/update/delete from `anon` and `authenticated` while preserving authenticated read and RPC-mediated profile mutation.

## Architectural Boundaries

- Supabase Auth remains the owner of credentials, password state, email change, reset, and reauthentication.
- App tables do not store password hashes, reset tokens, email-change tokens, raw magic links, or secrets.
- Service-role access is used for durable rate-limit RPCs and billing store reads only; it is not used as end-user authorization.
- Billing portal remains sandbox-gated by `MANU_ALLOW_STRIPE_SANDBOX=true` and test Stripe keys.
- Clinical dashboard access remains blocked by inactive/past-due entitlement; `/account/billing` is the narrow payment recovery exception.
- PWA install audit stores sanitized user-agent summary only.

## Verification

Executed from `app/` unless noted.

| Check | Result | Evidence |
| --- | --- | --- |
| Targeted Vitest | PASS | `npx vitest run src/lib/phase-85-stage-4d-account-security.test.ts src/lib/phase-85-stage-4d-auth-server.test.ts src/lib/rate-limit.test.ts src/lib/phase-85-stage-4d-billing-pwa.test.ts src/lib/phase-85-stage-4d-settings-contracts.test.ts src/lib/phase-84d-customer-auth.test.ts src/lib/phase-83c-stripe-billing-gate.test.ts --no-file-parallelism --maxWorkers=1` -> 7 files passed, 41 tests passed. |
| Typecheck | PASS | `npm run typecheck` exited 0. |
| Lint | PASS with warnings | `npm run lint` exited 0 with 69 existing warnings in Stage 4C files; no lint errors. |
| Production build | PASS | `npm run build` exited 0; `/account/billing` appeared in the route list. |
| Full app Vitest excluding RLS | PASS | `npm run test` -> 237 files passed; 1435 tests passed; 9 skipped; duration 610.52s. The two stale own-profile role expectation tests were corrected to match the remediation Faz 1 RBAC contract (`owner/admin/dietitian` only). |
| Pre-Faz 3 targeted Vitest | PASS | `npx vitest run src/lib/phase-85-stage-4d-own-profile.test.ts src/lib/phase-85-stage-4d-billing-pwa.test.ts src/lib/rate-limit.test.ts --no-file-parallelism --maxWorkers=1` -> 3 files passed, 16 tests passed. |
| Clean local Supabase reset | PASS | `npx supabase db reset --local` exited 0 and applied through `20260728190000_phase_85_stage_4d_pre_faz3_rls_reclosure.sql`. |
| RLS integration | PASS | Local Supabase CLI env was mapped in-process without editing `.env.local`; `npm run test:rls` -> 1 file passed, 53 tests passed, 0 skipped. |
| Supabase DB lint | PASS with existing warnings | `npx supabase db lint --local` exited 0. Stage 4D `text[]` initialization warnings were removed; remaining warnings are existing Stage 4B/4C function warnings. |
| `git diff --check` | PASS with CRLF warnings | Exited 0. Only Windows `LF will be replaced by CRLF` warnings were reported. |
| Secret scan | PASS with documented false positives | `rg` found only existing docs/test fixture strings for sandbox `sk_test_`, blocked `sk_live_`, `whsec_test`, and scanner patterns; no new real secret values were added. |
| Cross-tenant/body authority scan | PASS | Targeted `rg` over auth/commercial APIs and lib files found no new `body.tenantId`, `body.auth_user_id`, or body-supplied Stripe customer authority patterns. |
| Stale handoff scan | PASS with intentional active wording | Targeted stale wording scan found no remaining "Faz 2 requires approval" handoff. `README.md` intentionally states Stage 5 is not next while remediation remains open. |

## Open Risks and Follow-Up

- Remediation Faz 3 remains the next separately approved implementation unit.
- Production pilot stays `NO-GO`; R-405 stays open.
- Live billing remains closed; this phase only hardens sandbox billing portal access and recovery.
- On Windows local Supabase, `supabase db reset --local` can leave Kong pointing at a stale Storage container IP. The verification run resolved this by restarting only the local `supabase_kong_manu-ai-local` container before the final RLS run.
