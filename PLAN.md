# MANU-AI Plan

**Current authority (2026-07-14):** Stage 4B-3 remediation R0–R3 are complete locally; R4 is next; Stage 4C is blocked. Active plan: `docs/PHASE_85_STAGE_4B_3_POST_CLOSURE_REMEDIATION_ACTION_PLAN.md`. R3 evidence: `docs/PHASE_85_STAGE_4B_3_POST_CLOSURE_REMEDIATION_R3_EVIDENCE.md`. Production remains `NO-GO`; R-405 remains open.

Current continuity status, 2026-07-14: Stage 4B-2 R0-R7 and advisory hardening are closed locally, Stage 4B-3 Phases 0–12 are closed locally, and code/document routing is reconciled. Canonical spec: `docs/PHASE_85_STAGE_4B_3_MULTIMODAL_GORSEL_GUVENLIK_SPEC.md`. **Next:** Stage 4C plan/read gate. Production remains `NO-GO`; R-405 remains open.

## Project Summary

MANU-AI is a supervised AI messaging assistant for dietitians. It helps dietitians answer routine client messages over WhatsApp and Telegram, while preserving strict client isolation and escalating risky nutrition or health messages to the dietitian.

The product must be both:

- A web dashboard for full management.
- A mobile-installable app experience, starting as a PWA and later becoming native iOS/Android if the pilot validates it.

The current implementation is an architecture/core package, not yet the full SaaS app.

## Latest Phase 85 Roadmap Restructure

On 2026-07-08, Phase 85 was restructured into this explicit stage ladder: Stage 1 design system foundation, Stage 2 full component system, Stage 3 public/commercial entry surfaces, Stage 4A Danisan Kontrol Paneli Mimari ve Hizmet Akisi Plani, Stage 4B Uyari ve Bildirimler, mandatory Stage 4B-2 Mesajlasma, Stage 4C Diyetisyen Icin AI Chat, Stage 4D Ayarlar / Hesap, Stage 5 Dashboard and Mobile PWA Shell, Stage 6 Dashboard Core Workflows, and Stage 7 Visual QA/Polish/Accessibility/Closure. Stages 1-3 and Stage 4A are complete. On 2026-07-10, `P85-IF` was inserted as a mandatory cross-cutting foundation program between Stage 4A and Stage 4B. P85-IF does not replace or complete Phase 85; after P85-IF-A through P85-IF-I close, execution returns to Stage 4B. The 2026-07-11 P85-IF post-closure audit passed local RLS 30/30 and full verification. Production pilot remains `NO-GO`; R-405 remains open.

## Phase 85 Interstage Foundation - P85-IF

Stage 4B-2 security advisory RLS hardening on 2026-07-13 closes the separate local Supabase advisory for RLS-disabled `public.conversation_mutation_idempotency` and `public.personas`. Append-only migration `20260713030000_phase_85_stage_4b2_security_advisory_rls_hardening.sql` enables RLS on both tables, removes direct `anon`/`authenticated` grants, adds no direct-user policies, and preserves service-role mediated internal behavior. Evidence: `docs/PHASE_85_STAGE_4B_2_SECURITY_ADVISORY_RLS_HARDENING_EVIDENCE.md`. Stage 4B-2 R0-R7 remain closed locally; Stage 4B-3 remains next. Production pilot remains `NO-GO`; R-405 remains open.

Stage 4B-2 local RLS re-closure on 2026-07-13 supersedes the prior Docker-blocked RLS note for the current local suite. Local Supabase reset passed, `npm run test:rls` passed 35/35 with 0 skipped, targeted `supabase-store`/`client-forms` tests passed 9/9, and `git diff --check` passed. Evidence: `docs/PHASE_85_STAGE_4B_2_RLS_LOCAL_RECLOSURE_EVIDENCE.md`. This does not approve production pilot, close R-405, enable real provider/channel paths, or claim SQL buffer/EXPLAIN closure.

The canonical planning baseline is `docs/PHASE_85_INTERSTAGE_TRUSTED_CLINICAL_COMMUNICATION_MEMORY_PLAN.md`. P85-IF-A through P85-IF-I are complete and P85-IF is closed. Evidence: `docs/PHASE_85_IF_I_LIFECYCLE_CLOSURE_EVIDENCE.md`. Runtime provider/channel behavior remains closed. **Stage 4B Uyari ve Bildirimler is complete (2026-07-12).** Evidence: `docs/PHASE_85_STAGE_4B_UYARI_VE_BILDIRIMLER_EVIDENCE.md`. **Stage 4B-2 Mesajlasma and post-closure remediation R0-R7 are complete locally (2026-07-13).** Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R7_EVIDENCE.md`. **Stage 4B-3 Phase 8 orchestration, atomic decision commit, and correction workflow is complete locally (2026-07-14).** Evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_8_ORCHESTRATION_ATOMIC_DECISION_EVIDENCE.md`. **Stage 4B-3 Phase 7 visual risk overlay, intent, answerability, narrow autopilot, and output guard integration is complete locally (2026-07-14).** Evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_7_VISUAL_RISK_INTENT_AUTOPILOT_EVIDENCE.md`. **Stage 4B-3 Phase 6 multimodal understanding and source authority is complete locally (2026-07-14).** Evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_6_MULTIMODAL_UNDERSTANDING_EVIDENCE.md`. **Stage 4B-3 Phase 5 deterministic local vision provider is complete locally (2026-07-14).** Evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_5_DETERMINISTIC_VISION_PROVIDER_EVIDENCE.md`. **Stage 4B-3 Phase 4 bundle correlation and silence queue is complete locally (2026-07-13).** Evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_4_BUNDLE_SILENCE_QUEUE_EVIDENCE.md`. **Stage 4B-3 Phase 3 secure visual ingress and file admission is complete locally (2026-07-13).** Evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_3_SECURE_VISUAL_INGRESS_EVIDENCE.md`. **Stage 4B-3 Phase 2 database/storage/RLS foundation is complete locally (2026-07-13).** Evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_2_DATABASE_STORAGE_RLS_EVIDENCE.md`. **Next operator action:** Stage 4B-3 Phase 8. Production pilot remains `NO-GO`; R-405 remains open.

P85-IF post-closure audit verification on 2026-07-11: R1 message provenance tenant integrity, R2 structured baseline/resolution authority, R3 activation/inbound lock ordering, and R6 runtime export leak enforcement are fixed. Evidence: `docs/PHASE_85_IF_REMEDIATION_POST_CLOSURE_AUDIT_EVIDENCE.md`, `docs/PHASE_85_IF_R1_PERSISTENCE_TENANT_INTEGRITY_EVIDENCE.md`, `docs/PHASE_85_IF_R2_RETRIEVAL_AUTHORITY_TEMPORAL_EVIDENCE.md`, and `docs/PHASE_85_IF_R3_ATOMIC_AI_ACTIVATION_RACE_EVIDENCE.md`. Verification passed targeted app/core tests, local Supabase reset, local RLS 30/30, lint, build, full app 828 passed / 4 skipped, core 234/234, channel replay, and production-scale rehearsal. Production pilot remains `NO-GO`; R-405 remains open.

Stage 4A post-P85-IF remediation on 2026-07-11: `P85-4A-POST-IF-R` aligns the completed Stage 4A dashboard with the newer P85-IF/R1-R6 contracts before Stage 4B begins. AI activation in the Stage 4A control panel now uses atomic activation with expected conversation/client context revisions, human-takeover release uses the dedicated release endpoint, active human-control session evidence is visible, structured context-intake flags render as readable panel links, and structured-update notifications have a minimal target-panel navigation/resolution bridge. Evidence: `docs/PHASE_85_STAGE_4A_POST_IF_REMEDIATION_EVIDENCE.md`. Production pilot remains `NO-GO`; R-405 remains open; Stage 4B remains next.

P85-IF-I/R6 remediation verification on 2026-07-11: lifecycle re-closure now persists P85-IF-I redaction to Supabase through append-only migration `20260710230000_phase_85_if_remediation_lifecycle_reclosure.sql`; tenant channel-binding revoke is owner/admin API + service-role RPC backed and disables tenant channel automation rollback; client export leak detection keeps tenant account/actor bindings and operational markers out of export; and `evaluateP85IfIProgramClosureEvidence` can no longer pass without explicit full verification inputs. Evidence: `docs/PHASE_85_IF_R6_LIFECYCLE_RLS_RE_CLOSURE_EVIDENCE.md`. Verification passed: targeted lifecycle 14/14, local Supabase reset, local RLS 28/28, lint, production build, full app 825 passed / 4 skipped, channel replay, production-scale rehearsal, `git diff --check`, secret scan, and forbidden future-phase naming scan. Production pilot remains `NO-GO`; R-405 remains open.

P85-IF-H/R5 remediation verification on 2026-07-10: operational trust/quarantine inspection is removed from common app-state and exposed only through `GET /api/operational-foundation` with the owner/admin-only `read_operational_foundation` capability. Append-only migration `20260710220000_phase_85_if_remediation_operational_access_boundaries.sql` restricts select RLS for `channel_account_bindings`, `channel_actor_bindings`, `channel_events`, and `inbound_quarantines` to owner/admin while preserving dietitian access to message provenance, human-control, risk activity, and context-intake workflow records. Evidence: `docs/PHASE_85_IF_R5_OPERATIONAL_ACCESS_BOUNDARIES_EVIDENCE.md`. Verification passed: local Supabase `db reset --local`, targeted P85-IF-H/supabase-store 11/11, and local `npm run test:rls` 26/26. Production pilot remains `NO-GO`; R-405 remains open.

P85-IF-G/R4 remediation verification on 2026-07-10: context-intake proposal confirm/recheck/apply/reject Supabase mutations now use service-role-only atomic RPC `p85_if_r4_mutate_context_intake_proposal` from append-only migration `20260710210000_phase_85_if_remediation_client_safe_context_intake.sql`. Wrong-client or missing proposals return `404`; stale/expired/non-mutable proposal states return `409`; structured-impact proposals still require panel revision evidence and two confirmations; apply creates only `client_context_updates`, increments client context revision, marks the proposal applied, writes audit evidence, and invalidates drafts transactionally. Evidence: `docs/PHASE_85_IF_R4_CONTEXT_INTAKE_REMEDIATION_EVIDENCE.md`. Verification passed: local Supabase `db reset --local`, targeted P85-IF-G 11/11, and local `npm run test:rls` 25/25. Production pilot remains `NO-GO`; R-405 remains open.

P85-IF-A verification on 2026-07-10: core `npm test` 225/225, app `npm test` 734 passed / 4 skipped, app lint 0 errors with 3 pre-existing warnings, app build passed, `git diff --check` clean, new-spec secret scan clean, and forbidden future-phase naming scan clean. Visual, channel replay, production-scale, and RLS tests were not required because no runtime, UI, channel, schema, or RLS behavior changed.

P85-IF-B verification on 2026-07-10: targeted provenance/migration contract Vitest passed 6/6, app `npm test` passed 740 / 4 skipped, core `npm test` passed 225/225, app lint had 0 errors with 3 pre-existing warnings, app build passed, and `npm run test:rls` skipped 21/21 because local Supabase was unavailable. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending.

P85-IF-C added and post-commit audited the secure ingress, ledger, routing, and quarantine engine. The remediation fixes business-echo/history counterparty resolution, strict multi-identifier account and tenant/client/conversation/actor assignment checks, account-scoped quarantine evidence, explicitly authorized idempotent replay that completes the existing client inbound path, canonical provider/actor provenance on stored inbound messages, invalid provider-time audit flags, and duplicate-ID/digest conflict detection. P85-IF-D later wired routed transcript and human-control side effects. Verification on 2026-07-10 for P85-IF-C: targeted P85-IF-C Vitest 40/40. P85-IF-D verification on 2026-07-10: targeted 7/7 plus updated ledger 11/11, full app 787 passed / 4 skipped, core 225/225, lint 0 errors with 3 unchanged warnings, production build passed, and full mock channel replay passed. R-406 current environment re-run remains pending. Production pilot remains `NO-GO`; R-405 remains open. P85-IF-E is next.

P85-IF-I verification on 2026-07-10: targeted `phase-85-if-i-lifecycle-closure.test.ts` and updated `phase-79e-lifecycle-redaction-evidence.test.ts` 12/12, app `npm test` 818 passed / 4 skipped, app lint 0 errors with 3 pre-existing warnings, app build passed, `npm run release:verify` passed, `npm run rehearse:channel:replay` passed, `npm run rehearse:production-scale:79g` passed, and `git diff --check` clean apart from CRLF warnings. The 2026-07-11 post-closure audit supersedes the earlier skipped local RLS note with local RLS 30/30 and full verification. Production pilot remains `NO-GO`; R-405 remains open. P85-IF is closed; Stage 4B is next.

P85-IF-H verification on 2026-07-10: targeted `phase-85-if-h-operational-visibility.test.ts` 5/5, app `npm test` 812 passed / 4 skipped, app lint 0 errors with 3 pre-existing warnings, app build passed. Minimal provenance badges, human-control banner with direct AI activation, channel-trust aggregate counters, owner/admin inspection tables, structured source-message links, and seven-language strings are implemented. `npm run test:rls` was not re-run; R-406 current re-run remains pending. Production pilot remains `NO-GO`; R-405 remains open. P85-IF-I followed and is complete.

P85-IF-G verification on 2026-07-10: targeted `phase-85-if-g-context-intake.test.ts` 9/9, app `npm test` 807 passed / 4 skipped, app lint 0 errors with 3 pre-existing warnings, app build passed. `npm run test:rls` was not re-run; R-406 current re-run remains pending. Production pilot remains `NO-GO`; R-405 remains open. P85-IF-H is complete.

P85-IF-F/R3 remediation verification on 2026-07-10: activation now requires `expectedConversationRevision` and `expectedClientContextRevision`, direct `PATCH /api/clients/[id]` active toggles are rejected, and append-only migration `20260710200000_phase_85_if_remediation_atomic_activation.sql` adds service-role-only atomic activation plus inbound/draft expected-conversation revision guards. Verification passed: local Supabase `db reset --local`, targeted R3/historical tests 12/12, `npm run test:rls` 24/24, app lint 0 errors with 2 unchanged warnings, app build passed, `git diff --check` clean apart from CRLF warnings, secret scan clean, and forbidden future-phase naming scan clean. Production pilot remains `NO-GO`; R-405 remains open.

## Latest Phase 85 Stage 4A Danisan Kontrol Paneli

On 2026-07-08, Phase 85 Stage 4A.4 implemented the **AI Asistan Kontrolu** panel with persona, status/mode, activation window, safety checklist, autopilot readiness gate, lock status, and preflight blockers. Added `ai-assistant-control-panel.tsx` and `ai-assistant-control-panel-helpers.ts`; updated `clients-panel.tsx`. Verification: lint 0 errors (3 pre-existing warnings), helper tests 4/4, full app suite 734 passed / 4 skipped, build passed, Playwright visual 36/36. Stage 4A Danisan Kontrol Paneli (Stage 4A.1-4A.4) is complete. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending.

On 2026-07-08, Phase 85 Stage 4A.3 implemented the **Menu** workflow panel with four template picker cards, Turkish template labels/descriptions, plan status badges, conflict display, activation hard-block on severe conflicts, and integrated MANU-only DOCX/PDF export when eligible. Added `menu-workflow-panel.tsx`, `menu-workflow-export-section.tsx`, and `menu-workflow-panel-helpers.ts`; upgraded `menu-plan-panel.tsx`. Verification: lint 0 errors (3 pre-existing warnings), helper tests 4/4, full app suite 730 passed / 4 skipped, build passed, Playwright visual 36/36. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending.

On 2026-07-08, Phase 85 Stage 4A.2 implemented the **Aktif Beslenme Plani** workspace with Phase 77D catalog tree browsing, quick search, conflict review, and existing food-rule profile save path. Added `catalog-tree-browser.tsx`, `active-nutrition-plan-panel.tsx`, and `active-nutrition-plan-helpers.ts`; upgraded `food-rules-panel.tsx`. Verification: lint 0 errors (3 pre-existing warnings), helper tests 5/5, full app suite 726 passed / 4 skipped, build passed, Playwright visual 36/36. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending.

On 2026-07-08, Phase 85 Stage 4A.1 implemented the full Phase 77C client form editor inside the danisan kontrol paneli.

On 2026-07-08, Phase 85 Stage 4A added `docs/PHASE_85_STAGE_4A_DANISAN_KONTROL_PANELI_MIMARI_VE_HIZMET_AKISI_PLANI.md` after code-level review of the dashboard client panel, Phase 77C client form, Phase 77D/77E catalog and food-rule profile, Phase 77F/77J menu/export flow, and AI activation/preflight contracts. The danisan kontrol paneli is planned as four large user-approved implementation phases: Stage 4A.1 Danisan Formu Paneli, Stage 4A.2 Aktif Beslenme Plani, Stage 4A.3 Menu, and Stage 4A.4 AI Asistan Kontrolu.

## Latest Phase 85A Frontend Redesign Scope Lock

On 2026-07-07, Phase 85A created the canonical SiriusAI frontend redesign and design-system spec in `docs/PHASE_85_FRONTEND_REDESIGN_AND_DESIGN_SYSTEM_SPEC.md`. The user-approved direction is warm clinical SaaS: keep `SiriusAI`, rebuild the design system first, then the public website/onboarding surfaces, then the dashboard/PWA. Locked design decisions: editorial off-black + plum + sage + warm accent palette, Fraunces display headings, Geist Sans UI text, editorial/spacious public surfaces, compact/scannable dashboard surfaces, 6-8px control radius, restrained borders/shadows, no nested card-heavy UI, no abstract AI/gradient-orb direction, and no reuse of the previous visual style as a reference. Documentation-only; no runtime frontend code changed. Production pilot remains `NO-GO`; R-405 remains open; R-406 current post-83/84 local Supabase/RLS re-run remains pending.

## Latest Phase 85B Design Tokens And Font Foundation

On 2026-07-07, Phase 85B implemented the approved foundation without full page redesign: Fraunces display is loaded beside Geist Sans/Mono, Phase 85 CSS/Tailwind tokens are exposed in `globals.css`, global focus/selection/skip-link foundation uses plum tokens, `.font-display` is available for future editorial headings, and UI token tests now assert the approved palette. Component foundation, public website redesign, and dashboard/PWA redesign remain pending for later user-approved sub-phases. Production pilot remains `NO-GO`; R-405 remains open; R-406 current post-83/84 local Supabase/RLS re-run remains pending.

## Latest Phase 85 Stage 2 Shared Component System

On 2026-07-07, Phase 85 Stage 2 implemented the shared UI component foundation: `plum`, `sage`, and `warm` tones are available; legacy `emerald`/`amber` primitive calls map to the new accents; form, card, tabs, segmented-control, table, dialog, sheet, app-shell, alert, empty-state, and loading primitives now follow the approved palette. Public/commercial page redesign was completed in Stage 3 and Stage 4A is complete. The current execution order is P85-IF, then Stage 4B, mandatory Stage 4B-2 Mesajlasma, Stage 4C, Stage 4D, Stage 5, Stage 6, and Stage 7. Production pilot remains `NO-GO`; R-405 remains open; R-406 current post-83/84 local Supabase/RLS re-run remains pending.

## Latest Phase 85 Stage 3 Public/Commercial Integration

