# MANU-AI Phase 84 Commercial SaaS Relaunch And Customer Onboarding Spec

Date: 2026-07-02
Status: Phase 84A-84J complete on 2026-07-03 for the commercial sandbox path. VPS sandbox onboarding/dashboard is verified through generated token-hash fallback and real Resend/Supabase custom-SMTP magic-link email. Production pilot remains `NO-GO`.
Production pilot: `NO-GO` (unchanged by Phase 84).
Clinical production GO: not in scope for Phase 84.

## Goal

Turn the current demo/purchase prototype into a professional SiriusAI commercial SaaS flow with three separated surfaces:

1. **Public marketing site** on `https://siriusai.store` for prospects and brand.
2. **Customer product surface** with Supabase magic-link login, post-payment onboarding claim, and real `/dashboard` access.
3. **Admin operations surface** on `https://admin.siriusai.store` for leads, invites, subscriptions, billing ledger, health, and audit.

Phase 84 is commercial infrastructure and onboarding hardening. It is not production clinical GO, R-405 closure, launch-gate closure, or real provider/channel activation.

## Current Baseline

Phase 83 commercial PWA, entitlement hardening, admin diagnostics, and verification refresh are implemented in the working tree. Sandbox commercial infrastructure was exercised on a Hetzner VPS:

| Item | Value |
| --- | --- |
| Public domain | `siriusai.store` |
| Public app URL | `https://siriusai.store` |
| Admin target | `admin.siriusai.store` → `/admin` (VPS DNS/Nginx/SSL configured in Phase 84I live verification) |
| VPS public IP (admin DNS) | `167.233.207.102` |
| HTTPS | Let's Encrypt installed; dry-run renewal passed |
| Runtime | Next.js production build, PM2, Nginx |
| Stripe mode | test/sandbox only |
| Stripe webhook | `https://siriusai.store/api/commercial/webhook` |

### Verified Payment Webhook Evidence (Sanitized)

Observed on 2026-07-02 during VPS sandbox validation. No secrets, keys, or raw webhook payloads are stored in this repository.

| Step | Result |
| --- | --- |
| Commercial invite submitted at checkout | Invite consumed |
| Tenant provisioning | Tenant created (example label: `Olku Enver Test Kliniği`) |
| Entitlement | `active` entitlement created for provisioned tenant |
| Billing ledger | `checkout.session.completed` written |
| Billing ledger | `invoice.paid` written |

### Known Gap (Primary Phase 84 Target)

Payment provisioning works, but **post-payment customer account onboarding is incomplete**:

- No automatic Supabase Auth user creation after checkout.
- No automatic `tenant_memberships` row for the paying customer.
- No automatic `dietitians` profile for the paying customer.
- Paid customers cannot reliably reach the real product dashboard without the demo/fallback path.

This gap is tracked as **R-425** in `docs/RISK_REGISTER.md`.

Production pilot remains `NO-GO`. R-405 remains open. R-406 current post-83 local Supabase/RLS re-run remains pending when local Supabase is unavailable. No real WhatsApp, Telegram, Gemini/provider, monitoring, secret manager, backup provider, production webhook beyond Stripe test, live Stripe key, real charging, or real client health-data production path is activated by this phase.

## Locked Product Decisions

- Public brand: `SiriusAI`.
- Underlying product/repo identity may still reference MANU-AI where appropriate.
- Customer login: Supabase magic-link email login (v1; no password screens).
- Contact email: `olkuenver@gmail.com` until a domain mailbox is configured.
- Contact flow: form plus `mailto:` fallback.
- Admin surface: `admin.siriusai.store`.
- Admin auth: Supabase Auth plus admin email allowlist; default allowlist email `olkuenver@gmail.com`.
- Existing token-based commercial admin (`MANU_COMMERCIAL_ADMIN_TOKEN`) remains emergency fallback only.
- Paid tenants start empty; demo seed clients must not be copied into paid tenants.
- Stripe remains test/sandbox unless separately approved outside Phase 84.

## Scope Lock (Immutable)

These rules are fixed for Phase 84 and must not be weakened in later sub-phases:

