# MANU-AI

MANU-AI is a supervised AI messaging assistant for dietitians. It is designed to help dietitians manage client conversations, draft safe replies, and route clinically sensitive nutrition or health messages to human review.

## Current Status

**Current authority (2026-08-19):** Stage 6 Faz 1 client domain bounded contracts are implemented locally. Stage 5 remains `STAGE_5_CLOSED`. Production remains independently `NO-GO`. Canonical Stage 6 plan: `docs/PHASE_85_STAGE_6_DASHBOARD_CORE_WORKFLOWS_ACTION_PLAN.md`. Faz 1 evidence: `docs/PHASE_85_STAGE_6_PHASE_1_CLIENT_DOMAIN_CONTRACTS_EVIDENCE.md`.

**Current authority (2026-08-18):** Stage 5 is closed with canonical verdict `STAGE_5_CLOSED`. The physical iOS/Android PWA evidence is approved, the Stage 5 RLS gate is zero-skip, and the shell/closure gates pass. Canonical authority: `docs/PHASE_85_STAGE_5_CLOSURE_DECISION.json`, supported by `docs/PHASE_85_STAGE_5_REAL_DEVICE_VALIDATION_REPORT.json`, `docs/PHASE_85_STAGE_5_RLS_ZERO_SKIP_REPORT.json`, and `docs/PHASE_85_STAGE_5_DEPENDENCY_SECURITY_REPORT.json`. R-405 is `technically_resolved` in the current local dependency report. Production remains independently `NO-GO`; Stage 5 closure and local R-405 remediation do not approve launch, provider/channel egress, live billing, production schema rollout, or real-data processing. The local branch has not been pushed.

**Document authority rule:** the 2026-08-18 closure artifacts above govern current Stage 5 and R-405 technical status. Every older dated entry below is a historical delivery snapshot. Its `current`, `next`, `pending`, `blocked`, `Stage 5 unstarted`, or `R-405 open` wording describes only that checkpoint and is superseded for current status; production `NO-GO` remains in force until its independent launch gates close.

**Repository layout:** this repository intentionally has no root `package.json`, root `supabase/`, or `app/src/hooks/` directory. Application commands and dependencies live in `app/package.json`, Supabase assets live in `app/supabase/`, and feature hooks are colocated with their owning component or library modules.

**Historical closure authority (2026-07-28):** Stage 4D Ayarlar / Hesap was closed locally with measured verdict `PASS_LOCAL_STAGE_4D_CLOSED`. Evidence: `docs/PHASE_85_STAGE_4D_CLOSURE_EVIDENCE.md`. Active next-step planning is superseded by the Stage 4D remediation evidence above. Production remains `NO-GO`; R-405 remains open.

**2026-07-18 Stage 4B-4 post-closure remediation R9:** R0-R9 is closed locally with local Supabase RLS 41/41 zero-skip, full-scale voice closure, release verification, visual acceptance, channel replay, and risk reconciliation. Evidence: `docs/PHASE_85_STAGE_4B_4_POST_CLOSURE_REMEDIATION_R9_EVIDENCE.md`.

**2026-07-15 Stage 4B-4 Phase 4 deterministic transcription:** Mock-gated provider port, hash fixture manifest, quality gate, transcription worker, and `worker:audio:stage4b4` scripts are locked locally. Evidence: `docs/PHASE_85_STAGE_4B_4_PHASE_4_DETERMINISTIC_TRANSCRIPTION_PROVIDER_EVIDENCE.md`.

**2026-07-15 Stage 4B-4 Phase 3 canonical audio ingress:** Mock-gated WhatsApp voice-note ingress (`client_message_audio`), OGG→16 kHz mono WAV admission, private storage write, pending transcription row, and V3 canonical inbound RPC are locked locally. Evidence: `docs/PHASE_85_STAGE_4B_4_PHASE_3_CANONICAL_INGRESS_AUDIO_ADMISSION_EVIDENCE.md`.

**2026-07-15 Stage 4B-4 Phase 2 audio persistence foundation:** Private `p85-stage-4b4-audio` bucket, audio transcription/correction tables, deny-all RLS, service-role worker queue RPCs, Supabase mappers, and state loading are locked locally. Evidence: `docs/PHASE_85_STAGE_4B_4_PHASE_2_DATABASE_STORAGE_RLS_EVIDENCE.md`.

**2026-07-14 Stage 4B-3 Phase 12 golden corpus, red team, scale rehearsal, and closure:** Synthetic golden corpus, multimodal red-team evaluator, `npm run rehearse:stage-4b3:media`, four-viewport visual simulator acceptance, and canonical runtime spec `docs/PHASE_85_STAGE_4B_3_MULTIMODAL_GORSEL_GUVENLIK_SPEC.md`. Evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_12_GOLDEN_CORPUS_RED_TEAM_CLOSURE_EVIDENCE.md`. Stage 4B-3 and Stage 4B-4 later closed through their respective R9 gates; Stage 4C was the active handoff at that historical checkpoint. Production pilot remains `NO-GO`; R-405 remains open.

**2026-07-14 Stage 4B-3 Phase 6 multimodal understanding and source authority:** Bounded multimodal envelope builder, core `resolveVisualMeaningV1` bridge, active-menu exact match, label/screenshot source gates, and media-worker understanding hook without orchestration or client sends. Evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_6_MULTIMODAL_UNDERSTANDING_EVIDENCE.md`. Phase 7 subsequently completed; see the Phase 7 evidence above.

**2026-07-14 Stage 4B-3 Phase 5 deterministic local vision provider:** Gated mock vision (`MANU_ALLOW_MOCK_VISION`), sanitized-hash fixture manifest, schema validation, immutable `VisualAnalysisRecord` persistence, and zero external egress. Evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_5_DETERMINISTIC_VISION_PROVIDER_EVIDENCE.md`. Phase 6 subsequently completed; see the Phase 6 evidence above.

**2026-07-13 Stage 4B-3 Phase 4 bundle correlation and silence queue:** 120-second inbound bundle correlation, bundled client text/image ingress without `processMockChannelInbound`, business-human echo supersede, cap overflow to `review_required`, and due-bundle worker claim without orchestration. Evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_4_BUNDLE_SILENCE_QUEUE_EVIDENCE.md`. Phase 5 subsequently completed; see the Phase 5 evidence above.