On 2026-07-07, Phase 85 Stage 3 was implemented from `docs/PHASE_85_STAGE_3_PUBLIC_COMMERCIAL_ENTRY_ACTION_PLAN.md` and the user-provided `public-website-redesign.zip` visual direction. The runtime now follows the invite-led commercial model across the public and commercial entry surfaces: access request, team/admin review, admin invite code, approved email + invite code, sandbox checkout, magic-link login, onboarding claim, then dashboard/PWA. The locked navbar is `SiriusAI | Nasil calisir | Guvenlik | Mobil | Iletisim | Giris yap | Davet koduyla basla`. The integration did not copy mock API routes from the zip and did not change API, auth, entitlement, onboarding, billing, launch-gate, R-405, R-406, provider/channel, or real-data paths. The color system was corrected to match the user-provided design: very light broken-white paper `oklch(0.985 0.003 85)`, purple primary `oklch(0.41 0.14 310)`, and purple hover `oklch(0.37 0.14 310)`.

Hosted sandbox deployment on 2026-07-07: release `phase85-stage3-redesign-20260707225306` was built on the Hetzner VPS and served through PM2/Nginx at `https://siriusai.store`. Verification returned 200 for `/`, `/login`, `/purchase`, `/purchase/success`, `/app-install`, and `https://admin.siriusai.store`; browser computed-color verification on the live domain confirmed the paper and purple primary tokens. This deployment is sandbox/frontend validation only. Stripe remains test mode; production pilot remains `NO-GO`.

## Latest Phase 84J Custom SMTP And Real Email Verification

On 2026-07-03, Phase 84J completed custom SMTP and real email verification for the hosted sandbox. Resend sending domain was verified through Porkbun DNS, Supabase Auth custom SMTP was enabled with Resend, live `/api/auth/magic-link` returned `sent: true`, and the real inbox magic-link click reached `https://siriusai.store/dashboard`. Real email links used Supabase implicit-flow fragment tokens, so Phase 84J added `/api/auth/session-from-fragment` plus a no-store `/auth/callback` fragment bridge to convert fragment tokens into SSR cookies. Verification: targeted auth/session tests 7/7; auth/onboarding targeted tests 19/19 before the final refresh-token guard adjustment; local production build passed; VPS production build passed and PM2 restarted online. R-425 is mitigated in the hosted sandbox path. Production pilot remains `NO-GO`; R-405, current RLS re-run, external approvals, and production launch gates remain open.

## Latest Phase 84I Live Onboarding Verification

On 2026-07-03, Phase 84I remediation addressed the review gaps before VPS closure: `/auth/callback` preserves Supabase session cookies on the final redirect, supports Supabase token-hash OTP callbacks, admin magic links use the admin callback base URL contract (`MANU_ADMIN_APP_URL` with local fallback), admin-host routing covers non-static paths, and onboarding claim recovers same-tenant duplicate `dietitians.auth_user_id` conflicts idempotently. Verification: auth/onboarding targeted tests 16/16 and build passed after token-hash remediation; earlier Phase 84/remediation targeted tests 41/41, visual tests 36/36, and `npm run release:verify` core 225/225 + app 709 passed / 4 skipped remain the local baseline. VPS sandbox onboarding/dashboard verification is complete through generated token-hash fallback. Phase 84J later completed real custom-SMTP email delivery verification. `npm run test:rls` skipped 21/21, so current RLS re-run remains pending. Production pilot remains `NO-GO`.

## Latest Phase 84H QA, Docs, Deployment, Evidence

On 2026-07-03, Phase 84H added `phase-84h-verification-refresh.ts` with eight locked QA scenarios, `commercial-saas.visual.spec.ts` for login/admin/purchase-success/contact/onboarding surfaces, and continuity evidence updates. Repo-local verification: Phase 84 targeted tests 36/36, 84H tests 5/5, visual tests 36/36, lint 0 errors (2 pre-existing warnings), build passed. This Phase 84H VPS-pending status is superseded by Phase 84I live generated token-hash onboarding/dashboard verification and Phase 84J real custom-SMTP email dashboard verification. Production pilot remains `NO-GO`.

## Latest Phase 84G Subscription Operations Hardening

On 2026-07-03, Phase 84G hardened subscription operations: separate **Erişimi kapat** (entitlement `revoked`) vs **Stripe aboneliğini iptal et** (sandbox `cancelSubscription` via new admin API), extended admin audit events and actor threading, and added defensive Turkish UX for purchase/onboarding/admin edge states (consumed invite, pending webhook, past due, canceled, revoked). Stripe sandbox-only guard preserved. Verification: Phase 84G tests 4/4; 83C/83F regression 25/25; build passed. Next sub-phase is 84H. Production pilot remains `NO-GO`.

## Latest Phase 84F Admin Subdomain And Professional Admin Console

On 2026-07-03, Phase 84F added `/admin` with Supabase magic-link allowlist auth (`MANU_ADMIN_EMAIL_ALLOWLIST`, default `olkuenver@gmail.com`), dual-auth commercial admin APIs (`evaluateCommercialAdminAccess`), audit trail (`GET /api/commercial/admin/audit`), admin host rewrite in `proxy.ts`, `/commercial-admin` redirect, and emergency token panel at `/commercial-admin/emergency`. Console sections: overview metrics, leads, invites, subscriptions, ledger, health, audit. VPS still needs DNS/Nginx/SSL for `admin.siriusai.store`. Verification: Phase 84F tests 4/4 + access 2/2; full suite 695 passed / 4 skipped; build passed. Next sub-phase is 84G. Production pilot remains `NO-GO`.

## Latest Phase 84E Post-Payment Customer Onboarding

On 2026-07-02, Phase 84E added post-payment onboarding claim: `commercial_onboarding_events` migration, `phase-84e-customer-onboarding.ts`, `commercial-onboarding-store.ts`, `GET /api/commercial/onboarding/status`, `POST /api/commercial/onboarding/claim`, purchase success account CTA, and `/onboarding` claim panel. Claim is idempotent: creates `tenant_memberships` owner row and `dietitians` profile (`Europe/Istanbul`, `tr`) without demo client seeding; audits `magic_link_requested`, `claim_completed`, `claim_blocked`. Verification: Phase 84E tests 5/5; Phase 84D regression 7/7; lint with two pre-existing warnings; build passed. The local-only R-425 status is superseded by Phase 84I live generated token-hash onboarding/dashboard verification and Phase 84J real custom-SMTP email dashboard verification. Production pilot remains `NO-GO`.

## Latest Phase 84D Customer Auth Foundation

On 2026-07-02, Phase 84D added Supabase magic-link customer auth: `/login` with `customer-login-form.tsx`, `POST /api/auth/magic-link`, `/auth/callback` session exchange, and `/onboarding` placeholder routing. Added `phase-84d-customer-auth.ts`, `customer-auth-store.ts`, `customer-auth-session.ts`, safe post-auth redirects (dashboard / onboarding / support), registered-customer email gate, rate limiting (`auth_magic_link`), and dashboard/proxy redirects to `/login`. Verification: Phase 84D tests 7/7; Phase 84B regression 4/4; lint with two pre-existing warnings; build passed. This pre-claim R-425 status is superseded by Phase 84E/84I/84J. Production pilot remains `NO-GO`.

## Latest Phase 84C Lead And Contact Flow

On 2026-07-02, Phase 84C added `commercial_leads` storage, public `POST /api/contact/leads`, and token-protected admin lead list/status APIs at `/api/commercial/admin/leads`. Added `phase-84c-contact-leads.ts`, `commercial-leads-store.ts`, `contact-lead-form.tsx`, migration `20260702120000_phase_84c_commercial_leads.sql`, RLS fail-closed (service-role API only), honeypot spam handling, rate limiting (`commercial_contact_leads`), and wired the marketing contact form with mailto fallback. Commercial admin console lists leads with status updates (`new`, `contacted`, `closed`). Verification: Phase 84C tests 5/5; Phase 84B regression 4/4; lint with two pre-existing warnings; build passed. Next sub-phase is 84D. Production pilot remains `NO-GO`.

## Latest Phase 84B Professional Public Website

On 2026-07-02, Phase 84B rebuilt the public landing as a professional SiriusAI marketing homepage with hero, safety, workflow, PWA, governance, invite-only onboarding, and contact sections. Demo login was removed from the primary hero and gated behind `MANU_ALLOW_PUBLIC_DEMO_LOGIN` at `/demo` and `/api/demo-login`. Added `/login` placeholder and aligned contact email to `olkuenver@gmail.com`. Verification: Phase 84B tests 4/4, purchase UX regression 8/8, lint with two pre-existing warnings, build passed. Next sub-phase is 84C. Production pilot remains `NO-GO`.

## Latest Phase 84A PRD, Spec, And Architecture Freeze

On 2026-07-02, Phase 84A froze the canonical commercial SaaS relaunch spec in `docs/PHASE_84_COMMERCIAL_SAAS_RELAUNCH_AND_ONBOARDING_SPEC.md`. It records sanitized VPS payment-webhook evidence (invite consumed, tenant provisioned, active entitlement, billing ledger entries), locks the three-surface architecture (public marketing, customer product, admin on `admin.siriusai.store`), and documented the original R-425 onboarding gap without storing secrets. That gap is superseded by Phase 84D-84J hosted sandbox verification.

Documentation-only; no live Stripe, provider/channel, or production GO change. Production pilot remains `NO-GO`; R-405 remains open; R-406 current post-83 local Supabase/RLS re-run remains pending when local Supabase is unavailable.

## Latest Phase 83F Hosted Supabase Recovery Diagnostics

On 2026-07-02, Phase 83F gained protected hosted Supabase recovery diagnostics for the commercial admin panel. Added `/api/commercial/admin/health`, sanitized store-env/probe classification in `phase-83f-commercial-admin.ts`, and `/commercial-admin` UI guidance for unreachable Supabase project hosts, missing commercial migrations, invalid service-role keys, incomplete admin env, and `MANU_DEV_FALLBACK_STORE=true` not being sufficient for admin operations. This does not add a fallback admin store, does not activate hosted Supabase credentials, does not enable live Stripe, and does not change production readiness. Commercial admin invite creation still requires a reachable hosted/local Supabase project with all Phase 83 commercial migrations applied. Verification passed: targeted Phase 83F diagnostics tests 12/12, `npm run lint` with two pre-existing warnings, and `npm run build`. Production pilot remains `NO-GO`; R-405 remains open; R-406 current post-83 local Supabase/RLS re-run remains pending when Supabase is unavailable.

## Latest Phase 83 Final Remediation

On 2026-07-01, Phase 83 final remediation closed the remaining continuity and admin-revoke semantics gaps after Phase 83H. Current-state docs now identify Phase 83H/final remediation as the latest Phase 83 state, and the commercial admin console/API now exposes only full subscriber entitlement revocation: `/api/commercial/admin/entitlements/revoke` accepts `{ tenantId }`, rejects `mobileInstallOnly: true`, and records `entitlement_revoked`. The single subscriber entitlement gates both dashboard APIs and mobile/PWA install access. Verification passed: targeted Phase 83 tests 64/64, full app suite 665 passed / 4 skipped, visual 16/16, release verify core 225/225 + app 665 passed / 4 skipped; `npm run test:rls` skipped 21/21. Production pilot remains `NO-GO`; R-405 remains open; R-406 current post-83 local Supabase/RLS re-run remains pending when Supabase is unavailable. Next work is external launch-gate/R-405/RLS prerequisites.

## Phase 83H Verification And Release Evidence

On 2026-07-01, Phase 83H closed the Phase 83 track locally with `phase-83h-verification-refresh.ts`, Playwright visual 16/16 (desktop/tablet/Android/iPhone), extended commercial-admin RLS coverage, and full verification chain. Final remediation re-ran targeted Phase 83 tests 64/64 and release verify app 665 passed / 4 skipped. `npm run test:rls` skipped 21/21 (R-406 pending). Production pilot remains `NO-GO`. Next work is external launch-gate/R-405/RLS prerequisites.

## Phase 83G Security, Privacy, And Compliance Hardening

On 2026-07-01, Phase 83G added API-wide active entitlement enforcement through `resolveAppTenantContext()` + `commercial-entitlement-access.ts`, in-memory fail-closed rate limits on public invite-status/checkout routes, PWA stale-session entitlement checks via `/api/auth-state`, and demo `tenant_entitlements` seeding for local Supabase. Targeted Phase 83 tests passed 58/58; build passed. Production pilot remains `NO-GO`. Next phase is 83H.

## Phase 83F Commercial Admin And Operations

On 2026-07-01, Phase 83F added fail-closed commercial admin operations: `phase-83f-commercial-admin.ts`, `commercial-admin-store.ts`, migration `20260701140000_phase_83f_commercial_admin_audit.sql`, protected routes under `/api/commercial/admin/*`, and local ops console `/commercial-admin`. Admin gate requires `MANU_ALLOW_COMMERCIAL_ADMIN=true` and `MANU_COMMERCIAL_ADMIN_TOKEN` (min 32 chars). Admin can create/revoke invites, inspect subscription summaries, read billing ledger entries (audited), and revoke the subscriber entitlement that gates both dashboard APIs and mobile/PWA install access. Final remediation removed the misleading install-only revoke path and raised targeted Phase 83 coverage to 64/64. Production billing activation and production GO did not change. Production pilot remains `NO-GO`.

## Phase 83E Remediation

On 2026-07-01, Phase 83E remediation closed the visual acceptance and copy-consistency gaps found after the 83E-6 frontend relaunch. The purchase flow now has unique accessible headings (`Satın al` page heading, `Davetli erişim kontrolü` form heading), the dashboard visual-smoke surface uses Turkish labels for the shell and core workflow navigation, mobile bottom navigation remains reachable across all eight views, and the visual smoke sequence now respects the real safety-gate/red-lock ordering. Verification passed with visual 6/6, targeted Phase 83 50/50, lint with two pre-existing warnings, full unit 645 passed / 4 skipped, release verify core 225/225 + app 645 passed / 4 skipped, and `git diff --check` with CRLF warnings only. `npm run test:rls` skipped 21/21 because local Supabase was unavailable, so R-406 current re-run remains pending. This historical 83E remediation predated later Phase 83F/G/H and final remediation work. Production pilot remains `NO-GO`.

## Phase 83E-6 States, Accessibility, And Polish

On 2026-07-01, Phase 83E-6 (sixth and final sub-phase of the Phase 83E frontend relaunch) completed states, accessibility, and polish across the authenticated dashboard and related surfaces. Added `app/src/lib/phase-83e6-states-polish.ts` (focus ring, skeleton, banner live-region, main landmark constants; unit tested 2/2) and `app/src/components/dashboard/state-primitives.tsx` (`SkeletonBlock`, `DashboardLoadingSkeleton`, enhanced `EmptyState`, `ErrorState` for session recovery). `globals.css` gained keyboard `:focus-visible` outlines, skip-link, and `sr-only`. Dashboard shell: stable loading skeleton, Turkish session error recovery, skip link, semantic `h1` page title, labelled nav regions, `#dashboard-main` landmark. Panels wired to consistent empty states (conversation, handoffs, copilot, overview, simulator, voice, clients search). PWA shell banners gained `role="status"`/`role="alert"` and safe-area padding (83D audit behavior unchanged). Purchase flow and app-install center gained alert/status semantics and install loading guidance. No clinical/API/entitlement/Stripe/SW-cache behavior changed. Lint clean; full unit suite (102 files, 645 passed / 4 skipped) and production build passed. **Phase 83E is complete locally.** Production pilot remains `NO-GO`. Later Phase 83F/G/H and final remediation are complete locally.

## Phase 83E-5 Mobile Ergonomics

On 2026-07-01, Phase 83E-5 (fifth sub-phase of the Phase 83E frontend relaunch) deepened mobile ergonomics across the authenticated dashboard. Extended `app/src/lib/phase-83e5-mobile-ergonomics.ts` with mobile chrome spacing constants and unit tests (5/5); keyboard-aware input helpers (`MOBILE_FIELD_CLASS`, `resolveInputKeyboard`, 44px touch targets, 16px mobile font to prevent iOS zoom) are wired through `dashboard/shared.tsx`. Added `globals.css` utilities (`bottom-above-nav`, `pb-mobile-nav`, `pb-mobile-nav-actions`, focused-field `scroll-margin-bottom`). Added `app/src/components/dashboard/mobile-ergonomics.tsx` with `MobileStickyActionBar` (one-handed primary actions above the bottom nav on `<lg`) and `useMobileKeyboardScroll` (focus + visualViewport resize scroll-into-view). Sticky bars wired into conversation (Save manual reply), simulator (Run inbound flow), and copilot (Ask). Dashboard shell touch targets raised to 44px; safe-area on header/sidebar/content; view-aware main padding avoids double chrome offset. No clinical/API/entitlement/Stripe/SW-cache behavior changed. Lint clean; full unit suite (101 files, 643 passed / 4 skipped) and production build passed. Production pilot remains `NO-GO`. Next sub-phase is 83E-6.

## Phase 83E-4 Full Dashboard Parity

On 2026-07-01, Phase 83E-4 (fourth sub-phase of the Phase 83E frontend relaunch) recomposed the ~3,189-line monolithic `app/src/components/dashboard-app.tsx` into domain panel modules under `app/src/components/dashboard/`: `shared.tsx` (primitives, helpers, constants, `ViewKey`/`ClientDetailTab` types), `overview-panel.tsx`, `clients-panel.tsx` (list + detail form/tabs, status summary, scoped copilot, export, critical context), `conversation-panel.tsx`, `simulator-panel.tsx`, `voice-panel.tsx`, `forms-panel.tsx`, `copilot-panel.tsx`, and `handoffs-panel.tsx`. `dashboard-app.tsx` is now a ~830-line orchestrator that keeps the 83E-3 shell plus all state/data wiring and delegates each view to its domain panel. The extraction was verbatim: every workflow (overview, clients, conversation, simulator, handoffs, forms, food rules, menu plans, critical context, copilot, voice, export, notifications), all `data-testid`s, provenance/origin labels, message risk colors, red-risk reactivation lock, approval flows, and fail-closed logic are unchanged. No API/type contract, entitlement, Stripe, RLS, or SW-cache behavior changed (deeper mobile ergonomics remain 83E-5). Lint clean (0 errors, 2 pre-existing warnings); full unit suite (100 files, 638 passed / 4 skipped) and production build passed. Production pilot remains `NO-GO`. Next sub-phase is 83E-5.

## Phase 83E-3 Authenticated App Shell

On 2026-07-01, Phase 83E-3 (third sub-phase of the Phase 83E frontend relaunch) rebuilt the authenticated shell mobile-first. Added fail-closed shell logic `app/src/lib/phase-83e3-app-shell.ts` (`deriveDashboardAccessGate` mapping membership/dietitian/entitlement to `ok`/`no_membership`/`no_dietitian_profile`/`no_invite`/`checkout_incomplete`/`inactive_subscription`/`revoked_access`, plus subscription/install status descriptors; unit tested 4/4). Rebuilt `app/src/components/auth-states.tsx` on the 83E-1 design system with all six gated-state screens (no app data, safe sign-out, purchase/contact CTA where relevant) plus a `DashboardGatedState` router. `app/src/app/dashboard/page.tsx` now resolves entitlement server-side and renders the correct gated screen  -  only an active entitlement reaches the dashboard, while the Supabase-unconfigured fallback/demo path is unchanged. The `DashboardApp` shell gained a mobile bottom navigation (`lg:hidden`, 44px+ targets, safe-area), the desktop sidebar nav is now desktop-only (`hidden lg:block`), and the header shows subscription status + install state pills and a safe sign-out when authenticated. No clinical behavior, risk classification, approval flow, provenance, or API/entitlement/Stripe/SW-cache behavior changed (domain-panel recompose remains 83E-4). Lint clean (0 errors, 2 pre-existing warnings); full unit suite (100 files) and production build passed. Production pilot remains `NO-GO`. Next sub-phase is 83E-4.

