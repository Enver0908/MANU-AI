# MANU-AI Local App Prototype

## Phase 85 Roadmap Restructure

2026-07-10: Phase 85 Stages 1-3 and Stage 4A are complete. The mandatory cross-cutting Phase 85 Interstage Foundation (`P85-IF`) is canonically planned in `../docs/PHASE_85_INTERSTAGE_TRUSTED_CLINICAL_COMMUNICATION_MEMORY_PLAN.md`; P85-IF-A through P85-IF-I are complete and the approved remediation sequence is underway before Stage 4B resumes. Production pilot remains `NO-GO`; real provider/channel/health-data paths remain disconnected.

2026-07-10 R5 remediation: P85-IF-H operational inspection details are no longer delivered in common app-state. Owner/admin inspection now uses `src/app/api/operational-foundation/route.ts` with `read_operational_foundation`; direct unauthorized API calls return 403. Migration `20260710220000_phase_85_if_remediation_operational_access_boundaries.sql` restricts select RLS for operational trust/quarantine tables to owner/admin while dietitian clinical workflow records remain visible. Local Supabase reset passed, targeted P85-IF-H/supabase-store passed 11/11, and local `npm run test:rls` passed 26/26.

2026-07-10 R3 remediation: P85-IF-F activation now uses required conversation/client-context expected revisions, rejects direct active PATCH, and adds service-role-only atomic activation in migration `20260710200000_phase_85_if_remediation_atomic_activation.sql`. Local Supabase reset passed and `npm run test:rls` passed 24/24.

2026-07-10 R4 remediation: P85-IF-G context-intake Supabase confirm/recheck/apply/reject now uses service-role-only atomic RPC `p85_if_r4_mutate_context_intake_proposal` from migration `20260710210000_phase_85_if_remediation_client_safe_context_intake.sql`. Wrong-client or missing proposals return `404`; stale proposal states return `409`; structured-impact proposals still require panel revision evidence and two confirmations; apply creates only a context update and invalidates drafts transactionally. Local Supabase reset passed, targeted P85-IF-G passed 11/11, and local `npm run test:rls` passed 25/25.

## Phase 85 Interstage Foundation P85-IF-C Secure Ingress, Ledger, Routing, And Quarantine

2026-07-10: Added and post-commit audited `src/lib/phase-85-if-c-channel-event-normalizer.ts`, `phase-85-if-c-channel-event-routing.ts`, and `phase-85-if-c-channel-event-ledger.ts`. The remediation fixes provider `to`-based business-human counterparty resolution, strict fail-closed trust/tenant/assignment checks, account-scoped quarantine, explicitly authorized replay with real client-inbound effects, canonical provider/actor provenance, invalid provider-time evidence, and duplicate-ID/digest conflicts. Other event kinds remain ledger-only; P85-IF-D still owns business-human transcript/human-control behavior. Verification: targeted 40/40, app 780 passed / 4 skipped, core 225/225, lint 0 errors with 3 unchanged warnings, build passed, and full mock channel replay passed. Production pilot remains `NO-GO`.

## Phase 85 Stage 4A.4 AI Asistan Kontrolu

2026-07-08: Moved AI controls into dedicated **AI Asistan Kontrolu** tab with persona, status/mode, activation window, safety checklist, autopilot readiness gate, lock status, and preflight blockers. Added `src/components/dashboard/ai-assistant-control-panel.tsx` and `src/lib/ai-assistant-control-panel-helpers.ts`; updated `src/components/dashboard/clients-panel.tsx`. Verification: lint 0 errors (3 pre-existing warnings), helper tests 4/4, full app suite 734 passed / 4 skipped, build passed, Playwright visual 36/36. Stage 4A (Stage 4A.1-4A.4) complete. Production pilot remains `NO-GO`.

## Phase 85 Stage 4A.3 Menu

2026-07-08: Upgraded the client menu tab into a first-class **Menu** workflow with four template picker cards, Turkish template labels/descriptions, plan status badges, conflict display, activation hard-block on severe conflicts, and integrated MANU-only DOCX/PDF export when eligible. Added `src/components/dashboard/menu-workflow-panel.tsx`, `src/components/dashboard/menu-workflow-export-section.tsx`, and `src/lib/menu-workflow-panel-helpers.ts`; upgraded `src/components/menu-plan-panel.tsx`. Verification: lint 0 errors (3 pre-existing warnings), helper tests 4/4, full app suite 730 passed / 4 skipped, build passed, Playwright visual 36/36. Production pilot remains `NO-GO`.

## Phase 85 Stage 4A.2 Aktif Beslenme Plani

2026-07-08: Upgraded the client food-rules tab into **Aktif Beslenme Plani** with Phase 77D catalog tree browsing (main/sub/food Izinli/Yasak), quick search, conflict review, and existing `/api/clients/[id]/food-rule-profile` save path. Added `src/components/dashboard/catalog-tree-browser.tsx`, `src/components/dashboard/active-nutrition-plan-panel.tsx`, and `src/lib/active-nutrition-plan-helpers.ts`; upgraded `src/components/food-rules-panel.tsx`. Verification: lint 0 errors (3 pre-existing warnings), helper tests 5/5, full app suite 726 passed / 4 skipped, build passed, Playwright visual 36/36. Production pilot remains `NO-GO`.

## Phase 85 Stage 4A.1 Danisan Formu Paneli

2026-07-08: Implemented the full Phase 77C active-schema response editor in the dashboard danisan kontrol paneli (`tab_personal_form`). Added `src/components/dashboard/client-form-panel.tsx` and `src/lib/client-form-panel-helpers.ts`; save uses existing `POST /api/clients/forms`. Verification: lint 0 errors (3 pre-existing warnings), helper tests 5/5, full app suite passed, build passed, Playwright visual 36/36. Production pilot remains `NO-GO`.

## Phase 85 Stage 4A Danisan Kontrol Paneli Mimari ve Hizmet Akisi Plani

2026-07-08: Added `../docs/PHASE_85_STAGE_4A_DANISAN_KONTROL_PANELI_MIMARI_VE_HIZMET_AKISI_PLANI.md` after inspecting the existing dashboard client panel, active form schema/response path, food-rule profile/catalog path, menu-plan/export path, and AI activation/preflight path. Stage 4A.1 through Stage 4A.4 are complete. Production pilot remains `NO-GO`.

