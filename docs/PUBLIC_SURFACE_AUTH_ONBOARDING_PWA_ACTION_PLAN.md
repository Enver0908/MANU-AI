# AIya Public Surface, Auth, Onboarding, Admin and PWA Action Plan

Status: `FAZ_8_RECLOSURE_IN_PROGRESS`
Created: 2026-09-03
Updated: 2026-09-04
Authority: User-authoritative source is `C:\Users\Dell\Downloads\PLAN (7).md`. This file is the single in-repo canonical plan. Requirement IDs live in `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_REQUIREMENT_MATRIX.md`.
Phase 0–7 historical evidence remains; those PASS verdicts are superseded for current closure until Faz 8 recloses them. Production remains `NO-GO`.
Next eligible unit: complete Faz 8 (`F8.1`–`F8.8`) locally. No deploy, push, remote migration, Stripe live billing, WhatsApp, Z.ai, DNS, or production gate change.

## PLAN (7) canonical step register

P0.1 Branch, HEAD, upstream, worktree, remote branch ve `git diff --check` sonuçlarını yeniden doğrula.
P0.2 Gereksinimleri `SESSION`, `AUTH`, `ADMIN`, `DASHBOARD`, `PUBLIC`, `PWA`, `GOVERNANCE` gruplarına ayır ve her birine değişmez kimlik ata.
P0.3 Bu sekiz fazı kanonik action plan dosyasına eksiksiz ekle.
P0.4 Her faz için sıralı adım tablosu, test kapısı ve kapanış kontrol listesi oluştur.
P0.5 Local/canlı release farkını ve hiçbir deploy yapılmayacağını baseline evidence içine kaydet.
P0.6 `NEXT_PHASE_EXECUTION_PLAN` ve handoff içindeki aktif sonraki adımı Faz 1 olarak uzlaştır.
P0.7 Risk register’da yalnızca bu kapsamla gerçekten ilişkili açık risklerin plan referanslarını uzlaştır.
P0.8 Belge bağlantıları, commit kimlikleri ve plan çelişkileri için son inceleme yap.
P1.1–P1.9 Dashboard üretim yüzeyi sadeleştirmesi (PLAN (7) Faz 1).
P2.1–P2.9 İki saatlik güvenli oturum (PLAN (7) Faz 2).
P3.1–P3.10 Şifre öncelikli giriş ve davet onboarding (PLAN (7) Faz 3).
P4.1–P4.11 Admin müşteri yaşam döngüsü (PLAN (7) Faz 4).
P5.1–P5.10 Public site, CTA, marka ve metadata (PLAN (7) Faz 5).
P6.1–P6.10 PWA, kurulum, responsive ve erişilebilirlik (PLAN (7) Faz 6).
P7.1–P7.12 Kullanılmayan frontend temizliği ve birleşik yerel kapanış (PLAN (7) Faz 7).

## Non-Negotiable Gates

1. Each phase is executed only after explicit user approval for that phase.
2. Each phase step has an ID. A later implementation step cannot begin until the previous implementation step is completed exactly as written and inspected against its acceptance checks.
3. Test success alone cannot close a phase. The phase closes only when every planned step is implemented as specified, every required document/evidence update is reconciled, and every required verification passes.
4. Failed, skipped, simulated, stale, or environment-blocked verification is recorded honestly and cannot be counted as PASS.
5. No commit, push, PR, merge, deploy, production migration, production worker start, provider/channel egress, live billing change, DNS change, SMTP change, or production `GO` is allowed without a separate explicit user command.
6. Production remains `NO-GO` throughout this plan unless the owner separately reverses that decision through the production readiness gate process.
7. The active visible brand is `AIya`; active public domain is `https://aiyaworkspace.com`; active admin domain is `https://admin.aiyaworkspace.com`; active business email is `contact@aiyaworkspace.com`; active auth sender is `AIya <no-reply@auth.aiyaworkspace.com>`.
8. Compatibility names are not renamed: `MANU_*` env vars, `x-siriusai-*` headers, `siriusai-app-version` metadata key, `siriusai-static-*` and `siriusai-assets-*` service-worker caches, `manu-ai-shell-*` old cache cleanup prefix, migration names, persisted IDs/enums, server folders, and PM2 process names.
9. WhatsApp real traffic, Z.ai real egress, live billing automation, production schema rollout, production workers, and real health-data paths remain closed.
10. The app remains online-only. No offline health-data cache, offline mutation queue, or offline editing workflow is added.

## Current Baseline

- Local branch: `codex/production-readiness-stage-1`
- Local HEAD: `931bb5a1fea749f5fb607e3fd346d4bf3ad38fdc`
- Upstream branch: `origin/codex/production-readiness-stage-1`
- Remote branch HEAD: `931bb5a1fea749f5fb607e3fd346d4bf3ad38fdc`
- Live VPS release commit: `4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9`
- Live release ID: `hs-4c7bbea8ba21-2c32cf194421`
- Local HEAD is ahead of the live release by documentation/evidence commits. This is expected and does not authorize deploy.

## Locked Product Decisions

