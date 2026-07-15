# Handoff For Next Codex

**Current authority (2026-07-15):** Stage 4B-4 Sesli Mesaj Guvenligi ve Transkripsiyon Orkestrasyonu Phase 10 is complete locally after Phase 9. Active plan: `docs/PHASE_85_STAGE_4B_4_SESLI_MESAJ_GUVENLIGI_VE_TRANSKRIPSIYON_ORK_PLAN.md`. Phase 10 evidence: `docs/PHASE_85_STAGE_4B_4_PHASE_10_SIMULATOR_GOLDEN_CORPUS_RED_TEAM_EVIDENCE.md`. **Next:** Stage 4B-4 Phase 11 measured closure, risk reconciliation, and Stage 4C handoff. Stage 4C is blocked until Stage 4B-4 closes. Production remains `NO-GO`; R-405 remains open.

Pre-Stage-4B-4 Stage 4B-3 closure and Stage 4C-next paragraphs below this authority block are historical snapshots. Use the Stage 4B-4 plan as the current handoff.

Continuity audit, 2026-07-13: canonical status, repository-relative references, dashboard messaging navigation, bounded APIs, DTO/permission contracts, append-only RPC/RLS migrations, and current evidence were reconciled. Treat older R1-R6 and Docker-blocked paragraphs as historical snapshots only. Evidence: `docs/PHASE_85_STAGE_4B_2_CONTINUITY_AND_ROUTING_RECONCILIATION_EVIDENCE.md`. Phase 0 now inserts Stage 4B-3 before Stage 4C. The current Phase 85 handoff is Stage 4B-3 Multimodal Gorsel Guvenligi ve Yanit Orkestrasyonu.

## Read This First

Latest Phase 85 handoff (2026-07-15): **Stage 4B-4 Phase 10 simulator, golden corpus, red team, and scale rehearsal are complete locally.** Phase 10 evidence: `docs/PHASE_85_STAGE_4B_4_PHASE_10_SIMULATOR_GOLDEN_CORPUS_RED_TEAM_EVIDENCE.md`. **Next work:** Stage 4B-4 Phase 11 measured closure, risk reconciliation, and Stage 4C handoff. Stage 4C is blocked until Stage 4B-4 closes; production pilot remains `NO-GO`; R-405 remains open; all real integration paths remain closed.

Latest Phase 85 Stage 4B-3 Phase 4 status (2026-07-13): bundle correlation and silence queue complete locally. Evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_4_BUNDLE_SILENCE_QUEUE_EVIDENCE.md`. Phase 5 subsequently completed; see the Phase 5 evidence above.

Latest Phase 85 Stage 4B-3 Phase 2 status (2026-07-13): database/storage/RLS foundation complete locally. Evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_2_DATABASE_STORAGE_RLS_EVIDENCE.md`. Phase 3 subsequently completed; see the Phase 3 evidence above.

Latest Phase 85 Stage 4B-2 status (2026-07-13): **Mesajlasma post-closure remediation R0-R7 and the separate security advisory RLS hardening are complete locally.** The advisory hardening migration `20260713030000_phase_85_stage_4b2_security_advisory_rls_hardening.sql` enables RLS on `conversation_mutation_idempotency` and `personas`, removes direct `anon`/`authenticated` grants, adds no direct-user policies, and preserves service-role mediated behavior. Evidence: `docs/PHASE_85_STAGE_4B_2_SECURITY_ADVISORY_RLS_HARDENING_EVIDENCE.md`. R7 evidence remains `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R7_EVIDENCE.md`. **Next work:** Stage 4B-3, beginning with Phase 1 domain/threat/type contract after the Phase 0 lock. Production pilot remains `NO-GO`; R-405 remains open; all real integration paths remain closed. This current handoff supersedes older next-phase statements below.

Latest Phase 85 Stage 4B-2 local environment status (2026-07-13): **local Supabase reset and `npm run test:rls` pass with 35/35 and 0 skipped; R7 also records executed list/detail SQL buffer evidence.** Evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R7_EVIDENCE.md`. Production pilot remains `NO-GO`; R-405 remains open; real provider/channel/health-data and production-operations paths remain closed.

Historical Stage 4B-2 remediation opening (2026-07-12): superseded by the R7 closure handoff above.

Latest Phase 85 Stage 4B-2 Phase 3 status (2026-07-12): superseded by Phase 4 closure above. Evidence: `docs/PHASE_85_STAGE_4B_2_PHASE_3_BOUNDED_PROJECTION_EVIDENCE.md`.

Latest Phase 85 Stage 4B-2 Phase 1 status (2026-07-12): superseded by Phase 2 closure above. Evidence: `docs/PHASE_85_STAGE_4B_2_PHASE_1_DOMAIN_DTO_AUTHORIZATION_EVIDENCE.md`.

Historical Stage 4B verification snapshot (2026-07-12): implementation and post-closure remediation completed locally, while that day's 33-test RLS run was Docker-blocked. The block was subsequently superseded by complete-chain 35/35 zero-skip RLS and advisory-hardening 36/36 evidence. Current authority is the Stage 4B-2 R7 and advisory records at the top of this handoff. **Next work:** Stage 4B-3. Production pilot remains `NO-GO`; R-405 remains open.

Latest Phase 85 Stage 4B Phase 1 status (2026-07-12): superseded by Stage 4B closure above.

Latest Phase 85 Interstage Foundation P85-IF-R6 status (2026-07-11): P85-IF-I lifecycle/RLS re-closure is complete and the approved remediation sequence is closed. Evidence at `docs/PHASE_85_IF_R6_LIFECYCLE_RLS_RE_CLOSURE_EVIDENCE.md`. Migration `20260710230000_phase_85_if_remediation_lifecycle_reclosure.sql` persists P85-IF-I redaction through `commit_client_removal_lifecycle`, adds service-role-only tenant channel-binding revoke with tenant automation rollback disabled, and keeps tenant account/actor bindings out of client export with leak detection. API `POST /api/operational-foundation/revoke-channel-bindings` is owner/admin-only via `revoke_tenant_channel_bindings`. `evaluateP85IfIProgramClosureEvidence` now fails on missing/skipped/failed/timeout verification evidence. Verification passed: targeted lifecycle 14/14, local Supabase reset, local RLS 28/28, lint, production build, full app 825 passed / 4 skipped, channel replay, production-scale rehearsal without timeout, `git diff --check`, secret scan, and forbidden future-phase naming scan. Real provider/channel/health-data paths remain disconnected. Production pilot remains `NO-GO`; R-405 remains open. Stage 4B planning subsequently completed and approved implementation is next.

Latest Phase 85 Interstage Foundation P85-IF-R5 status (2026-07-10): P85-IF-H operational access remediation is complete. Evidence at `docs/PHASE_85_IF_R5_OPERATIONAL_ACCESS_BOUNDARIES_EVIDENCE.md`. Common app-state no longer includes inbound quarantine rows, channel account bindings, actor bindings, channel events, or event-only channel message revisions. Owner/admin inspection uses `GET /api/operational-foundation` behind `read_operational_foundation`; unauthorized direct API calls return 403. Migration `20260710220000_phase_85_if_remediation_operational_access_boundaries.sql` restricts select RLS on operational trust/quarantine tables to owner/admin while preserving dietitian clinical workflow visibility. Verification passed: local Supabase reset, targeted P85-IF-H/supabase-store 11/11, and local RLS 26/26. Real provider/channel/health-data paths remain disconnected. Production pilot remains `NO-GO`; R-405 remains open. Next approved remediation track follows the user-supplied remediation plan unless the user redirects; Stage 4B remains blocked until that sequence closes.

You are continuing the MANU-AI project.

Latest Phase 85 Interstage Foundation P85-IF-R4 status (2026-07-10): P85-IF-G context-intake Supabase remediation is complete. Evidence at `docs/PHASE_85_IF_R4_CONTEXT_INTAKE_REMEDIATION_EVIDENCE.md`. Migration `20260710210000_phase_85_if_remediation_client_safe_context_intake.sql` adds service-role-only atomic confirm/recheck/apply/reject RPCs; wrong-client or missing proposals return `404`; stale/expired/non-mutable states return `409`; structured-impact recheck still requires panel revision evidence and apply still requires two confirmations; apply creates only a context update and invalidates drafts transactionally. Verification passed: local Supabase reset, targeted P85-IF-G 11/11, and local RLS 25/25. Real provider/channel/health-data paths remain disconnected. Production pilot remains `NO-GO`; R-405 remains open. P85-IF-R5 is now complete.

Latest Phase 85 Interstage Foundation P85-IF-I status (2026-07-10): P85-IF-I is complete and P85-IF is closed. Evidence at `docs/PHASE_85_IF_I_LIFECYCLE_CLOSURE_EVIDENCE.md`. R3 remediation subsequently hardened P85-IF-F atomic activation: `activate-ai` requires conversation/client-context expected revisions, direct active PATCH is rejected, migration `20260710200000_phase_85_if_remediation_atomic_activation.sql` adds service-role-only atomic activation and inbound/draft expected-conversation revision guards, and local Supabase RLS/integration passed 24/24. The ingress engine remains disconnected from the live webhook. Real provider/channel/health-data paths remain disconnected. Production pilot remains `NO-GO`; R-405 remains open. Stage 4B Uyari ve Bildirimler remains blocked until the approved remediation sequence completes.

Latest Phase 85 Interstage Foundation P85-IF-H status (2026-07-10): P85-IF-H is complete. Evidence at `docs/PHASE_85_IF_H_OPERATIONAL_VISIBILITY_EVIDENCE.md`. Minimal provenance labels, human-control session banner with direct AI activation, structured source-message links, owner/admin trust-binding and quarantine inspection controls, safe aggregate channel-trust counters, and seven-language strings are implemented. Stage 4B alert/notification product UX remains untouched. The ingress engine remains disconnected from the live webhook. Real provider/channel/health-data paths remain disconnected. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending. P85-IF-I is complete.

Latest Phase 85 Interstage Foundation P85-IF-G status (2026-07-10): P85-IF-G is complete. Evidence at `docs/PHASE_85_IF_G_CONTEXT_INTAKE_EVIDENCE.md`. Verification passed: targeted P85-IF-G 9/9, full app 807 passed / 4 skipped, lint 0 errors with 3 unchanged warnings, and production build. Dedicated off-channel context-intake workflow, client-safe resolution, structured-impact blocking with recheck/double-confirmation, API routes, Copilot panel intake UI, export/redaction hooks, and read-only copilot separation are implemented. The ingress engine remains disconnected from the live webhook. Real provider/channel/health-data paths remain disconnected. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending. P85-IF-H is complete.

Latest Phase 85 Interstage Foundation P85-IF-F status (2026-07-10): P85-IF-F is complete. Evidence at `docs/PHASE_85_IF_F_RISK_REACTIVATION_EVIDENCE.md`. Verification passed: targeted P85-IF-F 6/6, full app 798 passed / 4 skipped, lint 0 errors with 3 unchanged warnings, production build, and full mock channel replay. Controlled AI activation, yellow/red/manual risk resolution, conversation revision CAS, human-control session closure, and canonical client-patch routing are implemented. The ingress engine remains disconnected from the live webhook. Real provider/channel/health-data paths remain disconnected. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending. P85-IF-G is complete.

Latest Phase 85 Interstage Foundation P85-IF-E status (2026-07-10): P85-IF-E is complete. Evidence at `docs/PHASE_85_IF_E_HISTORICAL_RETRIEVAL_EVIDENCE.md`. Verification passed: targeted core historical retrieval 5/5 plus app P85-IF-E 4/4, full app 791 passed / 4 skipped, core 230/230, lint 0 errors with 3 unchanged warnings, production build, and full mock channel replay. Context Policy V2, deterministic full-history retrieval, retrieval-evidenced answerability, Supabase FTS RPC migration, and structured-record update notifications are implemented. The ingress engine remains disconnected from the live webhook. Real provider/channel/health-data paths remain disconnected. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending. P85-IF-F is next.

Latest Phase 85 Interstage Foundation P85-IF-D status (2026-07-10): P85-IF-D is complete. Evidence at `docs/PHASE_85_IF_D_TRANSCRIPT_HUMAN_CONTROL_EVIDENCE.md`. Verification passed: targeted P85-IF-D 7/7 plus updated P85-IF-C ledger 11/11, full app 787 passed / 4 skipped, core 225/225, lint 0 errors with 3 unchanged warnings, production build, and full mock channel replay. Business-human transcript persistence, human-control auto-pause, draft invalidation, history reconcile, edit/revoke/media lifecycle, and Supabase row mappers are implemented. The ingress engine remains disconnected from the live webhook. Real provider/channel/health-data paths remain disconnected. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending. P85-IF-E is next.

Latest Phase 85 Interstage Foundation P85-IF-C status (2026-07-10): P85-IF-C is complete and post-commit audited. The remediation evidence at `docs/PHASE_85_IF_C_SECURE_INGRESS_ROUTING_REMEDIATION_EVIDENCE.md` records all closed findings, including duplicate-ID/digest conflicts. Verification passed: targeted 40/40, app 780 passed / 4 skipped, core 225/225, lint 0 errors with 3 unchanged warnings, production build, and full mock channel replay. The engine remains disconnected from the live webhook; business-human transcript persistence, AI auto-pause, stale-work invalidation, and human-control sessions remain P85-IF-D. Real provider/channel/health-data paths remain disconnected. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending. P85-IF-D is next.

Latest Phase 84I live status (2026-07-03): auth/admin/onboarding remediation is repo-local complete on branch `codex/phase-29-baseline-checkpoint`, and VPS sandbox onboarding is verified through the generated token-hash fallback path. Local fixes cover auth callback cookie preservation, token-hash OTP callback support, admin callback URL separation via `MANU_ADMIN_APP_URL`, broader admin-host routing, and same-tenant duplicate onboarding claim recovery. Live sandbox evidence: generated token-hash callback reached `/onboarding`, `GET /api/commercial/onboarding/status` returned authenticated + claimable, `POST /api/commercial/onboarding/claim` created the owner membership and dietitian profile, `/dashboard` returned 200, and a repeat claim returned `alreadyClaimed: true`. Repo-local verification: auth/onboarding targeted tests 16/16 and production build passed after token-hash remediation; earlier Phase 84/remediation verification remains targeted 41/41, visual 36/36, release verify core 225/225 + app 709 passed / 4 skipped. Phase 84J later completed real custom-SMTP email dashboard verification. `npm run test:rls` skipped 21/21, so current local Supabase RLS re-run remains pending. Production pilot remains `NO-GO`.

Latest Phase 84J status (2026-07-03): custom SMTP and real magic-link email verification are complete for the hosted sandbox. Resend sending domain was verified through Porkbun DNS, Supabase Auth custom SMTP was enabled with Resend SMTP, live `/api/auth/magic-link` returned `sent: true`, and a real inbox magic-link click reached `https://siriusai.store/dashboard`. Real email links used Supabase implicit-flow fragment tokens, so `/auth/callback` now renders a fragment-session bridge and `POST /api/auth/session-from-fragment` exchanges fragment tokens for SSR cookies. Verification passed: targeted auth/session tests 7/7, production build passed locally and on VPS, PM2 `manu-ai` is online. R-425 is mitigated in the hosted sandbox path. Production pilot remains `NO-GO`.

Latest Phase 85A status (2026-07-07): canonical frontend redesign and design-system spec is created in `docs/PHASE_85_FRONTEND_REDESIGN_AND_DESIGN_SYSTEM_SPEC.md`. User-approved direction: keep `SiriusAI`; warm clinical SaaS positioning; implementation order design system -> public website/onboarding -> dashboard/PWA; user-provided redesign palette with very light paper `#FBFAF8`, ink `#111116`, purple primary `#612E82`, hover `#562175`, sage `#578F6B`, and warm accent `#D79800`; Fraunces display + Geist Sans UI; public surfaces editorial/spacious and dashboard/PWA compact/scannable; no previous visual style should be used as a design reference. No runtime code changed. Production pilot remains `NO-GO`; real provider/channel/live billing/monitoring/backup/secret-manager/real health-data paths remain disconnected.

Latest Phase 85B status (2026-07-07): design token and font foundation is implemented. `layout.tsx` loads Fraunces display with Geist Sans/Mono; `globals.css` now exposes Phase 85 paper/surface/ink/plum/sage/warm/border/focus tokens; `.font-display` is available; global focus/selection/skip-link foundation uses the plum system; `components/ui/tokens.ts` records the approved palette and primary button foundation uses semantic `primary` tokens. Component/page/dashboard redesign remains pending for Phase 85C+. Production pilot remains `NO-GO`.

Latest Phase 85 Stage 2 status (2026-07-07): shared UI component system foundation is implemented. `components/ui/tokens.ts` now exposes `plum`, `sage`, and `warm` tones while preserving `emerald -> sage` and `amber -> warm` compatibility; form, card, tabs, segmented control, table, dialog, sheet, and app-shell primitives use the approved palette; shared `Alert`, `EmptyState`, and `LoadingBlock` primitives were added; focused design-system tests pass 8/8. Stage 3 and Stage 4A are now complete; the current execution order is P85-IF, then Stage 4B, Stage 4C, Stage 4D, Stage 5, Stage 6, and Stage 7. Production pilot remains `NO-GO`.

Latest Phase 85 Stage 3 implementation/deploy status (2026-07-07): the public/commercial entry action plan is implemented from `docs/PHASE_85_STAGE_3_PUBLIC_COMMERCIAL_ENTRY_ACTION_PLAN.md` and the user-provided `public-website-redesign.zip` visual direction. The corrected user palette is live: very light broken-white paper `oklch(0.985 0.003 85)`, purple primary `oklch(0.41 0.14 310)`, and purple hover `oklch(0.37 0.14 310)`. The core model remains invite-led access, not open self-serve signup: contact request -> team/admin review -> admin invite code -> approved email + invite code -> sandbox checkout -> magic-link -> onboarding claim -> dashboard/PWA. Locked navbar: `SiriusAI | Nasil calisir | Guvenlik | Mobil | Iletisim | Giris yap | Davet koduyla basla`. Stage 3 redesigned `/`, `/login`, `/purchase`, `/purchase/success`, `/purchase/cancel`, `/onboarding`, `/app-install`, `/admin`, and `/commercial-admin/emergency` without changing backend API contracts, auth, entitlement, onboarding, sandbox billing, production pilot `NO-GO`, R-405, or current RLS status. Hosted sandbox deploy: release `phase85-stage3-redesign-20260707225306` is live through PM2/Nginx at `https://siriusai.store`; `/`, `/login`, `/purchase`, `/purchase/success`, `/app-install`, and `https://admin.siriusai.store` returned 200. Do not copy the zip's mock API routes.

Latest Phase 85 Interstage Foundation P85-IF-B status (2026-07-10): the trust-root/provenance data model foundation is complete. P85-IF-C later completed and remediated secure ingress; P85-IF-D is next. After P85-IF-I closes, return to Stage 4B Uyari ve Bildirimler. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending.

Latest Phase 85 Stage 4A.4 status (2026-07-08): Stage 4A.4 AI Asistan Kontrolu panel is implemented. AI controls moved out of overview into dedicated **AI Asistan Kontrolu** tab with persona, status/mode, activation window, safety checklist, autopilot readiness gate, lock status, and preflight blockers. Added `ai-assistant-control-panel.tsx` and `ai-assistant-control-panel-helpers.ts`; updated `clients-panel.tsx` and visual smoke for the new tab. Save still uses existing `PATCH /api/clients/[id]` path. Verification: lint 0 errors (3 pre-existing warnings), helper tests 4/4, full app suite 734 passed / 4 skipped, build passed, Playwright visual 36/36, `git diff --check` clean. Stage 4A Danisan Kontrol Paneli (Stage 4A.1-4A.4) is complete. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending.

Latest Phase 85 Stage 4A.3 status (2026-07-08): Stage 4A.3 Menu Paneli is implemented. The client menu tab is now a first-class **Menu** workflow with four template picker cards, Turkish template labels/descriptions, plan status badges (Taslak/Aktif/Arsiv), conflict display, activation hard-block on severe menu/food-rule conflicts, and integrated MANU-only DOCX/PDF export when the active plan is eligible (`exportVisible`). Added `menu-workflow-panel.tsx`, `menu-workflow-export-section.tsx`, and `menu-workflow-panel-helpers.ts`; upgraded `menu-plan-panel.tsx`. Create/save/activate still use existing menu plan routes; export uses `/api/clients/[id]/menu-plans/export`. Verification: lint 0 errors (3 pre-existing warnings), helper tests 4/4, full app suite 730 passed / 4 skipped, build passed, Playwright visual 36/36, `git diff --check` clean. Next step is to request explicit user approval before implementing Stage 4A.4 AI Asistan Kontrolu panel. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending.

Latest Phase 85 Stage 4A.2 status (2026-07-08): Stage 4A.2 Aktif Beslenme Plani Paneli is implemented. The client food-rules tab is now **Aktif Beslenme Plani** with a dense Phase 77D catalog tree (main/sub/food Izinli/Yasak toggles), quick search, selection summary, conflict review, and save hard-block on severe conflicts. Added `catalog-tree-browser.tsx`, `active-nutrition-plan-panel.tsx`, and `active-nutrition-plan-helpers.ts`; upgraded `food-rules-panel.tsx`. Save still uses `/api/clients/[id]/food-rule-profile`. Verification: lint 0 errors (3 pre-existing warnings), helper tests 5/5, full app suite 726 passed / 4 skipped, build passed, Playwright visual 36/36. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending.

Latest Phase 85 Stage 4A.1 status (2026-07-08): Stage 4A.1 Danisan Formu Paneli is implemented. The client `tab_personal_form` workspace now renders the active Phase 77C schema section-by-section with prompt-access cues, autopilot-required missing status, and save through the existing `POST /api/clients/forms` path. Added `app/src/components/dashboard/client-form-panel.tsx` and `app/src/lib/client-form-panel-helpers.ts`; updated `clients-panel.tsx` and `dashboard-app.tsx`. Verification: lint 0 errors (3 pre-existing warnings), targeted helper tests 5/5, full app suite passed, build passed, Playwright visual 36/36, `git diff --check` clean. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending.

Latest Phase 85 Stage 4A planning status (2026-07-08): `docs/PHASE_85_STAGE_4A_DANISAN_KONTROL_PANELI_MIMARI_VE_HIZMET_AKISI_PLANI.md` is created. The user redirected dashboard priority to the per-client service surface before broad dashboard shell/workflow polish. Code review confirmed the four Stage 4A modules and their existing contracts: Phase 77C client form responses, Phase 77D/77E catalog and food-rule profile, Phase 77F/77J menu plan/export, and AI persona/status/mode/preflight/safety controls. Stage 4A.1 through Stage 4A.4 are complete. The later P85-IF planning lock supersedes Stage 4B as the immediate next step. Production pilot remains `NO-GO`; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending.

Workspace:

```text
C:\Users\Dell\OneDrive\Masaüstü\MANU-AI
```

Use this folder for all new files.

Start by reading:

1. `PLAN.md`
2. `PROJECT_PLAN.md`
3. `docs/NEXT_PHASE_EXECUTION_PLAN.md`
4. `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md` (current strategic roadmap)
5. `docs/PHASE_77M_MASTER_REBASELINE_AND_SPEC.md` and `docs/PHASE_77M_77Y_AI_QUALITY_MASTER_PLAN.md` (Phase 77M-77Y complete; WhatsApp adapter track 77AA–77AH is mock/gated only)
6. `docs/PHASE_77Z_REPOSITORY_CLEANUP_AND_CURSOR_PLAN_MIGRATION_SPEC.md` (repository cleanup and continuity closure phase)
6k. `docs/PHASE_77AA_WHATSAPP_MOCK_GATED_ADAPTER_PRD_AND_SCOPE_LOCK_SPEC.md` (adapter scope lock)
6l. `docs/PHASE_77AB_WHATSAPP_CLOUD_PAYLOAD_NORMALIZATION_SPEC.md` (payload normalization)
6m. `docs/PHASE_77AC_DISABLED_WEBHOOK_BOUNDARY_AND_IDENTITY_QUARANTINE_SPEC.md` (mock webhook boundary)
6p. `docs/PHASE_78_DEPENDENCY_R405_CLOSURE_SPEC.md`
6q. `docs/PHASE_79_PRODUCTION_SCALE_HARDENING_AND_FULL_100X50_REHEARSAL_SPEC.md` (Phase 79 implementation complete)
6r. `docs/PHASE_80_EXTERNAL_LAUNCH_GATE_CLOSURE_AND_R405_ACCEPTANCE_SPEC.md` (Phase 80 plus Phase 80G R-405 hardening complete)
6s. `docs/PHASE_81_DIRECT_PRODUCTION_PILOT_GO_EVALUATION_SPEC.md` (Phase 81A-81H complete as fail-closed GO evaluation; Phase 81F verification refresh blocked by current RLS skipped/pending)
6t. `docs/PHASE_82_FINAL_EXTERNAL_READINESS_CLOSURE_SPEC.md` (Phase 82A-82G complete as fail-closed final external readiness closure; baseline `NO_GO_EXTERNAL_PREREQUISITES_OPEN`; Phase 82G verification `blocked` with `repoLocalClosureComplete: true`)
6u. `docs/PHASE_83_COMMERCIAL_PWA_AND_FRONTEND_RELAUNCH_SPEC.md` (Phase 83A-83H plus final remediation complete locally; **Phase 83 track closed**; production pilot remains `NO-GO`)
6v. `docs/PHASE_84_COMMERCIAL_SAAS_RELAUNCH_AND_ONBOARDING_SPEC.md` (Phase 84A-84J complete for hosted commercial sandbox: SiriusAI public relaunch, contact leads, magic-link login, onboarding claim, admin subdomain, custom SMTP)
6w. `docs/PHASE_85_FRONTEND_REDESIGN_AND_DESIGN_SYSTEM_SPEC.md` (Phase 85 Stages 1-3 and Stage 4A complete; P85-IF is the mandatory foundation before Stage 4B)
6x. `docs/PHASE_85_STAGE_3_PUBLIC_COMMERCIAL_ENTRY_ACTION_PLAN.md` (implemented Stage 3 invite-led public website and commercial entry surfaces)
6y. `docs/PHASE_85_STAGE_4A_DANISAN_KONTROL_PANELI_MIMARI_VE_HIZMET_AKISI_PLANI.md` (canonical Danisan Kontrol Paneli Mimari ve Hizmet Akisi Plani; Stage 4A.1-4A.4 implemented and Stage 4A closed)
6z. `docs/PHASE_85_INTERSTAGE_TRUSTED_CLINICAL_COMMUNICATION_MEMORY_PLAN.md` and `docs/PHASE_85_INTERSTAGE_TRUSTED_CLINICAL_COMMUNICATION_MEMORY_SPEC.md` (canonical P85-IF plan plus P85-IF-A contract, P85-IF-B data model foundation, and P85-IF-C ingress/ledger/routing/quarantine engine; P85-IF-D next)
6i. `docs/PHASE_77Y_CONTINUITY_EVIDENCE_AND_LAUNCH_GATE_UPDATE_SPEC.md`
6j. `docs/PHASE_77J_DOCX_PDF_EXPORT_AND_DATA_LIFECYCLE_V1_2_SPEC.md`
6a. `docs/PHASE_77I_SIMPLIFIED_DIETITIAN_UX_SPEC.md`
6b. `docs/PHASE_77H_PROMPTCONTEXT_ANSWERABILITY_OUTPUT_GUARD_V2_SPEC.md`
7. `docs/PHASE_77D_MASTER_FOOD_CATALOG_SPEC.md`
8. `docs/PHASE_77C_CLIENT_PERSONAL_FORM_V2_SPEC.md`
9. `docs/PHASE_77A_MANUAL_SOURCE_AUTHORITY_REBASELINE_SPEC.md` (roadmap rebaseline)
9. `docs/PHASE_76Q_VERIFICATION_AND_COMMIT_PROTOCOL_SPEC.md` (latest completed verification phase)
9. `docs/PHASE_76P_CONTINUITY_EVIDENCE_GATE_UPDATE_SPEC.md`
10. `docs/PHASE_76O_100X50_SYNTHETIC_FOOD_MIX_REHEARSAL_SPEC.md`
11. `docs/PHASE_76N_SUPABASE_RLS_EXPORT_REDACTION_TRANSACTIONAL_COVERAGE_SPEC.md`
12. `docs/PHASE_76M_CALIBRATION_METRICS_EXPANSION_SPEC.md`
13. `docs/PHASE_76L_PERMISSION_GRAPH_RUNTIME_BRIDGE_SPEC.md`
14. `docs/PHASE_76K_CHAT_FOOD_RULE_PROPOSAL_SPEC.md`
15. `docs/PHASE_76J_DASHBOARD_FOOD_RULE_MANAGEMENT_SPEC.md`
16. `docs/PHASE_76I_PROMPTCONTEXT_PROVIDER_OUTPUT_GUARD_SPEC.md`
17. `docs/PHASE_76H_PRODUCT_INGREDIENT_VERIFICATION_SPEC.md`
18. `docs/PHASE_76G_CLINICAL_SECOND_LAYER_FALSE_YELLOW_CALIBRATION_SPEC.md`
19. `docs/PHASE_76F_INTENT_SPECIFIC_ANSWERABILITY_SPEC.md`
20. `docs/PHASE_76E_FOOD_RULE_ENGINE_SPEC.md`
21. `docs/PHASE_76D_STRUCTURED_FOOD_RULE_DATA_MODEL_SPEC.md`
22. `docs/PHASE_76C_STRUCTURED_FOOD_RULE_GREEN_CAPACITY_SPEC.md`
23. `docs/PHASE_76B_EXPANDED_CHAT_FORM_SAFETY_UPDATE_SPEC.md`
24. `docs/PHASE_76A_DIETITIAN_CHAT_FORM_UPDATE_PROPOSALS_SPEC.md`
25. `docs/PHASE_75_GEMINI_PROVIDER_GATE_SPEC.md`
26. `docs/PHASE_74_DATA_LIFECYCLE_DSAR_SPEC.md`
27. `docs/PHASE_73_HEALTH_REGULATION_CALIBRATION_SPEC.md`
28. `docs/PHASE_72_REGULATION_PERMISSION_GRAPH_SPEC.md`
29. `docs/PHASE_71_TURKIYE_OFFICIAL_HEALTH_SOURCE_INGESTION_SPEC.md`
30. `docs/PHASE_70_USER_SUPPLIED_FORM_HARDENING_SPEC.md`
31. `docs/PHASE_69_DIRECT_5000_CLIENT_SCALE_FOUNDATION_SPEC.md`
32. `docs/PHASE_68_GREEN_MAXIMIZATION_INTENT_TAXONOMY_SPEC.md`
33. `docs/PHASE_67_APPROVED_SOURCE_ANSWERABILITY_ENGINE_SPEC.md`
34. `docs/PHASE_66_PRODUCT_COMMUNICATION_COVENANT_LOCK_SPEC.md`
35. `docs/PHASE_65_OFFICIAL_REGULATION_PDF_CORPUS_QA_SPEC.md`
36. `docs/PHASE_64_STRUCTURED_LAUNCH_GATE_EVIDENCE_ENGINE_SPEC.md`
37. `docs/PHASE_63_PRODUCTION_PILOT_GO_REBASELINE_SPEC.md`
38. `docs/PHASE_62_ARCHITECTURE_REVIEW_REMEDIATION_WAVE2_SPEC.md`
39. `docs/PHASE_61_SCOPE_GUARD_RAG_SECOND_LAYER_SPEC.md`
40. `docs/RISK_REGISTER.md`
41. `docs/DATA_INVENTORY.md`
42. `docs/DATASET_STRATEGY.md`
43. `docs/MOBILE_APP_STRATEGY.md`
44. `dietitian-ai-assistant/README.md`
45. `dietitian-ai-assistant/docs/architecture.md`
46. `dietitian-ai-assistant/docs/data-model.sql`