**2026-07-13 Stage 4B-3 Phase 3 secure visual ingress:** Mock-gated `client_message_image` normalization, `sharp`/`file-type` admission, EXIF-stripped sanitized private objects, and ledger ingress without client AI replies. Evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_3_SECURE_VISUAL_INGRESS_EVIDENCE.md`. Phase 4 subsequently completed; see the Phase 4 evidence above.

**2026-07-13 Stage 4B-3 Phase 2 database/storage/RLS foundation:** Append-only migration `20260713120000_phase_85_stage_4b3_media_foundation.sql` adds media tables, private bucket `p85-stage-4b3-media`, conversation-scoped RLS, service-role worker claim RPCs, and `loadSupabaseState` media loading. Evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_2_DATABASE_STORAGE_RLS_EVIDENCE.md`. **Historical next at that checkpoint:** Stage 4B-3 Phase 3. Production pilot remains `NO-GO`; R-405 remains open.

**2026-07-13 Stage 4B-3 Phase 1 domain/type contract:** Media asset, visual observation, inbound bundle, correction, multimodal envelope, autopilot eligibility, and client-safe DTO contracts are implemented in `app/src/lib/phase-85-stage-4b3-media-contracts.ts` with core `dietitian-ai-assistant/src/visual-observation-v1.js` validation. `ManuAppState` now carries empty Stage 4B-3 media collections; `ChannelEventKind` adds `client_message_image`; media retrieval exclusions are typed. No runtime ingress, storage, API, or provider egress changed. Evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_1_DOMAIN_TYPE_CONTRACT_EVIDENCE.md`. **Historical next at that checkpoint:** Stage 4B-3 Phase 2. Production pilot remains `NO-GO`; R-405 remains open.

**Historical 2026-07-13 Stage 4B-3 Phase 0 documentation lock:** Stage 4B-3 was inserted between completed Stage 4B-2 and Stage 4C at that checkpoint. Stage 4B-3 and Stage 4B-4 have since closed through their respective R9 gates; Stage 4C was the active handoff at that historical checkpoint. Canonical historical plan: `docs/PHASE_85_STAGE_4B_3_MULTIMODAL_GORSEL_GUVENLIGI_VE_YANIT_ORK_PLAN.md`. Phase 0 evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_0_DOCUMENTATION_EVIDENCE.md`. Production pilot remains `NO-GO`; R-405 remains open; real provider/channel/health-data paths remain closed.

**2026-07-13 continuity and routing reconciliation:** Canonical handoffs, historical phase snapshots, local file references, Stage 4B/4B-2 navigation, APIs, DTOs, RPCs, migrations, and current RLS evidence were cross-checked. Superseded Docker/RLS blocks and R1-R6 next-step instructions are now explicitly historical. Evidence: `docs/PHASE_85_STAGE_4B_2_CONTINUITY_AND_ROUTING_RECONCILIATION_EVIDENCE.md`.

**2026-07-13 Stage 4B-2 security advisory RLS hardening:** The local Supabase advisory for RLS-disabled `public.conversation_mutation_idempotency` and `public.personas` is closed locally through append-only migration `20260713030000_phase_85_stage_4b2_security_advisory_rls_hardening.sql`. Both tables now have RLS enabled, no direct `anon`/`authenticated` grants, no direct user policies, and service-role mediated behavior preserved. Evidence: `docs/PHASE_85_STAGE_4B_2_SECURITY_ADVISORY_RLS_HARDENING_EVIDENCE.md`. Stage 4B-2 R0-R7 remain closed locally; **Historical next Phase 85 unit at that checkpoint:** Stage 4B-3 Phase 2. Production pilot remains `NO-GO`; R-405 remains open.