- Phase 84 cannot override Phase 80-83 readiness outcomes or set `productionPilotStarted=true`.
- Production pilot remains `NO-GO` until external launch gates close, R-405 resolves or is formally accepted, and current RLS evidence passes independently of Phase 84.
- No live Stripe keys, real charging, or production billing activation.
- No real WhatsApp, Telegram, Gemini/provider, monitoring, secret manager, backup provider, or real client health-data production path.
- No native App Store, Play Store, IPA, APK, or Enterprise customer distribution in Phase 84.
- PWA v1 install rules from Phase 83D remain: subscriber-only SW registration; service worker caches shell/static only; `/api/*` network-only; no PHI cache.
- Phase 83 clinical covenant, entitlement gates, and dashboard API hardening remain in force.
- Token admin must not become the normal admin UX after Phase 84F.
- Purchase success and onboarding UI must not imply paid users already have dashboard accounts until claim is implemented (R-425).

## Architecture Freeze

### Three Surfaces

```text
┌─────────────────────────────────────────────────────────────────┐
│  PUBLIC (siriusai.store)                                        │
│  /  marketing, contact CTA, Giriş yap → /login                  │
│  /purchase/*  invite-gated Stripe checkout (existing Phase 83C)   │
│  /login, /auth/callback, /onboarding  (Phase 84D–84E)           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  CUSTOMER PRODUCT (siriusai.store)                                │
│  /dashboard  requires: Auth session + membership + dietitian    │
│              profile + active entitlement (Phase 83G)           │
│  /app-install  subscriber-only PWA (Phase 83D)                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ADMIN (admin.siriusai.store → /admin)                          │
│  Supabase Auth + email allowlist                                │
│  leads, invites, entitlements, ledger, health, audit            │
│  /commercial-admin token path = emergency fallback only           │
└─────────────────────────────────────────────────────────────────┘
```

### Customer Auth And Redirect Contract (Frozen)

After Phase 84D–84E implementation:

| State | Redirect |
| --- | --- |
| Unauthenticated visitor | Public site or `/login` |
| Authenticated; no paid/claimed workspace | `/onboarding` or contact/support state |
| Authenticated; email mismatch with paid invite | Claim blocked; safe error state |
| Authenticated; membership + dietitian profile + active entitlement | `/dashboard` |
| Entitlement `past_due`, `canceled`, or `revoked` | Existing Phase 83 gated states |

Supabase Auth redirect URLs must include:

- `https://siriusai.store/auth/callback`
- `https://admin.siriusai.store/auth/callback`
- Local dev equivalents when configured in Supabase project settings.

### Onboarding Claim Contract (Frozen)

Claim is keyed by Stripe checkout `session_id` and must:

1. Verify checkout session belongs to a consumed commercial invite and active entitlement.
2. Require authenticated user email to match invite/billing email.
3. Create `tenant_memberships` with role `owner` (idempotent).
4. Create `dietitians` profile with default display name from invite metadata, Turkish UI, `Europe/Istanbul` timezone (idempotent).
5. Record `commercial_onboarding_events` audit entries.
6. Never seed demo clients into the paid tenant.
7. Redirect to `/dashboard` on success.

### Admin Host Routing (Frozen)

- DNS: `admin.siriusai.store` A record → `167.233.207.102`.
- Nginx terminates TLS and forwards to the same Next.js PM2 process.
- Host header `admin.siriusai.store` routes to `/admin` app surface.
- `/commercial-admin` redirects to `/admin` or remains hidden emergency fallback.

### Reused Runtime (No Redesign in Phase 84)

- Phase 83B entitlement model and transitions.
- Phase 83C Stripe sandbox checkout, webhook, billing portal.
- Phase 83D PWA install gate and SW policy.
- Phase 83F commercial admin APIs and audit events.
- Phase 83G `resolveAppTenantContext()` entitlement enforcement on dashboard APIs.

## Phase 84 Entry Baseline

Recorded at Phase 84A start on 2026-07-02:

| Item | Baseline value |
| --- | --- |
| Prior implementation phase | Phase 83H + final remediation + Phase 83F hosted Supabase diagnostics |
| Phase 83 track | closed locally |
| VPS sandbox | `https://siriusai.store` live with test Stripe webhook verified |
| Payment provisioning | invite consumed → tenant → active entitlement → ledger entries |
| Onboarding gap | R-425 open; no post-payment Auth/membership/profile |
| `productionPilotDecision` | `NO-GO` |
| `productionPilotStarted` | `false` |
| Launch gates | all eight open |
| R-405 | open; stable `next@latest` 16.2.9 still bundles nested `postcss@8.4.31` |
| R-406 | Phase 50/52 baseline mitigated; current post-83 re-run pending when local Supabase unavailable |
| Public landing | Phase 83E minimal intro; demo CTA still prominent on VPS |
| Customer login | implemented (`/login`, magic link) |
| Admin subdomain | implemented and VPS DNS/Nginx/SSL configured; non-static admin-host paths route to `/admin` |
| Expected Phase 84A outcome | spec/architecture freeze only; no runtime behavior change |

## Success Criteria

### Phase 84 Overall (84A–84H)

Phase 84 succeeds when all are true:

1. Professional SiriusAI public site is live on `https://siriusai.store`.
2. Customer magic-link login and auth callback work.
3. Post-payment onboarding claim creates membership and dietitian profile idempotently.
4. A paid test customer reaches real `/dashboard` without the demo flow.
5. Admin portal is live on `https://admin.siriusai.store` with allowlist auth.
6. Contact leads are captured and visible in admin.
7. Production pilot narrative remains `NO-GO`; Stripe stays sandbox; R-425 is closed or explicitly mitigated in docs/tests.

### Phase 84A Done (This Phase)

Phase 84A is complete when:

1. This document is the canonical frozen Phase 84 spec.
2. Payment webhook evidence and onboarding gap are recorded without secrets.
3. Architecture for public/customer/admin surfaces is frozen.
4. Sub-phases 84B–84H have implementation-ready acceptance notes.
5. Continuity docs identify Phase 84A complete and Phase 84B as next.
6. No runtime product behavior changed in 84A.

## Phase Breakdown

### Phase 84A — PRD, Spec, And Architecture Freeze — Completed 2026-07-02

Goal: freeze PRD, architecture, and continuity before implementation code.

Completed:

- Expanded this spec with PRD, architecture freeze, entry baseline, success criteria, and sanitized VPS payment evidence.
- Recorded R-425 as the primary implementation target for 84D–84E.
- Locked three-surface architecture, auth redirect contract, onboarding claim contract, and admin host routing.
- Updated continuity docs in the same change set.
- No runtime code, migration, provider, channel, Stripe live key, or production GO change.

Verification: documentation-only; `git diff --check` expected to pass.

Next: Phase 84B professional public website.

### Phase 84B — Professional Public Website — Completed 2026-07-02

Goal: replace the minimal public landing with a professional SiriusAI marketing homepage.

Completed:

- Added `phase-84b-public-website.ts` and `siriusai-marketing-page.tsx`.
- Rebuilt `/` with hero, value, safety, workflow, mobile, governance, onboarding, and contact sections.
- Added sanitized product mock panel without real client data.
- Added `/login` placeholder and env-gated `/demo` plus `/api/demo-login` gate via `MANU_ALLOW_PUBLIC_DEMO_LOGIN`.
- Removed primary hero demo CTA from public homepage.
- Aligned contact email to `olkuenver@gmail.com` across public and purchase surfaces.

Verification: Phase 84B tests 4/4; purchase UX regression 8/8; lint with two pre-existing warnings; build passed.

Next: Phase 84F admin subdomain and professional admin console.

### Phase 84E — Post-Payment Customer Onboarding — Completed 2026-07-02

Goal: let paid customers claim provisioned tenants and reach `/dashboard` without demo flow.

Completed:

- Added migration `20260702140000_phase_84e_commercial_onboarding_events.sql`.
- Added `phase-84e-customer-onboarding.ts`, `commercial-onboarding-store.ts`, and unit tests (5/5).
- Added `GET /api/commercial/onboarding/status` and `POST /api/commercial/onboarding/claim`.
- Rebuilt `/purchase/success` with magic-link account CTA keyed by `session_id`.
- Wired `/onboarding` claim panel with idempotent owner membership + dietitian profile creation (`Europe/Istanbul`, `tr`).
- Extended magic-link API to audit `magic_link_requested` and honor safe `next` redirects.

Verification: Phase 84E tests 5/5; Phase 84D regression 7/7; lint with two pre-existing warnings; build passed. This local-only R-425 status is superseded by Phase 84I live generated token-hash onboarding/dashboard verification and Phase 84J real custom-SMTP email dashboard verification.