## Current Handoff Override - Phase 84H QA, Docs, Deployment, Evidence - 2026-07-03

- **Phase 84H repo-local QA complete:** `phase-84h-verification-refresh.ts` locks eight commercial SaaS QA scenarios (landing CTAs, contact leads, magic link, auth callback redirects, onboarding claim, dashboard gate, admin allowlist, admin operations).
- Visual coverage added in `tests/visual/commercial-saas.visual.spec.ts` for login, admin, purchase success, contact form, onboarding fail-closed redirect; existing landing/dashboard visual suite retained.
- Verification: Phase 84 targeted tests 36/36; 84H tests 5/5; visual tests 36/36; lint 0 errors (2 pre-existing warnings); build passed.
- **VPS deployment verification complete for Phase 84I fallback onboarding:** hosted migrations (`84c`, `84e`, `84g`) are applied, admin DNS/SSL/Nginx are configured, PM2 is online, and generated token-hash onboarding reached dashboard 200. Real email delivery remains pending Phase 84J custom SMTP.
- **Phase 84 track:** repo-local closure, VPS generated token-hash onboarding/dashboard verification, and real custom-SMTP magic-link dashboard verification are complete for the hosted sandbox. Production pilot remains `NO-GO`.
- **R-425:** mitigated in hosted sandbox after real Resend/Supabase custom-SMTP email link reached dashboard.

### Files Updated For Phase 84H

- `app/src/lib/phase-84h-verification-refresh.ts`
- `app/src/lib/phase-84h-verification-refresh.test.ts`
- `app/tests/visual/commercial-saas.visual.spec.ts`
- continuity docs listed in Phase 84 spec

## Previous Handoff Override - Phase 84G Subscription Operations Hardening - 2026-07-03

- **Phase 84G complete:** admin operations distinguish app access revoke vs sandbox Stripe subscription cancel.
- `POST /api/commercial/admin/subscriptions/cancel` cancels sandbox Stripe subscription only when configured; entitlement updates via webhook.
- `POST /api/commercial/admin/entitlements/revoke` remains app access revoke (`revoked` entitlement).
- Audit extended: `stripe_subscription_canceled`, `lead_status_updated`, `admin_operation_blocked`; actor summary threaded through admin write routes.
- Migration: `app/supabase/migrations/20260703120000_phase_84g_commercial_admin_audit_extension.sql`.
- Defensive UX: Turkish copy for onboarding/purchase edge states; admin subscription panel with confirmation steps.
- Verification: Phase 84G tests 4/4; related 83C/83F tests 25/25; lint with two pre-existing warnings; build passed.
- **Next sub-phase: Phase 84H** QA, docs, deployment, evidence.
- Production pilot remains `NO-GO`; Stripe sandbox-only guard preserved.

### Files Updated For Phase 84G

- `app/supabase/migrations/20260703120000_phase_84g_commercial_admin_audit_extension.sql`
- `app/src/lib/phase-84g-subscription-operations.ts`
- `app/src/lib/phase-84g-subscription-operations.test.ts`
- `app/src/lib/phase-83c-stripe-billing-gate.ts` (`cancelSubscription`)
- `app/src/lib/phase-83f-commercial-admin.ts` (audit event types)
- `app/src/lib/commercial-admin-store.ts`
- `app/src/app/api/commercial/admin/subscriptions/cancel/route.ts`
- `app/src/app/api/commercial/admin/*` (actor audit threading)
- `app/src/components/commercial-admin-console.tsx`
- `app/src/components/onboarding-claim-panel.tsx`
- `app/src/components/purchase-success-onboarding.tsx`
- `app/src/components/purchase-flow.tsx`

## Previous Handoff Override - Phase 84F Admin Subdomain And Professional Admin Console - 2026-07-03

- **Phase 84F complete:** professional admin console at `/admin` with Supabase magic-link + email allowlist (`MANU_ADMIN_EMAIL_ALLOWLIST`, default `olkuenver@gmail.com`).
- APIs: dual auth on `/api/commercial/admin/*` via `evaluateCommercialAdminAccess` (allowlisted session OR emergency token); new `GET /api/commercial/admin/audit`; `POST /api/admin/auth/magic-link`.
- UI: `admin-login-form.tsx`, session-mode `commercial-admin-console.tsx` with overview metrics, leads, invites, subscriptions, ledger, health, audit trail.
- Routing: `admin.siriusai.store` host rewrite in `proxy.ts`; `/commercial-admin` redirects to `/admin`; emergency token panel at `/commercial-admin/emergency`.
- Env: `MANU_ADMIN_HOST=admin.siriusai.store`, `MANU_ADMIN_EMAIL_ALLOWLIST=olkuenver@gmail.com`.
- VPS still needs DNS A record `admin.siriusai.store -> 167.233.207.102`, Nginx/SSL, and Supabase redirect URL for admin host.
- Verification: Phase 84F tests 4/4 + access tests 2/2; full suite 695 passed / 4 skipped; build passed; lint with two pre-existing warnings.
- **Next sub-phase: Phase 84G** subscription operations hardening.
- Production pilot remains `NO-GO`; R-405 remains open; R-406 current post-83 local Supabase/RLS re-run remains pending when local Supabase is unavailable.

### Files Updated For Phase 84F

- `app/src/lib/phase-84f-admin-console.ts`
- `app/src/lib/phase-84f-admin-console.test.ts`
- `app/src/lib/commercial-admin-access.ts`
- `app/src/lib/commercial-admin-access.test.ts`
- `app/src/lib/commercial-admin-store.ts` (audit list helpers)
- `app/src/app/api/admin/auth/magic-link/route.ts`
- `app/src/app/api/commercial/admin/audit/route.ts`
- `app/src/app/api/commercial/admin/*` (dual auth)
- `app/src/app/admin/page.tsx`
- `app/src/components/admin-login-form.tsx`
- `app/src/components/commercial-admin-console.tsx`
- `app/src/app/commercial-admin/page.tsx` (redirect)
- `app/src/app/commercial-admin/emergency/page.tsx`
- `app/src/proxy.ts`
- `app/src/app/auth/callback/route.ts` (admin error redirect)
- `app/.env.local.example`

## Previous Handoff Override - Phase 84E Post-Payment Customer Onboarding - 2026-07-02

- **Phase 84E complete:** paid customers can claim provisioned tenants after magic-link login.
- APIs: `GET /api/commercial/onboarding/status?session_id=...` and `POST /api/commercial/onboarding/claim`.
- Claim validates consumed invite + active entitlement + authenticated email match; creates owner `tenant_memberships` and `dietitians` profile idempotently; never seeds demo clients.
- Audit table: `commercial_onboarding_events` (`magic_link_requested`, `claim_completed`, `claim_blocked`).
- `/purchase/success?session_id=...` now guides account creation via magic link; `/onboarding` runs the claim step.
- Migration: `app/supabase/migrations/20260702140000_phase_84e_commercial_onboarding_events.sql`.
- Verification: Phase 84E tests 5/5; build passed.
- **R-425 mitigated locally** here is superseded by Phase 84I/84J hosted sandbox onboarding and real email dashboard verification.
- **Next sub-phase: Phase 84F** admin subdomain and professional admin console.
- Production pilot remains `NO-GO`; R-405 remains open; R-406 current post-83 local Supabase/RLS re-run remains pending when local Supabase is unavailable.

### Files Updated For Phase 84E

- `app/supabase/migrations/20260702140000_phase_84e_commercial_onboarding_events.sql`
- `app/src/lib/phase-84e-customer-onboarding.ts`
- `app/src/lib/phase-84e-customer-onboarding.test.ts`
- `app/src/lib/commercial-onboarding-store.ts`
- `app/src/app/api/commercial/onboarding/status/route.ts`
- `app/src/app/api/commercial/onboarding/claim/route.ts`
- `app/src/components/purchase-success-onboarding.tsx`
- `app/src/components/onboarding-claim-panel.tsx`
- `app/src/app/purchase/success/page.tsx`
- `app/src/app/onboarding/page.tsx`
- `app/src/lib/phase-83e2-purchase-ux.ts`
- `app/src/app/api/auth/magic-link/route.ts`
- `app/src/lib/phase-84d-customer-auth.ts`
- continuity docs listed in Phase 84A

## Previous Handoff Override - Phase 84D Customer Auth Foundation - 2026-07-02

- **Phase 84D complete:** registered customers sign in via Supabase magic link at `/login`.
- APIs: `POST /api/auth/magic-link` (registered commercial email gate + rate limit) and `GET /auth/callback` (code exchange + safe redirect).
- Post-auth redirect contract: active membership/profile/entitlement → `/dashboard`; paid-but-unclaimed workspace → `/onboarding`; no access → `/onboarding?state=support`.
- `/onboarding` is a placeholder until Phase 84E claim flow ships.
- Configure Supabase Auth redirect URLs: `https://siriusai.store/auth/callback`, `https://admin.siriusai.store/auth/callback`, and local `NEXT_PUBLIC_APP_URL/auth/callback`.
- Verification: Phase 84D tests 7/7; build passed.
- **R-425 pre-claim status** is superseded by Phase 84E/84I/84J.
- **Next sub-phase: Phase 84E** post-payment customer onboarding claim.
- Production pilot remains `NO-GO`; R-405 remains open; R-406 current post-83 local Supabase/RLS re-run remains pending when local Supabase is unavailable.

### Files Updated For Phase 84D

- `app/src/lib/phase-84d-customer-auth.ts`
- `app/src/lib/phase-84d-customer-auth.test.ts`
- `app/src/lib/customer-auth-store.ts`
- `app/src/lib/customer-auth-session.ts`
- `app/src/app/api/auth/magic-link/route.ts`
- `app/src/app/auth/callback/route.ts`
- `app/src/components/customer-login-form.tsx`
- `app/src/app/login/page.tsx`
- `app/src/app/onboarding/page.tsx`
- `app/src/lib/phase-84b-public-website.ts`
- `app/src/proxy.ts`
- `app/src/app/dashboard/page.tsx`
- `app/src/lib/rate-limit.ts`
- `app/.env.local.example`
- continuity docs listed in Phase 84A

## Previous Handoff Override - Phase 84C Lead And Contact Flow - 2026-07-02

- **Phase 84C complete:** public contact form on `/` persists leads to `commercial_leads` via service-role `POST /api/contact/leads`.
- Fields: name, email, clinic name, message, source path, status (`new` | `contacted` | `closed`), timestamps.
- Spam-safe: field length caps, honeypot (`companyWebsite`), rate limit (`commercial_contact_leads`), safe errors (no secret leakage).
- Mailto fallback to `olkuenver@gmail.com` remains on the contact section and when the store is unconfigured (503).
- Token admin (`/commercial-admin`) loads leads from `/api/commercial/admin/leads` and supports status updates until 84F admin subdomain ships.
- Migration: `app/supabase/migrations/20260702120000_phase_84c_commercial_leads.sql` (RLS enabled, no tenant-member policies).
- Verification: Phase 84C tests 5/5; Phase 84B regression 4/4; lint (2 pre-existing warnings); build passed.
- **R-425 pre-auth/onboarding status** is superseded by Phase 84D-84J.
- **Next sub-phase: Phase 84D** customer auth foundation (`/login`, magic link, `/auth/callback`).
- Production pilot remains `NO-GO`; R-405 remains open; R-406 current post-83 local Supabase/RLS re-run remains pending when local Supabase is unavailable.

### Files Updated For Phase 84C

- `app/supabase/migrations/20260702120000_phase_84c_commercial_leads.sql`
- `app/src/lib/phase-84c-contact-leads.ts`
- `app/src/lib/phase-84c-contact-leads.test.ts`
- `app/src/lib/commercial-leads-store.ts`
- `app/src/app/api/contact/leads/route.ts`
- `app/src/app/api/commercial/admin/leads/route.ts`
- `app/src/components/contact-lead-form.tsx`
- `app/src/components/siriusai-marketing-page.tsx`
- `app/src/components/commercial-admin-console.tsx`
- `app/src/lib/phase-84b-public-website.ts`
- `app/src/lib/commercial-public-rate-limit.ts`
- `app/src/lib/phase-83g-entitlement-hardening.ts`
- `app/src/lib/rate-limit.ts`
- `app/src/app/api/commercial/admin/health/route.ts`
- `app/src/lib/supabase-rls.integration.test.ts`
- `app/src/lib/phase-83f-commercial-admin.ts`
- `docs/PHASE_84_COMMERCIAL_SAAS_RELAUNCH_AND_ONBOARDING_SPEC.md`
- continuity docs listed in Phase 84A

## Previous Handoff Override - Phase 84B Professional Public Website - 2026-07-02

- **Phase 84B complete:** rebuilt `/` as professional SiriusAI marketing homepage via `siriusai-marketing-page.tsx` and `phase-84b-public-website.ts`.
- Sections live: hero, product value, supervised AI safety, workflow, PWA/mobile, clinical governance, invite-only onboarding, contact CTA.
- Header actions: `Giriş yap` → `/login` (placeholder until 84D), `Satın al` → `/purchase`.
- Primary hero demo button removed from public homepage. Demo entry is env-gated at `MANU_ALLOW_PUBLIC_DEMO_LOGIN=true` via `/demo` and `/api/demo-login`.
- Contact CTA uses `mailto:olkuenver@gmail.com`; online lead form storage remains Phase 84C.
- Sanitized product mock panel only; no real client/PHI data.
- Verification: Phase 84B tests 4/4; purchase UX regression 8/8; lint (2 pre-existing warnings); build passed.
- **R-425 pre-auth/onboarding status** is superseded by Phase 84D-84J.
- **Next sub-phase: Phase 84C** lead/contact flow (`commercial_leads`, `/api/contact/leads`).
- Production pilot remains `NO-GO`; R-405 remains open; R-406 current post-83 local Supabase/RLS re-run remains pending when local Supabase is unavailable.

### Files Updated For Phase 84B

- `app/src/lib/phase-84b-public-website.ts`
- `app/src/lib/phase-84b-public-website.test.ts`
- `app/src/components/siriusai-marketing-page.tsx`
- `app/src/app/page.tsx`
- `app/src/app/login/page.tsx`
- `app/src/app/demo/page.tsx`
- `app/src/app/api/demo-login/route.ts`
- `app/src/lib/phase-83e2-purchase-ux.ts`
- `app/src/app/layout.tsx`
- `app/.env.local.example`
- `app/playwright.config.ts`
- `app/tests/visual/dashboard.visual.spec.ts`
- `docs/PHASE_84_COMMERCIAL_SAAS_RELAUNCH_AND_ONBOARDING_SPEC.md`
- continuity docs listed in Phase 84A

## Previous Handoff Override - Phase 84A PRD, Spec, And Architecture Freeze - 2026-07-02

- **Phase 84A complete:** canonical spec frozen in `docs/PHASE_84_COMMERCIAL_SAAS_RELAUNCH_AND_ONBOARDING_SPEC.md`. Documentation-only; no runtime behavior changed.
- Architecture freeze locks three surfaces: public marketing (`siriusai.store`), customer product (login/onboarding/dashboard/install), and admin operations (`admin.siriusai.store` → `/admin`).
- Sanitized VPS payment evidence recorded: test checkout consumed invite, provisioned tenant, created active entitlement, wrote `checkout.session.completed` and `invoice.paid` ledger entries. No secrets stored in repo.
- This original **R-425** gap is superseded by Phase 84E/84I/84J: hosted sandbox onboarding, membership/profile claim, real custom-SMTP email, and dashboard access are verified.
- Phase 84 locked decisions unchanged: public brand `SiriusAI`; magic-link login; contact `olkuenver@gmail.com`; admin allowlist auth with token fallback emergency-only; paid tenants start empty.
- **Next implementation sub-phase: Phase 84B** professional SiriusAI public website (`/`, remove/env-gate demo CTA on VPS, `Giriş yap`, contact CTA).
- Production pilot remains `NO-GO`; R-405 remains open; R-406 current post-83 local Supabase/RLS re-run remains pending when local Supabase is unavailable.

### Files Updated For Phase 84A

- `docs/PHASE_84_COMMERCIAL_SAAS_RELAUNCH_AND_ONBOARDING_SPEC.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `PLAN.md`
- `PROJECT_PLAN.md`
- `README.md`
- `app/README.md`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`
- `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`
- `docs/PILOT_READINESS_EVIDENCE_PACK.md`
- `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`
- `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md`

## Previous Handoff Override - Phase 84 Commercial SaaS Relaunch Planning - 2026-07-02

- Latest completed operational validation: sandbox deployment to Hetzner VPS at `https://siriusai.store` with Nginx, PM2, Let's Encrypt HTTPS, Stripe test webhook endpoint `https://siriusai.store/api/commercial/webhook`, and Phase 85 Stage 3 redesign release `phase85-stage3-redesign-20260707225306` live. This remains sandbox validation only.
- Stripe remains test/sandbox only. No live Stripe key, real charging, production billing activation, real provider/channel, monitoring, secret manager, backup provider, or real client health-data path was activated.
- Verified test checkout result: commercial invite was consumed; tenant `Olku Enver Test Kliniği` was provisioned; active entitlement was created; billing ledger contains `checkout.session.completed` and `invoice.paid`.
- Original key discovered gap R-425 is mitigated in the hosted sandbox by Phase 84E/84I/84J; production pilot remains `NO-GO`.
- Added canonical Phase 84 spec: `docs/PHASE_84_COMMERCIAL_SAAS_RELAUNCH_AND_ONBOARDING_SPEC.md`.

## Previous Handoff Override - Phase 83F Hosted Supabase Recovery Diagnostics - 2026-07-02

- Latest local change: Phase 83F commercial admin recovery diagnostics for the hosted Supabase setup issue.
- Added protected `/api/commercial/admin/health`; it requires the commercial admin token and returns sanitized health for admin gate, Supabase admin env, and commercial table probes.
- Added store-env/probe diagnostics in `app/src/lib/phase-83f-commercial-admin.ts` and tests in `app/src/lib/phase-83f-commercial-admin.test.ts`.
- `/commercial-admin` now shows a clearer health explanation when invite/subscription/ledger loading fails, including unreachable Supabase project host, pending migrations, invalid service-role key, incomplete env, or `MANU_DEV_FALLBACK_STORE=true` mismatch.
- This does **not** add a fallback commercial admin store and does **not** activate hosted Supabase credentials. Invites still require a reachable hosted/local Supabase project with Phase 83 commercial migrations applied.
- Verification: targeted Phase 83F diagnostics tests 12/12; `npm run lint` passed with two pre-existing warnings; `npm run build` passed.
- Production pilot remains `NO-GO`; R-405 remains open; R-406 current post-83 local Supabase/RLS re-run remains pending when Supabase is unavailable.

## Previous Handoff Override - Phase 83 Final Remediation - 2026-07-01

- Phase 83H verification plus final remediation is the latest completed local Phase 83 work. **Phase 83 track is closed locally.**
- Added `phase-83h-verification-refresh.ts`, extended Playwright visual coverage (16/16 across desktop/tablet/Android/iPhone viewports: purchase success/cancel, app-install fallback block, dashboard parity), and extended RLS integration coverage for `commercial_admin_audit_events` service-role isolation.
- Final remediation removed stale current-state claims that 83F/83G are pending and clarified the commercial admin single-entitlement revoke contract.
- `/api/commercial/admin/entitlements/revoke` accepts `{ tenantId }`; `mobileInstallOnly: true` is rejected as `mobile_install_only_revoke_unsupported`; admin audit records `entitlement_revoked` only.
- The local admin console no longer exposes a mobile-install-only revoke action. Full subscriber entitlement revoke blocks both dashboard APIs and mobile/PWA install access through the same entitlement.
- Verification: targeted Phase 83 tests 64/64; `git diff --check` passed (CRLF warnings only); lint passed (2 pre-existing warnings); build passed; `npm run test:visual` 16/16; `npm run release:verify` core 225/225 + app 665 passed / 4 skipped; `npm run rehearse:production-scale:79g` passed.
- `npm run test:rls` skipped 21/21 because local Supabase is unavailable, so R-406 current re-run remains pending. Do not claim production readiness.
- Fixed `release-verify.mjs` `.next` cleanup race on Windows (`maxRetries`/`retryDelay`) after parallel visual/rehearse runs caused `ENOTEMPTY`.
- Production pilot remains `NO-GO`. Next work is external launch-gate / R-405 / RLS prerequisites outside the Phase 83 track.

## Previous Handoff Override - Phase 83G - 2026-07-01

- Phase 83G security, privacy, and compliance hardening is the latest completed local phase work.
- Protected dashboard APIs now require active entitlement via `resolveAppTenantContext()` when Supabase store mode is active (dev fallback unchanged).
- Public invite-status and checkout routes have in-memory fail-closed rate limits; PWA stale-session checks include inactive/revoked entitlement via `/api/auth-state`.
- Demo seed upserts active `tenant_entitlements` for local Supabase. Targeted Phase 83 tests passed 58/58; lint passed with two pre-existing warnings; build passed.
- Production pilot remains `NO-GO`. Next phase is 83H (verification and release evidence).

## Previous Handoff Override - Phase 83F - 2026-07-01
- Added fail-closed commercial admin gate (`MANU_ALLOW_COMMERCIAL_ADMIN` + `MANU_COMMERCIAL_ADMIN_TOKEN`), `commercial_admin_audit_events` migration, admin store/API routes under `/api/commercial/admin/*`, and local ops console at `/commercial-admin`.
- Admin can create/revoke invites, inspect subscription summaries, read billing event ledger (with audit), and revoke the subscriber entitlement that gates both dashboard APIs and mobile/PWA install access.
- Targeted Phase 83 tests passed 52/52; lint passed with two pre-existing warnings. `npm run test:rls` remains skipped when local Supabase is unavailable, so R-406 current re-run remains pending.
- This Phase 83F note is superseded by later Phase 83G/H and final remediation. Production pilot remains `NO-GO`.

## Previous Handoff Override - Phase 83E remediation - 2026-07-01
- Closed the post-83E visual gaps: unique purchase headings, Turkish dashboard visual-smoke labels, mobile bottom nav reachability across all eight views, and safety-gate/red-lock workflow ordering.
- Verification passed with `npm run test:visual` 6/6, targeted Phase 83 tests 50/50, lint with two pre-existing warnings, full unit suite 645 passed / 4 skipped, `npm run release:verify` core 225/225 + app 645 passed / 4 skipped, and `git diff --check` with CRLF warnings only.
- `npm run test:rls` skipped 21/21 because local Supabase was unavailable; R-406 current re-run remains pending.
- This Phase 83E remediation note is superseded by later Phase 83F/G/H and final remediation.
- Production pilot remains `NO-GO`.

## Previous Handoff Override - Phase 83E-5 - 2026-07-01

- Phase 83E-5 mobile ergonomics (fifth sub-phase). Sticky action bars, keyboard-aware scroll, 44px touch targets, safe-area. Next sub-phase was 83E-6.

## Previous Handoff Override - Phase 83E-4 - 2026-07-01

- Phase 83E-4 full dashboard parity (fourth sub-phase of the Phase 83E frontend relaunch).
- Recomposed the ~3,189-line monolithic `app/src/components/dashboard-app.tsx` into domain panel modules under `app/src/components/dashboard/`: `shared.tsx` (primitives, helpers, constants, `ViewKey`/`ClientDetailTab` types), `overview-panel.tsx`, `clients-panel.tsx` (client list + `ClientDetailForm`/tabs, `ClientDetailStatusSummary`, `ClientScopedCopilotTab`, `ClientExportTab`, `ClientContextUpdatePanel`), `conversation-panel.tsx`, `simulator-panel.tsx`, `voice-panel.tsx`, `forms-panel.tsx`, `copilot-panel.tsx` (incl. `UpdateProposalCard`), and `handoffs-panel.tsx`.
- `app/src/components/dashboard-app.tsx` is now a ~830-line orchestrator: it keeps the 83E-3 shell (sidebar, header, mobile bottom nav, notifications) plus all `useManuState` wiring and derived memos, and delegates each `view` to its domain panel via props.
- Extraction was verbatim. Every workflow, all `data-testid`s, provenance/origin labels, message risk colors, red-risk reactivation lock, approval flows, and fail-closed logic are unchanged. Next sub-phase was 83E-5.

## Previous Handoff Override - Phase 83E-3 - 2026-07-01