**2026-07-13 Stage 4B-2 post-closure remediation R7:** R0-R7 are complete locally. Local Supabase reset and RLS passed 35/35 with zero skips; executed PostgreSQL list/detail buffer plans, R2 bounded SQL, R5 10k scale evidence, and the R6 independent gate close the remediation prerequisites. R-4B2-01 through R-4B2-10 are mitigated in the local prototype. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R7_EVIDENCE.md`. **Historical next Phase 85 unit at that checkpoint:** Stage 4B-3 Phase 2. Production pilot remains `NO-GO`; R-405 remains open; real integration paths remain closed.

**2026-07-13 Stage 4B-2 local RLS re-closure:** Local Supabase/Docker is now running and the current RLS suite passed with zero skips. `npx supabase db reset` passed, `npm run test:rls` passed 35/35, targeted `supabase-store`/`client-forms` tests passed 9/9, and `git diff --check` passed. Evidence: `docs/PHASE_85_STAGE_4B_2_RLS_LOCAL_RECLOSURE_EVIDENCE.md`. Production pilot remains `NO-GO`; R-405 remains open; real provider/channel/health-data paths remain closed.

**2026-07-12 Stage 4B-2 closure (historical snapshot, superseded by the 2026-07-13 R7 and advisory records above):** Mesajlaşma implementation and evidence closure were complete locally while the then-current RLS run was environment-blocked. That block was later cleared: R7 records 35/35 with zero skips, and the advisory-hardening run records the expanded 36/36 suite. Evidence: `docs/PHASE_85_STAGE_4B_2_CLOSURE_EVIDENCE.md`, `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R7_EVIDENCE.md`, and `docs/PHASE_85_STAGE_4B_2_SECURITY_ADVISORY_RLS_HARDENING_EVIDENCE.md`. The next unit at that historical checkpoint was Stage 4B-3. Production pilot remains `NO-GO`; R-405 remains open; real provider/channel/health-data paths remain closed.

**2026-07-12 Stage 4B-2 Phase 4:** superseded by Stage 4B-2 closure above.

**2026-07-12 Stage 4B-2 Phase 3:** superseded by Phase 4 closure above.

**2026-07-12 Stage 4B post-closure remediation (historical verification snapshot):** The Stage 4B implementation audit findings are resolved in code and evidence. Its 33-test RLS run was blocked at that time; the later Stage 4B-2 local re-closure applied the complete migration chain and passed 35/35, followed by advisory hardening at 36/36. Evidence: `docs/PHASE_85_STAGE_4B_POST_CLOSURE_REMEDIATION_EVIDENCE.md`, `docs/PHASE_85_STAGE_4B_2_RLS_LOCAL_RECLOSURE_EVIDENCE.md`, and `docs/PHASE_85_STAGE_4B_2_SECURITY_ADVISORY_RLS_HARDENING_EVIDENCE.md`. The next unit at that historical checkpoint was Stage 4B-3. Production pilot remains `NO-GO`, and R-405 remains open.

**2026-07-11 P85-IF post-closure architecture audit:** Re-audited the six-step P85-IF remediation plan and fixed the remaining architecture gaps. R1 now has tenant-composite constraints for message provenance and actor bindings; R2 derives structured baselines from real app state and resolves only after the affected target panel advances; R3 aligns activation/inbound lock ordering; R6 leak detection now runs on the actual client export path. Evidence: `docs/PHASE_85_IF_REMEDIATION_POST_CLOSURE_AUDIT_EVIDENCE.md`, plus dedicated R1/R2/R3 evidence docs. Verification passed: targeted app/core tests, local Supabase reset, local RLS 30/30, lint, build, full app 828 passed / 4 skipped, core 234/234, channel replay, and production-scale rehearsal. Production pilot remains `NO-GO`; R-405 remains open.

**2026-07-11 P85-IF-R6 lifecycle/RLS evidence re-closure:** Closed the approved P85-IF remediation sequence with verified lifecycle evidence. Append-only migration `20260710230000_phase_85_if_remediation_lifecycle_reclosure.sql` persists P85-IF-I removal/anonymization redaction for provenance fields, channel revisions, human-control sessions, risk activity, context-intake source text, inbound quarantine identifiers, and retrieval manifests; adds service-role-only tenant channel-binding revoke RPC with rollback automation disabled; and keeps tenant account/actor bindings outside client export. Added owner/admin `POST /api/operational-foundation/revoke-channel-bindings`, export leak detection, and a non-synthetic program closure evaluator that fails on missing, skipped, failed, or timed-out RLS/full-suite/replay/scale/build/lifecycle evidence. Evidence: `docs/PHASE_85_IF_R6_LIFECYCLE_RLS_RE_CLOSURE_EVIDENCE.md`. Verification passed: targeted lifecycle 14/14, local Supabase migration reset, local RLS 28/28, lint, production build, full app 825 passed / 4 skipped, channel replay, production-scale rehearsal, `git diff --check`, secret scan, and forbidden future-phase naming scan. Production pilot remains `NO-GO`; R-405 remains open.

**2026-07-10 P85-IF-R5 operational access remediation:** Hardened P85-IF-H operational visibility boundaries. Common app-state no longer exposes inbound quarantine rows, channel account bindings, actor bindings, channel events, or event-only channel message revisions; owner/admin inspection now uses `GET /api/operational-foundation` behind `read_operational_foundation`. Append-only migration `20260710220000_phase_85_if_remediation_operational_access_boundaries.sql` restricts select RLS for operational trust/quarantine tables to owner/admin while keeping dietitian clinical workflow visibility intact. Evidence: `docs/PHASE_85_IF_R5_OPERATIONAL_ACCESS_BOUNDARIES_EVIDENCE.md`. Verification passed: local Supabase migration reset, targeted P85-IF-H/supabase-store 11/11, and local `npm run test:rls` 26/26. Production pilot remains `NO-GO`; R-405 remains open.

**2026-07-10 P85-IF-R4 context intake remediation:** Hardened P85-IF-G Supabase intake workflow. Append-only migration `20260710210000_phase_85_if_remediation_client_safe_context_intake.sql` adds service-role-only atomic context-intake proposal mutation RPCs for confirm/recheck/apply/reject; stale proposal conflicts return `409`, wrong-client or missing proposals return `404`, structured-impact proposals still require panel revision evidence plus two confirmations, and apply creates only a context update while invalidating drafts in the same transaction. Evidence: `docs/PHASE_85_IF_R4_CONTEXT_INTAKE_REMEDIATION_EVIDENCE.md`. Verification passed: local Supabase migration reset, targeted P85-IF-G 11/11, and local `npm run test:rls` 25/25. Production pilot remains `NO-GO`; R-405 remains open.

**2026-07-10 P85-IF-R3 atomic activation remediation:** Hardened P85-IF-F activation concurrency. `activate-ai` now requires `expectedConversationRevision` and `expectedClientContextRevision`; direct `PATCH /api/clients/[id]` activation is rejected; append-only migration `20260710200000_phase_85_if_remediation_atomic_activation.sql` adds service-role-only atomic activation plus inbound/draft expected-conversation revision guards. Verification passed: local Supabase migration reset, targeted R3/historical tests 12/12, `npm run test:rls` 24/24, lint 0 errors with 2 unchanged warnings, production build, `git diff --check`, secret scan, and forbidden future-phase naming scan. Production pilot remains `NO-GO`; R-405 remains open.

**2026-07-12 Phase 85 Stage 4B implementation closure (historical verification snapshot):** Uyari ve Bildirimler implementation and post-closure remediation are verified locally. The then-skipped 33-test RLS run is superseded by the complete-chain 35/35 local re-closure and the subsequent 36/36 advisory-hardening run. Evidence: `docs/PHASE_85_STAGE_4B_POST_CLOSURE_REMEDIATION_EVIDENCE.md`, `docs/PHASE_85_STAGE_4B_2_RLS_LOCAL_RECLOSURE_EVIDENCE.md`, and `docs/PHASE_85_STAGE_4B_2_SECURITY_ADVISORY_RLS_HARDENING_EVIDENCE.md`. The next unit at that historical checkpoint was Stage 4B-3. Production pilot remains `NO-GO`; R-405 remains open.

**2026-07-12 Phase 85 Stage 4B Phase 1:** superseded by Stage 4B closure above.

P85-IF-I closed the Phase 85 Interstage Foundation program with lifecycle export/redaction extensions, unified lifecycle evidence, tenant channel-binding revoke lifecycle, RLS integration coverage for interstage tables, and program closure evidence. Evidence: `docs/PHASE_85_IF_I_LIFECYCLE_CLOSURE_EVIDENCE.md`. Verification on 2026-07-10 passed, and the 2026-07-11 post-closure audit supersedes the earlier skipped local RLS note with local RLS 30/30 plus full verification. Production pilot remains `NO-GO`; R-405 remains open.

P85-IF-D added complete transcript and human-control coordination for business-human echoes, history reconcile, unsupported media, edit/revoke lifecycle, and outbound-status correlation. Evidence: `docs/PHASE_85_IF_D_TRANSCRIPT_HUMAN_CONTROL_EVIDENCE.md`. Verification on 2026-07-10: targeted P85-IF-D 7/7 plus updated P85-IF-C ledger 11/11, full app 787 passed / 4 skipped, core 225/225, lint 0 errors with 3 unchanged warnings, production build passed, and full mock channel replay passed. Production pilot remains `NO-GO`; R-405 remains open.

**2026-07-10 P85-IF-C secure ingress, ledger, routing, and quarantine:** Added and post-commit audited the Phase 85 Interstage Foundation ingress engine. The remediation in `docs/PHASE_85_IF_C_SECURE_INGRESS_ROUTING_REMEDIATION_EVIDENCE.md` fixes business-echo/history counterparty resolution, strict account/tenant/client/conversation/actor assignment checks, resolved-account retention on quarantine, explicitly authorized replay with real client-inbound side effects, canonical provider/actor provenance on stored client messages, invalid provider-time audit evidence, and duplicate-ID/digest conflicts. Only fully resolved `client_message_text` events delegate to the existing `processMockChannelInbound` path; other event kinds remain ledger-only. The engine remains additive and disconnected from the live `/api/whatsapp/webhook`; verified `dietitian_manual` echo persistence, AI auto-pause, stale-work invalidation, and human-control sessions remain P85-IF-D. Verification: targeted P85-IF-C 40/40, full app 780 passed / 4 skipped, core 225/225, lint 0 errors with 3 unchanged warnings, production build passed, and full mock channel replay passed. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending. P85-IF-D is next.

**2026-07-10 P85-IF-B trust-root and provenance data model:** Added the Phase 85 Interstage Foundation trust-root/provenance model: TypeScript records for channel account bindings, actor bindings, channel events, message revisions, human-control sessions, risk activity events, and context-intake proposals; nullable `MessageRecord` provenance extensions; fallback/Supabase mapper support; append-only migration `20260710120000_phase_85_if_b_trust_root_provenance.sql`; and a focused provenance model test. This is schema/model foundation only; P85-IF-C later completed the secure ingress layer and P85-IF-D is next. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending.

**2026-07-10 P85-IF-A canonical contract and threat model:** Added `docs/PHASE_85_INTERSTAGE_TRUSTED_CLINICAL_COMMUNICATION_MEMORY_SPEC.md` as the implementation contract for P85-IF-B through P85-IF-I. The spec locks the provider event matrix, actor-resolution truth table, tenant/account resolution order, fail-closed edge cases, human-control state machine, prompt authority, off-channel context-intake state machine, Stage 4B boundary, and track acceptance criteria. This was documentation-only and is now followed by the completed P85-IF-B data model foundation. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending.

**2026-07-08 Phase 85 roadmap restructure:** Phase 85 is sequenced as Stage 1, Stage 2, Stage 3, Stage 4A Danisan Kontrol Paneli Mimari ve Hizmet Akisi Plani, Stage 4B Uyari ve Bildirimler, Stage 4C Diyetisyen Icin AI Chat, Stage 4D Ayarlar / Hesap, Stage 5 Dashboard and Mobile PWA Shell, Stage 6 Dashboard Core Workflows, and Stage 7 Visual QA/Polish/Accessibility/Closure. The later P85-IF planning lock inserts a mandatory foundation program between completed Stage 4A and Stage 4B without replacing or completing Phase 85. Production pilot remains `NO-GO`.

**2026-07-08 Phase 85 Stage 4A.4 AI Asistan Kontrolu:** Moved AI controls into dedicated **AI Asistan Kontrolu** tab with persona, status/mode, activation window, safety checklist, autopilot readiness gate, lock status, and preflight blockers. Added `ai-assistant-control-panel.tsx` and `ai-assistant-control-panel-helpers.ts`; updated `clients-panel.tsx`. Verification: lint 0 errors (3 pre-existing warnings), helper tests 4/4, full app suite 734 passed / 4 skipped, build passed, Playwright visual 36/36. Stage 4A (Stage 4A.1-4A.4) complete. Production pilot remains `NO-GO`.

**2026-07-08 Phase 85 Stage 4A.3 Menu:** Upgraded the client menu tab into a first-class **Menu** workflow with four template picker cards, Turkish template labels/descriptions, plan status badges, conflict display, activation hard-block on severe conflicts, and integrated MANU-only DOCX/PDF export when eligible. Added `menu-workflow-panel.tsx`, `menu-workflow-export-section.tsx`, and `menu-workflow-panel-helpers.ts`; upgraded `menu-plan-panel.tsx`. Verification: lint 0 errors (3 pre-existing warnings), helper tests 4/4, full app suite 730 passed / 4 skipped, build passed, Playwright visual 36/36. Production pilot remains `NO-GO`.

**2026-07-08 Phase 85 Stage 4A.2 Aktif Beslenme Plani:** Upgraded the client food-rules tab into **Aktif Beslenme Plani** with Phase 77D catalog tree browsing (main/sub/food Izinli/Yasak), quick search, conflict review, and existing `/api/clients/[id]/food-rule-profile` save path. Verification: lint 0 errors (3 pre-existing warnings), helper tests 5/5, full app suite 726 passed / 4 skipped, build passed, Playwright visual 36/36. Production pilot remains `NO-GO`.

**2026-07-08 Phase 85 Stage 4A.1 Danisan Formu Paneli:** Implemented the full Phase 77C active-schema response editor inside the danisan kontrol paneli (`tab_personal_form`). Added `app/src/components/dashboard/client-form-panel.tsx` and `app/src/lib/client-form-panel-helpers.ts`; wired save through existing `POST /api/clients/forms`. Verification: lint 0 errors (3 pre-existing warnings), helper tests 5/5, full app suite passed, build passed, Playwright visual 36/36. Production pilot remains `NO-GO`.

**2026-07-08 Phase 85 Stage 4A Danisan Kontrol Paneli Mimari ve Hizmet Akisi Plani:** Added `docs/PHASE_85_STAGE_4A_DANISAN_KONTROL_PANELI_MIMARI_VE_HIZMET_AKISI_PLANI.md` after code-level review of the existing client form, food-rule profile, menu-plan/export, and AI activation/preflight contracts. Stage 4A.1 through Stage 4A.4 are complete. Production pilot remains `NO-GO`.

**2026-07-07 Phase 85 frontend redesign scope lock:** Created `docs/PHASE_85_FRONTEND_REDESIGN_AND_DESIGN_SYSTEM_SPEC.md` for a full SiriusAI design-system, public website, and dashboard/PWA redesign. User-approved direction: warm clinical SaaS, user-provided redesign palette, Fraunces + Geist Sans typography, editorial public website, compact professional dashboard/PWA, and no reliance on the previous visual style. Phase 85 Stages 1-3 are now implemented for foundation, shared components, and public/commercial entry surfaces. Production pilot remains `NO-GO`.

**2026-07-07 Phase 85B design tokens and font foundation:** Added Fraunces display font, Phase 85 CSS/Tailwind color tokens, semantic primary foundation, and focused design-system token tests. Public/commercial pages were later completed in Stage 3; dashboard and PWA shell redesign remain pending. Production pilot remains `NO-GO`.

**2026-07-07 Phase 85 Stage 2 shared component system:** Updated shared UI primitives to the approved plum/sage/warm system while preserving legacy primitive tone compatibility. Form, card, tab, segmented-control, table, dialog, sheet, app shell, alert, empty-state, and loading primitives now use the Phase 85 component foundation. Public/commercial pages were later completed in Stage 3; dashboard workflow redesign remains pending. Production pilot remains `NO-GO`.

**2026-07-07 Phase 85 Stage 3 public/commercial integration:** Integrated the user-provided `public-website-redesign.zip` design direction into the current app without copying its mock API routes or changing backend contracts. `/`, `/login`, `/purchase`, `/purchase/success`, `/purchase/cancel`, `/onboarding`, `/app-install`, `/admin`, and `/commercial-admin/emergency` now use the invite-led SiriusAI public/commercial visual system while preserving Phase 83/84 auth, invite, sandbox checkout, onboarding, admin, and PWA gates. Production pilot remains `NO-GO`.

**2026-07-07 Phase 85 Stage 3 hosted sandbox deploy:** Deployed the Stage 3 public/commercial redesign to the Hetzner sandbox at `https://siriusai.store` as release `phase85-stage3-redesign-20260707225306`. The user-provided palette correction is live: very light broken-white paper `oklch(0.985 0.003 85)`, purple primary `oklch(0.41 0.14 310)`, and purple hover `oklch(0.37 0.14 310)`. PM2 `manu-ai` is online; `/`, `/login`, `/purchase`, `/purchase/success`, `/app-install`, and `https://admin.siriusai.store` returned 200. This is sandbox/frontend deployment only; Stripe remains test mode and production pilot remains `NO-GO`.