1. Dashboard production cleanup removes visible simulator, quarantine/trust inspection, operational foundation/counter panels, local safe-mode copy, demo reset control, duplicate top language selector, operational header, and top client picker. Backend simulator/trust/quarantine logic remains unless a later phase proves a code path is unused and removal is specifically in scope.
2. Secure session continuity uses a two-hour inactivity window for web and PWA. A user who keeps the tab/app open and returns within two hours should resume without re-login. A user inactive for two hours or more must re-authenticate. No fake background keepalive is allowed.
3. Auth becomes password-first for daily login, with magic link preserved as fallback/recovery. Onboarding remains invite-only and uses a setup email sent by admin.
4. First-time onboarding uses the invited email as fixed identity. The user sets a password and enters the dashboard after successful claim.
5. Admin must be able to see users/customers, search by email, invite a customer, revoke access, and reactivate/renew access in a simple UI.
6. Access is tied to tenant/account/entitlement records, not email alone. Email is the lookup and invitation identity.
7. Stripe is preserved. Stripe routes, webhook code, billing ledger, and subscription admin remnants are not removed in this track.
8. No payment grace period or automatic payment recovery is added in this track.
9. Missed WhatsApp or external-channel history is not backfilled. If access is revoked or the user joins later, the system does not fetch historical WhatsApp messages. Dietitians can manually enter clinically relevant updates through existing critical-context/form/context workflows.
10. Public CTAs are corporate and simple: contact and login. Public visible "Davet koduyla basla" entry points are removed, while backend purchase/invite/Stripe-compatible routes remain.

## Phase 0 - Plan Lock and Baseline Documentation

### Purpose

Create the canonical multi-phase action plan and baseline evidence for this track without changing runtime behavior.

### Scope

- Add this action plan.
- Add Phase 0 baseline evidence.
- Reconcile top-level next-phase and handoff documents so future work starts from this plan.
- Add or update risk-register notes only for actual newly recognized planning risk.

### Out Of Scope

- Application code changes.
- Supabase migrations.
- Package/dependency changes.
- Tests that require app runtime changes.
- External systems, deploys, production gates, remote migrations, SMTP, DNS, Stripe, WhatsApp, or Z.ai.

### Affected Files

- `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_ACTION_PLAN.md`
- `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_0_BASELINE_EVIDENCE.md`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `docs/RISK_REGISTER.md`

### Steps

P0.1 Verify Git baseline:
Run the required branch, status, HEAD, log, remote, branch tracking, whitespace, and remote-head commands from the repo root. Stop if branch, HEAD, upstream, remote branch HEAD, or working tree cleanliness does not match the expected baseline.

P0.2 Confirm plan target files:
Verify that the action plan and Phase 0 evidence files do not already exist. If either exists, read it and update it instead of creating a competing plan.

P0.3 Record architecture baseline:
Use `rg --files` and targeted `rg` searches to identify public, login, admin, onboarding, purchase, dashboard, PWA, session, entitlement, simulator, quarantine, and brand files. Record only code-connected facts.

P0.4 Create canonical plan:
Write this file with phases 0-7, strict step gates, locked product decisions, out-of-scope boundaries, expected files, data flow, risks, tests, rollback, and closure criteria.

P0.5 Create Phase 0 evidence:
Write the exact command results and inspected areas into the Phase 0 evidence file. Do not include secrets, raw health data, raw prompts, SMTP credentials, API keys, real inbox contents, or real client data.

P0.6 Reconcile handoff:
Add a current-status entry to `HANDOFF_FOR_NEXT_CODEX.md` pointing to this plan/evidence and marking the next eligible unit as Phase 1 only after explicit user approval.

P0.7 Reconcile next-phase guidance:
Add a current-status entry to `docs/NEXT_PHASE_EXECUTION_PLAN.md` stating that this plan supersedes generic public/auth/onboarding polish planning for the next local implementation track.

P0.8 Reconcile risk register:
Record the planning risk that dashboard/internal readiness surfaces may be mistaken for production-ready customer UX, and that session/login/onboarding/admin lifecycle changes require local validation before any production gate change.

P0.9 Verify documentation-only closure:
Run `git diff --check`, a sensitive-term scan scoped to the new/changed docs, and `git status --short --branch`.

### Tests and Verification

- `git diff --check` must pass.
- `git status --short --branch` must show only the planned documentation files as modified/added.
- Secret scan over changed docs must show no secret-like values.
- No app tests are required because Phase 0 has no runtime changes.

### Completion Criteria

- This action plan exists and is the canonical next implementation contract.
- Phase 0 evidence exists with real command results.
- Handoff, next-phase, and risk register point to this plan without changing production `NO-GO`.
- No code, schema, dependency, external-system, deploy, or production gate behavior changed.

## Phase 1 - Dashboard Production Surface Cleanup

### Purpose

Remove internal/demo/simulator/operational-readiness UI from the visible dietitian dashboard while preserving real dietitian workflows.

### Scope

- Hide/remove dashboard visible simulator entry points.
- Hide/remove quarantine inspection, trust binding inspection, operational foundation, delivery failure/gate/duplicate/opt-out/rollback counters, local safe-mode copy, demo reset, duplicate top language selector, operational header, and top client picker.
- Preserve settings language selector.
- Preserve Clients, Messages, Forms, Nutrition Plan, AI Chat, Alerts/Notifications, Settings, logout, tenant/account guards, dirty-state protection, and authenticated shell behavior.
- Update affected visual/accessibility tests to assert production surface expectations.