- Phase 83E-3 authenticated app shell (third sub-phase of the Phase 83E frontend relaunch).
- Added fail-closed shell logic `app/src/lib/phase-83e3-app-shell.ts`: `deriveDashboardAccessGate` maps membership/dietitian/entitlement to `ok`/`no_membership`/`no_dietitian_profile`/`no_invite`/`checkout_incomplete`/`inactive_subscription`/`revoked_access` (unknown/missing → blocked), plus `describeSubscriptionStatus`/`describeInstallState` header descriptors. Unit tested (4/4).
- Rebuilt `app/src/components/auth-states.tsx` on the 83E-1 design system with all six gated-state screens (each fail-closed, no app data, safe sign-out via `/api/demo-logout`, purchase/contact CTA where relevant) plus a `DashboardGatedState` router.
- `app/src/app/dashboard/page.tsx` resolves entitlement status server-side and renders the correct gated screen; only an active entitlement reaches the dashboard. The Supabase-unconfigured fallback/demo path is unchanged.
- The dashboard shell gained a mobile bottom navigation (`lg:hidden`, 44px+ targets, safe-area); the desktop sidebar nav is desktop-only (`hidden lg:block`); the header shows subscription status + install state pills and a safe sign-out when authenticated. Next sub-phase was 83E-4.

## Previous Handoff Override - Phase 83E-2 - 2026-07-01

- Phase 83E-2 public intro + purchase UX (second sub-phase of the Phase 83E frontend relaunch).
- Rebuilt public landing (`app/src/app/page.tsx`) as a polished Turkish MANU-AI intro with a clear `Satın al` CTA; exposes no app data.
- Added gated purchase flow: `app/src/components/purchase-flow.tsx` + `app/src/app/purchase/page.tsx`, consuming existing Phase 83C `/api/commercial/invite-status` and `/api/commercial/checkout`. Fail-closed: unapproved → waitlist/contact; unconfigured → "not configured"; only explicit eligible unlocks Stripe checkout.
- Added `app/src/app/purchase/success/page.tsx` (onboarding + install guidance to `/dashboard` and `/app-install`) and `app/src/app/purchase/cancel/page.tsx`.
- New fail-closed presentation logic `app/src/lib/phase-83e2-purchase-ux.ts`, unit tested (8/8). Middleware still gates only `/dashboard/*`; commercial pages are public. Backend/entitlement/Stripe/SW-cache behavior unchanged. Next sub-phase was 83E-3.

## Previous Handoff Override - Phase 83E-1 - 2026-07-01

- Phase 83E-1 design system is the first sub-phase of the Phase 83E frontend relaunch.
- Added clinical SaaS design tokens in `app/src/app/globals.css` and reusable primitives under `app/src/components/ui/` (button, badge/origin/risk, card, field, tabs, segmented-control, dialog, sheet, data-table, timeline, app-shell with sidebar/top bar/bottom nav, plus `tokens.ts`/`cn.ts`/`index.ts`).
- Palette: white/near-white surfaces, charcoal ink, emerald primary, cool neutral borders, ≤8px radius, no decorative gradients, lucide icons, 44px touch targets, safe-area helpers.
- Clinical green/yellow/red reserved for message risk only (`MESSAGE_RISK`); generic UI uses emerald/amber/red/stone tones. Message provenance stays distinguishable via `OriginBadge`.
- Targeted design-system unit test passed (6/6); `npm run lint` clean (0 errors, 2 pre-existing warnings); production build passed. Primitives not yet wired into pages (that begins in 83E-2/83E-3/83E-4).
- With one-time user approval, the two pre-existing Phase 83D lint errors in `pwa-subscriber-shell.tsx` were fixed behavior-preservingly: guard-only `offlineAuditSent`/`staleAuditSent` state converted to `useRef` (removes `react-hooks/set-state-in-effect`), and the re-login `<a href="/">` swapped to `next/link` `<Link>` (removes `@next/next/no-html-link-for-pages`). Phase 83D unit tests still pass (8/8); PWA access/stale-session/SW-registration/no-PHI-cache behavior unchanged.
- Production pilot remains `NO-GO`. Phase 83E changes visual/composition only; no clinical/entitlement/Stripe/SW-cache behavior changed.

## Previous Handoff Override - Phase 83D - 2026-07-01

- Phase 83D gated PWA mobile install center is the latest completed local phase work.
- Added `phase-83d-pwa-install-gate.ts`, `commercial-install-access.ts`, gated `/app-install` page, `pwa-subscriber-shell.tsx`, `app-install-center.tsx`, and `/api/commercial/mobile-install-audit`.
- Service worker caches shell/static only; `/api/*` is network-only; no PHI/API payload caching.
- SW registration is subscriber-only via `PwaSubscriberShell`; global registration removed from `pwa-runtime.tsx`.
- Install audit events recorded in `mobile_install_audit_events` with tenant-scoped RLS.
- Targeted Phase 83D unit tests passed (8/8); production build passed. Next sub-phase is 83E.
- Production pilot remains `NO-GO`.

## Previous Handoff Override - Phase 83C - 2026-07-01

- Phase 83C Stripe checkout and billing gate is the latest completed local phase work.
- Added `phase-83c-stripe-billing-gate.ts`, `commercial-billing-store.ts`, Stripe SDK, migration `20260701130000_phase_83c_commercial_checkout_session.sql`, and API routes under `/api/commercial/*`.
- Sandbox-only gate: `MANU_ALLOW_STRIPE_SANDBOX=true` plus `sk_test_` keys; live Stripe keys blocked.
- Webhook handles `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted` with idempotent ledger writes.
- Targeted Phase 83C unit tests passed (9/9); production build passed. Next sub-phase was 83D.
- Production pilot remains `NO-GO`.

## Previous Handoff Override - Phase 83B - 2026-07-01

- Phase 83B commercial entitlement model is the latest completed local phase work.
- Added migration `app/supabase/migrations/20260701120000_phase_83b_commercial_entitlement_model.sql` with tables `commercial_invites`, `tenant_entitlements`, `billing_customers`, `billing_event_ledger`, `mobile_install_audit_events`, and tenant-scoped RLS.
- Added `app/src/lib/phase-83b-commercial-entitlement-model.ts` with invite normalization, hashed token matching, entitlement transition guards, and dashboard/mobile access evaluation.
- Targeted Phase 83B unit tests passed (8/8). Extended `supabase-rls.integration.test.ts` with commercial table isolation coverage.
- No Stripe integration or production billing activation. Next sub-phase is 83C.
- Production pilot remains `NO-GO`; Phase 83 does not override Phase 80-82 readiness outcomes.

## Previous Handoff Override - Phase 83A - 2026-07-01

- Phase 83A commercial PWA + frontend relaunch scope lock is the latest completed local phase work.
- Added `docs/PHASE_83_COMMERCIAL_PWA_AND_FRONTEND_RELAUNCH_SPEC.md` with immutable Phase 83 rules: PWA-only mobile v1, invite + Stripe sandbox commercial gate, public intro with gated purchase/dashboard/install, full dashboard parity on one shared surface, no production clinical GO.
- No runtime behavior changed in Phase 83A. Next sub-phase is 83B (invite, tenant, subscription entitlement model).
- Production pilot remains `NO-GO`; all eight launch gates remain open; R-405 remains open; R-406 current re-run remains pending when local Supabase is unavailable.
- Phase 83 is a parallel commercial/frontend track and does not override Phase 80-82 readiness outcomes.

## Previous Handoff Override - Phase 82G - 2026-06-30

- Phase 82G verification refresh is the latest completed local phase work.
- Phase 82 final external readiness closure closed across 82A-82G on 2026-06-30 as a fail-closed repo-local project-completion layer, not a production launch.
- Runtime modules: `phase-82b-external-evidence-gap-ledger.ts`, `phase-82c-blocker-reconciliation.ts`, `phase-82d-final-completion-report.ts`, `phase-82e-launch-activation-firewall.ts`, `phase-82g-verification-refresh.ts`.
- `buildPhase82BaselineFinalCompletionReport()` returns `NO_GO_EXTERNAL_PREREQUISITES_OPEN`; `buildPhase82gBaselineVerificationRefreshReport()` returns `repoLocalClosureComplete: true` with verification `blocked` because current RLS is skipped/pending.
- Verification passed with targeted Phase 82 tests (5 files, 31/31), targeted Phase 80 regression tests (4 files, 29/29), targeted Phase 81 regression tests (3 files, 19/19), `git diff --check`, lint with two pre-existing warnings, production build, `npm run test:rls` skipped 20/20, `npm run release:verify` core 225/225 and app 595 passed / 4 skipped across 94 files, and `npm run rehearse:production-scale:79g`.
- All eight launch gates remain open; R-405 remains open; R-406 Phase 50/52 baseline mitigated with current re-run pending when local Supabase is unavailable.
- Production pilot remains `NO-GO` unless external prerequisites close and Phase 82 reaches `READY_FOR_EXTERNAL_CONTROLLED_LAUNCH_AUTHORIZATION`.
- No further repo-local Phase 82 sub-phases remain. Next work is external launch-gate/R-405/RLS closure prerequisites.

## Previous Handoff Override - Phase 82F - 2026-06-30

- Phase 82F continuity and final dossier closure are the latest completed local phase work.
- Phase 82 final external readiness closure completed across 82A-82F on 2026-06-30 as a fail-closed repo-local project-completion layer, not a production launch.
- Runtime modules: `phase-82b-external-evidence-gap-ledger.ts`, `phase-82c-blocker-reconciliation.ts`, `phase-82d-final-completion-report.ts`, `phase-82e-launch-activation-firewall.ts`.
- `buildPhase82BaselineFinalCompletionReport()` returns `NO_GO_EXTERNAL_PREREQUISITES_OPEN`; `repoLocalClosureComplete: false`; `productionPilotGo: false`; `productionPilotStarted: false`.
- Targeted Phase 82 tests passed (4 files, 27/27). Phase 81 baseline remains `NO_GO_NOT_ELIGIBLE`.
- All eight launch gates remain open; R-405 remains open; R-406 Phase 50/52 baseline mitigated with current re-run pending when local Supabase is unavailable.
- Production pilot remains `NO-GO` unless Phase 82 reaches `READY_FOR_EXTERNAL_CONTROLLED_LAUNCH_AUTHORIZATION`.
- Superseded by Phase 82G verification closure; no current Phase 82 sub-phase remains.

## Previous Handoff Override - Phase 81 - 2026-06-30

- Phase 81F verification refresh and Phase 81G hardening are the latest completed local phase work.
- Phase 81 direct production pilot GO evaluation closed across 81A-81H on 2026-06-30 as a fail-closed framework. Phase 81F verification refresh is implemented and blocked because current local RLS evidence is skipped/pending.
- Runtime modules: `phase-81b-phase-80-eligibility.ts`, `phase-81c-launch-authorization-evidence.ts`, `phase-81d-environment-preflight.ts`, `phase-81e-roster-qualification.ts`, `phase-81f-verification-refresh.ts`, `phase-81g-go-readiness-report.ts`.
- `buildPhase81gBaselineGoReadinessReport()` returns `NO_GO_NOT_ELIGIBLE`; `productionPilotGoReady: false`; `productionPilotStarted: false`.
- Verification passed with targeted Phase 81 tests (6 files, 46/46), `git diff --check`, lint with two pre-existing warnings, production build, `npm run test:rls` skipped 20/20, `npm run release:verify` core 225/225 and app 564 passed / 4 skipped across 89 files, and `npm run rehearse:production-scale:79g`. No real provider/channel connections were activated.
- All eight launch gates remain open; R-405 remains open; R-406 current re-run remains pending; `phase81StartEligible` remains `false`.
- Production pilot remains `NO-GO`.

## User's Product Goal

Build MANU-AI: an AI assistant for dietitians that replies to their clients over WhatsApp/Telegram, while the dietitian controls activation, mode, persona, handoff, and manual takeover from a MANU-AI dashboard and mobile app.

The product must be both:

- Web dashboard
- Phone-installable app experience, starting with PWA, later native React Native/Expo

## Important User Decisions

- The product is for dietitians and their clients.
- Clients communicate mostly through WhatsApp or Telegram.
- Dietitian controls everything from MANU-AI, not WhatsApp.
- AI can be active or passive per client.
- Dietitian can activate/passivate AI for any client at any time.
- Optional activation time windows are supported.
- There is no fixed two-week copilot period.
- There is no confidence score or trust score gate.
- The user will prepare client-facing legal/permission documents separately.
- Do not add product copy saying "AI-supported tracking" to the client.
- Keep neutral legal/permission integration points only.
- Model routing:
  - green -> `gemini-1.5-flash`
  - yellow -> `gemini-3`
  - red -> no LLM call
- Personas affect communication style only, never clinical safety.
- The system must know which WhatsApp/Telegram messages were written by AI and which were written manually by the dietitian.

## Current Next Phase

P85-IF-A through P85-IF-I are complete and P85-IF is closed. Stage 4B Uyari ve Bildirimler and Stage 4B-2 Mesajlasma are complete (2026-07-12). **Next authorized implementation unit:** Stage 4C Diyetisyen Icin AI Chat, then Stage 4D, Stage 5, Stage 6, and Stage 7. Production pilot remains `NO-GO`; all external launch gates remain open; R-405 remains open; R-406 current local Supabase/RLS re-run remains pending (35 tests skipped on 2026-07-12).

## Previous Next Phase - Phase 82F - 2026-06-30

Phase 82F continuity and final dossier closure completed on 2026-06-30.

Phase 81F verification refresh and Phase 81G hardening completed on 2026-06-30. Phase 81 direct production pilot GO evaluation is closed across 81A-81H as a fail-closed framework. Baseline final outcome is `NO_GO_NOT_ELIGIBLE`; `productionPilotGoReady` is `false`; `productionPilotStarted` is `false`. Verification passed with targeted Phase 81 tests (6 files, 46/46), `git diff --check`, lint with two pre-existing warnings, production build, `npm run test:rls` skipped 20/20, `npm run release:verify` core 225/225 and app 564 passed / 4 skipped across 89 files, and `npm run rehearse:production-scale:79g`. Phase 81F records the current refresh as `blocked` because current local RLS evidence is skipped/pending; Phase 81G consumes that refresh evidence and derives eligibility from the Phase 80 final report. All eight launch gates remain open; R-405 remains open; R-406 current re-run remains pending. Production pilot remains `NO-GO`.

Phase 80E current RLS evidence re-run completed on 2026-06-30.

Phase 80D R-405 closure evaluation completed on 2026-06-30.

Phase 80C gate-by-gate evidence evaluation completed on 2026-06-30.

Phase 80B external artifact intake completed on 2026-06-30.

Phase 80A scope lock completed on 2026-06-30.

Phase 79 production-scale hardening, full 100x50 rehearsal closure, and Phase 79I remediation were applied on 2026-06-29. Phase 79A-79I now includes a real `/api/app-state?view=windowed` dashboard runtime while preserving legacy `/api/app-state`, fail-closed notification windows, scoped client create/patch responses without post-mutation broad reloads, bounded internal copilot loaders, lifecycle redaction evidence, current RLS evidence with pending current re-run when local Supabase is unavailable, unified 100x50 rehearsal, and continuity/risk/gate documentation closure. Phase 79I targeted verification passed with 7 files, 65 tests passed, 2 skipped; `npm run lint` passed with two pre-existing warnings; `npm run build` passed; full `npm test` passed with 79 files, 489 tests passed, 4 skipped. `npm run rehearse:production-scale:79g` passed: expanded AI quality 5,000 cases passed with hard-zero counters at 0; full mock channel replay passed; Phase 79 full acceptance tests passed; `npm run release:verify` passed with core tests 225/225, app tests 489 passed and 4 skipped across 79 files, production build, and only documented R-405 findings. Production pilot remains `NO-GO`, all launch gates remain open, R-405 remains open, and R-406 is Phase 50/52 baseline mitigated with the current post-76N/77AA-77AI/79 re-run pending until local Supabase is available. Phase 80 external launch-gate closure and R-405 evidence hardening were completed next; current next implementation phase is Phase 81 only when eligible.

Phase 77AA-77AI remediation was applied on 2026-06-28. It closed the review findings for Supabase rollback persistence, invalid WhatsApp timestamp parsing, 77AE mock delivery typing, 77AG full replay isolation, and Supabase channel-delivery DSAR cleanup. Targeted Phase 77 tests, `supabase-store` unit tests, lint, diff check, and `npm run rehearse:channel:replay` passed; repo-wide `npm test` still exceeded the local review timeout and `tsc --noEmit` remains blocked by pre-existing non-Phase-77 test type errors. Production pilot remains `NO-GO`.

Post-Phase 69 baseline: the direct 100-dietitian strategic completion plan in `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md` remains canonical. It locks the production pilot target to direct 100 dietitians x 50 clients (minimum 5,000 clients), with no small production ring. It also locks the product communication covenant: client-facing output must never disclose AI identity or tell the client to ask a doctor/dietitian/professional, yellow/red paths send no client-facing AI boundary reply, and green maximization must come from approved source-backed answerability plus deterministic green intent taxonomy rather than answering risky messages.

Next implementation work is external launch-gate/R-405/RLS closure prerequisites before any further production GO action. Phase 81 direct production pilot GO evaluation is complete locally as a fail-closed framework. Phase 80 external launch-gate closure (80A-80F) and Phase 80G R-405 closure-evidence hardening are complete locally. Phase 79 added `docs/PHASE_79_PRODUCTION_SCALE_HARDENING_AND_FULL_100X50_REHEARSAL_SPEC.md`, runtime read/mutation/copilot/lifecycle/RLS/rehearsal evidence modules, Phase 79I remediation for the four post-review gaps, and `npm run rehearse:production-scale:79g`; it kept production pilot `NO-GO`, R-405 open, and real providers/channels disconnected. Phase 78 added `docs/PHASE_78_DEPENDENCY_R405_CLOSURE_SPEC.md` and kept R-405 open because stable Next still does not bundle patched PostCSS. Phase 77AI added `phase-77ai-production-operations-preparation.ts`, bound incident/SLA/monitoring/rollback/DSAR/backup/secret placeholders to structured evidence candidates, wired internal mock health controls, and kept ops launch gates open with an explicit missing-evidence list. Phase 77AH closed the 77AA–77AG WhatsApp mock/gated adapter track via `phase-77ah-whatsapp-adapter-evidence-closure.ts`, synchronized continuity/pilot/gate docs, and recorded hard-zero channel replay sample evidence with production pilot `NO-GO`, channel gate open, and R-405 open. Phase 77M-77Y is complete locally, Phase 77B manual source authority boundary through Phase 77K calibration/rehearsal/evidence closure are complete locally, and Phase 77L reconciled the worktree/continuity baseline. The external risk model remains only green/yellow/red. Internal states such as `unknown_intent`, `needs_label`, `needs_review`, `clarify`, and `handoff` are workflow states, not new client-visible warning classes. Real Gemini egress must not be enabled without Phase 75 approved provider artifacts plus `MANU_ALLOW_REAL_GEMINI=true` and closed legal/privacy plus provider/vendor gates. Production data lifecycle must not be enabled without Phase 74/79 lifecycle evidence plus external legal/privacy approval.

Phase 77A manual source authority rebaseline completed on 2026-06-10: added `docs/PHASE_77A_MANUAL_SOURCE_AUTHORITY_REBASELINE_SPEC.md`, repositioned WhatsApp adapter after the Phase 77A-77K rebaseline track, locked v1 out-of-catalog food inference to deterministic catalog/alias/keyword matching only, required Phase 68 taxonomy recalibration for safe `discourage` decisions, defined Food Decision V2 send semantics, established active menu as the primary plan authority with `client.dietPlan.summary` as a derived legacy summary, and recorded the Phase 76D-76O artifact disposition. Verification passed with `npm run release:verify`: core tests 165/165, app tests 284/284, lint with two pre-existing warnings, production build, and only documented R-405 findings. No runtime behavior, schema, provider, channel, launch-gate approval, real-data handling, or R-405 status changed. Production pilot remains `NO-GO`.

Phase 77K calibration, 100x50 rehearsal, and evidence closure completed on 2026-06-10: added `docs/PHASE_77K_CALIBRATION_REHEARSAL_EVIDENCE_CLOSURE_SPEC.md`, `food-decision-v2-golden-cases.jsonl` (14 V2 golden categories), `phase-77k-food-decision-v2-golden.ts`, `phase-77k-food-mix-rehearsal.ts` (deterministic 100 dietitian x 50 client V2 rehearsal with Phase 76O integration checks), `phase-77k-calibration-evidence.ts`, operational-health V2 calibration/rehearsal fields (`foodDecisionV2CalibrationStatus`, `foodMixRehearsalV2Status`, `manualSourceAuthorityTrackClosed`, `whatsappAdapterNext`), and Food Decision Engine V2 source-manifest references for mixed/clinical early-exit paths. Golden suite passes with zero inappropriate approvals; full scale rehearsal reports `unsafe_green_count = 0`. Verification passed with `npm run release:verify`: core tests 173/173, app tests 337/337, lint with two pre-existing warnings, production build, and only documented R-405 findings. No provider, channel, gate approval, real-data handling, or R-405 status changed. Production pilot remains `NO-GO`.

Phase 77J DOCX/PDF export and data lifecycle v1.2 completed on 2026-06-10: added `docs/PHASE_77J_DOCX_PDF_EXPORT_AND_DATA_LIFECYCLE_V1_2_SPEC.md`, `phase-77j-menu-plan-export.ts` client-facing document builder, `phase-77j-menu-plan-export-binary.ts` server-only DOCX/PDF generation (`docx`, `pdfmake` 0.3 with Roboto vfs), `phase-77j-data-lifecycle.ts`, `GET /api/clients/[id]/menu-plans/export?format=docx|pdf`, Phase 74 export bump to `phase74-export-v1.2` with `personal_form_v2.json` and `catalog_version_refs.json`, deprecated proposal export sections, Export tab preview/download UI with include-recipes toggle, and Turkish text verification tests. Production audit still reports only documented R-405 findings after adding export dependencies. Verification passed with `npm run release:verify`: core tests 173/173, app tests 325/325, lint with two pre-existing warnings, production build, and only documented R-405 findings. No provider, channel, gate approval, real-data handling, or R-405 status changed. Production pilot remains `NO-GO`.

Phase 77H PromptContext/answerability/output guard V2 completed on 2026-06-10: added `docs/PHASE_77H_PROMPTCONTEXT_ANSWERABILITY_OUTPUT_GUARD_V2_SPEC.md`, core `food-decision-v2-prompt-segments.js`, V2 PromptContext segments (`food_decision_v2`, `food_profile_summary`, `menu_authority`, `flexibility_modifier`, `ingredient_evidence_v2`, `food_source_manifest`), intent-specific answerability `v0.2.0` with profile/menu/catalog source categories, output guard V2 contradiction blocks, orchestrator wiring for compile/answerability/guard, Phase 72 permission-graph V2 intent mapping, Phase 75/mock provider allowlist updates, and simulator-risk V2 routing metadata. Verification passed with `npm run release:verify`: core tests 173/173, app tests 315/315, lint with two pre-existing warnings, production build, and only documented R-405 findings. No provider, channel, gate approval, real-data handling, or R-405 status changed. Production pilot remains `NO-GO`.

Phase 77G Food Decision Engine V2 completed on 2026-06-10: added `docs/PHASE_77G_FOOD_DECISION_ENGINE_V2_SPEC.md`, `phase-77g-food-decision-engine-v2.ts` with `allow`/`discourage`/`forbid`/`needs_label`/`needs_review`/`not_applicable` decisions, catalog/profile/menu/flexibility precedence, Phase 76H product-ingredient verification reuse, legacy Phase 76E fallback via `shouldUseFoodDecisionV2Result`, `food-rule-runtime.ts` V2 preference, simulator/orchestrator `foodDecisionV2` manifest wiring, and Phase 68 green-intent recalibration (`yellow_active_plan_structural_change` replaces broad off-menu food blocking). Verification passed with `npm run release:verify`: core tests 167/167, app tests 310/310, lint with two pre-existing warnings, production build, and only documented R-405 findings. No provider, channel, gate approval, real-data handling, or R-405 status changed. Production pilot remains `NO-GO`.

Phase 77F menu plan v1 completed on 2026-06-10: added `docs/PHASE_77F_MENU_PLAN_V1_SPEC.md`, `phase-77f-client-menu-plan.ts`, `ClientMenuPlanV1Record` state with four templates (`day_by_day_detailed`, `weekly_meal_framework`, `exchange_option_based`, `simple_guidance`), lazy migration from legacy `client.dietPlan`, active-menu selection with derived `dietPlan.summary` bridge, food-profile conflict detection, `GET`/`POST` `/api/clients/[id]/menu-plans`, `PUT`/`POST .../activate`, Supabase `client_menu_plans` migration with tenant RLS, `MenuPlanPanel` dashboard UI, `assertDietPlanSummaryPatchAllowed` lock when active menu exists, Phase 74 export `menu_plans_v1.json`, and transactional redaction coverage. Verification passed with `npm run release:verify`: core tests 165/165, app tests 302/302, lint with two pre-existing warnings, production build, and only documented R-405 findings. No provider, channel, gate approval, real-data handling, or R-405 status changed. Production pilot remains `NO-GO`.

Phase 77E client food-rule profile v2 completed on 2026-06-10: added `docs/PHASE_77E_CLIENT_FOOD_RULE_PROFILE_V2_SPEC.md`, `phase-77e-client-food-rule-profile.ts`, first-class `ClientFoodRuleProfileV2Record` state, lazy migration from Phase 76D/77D form answers, `GET`/`PUT` `/api/clients/[id]/food-rule-profile`, Supabase `client_food_rule_profiles` migration with tenant RLS, simplified `FoodRulesPanel` with catalog search, allowed/forbidden foods and groups, flexibility maps, conflict warnings, legacy 76J bridge into form answers for `food-rule-runtime`, Phase 74 export `food_rule_profile_v2.json`, and transactional redaction coverage. Verification passed with `npm run release:verify`: core tests 165/165, app tests 296/296, lint with two pre-existing warnings, production build, and only documented R-405 findings. No provider, channel, gate approval, real-data handling, or R-405 status changed. Production pilot remains `NO-GO`.

Phase 77L continuity reconciliation and worktree closure completed on 2026-06-13: added `docs/PHASE_77L_CONTINUITY_RECONCILIATION_AND_WORKTREE_CLOSURE_SPEC.md`, updated stale continuity/evidence docs to treat Phase 77A-77K as locally complete, restored the historical Phase 76E spec in the evidence trail, treated `agent.md` -> `codex.md` as the project-rule filename migration, made app tests deterministic without reducing the 53-file/337-test scope, and made `release:verify` clean generated `.next` output before production build for repeatable Windows/OneDrive runs. Verification passed with `git diff --check`, `app` `npm test` (337/337), and `npm run release:verify` (core 173/173, app 337/337, lint with two pre-existing warnings, production build, and only documented R-405 findings). This phase does not add runtime behavior beyond the already-present Phase 77E-77K local changes, does not connect real providers/channels, does not close launch gates, does not process real data, and does not resolve R-405. Production pilot remains `NO-GO`.

Phase 77M master rebaseline and spec completed on 2026-06-13: added `docs/PHASE_77M_MASTER_REBASELINE_AND_SPEC.md`, finalized `docs/PHASE_77M_77Y_AI_QUALITY_MASTER_PLAN.md`, recorded superseded alternate Phase 78A-M numbering, locked core-owned `responsePlan`, deterministic templates, `claimManifest` generated from plan/template/sourceRefs rather than LLM output, fail-closed unknown-intent handling for later runtime phases, and `normalize-safety-text.js` as the single normalization source to extend. Verification passed with `git diff --check`, `app` `npm test` (337/337), and `npm run release:verify` (core 173/173, app 337/337, lint with two pre-existing warnings, production build, and only documented R-405 findings). This phase does not add runtime behavior, connect real providers/channels, close launch gates, process real data, or resolve R-405. Production pilot remains `NO-GO`. Next implementation phase was Phase 77N Canonical Intent Understanding V2.

Phase 77O response plan contract v1 completed on 2026-06-13: added `docs/PHASE_77O_RESPONSE_PLAN_CONTRACT_V1_SPEC.md`, core `response-plan-v1.js` (`response-plan-v1-v0.1.0`), `response-plan-prompt-segments.js`, orchestrator `contextManifest.responsePlan` after answerability with provider gating, mock-provider `response_plan`/`claim_manifest`/`style_dna` allowlist enforcement, and simulator fail-closed when provider-eligible `responsePlan` is missing. Verification passed with core response-plan/orchestrator tests, app Phase 77O tests, and `npm run release:verify` (only documented R-405 findings). No real provider/channel connections, launch-gate approval, real-data handling, or R-405 status changed. Production pilot remains `NO-GO`. Next implementation phase was Phase 77P Deterministic Template Library V1.

