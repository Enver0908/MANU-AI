# MANU-AI Next Phase Execution Plan

## Current Position

MANU-AI is in pilot-foundation mode. The local SaaS/PWA prototype, Supabase-backed state, fallback store, simulator, risk assessment persistence, core safety tests, RLS guard, controlled API errors, expanded dashboard visual smoke checks, voice-profile workflow, dynamic client forms, read-only internal dietitian copilot, and dietitian-entered critical context updates exist.

Real WhatsApp, Telegram, Gemini/external LLM, production client-messaging email, push, monitoring, secret manager, and real client health data remain disconnected. Hosted sandbox auth email is limited to Supabase magic links through the verified Phase 84J Resend custom-SMTP setup.

The most recent execution layers after the 13-phase completion roadmap are Phase 76B expanded chat form safety updates, Phase 76A dietitian chat form update proposals, Phase 75 Gemini provider gate, Phase 74 data lifecycle DSAR policy, Phase 73 health regulation calibration, Phase 72 regulation permission graph, Phase 71 Turkiye official health source ingestion, Phase 70 user-supplied form hardening, Phase 43 multilingual language support, Phase 44 red-risk reactivation lock, Phase 45 client removal data lifecycle, Phase 46 WhatsApp group quarantine, Phase 47 RLS quarantine evidence coverage, Phase 48 R-405 stable patch recheck, Phase 49 safety/orchestration hardening, Phase 50 production Supabase hardening, Phase 51 transactional RPC coverage, Phase 52 integration test coverage, Phase 53 scale/broad read contracts, Phase 54 R-405/launch-gate recheck, Phase 55 audit remediation safety boundary, Phase 56 clinical safety second-layer local evidence, Phase 57 yellow-risk hold/draft refresh, Phase 58 dietitian client language control, Phase 59 architecture review remediation, Phase 60 audit remediation, Phase 61 scope guard (RAG + LLM) second layer mock-first, Phase 62 architecture review remediation wave 2, Phase 63 production pilot GO rebaseline, Phase 64 structured launch-gate evidence engine, Phase 65 official regulation PDF corpus QA foundation, Phase 66 product communication covenant lock, Phase 67 approved source answerability engine, Phase 68 green maximization intent taxonomy, and Phase 69 direct 5,000 client scale foundation. Phase 76B expands the reviewed proposal path to Phase 70 clinical/safety form flags, editable proposal rows, supported health-profile mirrors, and manual-control warnings while keeping AI active/passive, mode, channel permission, red/yellow lock resolution, and autopilot/reactivation outside chat mutation. Phase 65 adds a typed QA foundation so user-supplied official PDFs must have source metadata, checksums, page extraction evidence, page/section references, derived rule drafts, corpus version, and synthetic golden cases before PDF-derived scope rules can become draft rules. Phase 71 adds the user-supplied 14-source Turkiye official source manifest and fail-closed artifact intake into that QA contract without approving any corpus. Phase 66 locks client-facing AI communication locally: AI self-disclosure, AI limitation disclaimers, doctor/dietitian/professional referral language, yellow/red AI sends, and non-green draft approval are blocked before client-facing send. Phase 67 gates green provider calls/sends on approved source support and excludes AI-generated messages from source authority. Phase 68 records green intent taxonomy evidence after answerability and blocks green-looking sensitive intent before provider generation without downgrading yellow/red decisions. Phase 69 adds synthetic 100 dietitian x 50 client scale evidence, cursor pagination helpers, Phase 69 read contracts, and aggregate operational-health scale signals. The post-Phase 65 strategic completion plan is now `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`: production pilot is direct 100 dietitians x 50 clients (minimum 5,000 clients), no small production ring, green maximization is source-backed, and client-facing output must never disclose AI identity or refer the client to a doctor/dietitian/professional. The production-pilot decision remains `NO-GO`: all eight launch gates remain open and R-405 remains open. R-406 is now mitigated in the local prototype after Docker Desktop/local Supabase was started, the Phase 50 migration was applied, and `npm run test:rls` passed with 19/19 tests on 2026-06-02. Draft review, form response, client context update, handoff status, and red-risk reactivation now use transactional RPC commits locally; remaining broad reads are classified in a test-covered contract, while client removal/anonymization bulk redaction and external approval intake remain future production hardening work. R-310 is partially mitigated locally by deterministic second-layer evidence, Phase 57 yellow supervision, Phase 59 glucose/symptom hardening, Phase 61 escalate-only scope guard (default no-op until approved corpus), Phase 65 corpus QA foundation, Phase 66 covenant send blocking, Phase 67 source answerability, and Phase 68 green intent taxonomy, but qualified dietitian approval, official PDF corpus approval, and the clinical taxonomy launch gate remain open.

Current override after Phase 84I live onboarding verification (2026-07-03): Phase 84I addresses the review gaps in auth callback cookie preservation, token-hash OTP callback support, admin callback URL separation, admin-host routing coverage, and duplicate onboarding claim recovery. Repo-local verification passed: token-hash auth/onboarding tests 16/16 and build; earlier Phase 84/remediation targeted tests 41/41, visual tests 36/36, and release verify core 225/225 + app 709 passed / 4 skipped remain the baseline. VPS sandbox onboarding/dashboard verification passed through generated token-hash fallback: authenticated status, successful claim, owner membership/profile creation, dashboard 200, and idempotent repeat claim. Phase 84J later completed real custom-SMTP email dashboard verification. `npm run test:rls` skipped 21/21, so current RLS re-run remains pending. Production pilot remains `NO-GO`.

Current override after Phase 84J custom SMTP completion (2026-07-03): Phase 84J enabled Resend custom SMTP after Porkbun DNS verification, added `/api/auth/session-from-fragment` and a no-store `/auth/callback` fragment bridge for Supabase implicit-flow email links, and verified a real inbox magic-link click reaching `https://siriusai.store/dashboard`. Targeted auth/session tests 7/7 and production builds passed locally and on VPS. R-425 is mitigated in the hosted sandbox path. Production pilot remains `NO-GO`; external production prerequisites, R-405, and current RLS re-run remain open.

Current override after Phase 85A frontend redesign scope lock (2026-07-07): `docs/PHASE_85_FRONTEND_REDESIGN_AND_DESIGN_SYSTEM_SPEC.md` is the canonical redesign plan. The user-approved order is design system -> public website/onboarding -> dashboard/PWA. Locked direction: SiriusAI warm clinical SaaS, editorial off-black/plum/sage/warm palette, Fraunces + Geist Sans, spacious public layout, compact dashboard layout, restrained surface language, and no reuse of the previous visual design as a reference. Phase 85A changed documentation only. Next step is Phase 85B design tokens/font foundation after explicit user approval. Production pilot remains `NO-GO`; R-405 and current RLS re-run remain open.

Current override after Phase 85B design tokens/font foundation (2026-07-07): Fraunces display + Geist Sans/Mono are wired through `next/font/google`; Phase 85 CSS/Tailwind tokens are exposed for paper, surface, ink, primary plum, hover plum, soft plum, sage, warm accent, borders, and focus; UI token tests assert the approved palette. This is foundation-only. Component foundation, public website redesign, and dashboard/PWA redesign require separate user-approved plans. Production pilot remains `NO-GO`; R-405 and current RLS re-run remain open.

Current Phase 85 staging update (2026-07-10): Stages 1-3 and Stage 4A are complete. The mandatory Phase 85 Interstage Foundation (`P85-IF`) is inserted between Stage 4A and Stage 4B and is canonically planned in `docs/PHASE_85_INTERSTAGE_TRUSTED_CLINICAL_COMMUNICATION_MEMORY_PLAN.md`. P85-IF-A added `docs/PHASE_85_INTERSTAGE_TRUSTED_CLINICAL_COMMUNICATION_MEMORY_SPEC.md` as the canonical provider contract, threat model, state-machine, prompt-authority, and Stage 4B boundary implementation contract. P85-IF-A is complete, runtime implementation has not started, and P85-IF-B is the next operator action. After P85-IF-I closure, execution returns to Stage 4B Uyari ve Bildirimler, followed by Stage 4C, Stage 4D, Stage 5, Stage 6, and Stage 7.

Current Phase 85 Stage 2 update (2026-07-07): shared UI component system foundation is complete. Approved `plum`, `sage`, and `warm` tones are available; legacy `emerald`/`amber` primitive calls map to the new accents; form, card, tab, segmented-control, table, dialog, sheet, app-shell, alert, empty-state, and loading primitives are aligned to the Phase 85 palette. Broad public/commercial pages and dashboard workflows remain pending. Production pilot remains `NO-GO`; R-405 and current RLS re-run remain open.

Current Phase 85 Stage 3 implementation/deploy update (2026-07-07): `docs/PHASE_85_STAGE_3_PUBLIC_COMMERCIAL_ENTRY_ACTION_PLAN.md` is implemented for public website and commercial entry surfaces and deployed to the hosted sandbox as release `phase85-stage3-redesign-20260707225306` on `https://siriusai.store`. Stage 3 remains invite-led, not open self-serve signup: contact request -> admin review -> admin invite code -> approved email + invite code -> sandbox checkout -> magic-link -> onboarding claim -> dashboard/PWA. Locked navbar: `SiriusAI | Nasil calisir | Guvenlik | Mobil | Iletisim | Giris yap | Davet koduyla basla`. The user-provided `public-website-redesign.zip` visual direction was adapted without copying mock API routes, the runtime palette was corrected to the user's broken-white + purple system, and all Phase 83/84 API/auth/entitlement/onboarding/sandbox billing contracts remain preserved. Production pilot remains `NO-GO`; R-405 and current RLS re-run remain open.

Current Phase 85 Stage 4A update (2026-07-08): Stage 4A.1 through Stage 4A.4 are implemented; Stage 4A Danisan Kontrol Paneli is complete. Verification for Stage 4A.4: lint 0 errors (3 pre-existing warnings), helper tests 4/4, full app suite 734 passed / 4 skipped, build passed, Playwright visual 36/36. P85-IF planning later superseded Stage 4B as the immediate next action; P85-IF-A is now complete and P85-IF-B is next, with Stage 4B resuming after P85-IF closure. Production pilot remains `NO-GO`; R-405 and current RLS re-run remain open.

Superseded Phase 84D override: Phase 84D customer auth foundation completed on 2026-07-02.

Superseded override after Phase 84C lead and contact flow: Phase 84C added `commercial_leads`, public lead API, marketing contact form, and admin lead operations on the token console. Phase 84D-84J later completed customer auth, onboarding claim, hosted dashboard verification, and real custom-SMTP email verification. Production pilot remains `NO-GO`. `npm run test:rls` skipped 21/21 (R-406 pending) unless local Supabase is running with the new migration applied.

Superseded Phase 84B override: Phase 84B professional public website completed on 2026-07-02.

Superseded override after Phase 83F hosted Supabase recovery diagnostics: Phase 83 track closed locally, with a 2026-07-02 admin-ops recovery pass added after Phase 83H/final remediation. `/api/commercial/admin/health` and `/commercial-admin` provide sanitized diagnostics for unreachable Supabase project hosts, missing migrations, invalid service-role keys, incomplete admin env, and dev fallback mismatch. This did not add a fallback admin store or approve production billing. Phase 84A-84J later completed hosted commercial sandbox onboarding, admin, and real custom-SMTP email verification. Production pilot remains `NO-GO`; next work is external launch-gate/R-405/RLS prerequisites outside Phase 84.

Superseded Phase 83F override: Phase 83F commercial admin completed on 2026-07-01.

Superseded Phase 83E-6 override: Phase 83E-6 completed loading skeletons, enhanced empty/error/session-recovery states, keyboard focus rings, skip link, semantic dashboard structure, and PWA banner a11y on 2026-07-01 via `app/src/lib/phase-83e6-states-polish.ts` + `app/src/components/dashboard/state-primitives.tsx`. Next phase was 83E remediation.

Superseded Phase 83E-5 override: Phase 83E-5 deepened mobile ergonomics on 2026-07-01. Next sub-phase was 83E-6.

Superseded Phase 83E-4 override: Phase 83E-4 recomposed the ~3,189-line monolithic `app/src/components/dashboard-app.tsx` into domain panel modules under `app/src/components/dashboard/` on 2026-07-01. Next sub-phase was 83E-5.

Superseded Phase 83E-3 override: Phase 83E-3 rebuilt the authenticated shell mobile-first on 2026-07-01 — mobile bottom navigation + desktop-only sidebar, a header with subscription status/install state/safe sign-out, and all six fail-closed gated-state screens driven by server-resolved entitlement via `app/src/lib/phase-83e3-app-shell.ts` (unit tested 4/4). Next sub-phase was 83E-4.

Superseded Phase 83E-2 override: Phase 83E-2 rebuilt the public landing with a `Satın al` CTA and added a gated purchase flow (invite check → Stripe checkout), waitlist/contact for unapproved users, and success/cancel onboarding pages on 2026-07-01, backed by fail-closed `app/src/lib/phase-83e2-purchase-ux.ts` (unit tested 8/8). Next sub-phase was 83E-3.

Superseded Phase 83E-1 override: Phase 83E-1 added clinical SaaS design tokens in `app/src/app/globals.css` and reusable primitives under `app/src/components/ui/` on 2026-07-01. Targeted design-system unit test passed (6/6). Next sub-phase was 83E-2.

Superseded Phase 83D override: Phase 83D added gated `/app-install`, subscriber-only SW registration via `pwa-subscriber-shell.tsx`, no-PHI-cache `public/sw.js`, and `/api/commercial/mobile-install-audit` on 2026-07-01. Targeted Phase 83D unit tests passed (8/8); production build passed. Next sub-phase was 83E.

Superseded Phase 83C override: Phase 83C added sandbox Stripe checkout/webhook/billing-portal routes and `phase-83c-stripe-billing-gate.ts` on 2026-07-01. `MANU_ALLOW_STRIPE_SANDBOX=true` with `sk_test_` keys required; live keys blocked. Targeted Phase 83C unit tests passed (9/9). Next sub-phase was 83D.

Superseded Phase 83B override: Phase 83B added Supabase commercial tables and `phase-83b-commercial-entitlement-model.ts` on 2026-07-01.

Superseded Phase 83A override: Phase 83A created `docs/PHASE_83_COMMERCIAL_PWA_AND_FRONTEND_RELAUNCH_SPEC.md` on 2026-07-01. Locked decisions: PWA-only mobile v1, invite + Stripe sandbox, public intro with gated purchase/dashboard/install, full dashboard parity on one shared surface. No runtime behavior changed. Next sub-phase was 83B.

Superseded Phase 82G override: Phase 82 final external readiness closure is closed across 82A-82G as a fail-closed repo-local project-completion layer, not a production launch. Baseline final outcome is `NO_GO_EXTERNAL_PREREQUISITES_OPEN`; Phase 82G records `repoLocalClosureComplete: true` with verification `blocked` because current local RLS evidence is skipped/pending. Targeted Phase 82 tests passed (5 files, 31/31). All eight launch gates remain open; R-405 remains open; R-406 current re-run remains pending. Production pilot remains `NO-GO`. No further repo-local Phase 82 sub-phases remain.

Superseded Phase 82F override: Phase 82 final external readiness closure was complete across 82A-82F before Phase 82G verification closure. The current Phase 82G override above is canonical.

Phase 80D override: R-405 remains open with `no_safe_stable_patch` on 2026-06-30.

Phase 79 override: Phase 79A-79I completed production-scale hardening, full 100x50 rehearsal closure, and post-review remediation.

Phase 77AA-77AI remediation note, 2026-06-28: review findings for the mock/gated WhatsApp adapter track were closed. Supabase rollback controls are now persisted and loaded, malformed numeric WhatsApp timestamps fail closed without throwing, mock delivery policy types are aligned, full 100x50 channel replay is isolated to `npm run rehearse:channel:replay`, and Supabase channel delivery records are removed during client anonymization/removal.

Phase 78 dependency/R-405 note, 2026-06-29: `docs/PHASE_78_DEPENDENCY_R405_CLOSURE_SPEC.md` records the latest no-patch closure. R-405 and `dependency_audit_clearance` remain open; production pilot remains `NO-GO`.

Phase 79 production-scale closure note, 2026-06-29: `docs/PHASE_79_PRODUCTION_SCALE_HARDENING_AND_FULL_100X50_REHEARSAL_SPEC.md` records Phase 79A-79I completion. Runtime hardening covers `/api/app-state?view=windowed`, fail-closed notification windows, scoped client create/patch responses, bounded internal copilot, lifecycle redaction evidence, current RLS evidence status, unified rehearsal metrics, and continuity/risk/gate closure. It does not connect real WhatsApp/Gemini/provider paths, close gates, process real client health data, or resolve R-405.

## Post-Phase 65 Strategic Completion Plan - Added 2026-06-05

Canonical plan: `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`.

Detailed Phase 77 implementation plan: `docs/PHASE_77_MASTER_IMPLEMENTATION_PLAN.md`.

Locked decisions:

- Production pilot target is direct 100 dietitians with 50 clients each; no small production ring.
- Pre-production synthetic rehearsal is allowed and required, but it is not production pilot.
- Client-facing AI output must never say it is AI or refer the client to a doctor, dietitian, professional, or "medical advice" disclaimer.
- Yellow/red paths must not send client-facing AI boundary replies.
- Green maximization must come from approved sources: active forms, active diet plan, prompt-allowed fields, pinned notes, dietitian context updates, and dietitian manual messages.
- AI-generated messages are not clinical ground truth.
- Mixed-intent messages fail closed; no partial green reply is sent when any segment is yellow/red.

Next implementation order:

1. Plan Phase 85 Stage 4B Uyari ve Bildirimler after explicit user approval. Phase 85 is frontend/design-only and does not approve production pilot launch.
2. Continue Phase 85 through Stage 4C, Stage 4D, Stage 5 dashboard/PWA shell, Stage 6 dashboard workflows, and Stage 7 QA/closure only after each user-approved stage plan and implementation closure.
3. External launch-gate / R-405 / current RLS closure prerequisites remain required for production readiness. Phase 83A-83H, Phase 84A-84J, and Phase 85 do not approve production pilot launch.
4. External launch-gate closure, R-405 technical resolution or formal acceptance, and current RLS evidence pass before Phase 82 can reach `READY_FOR_EXTERNAL_CONTROLLED_LAUNCH_AUTHORIZATION` (unchanged clinical readiness track).
3. No further repo-local Phase 82 sub-phases remain; Phase 82 track closed on 2026-06-30.

## Phase 78: Dependency And R-405 Closure - Completed 2026-06-29

Goal: re-run the accepted Phase 22 R-405 dependency procedure and either safely close the finding or record that no accepted stable patch path exists.

Status:

- Added `docs/PHASE_78_DEPENDENCY_R405_CLOSURE_SPEC.md`.
- Rechecked stable `next@latest`: `16.2.9` with nested `postcss@8.4.31`.
- Rechecked stable `eslint-config-next@latest`: `16.2.9`.
- Rechecked production audit: only the known moderate R-405 `next`/`postcss` findings remain, with the rejected `next@9.3.3` downgrade.
- No dependency files were changed.
- R-405 and `dependency_audit_clearance` remain open.
- Production pilot remains `NO-GO`.
- Verification passed with `git diff --check`, core tests 225/225, app tests 428 passed and 2 skipped across 73 files, lint with two pre-existing warnings, production build, and only documented R-405 findings.

Next:

- Phase 81 direct production pilot GO evaluation only when all external gates close, R-405 resolves or is formally accepted, and current RLS evidence passes.

## Phase 79: Production-Scale Hardening And Full 100x50 Rehearsal - Completed 2026-06-29

Goal: close local production-scale hardening before external launch-gate closure without connecting real providers/channels or processing real client data.

Status:

- Added `docs/PHASE_79_PRODUCTION_SCALE_HARDENING_AND_FULL_100X50_REHEARSAL_SPEC.md`.
- Completed Phase 79B-79D runtime hardening: windowed dashboard reads, scoped client create/patch loaders, and bounded internal copilot tool state.
- Completed Phase 79E lifecycle redaction evidence for removal/anonymization domains.
- Completed Phase 79F current RLS evidence status: Phase 50/52 baseline remains mitigated; current post-76N/77AA-77AI/79 re-run is pending when local Supabase is unavailable.
- Completed Phase 79G unified rehearsal with `npm run rehearse:production-scale:79g`.
- Completed Phase 79H continuity/risk/gate closure updates.
- Verification passed: expanded AI quality 5,000 cases, full mock channel replay, Phase 79 full acceptance tests, and `npm run release:verify` with core tests 225/225 and app tests 489 passed / 4 skipped across 79 files.
- Production pilot remains `NO-GO`; all launch gates remain open; R-405 remains open.

Next:

- Phase 81 direct production pilot GO evaluation only when all external gates close, R-405 resolves or is formally accepted, and current RLS evidence passes.

## Phase 80G: R-405 Closure-Evidence Hardening - Completed 2026-06-30

Goal: harden Phase 80D/80F R-405 closure evidence so R-405 cannot appear closed through a remediation flag alone, known-only audit parsing, or incomplete formal acceptance metadata.

Status:

- Hardened `phase-80d-r405-closure-evaluation.ts`.
- Technical R-405 closure now requires a safe stable Next.js/PostCSS patch path, dependency update evidence, and clean production audit.
- Unknown production audit findings block closure.
- Formal R-405 acceptance requires complete external acceptance metadata beyond a dependency gate evidence record.
- Targeted Phase 80 tests passed: 4 files, 29 tests.
- `npm run release:verify` passed with core tests 225/225 and app tests 518 passed / 4 skipped across 83 files.
- `npm run rehearse:production-scale:79g` passed.
- No dependency files changed; no launch gate closed; no formal R-405 acceptance was supplied.
- Production pilot remains `NO-GO`; R-405 remains open; `phase81StartEligible` remains `false`.

Next:

- Phase 81 direct production pilot GO evaluation only when all external gates close, R-405 resolves or is formally accepted, and current RLS evidence passes.

## Phase 80F: Final Gate Dossier And Readiness Decision - Completed 2026-06-30

Goal: aggregate Phase 80C/80D/80E evidence into the final closure report; update gate dossier, final readiness summary, and continuity docs; production pilot remains `NO-GO` unless all gates close, R-405 closes or is formally accepted, and current RLS evidence is acceptable.

Status:

- Added `phase-80f-final-readiness-decision.ts`; targeted Phase 80F tests passed (5/5).
- Final outcome: `NO_GO_MISSING_ARTIFACTS`.
- `productionPilotDecision`: `NO-GO`; `productionPilotGo`: `false`; `phase81StartEligible`: `false`.
- Updated gate dossier, final readiness summary, pilot evidence pack, and continuity docs.
- Production pilot remains `NO-GO`; Phase 81 cannot start.

Next:

- External launch-gate/R-405/RLS closure prerequisites before any further production GO action.

## Phase 80E: Current RLS Evidence Re-run - Completed 2026-06-30

Goal: run `npm run test:rls` and record pass, skip, or pending without rewriting the Phase 50/52 baseline mitigation narrative.

Status:

- Ran `npm run test:rls` from `app`; result was `20 skipped (20)` because local Supabase was unavailable.
- Added `phase-80e-current-rls-evidence.ts`; targeted Phase 80E tests passed (5/5).
- R-406 remains Phase 50/52 baseline mitigated with current re-run pending.
- No launch gate status changed; production pilot remains `NO-GO`.

Next:

- Phase 80F final gate dossier and readiness decision (completed; see Phase 80F section above).

## Phase 80D: R-405 Technical Closure Or Formal Acceptance - Completed 2026-06-30

Goal: re-run Phase 22 metadata/audit checks and either apply a safe stable patch or record no-patch closure with optional formal acceptance evaluation.

Status:

- Re-ran `npm view next@latest`, `npm view eslint-config-next@latest`, and `npm audit --omit=dev --json` from `app`.
- Stable `next@latest` `16.2.9` still bundles nested `postcss@8.4.31`.
- Production audit still reports only known R-405 findings; rejected `next@9.3.3` downgrade remains.
- No dependency files changed.
- Added `phase-80d-r405-closure-evaluation.ts`; targeted Phase 80D tests passed (7/7).
- No formal external R-405 risk acceptance artifact supplied.
- R-405 and `dependency_audit_clearance` remain open; production pilot remains `NO-GO`.

Next:

- Phase 80E current RLS evidence re-run.

## Phase 80C: Gate-by-Gate Evidence Evaluation - Completed 2026-06-30

Goal: evaluate sanitized evidence through the existing Phase 64 evaluator and document per-gate open/approved status and missing evidence.

Status:

- Added `app/src/lib/phase-80c-launch-gate-evidence-evaluation.ts` and targeted tests.
- Evaluated Phase 80B empty intake (`no_external_artifact_supplied`) with zero evidence records.
- All eight launch gates remain open; `productionPilotDecision` is `NO-GO`.
- Updated gate dossier, intake, pilot evidence pack, and Phase 80 spec with structured evaluation results.
- No real connections, dependency edits, provider/channel activation, or self-approved gate closure.
- Verification passed with targeted Phase 80C tests (9/9).

Next:

- Phase 80D R-405 technical closure or formal acceptance.

## Phase 80B: External Artifact Intake And Sanitization - Completed 2026-06-30

Goal: update external approval intake for Phase 80 artifact format and record supplied artifacts or explicit no-artifact status without changing gate closure.

Status:

- Updated `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md` with Phase 80 `LaunchGateEvidenceRecord` field contract, forbidden repo content, empty manifest template, and intake result table.
- Intake status recorded as `no_external_artifact_supplied` with zero evidence records.
- All eight launch gates remain open; production pilot remains `NO-GO`; R-405 remains open.
- No runtime behavior, dependency, provider, channel, launch-gate approval, real-data handling, or R-405 status changed.
- Verification passed with `git diff --check`.

Next:

- Phase 80C gate-by-gate evidence evaluation.

## Phase 80A: External Launch-Gate Scope Lock - Completed 2026-06-30

Goal: create the Phase 80 master spec, lock immutable rules, and record the Phase 79I entry baseline without runtime changes.

Status:

- Added `docs/PHASE_80_EXTERNAL_LAUNCH_GATE_CLOSURE_AND_R405_ACCEPTANCE_SPEC.md`.
- Locked immutable rules: no real connections; gate closure only via `LaunchGateEvidenceRecord`; R-405 only via Phase 22 or formal external acceptance; maximum outcome `PHASE_81_ELIGIBLE`.
- Recorded Phase 79I entry baseline and sub-phase map 80A-80F.
- No runtime behavior, dependency, provider, channel, launch-gate approval, real-data handling, or R-405 status changed.
- Production pilot remains `NO-GO`; all eight launch gates remain open; R-405 remains open.
- Verification passed with `git diff --check`.

Next:

- Phase 80B external artifact intake and sanitization.

## Phase 77Z: Repository Cleanup And Cursor Plan Migration - Completed 2026-06-22

Goal: remove obsolete editor-local planning artifacts from the tracked repository while preserving the audit trail in canonical docs.

Status:

- Added `docs/PHASE_77Z_REPOSITORY_CLEANUP_AND_CURSOR_PLAN_MIGRATION_SPEC.md`.
- Deleted `.cursor/plans/food_green_expansion_7671797e.plan.md` from tracked files.
- Recorded that the removed plan content lives in the canonical Phase 76C-76Q specs and Phase 76P continuity evidence.
- Retained historical phase specs, evidence docs, JSONL datasets, runtime JSON imports, migrations, and tests.
- No runtime behavior, provider, channel, launch-gate approval, real-data handling, or R-405 status changed.
- Production pilot remains `NO-GO`.

Next:

- WhatsApp production adapter (mock/gated only).

## Phase 77M: Master Rebaseline And Spec - Completed 2026-06-13

Goal: create the canonical AI Quality Program PRD/tech spec, lock architectural decisions, and update continuity documents before Phase 77N runtime work.

Status:

- Added `docs/PHASE_77M_MASTER_REBASELINE_AND_SPEC.md`.
- Canonical master plan: `docs/PHASE_77M_77Y_AI_QUALITY_MASTER_PLAN.md`.
- Recorded that superseded alternate Phase 78A-M AI-quality numbering is not used because Phase 78-81 remain reserved for production-readiness closure.
- Locked core-owned `responsePlan` after answerability and before provider/generation.
- Locked `claimManifest` generation from plan/template/sourceRefs rather than free LLM output.
- Locked `normalize-safety-text.js` as the single shared normalization source to extend.
- Locked fail-closed unknown-intent handling for later runtime phases.
- Verification passed with `git diff --check`, `app` `npm test` (337/337), and `npm run release:verify`: core tests 173/173, app tests 337/337, lint with two pre-existing warnings, production build, and only documented R-405 findings.
- No runtime behavior, provider, channel, launch-gate approval, real-data handling, or R-405 status changed.
- Production pilot remains `NO-GO`.

Next:

- Phase 77N Canonical Intent Understanding V2.

## Phase 77O: Response Plan Contract V1 - Completed 2026-06-13

Goal: make every provider-eligible client-facing draft pass through a structured core-owned response plan.

Status:

- Added `docs/PHASE_77O_RESPONSE_PLAN_CONTRACT_V1_SPEC.md`.
- Added `dietitian-ai-assistant/src/response-plan-v1.js` and `response-plan-prompt-segments.js`.
- Orchestrator builds `contextManifest.responsePlan` after answerability and blocks provider generation without provider-eligible plans.
- Mock provider and Phase 75 allowlists accept bounded `response_plan`, `claim_manifest`, and `style_dna` segments.
- Verification passed with core/app response-plan tests and `npm run release:verify`.
- Production pilot remains `NO-GO`.

Next:

- Phase 77P Deterministic Template Library V1.

## Phase 77Q: Claim Manifest and Output Grounding V1 - Completed 2026-06-13

Goal: generate `claimManifest` from plan/template/source authority and block manifest-outside provider output.

Status:

- Added `docs/PHASE_77Q_CLAIM_MANIFEST_AND_OUTPUT_GROUNDING_V1_SPEC.md`.
- Added `dietitian-ai-assistant/src/claim-manifest-v1.js` (`claim-manifest-v1-v0.1.0`).
- Replaced Phase 77O placeholder manifests in `buildResponsePlanV1`.
- Orchestrator fail-closed on incomplete provider manifests.
- `guardProviderOutput` enforces `claim_outside_manifest` blocking.
- Added JSONL golden cases and core/app tests.
- Verification passed with `git diff --check`, core claim-manifest tests, app Phase 77Q tests, and `npm run release:verify` (core 193/193, app 354/354).
- Production pilot remains `NO-GO`.

Next:

- Phase 77S Dietitian Voice Engine V2.

## Phase 77S: Dietitian Voice Engine V2 - Completed 2026-06-13

Goal: improve personalized style without allowing style to affect clinical decisions.

Status:

- Added `docs/PHASE_77S_DIETITIAN_VOICE_ENGINE_V2_SPEC.md`.
- Added `dietitian-ai-assistant/src/style-dna-v2.js` (`style-dna-v2-v0.1.0`).
- Replaced placeholder `styleDna` in `buildResponsePlanV1` with tenant/dietitian-scoped runtime.
- Added edit-history learning lifecycle in fallback store (`styleEditHistory`).
- `guardProviderOutput` enforces hard style guard violations; soft mismatch is measured only.
- Added JSONL style-poisoning golden cases and core/app tests.
- Verification passed with `git diff --check`, core style-dna tests, app Phase 77S tests, `app` `npm test` (366/366), and production build (core 200/200).
- Production pilot remains `NO-GO`.

Next:

- Phase 77X Expanded 100x50 AI Rehearsal And Risk Register.

## Phase 77R: Food Understanding V3 - Completed 2026-06-13

Goal: expand safe deterministic food understanding with versioned alias dictionaries, brand fail-closed routing, and recipe-gated mixed-dish handling.

Status:

- Added `docs/PHASE_77R_FOOD_UNDERSTANDING_V3_SPEC.md`.
- Added `dietitian-ai-assistant/src/food-understanding-v3.js` (`food-understanding-v3-v0.1.0`).
- Added checksum-backed alias dictionary (`app/src/lib/food-alias-dictionary-v3.json` with JSONL mirror).
- Wired alias resolution, brand `needs_label` routing, and mixed-dish guards into `phase-77g-food-decision-engine-v2.ts`.
- Added JSONL golden cases and core/app tests.
- Verification passed with `git diff --check`, core food-understanding tests, app Phase 77R tests, and `npm run release:verify` (core 196/196, app 361/361).
- Production pilot remains `NO-GO`.

Next:

- Phase 77S Dietitian Voice Engine V2 (completed; see Phase 77S section above).

## Phase 77P: Deterministic Template Library V1 - Completed 2026-06-13

Goal: create safe, predictable client-message structures from `responsePlan.templateId` before claim grounding.

Status:

- Added `docs/PHASE_77P_DETERMINISTIC_TEMPLATE_LIBRARY_V1_SPEC.md`.
- Added `dietitian-ai-assistant/src/deterministic-template-library-v1.js` (`deterministic-template-library-v1-v0.1.0`).
- Mock provider renders deterministic drafts from `templateId`; rejects missing template ids.
- Orchestrator attaches `contextManifest.deterministicClientMessage` for non-provider-eligible `ask_label` plans.
- `needs_label` precedence now wins over answerability handoff in `resolveReplyMode`.
- Added JSONL golden cases and core/app tests.
- Verification passed with `git diff --check`, core deterministic-template tests, app Phase 77P tests, and `npm run release:verify` (core 189/189, app 350/350).
- Production pilot remains `NO-GO`.

Next:

- Phase 77Q Claim Manifest and Output Grounding V1.

## Phase 77N: Canonical Intent Understanding V2 - Completed 2026-06-13

Goal: unify intent resolution in core and fail closed on unknown intent before provider generation.

Status:

- Added `docs/PHASE_77N_CANONICAL_INTENT_UNDERSTANDING_V2_SPEC.md`.
- Added `dietitian-ai-assistant/src/canonical-intent-resolver-v2.js` (`canonical-intent-resolver-v2-v0.1.0`).
- Added `dietitian-ai-assistant/src/intent-family-mappings.js` for shared food intent family mapping.
- Updated `green-intent-taxonomy.js` to v0.3.0 and wired orchestrator/answerability to canonical intent evidence.
- Added JSONL golden cases and core/app tests for unknown intent, negation, portion ambiguity, and sensitive precedence.
- Verification passed with core canonical-intent tests, app Phase 77N runtime tests, and `npm run release:verify`.
- No real provider/channel connection, launch-gate approval, real-data handling, or R-405 status changed.
- Production pilot remains `NO-GO`.

Next:

- Phase 77O Response Plan Contract V1.

## Phase 77M-77Y: AI Quality Program - Completed 2026-06-14

Goal: improve the AI dietitian assistant's client-reply quality before WhatsApp adapter work while preserving the existing green/yellow/red risk model.

Canonical plan: `docs/PHASE_77M_77Y_AI_QUALITY_MASTER_PLAN.md`.

Locked decisions:

- Client-visible risk classes remain only `green`, `yellow`, and `red`.
- Internal states such as `unknown_intent`, `needs_label`, `needs_review`, `clarify`, and `handoff` are workflow states, not new client-visible warning classes.
- Green scope should expand only by recognizing more genuinely green, source-backed, low-risk questions; ambiguous, unsupported, label-missing, or clinically risky messages must not be forced into green.
- `responsePlan` is core-owned and produced after answerability and before provider/generation.
- `claimManifest` is generated from responsePlan, deterministic templates, sourceRefs, and manual source authority, not extracted from free LLM text.
- Deterministic templates precede claim grounding.
- Canonical intent resolver feeds green taxonomy, answerability, Food Decision V2 alignment, and response planning.
- Style/persona affect wording only and never change clinical/source/food decisions.

Phase map:

- 77M Master rebaseline and spec. **Completed 2026-06-13.**
- 77N Canonical Intent Understanding V2. **Completed 2026-06-13.**
- 77O Response Plan Contract V1. **Completed 2026-06-13.**
- 77P Deterministic Template Library V1. **Completed 2026-06-13.**
- 77Q Claim Manifest And Output Grounding V1. **Completed 2026-06-13.**
- 77R Food Understanding V3. **Completed 2026-06-13.**
- 77S Dietitian Voice Engine V2. **Completed 2026-06-13.**
- 77T AI Quality Evaluation Harness V1. **Completed 2026-06-13.**
- 77U Clinical Red-Team And RD Review Packet. **Completed 2026-06-13.**
- 77V Copilot Quality Workflow V1. **Completed 2026-06-13.**
- 77W Narrow Autopilot Eligibility V2. **Completed 2026-06-14.**
- 77X Expanded 100x50 AI Rehearsal And Risk Register. **Completed 2026-06-14.**
- 77Y Continuity, Evidence, And Launch Gate Update. **Completed 2026-06-14.**

Next open engineering phase:

- WhatsApp production adapter (mock/gated only).

Done criteria:

- Hard-zero quality gates are recorded for unsafe client send, source-unsupported green, forbidden-food approval, yellow/red client send, and claim outside manifest.
- AI quality harness uses JSONL datasets, a release subset in `release:verify`, and a separate full `npm run rehearse:ai` command.
- Production pilot remains `NO-GO`, real providers/channels remain disconnected, and R-405 remains open.

## Phase 77A: Manual Source Authority Rebaseline - Completed 2026-06-10