### Out Of Scope

- Backend deletion of simulator APIs or quarantine tables.
- WhatsApp/Z.ai/Stripe/provider changes.
- Critical Context redesign.
- Admin lifecycle changes.

### Affected Components and Files

- `app/src/components/dashboard-app.tsx`
- `app/src/components/dashboard/dashboard-shell.tsx`
- `app/src/components/dashboard/dashboard-navigation.tsx`
- `app/src/components/dashboard/overview-panel.tsx`
- `app/src/components/dashboard/operational-foundation-panel.tsx`
- `app/src/components/dashboard/operational-visibility.tsx`
- `app/src/components/dashboard/simulator-panel.tsx`
- `app/src/components/dashboard/active-client-control.tsx`
- `app/src/lib/phase-85-stage-5-shell-navigation.ts`
- `app/src/lib/i18n.ts`
- `app/src/lib/use-aiya-state.ts`
- `app/tests/visual/dashboard.visual.spec.ts`
- `app/tests/visual/messaging.visual.spec.ts`
- `app/tests/visual/stage-7/stage-7-catalog.ts`
- `app/tests/visual/stage-7/stage-7-assertions.ts`

### Data Flow

No database flow changes. Existing dashboard reads still load the current tenant-scoped state. Removed UI controls must not call simulator mutations from normal dashboard navigation. Internal tests may still call simulator APIs directly.

### Steps

P1.1 Inventory every visible internal surface:
Search visible UI and tests for `Simülatör`, `Simulator`, `Karantina`, `Güven bağlantı denetimi`, `Yerel güvenli mod`, `Demoyu sıfırla`, `Operasyon paneli`, `Teslimat hataları`, `kapı engelleri`, `yinelenen`, `vazgeçme`, and `geri alma`.

P1.2 Remove navigation exposure:
Delete simulator navigation entries from shell navigation configuration and any dashboard menu/tab rendering path. Preserve route files and API files.

P1.3 Remove dashboard chrome exposure:
Remove the operational header and top client picker from the main dashboard chrome. Ensure current client context remains reachable from the Clients section and route query state.

P1.4 Remove demo/safe-mode controls:
Remove the visible demo reset button and local safe-mode banner/copy from authenticated production-style dashboard surfaces. Keep local demo fixture guards in backend code.

P1.5 Remove operational counters:
Remove visible operational foundation and delivery/trust/quarantine metric panels from dashboard overview or more panels. Do not remove stored data, RPCs, RLS, or admin-only operational APIs.

P1.6 Update state wiring:
Remove imports, props, handlers, and i18n keys made unused by P1.2-P1.5. Do not delete backend simulator functions or compatibility tests unless they fail solely because their public entry point was removed.

P1.7 Update tests:
Change visual and navigation tests to assert absence of the removed surfaces and presence of production user workflows. Replace simulator-driven visual setup with direct seeded state fixtures or existing route fixtures.

P1.8 Inspect UI behavior:
Run desktop and mobile Playwright visual checks for dashboard home, clients, messages, forms, alerts/notifications, settings, and offline blocker. Inspect screenshots for overlap and removed copy.

### Tests

- Targeted unit tests for shell navigation/i18n if present.
- `npm test -- phase-85-stage-5-shell-navigation phase-85-stage-6-dashboard-contracts`
- Relevant Playwright visual/accessibility tests for dashboard, messaging, settings, stage-7 dashboard/PWA.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Completion Criteria

- Removed surfaces are absent from visible dashboard routes.
- Core dashboard workflows remain reachable.
- No tenant/auth/provider/billing behavior changed.
- All required checks pass or any blocker is recorded without closing the phase.

### Phase 1 Closure (2026-09-03)

Status: `PHASE_1_CLOSED_LOCAL_ONLY`. User-authoritative execution used PLAN (7) `P1.1`–`P1.9`; every step is `IMPLEMENTED_AND_INSPECTED`. Visible dietitian dashboard simulator, operational-header, demo-reset, top language selector, top client picker, local-safe-mode copy, and operational-foundation counters are gone from the render tree. Backend simulator/quarantine/trust APIs remain. Unused panel files remained on disk until Phase 7, which later deleted them after import-graph proof. Next eligible unit at this checkpoint was Phase 2 only after explicit user approval. Production remains `NO-GO`.

## Phase 2 - Two-Hour Secure Session Continuity

### Purpose

Prevent unwanted logout while a web/PWA session remains reasonably active, while enforcing a clear two-hour inactivity re-authentication boundary.

### Scope

- Change local session inactivity policy to two hours.
- Apply same behavior to web and installed PWA shell.
- Preserve fail-closed offline and entitlement behavior.
- Avoid background fake keepalive while the page is hidden.

### Out Of Scope

- Supabase Auth token lifetime changes in external dashboard.
- Production Supabase remote migration.
- Remember-me devices, refresh-token customization, MFA, or password policy expansion.

### Affected Components and Files