Phase 77P deterministic template library v1 completed on 2026-06-13: added `docs/PHASE_77P_DETERMINISTIC_TEMPLATE_LIBRARY_V1_SPEC.md`, core `deterministic-template-library-v1.js` (`deterministic-template-library-v1-v0.1.0`), JSONL golden cases, template-backed mock-provider rendering from `responsePlan.templateId`, `needs_label` precedence before answerability handoff in `response-plan-v1.js`, and orchestrator `contextManifest.deterministicClientMessage` for non-provider-eligible plans. Verification passed with `git diff --check`, core deterministic-template/response-plan tests, app Phase 77P tests, and `npm run release:verify` (core 189/189, app 350/350, only documented R-405 findings). No real provider/channel connections, launch-gate approval, real-data handling, or R-405 status changed. Production pilot remains `NO-GO`. Next implementation phase was Phase 77Q Claim Manifest and Output Grounding V1.

Phase 77Q claim manifest and output grounding v1 completed on 2026-06-13: added `docs/PHASE_77Q_CLAIM_MANIFEST_AND_OUTPUT_GROUNDING_V1_SPEC.md`, core `claim-manifest-v1.js` (`claim-manifest-v1-v0.1.0`), replaced Phase 77O placeholder manifests in `buildResponsePlanV1`, orchestrator fail-closed on incomplete provider manifests, `guardProviderOutput` manifest grounding with `claim_outside_manifest` blocking, JSONL golden cases, and core/app Phase 77Q tests. Verification passed with `git diff --check`, `app` `npm test` (354/354), and `npm run release:verify` (core 193/193, only documented R-405 findings). No real provider/channel connections, launch-gate approval, real-data handling, or R-405 status changed. Production pilot remains `NO-GO`. Next implementation phase was Phase 77R Food Understanding V3.

Phase 77R food understanding v3 completed on 2026-06-13: added `docs/PHASE_77R_FOOD_UNDERSTANDING_V3_SPEC.md`, core `food-understanding-v3.js` (`food-understanding-v3-v0.1.0`), checksum-backed alias dictionary (`food-alias-dictionary-v3.json` / JSONL mirror), tenant-safe alias resolution with QA-gated global autopilot eligibility, brand/packaged `needs_label` routing without ingredient inference, recipe-gated mixed-dish handling, Food Decision Engine V2 wiring in `phase-77g-food-decision-engine-v2.ts`, JSONL golden cases, and core/app Phase 77R tests. Verification passed with `git diff --check`, `app` `npm test` (361/361), and `npm run release:verify` (core 196/196, only documented R-405 findings). No real provider/channel connections, launch-gate approval, real-data handling, or R-405 status changed. Production pilot remains `NO-GO`. Next implementation phase was Phase 77S Dietitian Voice Engine V2.

Phase 77U clinical red-team and RD review packet completed on 2026-06-13: added `docs/PHASE_77U_CLINICAL_RED_TEAM_AND_RD_REVIEW_PACKET_SPEC.md`, `docs/PRODUCTION_PILOT_RD_AI_QUALITY_REVIEW_PACKET.md`, core `clinical-red-team-v1.js` (`clinical-red-team-v1-v0.1.0`), JSONL RD/red-team cases, zero unsafe/yellow-red client-send assertions, and core/app Phase 77U tests. Verification passed with `git diff --check`, `app` `npm test`, `npm run release:verify`, and core clinical red-team tests. No real provider/channel connections, launch-gate approval, real-data handling, or R-405 status changed. Production pilot remains `NO-GO`. Next implementation phase was Phase 77V Copilot Quality Workflow V1.

Phase 77V copilot quality workflow v1 completed on 2026-06-13: added `docs/PHASE_77V_COPILOT_QUALITY_WORKFLOW_V1_SPEC.md`, core `copilot-quality-workflow-v1.js` (`copilot-quality-workflow-v1-v0.1.0`), client-export metadata sanitization, internal-only `CopilotQualityReviewPanel`, style-edit clinical-decision isolation assertions, and core/app Phase 77V tests. Verification passed with `git diff --check`, `app` `npm test` (376/376), `npm run release:verify` (core 216/216), and client-export leak tests. No real provider/channel connections, launch-gate approval, real-data handling, or R-405 status changed. Production pilot remains `NO-GO`. Next implementation phase was Phase 77W Narrow Autopilot Eligibility V2.

Phase 77W narrow autopilot eligibility v2 completed on 2026-06-14: added `docs/PHASE_77W_NARROW_AUTOPILOT_ELIGIBILITY_V2_SPEC.md`, core `narrow-autopilot-eligibility-v2.js` (`narrow-autopilot-eligibility-v2-v0.1.0`), orchestrator pre/post-provider autopilot downgrade gates, `contextManifest.narrowAutopilotEligibility`, JSONL golden cases, and core/app Phase 77W tests. Verification passed with `git diff --check`, `app` `npm test` (380/380), `npm run release:verify` (core 224/224), and zero unsafe client sends preserved in clinical red-team closure. No real provider/channel connections, launch-gate approval, real-data handling, or R-405 status changed. Production pilot remains `NO-GO`. Next implementation phase was Phase 77X Expanded 100x50 AI Rehearsal And Risk Register.

Phase 77X expanded 100x50 AI rehearsal and risk register completed on 2026-06-14: added `docs/PHASE_77X_EXPANDED_AI_REHEARSAL_AND_RISK_REGISTER_SPEC.md`, core `ai-quality-expanded-rehearsal-v1.js`, app `phase-77x-expanded-ai-rehearsal.ts`, operational-health AI quality fields, `rehearse:ai:expanded`, and risk-register updates. Verification passed with core tests 225/225, app tests 383/383, and expanded rehearsal sample hard-zero counters at zero with `style_soft_mismatch_rate` under threshold. No real provider/channel connections, launch-gate approval, real-data handling, or R-405 status changed. Production pilot remains `NO-GO`. Next implementation phase was Phase 77Y Continuity, Evidence, And Launch Gate Update.

Phase 77Y continuity, evidence, and launch gate update completed on 2026-06-14: added `docs/PHASE_77Y_CONTINUITY_EVIDENCE_AND_LAUNCH_GATE_UPDATE_SPEC.md`, `phase-77y-ai-quality-program-closure.ts`, synchronized continuity/pilot/gate/risk docs, and recorded Phase 77M-77Y AI Quality Program closure with hard-zero and measured-threshold evidence. No real provider/channel connections, launch-gate approval, real-data handling, or R-405 status changed. Production pilot remains `NO-GO`. Phase 77AA WhatsApp mock/gated adapter PRD and scope lock completed on 2026-06-22: added `docs/PHASE_77AA_WHATSAPP_MOCK_GATED_ADAPTER_PRD_AND_SCOPE_LOCK_SPEC.md` and locked the 77AB–77AH mock/gated adapter track. Phase 77AB WhatsApp Cloud payload normalization completed on 2026-06-22: added `docs/PHASE_77AB_WHATSAPP_CLOUD_PAYLOAD_NORMALIZATION_SPEC.md`, `whatsapp-cloud-payload-normalizer.ts`, golden cases, and parser tests. Phase 77AC disabled webhook boundary and identity quarantine completed on 2026-06-22: added `docs/PHASE_77AC_DISABLED_WEBHOOK_BOUNDARY_AND_IDENTITY_QUARANTINE_SPEC.md`, `POST /api/whatsapp/webhook`, and mock identity/group quarantine wiring. Phase 77AE outbound delivery ledger and mock send failures completed on 2026-06-22: added `docs/PHASE_77AE_OUTBOUND_DELIVERY_LEDGER_AND_MOCK_SEND_FAILURES_SPEC.md`, `channel-mock-delivery-ledger.ts`, `channel_deliveries` migration/RLS, and Phase 74 export bump to `phase74-export-v1.3`. Phase 77AF adapter operational health and rollback controls completed on 2026-06-22: added `docs/PHASE_77AF_ADAPTER_OPERATIONAL_HEALTH_AND_ROLLBACK_CONTROLS_SPEC.md`, `channel-adapter-health.ts`, and `channel-adapter-rollback.ts`. Next implementation phase is Phase 77AG 100x50 WhatsApp-like channel replay rehearsal (mock/gated only).

Phase 77B manual source authority boundary completed on 2026-06-10: added `docs/PHASE_77B_MANUAL_SOURCE_BOUNDARY_SPEC.md`, `phase-77b-chat-mutation-boundary.ts`, blocked chat proposal create/apply with `chat_source_mutation_disabled`, removed dashboard Propose update/apply controls, kept historical proposals read-only with deprecated copy and reject/dismiss for pending legacy rows, preserved read-only internal copilot, and kept Critical Context panel-only. Phase 76O integration checks now verify chat mutation is blocked and manual food-rule dashboard save still works. Verification passed with `npm run release:verify`: core tests 165/165, app tests 289/289, lint with two pre-existing warnings, production build, and only documented R-405 findings. No provider, channel, gate approval, real-data handling, or R-405 status changed. Production pilot remains `NO-GO`.

Phase 77C client personal form v2 completed on 2026-06-10: added `docs/PHASE_77C_CLIENT_PERSONAL_FORM_V2_SPEC.md`, updated the active client form schema to `Phase 77C client personal form v2` with registry version `phase-77c-client-personal-form-v2`, loaded the user-supplied personal form fields plus phone/WhatsApp identity, goal/target/flexibility, lifestyle, medical, women's health, nutrition-history, allergy/intolerance, digestive, and notes fields, and kept food-group/meal flexibility out of this form for later food-rule/menu forms. Phase 76D structured food-rule fields are no longer embedded in the active personal form schema, but legacy demo answers remain for temporary Phase 76 runtime compatibility. No provider, channel, gate approval, real-data handling, catalog/menu/export implementation, or R-405 status changed. Production pilot remains `NO-GO`.

Phase 77D master food catalog hierarchy completed on 2026-06-10: added `docs/PHASE_77D_MASTER_FOOD_CATALOG_SPEC.md`, extracted the user-supplied `manual.xlsx` / `Besin Veritabani` sheet into `phase-77d-master-food-catalog-data.json`, and added stable-id helpers, QA validation, exact name lookup, and dashboard checkbox controls for forbidden main categories, subcategories, and foods. The catalog records 12 main categories, 113 subcategories, 518 foods, 0 duplicate triples, 18 duplicate food names, workbook SHA-256 `db3af129bc9e814dbb5247e5a2fbcd49a0184fb0b6bc046b75de99f78a266c21`, and record-set SHA-256 `6b9e53577dfcba8f9af2839f0bb3017163f756b5880582ac2e18f6d274042e9f`. Dashboard saves expand checked catalog ids into existing forbidden food/group answers for Phase 76 compatibility while preserving the raw catalog ids as provenance. This does not implement Food Decision Engine V2, alias/ingredient matching, production approval, provider/channel integration, real-data handling, or R-405 closure. Production pilot remains `NO-GO`.

Phase 76Q verification and commit protocol completed on 2026-06-08: added `docs/PHASE_76Q_VERIFICATION_AND_COMMIT_PROTOCOL_SPEC.md` and formally closed the 76C–76P track with core tests 165/165, app tests 284/284, app lint, production build, and `npm run release:verify` (only documented R-405 findings). Track commits: 76O `19e26e3`, 76P `8e8bb47`, 76Q this closure. `npm run test:rls` skipped (20/20 guarded) because local Supabase was unavailable; Phase 76N RLS re-run remains pending. No runtime behavior, schema, provider, channel, launch-gate approval, or real-data handling changed. Production pilot remains `NO-GO`.

Phase 76P continuity, evidence, and gate updates completed on 2026-06-08: added `docs/PHASE_76P_CONTINUITY_EVIDENCE_GATE_UPDATE_SPEC.md` consolidating Phases 76C–76O local prototype evidence into continuity, pilot readiness, gate dossier, final readiness summary, clinical taxonomy review packet, and risk-register narratives for R-109, R-117, R-310, R-403, R-409, R-412, R-413, and R-414. Preserved local prototype mitigated vs production approved distinction; all eight launch gates remain open; R-405 remains open. No runtime behavior, schema, provider, channel, launch-gate approval, or real-data handling changed. Verification passed with core tests 165/165, app tests 284/284, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76O 100x50 synthetic food-mix rehearsal completed on 2026-06-08: added `docs/PHASE_76O_100X50_SYNTHETIC_FOOD_MIX_REHEARSAL_SPEC.md`, `food-mix-rehearsal-scenarios.jsonl`, `phase-76o-food-mix-rehearsal.ts` scale rehearsal across 100 dietitians x 50 clients with twelve food-mix scenarios, integration checks for duplicate inbound, provider failure, stale draft invalidation, and proposal apply during active conversation, `direct-pilot-scale-readiness` food-mix evidence fields, and operational-health aggregate food-mix metrics without raw message leakage. Rehearsal metrics record `unsafe_green_count = 0`, food-rule green/handoff counts, and removed-client blocks across 5,000 synthetic assignments. No production channel, launch-gate approval, R-405 status, or real-data handling changed. Verification passed with core tests 165/165, app tests 284/284, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76N Supabase, RLS, export, redaction, and transactional coverage completed on 2026-06-08: added `docs/PHASE_76N_SUPABASE_RLS_EXPORT_REDACTION_TRANSACTIONAL_COVERAGE_SPEC.md`, `phase-76n-food-rule-lifecycle.ts` export/redaction helpers, Phase 74 export bump to `phase74-export-v1.1` with `structured_food_rules.json` and `client_update_proposals.json`, per-field food-rule form answer redaction, removed-client `buildStructuredFoodRulesFromClientState` null guard, Supabase `manu_commit_state_delta` migration for proposal upserts and redaction-related updates, `commit_client_update_proposal` RPC for create/apply flows, `commit_client_removal_lifecycle` for bulk removal redaction deltas, and `client_update_proposal_mutation` read contract. RLS re-run for the Phase 76N migration remains pending when local Supabase is unavailable. No production lifecycle enablement, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification passed with core tests 165/165, app tests 276/276, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76M Phase 73 calibration and metrics expansion completed on 2026-06-08: added `docs/PHASE_76M_CALIBRATION_METRICS_EXPANSION_SPEC.md`, extended `phase-73-health-regulation-calibration.ts` to `v1.1.0` with ten food-rule decision areas and twelve golden categories (`P73-016`–`P73-027`), `evaluatePhase73GreenCapacityMetrics`, `phase-76m-calibration-metrics.ts` evidence-pack and operational-health aggregates, core `food-rule-calibration-golden-cases.jsonl` with orchestrator tests, and three additional `clinical-golden-cases.jsonl` pregnancy/minor/acute-food rows. Metrics include `green_coverage_rate`, `source_backed_green_rate`, `food_rule_green_rate`, `false_yellow_rate`, `unsafe_green_rate`, `mixed_intent_block_count`, `ingredient_unknown_review_count`, `provider_attempted_false_count`, and `covenant_block_count` with `unsafe_green_rate = 0` on the bundled suite. No production calibration activation, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification passed with core tests 165/165, app tests 272/272, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76L Phase 72 permission graph runtime bridge completed on 2026-06-08: added `docs/PHASE_76L_PERMISSION_GRAPH_RUNTIME_BRIDGE_SPEC.md`, extended `phase-72-permission-graph.ts` with food-rule routing maps and structured field allowlists (`v1.1.0`), `phase-76l-permission-graph-runtime.ts` shadow/enforce bridge on simulator risk classification, `permissionGraphEvaluations` audit records, and `contextManifest.permissionGraph` decision metadata. Default mode is shadow/audit-only; enforcement requires `MANU_ALLOW_PHASE_72_ACTIVE_ROUTING=true` plus approved launch-gate evidence. No core orchestrator hot-path wiring, production routing activation, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification passed with core tests 153/153, app tests 266/266, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76K chat-to-food-rule proposal expansion completed on 2026-06-08: added `docs/PHASE_76K_CHAT_FOOD_RULE_PROPOSAL_SPEC.md`, `phase-76k-food-rule-proposal-patches.ts` deterministic extraction for forbidden/allowed foods and groups, equivalent exchange groups, optional meals, skip tolerance, diet type, and ingredient keywords; `food_rule` proposal patch category and dashboard grouping; apply-path support for multiselect and exchange-group merges with `syncClientRecordFromFoodRuleAnswers`; clinical/production safety flags on food-rule proposals; and expanded proposal tests. Internal copilot remains read-only; no new API endpoints, real Gemini egress, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification passed with core tests 153/153, app tests 262/262, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76J dashboard food-rule management UX completed on 2026-06-08: added `docs/PHASE_76J_DASHBOARD_FOOD_RULE_MANAGEMENT_SPEC.md`, `app/src/lib/phase-76j-food-rule-dashboard.ts` load/merge/save helpers on the existing form-save path, `FoodRulesPanel` structured dashboard controls for forbidden/allowed foods and groups, diet type, exchange groups, mandatory/optional meals, skip tolerance, portion boundaries, ingredient keywords, and product-label policies, context revision increment and draft invalidation via `saveClientFormResponseInState`, `client_food_rules_updated` audit metadata, clinical/production warnings, app unit tests, and dashboard visual smoke coverage. No new API endpoints, chat proposals, real Gemini egress, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification passed with core tests 153/153, app tests 254/254, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76I PromptContext and provider output guard hardening completed on 2026-06-08: added `docs/PHASE_76I_PROMPTCONTEXT_PROVIDER_OUTPUT_GUARD_SPEC.md`, core `food-rule-prompt-segments.js`, bounded PromptContext segments (`food_rule_decision`, `allowed_food_rules`, `forbidden_food_rules`, `equivalent_exchange_rules`, `diet_type_rules`, `ingredient_verification`), food-rule provider instruction wiring in `context-compiler.js`, `food-rule-output-guard-v0.1.0` violations in `response-quality-guard.js`, orchestrator compile/guard wiring, and Phase 75/app provider segment allowlist updates. No dashboard UX, chat proposals, real Gemini egress, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification passed with core tests 153/153, app tests 250/250, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76H product ingredient verification completed on 2026-06-08: added `docs/PHASE_76H_PRODUCT_INGREDIENT_VERIFICATION_SPEC.md`, core `product-ingredient-verification.js`, app `product-ingredient-verification.ts` with user-label extraction, food-rule engine verification consumption, simulator/runtime auto-evidence wiring, and tests for forbidden keyword block, uncertain label review, unknown source review, and diet-type conflict on product labels. No open web browsing, barcode/catalog providers, PromptContext segments, provider routing changes, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification passed with core tests 146/146, app tests 247/247, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76G clinical second-layer false-yellow calibration completed on 2026-06-08: added `docs/PHASE_76G_CLINICAL_SECOND_LAYER_FALSE_YELLOW_CALIBRATION_SPEC.md`, bumped second-layer version to `clinical-safety-second-layer-v0.2.0`, source-backed food-rule carve-out contract in `clinical-safety-second-layer.js`, food-rule-aware simulator risk classification, orchestrator fallback risk path wiring, expanded `clinical-second-layer-cases.jsonl`, and app runtime tests. Carve-outs suppress only `second_layer_client_allergy_or_restriction_mentioned` when food-rule decisions are explicit and prospective; ingestion reactions, acute clinical markers, and severe allergy profiles remain yellow. External qualified dietitian approval is still required before production activation. No product catalog adapters, PromptContext segments, provider routing changes, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification passed with core tests 140/140, app tests 242/242, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76F intent-specific answerability completed on 2026-06-08: added `docs/PHASE_76F_INTENT_SPECIFIC_ANSWERABILITY_SPEC.md`, core `intent-specific-answerability.js`, orchestrator reorder (green intent taxonomy → food rule engine → intent-specific answerability replacing coarse Phase 67 gate), structured food-rule source categories, substitution legacy plan/manual fallback when the engine returns `unknown_food_requires_review`, and yellow/red bypass so clinical second-layer routing is not answerability-gated. `contextManifest.answerability` now records intent family, food-rule alignment, and matched source categories. No clinical second-layer carve-outs, product catalog adapters, provider routing changes, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification passed with core tests 139/139, app tests 240/240, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76E food rule engine completed on 2026-06-08: added `docs/PHASE_76E_FOOD_RULE_ENGINE_SPEC.md`, core `dietitian-ai-assistant/src/food-rule-engine.js`, app `food-rule-runtime.ts`, orchestrator audit-only `contextManifest.foodRule` attachment, and simulator structured-food-rule input wiring. The engine deterministically evaluates forbidden/allowed food, equivalent substitution, diet-type compatibility, optional/mandatory skip, product-ingredient conflict, mixed-intent block, and uncertainty fail-closed decisions from Phase 76D structured rules. No intent-specific answerability gating, clinical second-layer carve-outs, product catalog adapters, provider routing changes, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification passed with core tests 132/132, app tests 238/238, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76D structured food rule data model and form upgrade completed on 2026-06-08: added `docs/PHASE_76D_STRUCTURED_FOOD_RULE_DATA_MODEL_SPEC.md`, `app/src/lib/phase-76d-food-rule-fields.ts`, and `app/src/lib/phase-76d-food-rule-model.ts`; extended the Phase 70 client form registry with 13 structured food-rule fields (forbidden/allowed items and groups, diet-type rules, equivalent exchange groups, mandatory/optional foods, skip tolerance, portion boundaries, ingredient keywords, product-label review policy, and uncertainty policy); bumped registry version to `phase-76d-food-rule-registry-v1`; extended autopilot qualification with structured food-rule completeness checks; synced allergies/restricted foods on form save; and seeded demo structured food rules. No orchestrator food-rule engine, intent-specific answerability, product-ingredient verification, provider, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification passed with core tests 122/122, app tests 234/234, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76C structured food rule green capacity spec completed on 2026-06-08: added `docs/PHASE_76C_STRUCTURED_FOOD_RULE_GREEN_CAPACITY_SPEC.md` as the canonical PRD/tech spec for expanding source-backed green food decisions through structured food rules, intent-specific answerability, a deterministic food-rule engine, clinical second-layer false-yellow calibration, trusted product-ingredient verification, PromptContext/output guard hardening, dashboard/proposal UX, gated Phase 72/73 runtime wiring, lifecycle coverage, and 100x50 food-mix rehearsal evidence. This phase changed documentation only; no runtime behavior, schema, provider, channel, launch-gate approval, R-405 status, or real-data handling changed. Verification re-ran with core tests 122/122, app tests 226/226, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76B expanded chat form safety updates is the previous completed implementation wave (2026-06-08): Phase 76A proposal cards now cover nutrition patches plus Phase 70 clinical/safety form fields such as pregnancy/breastfeeding, adult/minor, diagnosed condition, medication/insulin, lab-result availability, recent symptom, and eating-disorder risk. Supported fields mirror into `ClientRecord.healthProfile` where available, sensitive-detail form values remain non-prompt direct sources, and proposal rows can be edited before apply. AI active/passive, AI mode, channel permission, opt-out, red lock resolution, yellow hold resolution, and autopilot/reactivation stay manual dashboard/handoff flows. Verification passed with core tests 122/122, app tests 226/226, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 76A dietitian chat form update proposals completed on 2026-06-08: internal copilot remains read-only, but a dietitian can create a separate client-bound update proposal from chat text, review deterministic allowlisted additive patches, and explicitly apply or reject the proposal. Applying a proposal updates the active Phase 70 client form response, mirrors allowed client fields, creates a Critical Context record and audit events, increments context revision once, and invalidates pending drafts. Verification passed with core tests 122/122, app tests 222/222, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 75 Gemini provider gate completed on 2026-06-07: app `phase-75-gemini-provider-gate.ts` now holds forbidden/unpaid consumer surfaces, paid Vertex/Gemini Enterprise target surface, green/yellow model routing, training/logging/retention policy artifacts, health-data eligibility checklist, PromptContext allowlist enforcement, required gate evidence, `evaluatePhase75GeminiProviderRouting`, and `isPhase75RealGeminiEgressAllowed` behind `MANU_ALLOW_REAL_GEMINI`. Provider artifacts remain draft; real Gemini egress stays blocked without approved legal/privacy and provider/vendor gate evidence. Verification passed with core tests 122/122, app tests 216/216, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 74 data lifecycle, export, anonymization and DSAR policy completed (2026-06-07): app `phase-74-data-lifecycle-policy.ts` now holds retention policy, export manifest/checksum contract, DSAR SLA records, transactional redaction field contract, `applyPhase74TransactionalRedactionInState`, and redaction invariant evaluation. Redaction marker standardized to `REDACTED_BY_PHASE74_POLICY`; removed clients are excluded from simulator/provider paths. Policy artifacts remain draft; `MANU_ALLOW_PHASE_74_PRODUCTION_LIFECYCLE` stays off by default. Verification passed with core tests 122/122, app tests 209/209, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 73 health regulation calibration completed on 2026-06-07: app `phase-73-health-regulation-calibration.ts` now holds the user-supplied 14-source health regulation decision matrix, decision priority order, 15 golden calibration cases, copilot vs autopilot evaluation, and acceptance metrics. Calibration artifacts remain draft; active production calibration stays blocked without approved clinical taxonomy evidence. Verification passed with core tests 122/122, app tests 204/204, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 72 regulation permission graph completed on 2026-06-07: app `phase-72-permission-graph.ts` now holds the user-supplied legal/privacy, clinical interpretation, and permission graph pack as draft artifacts (`forbiddenActionMap`, `draftOnlyActionMap`, plan/general answerability maps, never-prompt and prompt-allowed field maps, covenant phrase map, legal privacy routing map, clinical escalation routing map, and mixed-intent fail-closed policy). `evaluatePhase72PermissionRouting` enforces fail-closed mixed intent and privacy-gate precedence; `isPhase72ActiveProductionRoutingAllowed` remains false without approved launch-gate evidence plus `MANU_ALLOW_PHASE_72_ACTIVE_ROUTING=true`. Verification passed with core tests 122/122, app tests 197/197, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 71 Turkiye official health source ingestion completed on 2026-06-07: app `phase-71-turkiye-official-sources.ts` holds the user-supplied 14-source Turkiye official source manifest with P0/P1/P2 priorities, critical sections, and green/yellow/red impact notes. It adds fail-closed artifact intake into the Phase 65 QA contract; metadata-only sources do not pass QA, unknown artifacts fail, and QA-passing derived rules remain draft-only until external approval. Production pilot remains `NO-GO`.

Phase 70 user-supplied form hardening completed on 2026-06-07: app `phase-70-form-registry.ts` now holds the user-supplied dietitian/client field registry with prompt-access, answerability-role, and privacy metadata; published local client/dietitian schemas and seed responses back demo autopilot qualification; `phase-70-form-hardening.ts` enforces minimum autopilot client field completeness and sanitized prompt summaries; simulator preflight blocks incomplete/not-qualified autopilot clients before provider calls. Production pilot remains `NO-GO`.

Phase 69 direct 5,000 client scale foundation completed on 2026-06-05: app `direct-pilot-scale-readiness.ts` now provides a synthetic 100 dietitian x 50 client fixture, cursor pagination helper, readiness evaluator, and scale target constants. Scale-critical read contracts are marked with `phase69_paginated_contract`, and operational health carries aggregate direct-pilot scale readiness fields. Production pilot remains `NO-GO`.

Phase 68 green maximization intent taxonomy is the latest completed implementation wave (2026-06-05): core `evaluateGreenIntentTaxonomy` now records green intent family metadata after approved-source answerability and before provider generation. Green-looking sensitive intents such as calorie/macro/portion target changes, medication/supplement decisions, lab/symptom interpretation, active-plan conflict, and emergency/sensitive contexts block with internal handoff/no-send and `providerAttempted=false`. Yellow/red decisions receive `not_applicable_non_green` taxonomy metadata and are not downgraded. Production pilot remains `NO-GO`.

Phase 67 approved source answerability engine is the previous completed implementation wave (2026-06-05): core `evaluateApprovedSourceAnswerability` now gates green provider calls/sends on approved source support after PromptContext compilation and before provider generation. Active diet plan, prompt-allowed form summaries, dietitian context updates, dietitian manual messages, pinned notes, allergies, and restricted foods can support answerability. AI-generated messages are excluded from source authority. Missing approved source support creates internal handoff/no-send with `providerAttempted=false`. Production pilot remains `NO-GO`.