**2026-07-03 Phase 84J custom SMTP verification:** Custom SMTP and real magic-link email verification are complete for the hosted sandbox. Resend sending domain was verified through Porkbun DNS, Supabase Auth custom SMTP was enabled, `/api/auth/magic-link` returned `sent: true`, and a real inbox magic-link click reached `https://siriusai.store/dashboard`. Added fragment-session bridging for Supabase implicit-flow email links. Production pilot remains `NO-GO`.

**2026-07-03 Phase 84I live onboarding update:** Auth/admin/onboarding closure remediation is repo-local complete and VPS sandbox onboarding is verified through generated token-hash fallback. `/auth/callback` preserves Supabase session cookies on final redirects and supports token-hash OTP callbacks; admin magic links use the admin callback base URL contract; admin-host routing covers non-static paths; duplicate onboarding claims recover idempotently for the same tenant. The sandbox claim created the owner membership and dietitian profile, `/dashboard` returned 200, and repeat claim returned `alreadyClaimed: true`. Current RLS re-run remains pending. Production pilot remains `NO-GO`.

**2026-07-02 Phase 84A update:** Phase 84A PRD, spec, and architecture freeze complete.

**2026-07-02 commercial admin recovery update:** Phase 83F includes protected hosted Supabase recovery diagnostics via `/api/commercial/admin/health` and clearer `/commercial-admin` UI guidance. Commercial admin invite operations still require reachable hosted/local Supabase plus commercial migrations.