- `app/src/app/api/session/activity/route.ts`
- `app/src/lib/phase-85-stage-5-shell-session.ts`
- `app/src/lib/phase-85-stage-5-shell-session.test.ts`
- `app/src/lib/phase-85-stage-5-shell-migration-contract.test.ts`
- `app/src/lib/supabase-rls.integration.test.ts`
- `app/src/components/dashboard/authenticated-shell-boundary.tsx`
- `app/src/components/dashboard/shell-provider.tsx`
- `app/supabase/migrations/20260903090000_public_surface_session_idle_timeout.sql`

### Data Flow

Authenticated shell calls the session activity API. The API resolves authenticated user, tenant membership, and entitlement, then calls the service-role mediated session RPC. The RPC stores/touches `app_session_activity` per tenant/user/session and returns locked/unlocked status. Direct authenticated table access remains denied.

### Steps

P2.1 Read local Next.js docs:
Before editing route/cookie behavior, read the relevant local Next.js docs under `app/node_modules/next/dist/docs/` for route handlers/cookies used by the session activity API.

P2.2 Locate current constants:
Identify current inactivity threshold and touch cooldown in session contract/migration/tests. Record current value in phase evidence.

P2.3 Add append-only migration:
Create `20260903090000_public_surface_session_idle_timeout.sql` that replaces or wraps only the session activity RPC policy needed to enforce a two-hour inactivity window. Preserve RLS posture, direct grant revocations, and service-role mediated access.

P2.4 Update TypeScript contract:
Update session duration constants and any derived labels/messages to two hours. Keep response shape backward compatible unless tests prove a typed contract must change.

P2.5 Update shell behavior:
Ensure visible/active tab activity touches session at bounded intervals. Hidden tabs must not run aggressive background keepalive. Returning before two hours resumes; returning after two hours displays re-login/session lock state.

P2.6 Update tests:
Update unit and RLS tests to assert less-than-two-hour resume and two-hour-or-more lock. Include PWA fixture behavior where current tests support it.

P2.7 Inspect failure modes:
Verify offline lock still unmounts protected content and expired entitlement still blocks independently from session timeout.

### Tests

- `npm test -- phase-85-stage-5-shell-session`
- `npm test -- phase-85-stage-5-shell-provider-state phase-85-stage-5-shell-api`
- `npm run test:rls` when local Supabase is available
- Relevant PWA/offline Playwright checks
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Completion Criteria

- Web and PWA return within two hours without unwanted logout.
- Inactivity at or beyond two hours requires re-authentication.
- Direct user access to session tables remains denied.
- No external Supabase Auth setting was changed.

### Phase 2 Closure (2026-09-03)

Status: `PHASE_2_CLOSED_LOCAL_ONLY`. User-authoritative execution used PLAN (7) `P2.1`–`P2.9`; every step is `IMPLEMENTED_AND_INSPECTED`. Authenticated web/PWA idle timeout is two hours, server-authoritative, with a one-minute write cooldown. Hidden tabs do not keepalive. Foreground return verifies the server before any activity touch. Idle expiry clears shell state and redirects to `/login?next=/dashboard`. The append-only local migration is not applied to production. Next eligible unit is Phase 3 only after explicit user approval. Production remains `NO-GO`.

## Phase 3 - Password-First Login and Invite Setup Onboarding

### Purpose

Make daily login more user-friendly by supporting email+password while preserving invite-only onboarding and magic-link fallback.

### Scope

- Login page defaults to email/password.
- Magic link remains visible as fallback/recovery.
- Admin-created setup email sends user to onboarding with fixed invited email.
- Onboarding lets first-time invited user set password and claim tenant/account.
- Existing Stripe session claim path remains supported.
- Fix `/install` redirect drift to `/app-install` if present.

### Out Of Scope

- MFA.
- Self-serve open registration.
- Password policy beyond Supabase/default local validation unless already present.
- Removing magic links.
- Removing Stripe purchase routes.

### Affected Components and Files

- `app/src/app/login/page.tsx`
- `app/src/components/customer-login-form.tsx`
- `app/src/components/admin-login-form.tsx`
- `app/src/app/onboarding/page.tsx`
- `app/src/components/onboarding-claim-panel.tsx`
- `app/src/app/auth/callback/route.ts`
- `app/src/app/api/auth/password-login/route.ts`
- `app/src/app/api/auth/magic-link/route.ts`
- `app/src/app/api/auth/session-from-fragment/route.ts`
- `app/src/app/api/commercial/onboarding/status/route.ts`
- `app/src/app/api/commercial/onboarding/claim/route.ts`
- `app/src/lib/commercial-onboarding-store.ts`
- `app/src/lib/commercial-email.ts`
- `app/tests/commercial-auth-browser-boundary.test.ts`
- `app/tests/visual/commercial-saas.visual.spec.ts`

### Data Flow

Admin invite creates/uses commercial invite and setup link. User opens onboarding, authenticates or sets password through Supabase-supported auth flow, then the claim route binds the authenticated user to the tenant/account/entitlement. Returning users authenticate through password login and entitlement is checked before shell access.

### Steps

