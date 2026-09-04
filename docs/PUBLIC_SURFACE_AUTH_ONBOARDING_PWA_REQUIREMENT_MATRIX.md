# AIya Public Surface Requirement Matrix

Status: `FAZ_8_RECLOSURE_IN_PROGRESS`
Authority: `C:\Users\Dell\Downloads\PLAN (7).md` and `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_ACTION_PLAN.md`
Created: 2026-09-04
Rule: `failed`, `skipped`, `simulated`, `stale`, and `environment-blocked` are not PASS. Production remains `NO-GO`.

This matrix is the immutable requirement register for the public surface, auth, onboarding, admin, dashboard, PWA, and governance track. Phase 0–7 historical evidence remains readable; Faz 8 must reclose every row against a clean local HEAD.

| ID | Group | PLAN (7) step | Requirement | Primary files | Tests / gates | Closure |
|---|---|---|---|---|---|---|
| SESSION-01 | SESSION | P2.1–P2.3, F8.2 | Idle window is two hours in client, API, store, and SQL | `phase-85-stage-5-shell-session-policy.ts`, `20260903090000_public_surface_session_idle_timeout.sql` | shell-session tests, migration contract | Pending Faz 8 |
| SESSION-02 | SESSION | P2.4–P2.8, F8.2 | Touch is server-authoritative; hidden tabs do not keepalive; cooldown is 1 minute | `shell-provider.tsx`, session policy | shell-session tests | Pending Faz 8 |
| SESSION-03 | SESSION | P2.9, F8.2 | Authenticated clients cannot execute session write RPCs | `20260904180000_public_surface_faz8_session_service_role.sql`, `phase-85-stage-5-shell-session.ts`, `/api/session/activity` | RLS session test, unit v3 contract | Pending Faz 8 |
| SESSION-04 | SESSION | F8.2 | Lock and session_locked audit persist after JSON `locked` (no exception rollback of the write) | v3 RPC + read-only v1 guard | RLS lock persistence | Pending Faz 8 |
| SESSION-05 | SESSION | P2.7, F8.2 | Multi-tab idle clock is the auth session id | session policy | shell-session tests | Pending Faz 8 |
| AUTH-01 | AUTH | P3.1–P3.4 | Daily login is password-first; magic link is explicit fallback | `customer-login-form.tsx` | phase-7 / phase-3 tests | Pending Faz 8 |
| AUTH-02 | AUTH | P3.2 | Post-auth allowlist uses `/app-install`, not `/install` | `phase-84d-customer-auth.ts` | phase-7 tests | Pending Faz 8 |
| AUTH-03 | AUTH | P3.5–P3.9, F8.4 | Invite email is read-only; password then claim; revoked/expired/mismatch fail-closed | `onboarding-claim-panel.tsx`, onboarding status/claim routes | onboarding tests | Pending Faz 8 |
| AUTH-04 | AUTH | F8.4 | Password success + claim failure persists `claim_pending`; reload retries claim without re-entering password | `commercial_onboarding_events`, password route, status route | deriveOnboardingClaimPending tests | Pending Faz 8 |
| ADMIN-01 | ADMIN | P4.1–P4.4 | Admin can list, search, invite, revoke, renew/reactivate | `commercial-admin-console.tsx`, `commercial-admin-store.ts` | admin tests | Pending Faz 8 |
| ADMIN-02 | ADMIN | P4.3, F8.3 | Duplicate invite/auth/tenant is blocked; concurrent same email uses advisory lock | `commercial_admin_invite_customer_v1` | store + RLS | Pending Faz 8 |
| ADMIN-03 | ADMIN | F8.3 | Auth user lookup paginates past 200 users | `lookupCommercialAdminAuthUserIdByEmail` | 201st-user test | Pending Faz 8 |
| ADMIN-04 | ADMIN | F8.3 | Customer list is one bounded projection RPC, not N+1 | `commercial_admin_list_customers_v1` | 50/200 query-budget test | Pending Faz 8 |
| ADMIN-05 | ADMIN | F8.3 | Customer search is submit-only and does not reload subscriptions/ledger/leads/audit/health | `commercial-admin-console.tsx` | console source test | Pending Faz 8 |
| ADMIN-06 | ADMIN | P4.5–P4.9 | Reactivate/renew keep tenant; no WhatsApp backfill; copiedClientData false | reactivation SQL, admin store | phase-7 P7.5 | Pending Faz 8 |
| ADMIN-07 | ADMIN | P4.10, F8.3 | Stripe checkout/webhook routes have no Faz 8 behavior diff | `app/api/commercial/checkout`, webhook | kept-backend graph | Pending Faz 8 |
| DASHBOARD-01 | DASHBOARD | P1.1–P1.9 | Production dashboard has no simulator/operational/demo chrome | dashboard-app/shell/nav | phase-1/7 tests | Pending Faz 8 |
| DASHBOARD-02 | DASHBOARD | P7.1–P7.2, F8.5 | Proven-unused UI files stay deleted; live import graph fails if they return | `analyze-frontend-import-graph.mjs` | graph script + phase-7 test | Pending Faz 8 |
| DASHBOARD-03 | DASHBOARD | F8.5 | Fallback bootstrap does not enable simulator; unused `onNavigateDestination` is removed | provider-state, dashboard-nav/shell | faz8 reclosure tests | Pending Faz 8 |
| PUBLIC-01 | PUBLIC | P5.1–P5.10 | Public CTA is contact + login; AIya brand; no public invite start | public components, metadata | phase-5/7 tests | Pending Faz 8 |
| PWA-01 | PWA | P6.1–P6.9 | Manifest/SW installable; API/auth/dashboard network-only; offline privacy-lock | `public/sw.js`, pwa runtime | PWA tests | Pending Faz 8 |
| PWA-02 | PWA | P6.10, F8.7 | Physical Android Chrome + A2HS/standalone PWA + TalkBack for this revision | `docs/stage-7-real-device/YYYY-MM-DD/` | `npm run test:stage-7-real-device` | Pending physical device |
| PWA-03 | PWA | P6.10 | iPhone Safari/PWA remains `WAIVED_NOT_EXECUTED`, not PASS | owner waiver docs | waiver disclosure | Waiver retained |
| GOVERNANCE-01 | GOVERNANCE | P0.1–P0.8, F8.1 | Single canonical plan; no dual stale Phase 3 header | this file + action plan | doc uniqueness test | Pending Faz 8 |
| GOVERNANCE-02 | GOVERNANCE | P7.8–P7.12, F8.6, F8.8 | Local RLS zero-skip; audit 503 is BLOCKED; release identity is real HEAD; no deploy | verify scripts, RLS | full matrix | Pending Faz 8 |
| GOVERNANCE-03 | GOVERNANCE | Non-negotiable | Production `NO-GO`; live VPS `4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9` unchanged | handoff/README | evidence | Locked |

## PLAN (7) step coverage

Every `P0.1`–`P7.12` identifier below must appear exactly once as a step id in the canonical action plan and at least once in this matrix.

P0.1 P0.2 P0.3 P0.4 P0.5 P0.6 P0.7 P0.8
P1.1 P1.2 P1.3 P1.4 P1.5 P1.6 P1.7 P1.8 P1.9
P2.1 P2.2 P2.3 P2.4 P2.5 P2.6 P2.7 P2.8 P2.9
P3.1 P3.2 P3.3 P3.4 P3.5 P3.6 P3.7 P3.8 P3.9 P3.10
P4.1 P4.2 P4.3 P4.4 P4.5 P4.6 P4.7 P4.8 P4.9 P4.10 P4.11
P5.1 P5.2 P5.3 P5.4 P5.5 P5.6 P5.7 P5.8 P5.9 P5.10
P6.1 P6.2 P6.3 P6.4 P6.5 P6.6 P6.7 P6.8 P6.9 P6.10
P7.1 P7.2 P7.3 P7.4 P7.5 P7.6 P7.7 P7.8 P7.9 P7.10 P7.11 P7.12