## Phase 83E-2 Public Intro + Purchase UX

On 2026-07-01, Phase 83E-2 rebuilt the public landing (`app/src/app/page.tsx`) as a polished Turkish MANU-AI intro with a clear `Satın al` CTA (no app data), and added the gated purchase flow: `app/src/components/purchase-flow.tsx` + `app/src/app/purchase/page.tsx` (consuming existing Phase 83C `/api/commercial/invite-status` and `/api/commercial/checkout`), plus `/purchase/success` (onboarding + install guidance) and `/purchase/cancel`. Fail-closed presentation logic in `app/src/lib/phase-83e2-purchase-ux.ts` (unit tested 8/8): unapproved → waitlist/contact, unconfigured → "not configured", only explicit eligible unlocks Stripe checkout. Middleware still gates only `/dashboard/*`. Lint clean; full unit suite and production build passed. Production pilot remains `NO-GO`. Next sub-phase is 83E-3.

## Latest Phase 83E-1 Design System

On 2026-07-01, Phase 83E-1 (first sub-phase of the Phase 83E frontend relaunch) added clinical SaaS design tokens in `app/src/app/globals.css` and reusable primitives under `app/src/components/ui/`: `button`, `badge`/`OriginBadge`/`RiskBadge`, `card`, `field`, `tabs`, `segmented-control`, `dialog`, `sheet`, `data-table`, `timeline`, and `app-shell` (sidebar + top bar + mobile bottom nav), backed by `tokens.ts`/`cn.ts` and re-exported via `index.ts`. Palette is white/near-white surfaces, charcoal ink, emerald primary, cool neutral borders, ≤8px radius, no decorative gradients, lucide icons, 44px touch targets, safe-area helpers. Clinical green/yellow/red is reserved for message risk only. Targeted design-system unit test passed (6/6); primitives lint clean; production build passed. Primitives are not yet wired into pages (83E-2+). Production pilot remains `NO-GO`. Next sub-phase is 83E-2.

## Latest Phase 83D Gated PWA Mobile Install Center

On 2026-07-01, Phase 83D added `phase-83d-pwa-install-gate.ts`, `commercial-install-access.ts`, gated `/app-install` page, subscriber-only `pwa-subscriber-shell.tsx`, install audit API `/api/commercial/mobile-install-audit`, and updated `public/sw.js` with shell-only cache and network-only `/api/*` policy. Global SW registration removed from `pwa-runtime.tsx`. Targeted Phase 83D unit tests passed (8/8); production build passed. Production pilot remains `NO-GO`. Next sub-phase is 83E.

## Latest Phase 83C Stripe Checkout And Billing Gate

On 2026-07-01, Phase 83C added sandbox-first Stripe integration with `phase-83c-stripe-billing-gate.ts`, `commercial-billing-store.ts`, API routes `/api/commercial/invite-status`, `/api/commercial/checkout`, `/api/commercial/webhook`, `/api/commercial/billing-portal`, and migration `20260701130000_phase_83c_commercial_checkout_session.sql`. Live Stripe keys are blocked; `MANU_ALLOW_STRIPE_SANDBOX` gate required. Targeted Phase 83C unit tests passed (9/9); production build passed. No production billing activation. Production pilot remains `NO-GO`. Next sub-phase was 83D.

## Latest Phase 83B Commercial Entitlement Model

On 2026-07-01, Phase 83B added migration `20260701120000_phase_83b_commercial_entitlement_model.sql` and `app/src/lib/phase-83b-commercial-entitlement-model.ts` with invite normalization, hashed invite tokens, entitlement transition guards, dashboard/mobile access evaluation, and commercial Supabase tables with tenant-scoped RLS. Targeted Phase 83B unit tests passed (8/8). No Stripe integration. Production pilot remains `NO-GO`. Next sub-phase is 83C.

## Latest Phase 83A Commercial PWA Scope Lock

On 2026-07-01, Phase 83A created `docs/PHASE_83_COMMERCIAL_PWA_AND_FRONTEND_RELAUNCH_SPEC.md`, locked immutable Phase 83 rules (PWA-only mobile v1, invite + Stripe sandbox, public intro with gated purchase/dashboard/install, full dashboard parity on one shared surface), recorded the Phase 82G entry baseline, and documented sub-phases 83A-83H. No runtime behavior changed. Production pilot remains `NO-GO`. Next sub-phase is 83B.

## Latest Phase 82G Verification Refresh

On 2026-06-30, Phase 82G added `app/src/lib/phase-82g-verification-refresh.ts` with `Phase82VerificationRefreshReport`. Verification passed with targeted Phase 82 tests (5 files, 31/31), targeted Phase 80 regression tests (4 files, 29/29), targeted Phase 81 regression tests (3 files, 19/19), `git diff --check`, lint with two pre-existing warnings, production build, `npm run test:rls` skipped 20/20, `npm run release:verify` core 225/225 and app 595 passed / 4 skipped across 94 files, and `npm run rehearse:production-scale:79g`. Baseline verification status is `blocked` because current RLS is skipped/pending; `repoLocalClosureComplete` is `true`. Phase 82 track is closed; production pilot remains `NO-GO`.

## Latest Phase 82F Continuity And Final Dossier Closure

On 2026-06-30, Phase 82G verification closed Phase 82 across 82A-82G as a fail-closed repo-local project-completion layer, not a production launch. Baseline final outcome is `NO_GO_EXTERNAL_PREREQUISITES_OPEN`; Phase 82G records `repoLocalClosureComplete: true` for the verification track while final completion remains blocked until external prerequisites close. `productionPilotGo` remains `false`; `productionPilotStarted` remains `false`. Verification passed with targeted Phase 82 tests (5 files, 31/31), targeted Phase 80/81 regressions (7 files, 48/48), `git diff --check`, lint with two pre-existing warnings, production build, `npm run test:rls` skipped 20/20, `npm run release:verify`, and `npm run rehearse:production-scale:79g`. All eight launch gates remain open; R-405 remains open; R-406 Phase 50/52 baseline mitigated with current post-76N/77AA-77AI/79/80/81/82 re-run pending. Production pilot remains `NO-GO`. No current Phase 82 sub-phase remains.

## Latest Phase 82E Launch Activation Firewall Assertions

On 2026-06-30, Phase 82E added `app/src/lib/phase-82e-launch-activation-firewall.ts` with `Phase82LaunchActivationFirewallReport`. Reuses Phase 81D egress rules; baseline and eligible synthetic paths keep `productionPilotStarted: false` and provider/channel flags false. Targeted Phase 82E tests passed (6/6). Production pilot remains `NO-GO`.

## Latest Phase 82D Final Completion Report

On 2026-06-30, Phase 82D added `app/src/lib/phase-82d-final-completion-report.ts` with `Phase82FinalCompletionReport`. Baseline returns `NO_GO_EXTERNAL_PREREQUISITES_OPEN`; fully eligible synthetic chain returns `READY_FOR_EXTERNAL_CONTROLLED_LAUNCH_AUTHORIZATION` in tests only with `productionPilotStarted: false`. Targeted Phase 82D tests passed (6/6). Production pilot remains `NO-GO`.

## Latest Phase 82C R-405 / R-406 Final Blocker Reconciliation

On 2026-06-30, Phase 82C added `app/src/lib/phase-82c-blocker-reconciliation.ts` with `Phase82BlockerReconciliationReport`. Reuses Phase 80D R-405 evaluation and Phase 80E/81F RLS evidence; no dependency files changed. Baseline records R-405 open with `no_safe_stable_patch` and R-406 current rerun pending. Targeted Phase 82C tests passed (7/7). Production pilot remains `NO-GO`.

## Latest Phase 82B External Evidence Gap Ledger

On 2026-06-30, Phase 82B added `app/src/lib/phase-82b-external-evidence-gap-ledger.ts` with `Phase82ExternalEvidenceGapLedger`. Reuses `evaluateProductionPilotLaunchGateEvidence`; baseline keeps all eight gates open with no external artifacts supplied. Targeted Phase 82B tests passed (8/8). Production pilot remains `NO-GO`.

## Latest Phase 82A Final External Readiness Closure Scope Lock

On 2026-06-30, Phase 82A created `docs/PHASE_82_FINAL_EXTERNAL_READINESS_CLOSURE_SPEC.md`, locked immutable Phase 82 rules, recorded the Phase 81H entry baseline, and documented sub-phases 82A-82G. No runtime behavior changed. Expected Phase 82 baseline outcome is `NO_GO_EXTERNAL_PREREQUISITES_OPEN`; production pilot remains `NO-GO`. Next sub-phase was Phase 82B.

## Latest Phase 81F/81G Remediation Closure

On 2026-06-30, Phase 81F verification refresh and Phase 81G hardening completed the Phase 81 track. Phase 81F records the current verification refresh as `blocked` because current local RLS evidence is skipped/pending; Phase 81G now derives eligibility from the supplied Phase 80 final report instead of accepting caller-supplied eligibility. Baseline final outcome remains `NO_GO_NOT_ELIGIBLE`; production pilot remains `NO-GO`; `productionPilotStarted` remains `false`. Verification passed with targeted Phase 81 tests (6 files, 46/46), `git diff --check`, lint with two pre-existing warnings, production build, `npm run test:rls` skipped 20/20, `npm run release:verify` core 225/225 and app 564 passed / 4 skipped across 89 files, and `npm run rehearse:production-scale:79g`.

## Latest Phase 81G Final GO Readiness Report

On 2026-06-30, Phase 81G added `app/src/lib/phase-81g-go-readiness-report.ts` with `Phase81GoReadinessReport`. Baseline returns `NO_GO_NOT_ELIGIBLE`; eligible synthetic evidence returns `GO_READY_FOR_EXTERNAL_EXECUTION` with `productionPilotStarted: false`. After remediation it consumes Phase 81F verification refresh evidence and derives eligibility from the Phase 80 final report. Targeted Phase 81G tests passed (8/8). Production pilot remains `NO-GO`.

## Latest Phase 81E Roster Qualification

On 2026-06-30, Phase 81E added `app/src/lib/phase-81e-roster-qualification.ts` with aggregate-only roster qualification. Baseline returns `blocked`; complete sanitized aggregate returns `qualified`. Targeted Phase 81E tests passed (10/10). Production pilot remains `NO-GO`.

## Latest Phase 81D Environment Preflight

On 2026-06-30, Phase 81D added `app/src/lib/phase-81d-environment-preflight.ts` with dry-run `Phase81EnvironmentPreflightReport`. Baseline returns `blocked`; complete synthetic input returns `ready`. Targeted Phase 81D tests passed (8/8). Production pilot remains `NO-GO`. Next sub-phase is Phase 81E.

## Latest Phase 81C Launch Authorization Evidence

On 2026-06-30, Phase 81C added `app/src/lib/phase-81c-launch-authorization-evidence.ts` with `Phase81LaunchAuthorizationEvidence`. Baseline returns `no_authorization_supplied`; complete sanitized authorization returns `approved`. Targeted Phase 81C tests passed (9/9). Not a ninth launch gate. Production pilot remains `NO-GO`. Next sub-phase is Phase 81D.

## Latest Phase 81B Phase 80 Eligibility Import

On 2026-06-30, Phase 81B added `app/src/lib/phase-81b-phase-80-eligibility.ts` with `Phase81EligibilityReport`, consuming the Phase 80F final report shape. Current baseline returns `NO_GO_NOT_ELIGIBLE`; synthetic eligible Phase 80 report returns `eligible_for_preflight`. Targeted Phase 81B tests passed (8/8). `productionPilotGoReady` and `productionPilotStarted` remain `false`. Production pilot remains `NO-GO`. Next sub-phase is Phase 81C.

## Latest Phase 81A Scope Lock

On 2026-06-30, Phase 81A created `docs/PHASE_81_DIRECT_PRODUCTION_PILOT_GO_EVALUATION_SPEC.md`, locked immutable Phase 81 rules, recorded the Phase 80G entry baseline, and documented sub-phases 81A-81H. No runtime behavior changed. Expected Phase 81 baseline outcome remains `NO_GO_NOT_ELIGIBLE`; `phase81StartEligible` remains `false`; production pilot remains `NO-GO`. Next sub-phase is Phase 81B.

## Latest Phase 77 Remediation

On 2026-06-28, Phase 77AA-77AI review findings were remediated without enabling real providers or production channel traffic. The update makes rollback controls persistent in Supabase, keeps invalid WhatsApp timestamps fail-closed, aligns mock delivery typing, moves full 100x50 channel replay behind the dedicated rehearsal command, and deletes Supabase `channel_deliveries` during client anonymization/removal.

Verification passed for targeted Phase 77 suites, `supabase-store` unit tests, `npm run lint`, `git diff --check`, and `npm run rehearse:channel:replay`. Production pilot remains `NO-GO`.

## Latest Phase 78 Dependency/R-405 Recheck

On 2026-06-29, Phase 78 re-ran the accepted Phase 22 R-405 procedure. Stable `next@latest` is `16.2.9` but still bundles nested `postcss@8.4.31`; `eslint-config-next@latest` is `16.2.9`; production audit still reports only the known moderate R-405 `next`/`postcss` findings and the rejected semver-major `next@9.3.3` downgrade. No dependency files were changed. R-405 and `dependency_audit_clearance` remain open, and production pilot remains `NO-GO`.

## Latest Phase 80F Final Readiness Decision

On 2026-06-30, Phase 80F added `phase-80f-final-readiness-decision.ts` and aggregated Phase 80C gate evaluation, Phase 80D R-405 closure evaluation, and Phase 80E RLS evidence into the final closure report. Final outcome: `NO_GO_MISSING_ARTIFACTS`; `productionPilotDecision` is `NO-GO`; `productionPilotGo` remains `false`; `phase81StartEligible` is `false`. Targeted Phase 80F tests passed (5/5). Phase 80 external launch-gate closure is complete; Phase 81 cannot start until all gates close, R-405 resolves or is formally accepted, and current RLS evidence passes.

## Latest Phase 80G R-405 Closure-Evidence Hardening

On 2026-06-30, Phase 80G hardened `phase-80d-r405-closure-evaluation.ts` and Phase 80F regression coverage. Technical R-405 closure now requires a safe stable patch path, dependency update evidence, and clean production audit; unknown production audit findings block closure; formal R-405 acceptance requires complete external acceptance metadata including rationale and compensating controls. Targeted Phase 80 tests passed (4 files, 29 tests). `npm run release:verify` passed with core tests 225/225, app tests 518 passed and 4 skipped across 83 files, production build, and only documented R-405 findings. `npm run rehearse:production-scale:79g` passed. No dependency files changed, no gate closed, R-405 remains open, and production pilot remains `NO-GO`.

## Latest Phase 80E Current RLS Evidence Re-run

On 2026-06-30, Phase 80E ran `npm run test:rls`. The suite skipped 20/20 tests because local Supabase was unavailable. Added `phase-80e-current-rls-evidence.ts`; targeted Phase 80E tests passed (5/5). R-406 remains Phase 50/52 baseline mitigated with current re-run pending; no launch gate closed.

## Latest Phase 80D R-405 Closure Evaluation

On 2026-06-30, Phase 80D re-ran the Phase 22 procedure. Stable `next@latest` `16.2.9` still bundles nested `postcss@8.4.31`; production audit still reports only known R-405 findings; no dependency files changed; no formal acceptance artifact supplied. Added `phase-80d-r405-closure-evaluation.ts`; targeted Phase 80D tests passed (7/7). R-405 and `dependency_audit_clearance` remain open.

## Latest Phase 80C Gate Evaluation

On 2026-06-30, Phase 80C added `phase-80c-launch-gate-evidence-evaluation.ts` and evaluated Phase 80B empty intake through the existing Phase 64 evaluator. All eight launch gates remain open; `productionPilotDecision` is `NO-GO`. Targeted Phase 80C tests passed (9/9). No real connections or self-approved gate closure.

## Latest Phase 80B External Artifact Intake

On 2026-06-30, Phase 80B updated `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md` with the Phase 80 `LaunchGateEvidenceRecord` intake contract, forbidden repo content rules, empty manifest template, and explicit `no_external_artifact_supplied` result. Zero evidence records were supplied; all eight launch gates remain open. No runtime code changes. `git diff --check` passed. Production pilot remains `NO-GO`; R-405 remains open; R-406 is Phase 50/52 baseline mitigated with current post-76N/77AA-77AI/79/80 re-run pending when local Supabase is unavailable.

## Latest Phase 80A Scope Lock

On 2026-06-30, Phase 80A completed the Phase 80 master spec and scope lock. Added `docs/PHASE_80_EXTERNAL_LAUNCH_GATE_CLOSURE_AND_R405_ACCEPTANCE_SPEC.md` with immutable rules (no real connections, gate closure only via `LaunchGateEvidenceRecord`, R-405 only via Phase 22 or formal external acceptance, maximum outcome `PHASE_81_ELIGIBLE`), Phase 79I entry baseline, and sub-phase map 80A-80F. No runtime code changes. `git diff --check` passed. Production pilot remains `NO-GO`; all eight launch gates remain open; R-405 remains open; R-406 is Phase 50/52 baseline mitigated with current post-76N/77AA-77AI/79/80 re-run pending when local Supabase is unavailable.

## Latest Phase 79 Production-Scale Closure

On 2026-06-29, Phase 79A-79I completed production-scale hardening, full 100x50 rehearsal closure, and post-review remediation. The work added a real `/api/app-state?view=windowed` dashboard runtime while preserving legacy `/api/app-state`, fail-closed notification windows, scoped client create/patch responses without post-mutation broad reloads, bounded internal copilot loaders, unified removal/anonymization evidence, current RLS evidence with pending current re-run when local Supabase is unavailable, a unified 100x50 rehearsal command, and continuity/risk/gate documentation closure.

Verification passed with targeted Phase 79 remediation tests (7 files, 65 passed, 2 skipped), full app tests (79 files, 489 passed, 4 skipped), `npm run lint` with two pre-existing warnings, `npm run build`, and `npm run rehearse:production-scale:79g`: expanded AI quality passed 5,000 cases with hard-zero counters at 0; full mock channel replay passed; Phase 79 production-scale acceptance tests passed; `npm run release:verify` passed with core tests 225/225, app tests 489 passed and 4 skipped across 79 files, production build, and only documented R-405 findings. Production pilot remains `NO-GO`; R-405 remains open; R-406 is Phase 50/52 baseline mitigated with current post-76N/77AA-77AI/79 RLS re-run pending until local Supabase is available.

## Workspace

All project files are under:

```text
C:\Users\Dell\OneDrive\Masaüstü\MANU-AI
```

Important files:

- `PLAN.md`: current canonical plan.
- `PROJECT_PLAN.md`: long detailed roadmap and launch gates.
- `HANDOFF_FOR_NEXT_CODEX.md`: continuation file for a new Codex chat.
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`: current phased execution plan and done criteria.
- `docs/DATA_INVENTORY.md`: data categories and prompt allowlist.
- `docs/DATASET_STRATEGY.md`: how to use dietitian/manual/AI message data.
- `docs/MOBILE_APP_STRATEGY.md`: web + PWA + native mobile path.
- `docs/RISK_REGISTER.md`: current risk register.
- `docs/PHASE_79_PRODUCTION_SCALE_HARDENING_AND_FULL_100X50_REHEARSAL_SPEC.md`: latest production-scale hardening and 100x50 rehearsal closure.
- `docs/PHASE_61_SCOPE_GUARD_RAG_SECOND_LAYER_SPEC.md`: scope guard (RAG + LLM) second layer PRD/tech spec.
- `docs/PHASE_62_ARCHITECTURE_REVIEW_REMEDIATION_WAVE2_SPEC.md`: post-review remediation (provider handoff, normalization, overlap retrieval, glucose tuning).
- `docs/PLAN_GAP_AUDIT.md`: audit history of plan gaps.
- `dietitian-ai-assistant/`: testable core architecture package.

## Core Product Decisions

### Interface

Dietitians manage everything from MANU-AI:

- Web dashboard for full operations.
- Mobile PWA for phone use.
- Future native app through React Native/Expo after validation.

WhatsApp and Telegram are client communication channels, not the main control surface.

### AI Activation

AI is not always on.

Each client has:

- `aiStatus`: `active` or `passive`
- optional `aiActiveFrom`
- optional `aiActiveUntil`
- `aiMode`: `autopilot`, `copilot`, `manual`, or `paused`

The dietitian can activate or deactivate AI for any client at any time.

If `aiStatus` is `passive`, the system stores and audits messages but does not generate an AI reply or draft.

### AI Modes

When AI is active:

- `autopilot`: green messages may be sent automatically.
- `copilot`: AI drafts only; dietitian approves before send.
- `manual`: no AI generation.
- `paused`: AI is suspended due to risk, handoff, or dietitian choice.

There is no fixed two-week copilot period.

### Risk Routing

Every inbound client message is classified:

- `green`: routine, safe message.
- `yellow`: review-required message.
- `red`: risky message requiring human handoff.

Routing:

- Green + active autopilot: can auto-send after quality guard.
- Green + copilot: draft for approval.
- Yellow: AI becomes passive/paused and creates one dietitian approval draft.
- Red: no LLM call; handoff to dietitian.
- Passive AI: no AI generation.

Clinical safety evaluation (three independent axes; escalate-only merge):

1. **Regex/deterministic classifier** (`dietetic-risk-v0.3.1`)  -  primary green/yellow/red routing.
2. **Clinical safety second layer** (`clinical-safety-second-layer-v0.2.0`)  -  deterministic context-sensitive yellow escalation above regex-only green, with Phase 76G source-backed food-rule carve-outs for prospective permission/substitution/skip questions.
3. **Scope guard** (`scope-rag-v0.1.0`)  -  dietetic-regulation corpus retrieval + evaluation in app; monotonic merge in core `scope-guard.js`. Default seed corpus is draft-only, so scope guard is a **no-op** until qualified dietitian approval loads an approved corpus. Real embedding/LLM remain disconnected until `clinical_taxonomy_approval` and `MANU_ALLOW_REAL_SCOPE_GUARD=true`.

Combined version string when all layers apply: `dietetic-risk-v0.3.1+clinical-safety-second-layer-v0.2.0+scope-rag-v0.1.0`.

Scope guard rules:

- Scope guard never downgrades risk (no red/yellow → green).
- Escalation level (`yellow` or `red`) comes from each approved regulation rule, not a global default.
- Evaluator/retrieval failure fail-safe escalates to yellow with reason `scope_guard_unavailable`.
- Audit records store rule ids and scores only (no raw client message text).
- Regulation corpus is system-level, tenant read-only; not client-owned data.

Yellow-risk hold rule:

- A yellow-risk message creates a `yellowRiskHold`, passivates AI, and waits for dietitian approval.
- While `yellowRiskHold` is active, later green/yellow inbound messages do not receive client-facing AI replies; they refresh the same pending draft so the dietitian reviews the conversation from the first yellow message through the latest message.
- Dietitian approve or edit-and-send resolves the yellow hold and restores the previous AI status/mode if no red lock is active.
- If a red-risk message arrives during a yellow hold, the yellow draft is preserved, red lock/manual handoff wins, and approving the yellow draft does not reactivate AI.

Red-risk reactivation rule:

- A red-risk handoff now creates an explicit client-level red risk lock.
- The lock forces `aiStatus=passive`, `aiMode=manual`, and `humanTakeoverLocked=true`.
- Notification read/acknowledge, dietitian manual replies, normal handoff resolution, takeover release, or direct AI-control edits do not reactivate AI.
- AI can reactivate only through explicit dietitian resolve-and-reactivate action with a resolution reason.
- Reactivation defaults to copilot; autopilot reactivation requires the mandatory safety checklist to be complete.
- The lock creation and reactivation are audited.

### Model Routing

The selected LLM routing is:

- `green`: `gemini-1.5-flash`
- `yellow`: `gemini-3`
- `red`: no LLM call

Google Gemini/provider retention and health-data eligibility must be reviewed before real client health data is sent to a model provider.

### Client Conversation Language

Each client has a dietitian-controlled `communicationLanguage`.

- The dietitian can change the client conversation language from the MANU-AI client profile.
- The selected language is synchronized with `healthProfile.preferredLanguage`.
- The prompt context includes the selected conversation language, so subsequent AI replies use that language.
- Changing the language is prompt-affecting state and invalidates stale pending drafts through the existing context revision safety path.
- Clinical safety routing is unchanged by language selection.

### Personas

Personas are communication behavior contracts, not clinical-rule changes.

Current personas:

- Dengeli Koç
- Sıcak Destekçi
- Disiplinli Takipçi
- Minimal Yanıt
- Motivasyon Ortağı
- Klinik Resmi

Personas can change:

- tone
- message length
- warmth
- formality
- emoji behavior
- boundary phrasing

Personas must never change:

- clinical safety rules
- red/yellow routing
- medication or emergency boundaries
- tenant or client isolation

### Dietitian Voice Profile

The system can analyze approved sample messages from a dietitian to infer:

- average message length
- formality
- emoji policy
- greetings
- closing style
- brief style notes

This is used to make replies feel closer to the dietitian's style.

## Message Provenance

The system must know who wrote each message.

Message origins:

- `client_inbound`: client wrote it.
- `ai_generated`: AI generated and sent it.
- `dietitian_manual`: dietitian wrote it manually.
- `system_event`: system event.
- `imported_unknown`: imported historical message with uncertain author.

This is mandatory because WhatsApp conversations may contain mixed messages: some from AI, some directly from the dietitian.

## Dataset Strategy

The new dataset created by message provenance is valuable.

Best examples:

- Client message -> dietitian manual reply.
- AI draft -> dietitian edited final reply.
- AI reply -> later dietitian follow-up.

MVP usage:

- Do not fine-tune on raw client messages.
- Use dietitian manual replies as style examples.
- Use AI draft edits as correction/evaluation data.
- Keep retrieval scoped to the same tenant and ideally the same dietitian.
- Do not treat AI-generated messages as ground truth unless approved or edited by the dietitian.
- Exclude `imported_unknown` messages from evaluation until reviewed.

## Clinical Safety Rules

AI must not:

- diagnose
- prescribe
- adjust medication
- set supplement doses
- manage emergencies
- independently change diet plans
- interpret lab reports, prescriptions, PDFs, images, or voice notes in MVP
- promote unsafe dieting, body shaming, purging, laxatives, or extreme restriction

AI must escalate:

- emergency symptoms
- allergic reactions
- eating disorder warning signs
- self-harm language
- pregnancy complications
- severe glucose/diabetes concerns
- medication or insulin dosing
- lab result interpretation
- supplement dosing
- diagnosed condition management
- unclear symptom questions
- plan-change requests

## Legal And Permission Layer

The user will prepare client-facing legal and permission documentation separately.

The app must still have integration points to enforce:

- channel permission state
- opt-in/opt-out
- legal/permission status before production messaging

Do not hard-code client-facing legal copy until those documents exist.

## WhatsApp And Telegram

Recommended order:

1. WhatsApp Business Platform
2. Telegram Bot API

WhatsApp requirements:

- Use WhatsApp Business Platform, not personal WhatsApp.
- Verify webhook.
- Handle duplicate webhook idempotency.
- Map phone number to exactly one active client.
- Quarantine unknown or ambiguous numbers.
- Respect opt-in and opt-out.
- Handle approved templates and service-window constraints.
- Record delivery status.
- Avoid healthcare-use policy violations.

Telegram requirements:

- Bot webhook.
- Telegram user ID mapping.
- Bot privacy-policy link.
- Same core orchestrator as WhatsApp.

## Web And Mobile App Plan

MVP should be:

- Next.js web dashboard
- mobile-first responsive design
- installable PWA
- push-notification-ready urgent handoff flow

Mobile PWA should support:

- urgent handoff alerts
- AI active/passive toggle
- draft approval/edit/send
- manual reply
- conversation review
- message origin visibility
- quick client search

Native app should come later:

- React Native
- Expo
- shared backend/API
- APNs/FCM push notifications

## Current Core Package

Path:

```text
dietitian-ai-assistant
```

Key modules:

- `src/orchestrator.js`: end-to-end inbound decision flow.
- `src/ai-activation.js`: active/passive and activation-window logic.
- `src/model-routing.js`: green/yellow/red model routing.
- `src/message-provenance.js`: message origin helpers.
- `src/safety-classifier.js`: dietetic risk classifier.
- `src/clinical-safety-second-layer.js`: deterministic context-sensitive yellow escalation.
- `src/scope-guard.js`: escalate-only scope/regulation merge (`scope-rag-v0.1.0`).
- `src/response-quality-guard.js`: post-generation safety guard.
- `src/context-capsule.js`: tenant/client-scoped context.
- `src/personas.js`: six personas.
- `src/voice-profile.js`: dietitian tone profile builder.
- `dietitian-ai-assistant/docs/data-model.sql`: reference database model.

Current tests:

```bash
cd "C:\Users\Dell\OneDrive\Masaüstü\MANU-AI\dietitian-ai-assistant"
npm test
```

Last verified result (Phase 65, 2026-06-04):

```text
114/114 tests passing
```

## Current Local App Prototype

Path:

```text
app
```

Status as of 2026-06-04 (Phase 62):

- Provider failures on active clients: core orchestrator opens dietitian handoff without client-facing AI reply; simulator persists handoff + notification.
- Shared `normalize-safety-text.js` used by classifier, second layer, and scope corpus tokenization.
- Scope retrieval uses overlap coefficient; match threshold `0.4`.
- Glucose numeric window skips TL/lira and similar non-glucose units after numbers.
- Core tests 114/114; app tests 150/150.

Status as of 2026-06-04 (Phase 64):

- Structured `LaunchGateEvidenceRecord` evaluation requires sanitized artifact references, owner, explicit approval status, approval date, review cadence, non-expired evidence, and complete required-evidence coverage before a launch gate is treated as closed.
- Legal/privacy and clinical gate definitions now include Phase 63 user-supplied form and official PDF corpus evidence requirements.
- Operational health can consume structured launch-gate evidence without exposing raw content.
- Real scope guard egress cannot be enabled by legacy approved id lists alone; it requires structured clinical taxonomy and provider/vendor evidence plus `MANU_ALLOW_REAL_SCOPE_GUARD=true`.
- App tests 158/158; production pilot remains `NO-GO`.

Status as of 2026-06-04 (Phase 65):

- Official regulation PDF corpus QA foundation exists in `app/src/lib/official-regulation-corpus.ts`.
- PDF-derived corpus intake now requires sanitized source metadata, SHA-256 checksum, page-level extraction evidence, page/section references, derived rule drafts, and synthetic corpus golden cases.
- QA-passing derived rules can become draft scope rules with source references, but they are not approved or active.
- Clinical launch-gate evidence for the official PDF corpus can be built only from QA-passing corpus evidence plus external approval metadata; QA failure keeps the evidence draft.
- App tests 166/166; production pilot remains `NO-GO`.

Status as of 2026-06-04 (Phase 63):

- Production pilot planning is rebaselined to WhatsApp-first, Gemini-only, up to 100 dietitians, and 50+ clients per dietitian.
- Dietitian and client forms are user-supplied inputs; they require schema, privacy, prompt-allowlist, clinical, versioning, and migration review before production use.
- Official health-regulation PDFs are user-supplied inputs; they require traceable extraction, page/section references, approved derived rules, corpus versioning, corpus golden cases, and explicit clinical/legal approval before active green/yellow/red routing.
- Green autopilot remains gate-bound and may only be enabled after launch gates, client qualification, monitoring, rollback, and sample-review evidence.
- Production pilot remains `NO-GO`; this phase did not change runtime code, schema, providers, channels, dependencies, R-405, or real-data handling.

Status as of 2026-06-04 (Phase 61):

- Scope guard modules: `scope-corpus.ts`, `scope-retrieval.ts`, `scope-evaluator.ts`, `scope-guard-runtime.ts`, `scope-guard-provider.ts`; wired from `simulator-risk.ts` after clinical classification.
- Supabase migration `20260604000000_phase_61_scope_corpus.sql` for system-level regulation corpus and raw-text-free scope guard audit.
- Placeholder draft regulation corpus in seed (scope guard no-op until approved).
- App tests 150/150; `npm run release:verify` passes with only documented R-405 findings.
- Real embedding/LLM for scope guard remain disconnected.

Status as of 2026-05-22:

- Next.js 16 app created with TypeScript, Tailwind, and lucide icons.
- Local demo auth gate protects `/dashboard` through `src/proxy.ts`.
- PWA shell added with `public/manifest.webmanifest`, `public/sw.js`, and `public/icon.svg`.
- Supabase browser client placeholder added; app runs in local demo mode until Supabase env vars are supplied.
- Supabase migration added at `app/supabase/migrations/20260522000000_initial_manu_ai_schema.sql`.
- Dashboard shell includes overview, clients, conversation timeline, simulator, and handoff queue.
- Client controls include active/passive, mode, persona, activation window, safety profile completion, permission state, and human takeover lock.
- Simulator calls the existing `dietitian-ai-assistant` `handleInboundMessage` orchestration through a local file dependency.
- Simulator stores message provenance labels for client inbound, AI generated, dietitian manual, and system messages.
- App tests cover green, yellow, red, passive, scheduled activation, duplicate inbound simulation, human takeover, and missing safety fields.

Status as of 2026-05-23:

- `codex.md` project rules were read and are treated as active local project rules.
- Supabase local config was added under `app/supabase/config.toml`.
- Supabase schema fix migration was added for message status, AI decision reasons, client safety checklist, dietitian auth uniqueness, and membership-based RLS policies.
- A short implementation spec was added at `docs/NEXT_SUPABASE_FOUNDATION_SPEC.md`.
- Dashboard state moved from browser `localStorage` to API-backed state endpoints.
- API endpoints now cover app state loading/reset, client create/update, simulator runs, manual messages, and handoff resolve/dismiss.
- Current API store uses a dev fallback in-memory state until local Supabase credentials and auth bootstrap are wired.
- App tests now include store operation coverage in addition to simulator coverage.

Status later on 2026-05-23:

- Added `app/src/lib/supabase-store.ts`.
- API routes now use Supabase persistence when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured.
- Without those env vars, the same API routes continue using the dev fallback store.
- Supabase store auto-seeds demo tenant, dietitian, clients, conversations, seed messages, seed AI decision, and processed seed event.
- Supabase store supports state loading/reset, client create/update, manual reply persistence, simulator persistence, and handoff resolve/dismiss.

Status after Supabase Auth wiring on 2026-05-23:

- Supabase SSR browser/server client helpers were added.
- Demo sign-in now creates or reuses `demo@manu.local` when Supabase is configured.
- The demo auth user is linked to the demo tenant through `tenant_memberships` and `dietitians.auth_user_id`.
- `/dashboard` requires a verified Supabase Auth user when Supabase is configured.
- Supabase-backed API routes resolve tenant and dietitian context from the authenticated user.
- Supabase-backed API routes return `401` without a session and `403` without tenant/dietitian membership.
- Fallback store mode still uses the local demo cookie behavior when Supabase credentials are missing.
- RLS integration tests now run through `npm run test:rls` and verify tenant-member reads, membership-less reads, and cross-tenant write blocking against local Supabase.
- Draft approval, edit-send, and dismiss actions now persist through `/api/messages/drafts/[id]`.
- Explicit human takeover release now persists through `/api/clients/[id]/release-takeover` and writes a `human_takeover_released` audit event.
- Autopilot readiness now uses detailed `safetyChecklist` validation instead of only a single demo boolean.

Status after pilot foundation hardening on 2026-05-23:

- Added `docs/PILOT_FOUNDATION_HARDENING_SPEC.md`.
- Added `app/supabase/migrations/20260524000000_restore_auxiliary_rls_policies.sql` to restore RLS policies for `client_ai_status_events`, `conversation_memories`, and `risk_assessments`.
- Expanded RLS integration tests from 3 to 5 tests, covering tenant access for auxiliary clinical/audit tables, simulator idempotency channel persistence, and Supabase-backed AI control audit events.
- Fixed simulator idempotency persistence so Telegram simulations store `processed_inbound_events.channel = telegram` instead of falling back to the first client.
- Supabase-backed client AI status, mode, and activation window changes now write `client_ai_status_events` plus a `client_ai_control_updated` audit event.

Local runtime verification on 2026-05-23:

- Local Supabase was started successfully for project `manu-ai-local`.
- Supabase migrations were applied to the local database.
- Local Supabase endpoints:
  - API: `http://127.0.0.1:54321`
  - Studio: `http://127.0.0.1:54323`
  - Database: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- `app/.env.local` was created with the generated local publishable and secret keys.
- Dashboard route `http://localhost:3000/dashboard` returned HTTP 200 through the local Next.js server.
- `/api/app-state` loaded demo data from live local Supabase.
- `/api/simulator` persisted a simulated inbound message, AI decision, generated reply, processed idempotency key, and audit event to Supabase.
- `/api/messages/manual` persisted a dietitian manual reply to Supabase.
- Demo state was reset back to the seed state after verification.
- Codex in-app browser could not open localhost because of its own URL policy, but Windows/default browser was opened to `http://localhost:3000/dashboard`.
- Verified commands after these changes: `npm run lint`, `npm test`, and `npm run build` in `app`.

Run:

```bash
cd "C:\Users\Dell\OneDrive\Masaüstü\MANU-AI\app"
npm run dev
npm test
npm run build
```

Note: app scripts currently use `next dev --webpack` and `next build --webpack` because Turbopack did not resolve the local symlinked core package reliably.

## Immediate Next Sprint

Goal: turn the architecture package into a working local SaaS prototype and mobile-ready PWA shell.

Progress as of 2026-05-23: the first working local prototype exists, dashboard state is API-backed, the Supabase-backed store has been verified against a live local Supabase instance, local Supabase Auth/session handling resolves tenant membership for the demo user, RLS integration tests cover the first tenant-isolation cases, draft approval workflows persist locally and in Supabase, human takeover release is now an explicit audited workflow, and autopilot safety readiness uses detailed checklist validation.

Additional hardening as of 2026-05-23: RLS coverage now includes activation events, memories, and risk assessments; simulator idempotency channel persistence is fixed; and Supabase-backed AI control changes are audited.

Pilot foundation execution update as of 2026-05-25: simulator inbound messages now persist `risk_assessments`, duplicate simulator events do not create duplicate risk records, RLS tests fail closed for non-local Supabase unless explicitly overridden, fallback mode can be forced with `MANU_DEV_FALLBACK_STORE=true`, core safety golden tests were added, Playwright dashboard visual smoke coverage was expanded for desktop/tablet/mobile Chromium, controlled JSON API errors were added for known local failure paths, long message rendering is mobile-safe, and handoff creation now queues an in-app notification audit event.