Next: Phase 84F admin subdomain and professional admin console.

### Phase 84D — Customer Auth Foundation — Completed 2026-07-02

Goal: enable registered customers to sign in with Supabase magic link and land on the correct post-auth route.

Completed:

- Added `phase-84d-customer-auth.ts`, `customer-auth-store.ts`, `customer-auth-session.ts`, and unit tests (7/7).
- Rebuilt `/login` with `customer-login-form.tsx` and `POST /api/auth/magic-link` (registered commercial email gate, rate limit, safe errors).
- Added `/auth/callback` to exchange Supabase auth code, set cookies, and redirect safely.
- Added `/onboarding` placeholder for paid-but-unclaimed workspaces until 84E claim ships.
- Implemented frozen redirect contract: dashboard / onboarding / support states.
- Updated dashboard proxy and page to send unauthenticated users to `/login`.

Verification: Phase 84D tests 7/7; Phase 84B regression 4/4; lint with two pre-existing warnings; build passed.

Next: Phase 84E post-payment customer onboarding (completed).

### Phase 84C — Lead And Contact Flow — Completed 2026-07-02

Goal: capture public marketing contact leads with safe validation and admin operability.

Completed:

- Added migration `20260702120000_phase_84c_commercial_leads.sql` with RLS fail-closed (service-role API path only).
- Added `phase-84c-contact-leads.ts`, `commercial-leads-store.ts`, and unit tests (5/5).
- Added `POST /api/contact/leads` with validation, honeypot spam handling, rate limiting, and safe errors.
- Added `/api/commercial/admin/leads` GET list + PATCH status for token admin console.
- Wired `contact-lead-form.tsx` on the marketing homepage with mailto fallback to `olkuenver@gmail.com`.
- Extended commercial admin health probe and RLS integration coverage for `commercial_leads`.

Verification: Phase 84C tests 5/5; Phase 84B regression 4/4; lint with two pre-existing warnings; build passed.

Next: Phase 84D customer auth foundation.

### Phase 84B — Professional Public Website

Implementation notes (frozen scope):

- Rebuild `/` as a polished SiriusAI marketing homepage.
- Sections: hero, product value, supervised AI safety model, workflow, PWA/mobile access, clinical governance boundaries, invite-only onboarding, contact CTA.
- Visual assets: sanitized/generated mock UI only; no real client data or health-data screenshots.
- Top-right `Giriş yap` → `/login` (route added in 84D; button may ship in 84B as stub or with 84D).
- Primary prospect CTA: `Bizimle iletişime geçin` with mailto `olkuenver@gmail.com` plus contact form (form storage in 84C).
- Remove or env-gate primary `Demo panelini aç` on VPS; demo only behind explicit dev/demo route or env gate.

### Phase 84F — Admin Subdomain And Professional Admin Console — Completed 2026-07-03

- `/admin` with Supabase magic-link + `MANU_ADMIN_EMAIL_ALLOWLIST` (default `olkuenver@gmail.com`).
- Dual auth on commercial admin APIs: allowlisted session or emergency token.
- Console sections: overview metrics, leads, invites, subscriptions/entitlements, billing ledger, system health, audit trail.
- `admin.siriusai.store` host rewrite via `proxy.ts`; `/commercial-admin` redirects to `/admin`; token fallback at `/commercial-admin/emergency`.
- Superseded by Phase 84I live verification: VPS DNS A record, Nginx/SSL, and Supabase redirect URLs are configured for the sandbox.

Verification: Phase 84F tests 4/4 + access 2/2; full suite 695 passed / 4 skipped; build passed.

Next: Phase 84J custom SMTP and real email magic-link delivery verification.

### Phase 84G — Subscription Operations Hardening — Completed 2026-07-03

- Preserved Stripe sandbox-only guard (`sk_test_*`, `MANU_ALLOW_STRIPE_SANDBOX=true`).
- Admin distinguishes **Erişimi kapat** (entitlement `revoked`) vs **Stripe aboneliğini iptal et** (sandbox subscription cancel).
- Audit: `stripe_subscription_canceled`, `lead_status_updated`, `admin_operation_blocked`; actor summary on admin writes.
- Defensive UI for duplicate checkout/consumed invite, pending webhook, past due, canceled, revoked states.

