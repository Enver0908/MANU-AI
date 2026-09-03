# AIya Public Surface, Auth, Onboarding, Admin and PWA Action Plan

Status: `PHASE_2_CLOSED_LOCAL_ONLY`
Created: 2026-09-03
Authority: This plan governs the next local implementation track for AIya public surface, customer auth/onboarding, admin customer lifecycle, dashboard production cleanup, and PWA polish. It does not approve production launch.
Phase 2 evidence: `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_2_TWO_HOUR_SESSION_EVIDENCE.md`
Next eligible unit: Phase 3 only after explicit user approval. Production remains `NO-GO`.

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

Status: `PHASE_1_CLOSED_LOCAL_ONLY`. User-authoritative execution used PLAN (7) `P1.1`–`P1.9`; every step is `IMPLEMENTED_AND_INSPECTED`. Visible dietitian dashboard simulator, operational-header, demo-reset, top language selector, top client picker, local-safe-mode copy, and operational-foundation counters are gone from the render tree. Backend simulator/quarantine/trust APIs remain. Unused panel files remain on disk until Phase 7. Next eligible unit is Phase 2 only after explicit user approval. Production remains `NO-GO`.

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

P4.1 Inventory admin capabilities:
Read current admin console, admin APIs, and commercial-admin store to identify existing invite, revoke, subscriptions, ledger, and manual entitlement flows.

P4.2 Define list DTO:
Expose only customer email, tenant name, invite status, entitlement status, billing method, paid-through, created/updated dates, and safe action availability flags. Do not expose raw Stripe payloads, webhook bodies, or secrets.

P4.3 Add reactivation migration:
Create append-only SQL that permits a safe `reactivate` manual entitlement operation through `apply_manual_entitlement_operation`, preserving revision checks and audit trail.

P4.4 Extend server validation:
Extend action union from `activate|renew` to include `reactivate` only where current status is `revoked`, `expired`, or `past_due` and `paidThrough` is future when required.

P4.5 Update admin UI:
Add simple customer table/search and action controls. Revoke must require confirmation. Reactivate/renew must collect paid-through date when manual entitlement requires it.

P4.6 Preserve Stripe remnants:
Keep subscription routes/components; label them as Stripe-connected records only if already visible. Do not delete or disable Stripe paths.

P4.7 Test entitlement enforcement:
Verify revoked user gets blocked on dashboard/app-install, active/reactivated user gets access, and cross-tenant/admin authorization stays denied.

### Tests

- `npm test -- phase-83f-commercial-admin phase-84f-admin-console manual-entitlements`
- `npm test -- phase-83b-commercial-entitlement-model phase-83g-entitlement-hardening`
- `npm run test:rls` when local Supabase is available
- Visual tests for admin console
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Completion Criteria

- Admin can identify customer access by email.
- Admin can revoke and reactivate/renew access locally.
- Data is preserved while access is revoked.
- Stripe is untouched.

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

P5.1 Scan active public surfaces:
Search app source and public assets for retired visible brands/domains and invite-first CTA text.

P5.2 Update CTA hierarchy:
Use contact as primary public CTA and login as secondary CTA. Remove public direct invite-code start links from navbar and hero.

P5.3 Keep purchase route controlled:
Do not delete `/purchase`; update page copy so it does not invite unmanaged self-serve use unless the route is reached intentionally.

P5.4 Update metadata:
Align title, description, canonical, open graph, Apple metadata, and manifest-visible copy with AIya and aiyaworkspace.

P5.5 Remove internal launch language:
Remove visible sandbox/demo/no-go/internal readiness words from public surfaces. Keep evidence docs unchanged.

P5.6 Update visual tests:
Assert AIya, contact/login CTA, absence of retired visible brand/domain, and controlled purchase behavior.

### Tests

- Public/commercial visual tests.
- Brand scan over active runtime source and public manifest.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Completion Criteria

- Public site presents AIya as a corporate product.
- Public CTAs match current sales-assisted flow.
- No active visible retired brand/domain remains except approved compatibility names.

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

P6.1 Read service worker and PWA contracts:
Inspect manifest, service worker, PWA runtime, install gate, and PWA session files.

P6.2 Validate compatibility names:
Keep existing `siriusai-*` cache names and `manu-ai-shell-*` cleanup prefix if they are compatibility contracts.

P6.3 Update visible PWA text:
Ensure install page and browser metadata use AIya and do not imply offline health-data use.

P6.4 Verify protected route policy:
Confirm protected API responses are network-only/fail-closed and offline blocker unmounts protected content.

P6.5 Responsive inspection:
Run desktop, tablet, Android mobile, and PWA-mode visual tests for public, login, app-install, dashboard shell, clients, messages, alerts, settings, and offline lock.

### Tests

- `npm test -- phase-83d-pwa-install-gate phase-83g-pwa-session phase-85-stage-5-shell-pwa`
- Stage-7 PWA/offline visual/accessibility tests.
- Manifest scan.
- Service worker privacy scan.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Completion Criteria

- PWA visible brand/domain is AIya/aiyaworkspace.
- Offline protected content remains unavailable.
- Mobile/tablet/desktop layouts have no blocking overlap or unusable controls.

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

- `docs/PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_PHASE_7_CLOSURE_EVIDENCE.md`
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

P7.1 Confirm all prior phase evidence:
Each Phase 1-6 evidence file must exist and show every step completed exactly as written or the track cannot close.

P7.2 Run integrated checks:
Execute full targeted and broad checks required by changed areas.

P7.3 Run stale-surface scans:
Scan active app source/public assets for retired visible brand/domain and removed internal UI text. Separate allowed compatibility and historical hits from real active-surface findings.

P7.4 Run security scans:
Scan changed files for secrets, raw health data, raw prompts, API keys, SMTP credentials, and real user data.

P7.5 Reconcile docs:
Update only documents whose current authority, risk, product state, or next step changed.

P7.6 Record final local closure:
Evidence must state production remains `NO-GO` and list still-blocking owner gates.

### Tests

- `npm test` or approved broad targeted equivalent depending on changed scope.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- PWA/service-worker tests.
- Visual/accessibility tests for changed user surfaces.
- `npm run release:verify` if release packaging was affected.
- `git diff --check`
- `git status --short --branch`

### Completion Criteria

- Phase 1-6 implementation evidence is complete.
- Integrated verification passes without skipped/simulated closure.
- Documentation is reconciled.
- Production remains `NO-GO`.
- User is asked for commit approval only after local closure evidence is complete.