## Phase 85A Frontend Redesign Scope Lock

2026-07-07: Created `../docs/PHASE_85_FRONTEND_REDESIGN_AND_DESIGN_SYSTEM_SPEC.md` as the canonical SiriusAI redesign spec. Direction is warm clinical SaaS with the user-provided redesign palette: very light broken-white paper `#FBFAF8`, ink `#111116`, purple primary `#612E82`, sage `#578F6B`, warm accent `#D79800`, Fraunces display, Geist Sans UI, editorial public surfaces, compact dashboard/PWA, restrained borders, and no reuse of the previous visual style as a design reference. Phase 85 Stages 1-3 are now implemented for foundation, shared components, and public/commercial entry surfaces. Production pilot remains `NO-GO`.

## Phase 85B Design Tokens And Font Foundation

2026-07-07: Implemented the foundation layer. `src/app/layout.tsx` loads Fraunces display with Geist Sans/Mono; `src/app/globals.css` exposes the approved paper/surface/ink/plum/sage/warm/border/focus tokens and `.font-display`; `src/components/ui/tokens.ts` records the Phase 85 palette and uses semantic primary button tokens. Stage 3 later corrected the runtime palette to match the user-provided redesign exactly: paper `oklch(0.985 0.003 85)`, primary `oklch(0.41 0.14 310)`, and hover `oklch(0.37 0.14 310)`. Dashboard and PWA shell redesign remain pending. Production pilot remains `NO-GO`.

## Phase 85 Stage 2 Shared Component System

2026-07-07: Implemented the shared component foundation. `src/components/ui/tokens.ts` now exposes `plum`, `sage`, and `warm` UI tones while mapping legacy `emerald` to `sage` and `amber` to `warm`; form, card, tabs, segmented-control, table, dialog, sheet, and app-shell primitives now use the Phase 85 palette; shared `Alert`, `EmptyState`, and `LoadingBlock` primitives were added. Stage 3 public/commercial page redesign is complete; dashboard/PWA shell redesign, workflow redesign, and final visual QA remain pending. Production pilot remains `NO-GO`.

## Phase 85 Stage 3 Public/Commercial Integration

2026-07-07: Implemented `../docs/PHASE_85_STAGE_3_PUBLIC_COMMERCIAL_ENTRY_ACTION_PLAN.md` for invite-led public and commercial entry surfaces, adapting the user-provided `public-website-redesign.zip` frontend design without copying its mock API routes. Locked flow remains: contact request -> team/admin review -> admin invite code -> approved email + invite code -> sandbox checkout -> magic-link -> onboarding claim -> dashboard/PWA. Locked navbar: `SiriusAI | Nasil calisir | Guvenlik | Mobil | Iletisim | Giris yap | Davet koduyla basla`. Phase 83/84 API/auth/checkout/onboarding/admin/PWA behavior remains preserved. The corrected user palette is live in runtime tokens. Deployed to the hosted sandbox as `phase85-stage3-redesign-20260707225306`; `https://siriusai.store`, `/login`, `/purchase`, `/purchase/success`, `/app-install`, and `https://admin.siriusai.store` returned 200. Production pilot remains `NO-GO`.

## Phase 84J Custom SMTP And Real Email Verification

2026-07-03: Completed custom SMTP and real magic-link email verification for the hosted sandbox. Resend sending domain was verified through Porkbun DNS, Supabase Auth custom SMTP was enabled, live `/api/auth/magic-link` returned `sent: true`, and a real inbox magic-link click reached `/dashboard`. Added `/api/auth/session-from-fragment` and a no-store `/auth/callback` fragment bridge for Supabase implicit-flow email links. Targeted auth/session tests 7/7 and production build passed locally and on VPS. Production pilot remains `NO-GO`.

## Phase 84I Auth/Admin/VPS Closure Remediation

2026-07-03: Added Phase 84I remediation for auth callback cookie preservation, token-hash OTP callback support, admin callback base URL separation (`MANU_ADMIN_APP_URL`), broader admin-host routing coverage, and duplicate onboarding claim recovery. Verification: token-hash auth/onboarding tests 16/16 and build passed; earlier targeted Phase 84/remediation tests 41/41, visual tests 36/36, and release verify app 709 passed / 4 skipped remain the local baseline. VPS sandbox generated token-hash onboarding reached `/onboarding`, claim created the owner membership and dietitian profile, `/dashboard` returned 200, and repeat claim returned `alreadyClaimed: true`. Phase 84J later verified real custom-SMTP email delivery. `npm run test:rls` skipped 21/21, so current RLS re-run remains pending. Production pilot remains `NO-GO`.

## Phase 84H QA, Docs, Deployment, Evidence

2026-07-03: Added `phase-84h-verification-refresh.ts`, `commercial-saas.visual.spec.ts`, eight QA scenarios. Phase 84 tests 36/36; 84H 5/5; visual 36/36; build passed. Superseded by Phase 84I live VPS onboarding verification through generated token-hash fallback.

## Phase 84G Subscription Operations Hardening

2026-07-03: Split admin revoke vs sandbox Stripe cancel, extended audit events, actor threading, defensive purchase/onboarding/admin UX. Tests 4/4; build passed. Next: 84H.

## Phase 84F Admin Subdomain And Professional Admin Console

2026-07-03: Added `/admin` (Supabase allowlist magic link), `POST /api/admin/auth/magic-link`, dual-auth `/api/commercial/admin/*`, audit trail API, session-mode admin console, `admin.siriusai.store` host rewrite, `/commercial-admin` redirect, emergency token at `/commercial-admin/emergency`. Tests 6/6 targeted; build passed. VPS DNS/Nginx/SSL configured during Phase 84I live verification. Next: 84G.

## Phase 84E Post-Payment Customer Onboarding

2026-07-02: Added onboarding status/claim APIs, `commercial_onboarding_events`, purchase-success account CTA, and onboarding claim panel. Tests 5/5; build passed. R-425 mitigated locally. Next: 84F.

## Phase 84D Customer Auth Foundation