Verification: Phase 84G tests 4/4; 83C/83F regression 25/25; build passed.

Next: Phase 84J custom SMTP and real email magic-link delivery verification.

### Phase 84H — Verification, Docs, And Deployment — Completed 2026-07-03 (repo-local)

- `phase-84h-verification-refresh.ts` locks eight QA scenarios across landing, contact, auth, onboarding, dashboard gate, and admin operations.
- Visual tests: `commercial-saas.visual.spec.ts` + updated `dashboard.visual.spec.ts` purchase-success expectations for 84E onboarding CTA.
- Repo-local verification: Phase 84 targeted tests 36/36; 84H tests 5/5; visual tests 36/36; lint 0 errors (2 pre-existing warnings); build passed.
- VPS deployment checklist (completed during Phase 84I live verification):
  - Apply migrations: `20260702120000_phase_84c_commercial_leads.sql`, `20260702140000_phase_84e_commercial_onboarding_events.sql`, `20260703120000_phase_84g_commercial_admin_audit_extension.sql`
  - Configure env: Supabase URLs, `MANU_ADMIN_EMAIL_ALLOWLIST`, Stripe sandbox keys
  - DNS `admin.siriusai.store` → `167.233.207.102`, Nginx/SSL
  - Rebuild, restart PM2, verify: `https://siriusai.store`, `/login`, `/purchase/success`, `https://admin.siriusai.store`
- Phase 84 repo-local track closed. This VPS/email-pending status is superseded by Phase 84I live generated token-hash onboarding/dashboard verification and Phase 84J real custom-SMTP email dashboard verification. Production pilot remains `NO-GO`.

### Phase 84I — Auth/Admin/VPS Closure Remediation — Completed 2026-07-03 (repo-local)

Scope lock:

- Preserve production pilot `NO-GO`, Stripe sandbox-only behavior, and no real provider/channel/monitoring/backup/real-data activation.
- Fix the magic-link callback response so Supabase session cookies survive the final redirect after `exchangeCodeForSession`.
- Add an explicit admin callback base URL contract: customer auth uses `NEXT_PUBLIC_APP_URL`; admin auth uses `MANU_ADMIN_APP_URL`, defaulting to `https://{MANU_ADMIN_HOST}` outside local override.
- Broaden admin-host routing so `admin.siriusai.store` non-static, non-API, non-auth paths land on the professional `/admin` surface.
- Harden onboarding claim idempotency when duplicate requests race on the unique `dietitians.auth_user_id` constraint.
- Refresh continuity docs and evidence without closing R-425 until hosted migrations and VPS sandbox onboarding are verified.

Repo-local acceptance:

- Route-level auth callback tests prove final success redirects include Supabase `Set-Cookie`; callback errors do not create a false session.
- Auth helper/admin route tests prove customer callback URL and admin callback URL use separate bases.
- Proxy/admin tests prove admin-host `/` and nested non-static paths resolve to `/admin`, while `/api/*`, `/_next/*`, `/auth/*`, and public assets are untouched.
- Onboarding tests prove duplicate same-tenant claim succeeds idempotently, while foreign-tenant profile conflicts remain fail-closed.
- Repo-local verification passed: Phase 84/remediation targeted tests 41/41; lint 0 errors (2 pre-existing warnings); build passed; visual tests 36/36; `npm run release:verify` passed with core 225/225 and app 709 passed / 4 skipped; `git diff --check` passed with CRLF warnings only.
- `npm run test:rls` skipped 21/21 because local Supabase was unavailable; R-406 current re-run remains pending.
- This earlier R-425 status is superseded by Phase 84I/84J hosted sandbox verification: hosted migrations, DNS/Nginx/SSL/PM2, sandbox checkout, onboarding claim, real custom-SMTP email, and dashboard access have been verified for the sandbox path.

### Phase 84I-Live-1 — Token-Hash Callback Remediation — Completed 2026-07-03

Live Phase 84 sandbox verification found that Supabase generated magic links can arrive as `/auth/v1/verify?token=...&type=magiclink` and redirect to the app without a server-visible `code`. The existing `/auth/callback` route preserved cookies for `exchangeCodeForSession(code)` but did not handle token-hash OTP callbacks, so generated-link fallback reached `/login` without an authenticated session.