Goal: document the product and technical rebaseline before any runtime changes so AI answer quality is governed by dietitian-managed manual source authorities instead of chat-based form/food-rule mutation.

Status:

- Added `docs/PHASE_77A_MANUAL_SOURCE_AUTHORITY_REBASELINE_SPEC.md`.
- Added `docs/PHASE_77_MASTER_IMPLEMENTATION_PLAN.md` as the full detailed Phase 77 implementation plan.
- Repositioned the roadmap into Phase 77A-77K before WhatsApp production adapter work.
- Locked v1 out-of-catalog inference to deterministic catalog/alias/keyword matching only; LLM-based food classification remains future gated work.
- Required Phase 68 green intent taxonomy recalibration so safe off-menu food requests can reach a `discourage` decision instead of being blocked as active-plan conflicts.
- Defined decision-to-send semantics for `allow`, `discourage`, `forbid`, `needs_label`, `needs_review`, and `not_applicable`.
- Defined disposition for the completed Phase 76D-76O food-rule track artifacts.
- Verification passed with `npm run release:verify`: core tests 165/165, app tests 284/284, lint with two pre-existing warnings, production build, and only documented R-405 findings.
- No runtime behavior, schema, provider, channel, launch-gate approval, real-data handling, or R-405 status changed.
- Production pilot remains `NO-GO`.

Next:

- Phase 77B-77K are complete locally; proceed to WhatsApp production adapter as the next implementation track.

## Phase 77H: PromptContext, Answerability, Permission Graph, And Output Guard V2 - Completed 2026-06-10

- Added `docs/PHASE_77H_PROMPTCONTEXT_ANSWERABILITY_OUTPUT_GUARD_V2_SPEC.md`, `food-decision-v2-prompt-segments.js`, V2 PromptContext segments, intent-specific answerability `v0.2.0`, output guard V2, orchestrator compile/answerability/guard wiring, permission-graph V2 mapping, and provider allowlist updates.
- Verification passed with `npm run release:verify`: core tests 173/173, app tests 315/315, lint with two pre-existing warnings, production build, and only documented R-405 findings.
- Production pilot remains `NO-GO`.

Next:

- Phase 77I-77K are complete locally; proceed to WhatsApp production adapter as the next implementation track.

## Phase 77G: Food Decision Engine V2 And Phase 68 Recalibration - Completed 2026-06-10

- Added `docs/PHASE_77G_FOOD_DECISION_ENGINE_V2_SPEC.md`, `phase-77g-food-decision-engine-v2.ts`, V2 decision contract (`allow`/`discourage`/`forbid`/`needs_label`/`needs_review`/`not_applicable`), catalog/profile/menu/flexibility precedence, Phase 76H product-ingredient verification reuse, legacy 76E fallback, `food-rule-runtime.ts` V2 preference, simulator/orchestrator `foodDecisionV2` manifest wiring, and Phase 68 `yellow_active_plan_structural_change` recalibration.
- Verification passed with `npm run release:verify`: core tests 167/167, app tests 310/310, lint with two pre-existing warnings, production build, and only documented R-405 findings.
- Production pilot remains `NO-GO`.

Next:

- Proceed to Phase 77H PromptContext/answerability/output guard V2 adaptation.

## Phase 77F: Menu Plan V1 With Four Templates - Completed 2026-06-10

- Added `docs/PHASE_77F_MENU_PLAN_V1_SPEC.md`, `phase-77f-client-menu-plan.ts`, `ClientMenuPlanV1Record`, four template types, lazy legacy diet-plan migration, active-menu selection with derived `dietPlan.summary`, food-profile conflict detection, menu-plan API routes, Supabase `client_menu_plans` with tenant RLS, `MenuPlanPanel` dashboard UI, Phase 74 `menu_plans_v1.json` export, and transactional redaction.
- Direct `dietPlan.summary` patch is blocked when an active menu plan exists.
- Verification passed with `npm run release:verify`: core tests 165/165, app tests 302/302, lint with two pre-existing warnings, production build, and only documented R-405 findings.
- Production pilot remains `NO-GO`.

Next:

- Proceed to Phase 77G Food Decision Engine V2.

## Phase 77E: Client Food Rule Profile V2 - Completed 2026-06-10

- Added `docs/PHASE_77E_CLIENT_FOOD_RULE_PROFILE_V2_SPEC.md`, `phase-77e-client-food-rule-profile.ts`, `ClientFoodRuleProfileV2Record`, lazy migration from legacy form answers, `GET`/`PUT` `/api/clients/[id]/food-rule-profile`, Supabase `client_food_rule_profiles` with tenant RLS, simplified `FoodRulesPanel`, Phase 74 `food_rule_profile_v2.json` export, and transactional redaction.
- Food-rule saves bridge into legacy form answers for Phase 76 runtime compatibility until Food Decision Engine V2.
- Verification passed with `npm run release:verify`: core tests 165/165, app tests 296/296, lint with two pre-existing warnings, production build, and only documented R-405 findings.
- Production pilot remains `NO-GO`.

Next:

- Proceed to Phase 77F menu plan v1.

## Phase 77B: Manual Source Authority Boundary - Completed 2026-06-10

Goal: remove chat-based mutation for personal form, food rules, and future menu authority while preserving read-only internal copilot and panel-only Critical Context.

Status:

- Added `docs/PHASE_77B_MANUAL_SOURCE_BOUNDARY_SPEC.md` and `phase-77b-chat-mutation-boundary.ts`.
- Blocked chat proposal create/apply with `chat_source_mutation_disabled` in state and API routes.
- Removed dashboard Propose update/apply controls; historical proposals are read-only with deprecated copy.
- Preserved reject/dismiss for legacy pending proposals and kept export/redaction paths intact.
- Updated Phase 76O integration checks to verify chat mutation is blocked and manual food-rule dashboard save still works.
- Verification passed with `npm run release:verify`: core tests 165/165, app tests 289/289, lint with two pre-existing warnings, production build, and only documented R-405 findings.
- No provider, channel, launch-gate approval, real-data handling, or R-405 status changed.
- Production pilot remains `NO-GO`.

Next:

- Phase 77E-77K are complete locally; proceed to WhatsApp production adapter as the next implementation track.

## Phase 77C: Client Personal Form V2 - Completed 2026-06-10

Goal: load the user-defined first client personal form into the dynamic form registry while keeping food-group and meal flexibility in their future dedicated forms.

Status:

- Added `docs/PHASE_77C_CLIENT_PERSONAL_FORM_V2_SPEC.md`.
- Updated the active client schema to `Phase 77C client personal form v2` / `phase-77c-client-personal-form-v2`.
- Added phone and WhatsApp identification fields, goal/target/flexibility fields, body measurements, lifestyle, medical, women's health, nutrition-history, allergy/intolerance, digestive, and notes fields.
- Kept general and goal-based flexibility in this form; food-group flexibility remains for Phase 77E and meal flexibility remains for Phase 77F.
- Removed Phase 76D structured food-rule fields from the active personal form schema, while preserving legacy demo answers for current Phase 76 runtime compatibility.
- No provider, channel, launch-gate approval, real-data handling, menu/export/catalog implementation, or R-405 status changed.
- Production pilot remains `NO-GO`.

Next:

- Phase 77E-77K are complete locally; proceed to WhatsApp production adapter as the next implementation track.

## Phase 77D: Master Food Catalog Hierarchy - Completed 2026-06-10

Goal: load the user-supplied `Besin Veritabani` food list as a global hierarchy and make forbidden main-category, subcategory, and food selections available to the dietitian dashboard.

Status:

- Added `docs/PHASE_77D_MASTER_FOOD_CATALOG_SPEC.md`.
- Extracted `manual.xlsx` / `Besin Veritabani` into a repo-versioned catalog data file with source workbook and record-set checksums.
- Added typed catalog validation, stats, exact lookup, and forbidden selection expansion helpers.
- Loaded 12 main categories, 113 subcategories, and 518 foods with stable ids.
- Extended `FoodRulesPanel` with hierarchical checkbox controls for forbidden main categories, subcategories, and individual foods.
- Saved selected ids and expanded forbidden food/group names into existing food-rule answers for Phase 76 runtime compatibility.
- Food Decision Engine V2, alias/keyword confidence, menu conflict handling, real provider/channel activation, launch-gate approval, real-data handling, and R-405 status did not change.
- Production pilot remains `NO-GO`.

Next:

- Phase 77E-77K are complete locally; proceed to WhatsApp production adapter as the next implementation track.

## Phase 76Q: Verification and Commit Protocol - Completed 2026-06-08

Goal: formally close the structured food-rule green capacity track (76C–76P) with Codex-compliant verification and commit evidence.

Status:

- Added `docs/PHASE_76Q_VERIFICATION_AND_COMMIT_PROTOCOL_SPEC.md` with track closure verification counts and commit references.
- Re-ran core tests 165/165, app tests 284/284, lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- `npm run test:rls` skipped (20/20 guarded) because local Supabase was unavailable; Phase 76N RLS re-run remains pending.
- Production pilot remains `NO-GO`.

Next:

- Proceed to Phase 77B manual source authority boundary; WhatsApp production adapter now follows Phase 77A-77K.

## Phase 76P: Continuity, Evidence, and Gate Update - Completed 2026-06-08

Goal: consolidate Phases 76C–76O food-rule track evidence into continuity, pilot, gate, and risk documentation.

Status:

- Added `docs/PHASE_76P_CONTINUITY_EVIDENCE_GATE_UPDATE_SPEC.md` with consolidated evidence inventory and gate interpretation.
- Updated continuity docs, pilot readiness evidence pack, gate closure dossier, final readiness summary, clinical taxonomy review packet, and risk register narratives.
- Preserved local prototype mitigated vs production approved distinction; all eight launch gates remain open; R-405 remains open.
- Verification passed with core tests 165/165, app tests 284/284, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No runtime behavior, schema, provider, channel, or gate closure changes.
- Production pilot remains `NO-GO`.

Next:

- Proceed to Phase 77B manual source authority boundary; WhatsApp production adapter now follows Phase 77A-77K.

## Phase 76O: 100x50 Synthetic Food-Mix Rehearsal - Completed 2026-06-08

Goal: simulate expanded food-rule green capacity across 100 dietitians x 50 clients with aggregate rehearsal evidence.

Status:

- Added `docs/PHASE_76O_100X50_SYNTHETIC_FOOD_MIX_REHEARSAL_SPEC.md`, `food-mix-rehearsal-scenarios.jsonl`, and `phase-76o-food-mix-rehearsal.ts`.
- Ran scale rehearsal across 5,000 synthetic client assignments with twelve food-mix scenarios and integration checks for duplicate inbound, provider failure, stale draft invalidation, and proposal apply.
- Extended `direct-pilot-scale-readiness` and `operational-health` with food-mix aggregate evidence fields.
- Verification passed with core tests 165/165, app tests 284/284, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- Production pilot remains `NO-GO`.

Next:

- Proceed to Phase 76P documentation, evidence, and gate updates (completed 2026-06-08).

## Phase 76N: Supabase, RLS, Export, Redaction, and Transactional Coverage - Completed 2026-06-08

Goal: extend Phase 74 lifecycle coverage to structured food rules, proposals, and Supabase transactional paths.

Status:

- Added `docs/PHASE_76N_SUPABASE_RLS_EXPORT_REDACTION_TRANSACTIONAL_COVERAGE_SPEC.md`.
- Added `phase-76n-food-rule-lifecycle.ts`, export bump to `phase74-export-v1.1`, per-field food-rule redaction, removed-client structured-rules null guard, Supabase migration `20260608120000_phase_76n_food_rule_lifecycle_rpc.sql`, `commit_client_update_proposal` RPC wiring, and `commit_client_removal_lifecycle` bulk redaction coverage.
- RLS re-run for the Phase 76N migration remains pending when local Supabase is unavailable.
- Verification passed with core tests 165/165, app tests 276/276, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- Production pilot remains `NO-GO`.

## Phase 76M: Phase 73 Calibration and Metrics Expansion - Completed 2026-06-08

Goal: make expanded green capacity measurable with Phase 73 matrix/golden expansion and aggregate metrics.

Status:

- Added `docs/PHASE_76M_CALIBRATION_METRICS_EXPANSION_SPEC.md`.
- Extended `phase-73-health-regulation-calibration.ts` to `v1.1.0` with food-rule decision areas, twelve golden categories, `evaluatePhase73GreenCapacityMetrics`, and `phase-76m-calibration-metrics.ts` operational-health bridge.
- Added core `food-rule-calibration-golden-cases.jsonl` and expanded `clinical-golden-cases.jsonl`.
- Verification passed with core tests 165/165, app tests 272/272, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- Production pilot remains `NO-GO`.

## Phase 76L: Phase 72 Permission Graph Runtime Bridge - Completed 2026-06-08

Goal: wire draft Phase 72 permission graph into simulator risk path as audit-first evidence with gated enforcement.

Status:

- Added `docs/PHASE_76L_PERMISSION_GRAPH_RUNTIME_BRIDGE_SPEC.md`.
- Extended `phase-72-permission-graph.ts` food-rule maps (`v1.1.0`), added `phase-76l-permission-graph-runtime.ts`, simulator bridge, and `permissionGraphEvaluations` audit records.
- Verification passed with core tests 153/153, app tests 266/266, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- Production pilot remains `NO-GO`.

## Phase 76K: Chat-to-Food-Rule Proposal Expansion - Completed 2026-06-08

Goal: expand dietitian chat update proposals with deterministic structured food-rule patches.

Status:

- Added `docs/PHASE_76K_CHAT_FOOD_RULE_PROPOSAL_SPEC.md`.
- Added `phase-76k-food-rule-proposal-patches.ts`, `food_rule` proposal category, multiselect/exchange apply support, allergy/restriction sync on apply, and dashboard grouping.
- Verification passed with core tests 153/153, app tests 262/262, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No real Gemini extraction, new API endpoints, channel, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

## Phase 76J: Dashboard Food Rule Management UX - Completed 2026-06-08

Goal: let dietitians manage structured food rules from the dashboard with prompt-affecting draft invalidation.

Status:

- Added `docs/PHASE_76J_DASHBOARD_FOOD_RULE_MANAGEMENT_SPEC.md`.
- Added `phase-76j-food-rule-dashboard.ts`, `FoodRulesPanel`, and Forms view wiring in `dashboard-app.tsx`.
- Food-rule saves merge into the active published client form response via existing `/api/clients/forms`; context revision increments, allergies/restricted foods sync, pending drafts invalidate, and `client_food_rules_updated` audit metadata is recorded.
- Verification passed with core tests 153/153, app tests 254/254, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No chat proposals, new API endpoints, real Gemini egress, channel, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

## Phase 76I: PromptContext and Provider Output Guard Hardening - Completed 2026-06-08

Goal: give the provider bounded food-rule PromptContext segments and block output that contradicts engine decisions.

Status:

- Added `docs/PHASE_76I_PROMPTCONTEXT_PROVIDER_OUTPUT_GUARD_SPEC.md`.
- Added core `food-rule-prompt-segments.js`, bounded segments in `context-compiler.js`, and `food-rule-output-guard-v0.1.0` in `response-quality-guard.js`.
- Orchestrator passes structured food rules into context compile and output guard; Phase 75 and mock provider allowlists include food-rule segment types.
- Verification passed with core tests 153/153, app tests 250/250, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No dashboard UX, chat proposals, real Gemini egress, channel, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

## Phase 76H: Product Ingredient Verification - Completed 2026-06-08

Goal: bind product ingredient questions to trusted-source verification before food-rule decisions.

Status:

- Added `docs/PHASE_76H_PRODUCT_INGREDIENT_VERIFICATION_SPEC.md`.
- Added core `product-ingredient-verification.js` and app `product-ingredient-verification.ts` with user-label extraction.
- Food rule engine consumes verification decisions; simulator/runtime auto-build evidence from embedded label text.
- Verification passed with core tests 146/146, app tests 247/247, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No open web browsing, barcode/catalog providers, PromptContext segments, provider routing changes, channel, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

## Phase 76G: Clinical Second-Layer False-Yellow Calibration - Completed 2026-06-08

Goal: reduce false-yellow second-layer escalations for source-backed food permission, substitution, and skip questions without weakening acute allergy or reaction paths.

Status:

- Added `docs/PHASE_76G_CLINICAL_SECOND_LAYER_FALSE_YELLOW_CALIBRATION_SPEC.md`.
- Bumped second-layer version to `clinical-safety-second-layer-v0.2.0` with source-backed food-rule carve-out contract.
- Wired food-rule decisions into simulator risk classification and orchestrator fallback risk path.
- Expanded `clinical-second-layer-cases.jsonl` and added `phase-76g-second-layer-runtime.test.ts`.
- Verification passed with core tests 140/140, app tests 242/242, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No product catalog adapters, PromptContext segments, provider routing changes, channel, launch-gate approval, R-405 acceptance, external clinical taxonomy approval, or real-data path was connected.
- Production pilot remains `NO-GO`.

Next:

- Proceed to Phase 76H product ingredient verification contract.

## Phase 76F: Intent-Specific Answerability - Completed 2026-06-08

Goal: replace Phase 67 coarse approved-source gating with intent-family source matching and food-rule engine alignment before provider calls.

Status:

- Added `docs/PHASE_76F_INTENT_SPECIFIC_ANSWERABILITY_SPEC.md`.
- Added core `dietitian-ai-assistant/src/intent-specific-answerability.js` and tests.
- Orchestrator reorder: green intent taxonomy → food rule engine → intent-specific answerability.
- Structured food-rule source categories derived from Phase 76D manifest; substitution legacy plan/manual fallback when engine returns `unknown_food_requires_review`; yellow/red decisions bypass intent-specific gating.
- App runtime tests in `intent-specific-answerability-runtime.test.ts`.
- Verification passed with core tests 139/139, app tests 240/240, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No clinical second-layer carve-outs, product catalog adapters, provider routing changes, channel, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

Next:

- Phase 76G is complete; proceed to Phase 76H product ingredient verification.

## Phase 76E: Food Rule Engine - Completed 2026-06-08

Goal: implement a deterministic evaluator for allowed, forbidden, equivalent substitution, diet-type, skip, and product-ingredient food decisions.

Status:

- Added `docs/PHASE_76E_FOOD_RULE_ENGINE_SPEC.md`.
- Added core `dietitian-ai-assistant/src/food-rule-engine.js` and tests.
- Added app `food-rule-runtime.ts` bridge and tests.
- Orchestrator records audit-only `contextManifest.foodRule`; simulator passes structured food rules into core input.
- Verification passed with core tests 132/132, app tests 238/238, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No intent-specific answerability gating, clinical second-layer carve-outs, product catalog adapters, provider routing changes, channel, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

Next:

- Proceed to Phase 76F intent-specific answerability.

## Phase 76D: Structured Food Rule Data Model And Form Upgrade - Completed 2026-06-08