This repository is a local SaaS/PWA pilot prototype and architecture workspace. It is not a production-connected system yet.

**Historical implementation checkpoint (2026-07-29):** Phase 85 Stage 4D post-closure remediation was reclosed locally through Faz 3 evidence reconciliation. Evidence: `docs/PHASE_85_STAGE_4D_REMEDIATION_PHASE_3_RECLOSURE_EVIDENCE.md`. Its Stage 5 approval and R-405 wording is superseded by the 2026-08-18 current authority above. Production remains `NO-GO`.

**Phase 82 verification:** targeted Phase 82 tests passed (5 files, 31/31); Phase 82G records `repoLocalClosureComplete: true` with verification `blocked` because `npm run test:rls` remains skipped/pending when local Supabase is unavailable.

**Phase 81 verification:** targeted Phase 81 tests passed (6 files, 46/46) on 2026-06-30. Phase 81F records the current refresh as `blocked` because `npm run test:rls` remains skipped/pending when local Supabase is unavailable.

**Latest verification:** P85-IF-R6 passed targeted lifecycle tests 14/14, local Supabase reset, local RLS 28/28, full app tests 825 passed / 4 skipped, lint with 0 errors and 2 pre-existing warnings, production build, `npm run rehearse:channel:replay`, and `npm run rehearse:production-scale:79g` without timeout. `git diff --check` is clean apart from repository-wide CRLF conversion warnings; secret scan had only dummy test env false positives; forbidden future-phase naming scan was clean. Production pilot remains `NO-GO`.

**Phase 77AA-77AI remediation update, 2026-06-28:** closed the review findings for mock channel rollback persistence, WhatsApp timestamp fail-closed parsing, 77AE mock delivery typing, 77AG full replay isolation, and Supabase channel-delivery DSAR cleanup. Verification passed with `git diff --check`, targeted Phase 77 tests, `npm run lint` with two pre-existing warnings, `supabase-store` unit tests, and `npm run rehearse:channel:replay`; repo-wide `npm test` still exceeded the local 180s review timeout and `tsc --noEmit` remains blocked by pre-existing non-Phase-77 test type errors.

**Phase 78 dependency/R-405 update, 2026-06-29:** re-ran the Phase 22 stable dependency procedure. Stable `next@latest` is `16.2.9` but still bundles nested `postcss@8.4.31`; `eslint-config-next@latest` is `16.2.9`; production audit still reports only the known moderate `next`/`postcss` R-405 findings and proposes the rejected `next@9.3.3` downgrade. No dependency files were changed, R-405 remains open, and `dependency_audit_clearance` remains open. Verification passed with `git diff --check`, core tests 225/225, app tests 428 passed and 2 skipped across 73 files, lint with two pre-existing warnings, production build, and only documented R-405 findings.

**Phase 80G R-405 hardening update, 2026-06-30:** hardened Phase 80D/80F so technical R-405 closure now requires a safe stable Next.js/PostCSS patch path, dependency update evidence, and a clean production audit; unknown production audit findings block closure; formal R-405 acceptance now requires complete external acceptance details beyond the dependency gate record. Targeted Phase 80 tests passed (4 files, 29 tests), release verification passed with 225 core tests and 518 app tests / 4 skipped, and the 79G production-scale rehearsal passed. No dependency files changed, no gate closed, R-405 remains open, and production pilot remains `NO-GO`.

**Phase 79 production-scale closure, 2026-06-29:** completed Phase 79A-79I with a real `/api/app-state?view=windowed` dashboard runtime, fail-closed notification windows, scoped client create/patch responses without post-mutation broad reloads, bounded internal copilot loaders, lifecycle redaction evidence, current RLS pending evidence, unified production-scale rehearsal metrics, and continuity/risk/gate doc closure. `rehearse:production-scale:79g` binds expanded AI rehearsal, mock channel replay, Phase 79 full acceptance tests, and release verification. No real WhatsApp/Gemini/provider, monitoring, secret manager, real roster, or real client health data was connected.

The current implementation includes:

- A Next.js app prototype in `app/`
- A testable core AI orchestration package in `dietitian-ai-assistant/`
- Supabase schema, RLS, and local persistence work
- Clinical safety routing for green, yellow, and red messages
- Yellow-risk draft approval and hold behavior
- Red-risk manual handoff and reactivation lock behavior
- Dietitian-controlled client conversation language
- Documentation and evidence plans in `docs/`
- Phase 59–61 safety layers plus Phase 62 remediation (provider-failure dietitian handoff, shared safety text normalization, overlap scope retrieval, glucose cost-unit filter)
- Phase 63 production-pilot rebaseline for WhatsApp-first, Gemini-only scale planning up to 100 dietitians and 5,000+ clients, with user-supplied forms and official regulation-PDF corpus ingestion as future gated phases