Scope lock:

- Preserve the existing `code` callback behavior and cookie/header preservation.
- Add token-hash OTP verification only for Supabase-supported email OTP callback types.
- Keep production pilot `NO-GO`; do not activate live Stripe, real providers, production webhook, monitoring, backup, secret-manager, or real client data paths.
- Use this fix for Phase 84 onboarding verification and later Phase 84J custom SMTP template validation.

Verification:

- Repo-local: `npx vitest run src/app/auth/callback/route.test.ts src/lib/phase-84d-customer-auth.test.ts src/lib/phase-84e-customer-onboarding.test.ts --no-file-parallelism --maxWorkers=1` passed 16/16; `npm run build` passed.
- VPS deploy: callback route updated on the Hetzner sandbox, production build passed, and PM2 `manu-ai` restarted online.
- Supabase default email path was blocked by `over_email_send_rate_limit`; Phase 84J later replaced it with verified Resend custom SMTP.
- Generated token-hash fallback path reached `/onboarding`, captured an auth cookie, returned authenticated + claimable status, created the paid tenant owner membership and dietitian profile, returned `/dashboard` 200, and a repeat claim returned `alreadyClaimed: true`.
- This earlier R-425/email-delivery gap is superseded by Phase 84J real custom-SMTP email dashboard verification; production pilot remains `NO-GO`.

### Phase 84J — Custom SMTP And Real Magic-Link Email Verification — Completed 2026-07-03

Goal: replace Supabase default rate-limited Auth email delivery with a verified transactional email provider, then prove the same customer magic-link onboarding path through a real inbox email.

Scope lock:

- Preferred provider: Resend SMTP with a verified SiriusAI sending domain.
- DNS host observed: Porkbun nameservers for `siriusai.store`.
- Sender default: `SiriusAI <auth@siriusai.store>` unless provider verification requires a subdomain sender.
- Required DNS records are provider-generated and must be added exactly as issued: DKIM, SPF/return-path where applicable, and DMARC if absent.
- Supabase Auth custom SMTP must be configured only after the sender domain verifies.
- Supabase custom SMTP contract: enable SMTP in Auth email settings with sender email/name, SMTP host, port, user, and password.
- Resend SMTP contract: host `smtp.resend.com`, port `465`, username `resend`, password = Resend API key.
- Verification must send a real customer magic link to the sandbox customer email, open the received link, reach `/onboarding`, confirm authenticated status, confirm idempotent claim/dashboard 200, and record sanitized evidence.
- Do not activate live Stripe, real provider/channel, monitoring, backup, secret manager, production webhook, or real client health-data paths. Production pilot remains `NO-GO`.

Execution steps:

1. Add/verify the SiriusAI sending domain in Resend.
2. Add Resend-issued DNS records in Porkbun for `siriusai.store`.
3. Confirm DNS propagation and Resend domain verification.
4. Configure Supabase Auth custom SMTP with Resend SMTP credentials.
5. Send a real magic link from `/api/auth/magic-link` for the sandbox customer.
6. Open the received email link and verify `/auth/callback` session, `/onboarding`, status, claim idempotency, and `/dashboard` 200.
7. Update continuity docs and R-425 status without changing production pilot `NO-GO`.

Blocked inputs before execution:

- Resend account access or a Resend API key with permission to add/verify the sending domain and create/use SMTP credentials.
- Porkbun DNS access/API credentials for `siriusai.store`, or the user must add the exact DNS records when provided.

Verification:

- Resend sending domain was verified with Porkbun DNS records for `auth.siriusai.store`.
- Supabase Auth custom SMTP was enabled with Resend SMTP (`smtp.resend.com`, port `465`, user `resend`) and sender `SiriusAI <no-reply@auth.siriusai.store>`.
- Live `/api/auth/magic-link` returned `sent: true` through custom SMTP.
- Real inbox magic-link click reached `https://siriusai.store/dashboard`.
- Fragment-token email links required a small callback bridge: `/auth/callback` now renders a no-store fragment-session bridge and `POST /api/auth/session-from-fragment` converts Supabase implicit-flow fragment tokens into SSR cookies.
- Verification passed: fragment/session targeted tests 7/7, auth/onboarding targeted tests 19/19 before the refresh-token guard adjustment, local production build passed, VPS production build passed, and PM2 `manu-ai` restarted online.
- R-425 commercial onboarding/email-delivery path is verified in the hosted sandbox. Production pilot remains `NO-GO`; R-405, current RLS re-run, external approvals, and production launch gates remain open.

