# Phase 83: Commercial PWA + Unified Web/Mobile Frontend Relaunch

Date: 2026-07-01
Status: Phase 83A-83H plus final remediation complete locally on 2026-07-01; Phase 83F hosted Supabase recovery diagnostics added on 2026-07-02. Phase 83 track closed; production pilot remains `NO-GO`.
Production pilot: NO-GO (unchanged by Phase 83).
Clinical production GO: not in scope for Phase 83.

## Goal

Add an invite-only commercial access layer, Stripe subscription entitlement flow, gated PWA mobile installation, and a full web/mobile frontend rebuild on one shared Next.js surface.

Phase 83 is a commercial productization and frontend relaunch track. It is not a production clinical GO phase. Real WhatsApp, Telegram, Gemini/external LLM, monitoring, secret manager, backup provider, and real client health-data production paths remain disconnected until external launch gates, R-405, and current RLS evidence close through the Phase 80-82 readiness track.

## Scope Lock (Immutable)

These rules are fixed for Phase 83 and must not be weakened in later sub-phases:

- **Mobile app means installable PWA only in v1.** No App Store, Play Store, IPA, APK, or Enterprise distribution for customer self-install in this phase.
- **Commercial gate is invite + Stripe subscription.** Only approved dietitians on the invite allowlist may start checkout. Only active subscribers may access the dashboard and mobile install center.
- **Public intro is allowed; purchase, dashboard, and install are gated.** The landing page may be public and must expose no tenant or client data.
- **Web and mobile share one app surface.** One Next.js codebase with responsive shell, mobile bottom navigation, and desktop sidebar. No separate native app repo in v1.
- **Full dashboard parity is required on mobile.** All core dietitian workflows must remain available on small screens unless explicitly marked unavailable in tests. Mobile may use stacked flows, bottom sheets, and sticky action bars instead of compressed desktop cards.
- **Stripe starts sandbox/test mode only.** Live Stripe keys, real charging, tax/legal copy approval, and production billing activation are separate external approval steps.
- **Service worker caches shell/static assets only.** Never cache client health data, messages, forms, exports, AI decisions, tenant API payloads, or any PHI-bearing API response.
- **Phase 83 cannot override Phase 80-82 readiness outcomes.** Production pilot remains `NO-GO` until external launch gates close, R-405 resolves or is formally accepted, and current RLS evidence passes.
- **Phase 83 must never set `productionPilotStarted=true`.** No real provider/channel activation, no production webhook activation for clinical paths, and no repo-local clinical production GO.
- **Client-facing AI covenant and clinical warning language remain unchanged** unless separately approved through the clinical taxonomy launch gate.
- **Existing tenant-scoped dashboard APIs remain tenant-scoped and received additive entitlement enforcement in Phase 83G.** Phase 83E gates the dashboard page and install center; Phase 83G adds protected dashboard API entitlement hardening without weakening RLS or cross-tenant isolation.

## Success Criteria

Phase 83 succeeds when all of the following are true after sub-phases 83B-83H complete:

1. Only approved dietitians on the invite allowlist can start Stripe Checkout.
2. Only users with `active` entitlement (Supabase auth + tenant membership + dietitian profile + active subscription) can access the dashboard and `/app-install`.
3. `past_due`, `canceled`, and `revoked` entitlements block dashboard APIs after Phase 83G and block mobile install access after Phase 83D.
4. Web and mobile use one shared authenticated app surface with full dashboard workflow parity.
5. PWA install is available only to active subscribers and records install audit events.
6. Service worker and cache strategy pass no-PHI-cache tests.
7. Phase 80/81/82 production-pilot narrative remains `NO-GO` unless external prerequisites close independently of Phase 83 commercial work.

## Platform Constraints And Sources