Phase 2 auth onboarding shell completed on 2026-05-25: production-style auth gates added to dashboard with server-side membership/profile resolution. Dashboard shows controlled error states for unauthenticated, no-membership, and missing-dietitian-profile users. Membership badge shows authenticated user name and role in dashboard header. Auth errors from API calls are captured and shown instead of silently falling back. 6 auth-context unit tests added (24/24 total). `proxy.ts` confirmed as native Next.js 16 middleware. Fallback mode and demo auth unchanged.

Phase 3 consent/permission/channel governance completed on 2026-05-25: only `channelPermission === "ready"` allows AI generation (pending, blocked, opted_out all block). Identity quarantine blocks AI for empty channelUserId and unknown adultStatus. Permission changes audited with previous/new values and distinct opt-out event type. 6 new simulator tests added (30/30 total).

Phase 4 handoff notification architecture completed on 2026-05-25: `NotificationRecord` added with `markNotificationRead` and `acknowledgeNotification` APIs. Dashboard Bell icon added with unread badge and dropdown panel. Red handoffs automatically generate safe-text notifications in the simulator. 2 new simulator tests added to enforce safe-text rule (32/32 total).

Phase 5 data governance completed on 2026-05-25: retention policy placeholders were added with all final durations marked legal-review-required. Tenant/client-scoped export and client anonymization APIs were added. Anonymization clears promptable client context, channel identifiers, rolling memory, message bodies, and AI decision references while preserving a minimized audit event. A Supabase migration was added for the Phase 3 `opted_out` permission enum gap. App tests now cover scoped export, anonymization, memory invalidation, retention placeholders, and fallback API routes (37/37 total).

Phase 6 clinical governance and evaluation completed on 2026-05-25: added clinical golden JSONL cases with expected risk/action/model/provider-call behavior, expanded persona invariant tests, upgraded the safety classifier to `dietetic-risk-v0.2.0`, and documented the qualified-dietitian taxonomy review workflow. Core tests now include 35 passing tests.

Phase 7 channel adapter readiness completed on 2026-05-25: added normalized mock inbound channel event contracts for WhatsApp/Telegram, unknown and ambiguous identity quarantine, duplicate provider-event idempotency, permission-blocked and opted-out mock channel tests, and provider metadata redaction rules. Real WhatsApp/Telegram credentials remain disconnected. App tests now include 45 passing tests.

Phase 8 AI provider readiness completed on 2026-05-25: added deterministic local mock provider abstraction, prompt version metadata, provider id/status/error metadata on AI decisions, Supabase decision metadata migration, timeout/error taxonomy, and safe no-send behavior for provider failures. Real Gemini and external LLM providers remain disconnected. App tests now include 49 passing tests.

Phase 9 pilot readiness closure completed on 2026-05-25: added a local Git checkpoint foundation with root ignore rules, aligned app classifier metadata with `dietetic-risk-v0.2.0`, added Supabase notification persistence migration, wired Supabase notification read/acknowledge endpoints, and added controlled fallback notification errors. Local Supabase migrations were applied and RLS integration tests passed 5/5 against local Supabase with fallback disabled. App tests now include 51 passing tests.

Phase 10 production readiness gates completed on 2026-05-25: added `docs/PHASE_10_PRODUCTION_READINESS_GATES_SPEC.md` and a machine-readable launch gate evaluator. Production pilot remains blocked by default until legal/privacy, clinical taxonomy, provider/vendor, channel policy, incident response, backup/restore, secret rotation, and dependency audit gates are externally approved. App tests now include 54 passing tests.

Phase 11 operational evidence readiness completed on 2026-05-25: launch gates now list required external evidence, and draft incident response, backup/restore, and secret rotation runbooks were added without approving any gate or connecting real providers/channels. App tests now include 55 passing tests.

Phase 12 RBAC authorization completed on 2026-05-25: production Supabase API paths now resolve membership role and enforce fail-closed capabilities. Owner/admin/dietitian keep existing workflow access, while assistant/auditor are limited to read-only app-state access until assignment and minimized auditor views exist. App tests now include 58 passing tests.

Phase 13 client assignment and scoped access completed on 2026-05-25: added `client_assignments` migration, service-layer Supabase app-state scoping, and RLS assertions. Owner/admin remain tenant-wide, dietitians see owned plus assigned clients, assistants see assigned clients only, and auditors receive no raw client/message state until a minimized auditor view exists. App tests now include 62 passing tests.

Phase 14 DSAR, retention, and legal ops ledger completed on 2026-05-25: added `data_requests` migration and app-state ledger records for completed export/anonymization operations. Export bundles now include target-client data request history, while final retention durations and deletion automation remain legal-review-gated. App tests now include 63 passing tests.

Phase 15 safe observability and operational health completed on 2026-05-25: added a safe internal operational health snapshot with aggregate counts and launch-gate status, plus an error monitoring policy draft. No raw messages, prompts, channel identifiers, health profiles, secrets, or external monitoring vendor were connected. App tests now include 66 passing tests.

Phase 16 channel policy simulation hardening completed on 2026-05-25: mock WhatsApp/Telegram channel events now fail closed for missing provider event ids and empty bodies before AI processing. Matched-client opt-out commands (`STOP`, `DUR`, `IPTAL`, `IPTAL ET`, `CANCEL`) update channel permission to `opted_out` without entering the AI path, and minimized audit metadata excludes raw bodies and channel identifiers. App tests now include 70 passing tests.

Phase 17 provider policy guard and prompt boundary completed on 2026-05-25: mock provider input is now built through an allowlist and guarded at runtime. Only `risk` and `client.dietPlan.summary` can enter the mock provider input; prompt/capsule/message/memory/channel/profile/clinical-note leakage fails closed, red-risk provider calls are rejected, and policy violations become safe no-send simulator decisions. App tests now include 75 passing tests.

Phase 18 notification SLA and internal escalation completed on 2026-05-25: added aggregate in-app SLA signals for handoff notifications. Urgent unacknowledged open handoff notifications breach after 15 minutes and count as internal escalation due; standard handoff notifications breach after 4 hours. Operational health now includes only aggregate SLA breach/escalation counts. No external email, push, WhatsApp, Telegram, monitoring, analytics, or real health data was connected. App tests now include 78 passing tests.

Phase 19 release verification, CI script, and dependency gate completed on 2026-05-25: added `npm run release:verify`, which runs core package tests, lint, app tests, production build, and a conservative production dependency audit gate. The gate allows only the documented R-405 Next.js/PostCSS production audit finding, fails on unknown/high/critical findings, and keeps `npm audit fix --force` blocked. Phase 19 verification passed with 35 core tests and 78 app tests while reporting R-405 as an open production launch blocker.

Phase 20 pilot readiness evidence pack completed on 2026-05-25: added a pilot-foundation evidence pack mapping all eight production-pilot launch gates to internal evidence, remaining external blockers, and open status. The pack records release verification results and explicitly states that production pilot, real health data, real WhatsApp/Telegram messaging, real Gemini/provider calls, external notifications, monitoring, and R-405 clearance remain blocked.

Phase 21 external approval dossier started on 2026-05-28: added a PRD/tech spec and production-pilot gate closure dossier. The Phase 21 `npm run release:verify` baseline was re-run successfully with 35 core tests, 78 app tests, lint, build, and only the known R-405 production audit finding. All launch gates remain open until external approval evidence is supplied.

Phase 22 R-405 dependency remediation planning completed on 2026-05-28: added a remediation spec that rejects `npm audit fix --force`, canary Next.js, invalid overrides, and major downgrade paths. Current stable `next@latest` still bundles vulnerable `postcss@8.4.31`; dependency files must not change until a stable Next.js release bundles `postcss >= 8.5.10` or external formal risk acceptance is provided.

Phase 23 AI context and memory architecture completed on 2026-05-30: added a bounded `PromptContext` compiler, raw-text-free `ContextManifest`, the missing historical context invariant, provider-output guard blocking for `[ERROR: missing_historical_context]`, send-status tracking, draft invalidation on prompt-affecting context changes, human-takeover routing for missing history, and Supabase schema fields for context/send safety. Core tests now include 39 passing tests; app tests now include 82 passing tests. Real providers, channels, monitoring, secret manager, and real health data remain disconnected.

Phase 24-25 voice sample and dynamic form infrastructure completed on 2026-05-30: added dietitian voice sample intake with approval/rejection and generated voice profiles, plus versioned dynamic client form schemas and response snapshots. PromptContext now includes only `prompt_allowed` form response summaries, and form response saves invalidate stale AI drafts. Real providers/channels/health data remain disconnected.

Phase 26 internal copilot completed on 2026-05-30: added a read-only internal dietitian copilot backed by curated tenant-scoped database tools over already-visible app state. Owner/admin/dietitian roles can ask local/mock questions about visible client status, diet plans, recent messages, form responses, handoffs, and AI decision history. Assistant/auditor are blocked from copilot chat in v1. Copilot questions, tool calls, assistant answers, and source refs are persisted in fallback and Supabase-backed state. No raw SQL, mutation tools, real LLM provider, real channel, external notification, monitoring, secret manager, or real health data was connected.

Phase 27 dietitian context updates completed on 2026-05-30: added a Critical Context workflow so dietitians can record confirmed client information from phone, Zoom, in-person, or other non-chat conversations. These records are stored as active client context updates, increment client context revision, invalidate pending drafts, enter bounded PromptContext as `dietitian_context_update` segments, and are included in export/anonymization governance. Old WhatsApp messages are not rewritten; newer dietitian context supersedes older prompt context, and newer `dietitian_manual` WhatsApp/Telegram/manual messages supersede older Critical Context records. Real providers, real channels, monitoring, secret manager, and real health data remain disconnected.

Phase 28 AI security remediation completed on 2026-05-31: added `providerAttempted`/`provider_attempted` audit semantics, no-call provider metadata cleanup, narrow `MockProviderError` provider-failure handling, PromptContext source metadata, newest dietitian-authored source marking, send-time draft revalidation, provider segment allowlist fail-closed checks, tenant-aware channel/idempotency uniqueness, scoped RLS/RBAC helper policies, stricter core TypeScript declarations, and expanded clinical golden cases. Latest verification: core tests 49/49, app tests 103/103, lint/build pass, and release audit reports only documented R-405. Real providers, real channels, monitoring, secret manager, and real health data remain disconnected.

Phase 29 pilot gate closure and evidence hardening completed on 2026-05-31: added `docs/PHASE_29_PILOT_GATE_CLOSURE_EVIDENCE_HARDENING_SPEC.md`, updated the production pilot dossier and evidence pack to use the Phase 27-28 baseline, recorded the RLS evidence gap when local Supabase is unavailable, and rechecked R-405 metadata. Stable `next@latest` remains 16.2.6 with `postcss@8.4.31`, and `eslint-config-next@latest` remains 16.2.6, so dependency files must not change. `npm run release:verify` passed after Phase 29 with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings. All production-pilot gates remain open.

Completion roadmap Phase 1 completed on 2026-05-31: added `docs/PHASE_30_COMPLETION_PHASE_1_CHECKPOINT_BASELINE_SPEC.md`, confirmed branch `codex/phase-29-baseline-checkpoint`, confirmed starting checkpoint `c75564e Add Phase 27-29 pilot readiness checkpoint`, and re-verified the baseline with `npm run release:verify`. No runtime behavior, schema, dependency, provider, channel, launch-gate, or real-data changes were made.

Completion roadmap Phase 2 attempted on 2026-05-31: added `docs/PHASE_31_COMPLETION_PHASE_2_RLS_EVIDENCE_SPEC.md`, confirmed the RLS guard is still safe for non-local Supabase URLs, attempted to start local Supabase, and ran `npm run test:rls`. Local Supabase could not start because Docker Desktop's Linux engine pipe was unavailable, and `npm run test:rls` skipped 10 guarded tests. No passing RLS evidence was produced, so R-406 remains blocked pending local Docker/Supabase availability. `npm run release:verify` passed after the Phase 2 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 3 completed on 2026-05-31: added `docs/PHASE_32_COMPLETION_PHASE_3_R405_RECHECK_SPEC.md` and rechecked R-405 through the Phase 22 procedure. `next@latest` remains `16.2.6` with `postcss@8.4.31`, `eslint-config-next@latest` remains `16.2.6`, and production audit still reports only the known moderate `next`/`postcss` findings. No dependency files were changed, no `npm audit fix --force` was run, and R-405 remains an open production launch blocker. `npm run release:verify` passed after the Phase 3 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 4 completed on 2026-05-31: added `docs/PHASE_33_COMPLETION_PHASE_4_EXTERNAL_APPROVAL_INTAKE_SPEC.md` and `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md` to make the eight production-pilot launch gates actionable for external evidence collection. No external approval artifacts were supplied, so all launch gates remain open; R-405 remains open and R-406 remains blocked. No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data changes were made. `npm run release:verify` passed after the Phase 4 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 5 completed on 2026-05-31: added `docs/PHASE_34_COMPLETION_PHASE_5_LEGAL_PRIVACY_PACKET_SPEC.md` and `docs/PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md` to prepare the `legal_privacy_review` launch gate for external counsel review. No legal/privacy approval artifact was supplied, so the gate remains open. R-405 remains open and R-406 remains blocked. No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data changes were made. `npm run release:verify` passed after clearing a transient Windows/OneDrive `.next` EPERM build artifact, with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 6 completed on 2026-05-31: added `docs/PHASE_35_COMPLETION_PHASE_6_CLINICAL_TAXONOMY_PACKET_SPEC.md` and `docs/PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md` to prepare the `clinical_taxonomy_approval` launch gate for qualified dietitian review. No qualified dietitian approval artifact was supplied, so the gate remains open. R-405 remains open and R-406 remains blocked. No classifier, golden-case, runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data changes were made. `npm run release:verify` passed after the Phase 6 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 7 completed on 2026-05-31: added `docs/PHASE_36_COMPLETION_PHASE_7_PROVIDER_VENDOR_REVIEW_PACKET_SPEC.md` and `docs/PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md` to prepare the `provider_vendor_review` launch gate for external vendor, legal, and security review. No provider/vendor approval artifact was supplied, so the gate remains open. R-405 remains open and R-406 remains blocked. No runtime behavior, schema, dependency, provider, channel, launch-gate approval, credential, logging-vendor, or real-data changes were made. Real provider egress for client replies, internal copilot, and dietitian context updates remains blocked. `npm run release:verify` passed after the Phase 7 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 8 completed on 2026-05-31: added `docs/PHASE_37_COMPLETION_PHASE_8_CHANNEL_POLICY_REVIEW_PACKET_SPEC.md` and `docs/PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md` to prepare the `channel_policy_review` launch gate for external WhatsApp and Telegram platform-policy review. No channel policy approval artifact was supplied, so the gate remains open. R-405 remains open and R-406 remains blocked. No runtime behavior, schema, dependency, provider, channel integration, webhook, credential, template registry, launch-gate approval, or real-data changes were made. Real WhatsApp and Telegram traffic remains blocked. `npm run release:verify` passed after the Phase 8 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 9 completed on 2026-05-31: added `docs/PHASE_38_COMPLETION_PHASE_9_INCIDENT_DSAR_REVIEW_PACKET_SPEC.md` and `docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md` to prepare the `incident_response_runbook` launch gate for external operations, legal, privacy, and clinical review. No incident/DSAR approval artifact was supplied, so the gate remains open. R-405 remains open and R-406 remains blocked. No runtime behavior, schema, dependency, provider, channel, monitoring, notification, ticketing, launch-gate approval, owner assignment, or real-data changes were made. `npm run release:verify` passed after the Phase 9 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 10 completed on 2026-05-31: added `docs/PHASE_39_COMPLETION_PHASE_10_BACKUP_RESTORE_REVIEW_PACKET_SPEC.md` and `docs/PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md` to prepare the `backup_restore_test` launch gate for external operations, security, and legal review. No backup/restore approval artifact or restore-drill evidence was supplied, so the gate remains open. R-405 remains open and R-406 remains blocked. No runtime behavior, schema, dependency, provider, channel, backup provider, storage, secret manager, infrastructure, launch-gate approval, restore drill, or real-data changes were made. `npm run release:verify` passed after the Phase 10 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 11 completed on 2026-05-31: added `docs/PHASE_40_COMPLETION_PHASE_11_SECRET_ROTATION_REVIEW_PACKET_SPEC.md` and `docs/PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md` to prepare the `secret_rotation_plan` launch gate for external security and operations review. No secret-rotation approval artifact, production secret manager, or rotation evidence was supplied, so the gate remains open. R-405 remains open and R-406 remains blocked. No runtime behavior, schema, dependency, provider, channel, backup provider, storage, secret manager, infrastructure, credential, launch-gate approval, or real-data changes were made. `npm run release:verify` passed after the Phase 11 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 12 completed on 2026-05-31: added `docs/PHASE_41_COMPLETION_PHASE_12_DEPENDENCY_AUDIT_CLEARANCE_PACKET_SPEC.md` and `docs/PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md` to prepare the `dependency_audit_clearance` launch gate for engineering/security review. Rechecked R-405 through the Phase 22 procedure: stable `next@latest` remains `16.2.6` with nested `postcss@8.4.31`, `eslint-config-next@latest` remains `16.2.6`, and production audit still reports only the known moderate `next`/`postcss` findings. No dependency files were changed, no dependency clearance or formal risk acceptance was supplied, so the gate remains open. R-405 remains open and R-406 remains blocked. `npm run release:verify` passed after the Phase 12 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Completion roadmap Phase 13 completed on 2026-05-31: added `docs/PHASE_42_COMPLETION_PHASE_13_FINAL_READINESS_CLOSURE_SPEC.md` and `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md` to close the 13-phase completion roadmap with a final production-pilot readiness summary. Current decision is `NO-GO` for production pilot: all eight launch gates remain open, R-405 remains open, R-406 remains blocked, and no external approval artifacts were supplied. No runtime behavior, schema, dependency, provider, channel, monitoring, secret manager, backup provider, launch-gate approval, R-405 acceptance, R-406 mitigation, or real-data changes were made. `npm run release:verify` passed after the Phase 13 documentation update with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Phase 43 multilingual language support completed on 2026-05-31: added canonical supported-language support for Turkish, English, German, French, Spanish, Portuguese, and Czech. Dietitian dashboard language is stored per dietitian; client communication language and canonical E.164 phone identity are stored per client; dynamic form schemas/responses store language metadata; saved form responses update the client's conversation language by phone/client identity; PromptContext includes a bounded `conversation_language` segment; local/mock provider replies and handoff acknowledgements localize to the stored client language; and multilingual clinical golden cases were added. This phase did not connect real providers, channels, translation services, monitoring, secret manager, backup provider, or real client health data, and it did not approve any production-pilot launch gate. `npm run release:verify` passed with core tests 52/52, app tests 107/107, lint, production build, and only documented R-405 findings. R-405 remains open and R-406 remains blocked.