- Phase 64 structured launch-gate evidence evaluation requiring sanitized artifact references, owner, approval date, review cadence, explicit approval status, and complete required-evidence coverage before a gate can be treated as closed
- Phase 65 official regulation PDF corpus QA foundation requiring source metadata, checksum, page extraction evidence, page/section references, derived-rule drafts, and corpus golden cases before any PDF-derived scope rules can become draft corpus rules
- Phase 66 product communication covenant lock: forbidden client-facing AI self-disclosure, AI limitation disclaimers, doctor/dietitian/professional referral language, green provider covenant violations, and yellow/red client-facing AI sends are blocked locally
- Phase 67 approved source answerability engine: green provider calls/sends require approved source support from active diet plan, prompt-allowed forms, dietitian context updates, dietitian manual messages, pinned notes, allergies, or restricted foods; AI-generated messages are not source authority
- Phase 68 green maximization intent taxonomy: green source-backed intents are audited by family, while green-looking sensitive intents block before provider generation without downgrading yellow/red decisions
- Phase 69 direct 5,000 client scale foundation: synthetic 100 dietitian x 50 client fixture, cursor pagination helper, Phase 69 read contracts, and aggregate operational-health scale evidence
- Phase 79 production-scale hardening and full 100x50 rehearsal: windowed dashboard reads, scoped client mutation loaders, bounded internal copilot tool state, unified lifecycle redaction evidence, current RLS evidence status, and `npm run rehearse:production-scale:79g` full acceptance chain with hard-zero aggregate metrics
- Phase 70 user-supplied form hardening: registry-backed dietitian/client schemas, prompt visibility and answerability metadata, autopilot qualification gates, and sanitized prompt summaries
- Phase 71 Turkiye official health source ingestion: canonical 14-source Turkiye official source manifest, fail-closed PDF artifact intake, and draft-only derived rule path
- Phase 72 regulation permission graph: draft forbidden/draft-only/answerability maps, privacy and clinical escalation routing, mixed-intent fail-closed evaluation, and blocked active production routing until external approval
- Phase 73 health regulation calibration: 14-source decision matrix, golden-case labeling suite, copilot/autopilot calibration evaluation, and acceptance metrics with zero unsafe-green violations on bundled cases
- Phase 75 Gemini provider gate: forbidden/unpaid consumer surfaces, paid Vertex/Gemini Enterprise target surface, green/yellow model routing, training/logging/retention policy, health-data eligibility checklist, PromptContext allowlist enforcement, and `MANU_ALLOW_REAL_GEMINI` egress gate
- Phase 74 data lifecycle policy: retention/export/DSAR SLA artifacts, transactional redaction contract with invariant checks, ZIP-style export manifest with checksums, and operational exclusion for removed clients
- Phase 76A dietitian chat form update proposals (deprecated by Phase 77B): historical proposal records remain for audit/export/redaction; create/apply paths are blocked and dashboard controls are read-only
- Phase 76B expanded chat form safety updates: the same proposal card can now update Phase 70 clinical/safety form flags and supported client health-profile mirrors, while AI active/passive, mode, channel permission, and red/yellow lock controls remain manual
- Phase 76C structured food rule green capacity spec: canonical PRD/tech spec for source-backed forbidden-food reminders, allowed-food confirmations, approved equivalent substitutions, diet-type compatibility, optional skip tolerance, and trusted product-ingredient verification before WhatsApp production adapter work
- Phase 76D structured food rule data model: registry-backed structured food-rule fields, parsing/validation helpers, autopilot food-rule completeness gates, client allergy/restriction sync on form save, and demo seed coverage
- Phase 76E food rule engine: deterministic forbidden/allowed/substitution/skip/product food decisions from structured rules with audit-only orchestrator manifest attachment
- Phase 76F intent-specific answerability: intent-family source matching, food-rule alignment, structured food-rule source categories, and yellow/red answerability bypass on the orchestrator hot path
- Phase 76G clinical second-layer false-yellow calibration: source-backed food-rule carve-outs for prospective permission/substitution/skip questions while preserving ingestion reactions, acute clinical markers, and severe allergy profile review
- Phase 76L permission graph runtime bridge: audit-first Phase 72 food-rule routing on simulator risk path with gated enforcement behind `MANU_ALLOW_PHASE_72_ACTIVE_ROUTING` plus launch-gate evidence
- Phase 76K chat-to-food-rule proposals: deterministic structured food-rule patch extraction from dietitian chat notes, `food_rule` proposal category, apply/reject with stale revision fail-closed, allergy/restriction sync, and clinical/production safety flags
- Phase 76J dashboard food-rule management UX: structured `FoodRulesPanel` controls, load/merge/save helpers on the existing client form path, context revision increment, draft invalidation, and clinical/production warnings
- Phase 76I PromptContext and provider output guard hardening: bounded food-rule PromptContext segments, food-rule provider instruction, and output guard blocks for forbidden-food approval, unauthorized substitution, skip relaxation, and portion/macro changes
- Phase 76H product ingredient verification: trusted-source verification contract with user-label extraction, confidence/source gating, normalized forbidden keyword ids, and diet-type conflict detection on product labels
- Phase 76M calibration and metrics expansion: Phase 73 `v1.1.0` food-rule golden categories, green-capacity metrics with `unsafe_green_rate = 0` on bundled suite, and operational-health aggregates
- Phase 76N Supabase lifecycle coverage: structured food-rule export/redaction, client update proposal RPC, and removal-lifecycle transactional coverage
- Phase 76O 100x50 synthetic food-mix rehearsal: twelve-scenario scale rehearsal with `unsafe_green_count = 0` on bundled rehearsal and operational-health food-mix aggregate fields
- Phase 76P continuity, evidence, and gate updates: consolidated Phases 76C–76O food-rule track evidence in pilot/gate/risk docs; all launch gates remain open
- Phase 76Q verification and commit protocol: formal 76C–76P track closure with verify+commit evidence; RLS re-run pending when local Supabase unavailable
- Phase 77A manual source authority rebaseline: canonical PRD/tech spec for removing chat-based form/food-rule/menu mutation, introducing personal form v2, user-supplied master food catalog, client food-rule profile v2, four-template menu plan/export, Food Decision Engine V2, and adapting the Phase 76D-76O food-rule track before WhatsApp production adapter work
- Phase 77 master implementation plan: detailed phase-by-phase execution plan in `docs/PHASE_77_MASTER_IMPLEMENTATION_PLAN.md`
- Phase 77C client personal form v2: user-supplied first form loaded into the dynamic form registry with phone/WhatsApp identity fields, goal and target-weight fields, general and goal-based flexibility, nutrition-history/lifestyle/medical/digestive fields, and prompt privacy rules; food-group and meal flexibility remain deferred to food-rule and menu forms
- Phase 77D master food catalog hierarchy: user-supplied `manual.xlsx` / `Besin Veritabani` extracted into a 12-category, 113-subcategory, 518-food catalog with stable ids, checksums, exact lookup, and dashboard checkbox expansion for forbidden main categories, subcategories, and foods
- Phase 77B manual source authority boundary: blocks chat proposal create/apply for form, food rules, and future menu authority; keeps internal copilot read-only and Critical Context panel-only; preserves deprecated historical proposal artifacts
- Phase 77E client food-rule profile v2: first-class profile state with catalog search UI, allowed/forbidden foods and groups, flexibility maps, conflict detection, API/Supabase persistence, export/redaction, and legacy form-answer bridge for Phase 76 runtime compatibility
- Phase 77F menu plan v1: four-template client menu plans with active-menu selection, food-profile conflict detection, derived legacy diet-plan summary, API/Supabase persistence, `MenuPlanPanel` dashboard UI, export/redaction, and direct summary patch lock when an active menu exists
- Phase 77G Food Decision Engine V2: deterministic `allow`/`discourage`/`forbid`/`needs_label`/`needs_review` decisions from profile V2, active menu, catalog matching, and flexibility; Phase 68 recalibration for safe off-menu food requests; simulator/orchestrator manifest wiring with legacy 76E fallback
- Phase 77H PromptContext/answerability/output guard V2: bounded V2 prompt segments, profile/menu/catalog answerability sources, contradiction output guard, permission-graph V2 intent mapping, and provider allowlist updates
- Phase 77I simplified dietitian UX: client detail restructured into seven tabs (Overview, Personal Form, Food Rules, Menu, Critical Context, AI Copilot, Export) with status summaries, conflict review panels, progressive disclosure, empty/error states, and i18n for all supported languages
- Phase 77J DOCX/PDF menu export: active export-visible menu plans download as DOCX/PDF with internal fields stripped; Phase 74 client export package bumped to `phase74-export-v1.2`
- Phase 77K calibration and evidence closure: Food Decision V2 golden suite (14 categories), 100x50 V2 rehearsal with zero unsafe green, Phase 76O integration checks, and manual source authority track closure
- Phase 77L continuity/worktree closure: stale continuity and evidence documents reconciled to the Phase 77K baseline, historical Phase 76E spec preserved, long-running rehearsal/release verification made deterministic, and the dirty Phase 77E-77K worktree closed into a coherent commit boundary
- Phase 77M-77Y AI Quality Program plan: canonical pre-WhatsApp track for core-owned response planning, deterministic templates, claim manifest grounding, canonical intent resolution, Food Understanding V3, Dietitian Voice Engine V2, AI quality rehearsal, RD review packet, copilot quality workflow, and narrow deterministic autopilot eligibility while preserving green/yellow/red as the only client-visible risk classes
- Phase 77Z repository cleanup: removed the obsolete tracked `.cursor` food green expansion plan; the migrated content lives in canonical Phase 76C-76Q specs and continuity evidence
- Post-Phase 65 direct 100-dietitian completion plan in `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`, locking the no-small-ring 5,000-client production pilot target, product communication covenant, approved-source answerability path, and user-document timing