2026-07-02: Added magic-link login (`/login`, `/api/auth/magic-link`, `/auth/callback`) and `/onboarding` redirect routing. Tests 7/7; build passed. Next: 84E (complete). Production pilot remains `NO-GO`.

## Phase 84C Lead And Contact Flow

2026-07-02: Added `commercial_leads` migration, `phase-84c-contact-leads.ts`, `commercial-leads-store.ts`, `POST /api/contact/leads`, `/api/commercial/admin/leads`, and `contact-lead-form.tsx` on the marketing homepage. Tests 5/5; build passed. Next: 84D. Production pilot remains `NO-GO`.

## Phase 84B Professional Public Website

2026-07-02: Rebuilt `/` as SiriusAI marketing homepage (`siriusai-marketing-page.tsx`, `phase-84b-public-website.ts`). Demo login gated with `MANU_ALLOW_PUBLIC_DEMO_LOGIN`; `/login` placeholder added. Contact: `olkuenver@gmail.com`. Tests 4/4; build passed. Next: 84C. Production pilot remains `NO-GO`.

## Phase 84A PRD, Spec, And Architecture Freeze

2026-07-02: Phase 84A froze the SiriusAI commercial SaaS relaunch spec in `../docs/PHASE_84_COMMERCIAL_SAAS_RELAUNCH_AND_ONBOARDING_SPEC.md`. Architecture locks public (`/`), customer (`/login`, `/onboarding`, `/dashboard`), and admin (`admin.siriusai.store` → `/admin`) surfaces. Sanitized VPS evidence: test checkout consumed invite, provisioned tenant, active entitlement, billing ledger entries. The original R-425 gap is superseded by Phase 84D-84J hosted sandbox verification.

Production pilot remains `NO-GO`; R-405 remains open; R-406 current post-83 local Supabase/RLS re-run remains pending when Supabase is unavailable.

## Phase 83F Hosted Supabase Recovery Diagnostics

2026-07-02: Added protected `/api/commercial/admin/health` diagnostics and clearer `/commercial-admin` failure guidance for hosted/local Supabase setup issues. The health endpoint is admin-token protected and reports sanitized causes for unreachable Supabase project hosts, missing commercial migrations, invalid service-role keys, incomplete admin env, and `MANU_DEV_FALLBACK_STORE=true` being incompatible with commercial admin operations. No secrets are exposed, no fallback admin store was added, and hosted Supabase credentials/migrations still must be configured outside the repo before invites can be created. Verification passed: targeted Phase 83F diagnostics tests 12/12, lint with two pre-existing warnings, and production build. Production pilot remains `NO-GO`; R-405 remains open; R-406 current post-83 local Supabase/RLS re-run remains pending when Supabase is unavailable.

## Phase 83 Final Remediation

2026-07-01: Phase 83 final remediation closed the remaining continuity and admin-revoke semantics gaps after Phase 83H. Current-state docs now point to Phase 83H/final remediation as the latest Phase 83 state. Commercial admin entitlement revoke now uses the single subscriber entitlement model: `/api/commercial/admin/entitlements/revoke` accepts `{ tenantId }`, rejects `mobileInstallOnly: true`, records `entitlement_revoked`, and blocks both dashboard APIs and mobile/PWA install access through the same entitlement. Verification passed: targeted Phase 83 64/64, full app suite 665 passed / 4 skipped, visual 16/16, release verify core 225/225 + app 665 passed / 4 skipped. Production pilot remains `NO-GO`; R-405 remains open; R-406 current post-83 local Supabase/RLS re-run remains pending when Supabase is unavailable.

## Phase 83H Verification And Release Evidence

2026-07-01: Phase 83H closed the Phase 83 track locally. Added `src/lib/phase-83h-verification-refresh.ts`, Playwright visual 16/16 (desktop/tablet/Android/iPhone), extended RLS coverage for `commercial_admin_audit_events`, and hardened `scripts/release-verify.mjs` `.next` cleanup for Windows. Final remediation re-ran targeted Phase 83 64/64 and release verify app 665 passed / 4 skipped. RLS skipped 21/21 (R-406 pending). Production pilot remains `NO-GO`. Next work is external launch-gate/R-405/RLS prerequisites.

## Phase 83G Security, Privacy, And Compliance Hardening

2026-07-01: Phase 83G added API-wide active entitlement enforcement via `resolveAppTenantContext()` + `commercial-entitlement-access.ts`, in-memory fail-closed rate limits on `/api/commercial/invite-status` and `/api/commercial/checkout`, PWA stale-session entitlement checks, and demo `tenant_entitlements` seeding. Targeted Phase 83 tests passed 58/58; build passed. Production pilot remains `NO-GO`. Next phase is 83H.

## Phase 83F Commercial Admin And Operations

2026-07-01: Phase 83F added fail-closed commercial admin operations via `src/lib/phase-83f-commercial-admin.ts`, `src/lib/commercial-admin-store.ts`, migration `20260701140000_phase_83f_commercial_admin_audit.sql`, protected routes under `/api/commercial/admin/*`, and local ops console `/commercial-admin`. Gate: `MANU_ALLOW_COMMERCIAL_ADMIN=true` + `MANU_COMMERCIAL_ADMIN_TOKEN` (min 32 chars). Admin can create/revoke invites, inspect subscription summaries, read billing ledger (audited), and revoke the subscriber entitlement that gates both dashboard APIs and mobile/PWA install access. Final remediation removed the misleading install-only revoke path. Production pilot remains `NO-GO`.

## Phase 83E Remediation

2026-07-01: Phase 83E remediation closed the frontend acceptance gaps found after 83E-6. Purchase now has a unique `Satın al` page heading plus `Davetli erişim kontrolü` form heading; dashboard visual-smoke labels are standardized to Turkish; mobile bottom navigation is horizontally reachable for all eight views; and the visual smoke workflow now checks safety-missing before red-risk lock. Verification passed with visual 6/6, targeted Phase 83 50/50, lint with two pre-existing warnings, full unit 645 passed / 4 skipped, and release verify core 225/225 + app 645 passed / 4 skipped. RLS skipped 21/21 because local Supabase was unavailable. This historical 83E remediation predates later Phase 83F/G/H and final remediation work.

## Phase 83E-6 States, Accessibility, And Polish