P3.1 Read auth route contracts:
Read existing password-login, magic-link, auth callback, onboarding status, and onboarding claim code before editing.

P3.2 Define UI state machine:
Customer login states are `password_login`, `magic_link_fallback`, `loading`, `error`, `success`. Onboarding states are `loading_invite`, `needs_password_setup`, `claiming`, `already_claimed`, `blocked`, `success`.

P3.3 Update login UI:
Make email/password the primary form. Keep magic-link fallback as a secondary control. Error messages must not reveal whether an email is registered beyond existing Supabase behavior.

P3.4 Update onboarding UI:
Render invited email as fixed/read-only when invite status returns it. Collect password and confirmation. Submit through existing or newly minimal API path required by Supabase auth. Reject mismatched passwords client-side before API call.

P3.5 Preserve claim compatibility:
Keep `{ inviteId }` and `{ sessionId }` claim paths. Ambiguous references continue to reject.

P3.6 Fix install redirect:
Replace active `/install` redirects or links with `/app-install`, preserving existing route behavior if `/install` is historical only.

P3.7 Update email copy:
Setup email copy uses AIya brand, aiyaworkspace domain, and explains password setup. Do not include secrets or raw tokens in evidence.

P3.8 Update tests:
Cover password login, fallback magic link, invite setup, duplicate claim, already claimed, and blocked/revoked entitlement states.

### Tests

- `npm test -- commercial-onboarding-store phase-84e-customer-onboarding`
- `npm test -- auth callback password-login session-from-fragment`
- `npm test -- commercial-auth-browser-boundary`
- Visual tests for login/onboarding/app-install
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Completion Criteria

- Daily login works through password form.
- Invite onboarding creates/claims access using fixed invited email.
- Magic link remains fallback.
- No self-serve registration is opened.

### Phase 3 Closure (2026-09-04)

Status: `PHASE_3_CLOSED_LOCAL_ONLY`. User-authoritative execution used PLAN (7) `P3.1`–`P3.10`; every step is `IMPLEMENTED_AND_INSPECTED`. Daily customer login is password-first with magic link as an explicit secondary/recovery option. Invite onboarding reads `session_id` or `invite_id`, shows invited email read-only from the status API, sets the password on the authenticated Supabase user, then calls the existing idempotent claim endpoint. Post-auth redirects allow `/app-install` and reject `/install`. Open signup was not added. Next eligible unit is Phase 4 only after explicit user approval. Production remains `NO-GO`.

## Phase 4 - Admin Customer Activation and Access Lifecycle

### Purpose

Give the owner/admin a simple customer list and manual access controls: invite, search, revoke, reactivate, and renew.

### Scope

- Admin console shows customers/users by tenant/account/entitlement with email lookup.
- Existing invite and revoke flows remain.
- Add reactivation/renewal for previously revoked or expired manual entitlements.
- Keep Stripe subscription artifacts visible only where useful; do not remove them.

### Out Of Scope

- Stripe integration changes.
- Payment automation.
- Grace period.
- Production billing operations SOP approval.
- Deleting customer data when access is revoked.

### Affected Components and Files

- `app/src/app/commercial-admin/page.tsx`
- `app/src/components/commercial-admin-console.tsx`
- `app/src/app/api/commercial/admin/invites/route.ts`
- `app/src/app/api/commercial/admin/manual-entitlements/route.ts`
- `app/src/app/api/commercial/admin/entitlements/revoke/route.ts`
- `app/src/app/api/commercial/admin/subscriptions/route.ts`
- `app/src/lib/commercial-admin-store.ts`
- `app/src/lib/phase-83f-commercial-admin.ts`
- `app/src/lib/phase-83f-commercial-admin.test.ts`
- `app/src/lib/phase-84f-admin-console.ts`
- `app/src/lib/phase-84f-admin-console.test.ts`
- `app/supabase/migrations/20260903100000_commercial_entitlement_reactivation.sql`

### Data Flow

Admin session is allowlist-checked. Admin APIs use service-role storage only after admin authorization. Entitlement operations write audit rows and update tenant entitlement atomically. End-user dashboard access still depends on tenant membership plus active entitlement.

### Steps

User-authoritative execution uses PLAN (7) `P4.1`–`P4.11`:

P4.1 Inventory admin list, invite, manual entitlement, revoke, and audit chain:
Read current admin console, admin APIs, and commercial-admin store to identify existing invite, revoke, subscriptions, ledger, and manual entitlement flows.

P4.2 Simplify the admin panel around the customer list and email search:
Expose only customer email, tenant name, access label, paid-through, revision, and one contextual primary action. Do not expose raw Stripe payloads, webhook bodies, or secrets.

P4.3 Block duplicate create when an auth user, open invite, or tenant already exists for that email:
Normalize email, search existing matches, and refuse a second invite/account/tenant row.

P4.4 Present new-customer invite as one command using existing secure backends in sequence:
Create the commercial invite, provision through the existing manual `activate` RPC when needed, then send the setup email. Email failure is not shown as success; retry must not insert a duplicate invite row.

P4.5 Add an append-only reactivation migration:
Create `20260903100000_commercial_entitlement_reactivation.sql` so `apply_manual_entitlement_operation` accepts atomic `reactivate` while preserving revision checks, request-hash idempotency, and service-role-only execute.