## Safety Model

MANU-AI is built around supervised clinical safety boundaries:

- Green messages may be handled automatically only when AI is active and the client is in autopilot mode.
- Yellow messages create dietitian approval drafts and pause AI for that client until reviewed.
- Red messages do not call an LLM and require human handoff.
- Three escalate-only evaluation axes merge before orchestration: regex classifier (`dietetic-risk-v0.3.1`), clinical safety second layer (`clinical-safety-second-layer-v0.2.0`), and scope guard over an approved dietetic-regulation corpus (`scope-rag-v0.1.0`; mock-first, no-op until corpus is approved).
- Phase 66 enforces the product communication covenant locally: no AI self-disclosure, no AI limitation disclaimer, no doctor/dietitian/professional referral language in client-facing AI output, and no client-facing AI send for yellow/red situations.
- Phase 67 enforces approved source answerability locally before green provider calls or sends.
- Phase 68 records green intent taxonomy evidence after answerability and blocks sensitive green-looking requests before provider calls.
- Personas affect communication style only, not clinical safety rules.
- Production launch gates remain open until external approval artifacts are supplied and accepted by the structured evidence engine.

## Repository Structure

```text
app/                       Next.js SaaS/PWA prototype
dietitian-ai-assistant/    Core orchestration and safety package
docs/                      Specs, risk register, launch-gate evidence
PLAN.md                    Canonical project plan
PROJECT_PLAN.md            Long-form roadmap
HANDOFF_FOR_NEXT_CODEX.md  Continuation notes for future Codex sessions
```

## Local Verification

Common checks:

```powershell
cd app
npm test
npm run lint
npm run typecheck
npm run release:verify
```

Core package tests:

```powershell
cd dietitian-ai-assistant
npm test
```

Local Supabase/RLS evidence requires Docker Desktop and local Supabase.

## Important Boundaries

By default, work in this repository uses local/mock flows. Real WhatsApp, Telegram, Gemini/external LLM, monitoring, secret manager, and real health-data integrations should only be started as explicit integration phases with scope, rollback, test, and approval plans.

R-405 dependency remediation must follow the documented Phase 22 procedure.

Official health-regulation PDFs, legal/privacy artifacts, clinical approvals, and final dietitian/client form definitions must be supplied by the user and recorded only through sanitized references when they are sensitive.

## Current Commercial VPS Baseline - 2026-07-02

The commercial sandbox has been exercised on a Hetzner VPS for workflow validation only. `https://siriusai.store` is live behind Nginx, PM2, and Let's Encrypt HTTPS. Stripe remains test/sandbox only, and the test webhook endpoint `https://siriusai.store/api/commercial/webhook` has been verified without exposing secrets.

Verified result: invite + Stripe test checkout can consume the invite, create a tenant, create an active entitlement, and write billing ledger events. Hosted onboarding/auth now includes magic-link login, membership/profile claim, Phase 84I callback remediation, and Phase 84J Resend custom-SMTP real email delivery. R-425 is mitigated in the hosted sandbox path.

Historical Stage 4B checkpoint: Stage 4B and Stage 4B-2 were locally closed through the R7 and advisory-hardening records. The earlier 2026-07-12 Stage 4B Docker block was superseded by complete-chain zero-skip local RLS evidence. Its R-405 wording is superseded by the 2026-08-18 current authority above; production remains `NO-GO`, and this local evidence does not close external launch gates or authorize production traffic.