2026-07-01: Phase 83E-6 (final 83E sub-phase) added loading skeletons, enhanced empty/error/session-recovery states, keyboard focus rings, skip link, semantic dashboard structure, and PWA banner a11y via `src/lib/phase-83e6-states-polish.ts` + `dashboard/state-primitives.tsx`. Panels use consistent `EmptyState`; dashboard loading uses stable skeleton; session errors use `ErrorState`. **Phase 83E frontend relaunch complete locally.** Lint clean; full unit suite (102 files, 645 passed / 4 skipped) and production build passed. Later Phase 83F/G/H and final remediation are complete locally.

## Phase 83E-5 Mobile Ergonomics

2026-07-01: Phase 83E-5 deepened mobile ergonomics. Extended `src/lib/phase-83e5-mobile-ergonomics.ts` (chrome spacing constants, keyboard-aware input helpers; unit tested 5/5) wired through `dashboard/shared.tsx`. Added `globals.css` mobile chrome utilities and `dashboard/mobile-ergonomics.tsx` (`MobileStickyActionBar`, `useMobileKeyboardScroll`). Sticky one-handed action bars on conversation (Save manual reply), simulator (Run inbound flow), and copilot (Ask). Shell touch targets 44px+, safe-area padding, view-aware content offset. No clinical/API/entitlement/Stripe/SW-cache behavior changed. Lint clean; full unit suite (101 files, 643 passed / 4 skipped) and production build passed. Next sub-phase is 83E-6.

## Phase 83E-4 Full Dashboard Parity

2026-07-01: Phase 83E-4 recomposed the ~3,189-line monolithic `src/components/dashboard-app.tsx` into domain panel modules under `src/components/dashboard/`  -  `shared.tsx` (primitives/helpers/constants/types), `overview-panel.tsx`, `clients-panel.tsx` (list + detail form/tabs, status summary, scoped copilot, export, critical context), `conversation-panel.tsx`, `simulator-panel.tsx`, `voice-panel.tsx`, `forms-panel.tsx`, `copilot-panel.tsx`, `handoffs-panel.tsx`. `dashboard-app.tsx` is now a ~830-line orchestrator (state/data wiring + 83E-3 shell) delegating each view to its panel. Verbatim extraction: all workflows, `data-testid`s, provenance/origin labels, message risk colors, red-risk lock, approval flows, and fail-closed logic unchanged; no API/type/entitlement/Stripe/RLS/SW-cache behavior changed. Lint clean; full unit suite (100 files, 638 passed / 4 skipped) and production build passed. Next sub-phase is 83E-5.

## Phase 83E-3 Authenticated App Shell

2026-07-01: Phase 83E-3 rebuilt the authenticated shell mobile-first. Added fail-closed `src/lib/phase-83e3-app-shell.ts` (`deriveDashboardAccessGate` + subscription/install status descriptors; unit tested 4/4). Rebuilt `src/components/auth-states.tsx` on the design system with all six gated-state screens (no membership, no dietitian profile, no invite, checkout incomplete, inactive subscription, revoked access) + a `DashboardGatedState` router; `src/app/dashboard/page.tsx` resolves entitlement server-side and only an active entitlement reaches the dashboard (Supabase-unconfigured fallback/demo path unchanged). `DashboardApp` gained a mobile bottom nav (`lg:hidden`, 44px+ targets, safe-area), the sidebar nav is now desktop-only, and the header shows subscription/install pills + safe sign-out when authenticated. No clinical/API/entitlement/Stripe/SW-cache behavior changed (domain-panel recompose remains 83E-4). Lint clean; full unit suite (100 files) and production build passed. Next sub-phase is 83E-4.

## Phase 83E-2 Public Intro + Purchase UX

2026-07-01: Phase 83E-2 rebuilt the public landing (`src/app/page.tsx`) with a `Satın al` CTA and added the gated purchase flow (`src/components/purchase-flow.tsx`, `src/app/purchase/*`) consuming existing `/api/commercial/invite-status` and `/api/commercial/checkout`, plus success (onboarding + install) and cancel pages. Fail-closed logic in `src/lib/phase-83e2-purchase-ux.ts` (unit tested 8/8). Unapproved users see waitlist/contact, not checkout. Lint clean; full unit suite and production build passed. Next sub-phase is 83E-3.

## Phase 83E-1 Design System

2026-07-01: Phase 83E-1 added clinical SaaS design tokens in `src/app/globals.css` and reusable primitives under `src/components/ui/` (`button`, `badge`/`OriginBadge`/`RiskBadge`, `card`, `field`, `tabs`, `segmented-control`, `dialog`, `sheet`, `data-table`, `timeline`, `app-shell`), backed by `tokens.ts`/`cn.ts` and `index.ts`. Emerald primary; clinical green/yellow/red reserved for message risk only; ≤8px radius; 44px touch targets; safe-area helpers. Targeted design-system unit test passed (6/6); primitives lint clean; production build passed. Next sub-phase is 83E-2.

## Phase 83D Gated PWA Mobile Install Center

2026-07-01: Phase 83D added `phase-83d-pwa-install-gate.ts`, `commercial-install-access.ts`, gated `/app-install` page, `pwa-subscriber-shell.tsx`, and `/api/commercial/mobile-install-audit`. Service worker caches shell/static only with network-only `/api/*`; SW registration is subscriber-only. Targeted Phase 83D unit tests passed (8/8); production build passed. Next sub-phase is 83E.

## Phase 83C Stripe Checkout And Billing Gate

2026-07-01: Phase 83C added sandbox-first Stripe integration with `phase-83c-stripe-billing-gate.ts`, `commercial-billing-store.ts`, and `/api/commercial/*` routes. Gate: `MANU_ALLOW_STRIPE_SANDBOX=true` and `sk_test_` keys only. Targeted Phase 83C unit tests passed (9/9); production build passed. Next sub-phase was 83D.

## Phase 83B Commercial Entitlement Model

2026-07-01: Phase 83B added migration `20260701120000_phase_83b_commercial_entitlement_model.sql` and `app/src/lib/phase-83b-commercial-entitlement-model.ts` with commercial invite/entitlement/billing/mobile-audit tables, invite normalization, hashed token matching, entitlement transitions, and dashboard access evaluation. Targeted Phase 83B unit tests passed (8/8). No Stripe integration. Production pilot remains `NO-GO`. Next sub-phase is 83C.