Goal: convert Phase 70 food-related fields from coarse free text into structured, answerability-ready food rules.

Status:

- Added `docs/PHASE_76D_STRUCTURED_FOOD_RULE_DATA_MODEL_SPEC.md`.
- Added `app/src/lib/phase-76d-food-rule-fields.ts` and `app/src/lib/phase-76d-food-rule-model.ts`.
- Extended Phase 70 client form registry with 13 structured food-rule fields and bumped registry version to `phase-76d-food-rule-registry-v1`.
- Extended autopilot qualification with structured food-rule completeness checks and synced allergies/restricted foods on form save.
- Seeded demo structured food rules and added tests.
- Verification passed with core tests 122/122, app tests 234/234, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No orchestrator food-rule engine, intent-specific answerability, product-ingredient verification, provider, channel, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

Next:

- Proceed to Phase 76F intent-specific answerability.

## Phase 76C: Structured Food Rule Green Capacity Spec - Completed 2026-06-08

Goal: lock the PRD and technical specification for expanding source-backed green food decisions before WhatsApp production adapter work.

Status:

- Added `docs/PHASE_76C_STRUCTURED_FOOD_RULE_GREEN_CAPACITY_SPEC.md`.
- Defined structured food-rule data model, food-rule engine contract, intent-specific answerability matrix, clinical second-layer calibration rules, product-ingredient verification contract, PromptContext/output guard requirements, dashboard/proposal requirements, permission-graph and calibration wiring plan, lifecycle coverage, edge cases, and downstream phase map 76D-76Q.
- Updated continuity and evidence docs to position the food-rule track before WhatsApp production adapter.
- Verification re-ran with core tests 122/122, app tests 226/226, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No runtime behavior, schema, provider, channel, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

Next:

- Proceed to Phase 76D structured food rule data model and form upgrade.

## Phase 75: Gemini Provider Gate - Completed 2026-06-07

Goal: convert the user-supplied Gemini/provider decision pack into local draft artifacts for provider surface selection, model routing, retention/logging/training policy, health-data eligibility, PromptContext allowlist enforcement, and launch-gate evidence requirements.

Status:

- Added `docs/PHASE_75_GEMINI_PROVIDER_GATE_SPEC.md`.
- Added `app/src/lib/phase-75-gemini-provider-gate.ts` with forbidden surfaces, paid Vertex/Gemini Enterprise target surface, green/yellow model routing, training/logging/retention policy, health eligibility checklist, prompt allowlist/forbidden maps, required gate evidence, routing evaluator, and `isPhase75RealGeminiEgressAllowed`.
- Added tests proving pack readiness, red no-provider, yellow internal-only routing, green source-backed routing, forbidden prompt fields, and blocked real egress without env plus approved gates.
- Verification passed with core tests 122/122, app tests 216/216, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No real Gemini API, Vertex AI connection, unpaid consumer Gemini surface, grounding/search/maps, tuning, file/image/audio input, launch-gate approval, R-405 acceptance, or real health-data egress was connected.
- Production pilot remains `NO-GO`.

Next:

- Proceed to Phase 77B manual source authority boundary, then Phase 77A-77K completion before WhatsApp production adapter and remaining production hardening gates.

## Phase 74: Data Lifecycle, Export, Anonymization and DSAR Policy - Completed 2026-06-07

Goal: convert the user-supplied retention, export, anonymization, hard delete, and DSAR preference pack into local policy artifacts and a transactional redaction contract.

Status:

- Added `docs/PHASE_74_DATA_LIFECYCLE_DSAR_SPEC.md`.
- Added `app/src/lib/phase-74-data-lifecycle-policy.ts` with retention policy, export manifest/checksums, DSAR SLA, transactional redaction, and invariant evaluation.
- Standardized redaction marker to `REDACTED_BY_PHASE74_POLICY` in `data-governance.ts`.
- Added tests proving policy readiness, export contract, transactional redaction invariants, and simulator exclusion for removed clients.
- Verification passed with core tests 122/122, app tests 209/209, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No production Supabase transactional RPC migration, Gemini, WhatsApp, Telegram, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

Next:

- Proceed to Gemini provider gate and remaining production hardening gates.

## Phase 73: Health Regulation Calibration - Completed 2026-06-07

Goal: convert the user-supplied health regulation decision matrix and golden-case labeling standard into a local calibration layer.

Status:

- Added `docs/PHASE_73_HEALTH_REGULATION_CALIBRATION_SPEC.md`.
- Added `app/src/lib/phase-73-health-regulation-calibration.ts` with 14 official sources, 27 decision areas, priority order, 15 golden cases, copilot/autopilot evaluation, and acceptance metrics.
- Added tests proving draft matrix completeness, copilot never auto-sends, red clinical escalation, quarantine paths, and zero unsafe-green acceptance violations on the bundled suite.
- Verification passed with core tests 122/122, app tests 204/204, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No active calibration activation, Gemini, WhatsApp, Telegram, monitoring, secret manager, production Supabase migration, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

Next:

- Phase 74 is complete; proceed to Gemini provider gate.

## Phase 72: Regulation Permission Graph - Completed 2026-06-07

Goal: convert the user-supplied legal/privacy, clinical interpretation, and permission graph pack into canonical draft routing artifacts and fail-closed evaluation.

Status:

- Added `docs/PHASE_72_REGULATION_PERMISSION_GRAPH_SPEC.md`.
- Added `app/src/lib/phase-72-permission-graph.ts` with forbidden, draft-only, plan answerability, general education, never-prompt, prompt-allowed, covenant phrase, legal privacy routing, clinical escalation routing, and mixed-intent fail-closed artifacts.
- Added tests proving draft artifact completeness, sensitive field blocking, green plan lookup under satisfied gates, mixed-intent fail-closed routing, acute clinical escalation, quarantine on unknown identity, and blocked active production routing.
- Verification passed with core tests 122/122, app tests 197/197, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No active routing activation, Gemini, WhatsApp, Telegram, monitoring, secret manager, production Supabase migration, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

Next:

- Phase 73 is complete; proceed to transactional redaction/DSAR hardening.

## Phase 71: Turkiye Official Health Source Ingestion - Completed 2026-06-07

Goal: convert the user-supplied Turkiye official health source pack into a canonical local source manifest and fail-closed QA intake layer.

Status:

- Added `docs/PHASE_71_TURKIYE_OFFICIAL_HEALTH_SOURCE_INGESTION_SPEC.md`.
- Added `app/src/lib/phase-71-turkiye-official-sources.ts` with 14 official Turkiye sources, P0/P1/P2 priorities, official URLs, suggested file names, critical sections, and green/yellow/red impact notes.
- Added tests proving all required P0 sources are present, metadata-only intake fails Phase 65 QA, unknown artifact source ids fail, and complete synthetic artifact evidence produces draft-only scope rules.
- Verification passed with core tests 122/122, app tests 190/190, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No real PDF download/parser, Gemini, WhatsApp, Telegram, monitoring, secret manager, production Supabase migration, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

Next:

- Phase 72 is complete; proceed to Phase 73 calibration only after reviewer inputs are supplied.

## Phase 70: User-Supplied Form Hardening - Completed 2026-06-07

Goal: convert the user-supplied dietitian/client form package into versioned local schemas, field classifications, prompt visibility rules, answerability metadata, and autopilot qualification checks.

Status:

- Added `docs/PHASE_70_USER_SUPPLIED_FORM_HARDENING_SPEC.md`.
- Added `app/src/lib/phase-70-form-registry.ts`, `phase-70-form-hardening.ts`, `dietitian-forms.ts`, and `phase-70-seed-answers.ts`.
- Published local client/dietitian schemas now carry `registryVersion`, prompt-access, answerability-role, and privacy metadata.
- Simulator preflight blocks autopilot when Phase 70 minimum client fields are incomplete or not qualified.
- Prompt summaries expose only `prompt_allowed` fields with bounded sanitization.
- Verification passed with core tests 122/122, app tests 185/185, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No real Gemini, WhatsApp, Telegram, monitoring, secret manager, production Supabase dietitian-form migration, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

Next:

- Implement Phase 71 Official Regulation PDF Ingestion only after the user supplies official PDFs.

## Phase 69: Direct 5,000 Client Scale Foundation - Completed 2026-06-05

Goal: make the direct 100 dietitian x 50 client target a local, test-covered prerequisite before form/PDF/provider/channel production hardening.

Status:

- Added `docs/PHASE_69_DIRECT_5000_CLIENT_SCALE_FOUNDATION_SPEC.md`.
- Added `app/src/lib/direct-pilot-scale-readiness.ts` with the 100x50 synthetic fixture, cursor pagination helper, readiness evaluator, and direct-pilot scale target constants.
- Upgraded scale-critical Supabase read contracts to `phase69_paginated_contract` for dashboard state, internal copilot tools, client create scaffold, and client AI/profile patch.
- Added aggregate direct pilot scale fields to operational health without raw client/message/channel/provider content.
- Tests cover 5,000-client fixture counts, active-client percentage, pagination cursors, limit caps, invalid inputs, read contract status, readiness failures, and aggregate-only operational-health output.
- Verification passed with core tests 122/122, app tests 176/176, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No real Gemini, WhatsApp, Telegram, monitoring, secret manager, production Supabase migration, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

Next:

- Implement Phase 70 User-Supplied Form Hardening only after the user supplies the final dietitian/client form package.

## Phase 68: Green Maximization Intent Taxonomy - Completed 2026-06-05

Goal: add deterministic green intent taxonomy evidence and fail-closed sensitive-intent blocking without weakening approved-source answerability or downgrading yellow/red decisions.

Status:

- Added `docs/PHASE_68_GREEN_MAXIMIZATION_INTENT_TAXONOMY_SPEC.md`.
- Added `GREEN_INTENT_TAXONOMY_VERSION` and `evaluateGreenIntentTaxonomy` in the core package.
- Orchestrator evaluates taxonomy after approved-source answerability and before provider generation.
- Green allowed intents record `contextManifest.greenIntent.intentFamily` for audit coverage.
- Green-looking sensitive calorie/macro/portion, medication/supplement, lab, symptom, plan-change, active-plan conflict, and emergency/sensitive-context requests block with internal handoff/no-send and `providerAttempted=false`.
- Yellow/red decisions receive `not_applicable_non_green` metadata and are not downgraded.
- Verification passed with core tests 122/122, app tests 171/171, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No real Gemini, WhatsApp, Telegram, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

Next:

- Phase 69 completed Direct 5,000 Client Scale Foundation.
- Then implement Phase 70 User-Supplied Form Hardening after the user supplies final forms.

## Phase 67: Approved Source Answerability Engine - Completed 2026-06-05

Goal: require green-risk client-facing AI sends to be answerable from approved sources before provider generation.

Status:

- Added `docs/PHASE_67_APPROVED_SOURCE_ANSWERABILITY_ENGINE_SPEC.md`.
- Added `APPROVED_SOURCE_ANSWERABILITY_VERSION` and `evaluateApprovedSourceAnswerability` in the core package.
- PromptContext diet plan source now includes active plan fields when a summary is empty.
- Orchestrator evaluates answerability after PromptContext compilation and before provider generation.
- Green messages with no approved source support create internal handoff/no-send with `providerAttempted=false`.
- AI-generated sent messages are excluded from source authority.
- Dietitian manual messages, active diet plan, prompt-allowed form summary, context updates, pinned notes, allergies, and restricted foods can support answerability.
- Verification passed with core tests 120/120, app tests 171/171, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No real Gemini, WhatsApp, Telegram, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

Next:

- Phase 68 completed Green Maximization Intent Taxonomy.
- Phase 69 completed Direct 5,000 Client Scale Foundation.
- Then implement Phase 70 User-Supplied Form Hardening after the user supplies final forms.

## Phase 66: Product Communication Covenant Lock - Completed 2026-06-05

Goal: encode the direct 100-dietitian plan's product communication covenant into local prompt, provider-output, draft, send-time, simulator, and documentation controls.

Status:

- Added `docs/PHASE_66_PRODUCT_COMMUNICATION_COVENANT_LOCK_SPEC.md`.
- Added `PRODUCT_COMMUNICATION_COVENANT_VERSION` and multilingual `detectProductCommunicationCovenantIssues` in the core response-quality guard.
- PromptContext now carries a system covenant instruction.
- Provider output safety records covenant violations as `product_communication` block issues.
- Mock provider output self-checks the covenant and no longer emits yellow referral/approval language.
- Handoff acknowledgement text is internal-only and no longer contains client-facing referral copy.
- Send-time draft approval blocks non-green AI drafts and covenant-violating green draft edits.
- Tests prove green covenant violations are send-blocked, yellow/red do not create client-facing AI sends, and yellow AI drafts cannot be approved into client-facing AI sends.
- Verification passed with core tests 116/116, app tests 170/170, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain.
- No real Gemini, WhatsApp, Telegram, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

Next:

- Phase 67 completed Approved Source Answerability Engine.
- Phase 68 completed Green Maximization Intent Taxonomy.
- Phase 69 completed Direct 5,000 Client Scale Foundation.
- Then implement Phase 70 User-Supplied Form Hardening after the user supplies final forms.

## Phase 65: Official Regulation PDF Corpus QA Foundation - Completed 2026-06-04

Goal: create a fail-closed local foundation for turning user-supplied official health-regulation PDFs into traceable draft corpus rules without approving or activating production routing.

Status:

- Added `docs/PHASE_65_OFFICIAL_REGULATION_PDF_CORPUS_QA_SPEC.md`.
- Added `app/src/lib/official-regulation-corpus.ts` with source metadata, checksum, page extraction, page/section map, derived rule draft, golden-case, QA evaluation, draft scope-rule conversion, and clinical evidence candidate contracts.
- Extended scope rule records with optional source references so PDF-derived draft rules can retain page/section traceability.
- QA failure blocks draft rule construction and keeps PDF corpus launch-gate evidence in `draft` status.
- QA success still creates draft rules only; no corpus approval, no active routing, no real PDF parsing, and no real data path were added.
- Verification passed from `app` with app tests 166/166 in the targeted run; full release verification is recorded in the evidence pack.
- Production pilot remains `NO-GO`.

Next:

- Phase 66 completed Product Communication Covenant Lock from `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`.
- Next implement Approved Source Answerability Engine, Green Maximization Intent Taxonomy, and Direct 5,000 Client Scale Foundation before user-supplied form hardening.
- Keep official corpus activation blocked until the user supplies official PDFs and structured legal/clinical approval evidence.

## Phase 64: Structured Launch Gate Evidence Engine - Completed 2026-06-04

Goal: make launch-gate closure depend on structured, complete, non-expired external evidence rather than bare gate ids.

Status:

- Added `docs/PHASE_64_STRUCTURED_LAUNCH_GATE_EVIDENCE_ENGINE_SPEC.md`.
- Added `LaunchGateEvidenceRecord` and `evaluateProductionPilotLaunchGateEvidence` in `app/src/lib/launch-gates.ts`.
- Expanded legal/privacy and clinical required-evidence lists with Phase 63 user-supplied form and official PDF corpus requirements.
- Operational health can consume structured launch-gate evidence while keeping aggregate-safe output.
- Real scope-guard provider allowance now requires structured clinical taxonomy and provider/vendor evidence plus `MANU_ALLOW_REAL_SCOPE_GUARD=true`; legacy approved id arrays alone cannot enable real scope guard egress.
- Added tests for default blocked state, partial evidence, unknown gate ids, conditional/stale/unsanitized evidence, complete structured evidence, operational health structured evidence, and scope-guard provider gating.
- Verification passed from `app` with app tests 158/158 in the targeted run; full release verification is recorded in the evidence pack.
- No launch gate approval artifact was supplied, no gate was closed, and no real provider/channel/data path was connected.
- Production pilot remains `NO-GO`.

Next:

- Phase 65 completed the official regulation PDF corpus QA foundation.
- Then implement user-supplied form schema hardening, pagination/scoped reads, transactional redaction RPC, Gemini integration, and WhatsApp adapter as separate gated phases.

## Phase 63: Production Pilot GO Rebaseline - Completed 2026-06-04

Goal: rebaseline production-pilot planning from a small local pilot assumption to a WhatsApp-first, Gemini-only pilot program sized for up to 100 dietitians with 50+ clients each.

Status:

- Added `docs/PHASE_63_PRODUCTION_PILOT_GO_REBASELINE_SPEC.md`.
- Locked the planning target: WhatsApp-first, Gemini-only, green autopilot possible only after gates and only for selected qualified clients, user-supplied forms, and official health-regulation PDFs supplied by the user.
- Recorded that official PDFs must be extracted, page/section referenced, reviewed, approved, versioned, and covered by golden tests before active production scope-guard use.
- Recorded that 5,000+ client scale makes dashboard/internal-copilot pagination, scoped reloads, production rate-limit tuning, and load evidence production prerequisites.
- Verification passed from `app` with core tests 114/114, app tests 150/150, app lint, production build, and only documented R-405 findings.
- No runtime behavior, schema, dependency, provider, channel, monitoring, secret manager, backup provider, launch-gate approval, R-405 acceptance, or real-data processing was changed.
- Production pilot remains `NO-GO`.

Next:

- Phase 64 completed the structured launch-gate evidence engine.
- Phase 65 should plan and implement official regulation PDF ingestion/corpus QA before user-supplied form schema hardening, pagination/scoped reads, transactional redaction RPC, Gemini integration, and WhatsApp adapter phases.

## Phase 49: Safety, Orchestration, And Concurrency Hardening - Completed (archive)

Goal: close the verified architecture-analysis gaps that should be handled before any real provider/channel connection or production pilot.

Planned work:

- Add `docs/PHASE_49_SAFETY_ORCHESTRATION_CONCURRENCY_HARDENING_SPEC.md`.
- Expand multilingual quality-guard output blocking across all supported response languages.
- Add persona output-contract checks for emoji and short-response constraints.
- Connect health-profile flags to classifier yellow escalation.
- Add cumulative risk analysis over recent promptable messages plus the current inbound message.
- Move reusable inbound preflight evaluation into the core package and reuse it from app paths.
- Add optimistic concurrency controls for Supabase-backed write paths.
- Add tenant/client scoped rate limiting for inbound, simulator, manual reply, draft review, and internal copilot paths.
- Add expired activation lazy cleanup/audit or safe notification behavior.
- Later split `simulator.ts` into domain modules and clean up legacy `buildReplyPrompt`.

Done criteria:

- All Phase 49 risks in `docs/RISK_REGISTER.md` are either mitigated in local prototype or explicitly accepted.
- Core/app tests cover the new safety, preflight, concurrency, rate-limit, and activation behavior.
- Red-risk and preflight-blocked flows still never call a provider.
- No real WhatsApp, Telegram, Gemini/external LLM, push/email, monitoring, secret manager, or real client health data is connected.

Status:

- Planned on 2026-06-02.
- Documentation/risk lock completed as the first Phase 49 step.
- Clinical output safety completed locally: multilingual quality guard and persona output-contract checks are implemented and covered by core tests.
- Core preflight extraction and cumulative yellow-risk escalation completed locally and are covered by core/app tests.
- Concurrency and abuse protection completed for the local prototype: Supabase client-row writes use expected `context_revision` checks with controlled `409 concurrent_state_update`, and simulator/mock-channel/manual/draft/internal-copilot entrypoints use scoped app-instance rate limits with controlled `429 rate_limit_exceeded`.
- Final local cleanup completed: health-profile flags now drive context-sensitive yellow escalation, expired activation windows lazily passivate clients with safe audit/notification signals, simulator risk/model routing lives in a dedicated module, and the unused legacy `buildReplyPrompt` export was removed.
- Remaining production hardening work: distributed production rate limiting, broader multi-table transaction/revision hardening, narrowed Supabase reads for scale, and external launch-gate approvals.

## Phase 50: Production Supabase Hardening - Completed (archive)

Goal: move the local hardening from Phase 49 toward production-shaped Supabase behavior without connecting real provider/channel infrastructure.

Status:

- Phase 50 plan created on 2026-06-02 with four phases: Supabase RPC/foundation, app integration, narrowed Supabase reads, and launch-gate evidence/docs.
- Phase 1 foundation added migration `app/supabase/migrations/20260602030000_phase_50_production_hardening_foundation.sql` for database-backed rate-limit buckets and transactional commit RPC wrappers. On 2026-06-02, `npx supabase db reset --local` applied the migration to local Supabase and DB checks confirmed the rate-limit/RPC foundation exists.
- Phase 2 app integration is complete for the currently targeted local mutation paths: app entrypoints call the async scoped rate limiter, Supabase-backed limiter RPC is wired with hashed keys, and manual reply plus client-scoped inbound simulation use commit RPCs. Phase 51 added transactional message, AI-decision, handoff, form-response, and client-context update payload support for draft review, form response save, client context update, handoff status update, and red-risk reactivation.
- Phase 3 narrowed Supabase reads is partially complete: manual reply, client-scoped inbound simulation, draft approval/dismissal, human takeover release, handoff status update, red-risk reactivation, client form response save, and client context update now use client/handoff/draft scoped operation loaders instead of full tenant state reads before mutation. The scoped loaders explicitly include required target messages, decisions, handoffs, form schemas, draft messages, and draft decision rows needed for existing validation/invalidation behavior.
- Form response saves now persist changed draft invalidations after form-change state updates.
- Validation completed locally after Phase 3 changes: `app npm test` passed 126/126, `app npm run lint` passed, and `dietitian-ai-assistant npm test` passed 57/57.
- Phase 4 launch-gate evidence/docs completed locally on 2026-06-02: added `docs/PHASE_50_PRODUCTION_SUPABASE_HARDENING_EVIDENCE_SPEC.md`, updated the pilot evidence pack, gate closure dossier, final readiness summary, risk register, and handoff notes.
- Phase 4 verification: `npm run release:verify` passed from `app` with core tests 57/57, app tests 126/126, lint, production build, and only documented R-405 findings. `npm run test:rls` passed against local Supabase with 1 file and 11/11 tests, so R-406 is mitigated in the local prototype.
- Phase 51 transactional RPC coverage completed locally on 2026-06-02: added `docs/PHASE_51_TRANSACTIONAL_RPC_COVERAGE_SPEC.md`, extended `manu_commit_state_delta` with `messageUpdates`, `aiDecisionUpdates`, and `handoffUpdates`, added `commit_handoff_status`, moved draft review, form response save, client context update, handoff status update, and red-risk reactivation to RPC commits, and expanded local RLS coverage to 14/14 passing tests.
- Phase 52 integration test coverage completed locally on 2026-06-02: added `docs/PHASE_52_INTEGRATION_TEST_COVERAGE_SPEC.md`, expanded local Supabase integration coverage for rate-limit isolation, controlled rate-limit denial, stale revision rejection, and manual/inbound RPC atomicity, and expanded local RLS/integration coverage to 19/19 passing tests.
- Phase 53 scale/broad read contracts completed locally on 2026-06-02: added `docs/PHASE_53_SCALE_BROAD_READ_CONTRACTS_SPEC.md`, `app/src/lib/supabase-read-contracts.ts`, and tests that classify intentional broad legal/admin reads, future paginated dashboard/copilot/client create/patch reads, and already scoped mutation reads. `npm run release:verify` passed with core tests 57/57, app tests 130/130, lint, production build, and only documented R-405 findings.
- Phase 54 R-405 and launch gates recheck completed locally on 2026-06-02: added `docs/PHASE_54_R405_AND_LAUNCH_GATES_RECHECK_SPEC.md`, re-ran the Phase 22 stable dependency procedure, confirmed stable `next@latest` 16.2.7 still bundles nested `postcss@8.4.31`, confirmed production audit still reports only known R-405 findings, made no dependency changes, and kept all eight launch gates open because no external approval artifacts were supplied. `npm run release:verify` passed with core tests 57/57, app tests 130/130, lint, production build, and only documented R-405 findings.
- Phase 55 audit remediation safety boundary completed locally on 2026-06-03: added `docs/PHASE_55_AUDIT_REMEDIATION_SAFETY_BOUNDARY_SPEC.md`, hardened real Turkish Unicode classifier normalization, expanded multilingual pregnancy/lactation yellow routing, added prompt-injection yellow review routing, wrapped client-authored PromptContext text as data, kept safety-critical pinned notes untruncated, and added red-risk preflight regression coverage. `npm run release:verify` passed with core tests 72/72, app tests 132/132, lint, production build, and only documented R-405 findings.
- Phase 56 clinical safety second-layer local evidence completed locally on 2026-06-03: added `docs/PHASE_56_CLINICAL_SAFETY_SECOND_LAYER_LOCAL_EVIDENCE_SPEC.md`, introduced deterministic second-layer yellow escalation for context-sensitive uncertainty, recorded combined classifier evidence, and kept real LLM/provider/channel/schema/launch-gate changes out of scope. R-310 is partially mitigated in the local prototype only.
- Phase 57 yellow-risk hold/draft refresh completed locally in code on 2026-06-03: added `docs/PHASE_57_YELLOW_RISK_HOLD_DRAFT_REFRESH_SPEC.md`, introduced `yellowRiskHold`, passivated AI on yellow risk, refreshed the same pending draft for later green/yellow messages, preserved the yellow draft when later red risk creates a manual lock, and added `clients.yellow_risk_hold` migration/RPC support. Verification passed with app simulator tests 34/34, app tests 135/135, core tests 75/75, app lint, and `npm run release:verify`. Local Supabase/RLS evidence remains open because Docker Desktop Linux engine was unavailable; `npx supabase db reset --local` failed before applying the Phase 57 migration and `npm run test:rls` skipped 20/20 tests.
- Phase 58 dietitian client language control completed locally on 2026-06-03: added `docs/PHASE_58_DIETITIAN_CLIENT_LANGUAGE_CONTROL_SPEC.md`, synchronized client creation/profile language fields, made language changes prompt-affecting, and verified subsequent AI replies use the dietitian-selected language. Targeted verification passed with 54/54 tests.
- Phase 59 architecture review remediation completed locally on 2026-06-03: added `docs/PHASE_59_ARCHITECTURE_REVIEW_REMEDIATION_SPEC.md`, fail-closed unknown AI modes, core provider error boundary, clinical taxonomy hardening, simulator yellow-hold helper refactor, multilingual voice-profile scoring, and provider-native token counting documented as a future gate. Verification passed with core tests 85/85, app tests 137/137, app lint, and `npm run release:verify`. No schema/RLS, dependency, real provider, channel, launch-gate, or R-405 changes.
- Phase 60 audit remediation completed locally on 2026-06-03: added `docs/PHASE_60_AUDIT_REMEDIATION_SPEC.md`, fixed glucose false-positive extraction (`dietetic-risk-v0.3.1`), core `providerOutputSafety` on provider failures, architecture type-contract alignment, expanded tests, and documentation continuity updates. Verification passed with core tests 104/104, app tests 138/138, app lint, and `npm run release:verify`.
- Phase 62 architecture review remediation wave 2 completed locally on 2026-06-04: added `docs/PHASE_62_ARCHITECTURE_REVIEW_REMEDIATION_WAVE2_SPEC.md`, provider-failure dietitian handoff (no client send), shared `normalizeSafetyText`, overlap scope retrieval, glucose cost-unit filter, constraint-accepted notes for Bulgu 3/9/10. Verification passed with core tests 114/114, app tests 150/150, app lint, and `npm run release:verify`. Bulgu 1 unchanged by product decision.
- Phase 61 scope guard (RAG + LLM) second layer mock-first completed locally on 2026-06-04: added `docs/PHASE_61_SCOPE_GUARD_RAG_SECOND_LAYER_SPEC.md`, core `scope-guard.js` escalate-only merge, app mock lexical retrieval + deterministic evaluator + runtime wiring after `classifySimulationRisk`, Supabase `scope_rules` / `scope_rule_chunks` / `scope_guard_evaluations` migration with RLS, placeholder draft corpus (inactive by default), operational-health corpus signals, launch-gate scope corpus evidence on `clinical_taxonomy_approval`, and disconnected real embedding/LLM seams. Verification passed with core tests 112/112, app tests 150/150, app lint, and `npm run release:verify`. Real Gemini/embedding not connected; production pilot remains `NO-GO`.

## Phase 62: Architecture Review Remediation Wave 2 - Completed 2026-06-04

Goal: remediate actionable post–Phase 61 architecture findings without changing Bulgu 1 (passive/manual red routing) or connecting real providers.

Status:

- Provider failure on active clients → `handoff` + dietitian notification; no client-facing AI reply.
- Shared `normalize-safety-text.js`; overlap retrieval; glucose TL/lira skip; `modelForRisk` removed.
- Bulgu 3/9/10 documented as constraint-accepted in RISK_REGISTER and Phase 62 spec.
- Verification: core 114/114, app 150/150, `npm run release:verify` passed (R-405 only).

Remaining:

- Design a dedicated transactional payload for client removal/anonymization bulk redaction before moving that lifecycle fully to RPC commits.
- Implement dashboard/internal-copilot pagination and client create/patch scoped reloads only after accepting the Phase 53 contracts; keep that work separate from mutation refactors.
- Approve and load real dietetic-regulation corpus via `clinical_taxonomy_approval` before scope guard is active in production-shaped pilots.
- Re-run `npm run test:rls` against local Supabase when available to record Phase 61 `scope_*` table RLS evidence.
- Keep all eight production-pilot launch gates open until external approval artifacts are supplied.

## Phase 61: Scope Guard (RAG + LLM) Second Layer Mock-First - Completed 2026-06-04

Goal: add an independent second safety axis for dietetic-regulation (scope) tasks using mock-first RAG-shaped retrieval and a deterministic evaluator, merged escalate-only with the existing classifier, without connecting real Gemini/embedding.

Planned work:

- Add `docs/PHASE_61_SCOPE_GUARD_RAG_SECOND_LAYER_SPEC.md`.
- Add core `dietitian-ai-assistant/src/scope-guard.js` (`mergeScopeDecision`, `applyScopeRules`, `SCOPE_GUARD_VERSION`).
- Add app corpus governance, mock lexical `RetrievalProvider`, mock `ScopeEvaluator`, and `scope-guard-runtime` wiring after `classifySimulationRisk`.
- Add Supabase `scope_rules`, `scope_rule_chunks`, `scope_guard_evaluations` with tenant read / system write RLS.
- Add placeholder draft corpus (inactive by default), operational-health signals, and launch-gate scope corpus evidence on `clinical_taxonomy_approval`.
- Keep real embedding/LLM disconnected behind env + gate (`MANU_ALLOW_REAL_SCOPE_GUARD=true`).

Done criteria:

- Core and app tests cover escalate-only merge, no-op on empty/unapproved corpus, fail-safe unavailable escalation, and prompt-injection-as-data boundaries.
- `npm run release:verify` passes with only documented R-405 findings.
- Production pilot remains `NO-GO`; no launch gate closed; R-405 untouched.

Status:

- Completed locally on 2026-06-04.
- Verification: core tests 112/112, app tests 150/150, app lint, `npm run release:verify` passed.
- R-310 partially mitigated in local prototype; qualified dietitian taxonomy and approved regulation corpus still required for production.

## Phase 48: R-405 Stable Patch Recheck - Completed 2026-06-01

Goal: re-check whether a safe stable Next.js/PostCSS remediation path exists before any dependency edit.

Status:

- Added `docs/PHASE_48_R405_STABLE_PATCH_RECHECK_SPEC.md`.
- Ran `npm view next@latest version dependencies --json`.
- Ran `npm view eslint-config-next@latest version --json`.
- Ran `npm audit --omit=dev --json`.
- Confirmed `next@latest` is `16.2.7`.
- Confirmed stable Next still bundles nested `postcss@8.4.31`.
- Confirmed `eslint-config-next@latest` is `16.2.7`.
- Confirmed production audit still reports only the known moderate R-405 `next`/`postcss` findings.
- No dependency files were changed.
- R-405 remains open.

## Phase 47: RLS Quarantine Evidence Coverage - Completed 2026-06-01; R-406 Still Blocked

Goal: include the Phase 46 `inbound_quarantines` table in the expanded RLS evidence suite.

Status:

- Added `docs/PHASE_47_RLS_QUARANTINE_EVIDENCE_SPEC.md`.
- Added `inbound_quarantines` fixtures to the Supabase RLS integration test.
- Added tenant-member, outsider, assistant, auditor, and cross-tenant write checks for quarantine rows.
- Added Supabase-backed group quarantine persistence coverage.
- `npm run lint` passed from `app`.
- `npm run test` passed from `app`: 16 files, 117 tests.
- `npm run test:rls` skipped 1 file and 11 guarded tests because Docker Desktop's Linux engine is unavailable.
- R-406 remains blocked until the expanded 11-test suite passes against local Supabase.

## Phase 46: WhatsApp Group Quarantine - Completed 2026-06-01

Goal: ensure WhatsApp group messages are treated as unsupported high-risk inbound context and never reach client-specific AI processing.

Work:

- Added `InboundQuarantineRecord`.
- Added Supabase `inbound_quarantines` table.
- Added simulator support for `sourceConversationType="group"`.
- Group messages are quarantined before client lookup, risk classification, context assembly, provider call, message storage, AI decision, risk assessment, or handoff creation.
- Group quarantine records store only minimized provenance metadata and never raw group message text.
- Added `inbound_group_message_quarantined` audit event.
- Duplicate group events remain idempotent.

Done criteria:

- Group messages cannot be promptable.
- Group messages cannot cause automatic replies or drafts.
- Group messages cannot be accidentally attached to one client identity.
- No real provider, channel, launch-gate approval, or real health-data connection is introduced.

Status:

- Completed locally on 2026-06-01.
- `npm run lint` passed from `app`.
- `npm run test` passed from `app`: 16 files, 117 tests.
- `npm run release:verify` passed from `app`: core tests 52/52, app tests 117/117, lint, production build, known R-405 only.
- R-405 remains open and R-406 remains blocked.

## Phase 45: Client Removal Data Lifecycle - Completed 2026-06-01

Goal: make "remove client" a soft-delete/anonymization operation that hides the client from normal operations and clears promptable health/channel/message/form/memory data while retaining minimized legal/audit metadata.

Work:

- Added `ClientRecord.lifecycleStatus` and `removedAt`.
- Added Supabase `clients.lifecycle_status` and `removed_at`.
- Added `/api/clients/[id]/remove` and dashboard remove action.
- Removed clients are hidden from normal dashboard client lists and simulator selection.
- Removed clients are blocked from inbound simulation, manual replies, profile edits, form response save, and internal copilot tools.
- Removal redacts promptable profile, phone/channel identifiers, memory summaries, messages, form response answers/submitted phone, context updates, handoff text, notification text, AI decision details, risk assessment reasons, and active red-risk/takeover state.
- Removal records a completed `deletion` data request and `client_removed_anonymized` audit event.

Done criteria:

- Removed clients cannot remain in promptable context.
- Removed clients cannot be matched through normal dashboard/client-facing operations.
- Export remains available as a minimized legal/audit bundle.
- Hard delete remains legal-review gated.
- No real provider, channel, launch-gate approval, or real health-data connection is introduced.

Status:

- Completed locally on 2026-06-01.
- `npm run lint` passed from `app`.
- `npm run test` passed from `app`: 16 files, 114 tests.
- `npm run release:verify` passed from `app`: core tests 52/52, app tests 114/114, lint, production build, known R-405 only.
- R-405 remains open and R-406 remains blocked.

## Phase 44: Red-Risk Reactivation Lock - Completed 2026-06-01

Goal: prevent AI from re-entering a clinically sensitive red-risk conversation until the dietitian explicitly closes the handoff and reactivates AI.

Work:

- Added `ClientRecord.redRiskLock` and Supabase `clients.red_risk_lock`.
- Red-risk handoff creation now forces `aiStatus=passive`, `aiMode=manual`, and `humanTakeoverLocked=true`.
- Direct AI reactivation, takeover release, normal handoff resolution, and red-locked handoff dismissal are blocked while the lock is active.
- Manual dietitian replies and notification acknowledgement do not clear the lock.
- Added `POST /api/handoffs/[id]/resolve-and-reactivate` for explicit dietitian reactivation with a required resolution reason.
- Dashboard handoff queue now shows a red-risk reactivation control; copilot is the default reactivation mode and autopilot requires completed mandatory safety.

Done criteria:

- Red-risk locks are created and audited.
- No LLM path is reachable while a red-risk lock is active.
- Reactivation is auditable and tied to the handoff, dietitian, timestamp, reason, and selected AI mode.
- No real provider, channel, launch-gate approval, or real health-data connection is introduced.

Status:

- Completed locally on 2026-06-01.
- `npm run lint` passed from `app`.
- `npm run test` passed from `app`: 16 files, 112 tests.
- `npm run release:verify` passed from `app`: core tests 52/52, app tests 112/112, lint, production build, known R-405 only.
- R-405 remains open and R-406 remains blocked.

## Phase 0: Baseline, Documentation, And Workspace Safety

Goal: make the current state and next execution path unambiguous before adding more features.

Work:

- Keep this file as the canonical next-phase execution plan.
- Keep `PLAN.md`, `PROJECT_PLAN.md`, `HANDOFF_FOR_NEXT_CODEX.md`, `docs/RISK_REGISTER.md`, `docs/DATA_INVENTORY.md`, `docs/MOBILE_APP_STRATEGY.md`, and `docs/NEXT_SUPABASE_FOUNDATION_SPEC.md` aligned with the current state.
- Record that this workspace currently has no `.git` directory, so rollback/checkpoint strategy is an operational risk until the user chooses a VCS/checkpoint approach.
- Keep the real-channel/provider boundary explicit in every handoff.