## Current P85-IF Post-Closure Baseline - 2026-07-11

The P85-IF remediation plan was audited after R1-R6 completion and is now closed with additional post-closure fixes:

- R1 message provenance tenant-composite constraints.
- R2 real app-state structured baselines and target-panel-specific resolution.
- R3 deterministic activation/inbound lock ordering.
- R6 client export leak detection on the actual export path.
- Dedicated post-closure evidence: `docs/PHASE_85_IF_REMEDIATION_POST_CLOSURE_AUDIT_EVIDENCE.md`.

Verification passed targeted app/core tests, local Supabase reset, local RLS 30/30, lint, build, full app 828 passed / 4 skipped, full core 234/234, channel replay, and unified production-scale rehearsal. Real providers, real channels, live billing, monitoring, backup, secret manager, and real health-data paths remain disconnected.

## Current Phase 85 Stage 4A Post-P85-IF Remediation - 2026-07-11

After P85-IF and R1-R6 post-closure remediation, Stage 4A was remediated to match the newer activation, human-control, structured-intake, and structured-notification contracts. The AI assistant control panel now routes activation through the atomic `/api/clients/[id]/activate-ai` endpoint, releases human takeover through `/api/clients/[id]/release-takeover`, shows active human-control session evidence, maps structured context-intake flags to readable client panel labels, and exposes a minimal structured-update notification bridge for target-panel navigation and resolution.

Evidence: `docs/PHASE_85_STAGE_4A_POST_IF_REMEDIATION_EVIDENCE.md`. This is local/mock dashboard compatibility work only. The approved Stage 4B plan is the next Phase 85 implementation target; production pilot remains `NO-GO`; R-405 remains open; real providers, real channels, live billing, monitoring, backup, secret manager, and real health-data paths remain disconnected.

## Phase 85 Stage 4B Planning Lock - 2026-07-11

The decision-complete Stage 4B action plan is now recorded in `docs/PHASE_85_STAGE_4B_UYARI_VE_BILDIRIMLER_ACTION_PLAN.md`. Stage 4B will add separate Uyarilar and Bildirimler dashboard views. Clinical alerts will be derived from active yellow holds/red locks rather than a new alert table; system notifications will use structured kinds, deterministic priority, per-actor receipts, bounded APIs, and tenant/client access checks. A red alert will close through the existing atomic direct AI activation contract, without a separate handoff-resolution screen.

The canonical order is Stage 4B, mandatory Stage 4B-2 Mesajlasma, Stage 4B-3, Stage 4B-4, then Stage 4C. Stage 4B, Stage 4B-2, Stage 4B-3, and Stage 4B-4 are closed locally through their applicable remediation gates. **Next:** Stage 4C. Production pilot remains `NO-GO`; R-405 remains open; real integration paths remain disconnected.

## Phase 85 Stage 4B-2 Phase 0 Documentation Lock - 2026-07-12

The decision-complete Mesajlasma action plan is recorded in `docs/PHASE_85_STAGE_4B_2_MESAJLASMA_ACTION_PLAN.md`; runtime spec in `docs/PHASE_85_STAGE_4B_2_MESAJLASMA_SPEC.md`; closure evidence in `docs/PHASE_85_STAGE_4B_2_CLOSURE_EVIDENCE.md`. Stage 4B-2 Phases 0–11 are complete. **Historical next at that checkpoint:** Stage 4B-3; production pilot remains `NO-GO`; R-405 remains open.
## Phase 85 Stage 4B-2 Post-Closure Remediation - 2026-07-12

Stage 4B-2 implementation and post-closure remediation R0-R7 are complete locally. The canonical remediation plan is `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_ACTION_PLAN.md`; R7 evidence is historical closure authority for that stage. Stage 4B-3 and Stage 4B-4 subsequently closed through R9; Stage 4C was the active handoff at that historical checkpoint. Production pilot remains `NO-GO`, R-405 remains open, and real provider/channel/health-data paths remain disabled.

## Phase 85 Stage 4B-2 Post-Closure Remediation R1 - 2026-07-12

Historical R1 record: the domain/DTO/permission projection contract was completed as evidenced in `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R1_EVIDENCE.md`. R2-R7 subsequently closed; this line is not an active handoff. The next unit at that historical checkpoint was Stage 4B-3.

## Phase 85 Stage 4B-2 Post-Closure Remediation R2 - 2026-07-12

Historical R2 record: append-only bounded Supabase v2 list/detail RPCs, actor-scoped unread aggregates, and receipt v2 authorization guards were completed. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R2_EVIDENCE.md`. R3-R7 and zero-skip RLS subsequently closed; this is not an active handoff. Production remains `NO-GO`.
## Phase 85 Stage 4B-2 Post-Closure Remediation R3 - 2026-07-12

Historical R3 record: the atomic authorized mutation boundary was completed and is evidenced in `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R3_EVIDENCE.md`. R4-R7 subsequently closed; this is not an active handoff. The next unit at that historical checkpoint was Stage 4B-3. Production pilot remains `NO-GO`; R-405 remains open.
## Phase 85 Stage 4B-2 Post-Closure Remediation R4 - 2026-07-12

Historical R4 record: hook, deep-link, actor-scoped unread aggregate, and responsive messaging UI corrections were completed. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R4_EVIDENCE.md`. Its timeout and Docker block were later superseded by R5-R7 full regression and zero-skip RLS evidence. This is not an active handoff.
## Phase 85 Stage 4B-2 Post-Closure Remediation R5 - 2026-07-13

Historical R5 record: bounded-scale, replay, accessibility, lifecycle/export, and full-regression evidence passed. Its 35-test Docker block was later superseded by R7 zero-skip RLS and SQL buffer evidence. Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R5_EVIDENCE.md`. This is not an active handoff; production remains `NO-GO` and R-405 remains open.

## Phase 85 Stage 4B-2 Post-Closure Remediation R6 - 2026-07-13

R6 executed the independent full gate. Core 234/234, app 959/6 skipped, lint/build, R5 scale 4/4, 79G 7/7, full channel replay, visual/accessibility 8/8, dependency audit exception handling, diff check, and diff-added/untracked secret-name scans passed. Its original environment block was later resolved by RLS 35/35 and executed SQL buffer evidence; see the R7 record below. Production remains `NO-GO`; R-405 remains open.

## Phase 85 Stage 4B-2 Post-Closure Remediation R7 - 2026-07-13

The historical R6 environment block is superseded by zero-skip RLS and executed SQL buffer evidence. Canonical status, risks, and handoff are reconciled in `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R7_EVIDENCE.md`. R0-R7 are complete locally; Stage 4B-3 and Stage 4B-4 subsequently closed through R9, and Stage 4C was the active handoff at that historical checkpoint. This does not approve the production pilot or close R-405.