## Phase 83A Commercial PWA Scope Lock

2026-07-01: Phase 83A added `docs/PHASE_83_COMMERCIAL_PWA_AND_FRONTEND_RELAUNCH_SPEC.md` with immutable Phase 83 rules and sub-phases 83A-83H. Locked decisions: PWA-only mobile v1, invite + Stripe sandbox commercial gate, public intro with gated purchase/dashboard/install, full dashboard parity on one shared Next.js surface. No runtime behavior changed. Production pilot remains `NO-GO`. Next sub-phase is 83B.

## Phase 77AA-77AI Remediation Update

2026-06-28: mock channel adapter review findings were closed. Supabase rollback controls are persisted and loaded into webhook/simulation state, invalid WhatsApp timestamps no longer throw, mock delivery policy fields are type-aligned, full 100x50 replay runs only through `npm run rehearse:channel:replay`, and client anonymization/removal deletes Supabase channel delivery records.

Verified with targeted Phase 77 Vitest suites, `supabase-store` unit tests, `npm run lint`, `git diff --check`, and `npm run rehearse:channel:replay`. Repo-wide `npm test` exceeded the local 180s review timeout; `tsc --noEmit` remains blocked by pre-existing test type errors outside this remediation.

## Phase 78 Dependency/R-405 Update

2026-06-29: the Phase 22 stable dependency procedure was re-run. Stable `next@latest` is `16.2.9` and `eslint-config-next@latest` is `16.2.9`, but stable Next still bundles nested `postcss@8.4.31`. `npm audit --omit=dev --json` still reports only the known moderate R-405 `next`/`postcss` findings and the rejected semver-major `next@9.3.3` downgrade.

No dependency files were changed. R-405 and the `dependency_audit_clearance` launch gate remain open, and production pilot remains `NO-GO`.

Verified with `git diff --check` and `npm run release:verify`: core tests 225/225, app tests 428 passed and 2 skipped across 73 files, lint with two pre-existing warnings, production build, and only documented R-405 findings.

## Phase 79 Production-Scale Closure

2026-06-29: Phase 79A-79I completed production-scale runtime hardening, full 100x50 rehearsal closure, and post-review remediation. It added a real `/api/app-state?view=windowed` dashboard runtime while preserving legacy `/api/app-state`, fail-closed notification windows, scoped client create/patch responses without post-mutation broad reloads, bounded internal copilot loaders, lifecycle redaction evidence, current RLS evidence status, unified production-scale metrics, and the full acceptance command `npm run rehearse:production-scale:79g`.

Verified Phase 79I remediation with targeted Phase 79 tests (7 files, 65 passed, 2 skipped), full app tests (79 files, 489 passed, 4 skipped), `npm run lint` with two pre-existing warnings, `npm run build`, and `npm run rehearse:production-scale:79g`: expanded AI quality passed 5,000 cases with hard-zero counters at 0, full mock channel replay passed, Phase 79 full acceptance tests passed, and `npm run release:verify` passed with core tests 225/225, app tests 489 passed and 4 skipped across 79 files, production build, and only documented R-405 findings. Production pilot remains `NO-GO`; R-405 remains open; current RLS re-run is pending when local Supabase is unavailable.

## Phase 82G Verification Refresh

2026-06-30: Phase 82G added `app/src/lib/phase-82g-verification-refresh.ts` with `Phase82VerificationRefreshReport`. Phase 82 track closed across 82A-82G. Baseline verification status is `blocked` because current RLS is skipped/pending; `repoLocalClosureComplete` is `true`. Targeted Phase 82 tests passed (5 files, 31/31). Production pilot remains `NO-GO`.

## Phase 82F Continuity And Final Dossier Closure

2026-06-30: Phase 82G verification closed Phase 82 across 82A-82G as a fail-closed repo-local project-completion layer, not a production launch. Baseline final outcome is `NO_GO_EXTERNAL_PREREQUISITES_OPEN`; Phase 82G records `repoLocalClosureComplete: true` for the verification track while final completion remains blocked until external prerequisites close. `productionPilotGo` remains `false`; `productionPilotStarted` remains `false`. Targeted Phase 82 tests passed (5 files, 31/31); targeted Phase 80/81 regressions passed (7 files, 48/48); `npm run test:rls` skipped 20/20. All eight launch gates remain open; R-405 remains open; R-406 current post-76N/77AA-77AI/79/80/81/82 re-run remains pending. Production pilot remains `NO-GO`. No current Phase 82 sub-phase remains.

## Phase 82E Launch Activation Firewall Assertions

2026-06-30: Phase 82E added `app/src/lib/phase-82e-launch-activation-firewall.ts` with `Phase82LaunchActivationFirewallReport`. Egress env flags alone cannot bypass open launch gates; no synthetic ready path sets `productionPilotStarted=true`. Targeted Phase 82E tests passed (6/6). Production pilot remains `NO-GO`.

## Phase 82D Final Completion Report

2026-06-30: Phase 82D added `app/src/lib/phase-82d-final-completion-report.ts` with `Phase82FinalCompletionReport`, aggregating Phase 80/81 outputs, Phase 82 evidence ledger, and blocker reconciliation. Baseline returns `NO_GO_EXTERNAL_PREREQUISITES_OPEN`. Targeted Phase 82D tests passed (6/6). Production pilot remains `NO-GO`.

## Phase 82C R-405 / R-406 Final Blocker Reconciliation

2026-06-30: Phase 82C added `app/src/lib/phase-82c-blocker-reconciliation.ts` with `Phase82BlockerReconciliationReport`. Reuses Phase 80D and Phase 80E/81F evidence; no dependency files changed. Baseline records R-405 open and R-406 current rerun pending. Targeted Phase 82C tests passed (7/7). Production pilot remains `NO-GO`.

## Phase 82B External Evidence Gap Ledger

2026-06-30: Phase 82B added `app/src/lib/phase-82b-external-evidence-gap-ledger.ts` with `Phase82ExternalEvidenceGapLedger`. Baseline keeps all eight gates open with no external artifacts supplied. Targeted Phase 82B tests passed (8/8). Production pilot remains `NO-GO`.