Phase 44 red-risk reactivation lock completed on 2026-06-01: added a client-level `redRiskLock`, Supabase `clients.red_risk_lock`, explicit resolve-and-reactivate endpoint, and dashboard handoff controls. Red-risk handoffs now force AI passive/manual with human takeover locked; manual dietitian replies and notification acknowledgement do not reactivate AI; normal handoff resolution, direct AI-control edits, takeover release, and red-locked dismissal are rejected while locked. AI can resume only after explicit dietitian resolve-and-reactivate with an audit reason; copilot is the default and autopilot requires completed mandatory safety. This phase did not connect real providers, channels, monitoring, secret manager, backup provider, or real client health data, and it did not approve any production-pilot launch gate. `npm run release:verify` passed with core tests 52/52, app tests 112/112, lint, production build, and only documented R-405 findings. `npm run test:rls` still skipped 10 guarded tests because local Supabase evidence is unavailable. R-405 remains open and R-406 remains blocked.

Phase 45 client removal data lifecycle completed on 2026-06-01: added a soft-delete/anonymization lifecycle with `lifecycleStatus=removed_anonymized`, `removedAt`, `/api/clients/[id]/remove`, dashboard remove action, and Supabase lifecycle migration. Removed clients are hidden from normal dashboard client lists, blocked from inbound/manual/form/internal-copilot operations, and keep only minimized export/audit evidence. Promptable health data, phone/channel identity, rolling memory, message bodies, form response answers/submitted phone metadata, context updates, handoff text, notifications, red-risk locks, and AI decision/risk details are redacted or minimized. Hard delete remains legal-review gated. This phase did not connect real providers, channels, monitoring, secret manager, backup provider, or real client health data, and it did not approve any production-pilot launch gate. `npm run release:verify` passed with core tests 52/52, app tests 114/114, lint, production build, and only documented R-405 findings. R-405 remains open and R-406 remains blocked.

Phase 46 WhatsApp group quarantine completed on 2026-06-01: added an unsupported inbound context quarantine for group messages. Requests marked `sourceConversationType=group` are blocked before client lookup, risk classification, context assembly, provider calls, message storage, AI decisions, risk assessments, or handoffs. The system records minimized `InboundQuarantineRecord` metadata and `inbound_group_message_quarantined` audit events without storing raw group message text. Duplicate group events remain idempotent. This phase did not connect real WhatsApp, Telegram, providers, monitoring, secret manager, backup provider, or real client health data, and it did not approve any production-pilot launch gate. `npm run release:verify` passed with core tests 52/52, app tests 117/117, lint, production build, and only documented R-405 findings. R-405 remains open and R-406 remains blocked.

Phase 47 RLS quarantine evidence coverage completed on 2026-06-01: added explicit `inbound_quarantines` coverage to the expanded Supabase RLS integration suite, including tenant member visibility, outsider blocking, assistant/auditor blocking, cross-tenant write blocking, and Supabase-backed group quarantine persistence without client message/risk/decision/handoff artifacts. `npm run lint` and `npm run test` passed, and `npm run test:rls` now reports 11 guarded tests but still skips because Docker Desktop's Linux engine is unavailable. R-406 remains blocked until the 11-test suite passes against local Supabase.

Phase 48 R-405 stable patch recheck completed on 2026-06-01: rechecked `next@latest`, `eslint-config-next@latest`, and production audit. Stable `next@latest` is now `16.2.7`, but it still bundles nested `postcss@8.4.31`; `eslint-config-next@latest` is `16.2.7`; production audit still reports only the known moderate `next`/`postcss` findings and proposes the rejected semver-major `next@9.3.3` path. No dependency files were changed. R-405 remains open.

Phase 50 production Supabase hardening evidence completed locally on 2026-06-02: added `docs/PHASE_50_PRODUCTION_SUPABASE_HARDENING_EVIDENCE_SPEC.md`, recorded Supabase rate-limit/RPC groundwork, narrowed pre-mutation Supabase reads for the main client/handoff/draft operation paths, and updated pilot evidence/gate/final-readiness docs. `npm run release:verify` passed from `app` with core tests 57/57, app tests 126/126, lint, production build, and only documented R-405 findings. Docker Desktop/local Supabase was started, `npx supabase db reset --local` applied all migrations through Phase 50, and `npm run test:rls` passed against local Supabase with 1 file and 11/11 tests. R-406 is mitigated in the local prototype. No launch gate was approved; R-405 remains open.

Phase 51 transactional RPC coverage completed locally on 2026-06-02: added `docs/PHASE_51_TRANSACTIONAL_RPC_COVERAGE_SPEC.md`, extended `manu_commit_state_delta` with message, AI-decision, handoff, client-context, and form-response update payloads, added `commit_handoff_status`, and moved draft approval/dismissal, form response save, client context update, handoff status update, and red-risk reactivation to transactional RPC commits. `npm run lint`, `npm test`, and `npm run test:rls` passed from `app`; the RLS suite now passes 1 file and 14/14 tests against local Supabase. Client removal/anonymization bulk redaction remains out of scope pending a dedicated transactional redaction contract. Production pilot remains `NO-GO`; R-405 and all external launch gates remain open.

Phase 52 integration test coverage completed locally on 2026-06-02: added `docs/PHASE_52_INTEGRATION_TEST_COVERAGE_SPEC.md` and expanded Supabase-backed integration coverage for `consume_rate_limit` tenant/scope/key isolation, controlled `429 rate_limit_exceeded`, stale client revision `concurrent_state_update`, manual reply transaction atomicity, and inbound simulation transaction atomicity. `npm run test:rls` now passes against local Supabase with 1 file and 19/19 tests. `npm run lint`, `npm test`, and `npm run release:verify` passed; release verification still reports only known R-405 findings. No launch gate was approved.

Phase 53 scale/broad read contracts completed locally on 2026-06-02: added `docs/PHASE_53_SCALE_BROAD_READ_CONTRACTS_SPEC.md`, a test-covered `app/src/lib/supabase-read-contracts.ts` catalog, and `app/src/lib/supabase-read-contracts.test.ts`. Remaining broad Supabase reads are now classified as intentional legal/admin broad reads, future paginated reads, or already scoped mutation reads. Dashboard/internal-copilot pagination and client create/patch scoped reload contracts are designed but not implemented. `npm test` passed from `app` with 18 files and 130/130 tests, `npm run lint` passed, and `npm run release:verify` passed with core tests 57/57, app tests 130/130, lint, production build, and only known R-405 findings. R-115 remains partially mitigated, but the broad-read ambiguity is reduced.

Phase 54 R-405 and launch gates recheck completed locally on 2026-06-02: added `docs/PHASE_54_R405_AND_LAUNCH_GATES_RECHECK_SPEC.md` and re-ran the Phase 22 stable dependency procedure. `next@latest` is stable `16.2.7` but still depends on nested `postcss@8.4.31`; `eslint-config-next@latest` is `16.2.7`; `npm audit --omit=dev --json` still reports only the known moderate R-405 `next:postcss` and `postcss:GHSA-qx2v-qp2m-jg93` findings and proposes the rejected `next@9.3.3` downgrade. No dependency files were changed. No external approval artifacts were supplied, all eight launch gates remain open, R-405 remains open, and production pilot remains `NO-GO`. `npm run release:verify` passed with core tests 57/57, app tests 130/130, lint, production build, and only documented R-405 findings.

Phase 55 audit remediation safety boundary completed locally on 2026-06-03: added `docs/PHASE_55_AUDIT_REMEDIATION_SAFETY_BOUNDARY_SPEC.md`, hardened real Turkish Unicode safety normalization, expanded multilingual pregnancy/lactation yellow routing, added `prompt_injection_attempt` yellow routing, rendered client-authored PromptContext segments as explicit data boundaries, kept safety-critical pinned notes untruncated with fail-closed budget behavior, and added red-risk lock/preflight regression coverage. `npm test` passed from `dietitian-ai-assistant` with 72/72 tests and from `app` with 18 files and 132/132 tests; `npm run lint` passed from `app`; `npm run release:verify` passed with core tests 72/72, app tests 132/132, lint, production build, and only documented R-405 findings. This phase did not change schema, RLS, dependencies, providers, channels, monitoring, secret manager, backup provider, launch gates, R-405 status, or real-data handling. Production pilot remains `NO-GO`.

Phase 56 clinical safety second-layer local evidence completed locally on 2026-06-03: added `docs/PHASE_56_CLINICAL_SAFETY_SECOND_LAYER_LOCAL_EVIDENCE_SPEC.md`, introduced a deterministic `clinical-safety-second-layer-v0.1.0` evaluator above the regex classifier, and routed otherwise-green allergy/restriction mentions, ambiguous clinical references, missing-history references, minor weight/restriction context, and eating-disorder-sensitive ambiguous restriction language to yellow dietitian review. The combined classifier version is recorded as `dietetic-risk-v0.3.0+clinical-safety-second-layer-v0.1.0`; core/app tests cover the second-layer JSONL fixture, no-downgrade behavior, orchestrator draft routing, and simulator risk/decision evidence. This phase did not connect a real LLM-based safety evaluator, real provider, real channel, monitoring, secret manager, backup provider, schema/RLS/RPC changes, external launch-gate approval, or real health data. Production pilot remains `NO-GO`; R-310 is partially mitigated in the local prototype only.

Phase 57 yellow-risk hold/draft refresh completed locally on 2026-06-03: added `docs/PHASE_57_YELLOW_RISK_HOLD_DRAFT_REFRESH_SPEC.md`, introduced `yellowRiskHold`, passivated AI on yellow risk, refreshed one pending draft for later green/yellow messages, preserved the yellow draft when later red risk creates a manual lock, and added `clients.yellow_risk_hold` migration/RPC support. Verification passed with app simulator tests 34/34, app tests 135/135, core tests 75/75, app lint, and `npm run release:verify`. Local Supabase/RLS evidence for the Phase 57 migration may remain open when Docker Desktop/local Supabase is unavailable. Production pilot remains `NO-GO`.

Phase 58 dietitian client language control completed locally on 2026-06-03: added `docs/PHASE_58_DIETITIAN_CLIENT_LANGUAGE_CONTROL_SPEC.md`, synchronized client creation/profile `communicationLanguage` with `healthProfile.preferredLanguage`, made language changes prompt-affecting, and verified subsequent AI replies use the dietitian-selected language in simulator tests. Targeted verification passed with 54/54 tests. Production pilot remains `NO-GO`.

Phase 59 architecture review remediation completed locally on 2026-06-03: added `docs/PHASE_59_ARCHITECTURE_REVIEW_REMEDIATION_SPEC.md`, fail-closed unknown AI modes, core provider error boundary around `generateReply`, numeric glucose-context escalation and expanded multilingual symptom patterns with new golden cases, simulator `appendCoreSimulationResult` helper refactor without behavior change, multilingual voice-profile formal/informal scoring, and provider-native token counting documented as a future integration gate. Verification passed with core tests 85/85, app tests 137/137, app lint, and `npm run release:verify`. No schema/RLS, dependency, real provider, channel, launch-gate approval, or R-405 changes. Production pilot remains `NO-GO`; qualified dietitian clinical taxonomy approval remains required.

Phase 60 audit remediation completed locally on 2026-06-03: added `docs/PHASE_60_AUDIT_REMEDIATION_SPEC.md`, fixed glucose false-positive numeric extraction (`dietetic-risk-v0.3.1`), added core `providerOutputSafety` on provider failures, aligned `dietitian-ai-assistant-architecture.d.ts` with runtime, expanded symptom/voice/simulator tests, and synchronized handoff/plan/pilot documentation. Verification passed with core tests 104/104, app tests 138/138, app lint, and `npm run release:verify`. Production pilot remains `NO-GO`.

Phase 62 architecture review remediation wave 2 completed locally on 2026-06-04: added `docs/PHASE_62_ARCHITECTURE_REVIEW_REMEDIATION_WAVE2_SPEC.md`, provider-failure handoff without client send, `normalize-safety-text.js`, overlap scope retrieval, glucose cost-unit filtering, dead code removal, and constraint-accepted documentation for Bulgu 3/9/10. Verification passed with core tests 114/114, app tests 150/150, app lint, and `npm run release:verify`. Production pilot remains `NO-GO`; R-402 partially mitigated in local prototype.

Phase 63 production pilot GO rebaseline completed locally on 2026-06-04: added `docs/PHASE_63_PRODUCTION_PILOT_GO_REBASELINE_SPEC.md`, restructured the path out of production-pilot `NO-GO` around a WhatsApp-first/Gemini-only pilot for up to 100 dietitians with 50+ clients each, and recorded user-supplied dietitian/client forms plus official health-regulation PDFs as mandatory gated inputs. The plan now requires traceable PDF extraction, page/section mapping, approved corpus rules, corpus golden tests, form schema/privacy/prompt-allowlist review, structured launch-gate evidence, scale/load evidence, and rollback/monitoring gates before production pilot. Verification passed with core tests 114/114, app tests 150/150, app lint, and `npm run release:verify`. No runtime, schema, provider, channel, dependency, approval, R-405, or real-data change was made.

Phase 64 structured launch-gate evidence engine completed locally on 2026-06-04: added `docs/PHASE_64_STRUCTURED_LAUNCH_GATE_EVIDENCE_ENGINE_SPEC.md`, implemented typed structured evidence records and evaluator, expanded Phase 63 legal/clinical required evidence, wired operational health to structured evidence, and hardened real scope-guard provider allowance so legacy gate ids alone cannot enable real egress. Verification passed with core tests 114/114, app tests 158/158, app lint, production build, and `npm run release:verify`. No approval artifact was supplied, no gate was closed, no real provider/channel/data path was connected, and production pilot remains `NO-GO`.

Phase 65 official regulation PDF corpus QA foundation completed locally on 2026-06-04: added `docs/PHASE_65_OFFICIAL_REGULATION_PDF_CORPUS_QA_SPEC.md` and `app/src/lib/official-regulation-corpus.ts`. The local foundation evaluates user-supplied official PDF corpus packages for source metadata, checksum, page extraction evidence, page/section references, derived rule drafts, and corpus golden cases. QA-passing derived rules can be converted only into draft scope rules with source references; external clinical/legal approval remains required before active production routing or launch-gate closure. Verification passed with core tests 114/114, app tests 166/166, app lint, production build, and `npm run release:verify`. No real PDF was supplied or parsed, no corpus was approved, no launch gate was closed, no provider/channel/data path was connected, and production pilot remains `NO-GO`.

Post-Phase 65 direct 100-dietitian completion plan added on 2026-06-05: `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md` is now the canonical strategic roadmap. The plan locks production pilot to direct 100 dietitians x 50 clients (minimum 5,000 clients), no small production ring, no client-facing AI self-disclosure or doctor/dietitian/professional referral language, no yellow/red client-facing AI boundary reply, and green maximization through approved source-backed answerability. Phase 66 Product Communication Covenant Lock, Phase 67 Approved Source Answerability Engine, Phase 68 Green Maximization Intent Taxonomy, and Phase 69 Direct 5,000 Client Scale Foundation are now complete; the next implementation phase is Phase 70 User-Supplied Form Hardening after final forms are supplied, followed by official PDF ingestion, regulation permission graph, calibration, redaction/DSAR hardening, Gemini, WhatsApp, ops, R-405 closure, full 100x50 rehearsal, external gate closure, and direct pilot GO.

Phase 66 product communication covenant lock completed locally on 2026-06-05: added `docs/PHASE_66_PRODUCT_COMMUNICATION_COVENANT_LOCK_SPEC.md`, core `PRODUCT_COMMUNICATION_COVENANT_VERSION`, multilingual forbidden client-facing phrase detection, a PromptContext covenant instruction, provider output safety metadata for covenant failures, internal-only handoff acknowledgement text, mock-provider covenant self-checks, and send-time draft blocking for non-green AI drafts or covenant-violating draft edits. Verification passed with core tests 116/116, app tests 170/170, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. No real provider, channel, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected. Production pilot remains `NO-GO`.

Phase 67 approved source answerability engine completed locally on 2026-06-05: added `docs/PHASE_67_APPROVED_SOURCE_ANSWERABILITY_ENGINE_SPEC.md`, core `APPROVED_SOURCE_ANSWERABILITY_VERSION`, deterministic `evaluateApprovedSourceAnswerability`, pre-provider green answerability gating, `contextManifest.answerability` evidence, active diet plan field fallback when plan summary is empty, and tests proving missing sources/AI-generated-only sources do not call the provider while dietitian manual sources can support green answerability. Verification passed with core tests 120/120, app tests 171/171, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. No real provider, channel, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected. Production pilot remains `NO-GO`.

Phase 68 green maximization intent taxonomy completed locally on 2026-06-05: added `docs/PHASE_68_GREEN_MAXIMIZATION_INTENT_TAXONOMY_SPEC.md`, core `GREEN_INTENT_TAXONOMY_VERSION`, deterministic `evaluateGreenIntentTaxonomy`, pre-provider green intent audit/blocking after approved-source answerability, `contextManifest.greenIntent` evidence, and tests proving green intent families are recorded, sensitive green-looking calorie/macro/portion requests block before provider, and yellow/red decisions are not downgraded. Verification passed with core tests 122/122, app tests 171/171, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. No real provider, channel, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected. Production pilot remains `NO-GO`.

Phase 69 direct 5,000 client scale foundation completed locally on 2026-06-05: added `docs/PHASE_69_DIRECT_5000_CLIENT_SCALE_FOUNDATION_SPEC.md`, synthetic 100 dietitian x 50 client fixture generation, cursor pagination helpers, scale readiness evaluation, Phase 69 read-contract status for dashboard/internal-copilot/client create/client patch paths, and aggregate operational-health scale readiness fields. Verification passed with core tests 122/122, app tests 176/176, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. No real provider, channel, monitoring, secret manager, production Supabase migration, launch-gate approval, R-405 acceptance, or real-data path was connected. Production pilot remains `NO-GO`.

Phase 70 user-supplied form hardening completed locally on 2026-06-07: added `docs/PHASE_70_USER_SUPPLIED_FORM_HARDENING_SPEC.md`, `app/src/lib/phase-70-form-registry.ts`, `phase-70-form-hardening.ts`, `dietitian-forms.ts`, and seed-backed published client/dietitian schemas with prompt-access, answerability-role, and privacy metadata. Autopilot preflight now enforces Phase 70 minimum client field completeness; prompt summaries expose only `prompt_allowed` fields with bounded sanitization. Verification passed with core tests 122/122, app tests 185/185, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. No real provider, channel, monitoring, secret manager, production Supabase dietitian-form migration, launch-gate approval, R-405 acceptance, or real-data path was connected. Production pilot remains `NO-GO`.

Phase 75 Gemini provider gate completed locally on 2026-06-07: added `docs/PHASE_75_GEMINI_PROVIDER_GATE_SPEC.md`, `app/src/lib/phase-75-gemini-provider-gate.ts`, and tests for forbidden provider surfaces, green/yellow/red model routing, training/logging/retention policy artifacts, health-data eligibility checklist, PromptContext allowlist enforcement, required gate evidence, and `isPhase75RealGeminiEgressAllowed` behind `MANU_ALLOW_REAL_GEMINI`. Provider artifacts remain draft; real Gemini egress stays blocked without approved legal/privacy and provider/vendor gate evidence. Verification passed with core tests 122/122, app tests 216/216, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. No real Gemini API, Vertex AI connection, unpaid consumer surface, grounding/search/maps, tuning, file/image/audio input, launch-gate approval, R-405 acceptance, or real health-data egress was connected. Production pilot remains `NO-GO`.

Phase 76A dietitian chat form update proposals completed locally on 2026-06-08: added `docs/PHASE_76A_DIETITIAN_CHAT_FORM_UPDATE_PROPOSALS_SPEC.md`, tenant/client-scoped proposal records, Supabase migration/API routes, dashboard proposal review controls, deterministic allowlisted additive patch extraction, explicit apply/reject, stale context revision rejection, form/context/audit updates, draft invalidation, and Phase 74 export/anonymization coverage. Verification passed with core tests 122/122, app tests 222/222, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. No green/yellow/red routing change, real Gemini, real WhatsApp/Telegram, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real health-data path was connected. Production pilot remains `NO-GO`.