Done criteria:

- Documentation has no conflicting next-action lists.
- The current completed work from 2026-05-25 is represented in the plan and handoff docs.
- Open risks include VCS/checkpoint, dependency audit, consent, notification, data governance, provider, and channel gates.
- No real external messaging or model provider is connected.

## Phase 1: Pilot Foundation Hardening - Completed 2026-05-25

Goal: reduce brittleness in the local pilot foundation.

Work:

- Expand Playwright visual coverage for draft approval, red handoff, safety-checklist-blocked, and mobile overflow states.
- Add tests for forced fallback mode and risk assessment duplicate behavior.
- Add controlled API errors for unknown client/conversation and invalid draft operations.
- Keep dependency audit findings documented; do not run `npm audit fix --force` because the current suggested fix is breaking.

Done criteria:

- Core tests pass.
- App lint, unit tests, build, and visual tests pass.
- RLS tests run only against local Supabase unless explicitly overridden.
- Dependency risk has an explicit documented decision.
- Known local API failures return controlled JSON errors instead of uncontrolled exceptions.
- Long message content does not create horizontal overflow in desktop, tablet, or mobile visual smoke checks.

Status:

- Completed in the local prototype on 2026-05-25.
- Continue treating real WhatsApp, Telegram, Gemini, and real health data as disconnected.
- Dependency risk R-405 remains open until a safe Next.js/PostCSS patch path exists.

## Phase 2: Production-Style Auth And Onboarding Shell - Completed 2026-05-25

Goal: separate local demo auth from production tenant/dietitian onboarding behavior.

Work:

- Keep demo sign-in for local testing.
- Add production-style login and empty/error states for unauthenticated, no membership, and missing dietitian profile.
- Keep demo bootstrap isolated to demo endpoints.
- Show role/membership state in the UI without enabling incomplete assistant access controls.

Done criteria:

- Authenticated tenant members can reach the dashboard.
- Users without membership see a controlled forbidden state.
- Users with membership but no dietitian profile see a controlled onboarding/error state.
- Fallback local mode still works.
- Demo and production auth behavior are documented separately.

Status:

- Confirmed that `proxy.ts` is the native Next.js 16 middleware — no separate `middleware.ts` needed. Build output shows `ƒ Proxy (Middleware)`.
- Added `/api/auth-state` endpoint that returns user auth/membership/profile state without loading full app state.
- Added server-side auth resolution in `dashboard/page.tsx` with distinct UI states for no-membership and no-dietitian-profile.
- Added `NoMembershipState` and `NoDietitianProfileState` UI components in `auth-states.tsx`.
- Updated `use-manu-state.ts` to capture and expose 401/403 auth errors instead of silently falling back.
- Added `MembershipBadge` showing authenticated user display name and role in dashboard header.
- Added `authError` handling in `DashboardApp` with session error state and sign-in redirect.
- Added 6 auth-context unit tests. App tests: 24/24.
- Demo auth path unchanged. Fallback mode unchanged.
- See `docs/PHASE_2_AUTH_ONBOARDING_SHELL_SPEC.md` for full spec.

## Phase 3: Consent, Permission, And Channel Governance - Completed 2026-05-25

Goal: prepare safe channel permission enforcement before real WhatsApp or Telegram adapters.

Work:

- Extend permission tracking beyond `ready`, `pending`, and `blocked` with opt-in/out metadata.
- Add internal opt-out simulation and audit behavior.
- Design unknown and ambiguous identity quarantine flows.
- Keep client-facing legal copy out of the app until the user-provided documents exist.

Done criteria:

- Permission-blocked clients cannot trigger AI generation.
- Permission-pending clients cannot trigger AI generation (NEW — previously only blocked was checked).
- Permission-opted-out clients cannot trigger AI generation (NEW).
- Permission changes are audited with previous/new values and distinct opt-out event type.
- Unknown or ambiguous identities cannot reach the orchestrator (empty channelUserId, unknown adultStatus).
- Real WhatsApp and Telegram credentials remain disconnected.

Status:

- Extended `PermissionState` type with `opted_out` value.
- Strengthened `getPreflightBlock()`: only `channelPermission === "ready"` allows AI generation.
- Added identity quarantine: empty `channelUserId` blocks AI.
- Added identity quarantine: `adultStatus === "unknown"` blocks AI.
- Added permission change auditing with `channel_permission_changed` and `channel_permission_opted_out` events.
- Updated dashboard UI with `opted_out` permission option.
- Added 6 new simulator tests. App tests: 30/30.
- See `docs/PHASE_3_CONSENT_PERMISSION_CHANNEL_GOVERNANCE_SPEC.md` for full spec.

## Phase 4: Handoff Notification Architecture - Completed 2026-05-25

Goal: make urgent handoffs operationally visible without sending external notifications yet.

Work:

- Add an in-app notification model and notification center.
- Convert the current `handoff_notification_queued` audit event into a backed notification record.
- Add mobile-focused urgent handoff views.
- Document future email/push adapters and the rule that external notifications must not include raw health-message content.

Done criteria:

- Red handoffs create notification records.
- Notifications can be read or acknowledged in the dashboard.
- Notification body never contains raw client message content (safe text only).
- Mobile viewport can handle urgent handoff review.
- No external push/email provider is connected.

Status:

- Added `NotificationRecord` type and `notifications` state array.
- Handoff creation in simulator creates safe-text notification records.
- Added `/api/notifications/[id]/read` and `/api/notifications/[id]/acknowledge` endpoints.
- Added Notification Center UI in dashboard header with unread badge and dropdown panel.
- Added 2 new tests verifying notification creation and safe-text rules. App tests: 32/32.
- Created `docs/PHASE_4_HANDOFF_NOTIFICATION_ARCHITECTURE_SPEC.md` for full spec.

## Phase 5: Data Governance - Completed 2026-05-25

Goal: create the technical skeleton for retention, deletion, anonymization, and export before pilot data.

Work:

- Define retention policy placeholders by table and data category.
- Add client deletion/anonymization workflow design.
- Add memory invalidation requirements.
- Add tenant/client-scoped export design.

Done criteria:

- Deleted clients cannot remain in promptable context.
- Memory invalidation is testable.
- Export scope is tenant/client bounded.
- Final retention durations remain marked as legal-review dependent.

Status:

- Added `docs/PHASE_5_DATA_GOVERNANCE_SPEC.md`.
- Added `RETENTION_POLICY_PLACEHOLDERS` with legal-review-required retention decisions.
- Added tenant/client-scoped export helpers and `/api/clients/[id]/export`.
- Added client anonymization/memory invalidation helpers and `/api/clients/[id]/anonymize`.
- Anonymization clears promptable health profile, diet plan, notes, channel identifier, conversation memory, message bodies, and AI decision references while adding a minimized audit event.
- Added tests for scoped export, promptable-context invalidation, retention placeholders, and fallback API routes. App tests: 37/37.
- Added Supabase migration `20260525010000_add_opted_out_permission_state.sql` to close the Phase 3 enum gap for `channelPermission = opted_out`.
- Final retention durations remain blocked on legal review.

## Phase 6: Clinical Governance And Evaluation - Completed 2026-05-25

Goal: move safety from prototype rules toward pilot-grade clinical governance.

Work:

- Expand the safety taxonomy and JSONL golden tests.
- Add expected risk, action, and model assertions for golden cases.
- Expand persona invariant tests.
- Document the dietitian review workflow for taxonomy changes.

Done criteria:

- Red cases never call a provider.
- Persona changes do not alter safety decisions.
- Golden test failures block safety taxonomy changes.
- Qualified dietitian approval remains a launch gate.

Status:

- Added `docs/PHASE_6_CLINICAL_GOVERNANCE_EVALUATION_SPEC.md`.
- Added `docs/CLINICAL_TAXONOMY_REVIEW_WORKFLOW.md`.
- Added JSONL clinical golden cases in `dietitian-ai-assistant/tests/clinical-golden-cases.jsonl`.
- Added `clinical-governance.test.mjs` to assert expected risk, action, model, provider-call behavior, and persona invariants.
- Expanded the safety classifier to `dietetic-risk-v0.2.0` with normalized Turkish/ASCII matching and additional minor/body-image, supplement dose, lab, medication, glucose, allergy, pregnancy, self-harm, and eating-disorder coverage.
- Core tests now include 35 tests.
- Qualified dietitian approval remains a launch gate before pilot use.

## Phase 7: Channel Adapter Readiness - Completed 2026-05-25

Goal: define WhatsApp/Telegram adapter contracts without connecting production channels.

Work:

- Define normalized inbound and outbound adapter contracts.
- Add mock adapter tests for known, unknown, ambiguous, duplicate, permission-blocked, and opt-out events.
- Define provider payload redaction rules.

Done criteria:

- Mock WhatsApp/Telegram events use the same orchestrator path.
- Unknown or ambiguous identities are quarantined.
- Duplicate events do not duplicate-send.
- Real channel credentials remain absent.

Status:

- Added `docs/PHASE_7_CHANNEL_ADAPTER_READINESS_SPEC.md`.
- Added normalized mock inbound event contract in `app/src/lib/channel-adapters.ts`.
- Added mock WhatsApp and Telegram adapter tests for known events using the same simulator/orchestrator path.
- Added unknown and ambiguous channel identity quarantine before message persistence or AI decisions.
- Added provider-event idempotency checks so duplicate mock channel events do not duplicate-send.
- Added permission-blocked and opted-out mock channel tests using the existing safety gate.
- Added provider metadata redaction helper that removes raw body, prompt, profile, diet plan, allergy, memory, and clinical note fields.
- App tests now include 45 tests.
- No real WhatsApp or Telegram credentials were connected.

## Phase 8: AI Provider Readiness - Completed 2026-05-25

Goal: prepare provider abstraction without sending real health data to an LLM provider.

Work:

- Add mock provider abstraction for generation, timeout, retry, model metadata, and provider error taxonomy.
- Add prompt version metadata to AI decisions.
- Document no-storage/no-retention provider requirements.

Done criteria:

- Mock provider works for green and yellow flows.
- Red flows never call the provider.
- Provider failure produces safe no-send or review behavior.
- Real Gemini health-data use remains blocked until vendor/legal review.

Status:

- Added `docs/PHASE_8_AI_PROVIDER_READINESS_SPEC.md`.
- Added `docs/AI_PROVIDER_REQUIREMENTS.md`.
- Added deterministic local mock provider in `app/src/lib/ai-provider.ts`.
- Simulator generation now uses the mock provider abstraction instead of inline reply generation.
- AI decisions now include `promptVersion`, `providerId`, `providerStatus`, and `providerErrorCode`.
- Added Supabase migration `20260525020000_ai_provider_decision_metadata.sql`.
- Provider timeout/error failures produce safe `no_ai` decisions without outbound AI messages.
- Red and preflight-blocked flows keep provider status as `not_called`.
- App tests now include 49 tests.
- No real Gemini or external LLM provider was connected.

## Phase 9: Pilot Readiness Closure - Completed 2026-05-25

Goal: close the next operational gaps before any production channel or provider integration.

Work:

- Add a local Git checkpoint strategy and root ignore rules.
- Align app seed and RLS test classifier metadata with `dietetic-risk-v0.2.0`.
- Add Supabase persistence for in-app notification records.
- Make Supabase notification read and acknowledge endpoints tenant-scoped instead of returning `501`.
- Keep dependency audit risk documented without applying breaking `npm audit fix --force`.

Done criteria:

- Core tests pass.
- App lint, unit tests, build, and visual tests pass.
- RLS notification coverage exists and skips safely unless local Supabase is available.
- No real WhatsApp, Telegram, Gemini, push/email provider, or real health data is connected.

Status:

- Added `docs/PHASE_9_PILOT_READINESS_CLOSURE_SPEC.md`.
- Initialized local Git repository and added root `.gitignore`.
- Added migration `20260525030000_notifications.sql`.
- Supabase store now loads and persists notification records.
- Supabase notification read and acknowledge APIs now update persisted notification records.
- Fallback notification APIs now return controlled `notification_not_found` errors for unknown IDs.
- App tests now include 51 tests.
- Local Supabase migrations were applied with `npx supabase db push --local`; RLS integration tests passed 5/5 against local Supabase with fallback disabled.
- R-405 remains open by explicit decision: stable Next.js 16.2.6 still pins nested PostCSS 8.4.31, canary Next.js is not a safe pilot baseline, npm override invalidates the dependency tree, and `npm audit fix --force` proposes a breaking downgrade.

## Phase 10: Production Readiness Gates - Completed 2026-05-25

Goal: make external production-pilot approvals explicit and testable before real providers, channels, or health data are connected.

Work:

- Define the required production-pilot launch gate set.
- Keep all gates externally approved only; the app must not claim legal, clinical, provider, or channel approval by itself.
- Add a machine-readable evaluator that reports approved, open, and ignored gate ids.
- Keep the default state blocked.

Done criteria:

- Missing approval input blocks launch.
- Unknown approval keys are ignored.
- Launch is allowed only when every known gate is approved.
- No real WhatsApp, Telegram, Gemini, push/email provider, or real health data is connected.

Status:

- Added `docs/PHASE_10_PRODUCTION_READINESS_GATES_SPEC.md`.
- Added `app/src/lib/launch-gates.ts` with the production-pilot gate set and evaluator.
- Added launch gate unit tests. App tests now include 54 tests.

## Phase 11: Operational Evidence Readiness - Completed 2026-05-25

Goal: connect production-pilot launch gates to concrete evidence expectations and draft runbooks without approving the gates.

Work:

- Add required evidence labels to every production-pilot gate.
- Draft incident response, backup/restore, and secret rotation runbooks.
- Keep launch blocked by default and approval external.

Done criteria:

- Every launch gate has at least one required evidence item.
- Every launch gate remains externally approved only.
- Runbooks contain no production secrets, real client identifiers, or raw health data.
- No real WhatsApp, Telegram, Gemini, push/email provider, monitoring vendor, or secret manager is connected.

Status:

- Added `docs/PHASE_11_OPERATIONAL_EVIDENCE_READINESS_SPEC.md`.
- Added `docs/INCIDENT_RESPONSE_RUNBOOK.md`.
- Added `docs/BACKUP_RESTORE_RUNBOOK.md`.
- Added `docs/SECRET_ROTATION_RUNBOOK.md`.
- Extended `app/src/lib/launch-gates.ts` with `requiredEvidence`.
- Added launch gate evidence coverage. App tests now include 55 tests.

## Phase 12: RBAC Authorization - Completed 2026-05-25

Goal: make production Supabase API paths fail closed by role before assistant/auditor access is expanded.

Work:

- Add typed tenant roles to app auth context.
- Add a capability helper for Supabase-backed API routes.
- Preserve owner/admin/dietitian access to current workflows.
- Restrict assistant/auditor to read-only app-state access until client assignments and minimized auditor views exist.

Done criteria:

- Unknown or unsupported roles cannot perform production actions.
- Assistant/auditor mutation, export, anonymization, simulator, draft, handoff, takeover, and notification actions return controlled 403 errors.
- Fallback local demo mode remains unchanged.
- No real WhatsApp, Telegram, Gemini, push/email provider, monitoring vendor, secret manager, or real health data is connected.

Status:

- Added `docs/PHASE_12_RBAC_AUTHORIZATION_SPEC.md`.
- Added `TenantRole`, `AppCapability`, `hasCapability()`, and `requireCapability()`.
- Supabase-backed API routes now check capability before existing production actions.
- App tests now include 58 tests.

## Phase 13: Client Assignment And Scoped Access - Completed 2026-05-25

Goal: add client assignment foundations and role-scoped Supabase app-state loading before assistant/auditor access is expanded.

Work:

- Add a `client_assignments` table and RLS policy.
- Filter Supabase-loaded app state by role and assignment.
- Keep owner/admin tenant-wide.
- Keep dietitian scoped to owned plus assigned clients.
- Keep assistant scoped to assigned clients only.
- Keep auditor free of raw client/message state until a minimized auditor view exists.

Done criteria:

- Unassigned assistant receives no raw client records.
- Auditor receives no raw clients, messages, AI decisions, handoffs, notifications, or risk assessments.
- Assignment tenant isolation is covered by RLS integration.
- Fallback local demo mode remains unchanged.

Status:

- Added `docs/PHASE_13_CLIENT_ASSIGNMENT_SCOPED_ACCESS_SPEC.md`.
- Added migration `20260525040000_client_assignments.sql`.
- Added `scopeSupabaseState()` and scoped access unit tests.
- Added RLS integration assertions for `client_assignments`.
- App tests now include 62 tests.

## Phase 14: DSAR, Retention, And Legal Ops Ledger - Completed 2026-05-25

Goal: record client data export and anonymization operations in a tenant/client-scoped legal operations ledger.

Work:

- Add `data_requests` records to local app state and Supabase.
- Record completed export and anonymization operations.
- Include client-scoped data request history in export bundles.
- Keep final retention durations and deletion automation behind legal review.

Done criteria:

- Export creates a completed `export` data request.
- Anonymization creates a completed `anonymization` data request.
- Export bundles include only the target client's data request history.
- RLS integration covers `data_requests` tenant isolation.
- No automatic destructive deletion job is added.

Status:

- Added `docs/PHASE_14_DSAR_RETENTION_LEGAL_OPS_SPEC.md`.
- Added migration `20260525050000_data_requests.sql`.
- Added `DataRequestRecord` and `dataRequests` state.
- Supabase and fallback export/anonymization paths now record legal ops ledger entries.
- App tests now include 63 tests.

## Phase 15: Safe Observability And Operational Health - Completed 2026-05-25

Goal: add safe internal operational health signals without connecting a monitoring vendor or exposing raw health data.

Work:

- Add an operational health snapshot helper.
- Count safe aggregate operational signals.
- Include production-pilot launch gate blocked status.
- Document future monitoring payload rules.

Done criteria:

- Snapshot includes only aggregate counts and launch gate ids.
- Snapshot excludes message bodies, prompts, channel identifiers, health profiles, audit metadata, provider credentials, and secrets.
- No external monitoring, analytics, logging, email, push, WhatsApp, Telegram, Gemini, or secret-manager integration is connected.

Status:

- Added `docs/PHASE_15_SAFE_OBSERVABILITY_OPERATIONAL_HEALTH_SPEC.md`.
- Added `docs/ERROR_MONITORING_POLICY.md`.
- Added `app/src/lib/operational-health.ts`.
- Added safe snapshot tests. App tests now include 66 tests.

## Phase 16: Channel Policy Simulation Hardening - Completed 2026-05-25

Goal: harden local channel-policy behavior before real WhatsApp or Telegram webhooks.

Work:

- Add mock channel policy preflight checks.
- Block missing provider event ids before client lookup or AI processing.
- Block empty channel message bodies before client lookup or AI processing.
- Handle explicit opt-out commands without entering the AI path.
- Keep audit metadata minimized.

Done criteria:

- Missing provider event id creates no messages, AI decisions, or risk assessments.
- Empty channel body creates no messages, AI decisions, or risk assessments.
- Matched-client opt-out commands set `channelPermission = opted_out`.
- Duplicate opt-out or empty-body provider events are ignored by idempotency.
- Channel policy audit metadata excludes raw message bodies and channel identifiers.
- Real WhatsApp, Telegram, Gemini, monitoring, email, push, secret manager, and real health data remain disconnected.

Status:

- Added `docs/PHASE_16_CHANNEL_POLICY_SIMULATION_HARDENING_SPEC.md`.
- Hardened `processMockChannelInbound()` with channel policy preflight checks.
- Added exact opt-out command handling for `STOP`, `DUR`, `IPTAL`, `IPTAL ET`, and `CANCEL`.
- Added channel adapter tests. App tests now include 70 tests.

## Phase 17: Provider Policy Guard And Prompt Boundary - Completed 2026-05-25

Goal: add a local provider payload boundary before any real LLM provider is connected.

Work:

- Add a runtime mock-provider input guard.
- Allow only `risk` and `client.dietPlan.summary` into mock provider input.
- Reject prompt/capsule/message/memory style payloads at the provider boundary.
- Reject red-risk provider calls as defense in depth.
- Convert provider policy violations into safe no-send simulator decisions.

Done criteria:

- Valid green and yellow mock provider calls still work.
- Raw prompt, capsule, message collection, memory, channel identity, health profile, clinical notes, and pinned notes cannot be passed into the mock provider input.
- Red-risk provider calls fail closed at the provider boundary.
- Simulator records provider policy violations as controlled failed-provider no-send decisions.
- Real Gemini, external LLMs, monitoring, analytics, secret manager, real channels, and real health data remain disconnected.

Status:

- Added `docs/PHASE_17_PROVIDER_POLICY_GUARD_PROMPT_BOUNDARY_SPEC.md`.
- Added `buildMockProviderInput()` and `assertMockProviderInputPolicy()`.
- Updated simulator provider calls to use the allowlisted provider input builder.
- Added provider and simulator tests. App tests now include 75 tests.

## Phase 18: Notification SLA And Internal Escalation - Completed 2026-05-25

Goal: add safe internal SLA signals for handoff notifications without external notification providers.

Work:

- Define local acknowledgement SLA thresholds for urgent and standard handoff notifications.
- Count unacknowledged open handoff notifications that breach SLA.
- Count urgent handoff notifications due for internal escalation.
- Add SLA counts to the safe operational health snapshot.
- Keep all output aggregate-only.

Done criteria:

- Acknowledged notifications are not counted as breaches.
- Notifications tied to resolved or missing handoff cases are ignored.
- Urgent notifications older than 15 minutes are counted as escalation due.
- Standard notifications older than 4 hours are counted as SLA breaches.
- Operational health exposes only aggregate SLA counts.
- Real email, push, WhatsApp, Telegram, monitoring, analytics, secret manager, and real health data remain disconnected.

Status:

- Added `docs/PHASE_18_NOTIFICATION_SLA_INTERNAL_ESCALATION_SPEC.md`.
- Added `app/src/lib/notification-sla.ts`.
- Added notification SLA tests.
- Extended operational health snapshot with SLA breach and urgent escalation counts.
- App tests now include 78 tests.

## Phase 19: Release Verification, CI Script, And Dependency Gate - Completed 2026-05-25

Goal: add a repeatable local release verification command and conservative dependency audit gate.

Work:

- Add a local release verification script.
- Run core package tests, lint, unit/API tests, production build, and production dependency audit from one command.
- Keep R-405 visible without applying breaking `npm audit fix --force`.
- Fail on unknown production audit findings.
- Keep RLS and visual tests as separate explicit checks.

Done criteria:

- `npm run release:verify` exists.
- The command passes when the only production audit findings are the documented R-405 Next.js/PostCSS findings.
- The command fails closed for malformed audit output, unknown production findings, or high/critical production findings.
- Dependency gate output states that R-405 remains a production launch blocker.
- No dependency upgrade, provider, real channel, monitoring, analytics, or real health data is connected.

Status:

- Added `docs/PHASE_19_RELEASE_VERIFICATION_DEPENDENCY_GATE_SPEC.md`.
- Added `app/scripts/release-verify.mjs`.
- Added app `release:verify` npm script.
- Phase 19 verification passed with 35 core tests, 78 app tests, and the known R-405 production audit warning.

## Phase 20: Pilot Readiness Evidence Pack - Completed 2026-05-25

Goal: collect pilot-foundation evidence without approving production launch gates.

Work:

- Create a pilot readiness evidence pack.
- Map all production-pilot launch gates to current internal evidence and remaining blockers.
- Record the latest release verification result.
- Keep external approval status explicit.

Done criteria:

- All eight launch gates are listed.
- Internal evidence and external approval are clearly separated.
- Production pilot remains blocked.
- R-405 remains open.
- No real provider, real channel, external notification, monitoring, secret manager, or real health data is connected.

Status:

- Added `docs/PHASE_20_PILOT_READINESS_EVIDENCE_PACK_SPEC.md`.
- Added `docs/PILOT_READINESS_EVIDENCE_PACK.md`.
- Evidence pack initially recorded the Phase 20 `npm run release:verify` result: 35 core tests, 78 app tests, lint, build, and known R-405 audit warning. The current evidence pack is updated later with the Phase 26 verification baseline.

## Phase 21: External Approval Dossier - In Progress

Goal: prepare external approval materials without approving launch gates or connecting real production systems.

Work:

- Create a Phase 21 PRD/tech spec before changing product behavior.
- Create a production-pilot gate closure dossier for all 8 launch gates.
- Record the latest 2026-05-28 `npm run release:verify` baseline.
- Keep R-405 open until a safe stable patch path exists or formal risk acceptance is provided.
- Keep real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, and real health data disconnected.

Done criteria:

- `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md` lists each gate, required evidence, internal evidence, missing external decision, acceptable approval artifact, and status.
- Planning and handoff docs point to external approval work as the next step.
- All gates remain open unless the user supplies external approval evidence.
- `npm run release:verify` passes with only the known R-405 production audit finding.

Status:

- Added `docs/PHASE_21_EXTERNAL_APPROVAL_DOSSIER_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`.
- Phase 21 verification on 2026-05-28 passed: 35 core tests, 78 app tests, lint, build, and known R-405 only.

## Phase 22: R-405 Dependency Remediation - Blocked Pending Stable Patch

Goal: resolve R-405 through a safe stable Next.js/PostCSS path, or keep the production launch gate blocked if no safe path exists.

Work:

- Document the R-405 remediation decision tree.
- Re-check npm metadata for `next@latest`, `next@canary`, and production audit output.
- Keep rejected fixes explicit: no `npm audit fix --force`, no canary baseline, no invalid override, and no major downgrade.
- Define the exact stable patch procedure for updating `next` and `eslint-config-next` together once a stable patched release exists.

Done criteria:

- If stable `next@latest` depends on `postcss >= 8.5.10`, update dependencies and require `npm run release:verify` plus clean production audit.
- If stable `next@latest` still depends on vulnerable PostCSS, do not change dependency files and keep R-405 open.
- R-405 cannot be marked resolved unless `npm audit --omit=dev --json` no longer reports the known findings.

Status:

- Added `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- 2026-05-31 check: `next@latest` is `16.2.6` with `postcss@8.4.31`; `eslint-config-next@latest` is `16.2.6`; `next@canary` remains rejected for pilot baseline.
- No dependency files were changed; R-405 remains an open production launch blocker.

## Phase 23: AI Context And Memory Architecture - Completed 2026-05-30

Goal: make the AI prompt context bounded, auditable, and fail-closed when the client references missing historical context.

Work:

- Add a PRD/tech spec before code changes.
- Compile a deterministic `PromptContext` with only allowlisted segments.
- Limit recent conversation context to the last 8 promptable messages plus rolling summary.
- Store/audit a `ContextManifest` without raw message text.
- Add the missing historical context invariant to system instructions.
- Guard provider output for `[ERROR: missing_historical_context]`.
- Block send/draft when the missing-history token appears and route to human takeover.
- Invalidate pending AI drafts when prompt-affecting context changes.
- Add Supabase schema fields for context revisions, memory revisions, provider output safety, token budget, and send status.

Done criteria:

- Manifest segments never contain raw client message text.
- Provider boundary receives only stripped context segments and risk.
- Missing historical context output is classified with `severity="block"`.
- Missing historical context creates `send_status="send_blocked"` and human takeover, with no client-facing AI message.
- Legacy or invalidated AI drafts cannot be approved without recompile/review.
- At Phase 23 completion time, real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, and real health data remained disconnected. Current exception: Phase 84J uses hosted-sandbox Resend SMTP only for Supabase auth magic links.

Status:

- Added `docs/PHASE_23_AI_CONTEXT_MEMORY_ARCHITECTURE_SPEC.md`.
- Added core `context-compiler.js`, prompt context rendering, context manifest metadata, and context compiler tests.
- Added provider output guard support for missing historical context block severity.
- Wired the simulator to use the bounded prompt context and safe provider boundary.
- Added draft invalidation and controlled 409 approval errors for stale/legacy drafts.
- Added Supabase migration `20260530000000_phase_23_context_send_safety.sql`.
- Phase 23 verification on 2026-05-30 passed: core tests 39/39, app tests 82/82, app lint, and production build.

## Phase 24: Dietitian Voice Sample Infrastructure - Completed 2026-05-30

Goal: collect approved dietitian message examples after onboarding and generate a reusable voice profile.

Status:

- Added `docs/PHASE_24_DIETITIAN_VOICE_SAMPLE_INFRASTRUCTURE_SPEC.md`.
- Added paste/TXT-style voice sample parsing, duplicate filtering, approval/rejection states, and 10-approved-sample generation threshold.
- Added voice sample/profile app state, fallback APIs, Supabase migration support, and dashboard `Voice` panel.
- Simulator now passes the generated dietitian voice profile to the core orchestrator when available.
- Added unit tests for parsing, duplicate handling, minimum threshold, and profile generation.

## Phase 25: Dynamic Client Form Infrastructure - Completed 2026-05-30

Goal: let the user define and later change client forms without losing old answers or leaking non-prompt fields to the LLM.

Status:

- Added `docs/PHASE_25_DYNAMIC_CLIENT_FORM_INFRASTRUCTURE_SPEC.md`.
- Added versioned form schemas, published-schema snapshots, client form responses, fallback APIs, Supabase migration support, and dashboard `Forms` panel.
- PromptContext now supports `client_form_summary`, built only from fields marked `prompt_allowed`.
- Saving a form response increments client context revision and invalidates pending AI drafts.
- Added tests for versioned responses, prompt allowlist behavior, and draft invalidation.

## Phase 26: Internal Dietitian Copilot - Completed 2026-05-30

Goal: add a read-only internal AI chat for dietitian teams using curated tenant-scoped database tools.

Status:

- Added `docs/PHASE_26_INTERNAL_COPILOT_SPEC.md`.
- Added app-state records for internal copilot messages, tool calls, and source refs.
- Added Supabase migration `20260530020000_phase_26_internal_copilot.sql` with tenant-scoped RLS policies.
- Added deterministic local/mock internal copilot tools for visible-client resolution, client snapshots, diet plans, recent messages, form responses, handoffs, and AI decision history.
- Added `/api/internal-copilot/messages` with `internal_copilot_chat` capability.
- Owner/admin/dietitian can use the internal copilot; assistant/auditor are blocked in v1.
- Added dashboard `Copilot` tab with source chips and no send-to-client action.
- Added tests for intent routing, ambiguous/hidden clients, source refs, prompt-injection-as-data behavior, fallback API persistence, RBAC, and Supabase state scoping.
- Re-verified on 2026-05-30 with `npm run release:verify`: core tests 39/39, app tests 96/96, lint passed, production build passed, and production dependency audit reported only the known R-405 findings.
- Updated the data inventory, provider requirements, dataset strategy, evidence pack, and production pilot dossier so Phase 26 records and provider-egress boundaries are explicit.
- No raw SQL, mutation tools, real provider, real channel, external notification, monitoring, secret manager, or real health data was connected.

## Phase 27: Dietitian Critical Context Updates - Completed 2026-05-30

Goal: let dietitians add confirmed client context from phone, Zoom, face-to-face, or other non-chat conversations so AI is not limited to WhatsApp/Telegram message history.

Status:

- Added `docs/PHASE_27_DIETITIAN_CONTEXT_UPDATE_SPEC.md`.
- Added `client_context_updates` app-state records and Supabase migration.
- Added `POST /api/clients/[id]/context-updates`.
- Added dashboard Critical Context panel on the selected client surface.
- Active context updates increment client context revision, invalidate pending drafts, and enter PromptContext as bounded `dietitian_context_update` segments.
- Newer `dietitian_manual` WhatsApp/Telegram/manual messages remain authoritative over older Critical Context records through the latest dietitian-authored source rule.
- ContextManifest remains raw-text-free and now preserves current inbound message id.
- Client export includes context updates; anonymization redacts them and marks them superseded.
- No old WhatsApp messages are rewritten; newer dietitian context supersedes older prompt context.
- No real provider, channel, external notification, monitoring, secret manager, or real health data was connected.
- Re-verified on 2026-05-31 with `npm run release:verify`: core tests 41/41, app tests 99/99, lint passed, production build passed, and production dependency audit reported only the known R-405 findings.

## Phase 28: AI Security Remediation - Completed 2026-05-31

Goal: close repo-level AI architecture/security audit findings before any real provider or channel integration.

Status:

- Added `docs/PHASE_28_AI_SECURITY_REMEDIATION_SPEC.md`.
- Added Supabase migration `20260530040000_ai_security_remediation.sql` for `provider_attempted`, provider-status invariants, tenant-aware channel/idempotency uniqueness, helper functions, and scoped RLS/RBAC policies.
- Provider no-call paths now record `providerAttempted=false`, `model=null`, `providerId=null`, and `providerStatus=not_called`.
- Actual mock-provider attempts record provider metadata, and only `MockProviderError` is normalized as provider failure.
- PromptContext segments now include source id, origin, timestamp, and authority metadata; the newest dietitian-authored source is explicitly marked authoritative across manual messages and Critical Context updates.
- Draft approve/edit-send now revalidates context revision, channel permission, takeover lock, AI mode/status, latest promptable message id, and memory version/revision/staleness before client-facing send.
- Provider input is guarded by an allowlisted segment boundary and fails closed for red risk, unknown/overlong segments, extra keys, raw prompts, capsules, and raw message/profile objects.
- Core declaration types now expose concrete CoreResult, PromptContext, ContextManifest, provider-attempt, activation, and mode decision contracts.
- Clinical golden coverage now includes typo/diacritic handling, English emergencies, medication dose requests, minor/body-image language, eating-disorder euphemisms, and pregnancy complications.
- Re-verified on 2026-05-31 with `npm run release:verify`: core tests 49/49, app tests 103/103, lint passed, production build passed, and production dependency audit reported only the known R-405 findings.

## Phase 29: Pilot Gate Closure And Evidence Hardening - Completed 2026-05-31

Goal: make the Phase 28-secured local prototype clearer for external review without adding features, connecting real providers/channels, approving launch gates, or resolving R-405.

Status:

- Added `docs/PHASE_29_PILOT_GATE_CLOSURE_EVIDENCE_HARDENING_SPEC.md`.
- Updated the production pilot dossier and evidence pack to use the Phase 27-28 baseline.
- Recorded the 2026-05-31 npm metadata check: stable `next@latest` remains 16.2.6 with `postcss@8.4.31`; `eslint-config-next@latest` remains 16.2.6.
- Confirmed no dependency files should change because no safe stable Next.js/PostCSS path exists.
- Recorded that the latest RLS run skipped because local Supabase was not configured; expanded RLS coverage remains an environment evidence item to rerun against local Supabase.
- Kept all eight production-pilot launch gates open.
- Re-verified on 2026-05-31 with `npm run release:verify`: core tests 49/49, app tests 103/103, lint passed, production build passed, and production dependency audit reported only the known R-405 findings.
- No real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, or real client health data was connected.

## Phase 30: Completion Roadmap Phase 1 - Checkpoint And Baseline - Completed 2026-05-31

Goal: implement Phase 1 of the 13-phase completion roadmap by making the Phase 27-29 checkpoint explicit and verifiable before continuing.

Status:

- Added `docs/PHASE_30_COMPLETION_PHASE_1_CHECKPOINT_BASELINE_SPEC.md`.
- Confirmed the working branch is `codex/phase-29-baseline-checkpoint`.
- Confirmed the starting checkpoint is `c75564e Add Phase 27-29 pilot readiness checkpoint`.
- Confirmed no runtime behavior, schema, dependency, provider, channel, launch-gate, or real-data changes are part of this phase.
- Re-verified with `npm run release:verify` after the documentation update.
- R-405 remains open and R-406 remains pending local Supabase RLS execution.

## Phase 31: Completion Roadmap Phase 2 - Local Supabase RLS Evidence - Blocked 2026-05-31

Goal: run the expanded local Supabase RLS suite and update R-406 with current evidence.

Status:

- Added `docs/PHASE_31_COMPLETION_PHASE_2_RLS_EVIDENCE_SPEC.md`.
- Confirmed the RLS test guard still skips non-local Supabase URLs unless `MANU_ALLOW_REMOTE_RLS_TESTS=true` is explicitly set.
- Confirmed `app/.env.local` is currently configured for a cloud Supabase URL, so it is not acceptable RLS evidence input by default.
- Attempted to start local Supabase with Supabase CLI `2.101.0`.
- Local Supabase start failed because Docker Desktop's Linux engine pipe was unavailable: `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`.
- Ran `npm run test:rls`; it exited by skipping the guarded suite with 1 skipped file and 10 skipped tests.
- No passing RLS evidence was produced.
- R-406 remains blocked pending local Docker/Supabase availability.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria still unmet:

- Local Supabase starts successfully.
- Migrations are available in the local database.
- `npm run test:rls` runs the expanded 10-test suite instead of skipping.
- R-406 and evidence docs are updated only after a passing local RLS run.

## Phase 32: Completion Roadmap Phase 3 - R-405 Stable Patch Recheck - Completed 2026-05-31

Goal: re-check R-405 through the Phase 22 stable dependency remediation procedure.

Status:

- Added `docs/PHASE_32_COMPLETION_PHASE_3_R405_RECHECK_SPEC.md`.
- Re-read `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- Ran `npm view next@latest version dependencies --json`.
- Ran `npm view eslint-config-next@latest version --json`.
- Ran `npm audit --omit=dev --json`.
- Confirmed `next@latest` is still `16.2.6`.
- Confirmed stable Next still depends on `postcss@8.4.31`, below the accepted `postcss >= 8.5.10` remediation threshold.
- Confirmed `eslint-config-next@latest` is still `16.2.6`.
- Confirmed production audit still reports only the known R-405 moderate `next`/`postcss` findings.
- No dependency files were changed.
- No `npm audit fix --force`, canary, override, major downgrade, provider, channel, launch-gate, or real-data change was made.
- R-405 remains open.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- Latest npm metadata is recorded.
- Dependency files remain untouched because the accepted stable patch path is unavailable.
- R-405 remains a production launch blocker until a stable Next.js release bundles `postcss >= 8.5.10` or external formal risk acceptance is supplied.