P4.6 Extend type, validator, request hash, RPC, and audit contracts for `reactivate`:
Widen `activate|renew` to include `reactivate` only for `revoked` entitlements with a future `paidThrough`.

P4.7 Wire “Erişimi kapat” to the existing revoke endpoint with explicit confirmation and expected revision:
Do not delete the auth user or health data. Stale revision returns `409`.

P4.8 Run “Erişimi yenile” on the existing tenant without creating a new account:
`reactivate` for revoked, `renew` for expired/past_due. Data is not copied.

P4.9 Keep password recovery separate from entitlement actions:
Optional “Şifre sıfırlama bağlantısı gönder” uses a distinct command and audit event, not the entitlement POST.

P4.10 Verify no diff on Stripe subscription and purchase routes:
Keep subscription GET/cancel and purchase/checkout paths unchanged.

P4.11 Complete cross-tenant and unauthorized-admin tests, then evidence:
Verify revoked users are blocked on dashboard/app-install, allowlist/same-origin mutations fail closed, and Stripe remnants remain.

### Tests

- `npx vitest run` for phase-83f, phase-84f, manual-entitlements, reactivation migration contract, request-hash, commercial-admin-access, phase-83b, phase-83g, phase-84h
- `npm run test:rls` when local Supabase is available; environment-blocked is not PASS
- Visual tests for admin/login commercial surfaces (`tests/visual/commercial-saas.visual.spec.ts --project=desktop`)
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Completion Criteria

- Admin can identify customer access by email.
- Admin can revoke and reactivate/renew access locally.
- Data is preserved while access is revoked.
- Stripe is untouched.

### Phase 4 Closure (2026-09-04)

Status: `PHASE_4_CLOSED_LOCAL_ONLY`. User-authoritative execution used PLAN (7) `P4.1`–`P4.11`; every step is `IMPLEMENTED_AND_INSPECTED`. Admin `/admin` session console lists customers by email, invites a new customer as one command, closes access with confirmation and expected revision, and renews/reactivates the same tenant. Stripe subscription/purchase routes have no Phase 4 diff. The local reactivation SQL file was not applied remotely. Next eligible unit is Phase 5 only after explicit user approval. Production remains `NO-GO`.

## Phase 5 - Public Website, CTA, Brand, Domain, and Metadata Polish

### Purpose

Make the public site corporate, AIya-branded, domain-correct, and aligned with the current invite/contact sales flow.

### Scope

- Public navbar/hero CTA uses contact and login paths.
- Remove visible public "Davet koduyla basla" CTA while preserving `/purchase` backend route.
- Update metadata/canonical/open graph/PWA metadata to AIya and aiyaworkspace domains.
- Remove visible sandbox/demo/no-go/internal copy from active public surfaces.
- Verify active visible surface has no retired brand/domain.

### Out Of Scope

- Landing-page redesign beyond necessary polish.
- Stripe route deletion.
- Domain DNS/TLS changes.
- Deploy.

### Affected Components and Files

- `app/src/components/public/PublicNavbar.tsx`
- `app/src/components/public/HeroSection.tsx`
- `app/src/components/public/SecuritySection.tsx`
- `app/src/components/aiya-marketing-page.tsx`
- `app/src/app/page.tsx`
- `app/src/app/purchase/page.tsx`
- `app/src/app/purchase/success/page.tsx`
- `app/src/app/app-install/page.tsx`
- `app/src/lib/brand.ts`
- `app/src/lib/phase-84b-public-website.ts`
- `app/public/manifest.webmanifest`
- `app/src/app/layout.tsx`
- `app/tests/visual/dashboard.visual.spec.ts`
- `app/tests/visual/commercial-saas.visual.spec.ts`

### Data Flow

No protected data flow changes. Public lead/contact path remains public and rate-limited if already implemented. Login routes remain auth-gated. Purchase route remains available for future Stripe.

### Steps

User-authoritative execution uses PLAN (7) `P5.1`–`P5.10`.

P5.1 Classify old brand, domain, and internal copy in active runtime.

P5.2 Allowlist technical compatibility names and separate them from visible mismatches.

P5.3 Simplify public navigation and CTAs around “Bize ulaşın” and “Giriş yap”.

P5.4 Remove public “Davet koduyla başla” links; keep the `/purchase` route.

P5.5 Align contact success/error copy with review and setup-link onboarding.

P5.6 Remove `NO-GO`, sandbox, simulator, and internal pilot terminology from public footer/content.

P5.7 Define route-specific metadata for login, admin login, purchase, onboarding, and app-install.

P5.8 Verify canonical, Open Graph URL, title, and description per route and domain.

P5.9 Replace visible `MANU Tenant ...` fallback with `AIya Workspace` or the real tenant name.

P5.10 Verify desktop/mobile CTA hierarchy, overflow, and readability.

### Tests

- Active-surface old brand/domain scan.
- CTA route tests.
- Contact success/error copy tests.
- Metadata and canonical tests.
- Login vs admin login.
- `/purchase` direct-access regression.
- Playwright desktop/mobile visual.
- Accessibility overflow/touch-target checks.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Completion Criteria