Phase 76I PromptContext and provider output guard hardening completed locally on 2026-06-08: added `docs/PHASE_76I_PROMPTCONTEXT_PROVIDER_OUTPUT_GUARD_SPEC.md`, core `food-rule-prompt-segments.js`, bounded food-rule PromptContext segments and provider instruction in `context-compiler.js`, `food-rule-output-guard-v0.1.0` in `response-quality-guard.js`, orchestrator compile/guard wiring, and Phase 75/mock provider segment allowlist updates. No dashboard UX, chat proposals, real Gemini egress, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification re-ran with core tests 153/153, app tests 250/250, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76H product ingredient verification completed locally on 2026-06-08: added `docs/PHASE_76H_PRODUCT_INGREDIENT_VERIFICATION_SPEC.md`, core `product-ingredient-verification.js`, app `product-ingredient-verification.ts`, food-rule engine verification consumption, simulator/runtime auto-evidence wiring, and tests for forbidden keyword block, uncertain label review, unknown source review, and diet-type conflict on product labels. No open web browsing, barcode/catalog providers, PromptContext segments, provider, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification re-ran with core tests 146/146, app tests 247/247, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76G clinical second-layer false-yellow calibration completed locally on 2026-06-08: added `docs/PHASE_76G_CLINICAL_SECOND_LAYER_FALSE_YELLOW_CALIBRATION_SPEC.md`, bumped second-layer version to `clinical-safety-second-layer-v0.2.0`, source-backed food-rule carve-out contract, food-rule-aware simulator risk classification, orchestrator fallback wiring, expanded second-layer JSONL fixtures, and app runtime tests. Carve-outs apply only to prospective food questions with explicit food-rule decisions; ingestion reactions, acute clinical markers, and severe allergy profiles remain yellow. External qualified dietitian approval is still required before production activation. No product catalog adapters, PromptContext segments, provider, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification re-ran with core tests 140/140, app tests 242/242, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76F intent-specific answerability completed locally on 2026-06-08: added `docs/PHASE_76F_INTENT_SPECIFIC_ANSWERABILITY_SPEC.md`, core `intent-specific-answerability.js`, orchestrator intent-family source matching with food-rule alignment, structured food-rule source categories, substitution legacy plan/manual fallback, and yellow/red answerability bypass. No clinical second-layer carve-outs, product catalog adapters, provider, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification re-ran with core tests 139/139, app tests 240/240, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76E food rule engine completed locally on 2026-06-08: added `docs/PHASE_76E_FOOD_RULE_ENGINE_SPEC.md`, core `food-rule-engine.js`, app `food-rule-runtime.ts`, orchestrator audit-only `contextManifest.foodRule`, and simulator structured-food-rule wiring. No intent-specific answerability gating, clinical second-layer carve-outs, provider, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification re-ran with core tests 132/132, app tests 238/238, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76D structured food rule data model and form upgrade completed locally on 2026-06-08: added `docs/PHASE_76D_STRUCTURED_FOOD_RULE_DATA_MODEL_SPEC.md`, `app/src/lib/phase-76d-food-rule-fields.ts`, and `app/src/lib/phase-76d-food-rule-model.ts`; extended the Phase 70 client form registry with 13 structured food-rule fields; bumped registry version to `phase-76d-food-rule-registry-v1`; extended autopilot qualification with structured food-rule completeness checks; synced allergies/restricted foods on form save; and seeded demo structured food rules. No orchestrator food-rule engine, provider, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification re-ran with core tests 122/122, app tests 234/234, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76C structured food rule green capacity spec completed locally on 2026-06-08: added `docs/PHASE_76C_STRUCTURED_FOOD_RULE_GREEN_CAPACITY_SPEC.md` as the canonical PRD/tech spec for source-backed forbidden-food reminders, allowed-food confirmations, approved equivalent substitutions, diet-type compatibility, optional skip tolerance, and trusted product-ingredient verification. This phase changed documentation only; no runtime behavior, schema, provider, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification re-ran with core tests 122/122, app tests 226/226, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76B expanded chat form safety updates completed locally on 2026-06-08: added `docs/PHASE_76B_EXPANDED_CHAT_FORM_SAFETY_UPDATE_SPEC.md`, expanded chat proposals to Phase 70 clinical/safety form flags and supported `healthProfile` mirrors, added editable proposal rows, allowed mixed supported form patches plus manual-control warnings, and kept AI active/passive, AI mode, channel permission, red lock, yellow hold, and autopilot/reactivation controls out of chat mutation. Verification passed with core tests 122/122, app tests 226/226, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. No real Gemini extraction, real provider/channel, launch-gate approval, R-405 acceptance, or real health-data path was connected. Production pilot remains `NO-GO`.

Phase 74 data lifecycle, export, anonymization and DSAR policy completed locally on 2026-06-07: added `docs/PHASE_74_DATA_LIFECYCLE_DSAR_SPEC.md`, `app/src/lib/phase-74-data-lifecycle-policy.ts`, and tests for retention policy, export manifest/checksum contract, DSAR SLA records, transactional redaction with draft invalidation and invariant evaluation, and operational exclusion for removed clients. Redaction marker standardized to `REDACTED_BY_PHASE74_POLICY` in `data-governance.ts`. Policy artifacts remain draft; production lifecycle stays blocked without external legal/privacy approval. Verification passed with core tests 122/122, app tests 209/209, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. No production Supabase transactional RPC migration, provider, channel, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected. Production pilot remains `NO-GO`.

Phase 73 health regulation calibration completed locally on 2026-06-07: added `docs/PHASE_73_HEALTH_REGULATION_CALIBRATION_SPEC.md`, `app/src/lib/phase-73-health-regulation-calibration.ts`, and tests for the user-supplied health regulation decision matrix. Phase 73 records 14 official source references, 27 decision areas, decision priority order, 15 golden calibration cases, copilot vs autopilot evaluation, and acceptance metrics with zero unsafe-green violations on the bundled suite. Calibration artifacts remain draft; active production calibration stays blocked without approved clinical taxonomy evidence. Verification passed with core tests 122/122, app tests 204/204, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. No active routing activation, provider, channel, monitoring, secret manager, production Supabase migration, launch-gate approval, R-405 acceptance, or real-data path was connected. Production pilot remains `NO-GO`.

Phase 72 regulation permission graph completed locally on 2026-06-07: added `docs/PHASE_72_REGULATION_PERMISSION_GRAPH_SPEC.md`, `app/src/lib/phase-72-permission-graph.ts`, and tests for the user-supplied legal/privacy, clinical interpretation, and permission graph pack. Phase 72 records draft forbidden, draft-only, plan answerability, general education, never-prompt, prompt-allowed, covenant phrase, legal privacy routing, clinical escalation routing, and mixed-intent fail-closed artifacts with Phase 71 source references. `evaluatePhase72PermissionRouting` enforces fail-closed mixed intent and privacy-gate precedence; active production routing remains blocked without approved launch-gate evidence. Verification passed with core tests 122/122, app tests 197/197, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. No active routing activation, provider, channel, monitoring, secret manager, production Supabase migration, launch-gate approval, R-405 acceptance, or real-data path was connected. Production pilot remains `NO-GO`.

Phase 71 Turkiye official health source ingestion completed locally on 2026-06-07: added `docs/PHASE_71_TURKIYE_OFFICIAL_HEALTH_SOURCE_INGESTION_SPEC.md`, `app/src/lib/phase-71-turkiye-official-sources.ts`, and tests for the user-supplied 14-source Turkiye official source manifest. Phase 71 records P0/P1/P2 priorities, official URLs, suggested file names, critical sections, and green/yellow/red impact notes, then routes externally supplied PDF artifact evidence through the existing Phase 65 QA contract. Metadata-only sources fail closed, unknown artifact source ids fail, and QA-passing derived rules remain draft-only until external legal/clinical approval. Verification passed with core tests 122/122, app tests 190/190, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. No real PDF download/parser, provider, channel, monitoring, secret manager, production Supabase migration, launch-gate approval, R-405 acceptance, or real-data path was connected. Production pilot remains `NO-GO`.

Phase 61 scope guard (RAG + LLM) second layer mock-first completed locally on 2026-06-04: added `docs/PHASE_61_SCOPE_GUARD_RAG_SECOND_LAYER_SPEC.md`, core `scope-guard.js` (`scope-rag-v0.1.0`) with monotonic `mergeScopeDecision`, app mock lexical retrieval and deterministic evaluator, `scope-guard-runtime` wiring in simulator risk path, Supabase `scope_*` tables with tenant read / system write RLS, raw-text-free `scope_guard_evaluations` audit, operational-health corpus signals, placeholder draft corpus (no-op until approved), and fail-closed disconnected real embedding/LLM behind clinical taxonomy gate + `MANU_ALLOW_REAL_SCOPE_GUARD=true`. Combined classifier version: `dietetic-risk-v0.3.1+clinical-safety-second-layer-v0.1.0+scope-rag-v0.1.0`. Verification passed with core tests 112/112, app tests 150/150, app lint, and `npm run release:verify`. Production pilot remains `NO-GO`; R-310 partially mitigated in local prototype only.

Phase 77A manual source authority rebaseline completed locally on 2026-06-10: added `docs/PHASE_77A_MANUAL_SOURCE_AUTHORITY_REBASELINE_SPEC.md`, moved WhatsApp production adapter after the Phase 77A-77K manual source authority track, locked v1 out-of-catalog food inference to deterministic catalog/alias/keyword matching only, defined Food Decision V2 semantics, and preserved production pilot `NO-GO`.

Phase 77B manual source authority boundary completed locally on 2026-06-10: added `docs/PHASE_77B_MANUAL_SOURCE_BOUNDARY_SPEC.md`, blocked chat proposal create/apply with `chat_source_mutation_disabled`, removed dashboard propose/apply controls, preserved read-only historical proposals, and kept internal copilot read-only plus Critical Context panel-only.

Phase 77C client personal form v2 completed locally on 2026-06-10: added `docs/PHASE_77C_CLIENT_PERSONAL_FORM_V2_SPEC.md` and loaded the user-supplied first client form into the dynamic form registry with phone/WhatsApp identity, general and goal flexibility, anthropometric/lifestyle/medical/nutrition-history/digestive fields, and prompt visibility metadata.

Phase 77D master food catalog hierarchy completed locally on 2026-06-10: added `docs/PHASE_77D_MASTER_FOOD_CATALOG_SPEC.md`, extracted the user-supplied `manual.xlsx` / `Besin Veritabani` sheet into a versioned catalog with 12 main categories, 113 subcategories, 518 foods, workbook/record-set checksums, stable ids, QA validation, exact lookup, and dashboard forbidden checkbox expansion for main category, subcategory, and food selections. Food Decision Engine V2, alias/ingredient matching, menu forms, production approval, provider/channel integration, and R-405 closure remain open.

Tasks:

Phase 77E client food-rule profile v2 completed locally on 2026-06-10: added `docs/PHASE_77E_CLIENT_FOOD_RULE_PROFILE_V2_SPEC.md`, first-class profile state/API/Supabase persistence, simplified dashboard food-rule UI with catalog search and conflict warnings, export/redaction coverage, and legacy form-answer bridge for Phase 76 runtime compatibility.

Phase 77F menu plan v1 completed locally on 2026-06-10: added `docs/PHASE_77F_MENU_PLAN_V1_SPEC.md`, four-template menu plan state/API/Supabase persistence, active-menu selection with derived legacy diet-plan summary, food-profile conflict detection, `MenuPlanPanel` dashboard UI, export/redaction coverage, and direct `dietPlan.summary` patch lock when an active menu exists.

Phase 77G Food Decision Engine V2 completed locally on 2026-06-10: added `docs/PHASE_77G_FOOD_DECISION_ENGINE_V2_SPEC.md`, deterministic food/menu decision engine with profile V2, active menu, catalog matching, flexibility precedence, Phase 76H product verification, legacy 76E fallback, simulator/orchestrator wiring, and Phase 68 green-intent recalibration for safe off-menu food flexibility.

Phase 77H PromptContext/answerability/output guard V2 completed locally on 2026-06-10: added `docs/PHASE_77H_PROMPTCONTEXT_ANSWERABILITY_OUTPUT_GUARD_V2_SPEC.md`, V2 PromptContext segments, intent-specific answerability `v0.2.0`, output guard V2, orchestrator compile/answerability/guard wiring, permission-graph V2 mapping, and provider allowlist updates.

Phase 77I simplified dietitian UX completed locally on 2026-06-10: added `docs/PHASE_77I_SIMPLIFIED_DIETITIAN_UX_SPEC.md`, restructured client detail into seven tabs (Overview, Personal Form, Food Rules, Menu, Critical Context, AI Copilot, Export) with status summaries, conflict review panels, progressive disclosure, empty/error states, and i18n for all seven supported languages. Moved FoodRulesPanel and MenuPlanPanel from Forms view to dedicated client detail tabs. Forms view is now schema-management only.

Phase 77J DOCX/PDF export and data lifecycle v1.2 completed locally on 2026-06-10: added `docs/PHASE_77J_DOCX_PDF_EXPORT_AND_DATA_LIFECYCLE_V1_2_SPEC.md`, client-facing menu export document builder, server-only DOCX/PDF binary generation (`docx`, `pdfmake`), `GET /api/clients/[id]/menu-plans/export`, Phase 74 export bump to `phase74-export-v1.2` with `personal_form_v2.json` and `catalog_version_refs.json`, Export tab preview/download UI, and Turkish rendering tests. Verification passed with `npm run release:verify`: core tests 173/173, app tests 325/325, lint with two pre-existing warnings, production build, and only documented R-405 findings.

Phase 77K calibration, 100x50 rehearsal, and evidence closure completed locally on 2026-06-10: added `docs/PHASE_77K_CALIBRATION_REHEARSAL_EVIDENCE_CLOSURE_SPEC.md`, Food Decision V2 golden suite (`food-decision-v2-golden-cases.jsonl`, 14 categories), V2 scale rehearsal (`phase-77k-food-mix-rehearsal.ts`), calibration evidence aggregator (`phase-77k-calibration-evidence.ts`), and operational-health closure signals. Golden suite and full 100x50 V2 rehearsal pass with `unsafe_green_count = 0`; Phase 76O integration checks remain green. Verification passed with `npm run release:verify`: core tests 173/173, app tests 337/337, lint with two pre-existing warnings, production build, and only documented R-405 findings. Manual source authority track is closed; WhatsApp production adapter is deferred until Phase 77M-77Y AI Quality Program is complete.

Phase 77L continuity reconciliation and worktree closure completed locally on 2026-06-13: added `docs/PHASE_77L_CONTINUITY_RECONCILIATION_AND_WORKTREE_CLOSURE_SPEC.md`, aligned stale continuity/evidence docs to the Phase 77K baseline, restored the historical Phase 76E spec in the evidence trail, treated `agent.md` -> `codex.md` as the project-rule filename migration, made app tests deterministic without reducing the 53-file/337-test scope, made `release:verify` clean generated `.next` output before production build, and closed the dirty Phase 77E-77K worktree into a coherent continuation point. `git diff --check`, app `npm test`, and `npm run release:verify` passed with core 173/173, app 337/337, lint with two pre-existing warnings, production build, and only documented R-405 findings. No real provider/channel, launch-gate approval, production pilot GO, real-data handling, or R-405 status changed.

Phase 77M-77Y AI Quality Program master rebaseline and spec completed on 2026-06-13: added `docs/PHASE_77M_MASTER_REBASELINE_AND_SPEC.md`, finalized `docs/PHASE_77M_77Y_AI_QUALITY_MASTER_PLAN.md`, recorded superseded alternate Phase 78A-M numbering, locked core-owned `responsePlan`, deterministic templates, manifest-first grounding, fail-closed unknown-intent handling, and `normalize-safety-text.js` as the single normalization source to extend. This planning closure adds no runtime behavior, provider/channel connection, launch-gate approval, production pilot GO, real-data handling, or R-405 change.

Phase 77Z repository cleanup and Cursor plan migration completed locally on 2026-06-22: added `docs/PHASE_77Z_REPOSITORY_CLEANUP_AND_CURSOR_PLAN_MIGRATION_SPEC.md`, removed the obsolete tracked `.cursor/plans/food_green_expansion_7671797e.plan.md`, documented that its content is preserved in canonical Phase 76C-76Q specs and Phase 76P continuity evidence, retained runtime/evidence datasets such as the Food Understanding V3 alias JSON/JSONL files, and aligned continuity docs to the post-77Y baseline. This phase changed documentation and repository organization only; no runtime behavior, provider/channel connection, launch-gate approval, production pilot GO, real-data handling, or R-405 status changed.

Phase 77AA WhatsApp mock/gated adapter PRD and scope lock completed locally on 2026-06-22: added `docs/PHASE_77AA_WHATSAPP_MOCK_GATED_ADAPTER_PRD_AND_SCOPE_LOCK_SPEC.md`, locked the post-77Z adapter track order (77AB–77AH), recorded the canonical no-live decision, gate conditions for future live operation, data minimization rules, and edge-case matrix on top of Phase 7 adapter contracts, `channel-adapters.ts`, and Phase 46 group quarantine. This phase changed documentation only; no runtime behavior, provider/channel connection, launch-gate approval, production pilot GO, real-data handling, or R-405 status changed.

Phase 77AB WhatsApp Cloud payload normalization completed locally on 2026-06-22: added `docs/PHASE_77AB_WHATSAPP_CLOUD_PAYLOAD_NORMALIZATION_SPEC.md`, `app/src/lib/whatsapp-cloud-payload-normalizer.ts`, `whatsapp-cloud-payload-golden-cases.jsonl`, Phase 77AB tests, and extended `NormalizedInboundChannelEvent` with conversation/message metadata. Parser golden cases cover direct text, missing event id, empty body, unsupported media, group context, and malformed payload fail-closed behavior. No API route, real webhook, provider/channel connection, launch-gate approval, production pilot GO, real-data handling, or R-405 status changed.

Phase 77AC disabled webhook boundary and identity quarantine completed locally on 2026-06-22: added `docs/PHASE_77AC_DISABLED_WEBHOOK_BOUNDARY_AND_IDENTITY_QUARANTINE_SPEC.md`, `POST /api/whatsapp/webhook` mock boundary (`MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK`), `whatsapp-mock-webhook.ts`, WhatsApp identity normalization in `channel-adapters.ts`, group quarantine wiring, and Phase 77AC tests. No real webhook verification, credentials, outbound send, launch-gate approval, production pilot GO, real-data handling, or R-405 status changed.

Phase 77AF adapter operational health and rollback controls completed locally on 2026-06-22: added `docs/PHASE_77AF_ADAPTER_OPERATIONAL_HEALTH_AND_ROLLBACK_CONTROLS_SPEC.md`, `channel-adapter-health.ts`, `channel-adapter-rollback.ts`, operational-health snapshot fields, and Phase 77AF tests. No real monitoring integration, launch-gate approval, production pilot GO, real-data handling, or R-405 status changed.

