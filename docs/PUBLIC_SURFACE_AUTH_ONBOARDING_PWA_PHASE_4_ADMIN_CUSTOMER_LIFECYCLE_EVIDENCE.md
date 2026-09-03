# Public Surface/Auth/Onboarding/PWA Phase 4 Evidence

Date: 2026-09-04
Phase: `4 - Admin Customer Activation and Access Lifecycle`
Authority: `c:\Users\Dell\Downloads\PLAN (7).md` Faz 4 (`P4.1`–`P4.11`)
Canonical plan: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_ACTION_PLAN.md`
Parent HEAD: `0f1910b5a1bb1c87f1a6ceca2ab9f06abb9128b8`
Verdict: `PASS_LOCAL_PHASE_4_CLOSED`

## Scope

Allowlist admin session can list product customers, search by email, invite a new customer with one command, close access without deleting the auth user or health data, and reopen access on the same tenant through `renew` or atomic `reactivate`. Setup email is sent after invite provisioning. Duplicate auth user / open invite / tenant matches are blocked. Password recovery is a separate command. Stripe subscription and purchase routes are unchanged. Production remains `NO-GO`. No deploy, remote migration, WhatsApp, Z.ai, live billing, or production gate change was executed.

## Prerequisite

Phase 3 is locally closed. `/commercial-admin` already redirected to `/admin`. Manual entitlements already required allowlist session plus same-origin and called `apply_manual_entitlement_operation` for `activate|renew` only. Generic entitlement transitions still forbid `revoked → active`. Phase 3 claim still requires a consumed invite plus an active entitlement before it can create membership/profile.

## Requirement-diff matrix

| Adım kimliği | Beklenen sonuç | Değişen dosyalar | İnceleme kanıtı | Durum | Test sonucu | Sapma | Kapanış |
|---|---|---|---|---|---|---|---|
| P4.1 | Map admin list, invite, manual entitlement, revoke, and audit chain | Evidence only | Console lives at `/admin` via `CommercialAdminConsole`. Invite GET/POST, manual-entitlements POST, revoke POST, subscriptions GET remnant, audit GET, and `commercial-admin-store` were inventoried before mutation work | `IMPLEMENTED_AND_INSPECTED` | Inventory plus later targeted unit tests | `/commercial-admin/page.tsx` remains a redirect; emergency token UI stays at `/commercial-admin/emergency` | Closed |
| P4.2 | Simplify admin panel around customer list and email search | `commercial-admin-console.tsx`, `invites/route.ts`, `phase-83f-commercial-admin.ts`, `commercial-admin-store.ts` | Customer DTO exposes email, workspace name, access label (`Aktif` / `Süresi dolmuş` / `Erişim kapalı` / `Kurulum bekliyor`), paid-through, revision, and one primary action. GET `/api/commercial/admin/invites` returns `{ invites, customers }` and accepts `email` search. No Stripe payloads on the DTO | `IMPLEMENTED_AND_INSPECTED` | Customer projection unit tests PASS | Stripe remnant subscription cards remain visible below the customer list | Closed |
| P4.3 | Block duplicate auth user, open invite, or tenant for the same email | `phase-83f-commercial-admin.ts`, `commercial-admin-store.ts`, `invites/route.ts` | `evaluateCommercialAdminInviteDuplicate` blocks create and returns `open_invite_exists`, `existing_account`, `existing_customer_use_reactivate`, `existing_auth_user`, or `ambiguous_tenant_match`. Multiple tenant IDs do not auto-select | `IMPLEMENTED_AND_INSPECTED` | Duplicate and ambiguous-tenant unit tests PASS | Auth-user lookup uses service-role `listUsers` pagination (first 200) in the default adapter | Closed |
| P4.4 | Present new-customer invite as one command using existing backends in sequence | `invites/route.ts`, `commercial-admin-store.ts`, `phase-84f-admin-console.ts`, `commercial-admin-console.tsx` | Session allowlist + same-origin POST `{ command: "invite_customer", email, paidThrough }` creates the invite if needed, calls existing `activate`, then sends setup email. Retry resends without inserting a second invite row. Email failure returns `setup_email_failed` | `IMPLEMENTED_AND_INSPECTED` | Invite-command validator + duplicate/resend tests PASS | PLAN data-flow step 7 says claim creates tenant/entitlement; existing claim cannot. P4.4 therefore runs existing `activate` first so Phase 3 claim can attach membership on the same tenant | Closed |
| P4.5 | Append-only migration adding atomic `reactivate` | `app/supabase/migrations/20260903100000_commercial_entitlement_reactivation.sql` | New file widens action/audit checks, replaces `apply_manual_entitlement_operation` with the same signature, allows `reactivate` only from `revoked`, keeps revision/hash idempotency, service-role execute, and `copiedClientData: false` | `IMPLEMENTED_AND_INSPECTED` | Historical + new migration contract tests PASS | Local SQL file was not applied to remote/production Supabase | Closed |
| P4.6 | Extend type, validator, request hash, RPC, and audit for `reactivate` | `phase-83f-commercial-admin.ts`, `commercial-admin-store.ts`, `manual-entitlements/route.ts` | Action union is `activate\|renew\|reactivate`. Reactivate plan requires existing tenant and `revoked` status. Request hash includes action and `expectedRevision`. Audit types include `manual_entitlement_reactivated` | `IMPLEMENTED_AND_INSPECTED` | Validator, plan, and hash tests PASS | Generic `transitionCommercialEntitlement(revoked → active)` remains blocked; only the dedicated RPC path reactivates | Closed |
| P4.7 | Wire “Erişimi kapat” to existing revoke with confirmation and expected revision | `entitlements/revoke/route.ts`, `commercial-admin-store.ts`, `commercial-admin-console.tsx`, `phase-83f-commercial-admin.ts` | Allowlist + same-origin. `expectedRevision` is required. Store passes it to `applyCommercialEntitlementStatus`. UI confirmation copy states auth/health data are not deleted. Conflict returns `409` | `IMPLEMENTED_AND_INSPECTED` | Revoke validator + 83b/83g revoked-access tests PASS | Emergency token can no longer mutate revoke/invite; PLAN requires allowlist for mutations | Closed |
| P4.8 | “Erişimi yenile” on the existing tenant without a new account | `commercial-admin-console.tsx`, `phase-83f-commercial-admin.ts`, manual-entitlements RPC | Row action posts `reactivate` or `renew` with the existing `inviteId`, tenant, and `expectedRevision`. Duplicate invite is blocked for existing customers | `IMPLEMENTED_AND_INSPECTED` | Projection + reactivate plan tests PASS | Expired manual transfer stays `status=active` with past `paidThrough`; UI uses `renew`, not `reactivate` | Closed |
| P4.9 | Keep password recovery separate from entitlement actions | `invites/route.ts`, `commercial-admin-store.ts`, `commercial-admin-console.tsx` | Distinct POST command `send_password_recovery` writes `password_recovery_requested` and does not call entitlement RPC. Public `/api/auth/password-reset` was not rewritten | `IMPLEMENTED_AND_INSPECTED` | Audit-type and command-routing inspection | Recovery email uses existing `resetPasswordForEmail` / recovery callback | Closed |
| P4.10 | Verify no Stripe subscription/purchase route diff | none of the Stripe routes | `git diff` on `admin/subscriptions/route.ts`, `admin/subscriptions/cancel/route.ts`, checkout/purchase files is empty. UI keeps Stripe remnant cards and cancel | `IMPLEMENTED_AND_INSPECTED` | Empty git diff on those paths | Stripe-connected revoke still does not call Stripe cancel | Closed |
| P4.11 | Cross-tenant and unauthorized-admin tests + evidence | this file, action plan, handoff, next-phase, risk register | Ambiguous tenant blocks action. Non-allowlisted email is denied. Same-origin helper rejects foreign origin. Revoked entitlement is denied on dashboard/API. RLS suite is environment-blocked, not PASS | `IMPLEMENTED_AND_INSPECTED` | Targeted unit 54/54; visual desktop 5/5; typecheck/lint/build/`git diff --check` PASS; `npm run test:rls` blocked | iPhone Safari/PWA remains `WAIVED_NOT_EXECUTED`. Remote migration not applied | Closed |

## Surfaces kept

Emergency token inspection at `/commercial-admin/emergency` remains read-capable. Stripe remnant list/cancel remains. Ledger, leads, and audit cards remain secondary. Phase 3 password login and onboarding claim are unchanged. Production pilot remains `NO-GO`.

## Verification

Command: `npx vitest run src/lib/phase-83f-commercial-admin.test.ts src/lib/phase-84f-admin-console.test.ts src/lib/manual-entitlements-migration-contract.test.ts src/lib/commercial-entitlement-reactivation-migration-contract.test.ts src/lib/commercial-admin-access.test.ts src/lib/commercial-admin-request-hash.test.ts src/lib/phase-83b-commercial-entitlement-model.test.ts src/lib/phase-83g-entitlement-hardening.test.ts src/lib/phase-84h-verification-refresh.test.ts --no-file-parallelism --maxWorkers=1`

```text
Test Files  9 passed (9)
Tests  54 passed (54)
```

Command: `npx playwright test tests/visual/commercial-saas.visual.spec.ts --project=desktop`

```text
5 passed (11.6s)
```

Command: `npm run typecheck`

```text
PASS - tsc --project tsconfig.production.json
```

Command: `npm run lint`

```text
0 errors, 76 existing unused-var warnings. Phase 4 files linted clean.
```

Command: `npm run build`

```text
PASS - webpack production build. Routes include `/admin`, `/commercial-admin`, `/onboarding`, `/login`. `/signup` and `/register` are absent.
```

Command: `git diff --check`

```text
PASS - no whitespace errors (CRLF conversion warnings only)
```

Command: `git diff -- app/src/app/api/commercial/admin/subscriptions/route.ts app/src/app/api/commercial/admin/subscriptions/cancel/route.ts app/src/app/api/commercial/checkout/route.ts`

```text
empty
```

Command: `npm run test:rls`

```text
NOT PASS - environment-blocked. RLS suite blocked: MANU_ALLOW_REMOTE_RLS_TESTS. Local Supabase was not running. 1 failed preflight / 55 skipped. This is not recorded as PASS.
```

## Production boundary

Production remains `NO-GO`. The append-only reactivation migration is local-only and was not applied remotely. No push, deploy, Stripe live billing, WhatsApp, Z.ai, or production gate change is authorized. Next eligible unit is Phase 5 only after explicit user approval.