## Phase 82A Final External Readiness Closure Scope Lock

2026-06-30: Phase 82A added `docs/PHASE_82_FINAL_EXTERNAL_READINESS_CLOSURE_SPEC.md` with immutable Phase 82 rules, Phase 81H entry baseline, and sub-phases 82A-82G. Expected baseline outcome is `NO_GO_EXTERNAL_PREREQUISITES_OPEN`. Production pilot remains `NO-GO`.

## Phase 81F/81G Remediation Closure

2026-06-30: Phase 81F verification refresh and Phase 81G hardening completed the Phase 81 track. Phase 81F records the refresh as `blocked` because current local RLS evidence is skipped/pending; Phase 81G now derives eligibility from the Phase 80 final report and cannot be driven by contradictory caller-supplied eligibility. Baseline final outcome remains `NO_GO_NOT_ELIGIBLE`; production pilot remains `NO-GO`; `productionPilotStarted` remains `false`. Verification passed with targeted Phase 81 tests (6 files, 46/46), `git diff --check`, lint with two pre-existing warnings, production build, `npm run test:rls` skipped 20/20, `npm run release:verify` core 225/225 and app 564 passed / 4 skipped across 89 files, and `npm run rehearse:production-scale:79g`.

## Phase 81G Final GO Readiness Report

2026-06-30: Phase 81G added `app/src/lib/phase-81g-go-readiness-report.ts` with `Phase81GoReadinessReport`. Baseline returns `NO_GO_NOT_ELIGIBLE`; eligible synthetic evidence returns `GO_READY_FOR_EXTERNAL_EXECUTION` with `productionPilotStarted: false`. After remediation it consumes Phase 81F verification refresh evidence and derives eligibility from the Phase 80 final report. Targeted Phase 81G tests passed (8/8). Production pilot remains `NO-GO`.

## Phase 81E Roster Qualification

2026-06-30: Phase 81E added `app/src/lib/phase-81e-roster-qualification.ts` with aggregate-only `Phase81RosterQualificationReport`. Baseline returns `blocked`; complete sanitized aggregate returns `qualified`. Targeted Phase 81E tests passed (10/10). `productionPilotGoReady` and `productionPilotStarted` remain `false`. Production pilot remains `NO-GO`.

## Phase 81D Environment Preflight

2026-06-30: Phase 81D added `app/src/lib/phase-81d-environment-preflight.ts` with dry-run `Phase81EnvironmentPreflightReport`. Baseline returns `blocked`; complete synthetic input returns `ready`. Egress flags cannot bypass gate evidence. Targeted Phase 81D tests passed (8/8). `productionPilotGoReady` and `productionPilotStarted` remain `false`. Production pilot remains `NO-GO`. Next sub-phase is Phase 81E.

## Phase 81C Launch Authorization Evidence

2026-06-30: Phase 81C added `app/src/lib/phase-81c-launch-authorization-evidence.ts` with `Phase81LaunchAuthorizationEvidence`. Baseline returns `no_authorization_supplied`; complete sanitized authorization returns `approved`. Targeted Phase 81C tests passed (9/9). Not a ninth launch gate. `productionPilotGoReady` and `productionPilotStarted` remain `false`. Production pilot remains `NO-GO`. Next sub-phase is Phase 81D.

## Phase 81B Phase 80 Eligibility Import

2026-06-30: Phase 81B added `app/src/lib/phase-81b-phase-80-eligibility.ts` with `Phase81EligibilityReport`, consuming the Phase 80F final report shape. Current baseline returns `NO_GO_NOT_ELIGIBLE`; synthetic eligible Phase 80 report returns `eligible_for_preflight`. Targeted Phase 81B tests passed (8/8). `productionPilotGoReady` and `productionPilotStarted` remain `false`. Production pilot remains `NO-GO`. Next sub-phase is Phase 81C.

## Phase 81A Direct Production Pilot GO Evaluation Scope Lock

2026-06-30: Phase 81A added `docs/PHASE_81_DIRECT_PRODUCTION_PILOT_GO_EVALUATION_SPEC.md` with immutable Phase 81 rules, Phase 80G entry baseline, and sub-phases 81A-81H. No runtime code, provider, channel, monitoring, secret-manager, or real-data changes. Expected Phase 81 baseline outcome remains `NO_GO_NOT_ELIGIBLE`; `phase81StartEligible` remains `false`; production pilot remains `NO-GO`. Next sub-phase is Phase 81B.

## Phase 80G R-405 Closure-Evidence Hardening

2026-06-30: Phase 80G hardened R-405 evaluation after Phase 80A-80F. Technical closure now requires a safe stable patch path, dependency-file update evidence, and clean production audit; unknown production audit findings block closure; formal R-405 acceptance requires complete external acceptance metadata. Targeted Phase 80 tests passed (4 files, 29 tests). `npm run release:verify` passed with core tests 225/225, app tests 518 passed and 4 skipped across 83 files, production build, and only documented R-405 findings. `npm run rehearse:production-scale:79g` passed. No dependency files changed; R-405 and `dependency_audit_clearance` remain open; production pilot remains `NO-GO`.

This is the first local SaaS/PWA prototype for MANU-AI.

It uses:

- Next.js 16
- TypeScript
- Tailwind CSS
- Supabase-backed API store for local persistence
- Supabase CLI installed as a project dev dependency
- Local file dependency on `../dietitian-ai-assistant`
- Dev fallback store when local Supabase env vars are missing

## Run

```bash
npm run dev
```

Open:

```text
http://localhost:3000/dashboard
```

If starting from the root page, use the demo sign-in button to enter `/dashboard`.

## Checks

```bash
npm run lint
npm test
npm run test:rls
npm run build
npm run release:verify
npm run rehearse:production-scale:79g
```

The scripts use `--webpack` because Turbopack did not resolve the local symlinked core package reliably.

`npm run release:verify` runs the core package tests, lint, unit/API tests, production build, and the production dependency audit gate. It cleans generated `.next` output before the production build so repeated local Windows/OneDrive runs do not fail on stale build artifacts. It allows only the documented R-405 Next.js/PostCSS finding and does not run `npm audit fix --force`.