| Constraint | Decision | Source |
| --- | --- | --- |
| iOS customer mobile app | Add website to Home Screen as web app; not Enterprise Program for customer distribution | [Apple Home Screen web app](https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios), [Apple Enterprise Program](https://developer.apple.com/programs/enterprise/) |
| Android customer mobile app | PWA install preferred over APK sideload in v1 | [Android alternative distribution](https://developer.android.com/distribute/marketing-tools/alternative-distribution) |
| PWA install UX | Use `beforeinstallprompt` on Chromium; Safari manual Add to Home Screen instructions on iOS | [PWA install guidance](https://web.dev/learn/pwa/installation-prompt) |
| Subscription billing | Hosted Stripe Checkout for subscriptions; webhook-driven entitlement | [Stripe Checkout](https://docs.stripe.com/payments/checkout), [Stripe subscriptions](https://docs.stripe.com/billing/subscriptions/overview) |
| PWA start URL | Manifest scoped to SaaS app; `start_url` at `/dashboard` | project convention + Phase 83D |
| Visible install copy | May say "Mobil uygulamayı indir" while technically installing the secure PWA | product copy decision |

## Phase 83 Entry Baseline

Recorded at Phase 83A start on 2026-07-01 from the accepted Phase 82G closure:

| Item | Baseline value |
| --- | --- |
| Prior implementation phase | Phase 82G verification refresh complete on 2026-06-30 |
| Phase 82 final outcome | `NO_GO_EXTERNAL_PREREQUISITES_OPEN` |
| `productionPilotDecision` | `NO-GO` |
| `productionPilotGo` | `false` |
| `productionPilotStarted` | `false` |
| Launch gates | all eight open |
| R-405 | open; stable `next@latest` 16.2.9 still bundles nested `postcss@8.4.31` |
| R-406 | Phase 50/52 local baseline mitigated; current post-76N/77AA-77AI/79/80/81/82/83 re-run pending when local Supabase is unavailable |
| Existing PWA shell | `public/manifest.webmanifest`, `public/sw.js`, `src/components/pwa-runtime.tsx` exist but are not entitlement-gated |
| Existing dashboard | large monolithic dashboard page; responsive but not commercial-gated or mobile-parity relaunched |
| Stripe integration | none |
| Commercial invite model | none |
| Expected Phase 83 baseline during implementation | commercial sandbox track active; production pilot remains `NO-GO` |

## Sub-Phases

Phase 83 must not be implemented in a single undifferentiated change. Sub-phase order is fixed.

### Phase 83A — PRD / Tech Spec / Scope Lock

Goal: create this spec, lock immutable Phase 83 rules, record the Phase 83 entry baseline, and document sub-phases 83A-83H.

Exit criteria:

- This spec includes scope lock, entry baseline, platform constraints, success criteria, and sub-phase map 83A-83H.
- No runtime behavior changes.
- Continuity docs updated to record Phase 83A completion and next sub-phase 83B.
- `git diff --check` passes.

Status: complete on 2026-07-01.

### Phase 83B — Invite, Tenant, Subscription Entitlement Model

Goal: add server-side entitlement model and Supabase tables for commercial access.

Required behavior:

- Entitlement statuses: `invited`, `checkout_started`, `active`, `past_due`, `canceled`, `revoked`.
- Tables: invite allowlist, Stripe customer/subscription mapping, entitlement state, billing event ledger, mobile install audit events.
- Invite tokens stored hashed; invite bound to normalized email and optional tenant seed metadata.
- Dashboard access requires Supabase auth + tenant membership + dietitian profile + active entitlement.
- Admin/service-role paths may create/revoke invites; normal users cannot self-create membership or entitlement.
- RLS preserves tenant isolation and prevents cross-tenant entitlement reads/writes.

Exit criteria:

- Typed server models and migrations exist.
- Unit tests cover invite normalization and entitlement transitions.
- RLS tests cover new commercial tables.
- No Stripe live keys or production billing activation.

Status: complete on 2026-07-01. Added migration `20260701120000_phase_83b_commercial_entitlement_model.sql` and `app/src/lib/phase-83b-commercial-entitlement-model.ts` with invite normalization, hashed token matching, entitlement transition guards, dashboard/mobile access evaluation, and commercial table summary. Targeted Phase 83B unit tests passed (8/8). Extended `supabase-rls.integration.test.ts` with commercial table isolation coverage. No Stripe integration or production billing activation.

### Phase 83C — Stripe Checkout And Billing Gate

Goal: add sandbox-first Stripe hosted Checkout and webhook-driven entitlement provisioning.

Required behavior:

- Public purchase flow checks invite eligibility before creating a Checkout Session.
- Webhook endpoint verifies Stripe signature, records events idempotently, and provisions/revokes entitlement only from trusted events.
- Handle at minimum: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
- Add billing portal route for active subscribers.
- Live Stripe keys, real charging, tax/legal copy, and production billing activation remain blocked.

Exit criteria:

- Sandbox Checkout and webhook idempotency tests pass.
- Unapproved email cannot start checkout.
- No production billing activation.

Status: complete on 2026-07-01. Added `phase-83c-stripe-billing-gate.ts`, `commercial-billing-store.ts`, migration `20260701130000_phase_83c_commercial_checkout_session.sql`, Stripe SDK dependency, and API routes `/api/commercial/invite-status`, `/api/commercial/checkout`, `/api/commercial/webhook`, `/api/commercial/billing-portal`. Sandbox gate `MANU_ALLOW_STRIPE_SANDBOX=true` with `sk_test_` keys only; live keys blocked. Targeted Phase 83C unit tests passed (9/9). Production build passed. No production billing activation.

### Phase 83D — Gated PWA Mobile Install Center

Goal: add authenticated install center visible only to active subscribers.

Required behavior:

- Route: `/app-install` or dashboard install panel gated by active entitlement.
- Chromium: `beforeinstallprompt` when supported.
- iOS: Safari Add to Home Screen / Open as Web App instructions.
- Manifest `start_url` remains `/dashboard`.
- Service worker caches shell/static only; no PHI/API payload caching.
- Installed-mode detection, offline banner, stale-session handling, and install event audit.

Exit criteria:

- Install center hidden/blocked for non-subscribers.
- No-PHI-cache service worker tests pass.
- Install audit events recorded.

Status: complete on 2026-07-01. Added `phase-83d-pwa-install-gate.ts`, `commercial-install-access.ts`, gated `/app-install` page with `app-install-center.tsx`, `pwa-subscriber-shell.tsx` (subscriber-only SW registration, offline banner, stale-session polling), `commercial-install-blocked-state.tsx`, and `/api/commercial/mobile-install-audit`. Updated `public/sw.js` to cache shell/static only with network-only `/api/*` policy; removed global SW registration from `pwa-runtime.tsx`. Dashboard wraps active subscribers with `PwaSubscriberShell`. Targeted Phase 83D unit tests passed (8/8). Production build passed. No production clinical GO.

### Phase 83E — Unified Web + Mobile Frontend Relaunch

Goal: rebuild public and authenticated frontend on one mobile-first design system with full dashboard parity.

Sub-phases (fixed order):

| Sub-phase | Focus |
| --- | --- |
| 83E-1 | Design system: clinical SaaS palette, 8px card radius, dense operational layouts, reusable primitives |
| 83E-2 | Public intro + purchase UX: polished landing, gated `Satın al`, waitlist/contact for unapproved users |
| 83E-3 | Authenticated app shell: mobile bottom nav, desktop sidebar, subscription/install/sign-out header |
| 83E-4 | Full dashboard parity: recompose monolithic dashboard into domain panels without changing clinical behavior |
| 83E-5 | Mobile ergonomics: 44px touch targets, safe-area, keyboard-aware forms, one-handed primary actions |
| 83E-6 | States, accessibility, polish: skeletons, empty/error/offline states, focus/contrast/semantic structure |

Design system constraints (83E-1):

- Palette: white/near-white surfaces, charcoal text, sage/emerald primary, amber/red safety states, cool neutral borders.
- No decorative gradient/orb backgrounds.
- Lucide icons in controls; stable dimensions.

Exit criteria:

- Playwright visual smoke covers desktop, tablet, phone widths, purchase flow, gated dashboard, and parity workflows.
- No workflow loses capability versus current web unless explicitly marked unavailable in tests.

Status: in progress. 83E-1 design system complete on 2026-07-01. Added `app/src/app/globals.css` clinical SaaS tokens (white/near-white surfaces, charcoal ink, emerald primary, cool neutral borders, ≤8px radius, safe-area helpers) and reusable primitives under `app/src/components/ui/` (`tokens.ts`, `cn.ts`, `button`, `badge`/`OriginBadge`/`RiskBadge`, `card`, `field`, `tabs`, `segmented-control`, `dialog`, `sheet`, `data-table`, `timeline`, `app-shell` with sidebar/top bar/bottom nav, `index.ts` barrel). Clinical green/yellow/red reserved for message risk only via `MESSAGE_RISK`; generic UI uses emerald/amber/red/stone tones. Lucide icons; 44px min touch targets. Targeted design-system unit test passed (6/6); `npm run lint` clean (0 errors, 2 pre-existing warnings); production build passed. Primitives are not yet wired into pages (83E-2+). With one-time approval, the two pre-existing Phase 83D lint errors in `pwa-subscriber-shell.tsx` were fixed behavior-preservingly (guard state → refs; `<a>` → `next/link`); Phase 83D tests still pass (8/8).

83E-2 public intro + purchase UX complete on 2026-07-01. Rebuilt the public landing (`app/src/app/page.tsx`) as a polished MANU-AI intro (Turkish, no app data) with a clear `Satın al` CTA and a secondary demo entry. Added the gated purchase flow: `app/src/components/purchase-flow.tsx` (client) + `app/src/app/purchase/page.tsx` calling the existing Phase 83C `/api/commercial/invite-status` then `/api/commercial/checkout`; unapproved users get a waitlist/contact state, unconfigured environments get a fail-closed "not configured" state, and only an explicit eligible response unlocks Stripe checkout. Added `app/src/app/purchase/success/page.tsx` (onboarding + app install guidance linking `/dashboard` and `/app-install`) and `app/src/app/purchase/cancel/page.tsx`. New presentation logic `app/src/lib/phase-83e2-purchase-ux.ts` is fail-closed and unit tested (8/8). Middleware still gates only `/dashboard/*`; new commercial pages are public. Backend, entitlement, Stripe, and SW-cache behavior unchanged. Updated Playwright smoke to cover the new landing + purchase intro. `npm run lint` clean (0 errors, 2 pre-existing warnings); production build passed.

83E-3 authenticated app shell complete on 2026-07-01. Added fail-closed shell logic `app/src/lib/phase-83e3-app-shell.ts` (`deriveDashboardAccessGate` mapping membership/dietitian/entitlement → one of `ok`/`no_membership`/`no_dietitian_profile`/`no_invite`/`checkout_incomplete`/`inactive_subscription`/`revoked_access`, plus subscription/install status descriptors) with unit tests (4/4). Rebuilt `app/src/components/auth-states.tsx` on the 83E-1 design system with all six gated-state screens (each fail-closed, no app data, safe sign-out, and purchase/contact CTA where relevant) and a `DashboardGatedState` router. `app/src/app/dashboard/page.tsx` now resolves entitlement status server-side and renders the correct gated screen; only an active entitlement reaches the dashboard (Supabase-unconfigured fallback/demo path is unchanged so visual smoke still renders the console). The `DashboardApp` shell (`app/src/components/dashboard-app.tsx`) gained a mobile bottom navigation (`lg:hidden`, 44px+ targets, safe-area) with the desktop sidebar nav now desktop-only (`hidden lg:block`), and the header shows subscription status + install state pills and a safe sign-out when authenticated (commercial info passed from the server). No clinical behavior, risk classification, approval flow, provenance, or API/entitlement/Stripe/SW-cache behavior changed (dashboard domain-panel recompose remains 83E-4). `npm run lint` clean (0 errors, 2 pre-existing warnings); full unit suite (100 files) and production build passed.

83E-4 full dashboard parity complete on 2026-07-01. Recomposed the ~3,189-line monolithic `app/src/components/dashboard-app.tsx` into domain panel modules under `app/src/components/dashboard/` — `shared.tsx` (primitives, helpers, constants, `ViewKey`/`ClientDetailTab` types), `overview-panel.tsx`, `clients-panel.tsx` (client list + detail form/tabs, status summary, scoped copilot, export, critical-context), `conversation-panel.tsx`, `simulator-panel.tsx`, `voice-panel.tsx`, `forms-panel.tsx`, `copilot-panel.tsx`, and `handoffs-panel.tsx`. `dashboard-app.tsx` is now a ~830-line orchestrator that owns state/data wiring and the 83E-3 shell and delegates each view to its domain panel. Extraction was verbatim: every workflow (overview, clients, conversation, simulator, handoffs, forms, food rules, menu plans, critical context, copilot, voice, export, notifications), all `data-testid`s, provenance/origin labels, message risk colors, red-risk reactivation lock, approval flows, and fail-closed logic are unchanged. No API/type contract, entitlement, Stripe, RLS, or SW-cache behavior changed. `npm run lint` clean (0 errors, 2 pre-existing warnings); full unit suite (100 files, 638 passed / 4 skipped) and production build passed.

83E-5 mobile ergonomics complete on 2026-07-01. Extended `app/src/lib/phase-83e5-mobile-ergonomics.ts` with mobile chrome spacing constants (`MOBILE_CHROME_CLASS`, bottom-nav/sticky-bar height rem values) and keyboard-aware input helpers already wired through `dashboard/shared.tsx` (`MOBILE_FIELD_CLASS`, `resolveInputKeyboard`, 44px touch targets, 16px mobile inputs to prevent iOS zoom). Added `globals.css` utilities (`bottom-above-nav`, `pb-mobile-nav`, `pb-mobile-nav-actions`, `scroll-margin-bottom` for focused fields). Added `app/src/components/dashboard/mobile-ergonomics.tsx` with `MobileStickyActionBar` (one-handed primary actions fixed above the bottom nav on `<lg`) and `useMobileKeyboardScroll` (focus + `visualViewport` resize scroll-into-view on mobile). Wired sticky action bars into `conversation-panel` (Save manual reply), `simulator-panel` (Run inbound flow), and `copilot-panel` (Ask input + send); dashboard shell touch targets raised to 44px, safe-area padding on header/sidebar/content, view-aware main padding to avoid double chrome offset. No clinical behavior, risk classification, approval flow, provenance, or API/entitlement/Stripe/SW-cache behavior changed. `npm run lint` clean (0 errors, 2 pre-existing warnings); full unit suite (101 files, 643 passed / 4 skipped) and production build passed.

83E-6 states, accessibility, and polish complete on 2026-07-01 — **Phase 83E frontend relaunch is now complete locally.** Added `app/src/lib/phase-83e6-states-polish.ts` (focus ring, skeleton, banner live-region, main landmark constants; unit tested 2/2) and `app/src/components/dashboard/state-primitives.tsx` (`SkeletonBlock`, `DashboardLoadingSkeleton`, enhanced `EmptyState`, `ErrorState` for session recovery). `globals.css` gained keyboard `:focus-visible` outlines, skip-link, and `sr-only`. Dashboard shell: stable loading skeleton (no layout shift), Turkish session error recovery, skip link (`İçeriğe atla`), semantic `h1` page title, labelled nav regions, `#dashboard-main` landmark. Panels wired to consistent empty states (conversation, handoffs, copilot, overview, simulator, voice, clients search). PWA shell banners gained `role="status"`/`role="alert"`, safe-area padding, and test ids (83D audit behavior unchanged). Purchase flow and app-install center gained alert/status semantics and install loading guidance. No clinical/API/entitlement/Stripe/SW-cache behavior changed. `npm run lint` clean (0 errors, 2 pre-existing warnings); full unit suite (102 files, 645 passed / 4 skipped) and production build passed. Later Phase 83F/G/H and final remediation are complete locally.

83E remediation complete on 2026-07-01. Closed the visual acceptance gaps found after 83E-6: purchase heading duplication is removed via the distinct `Davetli erişim kontrolü` form heading, dashboard chrome and visual-smoke labels are standardized to Turkish (`Operasyon paneli`, `Danışanlar`, `Görüşme`, `Simülatör`, `Devirler`, `Formlar`), the mobile bottom navigation is horizontally scrollable so all eight views remain reachable on phone widths, and the visual smoke workflow order now reflects the real clinical state machine (safety-missing before red-risk lock). Verification passed: `npm run test:visual` 6/6, targeted Phase 83 tests 50/50, lint with two pre-existing warnings, full unit suite 645 passed / 4 skipped across 102 files, `npm run release:verify` with core 225/225 and app 645 passed / 4 skipped, and `git diff --check` with CRLF warnings only. `npm run test:rls` skipped 21/21 because local Supabase was unavailable, so R-406 current re-run remains pending. This historical 83E remediation did not implement Phase 83G API-wide entitlement enforcement; Phase 83G later completed protected-route/API entitlement hardening.

### Phase 83F — Commercial Admin And Operations

Goal: admin-only invite management and billing operations visibility.

Required behavior:

- Admin can create/revoke invites, view subscription status, inspect billing event ledger, and revoke the subscriber entitlement that gates both dashboard APIs and mobile/PWA install access.
- Audit events for invite creation, checkout start, entitlement activation/revocation, mobile install prompt, and billing webhook processing.
- No broad internal CRM beyond invite/subscription operations.

Exit criteria:

- Admin paths protected and audited.
- Tests cover invite create/revoke and ledger inspection.

Status: complete on 2026-07-01, with final remediation on 2026-07-01 and hosted Supabase recovery diagnostics on 2026-07-02. Added `phase-83f-commercial-admin.ts`, `commercial-admin-store.ts`, migration `20260701140000_phase_83f_commercial_admin_audit.sql`, protected routes `/api/commercial/admin/invites`, `/api/commercial/admin/subscriptions`, `/api/commercial/admin/ledger`, `/api/commercial/admin/entitlements/revoke`, and local ops console `/commercial-admin`. Admin gate requires `MANU_ALLOW_COMMERCIAL_ADMIN=true` and `MANU_COMMERCIAL_ADMIN_TOKEN` (min 32 chars). Admin paths are fail-closed, audited via `commercial_admin_audit_events`, and do not expose invite token hashes. Final remediation clarified the single subscriber entitlement model: `/api/commercial/admin/entitlements/revoke` accepts `{ tenantId }`, rejects `mobileInstallOnly: true` as `mobile_install_only_revoke_unsupported`, and records `entitlement_revoked` only. Revocation blocks both dashboard APIs and mobile/PWA install access through the same entitlement. The 2026-07-02 recovery pass added protected `/api/commercial/admin/health`, store-env/probe diagnostics, and UI guidance for unreachable Supabase project hosts, missing migrations, invalid service-role keys, and incomplete admin env. The diagnostics expose no secrets and do not provide a fallback admin store; commercial admin invite operations still require a reachable hosted or local Supabase project with all commercial migrations applied. No separate mobile-install entitlement model, production billing activation, hosted Supabase credential activation, or production GO changed. Production pilot remains `NO-GO`.

### Phase 83G — Security, Privacy, And Compliance Hardening

Goal: enforce entitlement on every protected route and harden commercial/PWA attack surface.

Required behavior:

- Server-side `requireActiveEntitlement` (or equivalent) on every app/API route that needs dashboard access.
- Installed PWA cannot bypass entitlement via direct URL, cached shell, stale session, or installed-mode launch.
- Rate limits or fail-closed guards for invite lookup and checkout creation.
- Update `docs/RISK_REGISTER.md` for commercial access, billing webhook, mobile installation, and PWA cache risks.

Exit criteria:

- Access gate tests pass for all blocked entitlement states.
- Risk register updated.

Status: complete on 2026-07-01. Added `phase-83g-entitlement-hardening.ts`, `phase-83g-pwa-session.ts`, `commercial-entitlement-access.ts`, and `commercial-public-rate-limit.ts`. Protected dashboard APIs now require active entitlement through `resolveAppTenantContext()` when Supabase store mode is active (not dev fallback). Public invite-status and checkout routes gained in-memory fail-closed rate limits. PWA subscriber shell treats inactive/revoked entitlement as stale session via `/api/auth-state` entitlementStatus. Demo seed upserts active `tenant_entitlements` for local Supabase runs. Service worker policy remains network-only for `/api/*`. Targeted Phase 83G unit tests passed 6/6; targeted Phase 83 suite passed 58/58. Production pilot remains `NO-GO`.

### Phase 83H — Verification And Release Evidence

Goal: close Phase 83 with targeted tests and continuity updates.

Required verification:

- Unit tests: invite normalization, entitlement transitions, Stripe webhook idempotency, access gates, PWA install state.
- RLS tests: invite/subscription/mobile audit tables.
- Playwright: desktop, tablet, iPhone-size, Android-size, installed display mode where feasible, purchase flow, gated dashboard, dashboard parity.
- Commands: targeted Phase 83 tests, `git diff --check`, `npm run lint`, `npm run build`, `npm run test:rls`, `npm run release:verify`, `npm run rehearse:production-scale:79g`.
- If `npm run test:rls` skips, keep R-406 current re-run pending and do not claim production readiness.

Exit criteria:

- Phase 83 track closed in continuity docs.
- Production pilot narrative remains `NO-GO` unless external prerequisites close independently.

Status: complete on 2026-07-01. Added `phase-83h-verification-refresh.ts` + tests, Playwright visual coverage extended to 16/16 (desktop, tablet, Pixel 5/Android, iPhone 13: landing/purchase, dashboard parity, purchase success/cancel, app-install fallback block), and RLS integration extended for `commercial_admin_audit_events` member read/write denial. Verification chain after final remediation: targeted Phase 83 tests 64/64; `git diff --check` passed; lint passed (2 pre-existing warnings); build passed; full app suite 665 passed / 4 skipped; `npm run test:visual` 16/16; `npm run release:verify` core 225/225 + app 665 passed / 4 skipped; `npm run rehearse:production-scale:79g` passed. `npm run test:rls` skipped 21/21 (local Supabase unavailable); R-406 current re-run remains pending. Phase 83 track closed in continuity docs. Production pilot remains `NO-GO`.

### Phase 83 Final Remediation — Continuity And Admin Revoke Semantics

Goal: remove stale current-state continuity claims and align admin revoke language with the single-entitlement commercial model.

Status: complete locally on 2026-07-01. Current-state docs now identify Phase 83H/final remediation as the latest Phase 83 state instead of saying 83F or 83G are pending. The admin console no longer exposes a mobile-install-only revoke action. The entitlement revoke API rejects `mobileInstallOnly: true` before mutation and performs only full subscriber entitlement revocation for `{ tenantId }`. `commercial_admin_audit_events` records `entitlement_revoked`; the misleading `mobile_install_entitlement_revoked` audit type was removed from code and the unmerged Phase 83F migration. Verification passed: targeted Phase 83 64/64, full app suite 665 passed / 4 skipped, visual 16/16, release verify core 225/225 + app 665 passed / 4 skipped. R-405 remains open, R-406 current post-83 local Supabase/RLS re-run remains pending when Supabase is unavailable, and production pilot remains `NO-GO`.

## Public Interfaces / Types (Planned)

Phase 83 may add the following pages, APIs, and types in sub-phases 83B-83H. None are required to exist at Phase 83A completion.

### Pages

- Public landing
- Invite/purchase check
- Stripe checkout success/cancel
- Onboarding
- App install (`/app-install`)
- Billing/account

### APIs

- Invite status
- Checkout session creation
- Billing portal session
- Stripe webhook
- Mobile install audit
- Admin invite operations

### Server types

- `CommercialInvite`
- `TenantEntitlement`
- `BillingCustomer`
- `BillingEventLedgerEntry`
- `MobileInstallAuditEvent`
- `requireActiveEntitlement` guard (or equivalent)

Existing dashboard data APIs remain tenant-scoped and must not expose data without entitlement.

## Edge Cases

| Scenario | Expected behavior |
| --- | --- |
| Unapproved email attempts checkout | Blocked; show waitlist/contact state |
| Approved invite starts checkout twice in same window | Only one active checkout session per policy |
| Stripe webhook replay | Idempotent; no duplicate tenants/memberships |
| Subscription moves to `past_due` | Dashboard and install blocked |
| Subscription `canceled` or invite `revoked` | Dashboard APIs and install blocked immediately after webhook processing |
| Installed PWA with stale cache after revocation | Protected data unavailable; stale-session handling prompts re-auth or blocks |
| iOS user opens install center | Manual Safari Add to Home Screen instructions |
| Chromium with `beforeinstallprompt` | Native install prompt when entitlement active |
| Direct URL to `/dashboard` without entitlement | Redirect or gated state screen |
| Service worker update while offline | Shell may load; protected API calls fail closed |
| Admin revokes invite after checkout started | Checkout completion policy defined in 83C; default fail-closed toward no access without active subscription |
| User has auth but no dietitian profile | Gated state; no dashboard data |
| User has membership but inactive entitlement | Gated state; no dashboard data |

## Non-Goals

- No production clinical GO or `productionPilotStarted=true`.
- No real WhatsApp, Telegram, Gemini, external LLM, monitoring, secret manager, backup provider, or real client health-data production connection.
- No App Store / Play Store / APK / IPA distribution in v1.
- No live Stripe production keys or real charging in Phase 83 sandbox track.
- No tax/legal billing copy approval inside repo-local Phase 83 work.
- No weakening of Phase 64 launch-gate evidence rules.
- No broad CRM, marketing automation, or non-invite lead capture beyond waitlist/contact state.

## Test Scenarios

- Unapproved email cannot start checkout.
- Approved invite can start Stripe Checkout only once per active checkout window.
- Webhook replay is idempotent and cannot duplicate tenants/memberships.
- Active subscription grants dashboard and mobile install access.
- `past_due`, `canceled`, and `revoked` block dashboard APIs and app install.
- Installed PWA with stale cache cannot read protected data after revocation.
- iOS install page shows manual Safari instructions; Chromium shows install prompt when available.
- Full mobile parity smoke test covers clients, conversation, handoffs, forms, food rules, menu, copilot, simulator, and export without horizontal overflow.
- Service worker does not cache API responses containing PHI/health data.
- Phase 80/81/82 readiness narrative remains `NO-GO` throughout Phase 83 unless external prerequisites close independently.

## Assumptions And Defaults

- Phase 82 repo-local closure track remains complete; Phase 83 is a parallel commercial/frontend track.
- Mobile app means installable PWA, not native IPA/APK in v1.
- Invite + Stripe sandbox is the commercial gate.
- Public intro page is allowed; checkout, dashboard, and install are allowlist/subscription gated.
- Mobile must have full dashboard parity with web.
- `docs/MOBILE_APP_STRATEGY.md` PWA-first decision is reaffirmed and extended with commercial gating in Phase 83D.
- Commercial risk register entries are deferred to Phase 83G unless narrative-only notes are added at continuity update time.

## Post-Phase 83 Commercial Sandbox Deployment Note - 2026-07-02

After Phase 83 closure, the commercial sandbox was deployed to a Hetzner VPS at `https://siriusai.store` with Nginx, PM2, and Let's Encrypt HTTPS. Stripe remains test/sandbox only. The Stripe test webhook endpoint `https://siriusai.store/api/commercial/webhook` was configured and verified.

Observed outcome: test checkout consumed the commercial invite, provisioned a tenant, activated entitlement, and wrote billing ledger events. This validates Phase 83 commercial provisioning in sandbox infrastructure, but it also confirms a post-payment onboarding gap: no real customer Supabase Auth account, tenant membership, or dietitian profile is created automatically after checkout.

The next canonical implementation track is `docs/PHASE_84_COMMERCIAL_SAAS_RELAUNCH_AND_ONBOARDING_SPEC.md`. Phase 83 remains closed; Phase 84 owns public SiriusAI relaunch, customer login, onboarding claim, contact leads, and admin subdomain. Production pilot remains `NO-GO`; R-405 remains open; R-406 current re-run remains pending when local Supabase is unavailable.