- Public site presents AIya as a corporate product.
- Public CTAs match the current sales-assisted flow.
- `/purchase` and Stripe infrastructure remain.
- Route metadata and canonical values are domain-correct.
- Internal production/sandbox copy is not user-visible on public/auth surfaces.
- No active visible retired brand/domain remains except approved compatibility names.

### Phase 5 Closure (2026-09-04)

Status: `PHASE_5_CLOSED_LOCAL_ONLY`. User-authoritative execution used PLAN (7) `P5.1`–`P5.10`; every step is `IMPLEMENTED_AND_INSPECTED`. Evidence: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_5_PUBLIC_SITE_CTA_BRAND_METADATA_EVIDENCE.md`. Public primary CTA is “Bize ulaşın”; existing-customer CTA is “Giriş yap”; public “Davet koduyla başla” links are removed; `/purchase` remains for direct URL/Stripe remnant use. Route metadata uses `https://aiyaworkspace.com` for customer routes and `https://admin.aiyaworkspace.com` for admin login. Visible tenant fallback is `AIya Workspace`. The append-only SQL file was not applied remotely. Next eligible unit is Phase 6 only after explicit user approval. Production remains `NO-GO`.

## Phase 6 - PWA Install, Manifest, Network-Only, and Responsive Polish

### Purpose

Ensure PWA install experience and runtime shell match AIya domain/brand and remain privacy-safe.

### Scope

- Verify manifest name, short name, description, start URL, icons, theme color, and display.
- Verify service worker remains network-only for protected health-data routes.
- Improve install page copy and blocked states if needed.
- Run mobile/tablet/desktop visual and accessibility checks.

### Out Of Scope

- Offline mutation support.
- Offline health-data cache.
- iPhone physical validation unless owner reverses waiver.
- Production deploy.

### Affected Components and Files

- `app/public/manifest.webmanifest`
- `app/public/sw.js`
- `app/src/app/app-install/page.tsx`
- `app/src/components/app-install-center.tsx`
- `app/src/components/pwa-runtime.tsx`
- `app/src/components/pwa-subscriber-shell.tsx`
- `app/src/lib/phase-83d-pwa-install-gate.ts`
- `app/src/lib/phase-83g-pwa-session.ts`
- `app/src/lib/phase-85-stage-5-shell-pwa.ts`
- `app/tests/visual/stage-7/stage-7-catalog.ts`
- `app/tests/visual/stage-7/stage-7-phase-7-3.spec.ts`
- `app/tests/visual/stage-7/stage-7-phase-7-4.spec.ts`

### Data Flow

PWA shell can bootstrap only through authenticated online APIs. Service worker may serve shell/static assets according to existing compatibility cache contracts but must not cache protected health-data API responses or permit offline edits.

### Steps

User-authoritative execution uses PLAN (7) `P6.1`–`P6.10`.

P6.1 Re-extract manifest, service worker, and install-route wiring.

P6.2 Verify auth redirects use only `/app-install`.

P6.3 Verify manifest AIya name, start URL, scope, display, and icons.

P6.4 Lock service-worker network-only policy for API, auth, and navigation responses.

P6.5 Verify offline privacy-lock on foreground and reopen.

P6.6 Verify Phase 1 removed dashboard chrome is absent from the installed PWA surface.

P6.7 Verify the two-hour session policy in PWA background/foreground.

P6.8 Verify Phase 3 password login and invite onboarding on mobile.

P6.9 Inspect 360px mobile, tablet, and desktop overflow, overlap, and focus order.

P6.10 Produce Android Chrome, installed-Android-PWA, and TalkBack evidence for this version.

### Tests

- Manifest schema and icon tests.
- Service worker network-only tests.
- Offline privacy-lock.
- Cache content inspection.
- PWA install gate tests.
- Android Chrome (Chromium Pixel 5 emulation).
- Installed Android PWA (standalone display-mode).
- Android TalkBack remains `WAIVED_NOT_EXECUTED`.
- Playwright mobile/tablet/desktop visual.
- Accessibility overflow, 44px, and focus-order checks.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Completion Criteria

- PWA is installable under the AIya identity.
- Auth and dashboard stay network-only.
- Offline health data is not shown or edited.
- Web and PWA session behavior match.
- Local Android Chrome and installed-PWA checks PASS.
- iPhone result remains `WAIVED_NOT_EXECUTED` only.
- TalkBack remains `WAIVED_NOT_EXECUTED` and is not recorded as PASS.
- Every `P6.*` step and required test is completed.

### Phase 6 Closure (2026-09-04)