Phase 66 product communication covenant lock completed on 2026-06-05: core/provider output safety blocks client-facing AI self-disclosure, AI limitation disclaimers, doctor/dietitian/professional referral language, and covenant-violating green provider output; PromptContext carries the covenant instruction; mock-provider output self-checks the covenant; handoff acknowledgements are internal-only; and send-time draft approval blocks non-green AI drafts plus covenant-violating green draft edits. Production pilot remains `NO-GO`.

Phase 65 official regulation PDF corpus QA foundation completed on 2026-06-04: `app/src/lib/official-regulation-corpus.ts` requires user-supplied official PDF corpus packages to include source metadata, SHA-256 checksums, page extraction evidence, page/section references, derived rule drafts, corpus version, and synthetic golden cases before PDF-derived scope rules can become draft `ScopeRuleRecord` entries with source references. QA failure blocks draft rule construction and keeps launch-gate evidence draft. QA success does not approve the corpus or activate production routing. Production pilot remains `NO-GO`.

Phase 64 structured launch-gate evidence engine completed on 2026-06-04: `LaunchGateEvidenceRecord` and `evaluateProductionPilotLaunchGateEvidence` now require sanitized artifact references, owner, explicit approval, approval date, review cadence, non-expired timing, and full required-evidence coverage before a gate can be treated as closed. Legal/privacy and clinical gate definitions include Phase 63 form/PDF corpus evidence. Operational health can consume structured evidence. Real scope-guard egress cannot be enabled by legacy approved id arrays alone; it requires structured clinical taxonomy and provider/vendor evidence plus `MANU_ALLOW_REAL_SCOPE_GUARD=true`. Production pilot remains `NO-GO`.

Phase 63 production pilot GO rebaseline is the latest completed planning wave (2026-06-04): production-pilot planning is now WhatsApp-first, Gemini-only, up to 100 dietitians, and 50+ clients per dietitian. Dietitian/client forms are user-supplied and must pass schema, privacy, prompt-allowlist, clinical, versioning, and migration review before production use. Official health-regulation PDFs are user-supplied and must become a traceable approved corpus with extraction QA, page/section references, approved derived rules, corpus golden tests, and clinical/legal approval before active green/yellow/red routing. This did not approve production pilot launch, close any gate, connect real services, process real data, or resolve R-405.

Before selecting the next engineering phase, read `docs/PHASE_64_STRUCTURED_LAUNCH_GATE_EVIDENCE_ENGINE_SPEC.md` and `docs/PHASE_63_PRODUCTION_PILOT_GO_REBASELINE_SPEC.md`; together they are the current planning source for production-pilot exit work.

Post-Phase 77Y production hardening resumes with the deferred WhatsApp production adapter (mock/gated only until external gates close), followed by production operations, R-405 closure or acceptance, production rehearsal/channel replay acceptance, external launch-gate closure, and only then direct production pilot GO.

Phase 62 architecture review remediation wave 2 is the latest completed implementation wave (2026-06-04): provider failures on active clients now open dietitian handoff without client-facing AI send; shared `normalizeSafetyText`; overlap-based scope retrieval (`DEFAULT_MATCH_THRESHOLD` 0.4); glucose numeric cost-unit filtering; dead `modelForRisk` removed. Bulgu 1 unchanged (accepted). Bulgu 3/9/10 documented as constraint-accepted. Production pilot remains `NO-GO`.

Phase 61 scope guard (RAG + LLM) second layer mock-first completed (2026-06-04): deterministic lexical retrieval + mock evaluator over an approved dietetic-regulation corpus, escalate-only merge with the existing classifier (`dietetic-risk-v0.3.1+clinical-safety-second-layer-v0.1.0+scope-rag-v0.1.0`), raw-text-free scope guard audit records, Supabase `scope_*` tables with RLS, operational-health corpus signals, and disconnected real embedding/LLM seams behind `clinical_taxonomy_approval` + `MANU_ALLOW_REAL_SCOPE_GUARD=true`. Default seed corpus is draft-only so scope guard no-ops until qualified approval. Production pilot remains `NO-GO`.

Start from `docs/NEXT_PHASE_EXECUTION_PLAN.md`, especially `docs/PHASE_62_ARCHITECTURE_REVIEW_REMEDIATION_WAVE2_SPEC.md`, `docs/PHASE_61_SCOPE_GUARD_RAG_SECOND_LAYER_SPEC.md`, and the Phase 56–60 specs listed there. Phase 49 context remains in `docs/PHASE_49_SAFETY_ORCHESTRATION_CONCURRENCY_HARDENING_SPEC.md`.

**R-406 canonical status:** mitigated in the local prototype for the Phase 50–52 baseline (`npm run test:rls` passed 19/19 on 2026-06-02). Re-run `npm run test:rls` when Docker Desktop/local Supabase is available after Phase 57 `yellow_risk_hold` or Phase 61 `scope_rules` / `scope_rule_chunks` / `scope_guard_evaluations` migrations if new RLS evidence is needed.

Remaining production hardening (not a new phase yet): client removal/anonymization transactional redaction contract, dashboard/internal-copilot pagination after Phase 53 contracts, external launch-gate approval artifacts, and R-405 resolution only through Phase 22.

Phase 49 priorities:

1. Expand multilingual quality guard coverage for all supported response languages. Completed locally on 2026-06-02.
2. Add persona output-contract checks for emoji and short-response constraints. Completed locally on 2026-06-02.
3. Connect health-profile risk flags to classifier yellow escalation. Completed locally on 2026-06-02.
4. Add cumulative risk analysis over recent promptable messages plus the current inbound message. Completed locally on 2026-06-02.
5. Move shared preflight evaluation into the core package and reuse it from app paths. Completed locally on 2026-06-02.
6. Add optimistic concurrency controls for Supabase-backed write paths. Completed for local prototype client-row mutations on 2026-06-02; broader multi-table transaction/revision hardening remains before production.
7. Add tenant/client scoped rate limiting for inbound, simulator, manual reply, draft review, and internal copilot paths. Completed as app-instance scoped local limiter on 2026-06-02; distributed production limiter remains before production.
8. Add expired activation lazy cleanup/audit or safe notification behavior. Completed locally on 2026-06-02.
9. Later split `simulator.ts` into domain modules and clean up legacy `buildReplyPrompt`. Initial cleanup completed locally on 2026-06-02: simulator risk/model routing was extracted and the unused legacy prompt export was removed.

Do not connect real WhatsApp, Telegram, Gemini/external LLM, push/email, monitoring, secret manager, or real client health data as part of Phase 49 or Phase 50.

Phase 50 status as of 2026-06-02:

- Phase 1 foundation added `app/supabase/migrations/20260602030000_phase_50_production_hardening_foundation.sql` with `rate_limit_buckets`, `consume_rate_limit`, and transactional commit RPC wrappers. On 2026-06-02, Docker Desktop/local Supabase was started and `npx supabase db reset --local` applied the migration locally.
- Phase 2/51 app integration is complete for the targeted local mutation paths: async scoped rate-limit calls are wired, Supabase-backed limiter RPC support exists, and manual reply, client-scoped inbound simulation, draft review, form response save, client context update, handoff status update, and red-risk reactivation use commit RPCs.
- Phase 3 narrowed reads is partial but locally verified: manual reply, client-scoped inbound simulation, draft approval/dismissal, human takeover release, handoff status update, red-risk reactivation, form response save, and client context update use scoped operation loaders before mutation.
- Phase 3 validation passed: app tests 126/126, app lint, and core tests 57/57.
- Phase 4 launch-gate evidence/docs completed locally: added `docs/PHASE_50_PRODUCTION_SUPABASE_HARDENING_EVIDENCE_SPEC.md`, updated pilot evidence/gate/final readiness docs, and re-ran evidence commands.
- Phase 4 validation passed: `npm run release:verify` from `app` completed with core tests 57/57, app tests 126/126, lint, production build, and only known R-405 findings.
- Local Supabase/RLS validation passed on 2026-06-02: after applying migrations through Phase 50 and Phase 51/52 coverage, `npm run test:rls` passed against local Supabase with 1 file and 19/19 tests. R-406 is mitigated in the local prototype.
- Phase 53 scale/broad read contracts completed locally on 2026-06-02: `app/src/lib/supabase-read-contracts.ts` classifies intentional broad reads, future paginated reads, and already scoped mutation reads; `npm run release:verify` passed with app tests 130/130.
- Remaining production hardening work: design a dedicated transactional payload for client removal/anonymization bulk redaction, implement pagination only after accepting the Phase 53 contracts, resolve R-405 only through the Phase 22 procedure, and keep external launch gates open until approval artifacts arrive.
- Phase 54 R-405/launch-gate recheck completed locally on 2026-06-02: stable `next@latest` remains 16.2.7 with nested `postcss@8.4.31`, production audit still reports only known R-405 findings, no dependency files changed, no external approval artifacts were supplied, all eight launch gates remain open, and production pilot remains `NO-GO`. `npm run release:verify` passed with core tests 57/57, app tests 130/130, lint, production build, and only documented R-405 findings.
- Phase 55 audit remediation safety boundary completed locally on 2026-06-03: real Turkish Unicode classifier normalization, multilingual pregnancy/lactation yellow routing, prompt-injection yellow review routing, client-authored PromptContext data boundaries, safety-critical pinned-note no-truncation, and red-risk preflight regression coverage were added. `npm run release:verify` passed with core tests 72/72, app tests 132/132, lint, production build, and only documented R-405 findings. No schema, RLS, dependency, provider, channel, monitoring, secret manager, backup provider, launch-gate, R-405, or real-data change was made.
- Phase 56 clinical safety second-layer local evidence completed locally on 2026-06-03: deterministic second-layer evaluation now sits above the regex classifier and can escalate otherwise-green allergy/restriction mentions, ambiguous clinical references, missing-history references, minor weight/restriction context, and eating-disorder-sensitive ambiguous restriction language to yellow review. `npm run release:verify` passed with core tests 75/75, app tests 134/134, lint, production build, and only documented R-405 findings. No real LLM safety evaluator, provider, channel, schema/RLS/RPC, launch-gate approval, or real-data change was made. R-310 is partially mitigated in the local prototype only; qualified dietitian approval remains required before production.
- Phase 57 yellow-risk hold/draft refresh completed locally in code on 2026-06-03: local simulator now passivates AI on yellow, stores `yellowRiskHold`, refreshes the same pending draft for later green/yellow messages, preserves the yellow draft when a later red message arrives, and keeps red manual lock stronger than yellow approval. Verification passed: app simulator tests 34/34, app tests 135/135, core tests 75/75, app lint, and `npm run release:verify`. Phase 57 migration RLS evidence is pending when Docker Desktop/local Supabase is unavailable; this does not reopen the Phase 52 baseline R-406 mitigation.
- Phase 58 dietitian client language control completed locally on 2026-06-03: client creation and profile patch now keep `communicationLanguage` and `healthProfile.preferredLanguage` synchronized, language changes are prompt-affecting context changes, and app simulator evidence proves subsequent AI replies use the dietitian-selected language. Targeted verification passed with 54/54 tests. See `docs/PHASE_58_DIETITIAN_CLIENT_LANGUAGE_CONTROL_SPEC.md`.
- Phase 59 architecture review remediation completed locally on 2026-06-03: fail-closed `decideModeAction` for unknown modes, core `generateReply` try/catch with safe `no_ai` provider failure metadata, numeric glucose-context escalation and expanded multilingual `symptom_question` patterns with new golden cases, `appendCoreSimulationResult` helper refactor without behavior change, multilingual formal/informal voice-profile term lists, and provider-native token counting documented for future Gemini/external LLM integration. Verification passed: core tests 85/85, app tests 137/137, app lint, and `npm run release:verify`. No schema/RLS, dependency, real provider, channel, launch-gate, or R-405 changes. See `docs/PHASE_59_ARCHITECTURE_REVIEW_REMEDIATION_SPEC.md`.
- Phase 60 audit remediation completed locally on 2026-06-03: narrowed glucose anchor patterns and deduplicated red reasons (`dietetic-risk-v0.3.1`), core `providerOutputSafety` on provider failures, architecture `.d.ts` alignment, expanded golden/unit/simulator tests, and documentation continuity updates. Verification passed: core tests 104/104, app tests 138/138, app lint, and `npm run release:verify`. See `docs/PHASE_60_AUDIT_REMEDIATION_SPEC.md`.
- Phase 62 architecture review remediation wave 2 completed locally on 2026-06-04: provider failure handoff (no client send), `normalize-safety-text.js`, overlap retrieval, glucose TL skip, orchestrator override comment, `modelForRisk` removed. Verification: core 114/114, app 150/150. See `docs/PHASE_62_ARCHITECTURE_REVIEW_REMEDIATION_WAVE2_SPEC.md`.
- Phase 61 scope guard (RAG + LLM) second layer mock-first completed locally on 2026-06-04: core `scope-guard.js` (`scope-rag-v0.1.0`) with escalate-only `mergeScopeDecision`; app mock lexical retrieval (`scope-retrieval.ts`), deterministic evaluator (`scope-evaluator.ts`), runtime wiring (`scope-guard-runtime.ts`, `simulator-risk.ts`); system-level regulation corpus governance (`scope-corpus.ts`); Supabase migration `20260604000000_phase_61_scope_corpus.sql`; raw-text-free `scope_guard_evaluations` audit; operational-health corpus signals; launch-gate scope corpus evidence on `clinical_taxonomy_approval`; disconnected real embedding/LLM behind `MANU_ALLOW_REAL_SCOPE_GUARD=true`. Default seed corpus is draft-only (scope guard no-op until approved). Verification passed: core tests 112/112, app tests 150/150, app lint, and `npm run release:verify`. See `docs/PHASE_61_SCOPE_GUARD_RAG_SECOND_LAYER_SPEC.md`.

## Current Implementation

The repository has two code packages:

```text
dietitian-ai-assistant   # pure core: orchestration + deterministic safety merge
app                      # SaaS prototype: persistence, simulator, scope retrieval/evaluator I/O
```

Inbound clinical safety uses three independent evaluation layers (escalate-only merge; never downgrade red/yellow to green):

1. **Regex/deterministic classifier** (`safety-classifier.js`)  -  unchanged first axis.
2. **Clinical safety second layer** (`clinical-safety-second-layer.js`)  -  context-sensitive yellow evidence with Phase 76G source-backed food-rule carve-outs (`clinical-safety-second-layer-v0.2.0`).
3. **Scope guard** (`scope-guard.js` in core; retrieval/evaluator in app)  -  dietetic-regulation corpus match (`scope-rag-v0.1.0`); inactive when corpus is empty or unapproved.

Combined classifier version when scope guard participates: `dietetic-risk-v0.3.1+clinical-safety-second-layer-v0.2.0+scope-rag-v0.1.0`.

`dietitian-ai-assistant` is the testable core architecture package.

`app` is the first local SaaS/PWA prototype. It is not production-connected yet; it uses API-backed dashboard state, live local Supabase persistence when local env vars are configured, and a dev fallback store when Supabase env vars are missing.

Core key files:

- `src/orchestrator.js`
- `src/ai-activation.js`
- `src/model-routing.js`
- `src/message-provenance.js`
- `src/safety-classifier.js`
- `src/clinical-safety-second-layer.js`
- `src/scope-guard.js`
- `src/normalize-safety-text.js`
- `src/response-quality-guard.js`
- `src/context-capsule.js`
- `src/personas.js`
- `src/voice-profile.js`
- `dietitian-ai-assistant/docs/data-model.sql`

App key files:

- `app/src/components/dashboard-app.tsx`
- `app/src/components/auth-states.tsx`
- `app/src/lib/app-state-store.ts`
- `app/src/lib/supabase-store.ts`
- `app/src/lib/auth-context.ts`
- `app/src/lib/simulator.ts`
- `app/src/lib/simulator-risk.ts`
- `app/src/lib/scope-corpus.ts`
- `app/src/lib/scope-retrieval.ts`
- `app/src/lib/scope-evaluator.ts`
- `app/src/lib/scope-guard-runtime.ts`
- `app/src/lib/scope-guard-provider.ts`
- `app/src/lib/simulator.test.ts`
- `app/src/lib/auth-context.test.ts`
- `app/src/lib/seed-data.ts`
- `app/src/lib/use-manu-state.ts`
- `app/src/proxy.ts`
- `app/src/app/dashboard/page.tsx`
- `app/src/app/api/auth-state/route.ts`
- `app/public/manifest.webmanifest`
- `app/public/sw.js`
- `app/supabase/migrations/20260522000000_initial_manu_ai_schema.sql`
- `app/supabase/migrations/20260523000000_app_state_schema_fixes.sql`
- `app/supabase/migrations/20260604000000_phase_61_scope_corpus.sql`
- `docs/NEXT_SUPABASE_FOUNDATION_SPEC.md`
- `docs/PHASE_2_AUTH_ONBOARDING_SHELL_SPEC.md`

## Current Behavior

Local app state:

- Dashboard loads state through `/api/app-state`, not browser `localStorage`.
- API routes use `app/src/lib/supabase-store.ts` when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist.
- API routes fall back to `app/src/lib/app-state-store.ts` when Supabase env vars are missing.
- Supabase store auto-seeds demo tenant, dietitian, clients, conversations, messages, AI decision, and processed seed event.
- Supabase-backed operations currently include app state load/reset, client create/update, manual replies, simulator persistence, and handoff resolve/dismiss.
- Supabase Auth-backed demo sign-in creates or reuses `demo@manu.local`, links it to the demo tenant membership, and issues Supabase Auth cookies.
- Supabase-backed API routes resolve tenant/dietitian context from the verified auth user and return `401` without a session or `403` without membership.
- `/dashboard` requires a verified Supabase Auth user when Supabase is configured; fallback mode still uses the local demo cookie.

Inbound flow (simulator and core orchestrator):

1. Build client context capsule.
2. Classify risk (regex classifier + clinical safety second layer in app/core).
3. Apply scope guard when approved corpus is active (mock lexical retrieval + deterministic evaluator; escalate-only merge; else no-op).
4. Pass merged `riskDecisionOverride` into core orchestration.
5. Check AI activation state.
6. If passive, return `no_ai` (red handoff still applies per product decision when AI is passive/manual).
7. If active, decide mode action.
8. Select model by risk.
9. Generate only if allowed.
10. Quality guard validates output.
11. Return/send/draft/handoff/no_ai; append raw-text-free `scope_guard_evaluations` audit when scope guard ran.

AI activation:

- `active`: AI may operate according to mode.
- `passive`: AI does not generate reply or draft.
- `aiActiveFrom` and `aiActiveUntil` can schedule activation.

Message provenance:

- `client_inbound`
- `ai_generated`
- `dietitian_manual`
- `system_event`
- `imported_unknown`

## Tests

Run core tests:

```powershell
cd "C:\Users\Dell\OneDrive\Masaüstü\MANU-AI\dietitian-ai-assistant"
npm test
```

Current expected result:

```text
120/120 tests passing
```

Covered:

- scope guard escalate-only merge, no-downgrade invariants, and rule-threshold behavior (`tests/scope-guard.test.mjs`)
- green autopilot uses `gemini-1.5-flash`
- red handoff makes no model call
- passive client blocks AI generation
- scheduled activation blocks generation before start
- copilot drafts green messages
- yellow uses `gemini-3`
- quality guard blocks unsafe plan changes
- tenant isolation rejects mismatched context
- voice profile extraction
- message provenance for AI vs dietitian messages
- providerAttempted/no-call audit metadata
- PromptContext source metadata and newest dietitian-authored source precedence
- expanded clinical golden cases for English emergencies, medication dose requests, minor/body-image, eating-disorder euphemisms, pregnancy complications, and typo/diacritic handling

Run app checks:

```powershell
cd "C:\Users\Dell\OneDrive\Masaüstü\MANU-AI\app"
npm run lint
npm test
npm run test:rls
npm run build
npm run release:verify
```

Current expected app result:

- ESLint passes.
- 176/176 app tests pass (includes direct pilot scale readiness, approved source answerability, product communication covenant lock, structured launch-gate evidence, operational-health, official regulation corpus QA, scope-corpus, scope-retrieval, scope-guard-runtime, scope-guard-provider tests).
- RLS integration tests pass against local Supabase; when pointed at non-local Supabase they skip unless `MANU_ALLOW_REMOTE_RLS_TESTS=true`. Re-run after Phase 61 `scope_*` migration when recording new RLS evidence.
- `next build --webpack` passes.
- `npm run release:verify` passes with core tests 122/122, app tests 176/176, lint, production build, and only known R-405 production audit findings.
- `npm run test:visual` passes across desktop, tablet, and mobile Chromium viewports.

Note: app scripts intentionally use `--webpack` because Turbopack did not resolve the local symlinked `dietitian-ai-assistant-architecture` package. The core package now has `"exports": "./src/index.js"`.

## Local Supabase Runtime Status

Verified on 2026-05-23:

- Local Supabase project `manu-ai-local` starts successfully.
- Migrations apply successfully to local Supabase Postgres.
- `app/.env.local` exists with local Supabase URL, publishable key, and service secret.
- Supabase CLI is installed as an app dev dependency: run it from `app` with `$env:SUPABASE_TELEMETRY_DISABLED='1'; npx supabase ...`.
- `app/.env.local` is currently pointed at the user's cloud Supabase MANU-AI project `nafcfexwveutnvirhwej`; the file is gitignored and must not be committed or echoed.
- Cloud seed verification returned 1 tenant, 1 dietitian, 3 clients, 3 conversations, 2 messages, 1 AI decision, and 1 processed inbound event.
- Local Supabase API: `http://127.0.0.1:54321`
- Local Supabase Studio: `http://127.0.0.1:54323`
- Local database URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- `http://127.0.0.1:3000/api/app-state` returns seeded demo data from Supabase.
- `http://127.0.0.1:3000/dashboard` returns HTTP 200.
- `/api/simulator` writes inbound message, AI reply, AI decision, idempotency key, and audit event to Supabase.
- `/api/messages/manual` writes dietitian manual replies to Supabase.
- `/api/messages/drafts/[id]` approves, edit-sends, or dismisses AI drafts and persists the outcome to Supabase.
- `/api/clients/[id]/release-takeover` releases human takeover locks and records `human_takeover_released`.
- Autopilot readiness uses detailed `safetyChecklist` fields and reports missing checklist keys in simulator decision reasons.
- Unauthenticated `/api/app-state` returns HTTP 401 when Supabase is configured.
- Unauthenticated `/dashboard` redirects to `/` when Supabase is configured.
- Demo sign-in creates a Supabase Auth session and `/api/app-state` then returns seeded demo data.
- `npm run test:rls` verifies tenant-member reads, membership-less reads, cross-tenant write blocking, scoped assistant/viewer/care-team/auditor behavior, internal copilot scope, tenant-aware channel/idempotency uniqueness, auxiliary table RLS, Telegram idempotency channel persistence, and Supabase-backed AI control audit events.
- Draft approve, edit-send, and dismiss were verified against local Supabase; demo state was reset afterward.
- Human takeover release was verified against local Supabase; demo state was reset afterward.
- Safety checklist blocking and completion were verified against local Supabase; demo state was reset afterward.
- Added `docs/PILOT_FOUNDATION_HARDENING_SPEC.md`.
- Added migration `app/supabase/migrations/20260524000000_restore_auxiliary_rls_policies.sql` for `client_ai_status_events`, `conversation_memories`, and `risk_assessments`.
- The `20260524000000` local migration was marked as applied with `npx supabase migration repair --local --status applied 20260524000000`.
- `/api/simulator` Supabase persistence now stores processed idempotency events with the simulated client's channel.
- Supabase-backed client AI control updates now write `client_ai_status_events` and `client_ai_control_updated` audit events.
- Demo state was reset back to seed after write verification.
- Codex in-app browser could not open localhost because of its URL policy; use Windows/default browser at `http://localhost:3000/dashboard`.
- Pilot foundation execution continued on 2026-05-25:
  - Added `docs/PILOT_FOUNDATION_EXECUTION_SPEC.md`.
  - Added migration `app/supabase/migrations/20260525000000_risk_assessment_message_uniqueness.sql`.
  - Simulator inbound messages now persist `risk_assessments` in fallback and Supabase-backed state.
  - Duplicate simulator idempotency keys do not create duplicate risk assessments.
  - `MANU_DEV_FALLBACK_STORE=true` now forces fallback mode at Supabase config/proxy resolution.
  - `npm run test:rls` skips unless Supabase URL is local or `MANU_ALLOW_REMOTE_RLS_TESTS=true`.
  - Core safety golden tests now cover green/yellow/red dietetic risk categories and quality guard blocks.
- Playwright visual smoke coverage was added for desktop, tablet, and mobile Chromium.
- Phase 1 visual coverage now includes dashboard navigation, clients, conversation, simulator, draft controls, manual long reply rendering, red handoff, safety-checklist blocking, handoff queue visibility, and horizontal overflow checks.
- Controlled JSON API errors were added for known simulator, manual reply, draft, handoff, and takeover failures.
- Handoff creation now records `handoff_notification_queued` audit events as the first in-app notification stub.
- Phase 2-5 later added production-style auth states, consent/permission governance, backed in-app notifications, data-governance export/anonymization helpers, and the `opted_out` Supabase enum migration.
- Added `docs/NEXT_PHASE_EXECUTION_PLAN.md` as the canonical next phased execution plan.
- Updated risk/data/mobile/Supabase foundation docs to track VCS/checkpoint, dependency audit, consent, notification, data governance, and provider/channel launch gates.
- Local Git repository and root ignore rules now exist. Latest verified baseline before Phase 21 is commit `66a8b94 Add pilot readiness evidence pack`; R-005 is mitigated in the local prototype.
- Phase 23 AI context/send safety was completed on 2026-05-30:
  - Added `docs/PHASE_23_AI_CONTEXT_MEMORY_ARCHITECTURE_SPEC.md`.
  - Added bounded `PromptContext` compilation in `dietitian-ai-assistant/src/context-compiler.js`.
  - Core prompt context includes the missing historical context invariant and only allowlisted segments.
  - `ContextManifest` records source/type/token metadata without raw message text.
  - Provider output containing `[ERROR: missing_historical_context]` is blocked with `severity="block"`.
  - Missing historical context routes to handoff/human takeover with `send_status="send_blocked"` and no AI message to the client.
  - Pending AI drafts are invalidated when new inbound/manual/profile context changes the prompt basis.
  - Legacy and invalidated drafts fail approval with controlled 409 errors.
  - Added Supabase migration `20260530000000_phase_23_context_send_safety.sql`.
  - Phase 23 verification on 2026-05-30: core tests 39/39, app tests 82/82, app lint passed, production build passed.
- Phase 24-25 voice sample and dynamic form infrastructure was completed on 2026-05-30:
  - Added `docs/PHASE_24_DIETITIAN_VOICE_SAMPLE_INFRASTRUCTURE_SPEC.md`.
  - Added `docs/PHASE_25_DYNAMIC_CLIENT_FORM_INFRASTRUCTURE_SPEC.md`.
  - Added dietitian voice sample records, generated voice profile records, and dashboard Voice panel.
  - Added versioned client form schemas, response snapshots, and dashboard Forms panel.
  - Added APIs for voice samples/profile generation, form schema creation/publishing, and client form response saves.
  - Added migration `app/supabase/migrations/20260530010000_phase_24_25_voice_forms.sql`.
  - PromptContext includes only `prompt_allowed` form answers via `client_form_summary`.
  - Form response saves increment client context revision and invalidate pending AI drafts.
  - Phase 24-25 app tests reached 86 passing tests before the later Phase 26 additions.

## Next Recommended Work

Continue from the local SaaS prototype:

1. Preserve the Phase 23 context/send-safety baseline in any future provider or channel work.
2. Continue external approval evidence collection and R-405 remediation only through the documented procedures.
3. Keep real WhatsApp, Telegram, Gemini/external LLM, production client-messaging email, push, monitoring, secret manager, and real client health data disconnected until the user explicitly approves the relevant integration. The only current email exception is Phase 84J hosted-sandbox Supabase auth magic links through Resend SMTP.