### Phase 85 Stage 3 Hosted Sandbox Redesign Update - 2026-07-07

- Public/commercial entry surfaces were redesigned in Phase 85 Stage 3 from `docs/PHASE_85_STAGE_3_PUBLIC_COMMERCIAL_ENTRY_ACTION_PLAN.md` and the user-provided `public-website-redesign.zip` visual direction.
- The redesign was deployed to the existing Hetzner/Nginx/PM2 sandbox as release `phase85-stage3-redesign-20260707225306`.
- Verification returned 200 for `https://siriusai.store`, `/login`, `/purchase`, `/purchase/success`, `/app-install`, and `https://admin.siriusai.store`.
- Browser computed-color verification on the live domain confirmed the corrected user palette: paper `oklch(0.985 0.003 85)` and primary purple `oklch(0.41 0.14 310)`.
- This update changes frontend/public/commercial entry presentation only. It does not change Phase 83/84 API contracts, auth, entitlement, onboarding, sandbox billing, admin, Stripe test-mode status, or production `NO-GO`.

## Public Interfaces And Data Changes

Planned pages:

- `/`
- `/login`
- `/auth/callback`
- `/onboarding`
- `/admin`

Planned APIs:

- `/api/auth/magic-link`
- `/api/commercial/onboarding/status`
- `/api/commercial/onboarding/claim`
- `/api/contact/leads`
- `/api/admin/*` or existing commercial admin APIs behind admin-auth facade

Planned storage:

- `commercial_leads`
- `commercial_onboarding_events`

Reused storage:

- `commercial_invites`
- `tenant_entitlements`
- `billing_event_ledger`
- `tenant_memberships`
- `dietitians`
- `commercial_admin_audit_events`

## Edge Cases

| Scenario | Expected behavior |
| --- | --- |
| Visitor is not a customer | Sees public site and contact CTA only |
| Existing customer clicks login | Receives magic link and reaches dashboard if fully provisioned |
| Paid invite exists but user has not claimed tenant | Onboarding page prompts claim |
| Authenticated email does not match invite email | Claim blocked |
| Webhook has not arrived yet | Success/onboarding page shows pending verification state |
| Invite consumed and entitlement active | Claim allowed |
| Claim repeated | Idempotent success; no duplicate membership/profile |
| Entitlement revoked | Dashboard and install remain blocked |
| Non-admin opens admin subdomain | Blocked by allowlist |
| Admin token fallback used | Logged and treated as emergency/fallback path |
| Duplicate checkout attempt | Safe blocked or idempotent handling per Phase 83C |
| Paid tenant provisioned | No demo clients copied into tenant |

## Non-Goals

- No production pilot GO.
- No live Stripe key, real charging, or production billing activation.
- No real WhatsApp/Telegram/Gemini/provider activation.
- No real monitoring, secret manager, backup provider, or production webhook activation beyond Stripe test webhook.
- No native App Store/Play Store/IPA/APK distribution.
- No real client health data production use.
- No R-405 closure or formal acceptance.
- No launch-gate closure or `productionPilotStarted=true`.

## Continuity Requirements

Every successful Phase 84 implementation sub-phase must update at minimum:

1. `HANDOFF_FOR_NEXT_CODEX.md`
2. `PLAN.md`
3. `PROJECT_PLAN.md`
4. `README.md`
5. `app/README.md`
6. `docs/NEXT_PHASE_EXECUTION_PLAN.md`
7. `docs/PHASE_84_COMMERCIAL_SAAS_RELAUNCH_AND_ONBOARDING_SPEC.md`
8. `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`
9. `docs/PILOT_READINESS_EVIDENCE_PACK.md`
10. `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`
11. `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md`
12. `docs/RISK_REGISTER.md` if risk status or risk narrative changes.

If a sub-phase changes deployment, admin operations, billing, onboarding, auth, or external readiness evidence, update the related evidence/review packet docs in the same change set.