Phase 77AG 100x50 WhatsApp-like channel replay rehearsal completed locally on 2026-06-22: added `docs/PHASE_77AG_100X50_WHATSAPP_LIKE_CHANNEL_REPLAY_REHEARSAL_SPEC.md`, `phase-77ag-channel-replay-rehearsal.ts`, `channel-replay-scenarios.jsonl`, hard-zero channel replay gates, operational-health aggregate fields, `rehearse:channel:replay`, and Phase 77AG tests. No real webhook, provider/channel connection, launch-gate approval, production pilot GO, real-data handling, or R-405 status changed.

Phase 77AH WhatsApp adapter evidence closure completed locally on 2026-06-22: added `docs/PHASE_77AH_WHATSAPP_ADAPTER_EVIDENCE_CLOSURE_SPEC.md`, `phase-77ah-whatsapp-adapter-evidence-closure.ts`, synchronized continuity/pilot/gate/risk docs, and recorded 77AA–77AG track closure with hard-zero channel replay sample evidence. No real WhatsApp/Gemini connection, launch-gate approval, production pilot GO, real-data handling, or R-405 status changed.

Phase 77AI production operations preparation completed locally on 2026-06-22: added `docs/PHASE_77AI_PRODUCTION_OPERATIONS_PREPARATION_SPEC.md`, `phase-77ai-production-operations-preparation.ts`, ops placeholder manifest, internal mock health wiring, and explicit missing-evidence lists for open ops launch gates. No real monitoring/secret manager, launch-gate approval, production pilot GO, real-data handling, or R-405 status changed.

Phase 78 dependency and R-405 closure completed locally on 2026-06-29: added `docs/PHASE_78_DEPENDENCY_R405_CLOSURE_SPEC.md` and re-ran the Phase 22 stable patch procedure. Stable `next@latest` is `16.2.9` but still bundles nested `postcss@8.4.31`; `eslint-config-next@latest` is `16.2.9`; production audit still reports only the known moderate R-405 `next`/`postcss` findings and the rejected `next@9.3.3` downgrade. No dependency files were changed, no launch gate was closed, no R-405 risk acceptance was supplied, and production pilot remains `NO-GO`. Verification passed with `git diff --check`, core tests 225/225, app tests 428 passed and 2 skipped across 73 files, lint with two pre-existing warnings, production build, and only documented R-405 findings.

Phase 79 production-scale hardening and full 100x50 rehearsal closure completed locally on 2026-06-29: added `docs/PHASE_79_PRODUCTION_SCALE_HARDENING_AND_FULL_100X50_REHEARSAL_SPEC.md`, `/api/app-state?view=windowed`, fail-closed notification windows, scoped client create/patch responses without post-mutation broad reloads, bounded internal copilot loaders, lifecycle redaction evidence, current RLS evidence status, unified production-scale metrics, and continuity/risk/gate closure. `npm run rehearse:production-scale:79g` passed with expanded AI quality 5,000 cases, full mock channel replay, Phase 79 full acceptance tests, and `npm run release:verify` (core 225/225, app 489 passed / 4 skipped across 79 files, production build, only documented R-405 findings). Production pilot remains `NO-GO`; R-405 remains open; current RLS re-run is pending when local Supabase is unavailable.

Phase 82 final external readiness closure completed locally on 2026-06-30 across 82A-82G as a fail-closed repo-local project-completion layer: evidence gap ledger, blocker reconciliation, final completion report, launch activation firewall, continuity closure, and verification refresh. Baseline outcome is `NO_GO_EXTERNAL_PREREQUISITES_OPEN`; Phase 82G records `repoLocalClosureComplete: true` with verification `blocked` because current RLS is skipped/pending; production pilot remains `NO-GO`; `productionPilotStarted` remains `false`; targeted Phase 82 tests passed (5 files, 31/31); `npm run release:verify` passed with core 225/225 and app 595 passed / 4 skipped across 94 files. Phase 82 track is closed.

Phase 81 direct production pilot GO evaluation completed locally on 2026-06-30 as a fail-closed framework: Phase 81F verification refresh records blocked current RLS evidence, and Phase 81G final readiness derives eligibility from Phase 80. Baseline outcome remains `NO_GO_NOT_ELIGIBLE`; production pilot remains `NO-GO`; `productionPilotStarted` remains `false`; all eight launch gates remain open; R-405 remains open; R-406 current re-run is pending when local Supabase is unavailable. Targeted Phase 81 tests passed (6 files, 46/46).

1. Complete external launch-gate closure, R-405 technical resolution or formal acceptance, and current RLS evidence pass before Phase 82 can reach `READY_FOR_EXTERNAL_CONTROLLED_LAUNCH_AUTHORIZATION`.
2. Keep real WhatsApp, Telegram, Gemini, monitoring, secrets, and real client health data disconnected until external gates close.
4. Keep real Gemini/WhatsApp/monitoring/secret/real data disconnected until their gated phases.
5. Accept official regulation PDFs in Phase 71 and use the Phase 65 QA foundation; do not activate official corpus production routing until external legal/clinical launch gates close even though Phase 72 draft permission graph artifacts exist.
5. Use `docs/PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md`, `docs/PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md`, `docs/PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md`, `docs/PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md`, `docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md`, `docs/PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md`, `docs/PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md`, `docs/PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, and `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md` to collect external approval evidence without storing secrets or raw client data in repo docs.
6. Re-check R-405 again only through the `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md` procedure before any future dependency edit or dependency gate closure attempt.

Definition of done:

- App runs locally.
- Dashboard works on desktop and mobile widths.
- App is installable as a PWA shell.
- Dietitian can create a client.
- Dietitian can activate/deactivate AI per client.
- Dietitian can set persona and AI mode per client.
- Simulated inbound messages produce correct decisions.
- Conversation timeline distinguishes client, AI, dietitian, and system messages.
- No real WhatsApp or Telegram credentials are required yet.

Phase 77Q claim manifest and output grounding v1 completed on 2026-06-13: added `docs/PHASE_77Q_CLAIM_MANIFEST_AND_OUTPUT_GROUNDING_V1_SPEC.md`, core `claim-manifest-v1.js`, manifest generation from plan/template/sourceRefs/food-decision authority, orchestrator fail-closed on incomplete provider manifests, `guardProviderOutput` `claim_outside_manifest` blocking, JSONL golden cases, and core/app tests. Verification passed with `git diff --check`, `app` `npm test` (354/354), and `npm run release:verify` (core 193/193). Production pilot remains `NO-GO`. Next implementation phase was Phase 77R Food Understanding V3.

Phase 77R food understanding v3 completed on 2026-06-13: added `docs/PHASE_77R_FOOD_UNDERSTANDING_V3_SPEC.md`, core `food-understanding-v3.js`, checksum-backed alias dictionary, brand `needs_label` fail-closed routing, recipe-gated mixed-dish handling, Food Decision Engine V2 wiring, JSONL golden cases, and core/app tests. Verification passed with `git diff --check`, `app` `npm test` (361/361), and `npm run release:verify` (core 196/196). Production pilot remains `NO-GO`. Next implementation phase was Phase 77S Dietitian Voice Engine V2.

Phase 77S dietitian voice engine v2 completed on 2026-06-13: added `docs/PHASE_77S_DIETITIAN_VOICE_ENGINE_V2_SPEC.md`, core `style-dna-v2.js`, tenant/dietitian-scoped `styleDna`, edit-history learning lifecycle, hard style guards, style-poisoning golden cases, and core/app tests. Verification passed with `git diff --check`, `app` `npm test` (366/366), production build, and core tests 200/200. Production pilot remains `NO-GO`. Next implementation phase was Phase 77T AI Quality Evaluation Harness V1.

Phase 77T AI quality evaluation harness v1 completed on 2026-06-13: added `docs/PHASE_77T_AI_QUALITY_EVALUATION_HARNESS_V1_SPEC.md`, core `ai-quality-evaluation-harness-v1.js`, JSONL seed cases with deterministic 100-case release subset in `release:verify`, `npm run rehearse:ai` for 1000 mock-provider cases, structured responsePlan/intent/replyMode/template/claimManifest/sourceRefs/block-reason assertions, multi-turn clarification/label flows, and adversarial metadata-leak detection. Verification passed with `git diff --check`, `app` `npm test` (369/369), `npm run release:verify`, `npm run rehearse:ai` (1000/1000), and core tests 205/205. Production pilot remains `NO-GO`. Next implementation phase was Phase 77U Clinical Red-Team And RD Review Packet.

Phase 77U clinical red-team and RD review packet completed on 2026-06-13: added `docs/PHASE_77U_CLINICAL_RED_TEAM_AND_RD_REVIEW_PACKET_SPEC.md`, `docs/PRODUCTION_PILOT_RD_AI_QUALITY_REVIEW_PACKET.md`, core `clinical-red-team-v1.js`, JSONL RD/red-team cases, zero unsafe/yellow-red client-send assertions, and core/app Phase 77U tests. Verification passed with `git diff --check`, `app` `npm test`, `npm run release:verify`, and core clinical red-team tests. Production pilot remains `NO-GO`. Next implementation phase was Phase 77V Copilot Quality Workflow V1.

Phase 77X expanded 100x50 AI rehearsal and risk register completed on 2026-06-14: added `docs/PHASE_77X_EXPANDED_AI_REHEARSAL_AND_RISK_REGISTER_SPEC.md`, core `ai-quality-expanded-rehearsal-v1.js`, app `phase-77x-expanded-ai-rehearsal.ts`, operational-health AI quality fields, `rehearse:ai:expanded`, and risk-register updates for R-419/R-420/R-421/R-423 plus alias blast-radius reporting on R-417. Production pilot remains `NO-GO`. Phase 77Y continuity, evidence, and launch gate update completed on 2026-06-14: added `docs/PHASE_77Y_CONTINUITY_EVIDENCE_AND_LAUNCH_GATE_UPDATE_SPEC.md`, `phase-77y-ai-quality-program-closure.ts`, synchronized continuity/pilot/gate docs, and recorded 77M-77Y program closure with hard-zero AI quality evidence. Phase 77AA WhatsApp mock/gated adapter PRD and scope lock completed on 2026-06-22: added `docs/PHASE_77AA_WHATSAPP_MOCK_GATED_ADAPTER_PRD_AND_SCOPE_LOCK_SPEC.md` and locked the 77AB–77AH mock/gated adapter track. Phase 77AB WhatsApp Cloud payload normalization completed on 2026-06-22: added `docs/PHASE_77AB_WHATSAPP_CLOUD_PAYLOAD_NORMALIZATION_SPEC.md`, `whatsapp-cloud-payload-normalizer.ts`, and parser golden cases. Phase 77AC disabled webhook boundary and identity quarantine completed on 2026-06-22: added `docs/PHASE_77AC_DISABLED_WEBHOOK_BOUNDARY_AND_IDENTITY_QUARANTINE_SPEC.md`, `POST /api/whatsapp/webhook`, and mock identity/group quarantine wiring. Phase 77AD opt-out, service window, and template policy mock completed on 2026-06-22: added `docs/PHASE_77AD_OPT_OUT_SERVICE_WINDOW_TEMPLATE_POLICY_MOCK_SPEC.md`, `whatsapp-channel-policy-mock.ts`, and outbound policy gates. Next implementation phase is Phase 77AE Outbound delivery ledger and mock send failures (mock/gated only).

## Non-Negotiable Launch Gates

Before real health data or production messaging:

- Legal/privacy review completed.
- Medical-device or clinical-decision-support classification reviewed.
- Dietitian credential requirements defined.
- Client-facing legal and permission documents completed.
- WhatsApp healthcare-use feasibility reviewed.
- Gemini/provider data-retention and health-data eligibility reviewed.
- Clinical taxonomy approved by a qualified dietitian.
- Red/yellow/green golden tests exist.
- Incident response and deletion workflows exist.

## Current Next Step - Phase 84 Commercial SaaS Relaunch

As of 2026-07-02, the sandbox commercial stack has been validated on `https://siriusai.store` with HTTPS and Stripe test webhook delivery. Payment provisioning works through invite consumption, tenant creation, active entitlement creation, and billing ledger writes. The remaining user-facing gap is post-payment onboarding: a paid customer still needs a magic-link login and tenant claim flow that creates `tenant_memberships` plus a `dietitians` profile before entering the real dashboard.

Next canonical spec: `docs/PHASE_84_COMMERCIAL_SAAS_RELAUNCH_AND_ONBOARDING_SPEC.md`.

Phase 84 priorities:

- SiriusAI professional public landing site.
- `/login` magic-link customer access.
- Contact form plus `mailto:olkuenver@gmail.com`.
- Post-payment onboarding/claim from Stripe `session_id`.
- Admin surface on `admin.siriusai.store` with Supabase allowlisted admin auth.
- Continued sandbox-only billing and `NO-GO` production pilot posture.

## Current P85-IF Post-Closure Baseline - 2026-07-11

Phase 85 P85-IF is closed after a post-closure architecture audit and remediation pass. The audit fixed R1 message-provenance tenant integrity, R2 structured retrieval baseline/resolution authority, R3 activation/inbound lock ordering, and R6 runtime export leak enforcement. R4 and R5 were reviewed with no new code findings.

Evidence: `docs/PHASE_85_IF_REMEDIATION_POST_CLOSURE_AUDIT_EVIDENCE.md`, plus dedicated R1/R2/R3 evidence documents. Verification passed targeted app/core tests, local Supabase reset, local RLS 30/30, lint, build, full app 828 passed / 4 skipped, full core 234/234, channel replay, and production-scale rehearsal. Stage 4B planning is now complete and its approved implementation is next. Production pilot remains `NO-GO`; R-405 remains open; real providers/channels/health-data paths remain disabled.

## Phase 85 Stage 4B-2 Phase 4 - 2026-07-12

Historical Phase 4 checkpoint: actor-aware bounded read APIs completed in `docs/PHASE_85_STAGE_4B_2_PHASE_4_READ_APIS_EVIDENCE.md`. Phases 5-11 and remediation R0-R7 subsequently closed. This is not an active handoff; Stage 4C is current. Production pilot remains `NO-GO`; R-405 remains open.

## Phase 85 Stage 4B-2 Phase 3 - 2026-07-12

Historical Phase 3 checkpoint: bounded list/detail transcript projection completed in `docs/PHASE_85_STAGE_4B_2_PHASE_3_BOUNDED_PROJECTION_EVIDENCE.md`. Phases 4-11 and remediation R0-R7 subsequently closed. This is not an active handoff.

## Phase 85 Stage 4B-2 Phase 2 - 2026-07-12

Historical Phase 2 checkpoint: durable actor-owned conversation receipts completed while that checkpoint's RLS run was skipped. Phases 3-11, remediation R0-R7, and zero-skip RLS subsequently closed. Evidence: `docs/PHASE_85_STAGE_4B_2_PHASE_2_RECEIPT_PERSISTENCE_RLS_EVIDENCE.md`. This is not an active handoff.

## Phase 85 Stage 4B-2 Phase 1 - 2026-07-12

Historical Phase 1 checkpoint: the pure domain/DTO/authorization projection boundary completed while that checkpoint's RLS run was skipped. Phases 2-11, remediation R0-R7, and zero-skip RLS subsequently closed. Evidence: `docs/PHASE_85_STAGE_4B_2_PHASE_1_DOMAIN_DTO_AUTHORIZATION_EVIDENCE.md`. This is not an active handoff.

## Phase 85 Stage 4B-2 Phase 0 Documentation Lock - 2026-07-12

Phase 0 is complete as a documentation-only lock. The full action plan and evidence are `docs/PHASE_85_STAGE_4B_2_MESAJLASMA_ACTION_PLAN.md` and `docs/PHASE_85_STAGE_4B_2_PHASE_0_DOCUMENTATION_EVIDENCE.md`. Runtime work starts only at Stage 4B-2 Phase 1. The lock preserves mock-only providers/channels, Stage 4B alert/notification boundaries, P85-IF authority, production `NO-GO`, R-405 open status, and the existing auth/onboarding/billing/admin/entitlement/PWA contracts.

## Approved Next Step - Phase 85 Stage 4B-2 Mesajlasma

Stage 4B implementation and post-closure remediation are recorded under `docs/PHASE_85_STAGE_4B_POST_CLOSURE_REMEDIATION_EVIDENCE.md` and `docs/PHASE_85_STAGE_4B_UYARI_VE_BILDIRIMLER_SPEC.md`. Stage 4B-2 Mesajlasma is complete; evidence in `docs/PHASE_85_STAGE_4B_2_CLOSURE_EVIDENCE.md` and `docs/PHASE_85_STAGE_4B_2_MESAJLASMA_SPEC.md`. The historical RLS block was later superseded by R7 and advisory hardening. **Next:** Stage 4B-3 Multimodal Gorsel Guvenligi ve Yanit Orkestrasyonu. Preserve `NO-GO`, R-405, mock-only providers/channels, existing auth/onboarding/billing/admin/entitlement/PWA contracts, and append-only migrations.
## Phase 85 Stage 4B-2 Post-Closure Remediation R0 - 2026-07-12

Historical R0 checkpoint: the Stage 4B-2 audit opened remediation findings and locked `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_ACTION_PLAN.md`. R1-R7 subsequently closed. This is not an active handoff; Stage 4C is current. Production pilot remains `NO-GO`; R-405 remains open.

## Phase 85 Stage 4B-2 Post-Closure Remediation R1 - 2026-07-12

Historical R1 checkpoint: the domain/DTO/authorization projection contract completed. R2-R7 subsequently closed; current work is Stage 4B-3.

## Phase 85 Stage 4B-2 Post-Closure Remediation R2 - 2026-07-12

Historical R2 checkpoint: bounded Supabase read RPCs and receipt/RLS guards completed while local RLS was then blocked. R3-R7 and zero-skip RLS subsequently closed; this is not an active handoff.
## Phase 85 Stage 4B-2 Post-Closure Remediation R3 - 2026-07-12

Historical R3 checkpoint: server-side atomic mutation/idempotency correction completed. R4-R7 subsequently closed; this is not an active handoff. Production pilot remains `NO-GO`.
## Phase 85 Stage 4B-2 Post-Closure Remediation R4 - 2026-07-12

Historical R4 checkpoint: client hook, deep-link, unread aggregate, and responsive UI correction completed while full app/RLS were then unclaimed. R5-R7 subsequently closed those gates; this is not an active handoff.
## Phase 85 Stage 4B-2 Post-Closure Remediation R5 - 2026-07-13

Historical R5 checkpoint: scale, replay, lifecycle/export, accessibility, and full regression passed while RLS was then skipped. R6/R7 subsequently supplied zero-skip RLS and SQL buffer evidence; this is not an active handoff. Production remains `NO-GO`.

## Phase 85 Stage 4B-2 Post-Closure Remediation R6 - 2026-07-13

R6 ran the independent full verification gate. All repository/runtime checks passed, including core 234/234, app 959/6 skipped, full scale/replay, visual/accessibility 8/8, lint, build, audit exception handling, diff, and secret/name scans. The original environment block was later resolved through real RLS and SQL buffer execution and is superseded by R7. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R6_EVIDENCE.md`. Production remains `NO-GO`.

## Phase 85 Stage 4B-2 Post-Closure Remediation R7 - 2026-07-13

R7 closes the remediation track locally after the R6 environment prerequisite was re-run: local reset passed, RLS passed 35/35 with zero skips, and real list/detail SQL buffer plans were captured and evaluated with R2 bounded SQL and R5 10k scale evidence. Canonical documents and R-4B2-01 through R-4B2-10 are reconciled. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R7_EVIDENCE.md`. Stage 4B-3 is the next authorized Phase 85 unit; production remains `NO-GO` and R-405 remains open.