Local dev server:

```powershell
cd "C:\Users\Dell\OneDrive\Masaüstü\MANU-AI\app"
npm run dev
```

Open:

```text
http://localhost:3000/dashboard
```

If starting from the root page, use the demo sign-in button to enter `/dashboard`.

Do not connect real WhatsApp or Telegram yet.

## Coding Boundaries

- Keep all new files inside `C:\Users\Dell\OneDrive\Masaüstü\MANU-AI`.
- Do not delete existing files.
- Preserve current core package tests.
- Prefer extending the existing `dietitian-ai-assistant` logic instead of rewriting it.
- Do not add real health-data processing before legal/provider gates are complete.
- Do not fine-tune on raw client messages.
- Do not mix tenants in datasets.

## Key Docs To Maintain

When you make changes, update:

- `PLAN.md`
- `PROJECT_PLAN.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- relevant `docs/*.md`
- relevant `dietitian-ai-assistant/docs/*.md`

## Final Context For New Chat

The user's last request was to close the current chat and continue in a new chat without losing context. This handoff file exists for that purpose.

## Phase 2 Handoff Notes  -  2026-05-25

Completed by: Antigravity (temporary session while Codex was offline)

### What Was Done

- **Confirmed** `proxy.ts` is native Next.js 16 middleware. `middleware.ts` is not needed and Next.js 16 errors if both exist. Build output confirms `ƒ Proxy (Middleware)`.
- **Created** `/api/auth-state` endpoint (`app/src/app/api/auth-state/route.ts`)  -  returns JSON describing user auth/membership/profile state: `authenticated`, `no_membership`, `no_dietitian_profile`, `unauthenticated`, or `fallback_demo`.
- **Created** `app/src/components/auth-states.tsx`  -  `NoMembershipState`, `NoDietitianProfileState`, and `MembershipBadge` UI components.
- **Replaced** `app/src/app/dashboard/page.tsx`  -  now has server-side auth resolution. Renders controlled error states for missing membership or missing dietitian profile. Redirects to `/` if unauthenticated. Falls back to `DashboardApp` directly in fallback mode.
- **Updated** `app/src/lib/use-manu-state.ts`  -  captures 401/403 auth errors from API calls into `authError` state. Exposes `authError` to consumers.
- **Updated** `app/src/components/dashboard-app.tsx`  -  accepts `authInfo` prop, shows `MembershipBadge` in header, handles `authError` with session error UI and sign-in redirect link.
- **Created** `app/src/lib/auth-context.test.ts`  -  6 unit tests for AppAuthError and authErrorResponse.
- **Created** `docs/PHASE_2_AUTH_ONBOARDING_SHELL_SPEC.md`  -  full spec for Phase 2.

### Files Changed

| Action | File |
| --- | --- |
| NEW | `app/src/app/api/auth-state/route.ts` |
| NEW | `app/src/components/auth-states.tsx` |
| NEW | `app/src/lib/auth-context.test.ts` |
| NEW | `docs/PHASE_2_AUTH_ONBOARDING_SHELL_SPEC.md` |
| MODIFIED | `app/src/app/dashboard/page.tsx` |
| MODIFIED | `app/src/lib/use-manu-state.ts` |
| MODIFIED | `app/src/components/dashboard-app.tsx` |
| MODIFIED | `docs/NEXT_PHASE_EXECUTION_PLAN.md` |
| MODIFIED | `PLAN.md` |
| MODIFIED | `HANDOFF_FOR_NEXT_CODEX.md` |
| MODIFIED | `app/README.md` |

### Verification Commands  -  All Passed

```
dietitian-ai-assistant: npm test → 23/23 ✓
app: npm run lint → passed ✓
app: npm test → 24/24 ✓ (6 new auth-context tests)
app: npm run test:rls → 5 skipped (expected, non-local Supabase)
app: npm run build → passed ✓
app: npm run test:visual → 3/3 ✓ (desktop/tablet/mobile)
```

### What Was NOT Done

- No real WhatsApp, Telegram, Gemini, or real health data was connected.
- No destructive git/file commands were run.
- No `npm audit fix --force` was run.
- No `.env.local` contents were printed.
- No breaking refactors were made.
- `proxy.ts` was not modified.

### Remaining Risks

- R-005 (no VCS) remains open.
- R-405 (dependency audit) remains open.
- No real OAuth/SSO  -  only demo auth exists.
- No multi-tenant switching UI.
- No production signup/registration flow.

### Next Correct Step For Codex

Phase 4: Handoff Notification Architecture  -  see `docs/NEXT_PHASE_EXECUTION_PLAN.md`. Focus on making urgent handoffs operationally visible without sending external notifications yet.

## Phase 3 Handoff Notes  -  2026-05-25

Completed by: Antigravity (temporary session while Codex was offline)

### What Was Done

- **Extended** `PermissionState` type with `opted_out` value in `types.ts`.
- **Strengthened** `getPreflightBlock()` in `simulator.ts`: only `channelPermission === "ready"` allows AI. Pending, blocked, and opted_out all block generation.
- **Added** identity quarantine: empty `channelUserId` blocks AI with `identity_quarantine_no_channel_id`.
- **Added** identity quarantine: `adultStatus === "unknown"` blocks AI with `identity_quarantine_adult_status_unknown`.
- **Added** permission change auditing in `updateClientInState()`: emits `channel_permission_changed` or `channel_permission_opted_out` audit events with previous/new values.
- **Updated** dashboard UI with `opted_out` permission option.
- **Added** 6 new simulator tests for pending/opted_out blocking, identity quarantine, and permission audit.

### Files Changed

| Action | File |
| --- | --- |
| NEW | `docs/PHASE_3_CONSENT_PERMISSION_CHANNEL_GOVERNANCE_SPEC.md` |
| MODIFIED | `app/src/lib/types.ts` |
| MODIFIED | `app/src/lib/simulator.ts` |
| MODIFIED | `app/src/lib/simulator.test.ts` |
| MODIFIED | `app/src/components/dashboard-app.tsx` |
| MODIFIED | `docs/NEXT_PHASE_EXECUTION_PLAN.md` |
| MODIFIED | `PLAN.md` |
| MODIFIED | `HANDOFF_FOR_NEXT_CODEX.md` |
| MODIFIED | `app/README.md` |

### Verification Commands  -  All Passed

```
dietitian-ai-assistant: npm test → 23/23 ✓
app: npm run lint → passed ✓
app: npm test → 30/30 ✓ (14 simulator + 6 auth-context + 7 store + 1 supabase-config + 2 api-errors)
app: npm run test:rls → 5 skipped (expected)
app: npm run build → passed ✓
app: npm run test:visual → 3/3 ✓
```

### What Was NOT Done

- No client-facing consent/legal copy or KVKK/GDPR text added.
- No real channel opt-in/opt-out webhook handling.
- No real WhatsApp, Telegram, Gemini, or real health data connected.
- No `.env.local` contents printed.
- No breaking refactors.

### Next Correct Step For Codex

Phase 6: Clinical Governance And Evaluation  -  see `docs/NEXT_PHASE_EXECUTION_PLAN.md`.

## Phase 5 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_5_DATA_GOVERNANCE_SPEC.md`.
- Added `app/src/lib/data-governance.ts` with retention placeholders, client-scoped export, and client anonymization/memory invalidation helpers.
- Added `/api/clients/[id]/export` and `/api/clients/[id]/anonymize`.
- Added fallback and Supabase-backed skeleton support for client export/anonymization.
- Added migration `app/supabase/migrations/20260525010000_add_opted_out_permission_state.sql` to close the Phase 3 Supabase enum gap for `opted_out`.
- Added tests for export scoping, promptable-context invalidation, retention placeholders, and fallback API routes.

### Verification Commands

```text
app: npm test -> 37/37 passed
app: npm run lint -> passed
app: npm run build -> passed
app: npm run release:verify -> passed
release verification: core tests 41/41, app tests 99/99, lint passed, production build passed, production dependency audit known R-405 findings only
```

### What Was NOT Done

- No final legal retention durations were set.
- No production DSAR workflow or scheduled deletion job was added.
- No real WhatsApp, Telegram, Gemini, push/email provider, or real health data was connected.

### Next Correct Step For Codex

Phase 7: Channel Adapter Readiness. Define normalized WhatsApp/Telegram adapter contracts and mock adapter tests without connecting real channel credentials.

## Phase 7 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_7_CHANNEL_ADAPTER_READINESS_SPEC.md`.
- Added `app/src/lib/channel-adapters.ts` with normalized mock inbound event handling.
- Added `app/src/lib/channel-adapters.test.ts` with mock WhatsApp/Telegram coverage.
- Known mock channel events now resolve clients and use the existing simulator/orchestrator path.
- Unknown and ambiguous channel identities are quarantined before message persistence or AI decisions.
- Duplicate provider events return `duplicate_ignored` without duplicate sends.
- Permission-blocked and opted-out clients stay blocked by the existing safety gate.
- Provider metadata redaction removes raw body, prompt, health profile, diet plan, allergy, memory, and clinical note fields.

### Verification Commands

```text
app: npm test -> 45/45 passed
app: npm run lint -> passed
```

### What Was NOT Done

- No real WhatsApp Business Cloud API connection was added.
- No real Telegram Bot API connection was added.
- No webhook signing, provider credentials, template sending, or outbound delivery state machine was added.

### Next Correct Step For Codex

Phase 8: AI Provider Readiness. Add a mock provider abstraction without sending real health data to Gemini or any external LLM provider.

## Phase 8 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_8_AI_PROVIDER_READINESS_SPEC.md`.
- Created `docs/AI_PROVIDER_REQUIREMENTS.md`.
- Added `app/src/lib/ai-provider.ts` with a deterministic local mock provider.
- Added `app/src/lib/ai-provider.test.ts`.
- Added `app/supabase/migrations/20260525020000_ai_provider_decision_metadata.sql`.
- Simulator generation now uses the mock provider abstraction.
- AI decisions now include prompt version, provider id, provider status, and provider error code metadata.
- Provider timeout/error failures produce safe `no_ai` decisions without outbound AI-generated messages.

### Verification Commands

```text
app: npm test -> 49/49 passed
app: npm run lint -> passed
app: npm run build -> passed
```

### What Was NOT Done

- No real Gemini or external LLM provider was connected.
- No provider SDK, credentials, prompt logging service, fine-tuning, or raw health-data export was added.
- Vendor/legal/provider retention review remains required before real provider use.

### Next Correct Step For Codex

Do not connect production providers or channels yet. The next work should address launch gates: qualified dietitian clinical approval, provider/legal review, real WhatsApp/Telegram policy review, operational ownership, and R-405 clearance.

## Phase 4 Handoff Notes  -  2026-05-25

Completed by: Antigravity (temporary session while Codex was offline)

### What Was Done

- **Added** `NotificationRecord` type and `notifications` array to `ManuAppState` in `types.ts`.
- **Updated** `simulator.ts` to create a safe-text `NotificationRecord` when an urgent handoff is triggered, converting the previous `handoff_notification_queued` audit event into a backed notification.
- **Added** `markNotificationRead` and `acknowledgeNotification` functionality to `app-state-store.ts` and `use-manu-state.ts`.
- **Created** `/api/notifications/[id]/read` and `/api/notifications/[id]/acknowledge` endpoints.
- **Updated** `supabase-store.ts` to support the new `notifications` array (currently initialized as empty since Supabase push/email adapters are not yet built).
- **Added** Notification Center UI to `dashboard-app.tsx` header: a Bell icon with an unread badge that opens a dropdown panel listing recent notifications.
- **Added** safe-text rules: notification body never contains raw client message content.
- **Added** 2 new simulator tests to verify notification creation and safe-text rules.

### Files Changed

| Action | File |
| --- | --- |
| NEW | `docs/PHASE_4_HANDOFF_NOTIFICATION_ARCHITECTURE_SPEC.md` |
| NEW | `app/src/app/api/notifications/[id]/read/route.ts` |
| NEW | `app/src/app/api/notifications/[id]/acknowledge/route.ts` |
| MODIFIED | `app/src/lib/types.ts` |
| MODIFIED | `app/src/lib/simulator.ts` |
| MODIFIED | `app/src/lib/simulator.test.ts` |
| MODIFIED | `app/src/lib/app-state-store.ts` |
| MODIFIED | `app/src/lib/use-manu-state.ts` |
| MODIFIED | `app/src/lib/supabase-store.ts` |
| MODIFIED | `app/src/components/dashboard-app.tsx` |
| MODIFIED | `docs/NEXT_PHASE_EXECUTION_PLAN.md` |
| MODIFIED | `PLAN.md` |
| MODIFIED | `HANDOFF_FOR_NEXT_CODEX.md` |
| MODIFIED | `app/README.md` |

### Verification Commands  -  All Passed

```
dietitian-ai-assistant: npm test → 23/23 ✓
app: npm run lint → passed ✓
app: npm test → 32/32 ✓ (2 new tests)
app: npm run test:rls → 5 skipped (expected)
app: npm run build → passed ✓
app: npm run test:visual → 3/3 ✓
```

### What Was NOT Done

- No external push/email provider connected.
- No Supabase table created for `notifications` yet, as this will happen in a future integration milestone.
- No raw client health messages were included in notifications.

### Next Correct Step For Codex

Phase 6: Clinical Governance And Evaluation  -  see `docs/NEXT_PHASE_EXECUTION_PLAN.md`.
 
## Phase 6 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_6_CLINICAL_GOVERNANCE_EVALUATION_SPEC.md`.
- Created `docs/CLINICAL_TAXONOMY_REVIEW_WORKFLOW.md`.
- Added `dietitian-ai-assistant/tests/clinical-golden-cases.jsonl`.
- Added `dietitian-ai-assistant/tests/clinical-governance.test.mjs`.
- Expanded the safety classifier to `dietetic-risk-v0.2.0` with normalized Turkish/ASCII matching.
- Added golden assertions for expected risk, action, model, and provider-call behavior.
- Added expanded persona invariant tests proving persona changes do not alter risk/action/model decisions.

### Verification Commands

```text
dietitian-ai-assistant: npm test -> 35/35 passed
```

### What Was NOT Done

- No real LLM provider was connected.
- No client-facing legal or medical copy was added.
- Qualified dietitian approval is still required before pilot use.

### Next Correct Step For Codex

Phase 7: Channel Adapter Readiness. Define normalized WhatsApp/Telegram adapter contracts and mock adapter tests without connecting real channel credentials.

## Phase 9 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_9_PILOT_READINESS_CLOSURE_SPEC.md`.
- Initialized a local Git repository and added a root `.gitignore`.
- Updated app seed classifier metadata and RLS expectation to `dietetic-risk-v0.2.0`.
- Added migration `app/supabase/migrations/20260525030000_notifications.sql`.
- Supabase store now loads and persists notification records.
- Supabase notification read and acknowledge endpoints now persist state instead of returning `501 not_implemented`.
- Fallback notification actions now return `notification_not_found` for unknown IDs.
- Added fallback API tests for notification read/acknowledge and missing notification errors.
- Added RLS integration coverage for notification tenant isolation.

### What Was NOT Done

- No real WhatsApp, Telegram, Gemini, push/email provider, or real health data was connected.
- No `npm audit fix --force` was run.
- No final clinical, legal, provider, or channel launch-gate approval was claimed.

### Verification Commands

```text
dietitian-ai-assistant: npm test -> 35/35 passed
app: npm run lint -> passed
app: npm test -> 51/51 passed
app: npm run test:rls -> 5 skipped when default .env.local points at remote Supabase without MANU_ALLOW_REMOTE_RLS_TESTS=true
app: npm run test:rls -> 5/5 passed against local Supabase after npx supabase db push --local, with fallback disabled through temporary local env vars
app: npm run build -> passed
app: npm run test:visual -> 3/3 passed
app: npm audit --omit=dev -> R-405 still open; stable Next.js 16.2.6 pins nested PostCSS 8.4.31, canary Next.js is not a safe pilot baseline, npm override invalidates the tree, and only breaking npm audit fix --force is offered
```

### Next Correct Step For Codex

Continue with the next remaining production-readiness step. Keep production provider/channel work blocked until external launch gates are approved.

## Phase 10 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_10_PRODUCTION_READINESS_GATES_SPEC.md`.
- Added `app/src/lib/launch-gates.ts` with the production-pilot launch gate definitions and evaluator.
- Added `app/src/lib/launch-gates.test.ts`.
- Production pilot launch is blocked by default until every known gate is externally approved.
- Unknown approval keys are ignored and reported.

### What Was NOT Done

- No real WhatsApp, Telegram, Gemini, push/email provider, or real health data was connected.
- No legal, clinical, provider, channel, incident, backup, secret, or dependency approval was claimed.
- No admin UI or persistence table for approvals was added.

### Verification Commands

```text
app: npm test -- launch-gates -> 54/54 passed
app: npm run lint -> passed
```

### Next Correct Step For Codex

Continue with the next remaining production-readiness step while keeping the production-pilot gate evaluator blocked by default.

## Phase 11 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_11_OPERATIONAL_EVIDENCE_READINESS_SPEC.md`.
- Created `docs/INCIDENT_RESPONSE_RUNBOOK.md`.
- Created `docs/BACKUP_RESTORE_RUNBOOK.md`.
- Created `docs/SECRET_ROTATION_RUNBOOK.md`.
- Extended `app/src/lib/launch-gates.ts` so every production-pilot gate lists required external evidence.
- Added a unit test proving every gate remains externally approved and has evidence requirements.

### What Was NOT Done

- No launch gate was approved.
- No real WhatsApp, Telegram, Gemini, push/email provider, monitoring vendor, secret manager, or real health data was connected.
- No production secrets, real client identifiers, or raw health data were added to runbooks.

### Verification Commands

```text
app: npm test -- launch-gates -> 55/55 passed
app: npm run lint -> passed
```

### Next Correct Step For Codex

Move to the next production-readiness layer only after preserving this checkpoint. Keep launch blocked until external gate evidence is reviewed and approved.

## Phase 12 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_12_RBAC_AUTHORIZATION_SPEC.md`.
- Added `TenantRole` to app types.
- Extended `resolveAppTenantContext()` so authenticated Supabase requests carry membership role.
- Added `AppCapability`, `hasCapability()`, and `requireCapability()` in `auth-context.ts`.
- Added capability checks to Supabase-backed API routes before existing production actions.
- Owner/admin/dietitian keep current workflow access.
- Assistant/auditor are limited to `read_app_state` until client assignments and minimized auditor views are implemented.

### What Was NOT Done

- No client assignment model was added.
- No auditor minimized dashboard was added.
- No real WhatsApp, Telegram, Gemini, push/email provider, monitoring vendor, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -- auth-context -> 58/58 passed
app: npm run lint -> passed
```

### Next Correct Step For Codex

Proceed to client assignment and scoped access. Keep assistant/auditor mutation access blocked until that model exists.

## Phase 13 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_13_CLIENT_ASSIGNMENT_SCOPED_ACCESS_SPEC.md`.
- Added migration `app/supabase/migrations/20260525040000_client_assignments.sql`.
- Added `client_assignments` RLS coverage to `supabase-rls.integration.test.ts`.
- Added `scopeSupabaseState()` in `supabase-store.ts`.
- Added `supabase-store.test.ts` coverage for owner/admin, dietitian, assistant, and auditor scoping.
- Owner/admin see all tenant app-state records.
- Dietitians see owned plus assigned clients.
- Assistants see assigned clients only.
- Auditors receive no raw client/message/decision/handoff/notification records in app-state.

### What Was NOT Done

- No team-management or assignment UI was added.
- No minimized auditor dashboard was added.
- No real WhatsApp, Telegram, Gemini, push/email provider, monitoring vendor, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -> 62/62 passed
app: npm run lint -> passed
app: npx supabase db push --local -> applied 20260525040000_client_assignments.sql
app: npm run test:rls -> 5/5 passed against local Supabase
app: npm run build -> passed
```

### Next Correct Step For Codex

Proceed to DSAR, retention, and legal operations ledger. Keep assignment UI and minimized auditor dashboard as future work unless explicitly requested.

## Phase 14 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_14_DSAR_RETENTION_LEGAL_OPS_SPEC.md`.
- Added migration `app/supabase/migrations/20260525050000_data_requests.sql`.
- Added `DataRequestRecord` and `dataRequests` to `ManuAppState`.
- Fallback export now records a completed `export` data request and minimized `client_data_exported` audit event.
- Fallback anonymization now records a completed `anonymization` data request.
- Supabase export/anonymization paths persist `data_requests`.
- Client export bundles include target-client data request history.
- RLS integration covers `data_requests` tenant isolation.

### What Was NOT Done

- No automatic deletion scheduler was added.
- No final retention durations were set.
- No client-facing DSAR portal was added.
- No real WhatsApp, Telegram, Gemini, push/email provider, monitoring vendor, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -> 63/63 passed
app: npm run lint -> passed
app: npx supabase db push --local -> applied 20260525050000_data_requests.sql
app: npm run test:rls -> 5/5 passed against local Supabase
app: npm run build -> passed
```

### Next Correct Step For Codex

Proceed to Safe Observability and Operational Health. Keep deletion automation and final retention durations blocked until legal review.

## Phase 15 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_15_SAFE_OBSERVABILITY_OPERATIONAL_HEALTH_SPEC.md`.
- Created `docs/ERROR_MONITORING_POLICY.md`.
- Added `app/src/lib/operational-health.ts`.
- Added `app/src/lib/operational-health.test.ts`.
- Operational health snapshots now report aggregate counts for open/urgent handoffs, failed provider decisions, unread notifications, pending/stale drafts, passive clients, and launch-gate blocked state.
- Snapshot tests prove raw message, prompt, channel identifier, diet plan fragment, and secret-like values are not emitted.

### What Was NOT Done

- No dashboard UI was changed.
- No external monitoring, analytics, logging, email, push, WhatsApp, Telegram, Gemini, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -> 66/66 passed
app: npm run lint -> passed
app: npm run build -> passed
```

### Next Correct Step For Codex

Proceed to Channel Policy Simulation Hardening. Keep real WhatsApp/Telegram production webhooks blocked until policy review is approved.

## Phase 16 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_16_CHANNEL_POLICY_SIMULATION_HARDENING_SPEC.md`.
- Hardened `processMockChannelInbound()` in `app/src/lib/channel-adapters.ts`.
- Missing provider event ids now fail closed before client lookup, message creation, risk assessment, or AI decision creation.
- Empty channel bodies now fail closed and are marked idempotently processed by provider event id.
- Exact opt-out commands (`STOP`, `DUR`, `IPTAL`, `IPTAL ET`, `CANCEL`) update matched clients to `channelPermission = opted_out` without entering the AI path.
- Channel policy audit metadata records only safe booleans/reasons and excludes raw body text and raw channel identifiers.
- Added channel adapter tests for missing provider ids, empty bodies, opt-out handling, duplicate blocked events, and minimized audit metadata.

### What Was NOT Done

- No real WhatsApp or Telegram webhook was connected.
- No webhook signature verification was added.
- No outbound template registry or 24-hour service-window enforcement was added.
- No external monitoring, analytics, logging, email, push, Gemini, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -- channel-adapters -> 70/70 passed
app: npm run lint -> passed
app: npm test -> 70/70 passed
app: npm run build -> passed
```

### Next Correct Step For Codex

Proceed to Provider Policy Guard and Prompt Boundary. Keep real provider calls and real channel integrations blocked until external launch gates are approved.

## Phase 17 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_17_PROVIDER_POLICY_GUARD_PROMPT_BOUNDARY_SPEC.md`.
- Added `buildMockProviderInput()` in `app/src/lib/ai-provider.ts`.
- Added `assertMockProviderInputPolicy()` runtime guard in `app/src/lib/ai-provider.ts`.
- Mock provider input now allows only `risk` and `client.dietPlan.summary`.
- Runtime guard rejects prompt/capsule-style payloads, extra client fields, extra diet-plan fields, invalid summary types, and red-risk provider calls.
- Simulator provider calls now use the allowlisted input builder instead of passing the full client object.
- Provider policy violations are normalized as `provider_policy_violation` and become safe no-send simulator decisions.
- Added provider and simulator tests for allowlist construction, boundary rejection, red-risk defense, and controlled safe no-send behavior.

### What Was NOT Done

- No real Gemini or external LLM provider was connected.
- No core architecture prompt rewrite was done.
- No provider logging, analytics, monitoring, or prompt storage service was added.
- No real WhatsApp, Telegram, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -- ai-provider -> 74/74 passed
app: npm test -- simulator -> 75/75 passed
app: npm run lint -> passed
app: npm test -> 75/75 passed
app: npm run build -> passed
```

### Next Correct Step For Codex

Proceed to Notification SLA and Internal Escalation. Keep external email/push/WhatsApp/Telegram notifications blocked until notification payload policy and launch gates are approved.

## Phase 18 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_18_NOTIFICATION_SLA_INTERNAL_ESCALATION_SPEC.md`.
- Added `app/src/lib/notification-sla.ts`.
- Added `app/src/lib/notification-sla.test.ts`.
- Defined local in-app acknowledgement SLA thresholds: 15 minutes for urgent handoff notifications and 4 hours for standard handoff notifications.
- SLA helper counts only unacknowledged notifications tied to open handoff cases.
- Notifications tied to resolved/missing handoffs are ignored.
- Urgent breached notifications are counted as internal escalation due.
- Operational health snapshots now include `breachedNotificationSlaCount` and `urgentEscalationDueCount`.
- Tests prove SLA output stays aggregate-only and does not expose raw message, channel, prompt, or secret-like content.

### What Was NOT Done

- No external email, push, WhatsApp, Telegram, SMS, APNs, FCM, monitoring, or analytics provider was connected.
- No on-call schedule, rota, or real escalation workflow was added.
- No dashboard UI was changed.
- No real health data was connected.

### Verification Commands

```text
app: npm test -- notification-sla -> 78/78 passed
app: npm test -- operational-health -> 78/78 passed
app: npm run lint -> passed
app: npm test -> 78/78 passed
app: npm run build -> passed
```

### Next Correct Step For Codex

Proceed to Release Verification, CI Script, and Dependency Gate. Keep dependency remediation conservative and do not run breaking `npm audit fix --force`.

## Phase 19 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_19_RELEASE_VERIFICATION_DEPENDENCY_GATE_SPEC.md`.
- Added `app/scripts/release-verify.mjs`.
- Added `npm run release:verify` to `app/package.json`.
- Release verification runs core package tests, app lint, app unit/API tests, production build, and `npm audit --omit=dev --json`.
- Dependency gate allows only the documented R-405 production findings:
  - `next:postcss`
  - `postcss:GHSA-qx2v-qp2m-jg93`
- Unknown production audit findings fail closed.
- High or critical production audit findings fail closed.
- RLS and visual tests remain separate explicit commands because they depend on local Supabase/browser setup.
- Updated app README checks.

### What Was NOT Done

- No GitHub Actions or remote CI service was added.
- No dependency upgrade was applied.
- No `npm audit fix --force` was run.
- No canary Next.js version or npm override was added.
- No real providers, real channels, monitoring, analytics, or real health data was connected.

### Verification Commands

```text
app: npm run release:verify -> passed
core: npm test -> 35/35 passed inside release verification
app: npm test -> 78/78 passed inside release verification
app: npm audit --omit=dev --json -> known R-405 findings only
```

### Next Correct Step For Codex

Proceed to Pilot Readiness Evidence Pack. Keep R-405 open and production launch blocked until a safe stable Next.js/PostCSS patch path exists.

## Phase 20 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_20_PILOT_READINESS_EVIDENCE_PACK_SPEC.md`.
- Created `docs/PILOT_READINESS_EVIDENCE_PACK.md`.
- Mapped all eight production-pilot launch gates to internal evidence, remaining blockers, and open status.
- Recorded the latest release verification result:
  - Core package tests: 35/35 passed.
  - App tests: 78/78 passed.
  - App lint: passed.
  - Production build: passed.
  - Production dependency audit gate: known R-405 findings only.
- Evidence pack explicitly separates internal readiness evidence from external legal, clinical, provider, platform, security, and dependency approval.

### What Was NOT Done

- No launch gate was approved.
- No production pilot was declared ready.
- No real client health data was connected.
- No real WhatsApp, Telegram, Gemini, external LLM, email, push, monitoring, analytics, or secret manager was connected.
- R-405 was not resolved or accepted.

### Verification Commands

```text
app: npm run release:verify -> already passed in Phase 19 and recorded in the evidence pack
```

### Next Correct Step For Codex

Move from local pilot-foundation engineering to external approval work: legal/privacy, qualified dietitian taxonomy sign-off, provider/vendor review, WhatsApp/Telegram policy review, operational ownership, and R-405 resolution or formal acceptance.

## Phase 21 Handoff Notes - 2026-05-28

Completed by: Codex

### What Was Done

- Created `docs/PHASE_21_EXTERNAL_APPROVAL_DOSSIER_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`.
- Re-verified the local release baseline with `npm run release:verify`.
- Updated the pilot readiness evidence pack with the 2026-05-28 verification result.
- Updated planning and handoff docs so the next step is external approval evidence collection.
- Corrected the stale no-Git warning: the local Git repository exists and latest baseline is `66a8b94`.

### What Was NOT Done

- No launch gate was approved.
- No production pilot was declared ready.
- No real client health data was connected.
- No real WhatsApp, Telegram, Gemini, external LLM, email, push, monitoring, analytics, secret manager, or production secret was connected.
- No dependency upgrade, canary Next.js move, invalid npm override, or `npm audit fix --force` was applied.
- R-405 was not resolved or accepted.

### Verification Commands

```text
app: npm run release:verify -> passed
core: npm test -> 35/35 passed inside release verification
app: npm test -> 78/78 passed inside release verification
app: lint -> passed inside release verification
app: production build -> passed inside release verification
app: production dependency audit -> known R-405 findings only
```

### Next Correct Step For Codex

Collect external approval artifacts against `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`. Keep all gates open until the user supplies approval evidence, and keep real providers/channels/monitoring/secret manager/health data disconnected.

## Phase 22 Handoff Notes - 2026-05-28

Completed by: Codex

### What Was Done

- Created `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- Re-checked current production audit output: only `next:postcss` and `postcss:GHSA-qx2v-qp2m-jg93` remain.
- Re-checked npm metadata:
  - `next@latest` is `16.2.6` and still depends on `postcss@8.4.31`.
  - `next@canary` is `16.3.0-canary.32` and depends on `postcss@8.5.10`, but canary remains rejected as pilot baseline.
- Documented the accepted stable patch procedure for updating `next` and `eslint-config-next` together once stable Next bundles `postcss >= 8.5.10`.
- Updated the risk register, evidence pack, production gate dossier, and planning docs to point to the Phase 22 procedure.

### What Was NOT Done

- No dependency files were changed because no safe stable patch path exists yet.
- No `npm audit fix --force` was run.
- No canary Next.js version, invalid npm override, or major downgrade was applied.
- R-405 was not resolved or accepted.
- No real provider, channel, monitoring, secret manager, email, push, or real health data was connected.

### Verification Commands

```text
app: npm audit --omit=dev --json -> known R-405 findings only
app: npm view next@latest version dependencies --json -> 16.2.6 with postcss 8.4.31
app: npm view next@canary version dependencies --json -> 16.3.0-canary.32 with postcss 8.5.10
```

### Next Correct Step For Codex

Do not edit dependency files until `next@latest` is a stable release that bundles `postcss >= 8.5.10`, or until the user supplies formal R-405 risk acceptance. When a stable patch exists, follow `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md` exactly and run `npm run release:verify`.

## Phase 26 Handoff Notes - 2026-05-30

Completed by: Codex

### What Was Done

- Read and implemented the user-supplied `new plan 2.pdf` as Phase 26.
- Created `docs/PHASE_26_INTERNAL_COPILOT_SPEC.md`.
- Added read-only internal copilot app-state records: `internalCopilotMessages`, `internalCopilotToolCalls`, and source refs.
- Added migration `app/supabase/migrations/20260530020000_phase_26_internal_copilot.sql` for `internal_copilot_messages` and `internal_copilot_tool_calls` with tenant-scoped RLS.
- Added deterministic local/mock internal copilot tools over scoped `ManuAppState`.
- Added `/api/internal-copilot/messages` and `internal_copilot_chat` capability.
- Owner/admin/dietitian can use the internal copilot; assistant/auditor are blocked in v1.
- Added Dashboard `Copilot` tab with quick prompts, source chips, and no send-to-client action.
- Added tests for intent mapping, ambiguous/hidden clients, grounded source refs, prompt-injection-as-data behavior, fallback API persistence, RBAC, and Supabase app-state scoping.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/DATA_INVENTORY.md`, `docs/AI_PROVIDER_REQUIREMENTS.md`, `docs/DATASET_STRATEGY.md`, and `docs/RISK_REGISTER.md`.

### What Was NOT Done

- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.
- No raw SQL or mutation tools were added.
- No production launch gate was approved.
- No dependency remediation or `npm audit fix --force` was attempted.

### Verification Commands

```text
core: npm test -> 39/39 passed
app: npm test -> 96/96 passed during implementation
app: npm run lint -> passed
app: npm run build -> passed
app: npm run release:verify -> passed
release verification: core tests 39/39, app tests 96/96, lint passed, production build passed, production dependency audit known R-405 findings only
```

### Next Correct Step For Codex

Collect external approval artifacts against `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`. Keep Phase 26 local/mock and read-only until a separate provider-egress, legal/vendor, security, and data-minimization review exists.

## Phase 27 Handoff Notes - 2026-05-30

Completed by: Codex

### What Was Done

- Created `docs/PHASE_27_DIETITIAN_CONTEXT_UPDATE_SPEC.md`.
- Added dietitian-entered client context update records for phone, Zoom, in-person, or other non-chat conversations.
- Added migration `app/supabase/migrations/20260530030000_phase_27_client_context_updates.sql`.
- Added `/api/clients/[id]/context-updates` using existing `update_client` capability.
- Added Dashboard Critical Context panel on the selected client detail surface.
- Active context updates increment `client.contextRevision`, invalidate pending AI drafts, and enter PromptContext as bounded `dietitian_context_update` segments.
- Newer `dietitian_manual` WhatsApp/Telegram/manual messages are authoritative over older Critical Context records through the latest dietitian-authored source rule.
- `ContextManifest` remains raw-text-free and current inbound message id is now preserved.
- Client export includes context updates; anonymization redacts them and marks affected records superseded.
- Updated `PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/DATA_INVENTORY.md`, `docs/DATASET_STRATEGY.md`, and `docs/RISK_REGISTER.md`.

### What Was NOT Done

- Old WhatsApp messages were not rewritten.
- No automatic diet plan or health-profile mutation was added.
- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.
- No production launch gate was approved.

### Verification Commands

```text
core: npm test -> 41/41 passed
app: npm test -> 99/99 passed during implementation
app: npm run lint -> passed
app: npm run build -> passed
```

### Next Correct Step For Codex

Run full `npm run release:verify` after any follow-up edits. Preserve Phase 23-27 context/send-safety, dynamic form, internal copilot, and dietitian context update boundaries before any real provider or channel integration.

## Phase 28 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Implemented the AI security remediation plan.
- Added `docs/PHASE_28_AI_SECURITY_REMEDIATION_SPEC.md`.
- Added migration `app/supabase/migrations/20260530040000_ai_security_remediation.sql` with `ai_decisions.provider_attempted`, provider-status invariants, tenant-aware `client_channels` and `processed_inbound_events` uniqueness, RLS helper functions, and scoped RLS/RBAC policies.
- Core and app no-provider paths now use `providerAttempted=false`, `model=null`, `providerId=null`, and `providerStatus=not_called`.
- Actual mock-provider attempts now carry provider id/status/prompt metadata; only `MockProviderError` is normalized as provider failure.
- PromptContext now carries source id, origin, timestamp, and authority metadata, and marks the newest dietitian-authored source across manual messages and Critical Context updates as authoritative.
- Draft approve/edit-send now revalidates draft/decision state, context revision, channel permission, takeover lock, AI mode/status, latest promptable message id, and memory version/revision/staleness before sending.
- Provider input now uses a segment allowlist and rejects red risk, unknown/overlong segments, extra keys, raw prompt/capsule/message/profile payloads, and unsafe boundary shapes.
- Clinical golden cases now include typo/diacritic handling, English emergencies, medication dose requests, minor/body-image language, eating-disorder euphemisms, and pregnancy complications.
- App/core TypeScript declarations now expose concrete CoreResult, PromptContext, ContextManifest, provider-attempt, activation, and mode-decision types.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/DATA_INVENTORY.md`, `docs/AI_PROVIDER_REQUIREMENTS.md`, `docs/RISK_REGISTER.md`, and this handoff.

### What Was NOT Done

- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.
- No production launch gate was approved.
- R-405 was not remediated; it remains the documented dependency launch blocker.

### Verification Commands

```text
core: npm test -> 49/49 passed
app: npm test -> 103/103 passed
app: npm run lint -> passed
app: npm run build -> passed
app: npm run release:verify -> passed
app: npm run test:rls -> skipped unless local Supabase env is configured, or runs the expanded RLS suite when local Supabase is available
```

### Next Correct Step For Codex

Collect external approval artifacts against `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`. Preserve Phase 23-28 context/send-safety, provider boundary, draft revalidation, RLS/RBAC, dynamic form, internal copilot, and dietitian context update boundaries before any real provider or channel integration.

## Phase 29 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Created `docs/PHASE_29_PILOT_GATE_CLOSURE_EVIDENCE_HARDENING_SPEC.md`.
- Updated the production pilot gate closure dossier to use the Phase 27-29 baseline instead of stale Phase 21-26 wording.
- Updated the pilot readiness evidence pack with Phase 29 evidence hardening notes.
- Updated `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, and `docs/RISK_REGISTER.md`.
- Rechecked R-405 metadata: `next@latest` is still `16.2.6` with `postcss@8.4.31`; `eslint-config-next@latest` is still `16.2.6`.
- Recorded that the expanded RLS suite exists but the latest local evidence remains pending/skipped when local Supabase is unavailable.

### What Was NOT Done

- No runtime behavior was changed.
- No dependency files were changed.
- No R-405 remediation or acceptance was performed.
- No production launch gate was approved.
- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm run release:verify -> passed after clearing a stale .next build artifact lock
release verification: core tests 49/49, app tests 103/103, lint passed, production build passed, production dependency audit known R-405 findings only
app: npm run test:rls -> pending local Supabase availability; skip is environment evidence, not approval
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits, then collect external approval artifacts against `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`. Rerun `npm run test:rls` against local Supabase when available. Preserve Phase 23-29 context/send-safety, provider boundary, draft revalidation, evidence, RLS/RBAC, dynamic form, internal copilot, and dietitian context update boundaries before any real provider or channel integration.

## Completion Roadmap Phase 1 / Phase 30 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: surgical documentation-only change, spec before implementation, no speculative feature work.
- Created `docs/PHASE_30_COMPLETION_PHASE_1_CHECKPOINT_BASELINE_SPEC.md`.
- Confirmed the active branch is `codex/phase-29-baseline-checkpoint`.
- Confirmed the starting checkpoint is `c75564e Add Phase 27-29 pilot readiness checkpoint`.
- Updated `docs/NEXT_PHASE_EXECUTION_PLAN.md` and `PLAN.md` so the next active work is Completion Roadmap Phase 2: local Supabase RLS evidence completion.

### What Was NOT Done

- No runtime behavior was changed.
- No schema, dependency, provider, channel, launch-gate, or real-data changes were made.
- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.
- R-405 and R-406 remain open.

### Verification Commands

```text
app: npm run release:verify -> passed
release verification: core tests 49/49, app tests 103/103, lint passed, production build passed, production dependency audit known R-405 findings only
```

### Next Correct Step For Codex

Run Completion Roadmap Phase 2 only: local Supabase RLS evidence completion. Do not start R-405 remediation, external gate collection, provider integration, channel integration, or production infrastructure work in the same command.

## Completion Roadmap Phase 2 / Phase 31 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: spec first, surgical evidence/docs-only change, no runtime behavior changes.
- Created `docs/PHASE_31_COMPLETION_PHASE_2_RLS_EVIDENCE_SPEC.md`.
- Confirmed the RLS integration guard skips non-local Supabase URLs unless `MANU_ALLOW_REMOTE_RLS_TESTS=true` is explicitly set.
- Confirmed `app/.env.local` is currently pointed at a cloud Supabase URL and must not be used as default RLS evidence input.
- Checked Supabase CLI availability: version `2.101.0`.
- Attempted to start local Supabase while redirecting output to avoid printing secrets.
- Ran `npm run test:rls`.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, `app/README.md`, and this handoff.

### What Was NOT Done

- No passing RLS evidence was produced.
- R-406 was not mitigated.
- No remote Supabase RLS tests were run.
- No runtime behavior, schema, dependency, provider, channel, launch-gate, or real-data changes were made.
- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.
- R-405 was not remediated or accepted.

### Verification Commands

```text
app: npx supabase start -> failed because Docker Desktop Linux engine pipe was unavailable
app: npm run test:rls -> skipped 1 file and 10 tests
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Unblock Completion Roadmap Phase 2 only: start Docker Desktop with the Linux engine available, start local Supabase, point RLS test env to local Supabase without printing secrets, and rerun `npm run test:rls`. Update R-406 only after the expanded 10-test RLS suite passes locally.

## Completion Roadmap Phase 3 / Phase 32 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: re-read the governing spec before dependency work, kept the change surgical, and avoided speculative fixes.
- Created `docs/PHASE_32_COMPLETION_PHASE_3_R405_RECHECK_SPEC.md`.
- Re-read `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- Ran `npm view next@latest version dependencies --json`.
- Ran `npm view eslint-config-next@latest version --json`.
- Ran `npm audit --omit=dev --json`.
- Confirmed `next@latest` is still `16.2.6`.
- Confirmed stable Next still depends on nested `postcss@8.4.31`.
- Confirmed `eslint-config-next@latest` is still `16.2.6`.
- Confirmed production audit still reports only the known R-405 moderate `next`/`postcss` findings and a rejected semver-major downgrade to `next@9.3.3`.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/RISK_REGISTER.md`, `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`, and this handoff.

### What Was NOT Done

- No dependency files were changed.
- No `npm audit fix --force` was run.
- No canary, beta, release-candidate, major downgrade, or npm override was applied.
- R-405 was not remediated or accepted.
- R-406 was not remediated.
- No runtime behavior, schema, provider, channel, launch-gate, or real-data changes were made.
- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm view next@latest version dependencies --json -> 16.2.6 with postcss 8.4.31
app: npm view eslint-config-next@latest version --json -> 16.2.6
app: npm audit --omit=dev --json -> known R-405 findings only
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Do not edit dependency files until stable `next@latest` bundles `postcss >= 8.5.10`, or until the user supplies formal R-405 risk acceptance. Keep R-406 blocked until local Docker/Supabase is available and `npm run test:rls` passes locally.

## Completion Roadmap Phase 4 / Phase 33 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to documentation/review readiness.
- Created `docs/PHASE_33_COMPLETION_PHASE_4_EXTERNAL_APPROVAL_INTAKE_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`.
- Mapped all eight canonical production-pilot launch gate ids to required evidence, approval owner, acceptable artifact, status, evidence reference, and notes.
- Added explicit rules not to paste secrets, raw client health data, or real client identifiers into repository docs.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, and this handoff.

### What Was NOT Done

- No launch gate was approved.
- No external approval artifact was supplied or recorded as accepted.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Use `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md` and `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md` when the user supplies external approval artifacts. Do not mark a gate approved unless every required evidence item for that gate is covered by an acceptable artifact.

## Completion Roadmap Phase 5 / Phase 34 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to documentation/review readiness.
- Created `docs/PHASE_34_COMPLETION_PHASE_5_LEGAL_PRIVACY_PACKET_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md`.
- Mapped legal/privacy review questions to current internal evidence in data inventory, data governance, legal ops ledger, internal copilot, dietitian context updates, and AI security remediation.
- Listed missing counsel decisions for lawful basis, privacy notice, permission flow, medical-device/CDS classification, retention, DSAR/deletion, internal copilot records, dietitian context updates, provider dependency, and channel dependency.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, `docs/DATA_INVENTORY.md`, and this handoff.

### What Was NOT Done

- No legal/privacy approval artifact was supplied or accepted.
- No medical-device/CDS classification approval was supplied.
- No final client-facing legal copy was created.
- No final retention durations or DSAR/deletion SLA were approved.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm run release:verify -> first build attempt hit transient Windows/OneDrive .next EPERM; after deleting app/.next, passed with core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Use `docs/PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md` when the user supplies counsel feedback or legal/privacy approval artifacts. Do not mark `legal_privacy_review` approved unless all required legal/privacy evidence items are covered by an acceptable artifact.

## Completion Roadmap Phase 6 / Phase 35 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to documentation/review readiness.
- Created `docs/PHASE_35_COMPLETION_PHASE_6_CLINICAL_TAXONOMY_PACKET_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md`.
- Summarized the current 16 JSONL clinical golden cases and their expected green/yellow/red behavior.
- Mapped internal evidence from `PHASE_6_CLINICAL_GOVERNANCE_EVALUATION_SPEC.md`, `CLINICAL_TAXONOMY_REVIEW_WORKFLOW.md`, clinical golden cases, governance tests, safety classifier, and Phase 28 remediation.
- Listed missing qualified dietitian decisions for taxonomy scope, red escalation, yellow review, green routine behavior, minor/body-image handling, eating-disorder handling, medication/supplement/lab boundaries, pregnancy/glucose/allergy/emergency handling, coverage gaps, and approved taxonomy version.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, `docs/CLINICAL_TAXONOMY_REVIEW_WORKFLOW.md`, and this handoff.

### What Was NOT Done

- No qualified dietitian approval artifact was supplied or accepted.
- No classifier behavior was changed.
- No clinical golden case was added or edited.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Use `docs/PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md` when the user supplies qualified dietitian feedback or clinical approval artifacts. Do not mark `clinical_taxonomy_approval` approved unless all required clinical evidence items are covered by an acceptable artifact.

## Completion Roadmap Phase 7 / Phase 36 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to documentation/review readiness.
- Created `docs/PHASE_36_COMPLETION_PHASE_7_PROVIDER_VENDOR_REVIEW_PACKET_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md`.
- Mapped current local/mock provider controls to required vendor, retention, logging, training-use, region, access-control, incident-obligation, internal copilot egress, and dietitian context update egress decisions.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/AI_PROVIDER_REQUIREMENTS.md`, `docs/RISK_REGISTER.md`, and this handoff.

### What Was NOT Done

- No provider/vendor approval artifact was supplied or accepted.
- No real Gemini/external LLM provider was connected.
- No provider SDK, credential, environment variable, prompt/completion logging vendor, or secret manager was added.
- No internal copilot or dietitian context update provider egress was enabled.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Use `docs/PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md` when the user supplies vendor/legal/security feedback or provider approval artifacts. Do not mark `provider_vendor_review` approved unless all required provider/vendor evidence items are covered by an acceptable artifact.

## Completion Roadmap Phase 8 / Phase 37 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to documentation/review readiness.
- Created `docs/PHASE_37_COMPLETION_PHASE_8_CHANNEL_POLICY_REVIEW_PACKET_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md`.
- Mapped current mock WhatsApp/Telegram controls to required WhatsApp healthcare-use, Telegram bot/privacy, opt-in/out, template, service-window, webhook, delivery-status, account-quality, and fallback decisions.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, and this handoff.

### What Was NOT Done

- No channel policy approval artifact was supplied or accepted.
- No real WhatsApp Business Cloud API or Telegram Bot API integration was added.
- No webhook, channel credential, template registry, outbound send adapter, delivery-status adapter, or secret manager was added.
- No runtime behavior, schema, dependency, provider, channel integration, launch-gate approval, or real-data change was made.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Use `docs/PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md` when the user supplies WhatsApp/Telegram platform-policy feedback or approval artifacts. Do not mark `channel_policy_review` approved unless all required channel-policy evidence items are covered by an acceptable artifact.

## Completion Roadmap Phase 9 / Phase 38 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to documentation/review readiness.
- Created `docs/PHASE_38_COMPLETION_PHASE_9_INCIDENT_DSAR_REVIEW_PACKET_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md`.
- Mapped the draft incident response runbook, DSAR/export/anonymization skeleton, legal ops ledger, and safe operational health evidence to required owner, escalation, notification, breach, DSAR/deletion, and re-enable decisions.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, and this handoff.

### What Was NOT Done

- No incident/DSAR approval artifact was supplied or accepted.
- No named production owner or backup owner was assigned.
- No monitoring, notification, ticketing, paging, email, push, WhatsApp, Telegram, analytics, or secret manager integration was added.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Use `docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md` when the user supplies operations/legal/privacy/clinical feedback or approval artifacts. Do not mark `incident_response_runbook` approved unless all required incident and DSAR evidence items are covered by an acceptable artifact.

## Completion Roadmap Phase 10 / Phase 39 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to documentation/review readiness.
- Created `docs/PHASE_39_COMPLETION_PHASE_10_BACKUP_RESTORE_REVIEW_PACKET_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md`.
- Mapped the draft backup/restore runbook to required provider, region, retention, restore-drill, encryption, legal-hold, tenant-isolation, RLS, data-governance, and drill evidence decisions.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, and this handoff.

### What Was NOT Done

- No backup/restore approval artifact or restore-drill evidence was supplied or accepted.
- No production backup provider, storage, secret manager, infrastructure, or restore environment was configured.
- No backup snapshot was created, restored, exported, imported, or destroyed.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Use `docs/PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md` when the user supplies operations/security/legal feedback, backup policy approval, or restore-drill evidence. Do not mark `backup_restore_test` approved unless all required backup/restore evidence items are covered by an acceptable artifact.

## Completion Roadmap Phase 11 / Phase 40 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to documentation/review readiness.
- Created `docs/PHASE_40_COMPLETION_PHASE_11_SECRET_ROTATION_REVIEW_PACKET_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md`.
- Mapped the draft secret rotation runbook to required secret manager, inventory, owner, cadence, emergency revocation, break-glass, access-review, health-check, smoke-test, and evidence decisions.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, and this handoff.

### What Was NOT Done

- No secret-rotation approval artifact, production secret manager, or rotation evidence was supplied or accepted.
- No real secret was created, printed, rotated, revoked, or stored.
- No CI/CD, provider, channel, Supabase, email, push, monitoring, backup/storage, deployment, or infrastructure credential was changed.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Use `docs/PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md` when the user supplies security/operations feedback, secret manager approval, secret inventory, or rotation evidence. Do not mark `secret_rotation_plan` approved unless all required secret-rotation evidence items are covered by an acceptable artifact.

## Completion Roadmap Phase 12 / Phase 41 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: re-read the Phase 22 dependency remediation spec, wrote the Phase 41 spec before documentation updates, and avoided speculative dependency changes.
- Created `docs/PHASE_41_COMPLETION_PHASE_12_DEPENDENCY_AUDIT_CLEARANCE_PACKET_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md`.
- Ran `npm view next@latest version dependencies --json`: `next@latest` is `16.2.6` with nested `postcss@8.4.31`.
- Ran `npm view eslint-config-next@latest version --json`: `eslint-config-next@latest` is `16.2.6`.
- Ran `npm audit --omit=dev --json`: only known moderate R-405 `next`/`postcss` findings remain.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, and this handoff.

### What Was NOT Done

- No dependency files were changed.
- No `npm audit fix --force`, canary, beta, release-candidate, semver-major downgrade, or npm override was applied.
- No formal R-405 risk acceptance or dependency audit clearance artifact was supplied or accepted.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm view next@latest version dependencies --json -> 16.2.6 with postcss 8.4.31
app: npm view eslint-config-next@latest version --json -> 16.2.6
app: npm audit --omit=dev --json -> known R-405 findings only
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Use `docs/PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md` when the user supplies engineering/security dependency clearance, safe stable upgrade evidence, or formal R-405 risk acceptance. Do not mark `dependency_audit_clearance` approved unless all required dependency evidence items are covered by an acceptable artifact.

## Completion Roadmap Phase 13 / Phase 42 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to final evidence consolidation.
- Created `docs/PHASE_42_COMPLETION_PHASE_13_FINAL_READINESS_CLOSURE_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md`.
- Recorded the current production-pilot decision as `NO-GO`.
- Confirmed all eight launch gates remain open.
- Confirmed R-405 remains open.
- Confirmed R-406 remains blocked.
- Confirmed no external approval artifacts were supplied during the completion roadmap.
- Updated `PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, and this handoff.

### What Was NOT Done

- No launch gate was approved.
- No external approval artifact was supplied or accepted.
- No dependency files were changed.
- No local Supabase RLS passing evidence was produced.
- No runtime behavior, schema, dependency, provider, channel, monitoring, secret manager, backup provider, R-405 acceptance, R-406 mitigation, or real-data change was made.

### Verification Commands

```text
app: npm run release:verify -> passed after clearing a transient .next EPERM build artifact; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Use `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md` as the current go/no-go source. Do not move toward production pilot until R-406 has passing local Supabase evidence, R-405 is resolved or formally accepted, and all eight launch gates have acceptable external approval artifacts.

## Phase 43 Multilingual Language Support Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote `docs/PHASE_43_MULTILINGUAL_LANGUAGE_SUPPORT_SPEC.md` before implementation.
- Added supported language codes `tr`, `en`, `de`, `fr`, `es`, `pt`, and `cs`.
- Added strict canonical E.164 phone identity handling for clients.
- Stored dietitian dashboard language, client communication language, form schema language, form response language, and submitted phone metadata in local state and Supabase schema.
- Updated fallback and Supabase stores plus API routes for client create/update, dietitian preferences, form schema create, and form response save.
- Added dashboard controls for dietitian UI language, client phone/language, and form language.
- Added a bounded `conversation_language` PromptContext segment and ContextManifest language metadata.
- Localized local/mock provider replies and safe handoff acknowledgements for all seven supported languages.
- Expanded multilingual safety patterns and clinical golden cases.

### What Was NOT Done

- No automatic translation was added.
- No public client-facing form link was added.
- No real WhatsApp, Telegram, Gemini/external LLM, translation API, email, push, monitoring, secret manager, backup provider, or real client health data was connected.
- No production-pilot launch gate was approved.
- R-405 remains open.
- R-406 remains blocked pending passing local Supabase RLS evidence.

### Verification Commands

```text
app: npm run lint -> passed
app: npm run test -> passed; 16 files, 107 tests
dietitian-ai-assistant: npm test -> passed; 52 tests
app: npm run release:verify -> passed; core tests 52/52, app tests 107/107, lint, production build, known R-405 only
app: npm run test:rls -> skipped; 1 file and 10 guarded tests because local Supabase evidence is still unavailable
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Keep the Phase 43 language model deterministic and internal until legal/privacy, clinical, provider/vendor, and channel policy gates are externally approved. Do not connect real translation/provider/channel services or mark production pilot approved from this work.

## Phase 44 Red-Risk Reactivation Lock Handoff Notes - 2026-06-01

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote `docs/PHASE_44_RED_RISK_REACTIVATION_LOCK_SPEC.md` before implementation.
- Added `ClientRecord.redRiskLock` and a Supabase `clients.red_risk_lock` JSONB migration.
- Red-risk handoffs now create a client-level lock, force `aiStatus=passive`, `aiMode=manual`, and `humanTakeoverLocked=true`, and audit `red_risk_lock_created`.
- While locked, direct AI reactivation, takeover release, normal handoff resolution, and red-locked handoff dismissal are rejected.
- Manual dietitian replies and notification read/acknowledge do not clear the red-risk lock.
- Added explicit resolve-and-reactivate state transition and `/api/handoffs/[id]/resolve-and-reactivate`.
- Added dashboard handoff controls for reactivation reason and target AI mode, defaulting to copilot.
- Added tests covering lock creation, non-unlocking paths, blocked direct reactivation/release/dismissal, explicit reactivation, and autopilot safety gating.

### What Was NOT Done

- No real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, backup provider, or real client health data was connected.
- No production-pilot launch gate was approved.
- No legal/privacy, clinical, provider/vendor, channel policy, dependency, or RLS approval artifact was supplied.
- R-405 remains open.
- R-406 remains blocked pending passing local Supabase RLS evidence.

### Verification Commands

```text
app: npm run lint -> passed
app: npm run test -> passed; 16 files, 112 tests
app: npm run release:verify -> passed; core tests 52/52, app tests 112/112, lint, production build, known R-405 only
app: npm run test:rls -> skipped; 1 file and 10 guarded tests because local Supabase evidence is still unavailable
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Continue with the user's remaining three-problem plan in order: Phase 45 should address client removal/anonymization lifecycle; Phase 46 should address WhatsApp group-message quarantine. Keep production pilot at `NO-GO` until all launch gates, R-405, and R-406 are closed with acceptable evidence.

## Phase 45 Client Removal Data Lifecycle Handoff Notes - 2026-06-01

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote `docs/PHASE_45_CLIENT_REMOVAL_DATA_LIFECYCLE_SPEC.md` before implementation.
- Added `ClientRecord.lifecycleStatus` and `removedAt`.
- Added Supabase migration `20260601010000_phase_45_client_removal_lifecycle.sql`.
- Added `/api/clients/[id]/remove` and dashboard `Remove client` action.
- Implemented removal as soft-delete/anonymization with `lifecycleStatus=removed_anonymized`.
- Removed clients are hidden from normal dashboard client lists and simulator selection.
- Removed clients are blocked from inbound simulation, manual replies, profile edits, form response save, and internal copilot tools.
- Removal redacts promptable health/profile data, phone/channel identity, rolling memory, message bodies/provenance, form response answers/submitted phone metadata, context updates, handoff text, notification text, AI decision details, risk assessment reasons, red-risk locks, and takeover state.
- Removal records a completed `deletion` data request and `client_removed_anonymized` audit event.
- Export remains available as a minimized legal/audit bundle.

### What Was NOT Done

- No hard-delete automation was added.
- No final retention duration was approved.
- No real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, backup provider, or real client health data was connected.
- No production-pilot launch gate was approved.
- R-405 remains open.
- R-406 remains blocked pending passing local Supabase RLS evidence.

### Verification Commands

```text
app: npm run lint -> passed
app: npm run test -> passed; 16 files, 114 tests
app: npm run release:verify -> passed; core tests 52/52, app tests 114/114, lint, production build, known R-405 only
app: npm run test:rls -> skipped; 1 file and 10 guarded tests because local Supabase evidence is still unavailable
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Continue with the user's remaining three-problem plan in order: Phase 46 should address WhatsApp group-message quarantine. Keep production pilot at `NO-GO` until all launch gates, R-405, and R-406 are closed with acceptable evidence.

## Phase 46 WhatsApp Group Quarantine Handoff Notes - 2026-06-01

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote `docs/PHASE_46_WHATSAPP_GROUP_QUARANTINE_SPEC.md` before completing the implementation.
- Added `InboundQuarantineRecord` and fallback state support for inbound quarantines.
- Added Supabase migration `20260601020000_phase_46_inbound_quarantine.sql`.
- Added simulator/API support for `sourceConversationType="group"` without requiring a client id.
- Group messages are quarantined before client lookup, risk classification, context assembly, provider calls, message storage, AI decisions, risk assessments, or handoffs.
- Quarantine records persist minimized metadata only and do not store raw group message text.
- Added `inbound_group_message_quarantined` audit events and scoped Supabase visibility for quarantine audit records.
- Duplicate group events remain idempotent through `processedSimulationKeys` / `processed_inbound_events`.

### What Was NOT Done

- No real WhatsApp group webhook, WhatsApp Business Cloud API, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, backup provider, or real client health data was connected.
- No production-pilot launch gate was approved.
- No WhatsApp/Telegram policy approval artifact was supplied.
- R-405 remains open.
- R-406 remains blocked pending passing local Supabase RLS evidence.

### Verification Commands

```text
app: npm run lint -> passed
app: npm run test -> passed; 16 files, 117 tests
app: npm run release:verify -> passed; core tests 52/52, app tests 117/117, lint, production build, known R-405 only
app: npm run test:rls -> skipped; 1 file and 10 guarded tests because local Supabase evidence is still unavailable
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Keep production pilot at `NO-GO` until all launch gates, R-405, and R-406 are closed with acceptable evidence. Do not connect real WhatsApp/Telegram/provider traffic until the relevant external approvals are supplied.

## Phase 47 RLS Quarantine Evidence Coverage Handoff Notes - 2026-06-01

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote `docs/PHASE_47_RLS_QUARANTINE_EVIDENCE_SPEC.md` before implementation.
- Added explicit `inbound_quarantines` coverage to `app/src/lib/supabase-rls.integration.test.ts`.
- Added RLS fixtures for same-tenant and other-tenant quarantine rows.
- Added owner/member read, outsider block, assistant block, auditor block, and cross-tenant write assertions for quarantine rows.
- Added Supabase-backed group quarantine persistence coverage: group simulation writes quarantine + processed idempotency event and does not create messages, risk assessments, AI decisions, or handoffs.

### What Was NOT Done

- R-406 was not mitigated because the suite skipped without local Supabase.
- No real WhatsApp, Telegram, provider, monitoring, secret manager, backup provider, or real client health data was connected.

### Verification Commands

```text
app: npm run lint -> passed
app: npm run test -> passed; 16 files, 117 tests
app: npm run test:rls -> skipped; 1 file and 11 guarded tests because Docker Desktop's Linux engine is unavailable
```

## Phase 48 R-405 Stable Patch Recheck Handoff Notes - 2026-06-01

Completed by: Codex

### What Was Done

- Followed `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- Added `docs/PHASE_48_R405_STABLE_PATCH_RECHECK_SPEC.md`.
- Rechecked `next@latest`: `16.2.7` with nested `postcss@8.4.31`.
- Rechecked `eslint-config-next@latest`: `16.2.7`.
- Rechecked production audit: only known moderate `next`/`postcss` findings remain.
- Did not edit dependency files because stable Next still does not bundle `postcss >= 8.5.10`.

### What Was NOT Done

- R-405 was not resolved or accepted.
- No dependency files were changed.
- No `npm audit fix --force`, canary/beta/rc, invalid override, major downgrade, provider, channel, or real-data change was made.

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Keep R-406 blocked until Docker/local Supabase is available and the expanded 11-test RLS suite passes locally. Keep R-405 open until a safe stable Next.js/PostCSS patch path exists or formal external risk acceptance is supplied.

### Final Verification After Phase 47/48 Updates

```text
app: npm run release:verify -> passed; core tests 52/52, app tests 117/117, lint, production build, known R-405 only
```

## Phase 61 Scope Guard Second Layer Handoff Notes - 2026-06-04

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote `docs/PHASE_61_SCOPE_GUARD_RAG_SECOND_LAYER_SPEC.md` before implementation.
- Added core `dietitian-ai-assistant/src/scope-guard.js` with `SCOPE_GUARD_VERSION=scope-rag-v0.1.0`, escalate-only `mergeScopeDecision`, and deterministic `applyScopeRules`.
- Added app modules: `scope-corpus.ts`, `scope-retrieval.ts`, `scope-evaluator.ts`, `scope-guard-runtime.ts`, `scope-guard-provider.ts`; wired `simulator-risk.ts` after clinical classification.
- Added Supabase migration `20260604000000_phase_61_scope_corpus.sql` for `scope_rules`, `scope_rule_chunks`, `scope_guard_evaluations` with tenant read / system write RLS.
- Added placeholder draft regulation rules (inactive until approved); operational-health corpus signals; launch-gate scope corpus evidence on `clinical_taxonomy_approval`.
- Updated continuity docs: `HANDOFF_FOR_NEXT_CODEX.md`, `PLAN.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `README.md`, `PROJECT_PLAN.md`, pilot evidence/gate docs, `docs/RISK_REGISTER.md` (R-310).

### What Was NOT Done

- Real Gemini/embedding or external LLM scope evaluator (disconnected; requires `clinical_taxonomy_approval` + `MANU_ALLOW_REAL_SCOPE_GUARD=true`).
- Approved production regulation corpus load (placeholder draft only).
- Phase 61 `scope_*` RLS re-run when local Supabase was unavailable.
- No launch gate approval; R-405 unchanged; production pilot remains `NO-GO`.

### Verification Commands

```text
dietitian-ai-assistant: npm test -> 112/112 passed
app: npm test -> 150/150 passed
app: npm run lint -> passed
app: npm run release:verify -> passed; only known R-405 findings
```

### Next Correct Step For Codex

Re-run `npm run test:rls` when Docker/local Supabase is available after applying Phase 61 migration. Load approved regulation corpus only after qualified dietitian clinical taxonomy sign-off. Keep real embedding/LLM disconnected until provider/vendor and clinical gates approve health-data egress.

## Phase 63 Production Pilot GO Rebaseline Handoff Notes - 2026-06-04

Completed by: Codex

### What Was Done

- Added `docs/PHASE_63_PRODUCTION_PILOT_GO_REBASELINE_SPEC.md`.
- Rebaselined production-pilot planning to WhatsApp-first, Gemini-only, up to 100 dietitians, and 50+ clients per dietitian.
- Recorded user-supplied dietitian/client forms as gated inputs requiring schema, privacy, prompt-allowlist, clinical, versioning, and migration review.
- Recorded user-supplied official health-regulation PDFs as gated inputs requiring source metadata, checksums, extraction QA, page/section references, approved derived rules, corpus versioning, and corpus golden-case tests before active routing.
- Updated continuity, pilot readiness, gate, final readiness, and risk documentation to keep production pilot `NO-GO` until the new evidence is supplied and accepted.

### What Was NOT Done

- No runtime code, schema, migration, dependency, provider, channel, monitoring, secret manager, approval, R-405 acceptance, or real-data change was made.
- No official PDF corpus, user form schema, legal/privacy artifact, clinical artifact, or launch-gate approval artifact was supplied.

### Verification Commands

```text
app: npm run release:verify -> passed; core tests 114/114, app tests 150/150, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Phase 64 completed the structured launch-gate evidence engine. Implement the official PDF ingestion/corpus QA path next, then user-supplied form hardening after the user provides the required artifacts. Keep real WhatsApp/Gemini/client data disconnected until gates are approved.

## Phase 64 Structured Launch Gate Evidence Engine Handoff Notes - 2026-06-04

Completed by: Codex

### What Was Done

- Added `docs/PHASE_64_STRUCTURED_LAUNCH_GATE_EVIDENCE_ENGINE_SPEC.md`.
- Added typed structured launch-gate evidence records and `evaluateProductionPilotLaunchGateEvidence`.
- Expanded legal/privacy and clinical required evidence with Phase 63 form and official PDF corpus requirements.
- Wired operational health to consume structured evidence.
- Hardened real scope-guard provider allowance: legacy approved id arrays alone cannot enable real scope-guard egress.
- Added tests for default blocked gates, partial evidence, unknown gate ids, stale/conditional/unsanitized evidence, full structured evidence, operational health structured evidence, and scope-guard provider gating.

### What Was NOT Done

- No persistence table or admin UI for evidence entry.
- No external approval artifact was supplied.
- No gate was closed.
- No official PDF ingestion, user form schema implementation, real provider, real channel, monitoring, secret manager, approval, R-405 acceptance, or real-data change was made.

### Verification Commands

```text
app: npm test -- launch-gates operational-health scope-guard-provider scope-guard-runtime -> passed; app tests 158/158
app: npm run release:verify -> passed; core tests 114/114, app tests 158/158, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Phase 65 completed the official regulation PDF corpus QA foundation. Keep corpus activation blocked until the user supplies official PDFs and structured legal/clinical approval evidence.

## Phase 65 Official Regulation PDF Corpus QA Foundation Handoff Notes - 2026-06-04

Completed by: Codex

### What Was Done

- Added `docs/PHASE_65_OFFICIAL_REGULATION_PDF_CORPUS_QA_SPEC.md`.
- Added `app/src/lib/official-regulation-corpus.ts`.
- Added typed official PDF source metadata, page extraction, page/section reference, derived rule draft, and corpus golden-case contracts.
- Added fail-closed QA evaluation for missing metadata, invalid checksums, missing/failed page extraction, invalid section refs, unmapped derived-rule refs, and golden cases that reference unknown rules.
- Added draft scope-rule conversion only after QA passes; PDF-derived rules remain `draft` and inactive.
- Added clinical launch-gate evidence candidate construction that stays `draft` if QA fails.
- Extended `ScopeRuleRecord` with optional source refs for PDF-derived draft rules.

### What Was NOT Done

- No real PDF parser or OCR pipeline was connected.
- No raw PDF text or real official PDF file was stored in the repo.
- No Supabase persistence table or admin UI was added for corpus intake.
- No PDF corpus was approved.
- No launch gate was closed.
- No real provider, channel, monitoring, secret manager, approval, R-405 acceptance, or real-data path was connected.

### Verification Commands

```text
app: npm test -- official-regulation-corpus scope-corpus launch-gates -> passed; app tests 166/166
app: npm run release:verify -> passed; core tests 114/114, app tests 166/166, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Phase 66 completed the product communication covenant lock, Phase 67 completed approved source answerability, and Phase 68 completed green intent taxonomy. Next correct step is Phase 69 Direct 5,000 Client Scale Foundation. Keep official corpus activation blocked until the user supplies official PDFs and structured legal/clinical launch-gate evidence approves the corpus.

## Phase 66 Product Communication Covenant Lock Handoff Notes - 2026-06-05

Completed by: Codex

### What Was Done

- Added `docs/PHASE_66_PRODUCT_COMMUNICATION_COVENANT_LOCK_SPEC.md`.
- Added core `PRODUCT_COMMUNICATION_COVENANT_VERSION` and multilingual `detectProductCommunicationCovenantIssues`.
- Added a PromptContext covenant system instruction.
- Guarded provider output, mock provider output, and send-time draft approval against client-facing AI self-disclosure, AI limitation disclaimers, and doctor/dietitian/professional referral language.
- Changed yellow/red acknowledgement text to internal-only handling and blocked yellow/red AI drafts from becoming client-facing AI sends.
- Added tests proving covenant-violating green output is blocked and yellow/red paths do not create client-facing AI replies.

### What Was NOT Done

- No real Gemini, WhatsApp, Telegram, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected.
- No production pilot GO decision was made; production pilot remains `NO-GO`.
- No approved-source answerability, green-max taxonomy, 5,000-client scale rehearsal, user-supplied form hardening, official PDF ingestion, or external gate closure was implemented.

### Verification Commands

```text
core: npm test -> passed; core tests 116/116
app: npm test -- ai-provider simulator app-state-store -> passed; app tests 170/170
app: npm run release:verify -> passed; core tests 116/116, app tests 170/170, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Phase 67 completed the approved source answerability engine, and Phase 68 completed green intent taxonomy. Next correct step is Phase 69 Direct 5,000 Client Scale Foundation. Keep all real providers/channels, monitoring, secret manager, and real client health data disconnected.

## Phase 67 Approved Source Answerability Engine Handoff Notes - 2026-06-05

Completed by: Codex

### What Was Done

- Added `docs/PHASE_67_APPROVED_SOURCE_ANSWERABILITY_ENGINE_SPEC.md`.
- Added core `APPROVED_SOURCE_ANSWERABILITY_VERSION` and `evaluateApprovedSourceAnswerability`.
- Added pre-provider green answerability gating in `handleInboundMessage`.
- Recorded answerability evidence in `contextManifest.answerability`.
- Treated active diet plan, prompt-allowed form summary, dietitian context updates, dietitian manual messages, pinned notes, allergies, and restricted foods as approved source categories.
- Excluded AI-generated messages from source authority.
- Added active diet plan field fallback when `dietPlan.summary` is empty.
- Added core and app simulator tests for source-backed green, missing source, AI-only source rejection, and dietitian manual source support.

### What Was NOT Done

- No Phase 69 direct 5,000-client scale rehearsal was implemented.
- No real Gemini, WhatsApp, Telegram, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected.
- No production pilot GO decision was made; production pilot remains `NO-GO`.

### Verification Commands

```text
core: npm test -> passed; core tests 120/120
app: npm test -- simulator -> passed; app tests 171/171
app: npm run release:verify -> passed; core tests 120/120, app tests 171/171, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Phase 68 was implemented after this handoff note. Next correct step is Phase 69 Direct 5,000 Client Scale Foundation from `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`. Preserve Phase 66 covenant, Phase 67 approved-source answerability, and Phase 68 green intent taxonomy as hard gates. Keep all real providers/channels, monitoring, secret manager, and real client health data disconnected.

## Phase 68 Green Maximization Intent Taxonomy Handoff Notes - 2026-06-05

Completed by: Codex

### What Was Done

- Added `docs/PHASE_68_GREEN_MAXIMIZATION_INTENT_TAXONOMY_SPEC.md`.
- Added core `GREEN_INTENT_TAXONOMY_VERSION` and `evaluateGreenIntentTaxonomy`.
- Added pre-provider green intent taxonomy evaluation after approved-source answerability in `handleInboundMessage`.
- Recorded green intent evidence in `contextManifest.greenIntent`.
- Classified allowed green families such as plan lookup, allowed substitution, logistics, reminders, behavior support, progress logging, general education, context recap, and low-risk clarification.
- Blocked green-looking sensitive families such as calorie/macro/portion target changes, medication/supplement decisions, lab/symptom interpretation, active-plan conflicts, and emergency/sensitive contexts.
- Preserved monotonic safety: yellow/red decisions receive `not_applicable_non_green` metadata and are not downgraded.

### What Was NOT Done

- No Phase 69 direct 5,000-client scale rehearsal was implemented.
- No user-supplied form hardening, official PDF ingestion, Gemini, WhatsApp, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected.
- No production pilot GO decision was made; production pilot remains `NO-GO`.

### Verification Commands

```text
core: npm test -> passed; core tests 122/122
app: npm test -- simulator -> passed; app tests 171/171
app: npm run release:verify -> passed; core tests 122/122, app tests 171/171, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Phase 69 was implemented after this handoff note. Next correct step is Phase 70 User-Supplied Form Hardening after the user supplies final dietitian/client forms. Preserve Phase 66 covenant, Phase 67 approved-source answerability, Phase 68 green intent taxonomy, and Phase 69 scale readiness evidence as hard gates. Keep all real providers/channels, monitoring, secret manager, and real client health data disconnected.

## Phase 69 Direct 5,000 Client Scale Foundation Handoff Notes - 2026-06-05

Completed by: Codex

### What Was Done

- Added `docs/PHASE_69_DIRECT_5000_CLIENT_SCALE_FOUNDATION_SPEC.md`.
- Added `app/src/lib/direct-pilot-scale-readiness.ts`.
- Added synthetic direct-pilot fixture generation for 100 dietitians x 50 clients (5,000 clients).
- Added cursor pagination helper with limit caps and invalid cursor checks.
- Added direct-pilot scale readiness evaluation for fixture count, Phase 69 read contracts, and load/backpressure/idempotency evidence.
- Marked dashboard state, internal copilot tools, client create scaffold, and client AI/profile patch read contracts as `phase69_paginated_contract`.
- Added aggregate direct-pilot scale readiness fields to operational health without raw client/message/channel/provider content.
- Added app tests for fixture counts, active-client percentage, pagination windows, invalid inputs, read-contract status, readiness pass/fail, and aggregate-only operational health.

### What Was NOT Done

- No production UI pagination rewrite was implemented.
- No production Supabase migration was added.
- No real load-testing service, webhook replay, Gemini, WhatsApp, Telegram, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected.
- No production pilot GO decision was made; production pilot remains `NO-GO`.

### Verification Commands

```text
core: npm test -> passed; core tests 122/122
app: npm test -> passed; app tests 176/176
app: npm run release:verify -> passed; core tests 122/122, app tests 176/176, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Implement Phase 70 User-Supplied Form Hardening only after the user supplies final dietitian/client forms. If forms are not supplied, stop and ask for them instead of inventing production form schemas. Keep all real providers/channels, monitoring, secret manager, and real client health data disconnected.

## P85-IF Remediation Post-Closure Handoff - 2026-07-11

Latest baseline: P85-IF R1-R6 remediation has been post-closure audited and fixed. New evidence lives in `docs/PHASE_85_IF_REMEDIATION_POST_CLOSURE_AUDIT_EVIDENCE.md`, `docs/PHASE_85_IF_R1_PERSISTENCE_TENANT_INTEGRITY_EVIDENCE.md`, `docs/PHASE_85_IF_R2_RETRIEVAL_AUTHORITY_TEMPORAL_EVIDENCE.md`, and `docs/PHASE_85_IF_R3_ATOMIC_AI_ACTIVATION_RACE_EVIDENCE.md`.

Important implementation facts:

- R1 now has append-only tenant-composite constraints for message provenance and actor bindings.
- R2 now derives structured baselines from app state and resolves only against the target panel revision.
- R3 now uses deterministic client-before-conversation lock ordering for expected conversation revision checks.
- R6 export leak detection now runs inside `buildClientScopedExport`.
- R4/R5 were reviewed and had no new code findings.

Verification passed targeted app/core tests, local Supabase reset, local RLS 30/30, lint, build, full app 828 passed / 4 skipped, core 234/234, channel replay, and unified production-scale rehearsal. Do not rewrite the historical R1/R2 combined commit; the current post-closure commit is the honest traceability boundary. Stage 4B planning is complete and approved implementation is next. Production pilot remains `NO-GO`; R-405 remains open; real providers/channels/health-data paths remain closed.

## Phase 85 Stage 4A Post-P85-IF Compatibility Remediation - 2026-07-11

Completed by: Codex

What was done:

- Added `docs/PHASE_85_STAGE_4A_POST_IF_REMEDIATION_EVIDENCE.md`.
- Updated Stage 4A AI Asistan Kontrolu so active AI state no longer uses the general client PATCH path; it calls atomic activation with expected conversation/client context revisions.
- Kept passive AI state as the safe direct client patch path.
- Kept manual takeover start on the existing safe mutation path, but release now uses `/api/clients/[id]/release-takeover`.
- Added active human-control session visibility and mismatch fail-closed messaging in the control panel.
- Added a minimal structured-update notification bridge: target-panel navigation plus `/api/notifications/[id]/resolve-structured-update`.
- Replaced raw structured context-intake tab ids with readable client-panel labels and navigation.

What was not done:

- No migration was added.
- No Stage 4B full notification center/filtering/grouping/mobile redesign was implemented.
- No real WhatsApp, Telegram, Gemini/provider, live billing, monitoring, backup, secret manager, or real health-data path was enabled.
- No production pilot GO decision was made; production pilot remains `NO-GO`; R-405 remains open.

Next correct work: implement the approved Phase 85 Stage 4B Uyari ve Bildirimler plan on top of this compatibility baseline.

## Approved Phase 85 Stage 4B Handoff - 2026-07-11

Canonical implementation contract: `docs/PHASE_85_STAGE_4B_UYARI_VE_BILDIRIMLER_ACTION_PLAN.md`.

Implementation must begin at the plan's Phase 1 after re-verifying branch `codex/phase-85-interstage-clinical-memory`, baseline commit `5048e22`, and a clean worktree. Do not redesign the plan during implementation. Key locks are: no alerts table; red-over-yellow projection; no raw clinical content in list DTOs; per-actor notification receipts; auditor zero client visibility; assistant read-only assigned scope; direct AI activation atomically closes red; Devirler becomes Uyarilar; header bell opens full Bildirimler; current Gorusme remains the Stage 4B target; Stage 4B-2 replaces it with Mesajlasma before Stage 4C.

Stage 4B is one implementation stage, one evidence pack, and one commit. Production pilot remains `NO-GO`; R-405 remains open; all real provider/channel/health-data and production-operations paths remain closed.

## Approved Phase 85 Stage 4B-2 Phase 0 Handoff - 2026-07-12

Canonical action plan: `docs/PHASE_85_STAGE_4B_2_MESAJLASMA_ACTION_PLAN.md`.

Phase 0 documentation evidence: `docs/PHASE_85_STAGE_4B_2_PHASE_0_DOCUMENTATION_EVIDENCE.md`.

Stage 4B-2 Phases 0-11 and remediation R0-R6 are historical implementation evidence; R7 is the current closure authority. Runtime spec: `docs/PHASE_85_STAGE_4B_2_MESAJLASMA_SPEC.md`. Closure evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R7_EVIDENCE.md`. **Next:** Stage 4B-3. Production pilot remains `NO-GO`; R-405 remains open; real provider/channel/health-data, live billing, monitoring, backup, and secret-manager paths remain disabled.

## Approved Phase 85 Stage 4B-2 Phase 1 Handoff - 2026-07-12

Phase 1 is complete. Evidence: `docs/PHASE_85_STAGE_4B_2_PHASE_1_DOMAIN_DTO_AUTHORIZATION_EVIDENCE.md`. The new pure contract/projection boundary is in `app/src/lib/phase-85-stage-4b2-contracts.ts` and `app/src/lib/phase-85-stage-4b2-api.ts`, with assignment domain types in `app/src/lib/types.ts` and focused tests in `app/src/lib/phase-85-stage-4b2-api.test.ts`.

The next operator must begin at Phase 2: append-only conversation receipt migration, deterministic sequence backfill, actor-owned monotonic marker RPC, and RLS. Do not add routes, UI, message mutations, provider/channel calls, or full-state messaging responses while implementing Phase 2. Preserve assistant assigned transcript/read-marker-only access, viewer read-only access, auditor zero visibility, production `NO-GO`, R-405 open status, and all real integration shutdowns.
## Phase 85 Stage 4B-2 Post-Closure Remediation R0 - 2026-07-12

Historical R0 checkpoint: baseline branch `codex/phase-85-interstage-clinical-memory`, baseline `3d67ba5`, and documentation-only evidence at `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R0_EVIDENCE.md`. R1-R7 subsequently closed. This is not an active handoff; Stage 4B-3 is current. Preserve production `NO-GO`, R-405 open, append-only migrations, and all real provider/channel/health-data shutdowns.

## Phase 85 Stage 4B-2 Post-Closure Remediation R1 - 2026-07-12

Historical R1 checkpoint: the domain/DTO/permission contract completed in `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R1_EVIDENCE.md`. R2-R7 subsequently closed. This is not an active handoff; Stage 4B-3 is current. Preserve production `NO-GO`, R-405 open, append-only migrations, and all real provider/channel/health-data shutdowns.

## Phase 85 Stage 4B-2 Post-Closure Remediation R2 - 2026-07-12

Historical R2 checkpoint: implementation completed in `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R2_EVIDENCE.md` while RLS was then unverified. R3-R7 and zero-skip RLS subsequently closed. This is not an active handoff; Stage 4B-3 is current.
## Phase 85 Stage 4B-2 Post-Closure Remediation R3 - 2026-07-12

R3 is complete and committed as the atomic authorized mutation boundary. Continue with R4 only after verifying the R3 evidence and a clean worktree. R3 migration: `app/supabase/migrations/20260712180000_phase_85_stage_4b2_r3_atomic_mutations.sql`; evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R3_EVIDENCE.md`. Preserve production `NO-GO`, R-405 open, append-only migrations, and all real provider/channel/health-data shutdowns.
## Phase 85 Stage 4B-2 Post-Closure Remediation R4 - 2026-07-12

R4 is implemented locally. Verify `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R4_EVIDENCE.md` and the clean commit before starting R5. R4 changed no migration; explicit deep-links survive incomplete legacy cache, unread badges use API aggregates, and tablet split UI is covered by four visual projects. Full app timed out and RLS remains Docker-blocked. Preserve production `NO-GO`, R-405 open, append-only migrations, and all real integration shutdowns.
## Phase 85 Stage 4B-2 Post-Closure Remediation R5 - 2026-07-13

Historical R5 checkpoint: full app, core, 79G scale, channel replay, bounded 10k messaging scale, accessibility, lint, and build passed while RLS was then skipped. R6/R7 subsequently supplied zero-skip RLS and SQL buffer closure. This is not an active handoff; Stage 4B-3 is current.

## Phase 85 Stage 4B-2 Post-Closure Remediation R6 - 2026-07-13

R6 was implemented and independently executed. Its original environment block was resolved by an actual local Supabase reset, RLS 35/35 with zero skips, and SQL buffer capture. R7 is complete; evidence: `docs/PHASE_85_STAGE_4B_2_POST_CLOSURE_REMEDIATION_PHASE_R7_EVIDENCE.md`. Preserve production `NO-GO`, R-405 open, append-only migrations, and all real integration shutdowns.