## Phase 33: Completion Roadmap Phase 4 - External Approval Evidence Intake - Completed 2026-05-31

Goal: make external approval evidence collection actionable without approving production launch.

Status:

- Added `docs/PHASE_33_COMPLETION_PHASE_4_EXTERNAL_APPROVAL_INTAKE_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`.
- Mapped all eight canonical launch gate ids to required evidence, approval owner, acceptable artifact, current status, and notes.
- Confirmed no external approval artifacts were supplied in this phase.
- Kept all production-pilot launch gates open.
- Kept R-405 open.
- Kept R-406 blocked.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- Re-verified documentation-only changes with `npm run release:verify` after clearing a transient Windows/OneDrive `.next` EPERM build artifact: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- External review has a single intake packet for artifact tracking.
- The intake packet warns against repo storage of secrets, raw client health data, and real client identifiers.
- Internal evidence remains separated from external approval.

## Phase 34: Completion Roadmap Phase 5 - Legal And Privacy Review Packet - Completed 2026-05-31

Goal: prepare the `legal_privacy_review` launch gate for external legal/privacy review.

Status:

- Added `docs/PHASE_34_COMPLETION_PHASE_5_LEGAL_PRIVACY_PACKET_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md`.
- Mapped legal/privacy review questions to current internal artifacts, including data inventory, data governance, legal ops ledger, internal copilot, dietitian context updates, and AI security remediation.
- Listed required counsel decisions for lawful basis, privacy notice, permission flow, medical-device/CDS classification, retention, DSAR/deletion, internal copilot records, dietitian context updates, provider dependency, and channel dependency.
- Confirmed no legal/privacy approval artifact was supplied in this phase.
- Kept `legal_privacy_review` open.
- Kept R-405 open.
- Kept R-406 blocked.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.

Done criteria:

- Legal/privacy counsel has a review packet that separates internal implementation evidence from external approval.
- The packet warns against storing secrets, raw client health data, and real client identifiers in repo docs.
- The production-pilot legal/privacy gate remains open until acceptable external approval evidence is supplied.

## Phase 35: Completion Roadmap Phase 6 - Clinical Taxonomy Review Packet - Completed 2026-05-31

Goal: prepare the `clinical_taxonomy_approval` launch gate for qualified dietitian review.

Status:

- Added `docs/PHASE_35_COMPLETION_PHASE_6_CLINICAL_TAXONOMY_PACKET_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md`.
- Summarized current green/yellow/red golden case coverage and expected behavior.
- Mapped internal evidence to the required qualified dietitian sign-off artifact.
- Confirmed no qualified dietitian approval artifact was supplied in this phase.
- Kept `clinical_taxonomy_approval` open.
- Kept R-405 open.
- Kept R-406 blocked.
- No classifier, golden-case, runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- Qualified dietitian reviewer has a packet that separates internal test evidence from external clinical approval.
- The packet warns against storing real client messages, identifiers, medical records, provider payloads, or secrets in repo docs.
- The production-pilot clinical taxonomy gate remains open until acceptable qualified dietitian approval evidence is supplied.

## Phase 36: Completion Roadmap Phase 7 - Provider Vendor Review Packet - Completed 2026-05-31

Goal: prepare the `provider_vendor_review` launch gate for external vendor, legal, and security review.

Status:

- Added `docs/PHASE_36_COMPLETION_PHASE_7_PROVIDER_VENDOR_REVIEW_PACKET_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md`.
- Mapped current local/mock provider controls to required vendor, retention, logging, training-use, region, access-control, and incident-obligation decisions.
- Confirmed no provider/vendor approval artifact was supplied in this phase.
- Kept `provider_vendor_review` open.
- Kept R-405 open.
- Kept R-406 blocked.
- No runtime behavior, schema, dependency, provider, channel, credential, launch-gate approval, logging-vendor, or real-data change was made.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- Vendor/legal/security reviewers have a packet that separates internal provider-boundary evidence from external vendor approval.
- The packet warns against storing provider secrets, real client identifiers, raw client health messages, real provider prompts/completions, or non-repository contract text in repo docs.
- The production-pilot provider/vendor gate remains open until acceptable external approval evidence is supplied.

## Phase 37: Completion Roadmap Phase 8 - Channel Policy Review Packet - Completed 2026-05-31

Goal: prepare the `channel_policy_review` launch gate for external WhatsApp and Telegram platform-policy review.

Status:

- Added `docs/PHASE_37_COMPLETION_PHASE_8_CHANNEL_POLICY_REVIEW_PACKET_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md`.
- Mapped current mock WhatsApp/Telegram channel controls to required healthcare-use, opt-in/out, template, service-window, webhook, delivery-status, account-quality, and fallback decisions.
- Confirmed no channel policy approval artifact was supplied in this phase.
- Kept `channel_policy_review` open.
- Kept R-405 open.
- Kept R-406 blocked.
- No runtime behavior, schema, dependency, provider, channel integration, webhook, credential, template registry, launch-gate approval, or real-data change was made.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- Platform/policy reviewers have a packet that separates internal mock-channel evidence from external WhatsApp/Telegram approval.
- The packet warns against storing channel secrets, real phone numbers, Telegram user ids, raw client health messages, production webhook payloads, or non-repository platform review text in repo docs.
- The production-pilot channel policy gate remains open until acceptable external approval evidence is supplied.

## Phase 38: Completion Roadmap Phase 9 - Incident And DSAR Review Packet - Completed 2026-05-31

Goal: prepare the `incident_response_runbook` launch gate for external operations, legal, privacy, and clinical review.

Status:

- Added `docs/PHASE_38_COMPLETION_PHASE_9_INCIDENT_DSAR_REVIEW_PACKET_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md`.
- Mapped the draft incident runbook, DSAR/export/anonymization skeleton, legal ops ledger, and safe operational health evidence to required owner, escalation, notification, DSAR/deletion, breach, and re-enable decisions.
- Confirmed no incident/DSAR approval artifact was supplied in this phase.
- Kept `incident_response_runbook` open.
- Kept R-405 open.
- Kept R-406 blocked.
- No runtime behavior, schema, dependency, provider, channel, monitoring, notification, ticketing, launch-gate approval, owner assignment, or real-data change was made.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- Operations/legal/privacy/clinical reviewers have a packet that separates internal draft runbook evidence from external operating procedure approval.
- The packet warns against storing real client identifiers, raw client health messages, production incident payloads, credentials, private security contacts, or sensitive legal communications in repo docs.
- The production-pilot incident/DSAR gate remains open until acceptable external approval evidence is supplied.

## Phase 39: Completion Roadmap Phase 10 - Backup Restore Review Packet - Completed 2026-05-31

Goal: prepare the `backup_restore_test` launch gate for external operations, security, and legal review.

Status:

- Added `docs/PHASE_39_COMPLETION_PHASE_10_BACKUP_RESTORE_REVIEW_PACKET_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md`.
- Mapped the draft backup/restore runbook to required provider, region, retention, restore-drill, encryption, legal-hold, tenant-isolation, RLS, data-governance, and drill evidence decisions.
- Confirmed no backup/restore approval artifact or restore-drill evidence was supplied in this phase.
- Kept `backup_restore_test` open.
- Kept R-405 open.
- Kept R-406 blocked.
- No runtime behavior, schema, dependency, provider, channel, backup provider, storage, secret manager, infrastructure, launch-gate approval, restore drill, or real-data change was made.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- Operations/security/legal reviewers have a packet that separates internal draft backup/restore evidence from external restore-drill approval.
- The packet warns against storing backup credentials, real client identifiers, raw client health data, production snapshot contents, restore credentials, or sensitive legal-hold artifacts in repo docs.
- The production-pilot backup/restore gate remains open until acceptable external approval evidence is supplied.

## Phase 40: Completion Roadmap Phase 11 - Secret Rotation Review Packet - Completed 2026-05-31

Goal: prepare the `secret_rotation_plan` launch gate for external security and operations review.

Status:

- Added `docs/PHASE_40_COMPLETION_PHASE_11_SECRET_ROTATION_REVIEW_PACKET_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md`.
- Mapped the draft secret rotation runbook to required secret manager, inventory, owner, cadence, emergency revocation, break-glass, access-review, health-check, smoke-test, and evidence decisions.
- Confirmed no secret-rotation approval artifact, production secret manager, or rotation evidence was supplied in this phase.
- Kept `secret_rotation_plan` open.
- Kept R-405 open.
- Kept R-406 blocked.
- No runtime behavior, schema, dependency, provider, channel, backup provider, storage, secret manager, infrastructure, credential, launch-gate approval, or real-data change was made.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- Security/operations reviewers have a packet that separates internal draft secret-rotation evidence from external signed secret-rotation approval.
- The packet warns against storing secret values, token prefixes, connection strings, provider credentials, webhook secrets, database passwords, private deployment URLs, or secret-bearing logs in repo docs.
- The production-pilot secret rotation gate remains open until acceptable external approval evidence is supplied.

## Phase 41: Completion Roadmap Phase 12 - Dependency Audit Clearance Packet - Completed 2026-05-31

Goal: prepare the `dependency_audit_clearance` launch gate for engineering/security review and re-check R-405 through the accepted stable Next.js/PostCSS procedure.

Status:

- Added `docs/PHASE_41_COMPLETION_PHASE_12_DEPENDENCY_AUDIT_CLEARANCE_PACKET_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md`.
- Re-read `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- Ran `npm view next@latest version dependencies --json`.
- Ran `npm view eslint-config-next@latest version --json`.
- Ran `npm audit --omit=dev --json`.
- Confirmed stable `next@latest` remains `16.2.6` with nested `postcss@8.4.31`.
- Confirmed `eslint-config-next@latest` remains `16.2.6`.
- Confirmed production audit still reports only the known moderate R-405 `next`/`postcss` findings.
- No dependency files were changed.
- No dependency clearance or formal R-405 risk acceptance was supplied.
- Kept `dependency_audit_clearance` open.
- Kept R-405 open.
- Kept R-406 blocked.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- Engineering/security reviewers have a packet that separates current dependency audit evidence from external remediation or formal risk acceptance.
- The packet warns against rejected paths: `npm audit fix --force`, `next@9.3.3`, canary/beta/rc baseline, invalid overrides, and self-approval of R-405.
- The production-pilot dependency audit gate remains open until acceptable technical remediation or external formal risk acceptance is supplied.

## Phase 42: Completion Roadmap Phase 13 - Final Readiness Closure - Completed 2026-05-31

Goal: close the 13-phase completion roadmap with a final production-pilot readiness summary and go/no-go decision record.

Status:

- Added `docs/PHASE_42_COMPLETION_PHASE_13_FINAL_READINESS_CLOSURE_SPEC.md`.
- Added `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md`.
- Recorded the current production-pilot decision as `NO-GO`.
- Confirmed all eight production-pilot launch gates remain open.
- Confirmed R-405 remains open.
- Confirmed R-406 remains blocked.
- Confirmed no external approval artifacts were supplied during the completion roadmap.
- No runtime behavior, schema, dependency, provider, channel, monitoring, secret manager, backup provider, launch-gate approval, R-405 acceptance, R-406 mitigation, or real-data change was made.
- Re-verified documentation-only changes with `npm run release:verify`: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Done criteria:

- The final closure summary separates internal readiness evidence from production-pilot approval.
- The summary lists the remaining blockers and next required actions.
- Production pilot remains blocked until acceptable external approval evidence, R-405 clearance or acceptance, and R-406 passing local RLS evidence are supplied.

## Phase 43: Multilingual Language Support - Completed 2026-05-31

Goal: add deterministic support for Turkish, English, German, French, Spanish, Portuguese, and Czech across dashboard preferences, client identity, dynamic forms, prompt context, local/mock provider behavior, and safety tests.

Status:

- Added `docs/PHASE_43_MULTILINGUAL_LANGUAGE_SUPPORT_SPEC.md`.
- Added canonical supported-language and strict E.164 phone helpers.
- Added per-dietitian dashboard UI language preference.
- Added per-client `primaryPhoneE164` and `communicationLanguage`.
- Added form schema/response `languageCode` and response `submittedPhoneE164`.
- Added a Supabase migration for the new language/phone fields and tenant-scoped non-null phone uniqueness.
- Updated fallback and Supabase stores, API routes, and dashboard controls for client phone/language, form language, and dietitian dashboard language.
- Updated PromptContext with a bounded `conversation_language` segment and ContextManifest language metadata.
- Updated local/mock provider replies and handoff safe acknowledgements to use the stored client language.
- Expanded multilingual safety patterns and clinical golden cases without approving the clinical taxonomy launch gate.
- Re-verified with `npm run release:verify`: core tests 52/52, app tests 107/107, lint, production build, and only documented R-405 findings.
- No automatic translation, public form link, real provider, real channel, external translation service, monitoring, secret manager, backup provider, or real client health data was connected.
- Production pilot remains `NO-GO`; all eight launch gates remain open; R-405 remains open; R-406 remains blocked.

Done criteria:

- Supported-language validation exists at app/core boundaries.
- Form responses update client conversation language and invalidate stale drafts.
- Provider allowlist accepts only the bounded `conversation_language` segment rather than raw client/profile objects.
- Dashboard language controls are available for dietitian UI, client communication language, and form language.
- Multilingual behavior is covered by app tests and core clinical golden tests.

## Phase 76A: Dietitian Chat Form Update Proposals - Completed 2026-06-08

Goal: support the dietitian workflow where a note typed in the selected client's chat can become a reviewed form/context update, without turning the read-only internal copilot into a mutation agent.

Status:

- Added `docs/PHASE_76A_DIETITIAN_CHAT_FORM_UPDATE_PROPOSALS_SPEC.md`.
- Added tenant/client-scoped `ClientUpdateProposalRecord` state and Supabase `client_update_proposals` migration.
- Added create/apply/reject proposal APIs and dashboard review controls.
- Proposal creation is deterministic, additive-only, and limited to allowlisted client form/context fields.
- Sensitive clinical, medication, system-field, provider, channel, AI-mode, lifecycle, and ambiguous update requests are unsupported.
- Apply requires explicit dietitian approval and matching client context revision.
- Apply updates the active Phase 70 form response, mirrors allowed client fields, creates Critical Context and audit evidence, increments context revision once, and invalidates pending drafts.
- Phase 74 export/anonymization governance now includes proposal records and redacts proposal source text/patches.
- Re-verified with `npm run release:verify`: core tests 122/122, app tests 222/222, lint, production build, and only documented R-405 findings.
- No green/yellow/red routing change, real provider, real channel, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

Done criteria:

- Dietitian chat text cannot mutate form/context until explicit apply.
- Unsupported/sensitive/system requests cannot produce applicable patches.
- Applied proposals are auditable, draft-invalidating, and source-governed.
- Internal copilot remains read-only.

## Phase 76B: Expanded Chat Form Safety Updates - Completed 2026-06-08

Goal: preserve the simple dietitian chat proposal UX while allowing approved updates to existing Phase 70 safety-profile form fields.

Status:

- Added `docs/PHASE_76B_EXPANDED_CHAT_FORM_SAFETY_UPDATE_SPEC.md`.
- Expanded proposal patch metadata with category, editability, impact labels, and `set_value` operation.
- Added clinical/safety extraction for pregnancy/breastfeeding, adult/minor status, diagnosed condition, medication/insulin, lab-result availability, recent symptom, and eating-disorder risk.
- Mirrored supported safety fields into `ClientRecord.healthProfile`.
- Kept AI active/passive, AI mode, channel permission, opt-out, red lock, yellow hold, and autopilot/reactivation as manual-only warnings.
- Added editable proposal rows; dietitians can change values or remove rows before apply, but cannot change patch target identity.
- Re-verified with `npm run release:verify`: core tests 122/122, app tests 226/226, lint, production build, and only documented R-405 findings.
- No real Gemini extraction, real provider, real channel, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected.
- Production pilot remains `NO-GO`.

Done criteria:

- Clinical/safety form flags can be approved from one proposal card.
- Operational AI/channel/lock controls cannot be changed from chat.
- Edited patch values cannot change patch targets.
- Internal copilot remains read-only.

## Always-On Gates

- No real health data before legal/privacy review.
- No production messaging before WhatsApp/Telegram policy review.
- No real LLM provider call with health data before vendor-risk and retention review.
- No real-provider internal copilot egress before a separate provider, legal/privacy, security, and data-minimization review.
- No real-provider use of dietitian context updates before provider, legal/privacy, clinical, and data-minimization review.
- No fine-tuning on raw client messages.
- No tenant mixing in datasets or prompt retrieval.
- No raw health messages in external notification payloads.

## Current Next Phase - Phase 84 Commercial SaaS Relaunch

Superseded override after Phase 84H QA and evidence refresh (2026-07-03): Phase 84 repo-local track was complete pending VPS URL verification; Phase 84I later verified VPS generated token-hash onboarding/dashboard, and Phase 84J later verified real Resend custom-SMTP email dashboard access.

Superseded Phase 84D override: Phase 84D customer auth completed on 2026-07-02.

Superseded Phase 84C override: Phase 84C lead/contact flow completed on 2026-07-02.

Superseded Phase 84A override (2026-07-02): Phase 84A architecture freeze complete.

As of 2026-07-02, Phase 83 commercial sandbox infrastructure has been validated on `https://siriusai.store` with HTTPS, VPS deployment, and Stripe test webhook delivery. The test payment path successfully consumed a commercial invite, provisioned a tenant, created an active entitlement, and wrote billing ledger entries.

The next correct implementation phase is `docs/PHASE_84_COMMERCIAL_SAAS_RELAUNCH_AND_ONBOARDING_SPEC.md`: professional SiriusAI public landing, Supabase magic-link login, post-payment customer onboarding/claim flow, contact lead capture, and admin operations on `admin.siriusai.store`.

Do not treat the VPS deployment or Stripe test webhook as production GO. Keep live Stripe, real WhatsApp/Telegram/Gemini/provider, monitoring, secret manager, backup provider, production webhook, and real client health-data paths disconnected. R-405 remains open. R-406 current post-83 local Supabase/RLS re-run remains pending when local Supabase is unavailable.