Latest local Phase 82G verification refresh on 2026-06-30: targeted Phase 82 tests passed (5 files, 31 tests), targeted Phase 80 regression tests (4 files, 29 tests), targeted Phase 81 regression tests (3 files, 19 tests), `npm run release:verify` passed with core tests 225/225 and app tests 595 passed / 4 skipped across 94 files, `npm run test:rls` skipped 20/20, and `npm run rehearse:production-scale:79g` passed. Phase 82 track is closed; baseline outcome remains `NO_GO_EXTERNAL_PREREQUISITES_OPEN`; production pilot remains `NO-GO`; `productionPilotStarted` remains `false`; R-405 remains open; R-406 current re-run remains pending. Next work is external launch-gate/R-405/RLS closure prerequisites.

Phase 77Y closed continuity/pilot/gate docs and recorded hard-zero expanded rehearsal sample metrics plus clinical red-team closure. Phase 77Z is repository cleanup only. Phase 77A-77K manual source authority work remains complete locally.

Phase 29 is documentation/evidence hardening only. It keeps production pilot blocked, records that stable `next@latest` 16.2.6 still bundles `postcss@8.4.31`, and requires local Supabase before RLS evidence can be counted as passed.

Completion Roadmap Phase 2 was attempted on 2026-05-31. Local Supabase could not start because Docker Desktop's Linux engine pipe was unavailable, so `npm run test:rls` skipped 10 guarded tests. R-406 remains blocked until Docker/local Supabase is available and the expanded RLS suite passes locally.

Completion Roadmap Phase 3 rechecked R-405 on 2026-05-31. Stable `next@latest` remains `16.2.6` with nested `postcss@8.4.31`, `eslint-config-next@latest` remains `16.2.6`, and production audit still reports only the known moderate `next`/`postcss` findings. No dependency files should change until stable Next bundles `postcss >= 8.5.10` or formal external risk acceptance is supplied.

Completion Roadmap Phase 7 prepared the provider/vendor review packet on 2026-05-31. `docs/PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md` is review evidence only; it does not approve real Gemini/external LLM use, internal copilot provider egress, dietitian context update provider egress, provider credentials, or prompt/completion logging.

Completion Roadmap Phase 8 prepared the channel policy review packet on 2026-05-31. `docs/PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md` is review evidence only; it does not approve real WhatsApp/Telegram use, production webhooks, channel credentials, template registries, or outbound messaging.

Completion Roadmap Phase 9 prepared the incident and DSAR review packet on 2026-05-31. `docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md` is review evidence only; it does not approve production incident response, named production owners, monitoring/ticketing integrations, production DSAR/deletion operations, or real client health-data processing.

Completion Roadmap Phase 10 prepared the backup/restore review packet on 2026-05-31. `docs/PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md` is review evidence only; it does not approve production backup/restore operations, backup provider setup, storage, secret manager changes, restore-drill success, or real client health-data processing.

Completion Roadmap Phase 11 prepared the secret rotation review packet on 2026-05-31. `docs/PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md` is review evidence only; it does not approve production secret management, secret manager setup, real credential creation, credential rotation, or real provider/channel/infrastructure secrets.

Completion Roadmap Phase 12 prepared the dependency audit clearance packet on 2026-05-31. `docs/PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md` is review evidence only; it does not resolve or accept R-405. Stable `next@latest` remains `16.2.6` with nested `postcss@8.4.31`, so dependency files remain unchanged.

Completion Roadmap Phase 13 prepared the final readiness closure summary on 2026-05-31. `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md` records the current production-pilot decision as `NO-GO`: all eight launch gates remain open, R-405 remains open, and R-406 remains blocked.

## Supabase CLI

The Supabase CLI is installed locally as a dev dependency because global `npm install -g supabase` is not supported by Supabase. Use it from this folder with telemetry disabled:

```powershell
$env:SUPABASE_TELEMETRY_DISABLED='1'; npx supabase status
$env:SUPABASE_TELEMETRY_DISABLED='1'; npx supabase migration list --local
```

If a migration was manually applied to the local database and needs to be recorded in CLI history:

```powershell
$env:SUPABASE_TELEMETRY_DISABLED='1'; npx supabase migration repair --local --status applied <version>
```

## Current Scope

- Protected demo dashboard route
- Server-side auth resolution with controlled error states for no-membership and missing-dietitian-profile
- `/api/auth-state` endpoint for client-side auth state queries
- `NoMembershipState` and `NoDietitianProfileState` error UI components
- Membership badge showing authenticated user display name and role in dashboard header
- Auth error handling in `use-manu-state` with session error UI and sign-in redirect
- Channel permission governance: only `ready` allows AI; `pending`, `blocked`, and `opted_out` all block generation
- Identity quarantine: empty channelUserId and unknown adultStatus block AI
- Permission change auditing with previous/new values and distinct opt-out event type
- Mock WhatsApp/Telegram adapter contracts with identity quarantine and duplicate event idempotency (Phase 7)
- Deterministic mock AI provider with prompt/provider metadata and safe failure handling (Phase 8)
- Bounded PromptContext compilation, raw-text-free context manifests, missing-history fail-closed behavior, and stale draft invalidation (Phase 23)
- In-app notification center with `NotificationRecord` API backed by safe-text rules and Supabase persistence (Phase 9)
- Data governance skeleton with retention placeholders, client-scoped export, and client anonymization APIs (Phase 5)
- Client list and client detail controls
- AI active/passive controls
- Activation windows
- Persona and AI mode controls
- Detailed safety checklist for autopilot readiness
- Simulator risk assessment persistence
- Conversation timeline with message origin labels
- Draft approval, edit-send, and dismiss controls for AI-generated drafts
- Explicit human takeover release control with audit persistence
- Dietitian voice sample intake, approval/rejection, generated voice profile state, and `Voice` dashboard panel (Phase 24)
- Versioned dynamic client form schemas, response snapshots, prompt allowlist fields, and `Forms` dashboard panel (Phase 25)
- Multilingual language support for Turkish, English, German, French, Spanish, Portuguese, and Czech, including dietitian dashboard language, client communication language, client phone identity, form language metadata, localized mock replies, and localized safe handoff acknowledgements (Phase 43)
- Read-only internal dietitian `Copilot` tab and `/api/internal-copilot/messages` API using curated tenant-scoped local/mock tools with source refs (Phase 26)
- Dietitian-entered Critical Context panel and `/api/clients/[id]/context-updates` for phone, Zoom, in-person, or other non-chat client updates (Phase 27)
- Historical dietitian chat-to-form update proposals remain readable for audit/export/redaction, but Phase 77B blocks create/apply and removes dashboard propose/apply controls; manual form and food-rule edits use dashboard panels (Phase 76A deprecated by 77B)
- Expanded chat form/safety updates for pregnancy, adult/minor status, diagnosis, medication/insulin, lab, symptom, and eating-disorder form flags while keeping AI/channel/lock controls manual (Phase 76B)
- AI security remediation with provider-attempt audit semantics, PromptContext source metadata, send-time draft revalidation, provider segment allowlist, tenant-aware channel/idempotency uniqueness, and scoped RLS/RBAC helper policies (Phase 28)
- Inbound simulator wired to `handleInboundMessage`
- Handoff queue
- PWA manifest and service worker
- Supabase migration under `supabase/migrations`
- API-backed app state endpoints
- Supabase-backed API store when local Supabase env vars are configured
- Dev fallback store when local Supabase credentials are not configured
- Forceable dev fallback mode with `MANU_DEV_FALLBACK_STORE=true`
- Supabase Auth-backed demo session when local Supabase credentials are configured
- Playwright dashboard visual smoke checks for core flows and responsive overflow