Status: `PHASE_6_CLOSED_LOCAL_ONLY`. User-authoritative execution used PLAN (7) `P6.1`–`P6.10`; every step is `IMPLEMENTED_AND_INSPECTED`. Evidence: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_6_PWA_INSTALL_RESPONSIVE_A11Y_EVIDENCE.md`. Next eligible unit is Phase 7 only after explicit user approval. Production remains `NO-GO`.

## Phase 7 - Integrated Local Closure and Evidence Reconciliation

### Purpose

Close the local public/auth/onboarding/admin/PWA polish track with integrated verification and honest production boundary language.

### Scope

- Run broad local verification for changed surfaces.
- Run stale-brand/domain scan.
- Run secret/sensitive-data scan over changed files/evidence.
- Reconcile handoff, risk register, README/PLAN/app README only if actual authority or user-facing product state changed.
- Record final local evidence and next eligible production-owner gates.

### Out Of Scope

- Production GO.
- Deploy.
- Push/PR/merge.
- Remote migration.
- Live traffic.

### Affected Files

- `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_7_FINAL_EVIDENCE.md`
- Unused frontend files proven unreachable after Phases 1–6
- `HANDOFF_FOR_NEXT_CODEX.md`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`
- `docs/RISK_REGISTER.md`
- `README.md`
- `PLAN.md`
- `PROJECT_PLAN.md`
- `app/README.md`
- `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`
- `docs/AIYA_BRAND_TRANSITION_EVIDENCE.md` only if active brand evidence changed
- `docs/PRODUCTION_READINESS_STAGE_1_OWNER_HANDOFF.md` only if owner handoff status changed

### Steps

User-authoritative execution uses PLAN (7) `P7.1`–`P7.12`.

P7.1 Produce the unused frontend import graph and route accessibility report.

P7.2 Remove only proven-unused UI files. Keep backend simulator, operational-foundation, Stripe, and compatibility names.

P7.3 Reconcile old snapshots/fixtures with the active surface. Keep absence assertions for removed chrome.

P7.4 Scan active runtime for retired brand/domain and demo text. Separate compatibility and historical hits.

P7.5 Scan cross-tenant, cross-account, service-role, and RLS boundaries. Record environment-blocked RLS honestly.

P7.6 Verify the unified public → contact → admin invite → onboarding → password login → dashboard → revoke → reactivate contracts.

P7.7 Verify PWA install, two-hour background session, offline privacy-lock, and logout.

P7.8 Run the full unit/integration/visual/accessibility/build/release matrix required by PLAN (7).

P7.9 Bind every PLAN (7) requirement to real diff and test evidence.

P7.10 Reconcile README, roadmap, risk, handoff, and AIya documents with the real final local state.

P7.11 Record that the live release is unchanged and production gates stay closed.

P7.12 Complete the pre-commit diff, secret, stale-doc, and worktree review.

### Tests

- Targeted unit and integration tests for auth, admin lifecycle, PWA, and leftover-file contracts.
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Playwright visual tests for public/auth/PWA/dashboard surfaces.
- Playwright accessibility tests for overflow, 44px, skip-link, and offline lock.
- PWA/service-worker tests.
- `npm run release:verify`
- `npm run test:rls` (record skip/environment-blocked honestly)
- `git diff --check`
- Secret/sensitive-data scan
- Cross-tenant/cross-account scan
- Stale document and handoff contradiction scan
- `git status --short --branch`

### Completion Criteria

- Every `P0.*`–`P7.*` step is applied and inspected.
- Every requirement is bound to a real code or document diff.
- Required tests PASS; skipped/environment-blocked checks are disclosed.
- Stripe, WhatsApp, Z.ai, and production gates are unchanged.
- Live release remains separate and unchanged.
- Production remains `NO-GO`.

### Phase 7 Closure (2026-09-04)

Status: `PHASE_7_CLOSED_LOCAL_ONLY` historically. Superseded for current closure by Faz 8. Evidence: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_7_FINAL_EVIDENCE.md`. Production remains `NO-GO`.

## Phase 8 - Bütünleşik Reclosure ve Bulguların Kapatılması

Status: `FAZ_8_RECLOSURE_IN_PROGRESS`. Closes only when local Supabase RLS is zero-skip, physical Android Chrome/A2HS/TalkBack evidence is bound to this revision, and the full verification matrix is real PASS. Otherwise the phase stays `BLOCKED`.

### Steps

F8.1 Canonical plan + requirement matrix (`SESSION-*` … `GOVERNANCE-*`).
F8.2 Service-role-only session writes; persistent lock; authenticated RPC denial.
F8.3 Auth-user pagination, bulk customer projection, submit-only search, atomic invite.
F8.4 Onboarding `claim_pending` recovery after reload.
F8.5 Dashboard leftover cleanup + real import graph.
F8.6 Fail-closed dependency audit; lockfile patches in-scope; release identity is HEAD.
F8.7 New physical Android Chrome, installed PWA, and TalkBack captures. iPhone remains `WAIVED_NOT_EXECUTED`.
F8.8 Implementation commit, clean-tree RLS/device/matrix, evidence commit, final clean-HEAD `release:verify`.

### Completion Criteria

- Requirement matrix is unique and covers P0.1–P7.12 plus F8.1–F8.8.
- Direct authenticated session touch is denied; timeout lock/audit persist.
- Auth user 201+ is found; customer list is not N+1; search does not reload six endpoints; concurrent invite does not create duplicate tenants.
- Claim failure reload is durable and idempotent.
- Import graph PASS; simulator leftover disabled.
- Local Supabase reset + RLS zero skip PASS.
- New revision physical Android triple PASS.
- Final clean HEAD release verification PASS; live release unchanged; no deploy/push; production `NO-GO`.