No real WhatsApp, Telegram, Gemini, external model provider, production client-messaging email, push, monitoring, analytics, secret manager, or real client health data is connected yet. The hosted sandbox now uses cloud Supabase plus Resend custom SMTP only for commercial auth/onboarding verification.

## Local Supabase Foundation

Local Supabase config lives in `supabase/config.toml`.

Use `.env.local.example` as the starting point for local credentials.

When `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are set, API routes use `src/lib/supabase-store.ts` and auto-seed demo data. When they are missing, the same routes use the in-memory dev fallback store.

Verified local runtime on 2026-05-23:

- Local Supabase project `manu-ai-local` starts successfully.
- Local migrations apply successfully.
- `.env.local` was created with local Supabase credentials.
- Dashboard: `http://localhost:3000/dashboard`
- `/api/auth-state` returns user auth/membership/profile state.
- `/api/clients/[id]/export` returns a tenant/client-scoped export bundle.
- `/api/clients/[id]/anonymize` clears promptable client context and rolling memory while preserving minimized audit evidence.
- Supabase API: `http://127.0.0.1:54321`
- Supabase Studio: `http://127.0.0.1:54323`
- `/api/app-state` loads seeded data from Supabase.
- `/api/simulator` and `/api/messages/manual` persist to Supabase.
- `npm run lint`, `npm test`, and `npm run build` pass.

Note: Codex in-app browser could not open localhost because of its own URL policy. Use the Windows/default browser for local visual checks.

Supabase Auth session handling and tenant membership resolution are now wired for the local demo user.

When Supabase is configured:

- The demo sign-in creates or reuses `demo@manu.local`.
- `MANU_DEMO_PASSWORD` can override the local demo password.
- The demo user is linked to the seeded demo tenant through `tenant_memberships`.
- `/dashboard` requires an authenticated Supabase session.
- Supabase-backed API routes return `401` without a session and `403` without tenant membership.
- `npm run test:rls` verifies tenant-member reads, membership-less reads, cross-tenant write blocking, scoped assistant/viewer/care-team/auditor behavior, internal copilot scoping, and tenant-aware channel/idempotency uniqueness against local Supabase when env vars are configured.
- `npm run test:rls` also verifies auxiliary RLS policies, Telegram simulator idempotency channel persistence, and Supabase-backed AI control audit events.
- `npm run test:rls` runs only against local Supabase unless `MANU_ALLOW_REMOTE_RLS_TESTS=true` is set.
- AI draft approve/edit-send/dismiss actions persist through `/api/messages/drafts/[id]`.
- Human takeover release persists through `/api/clients/[id]/release-takeover` and records `human_takeover_released`.
- Autopilot safety gating now uses the detailed `safetyChecklist` fields and reports missing checklist keys in simulator decisions.
- Simulator inbound messages persist `risk_assessments`; duplicate simulator idempotency keys do not duplicate those records.
- Supabase-backed red handoffs persist safe-text notification records.
- `/api/notifications/[id]/read` and `/api/notifications/[id]/acknowledge` persist read/acknowledged state when Supabase is configured.

## Visual Smoke Checks

The visual smoke test uses Chromium and fallback mode:

```powershell
npx playwright install chromium
npm run test:visual
```

`npm run test:visual` runs `npm run build` first and then checks the dashboard on desktop, tablet, and mobile viewports. Coverage includes dashboard navigation, client list, conversation view, simulator flow, draft controls, manual long replies, red handoff, safety-checklist blocking, handoff queue visibility, and horizontal overflow guards.

## Current Commercial Sandbox Deployment - 2026-07-02

The app has been deployed to a Hetzner VPS for sandbox validation:

- Public URL: `https://siriusai.store`
- Runtime: Next.js production build, PM2, Nginx, Let's Encrypt HTTPS
- Stripe: test/sandbox only
- Stripe test webhook: `https://siriusai.store/api/commercial/webhook`
- Commercial admin health: ready when Supabase/env/migrations are reachable
- Latest frontend sandbox release: `phase85-stage3-redesign-20260707225306`
- Latest frontend verification: `/`, `/login`, `/purchase`, `/purchase/success`, `/app-install`, and `https://admin.siriusai.store` returned 200; live computed styles confirmed paper `oklch(0.985 0.003 85)` and primary purple `oklch(0.41 0.14 310)`.

Observed successful test payment path: invite was consumed, tenant was provisioned, active entitlement was created, and `checkout.session.completed` plus `invoice.paid` were written to the billing ledger.

Phase 84D-84J later closed the hosted sandbox onboarding/email path with magic-link login, post-payment tenant claim, `tenant_memberships` creation, `dietitians` profile creation, admin subdomain support, and custom SMTP verification. Production pilot remains `NO-GO`. See `../docs/PHASE_84_COMMERCIAL_SAAS_RELAUNCH_AND_ONBOARDING_SPEC.md`.
