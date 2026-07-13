# Phase 85 Stage 4B-3 - Multimodal Gorsel Guvenligi ve Yanit Orkestrasyonu Eylem Plani

Phase 0 status, 2026-07-14: canonical plan and handoff lock are active. Stage 4B-3 Phase 7 visual risk overlay, intent, answerability, narrow autopilot, and output guard integration is complete locally. Evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_7_VISUAL_RISK_INTENT_AUTOPILOT_EVIDENCE.md`. **Next:** Phase 8 orchestration and atomic decision commit. Stage order is Stage 4B-2 -> Stage 4B-3 -> Stage 4C. Stage 4C is blocked until Stage 4B-3 implementation, verification, evidence closure, risk-register reconciliation, and handoff update are complete.

Production pilot remains `NO-GO`. R-405 remains open. Real WhatsApp, Telegram, Gemini, external LLM, live billing, monitoring, backup, secret-manager, production webhook, and real client health-data paths remain disabled. Stage 4B-3 is limited to gated local end-to-end behavior with mock WhatsApp ingress and deterministic local vision observations.

## 1. Purpose

Stage 4B-3 adds image-message handling to the existing supervised WhatsApp-like messaging system without weakening the current green/yellow/red safety model. The system may identify and structure visual observations, but clinical meaning, risk classification, source authority, autopilot eligibility, and client-facing send decisions remain owned by the existing core safety chain.

The feature exists because clients can send photos instead of plain text. Supported local scenarios include meal photos, packaged-food or supplement labels, screenshots of online claims, documents, and unknown images. The implementation must preserve fail-closed behavior: if visual context is incomplete, sensitive, ambiguous, low-confidence, contradictory, or outside the narrow allowlist, the system routes to dietitian review and sends no autonomous client-facing message.

## 2. Locked Decisions

- Execution boundary: gated local end-to-end only. Mock WhatsApp plus deterministic local vision provider are allowed. Real Meta media fetch, real WhatsApp production webhooks, Gemini, external LLM, and production provider egress remain disabled.
- Media retention: sanitized private media objects are retained for 30 days, then expire. Original raw image bytes are never persisted.
- Autopilot: narrow green only. Yellow, red, low-confidence, unknown, sensitive, supplement/medication, body/symptom, lab/medical document, mixed dish, portion/calorie estimation, and ambiguous multi-image cases cannot auto-send.
- Correlation: an inbound image opens an inbound message bundle. The bundle waits for 120 seconds of silence before evaluation. Every new client or dietitian message in the same conversation resets the timer to 120 seconds. There is no product-level maximum bundle duration.
- Technical resource caps: maximum 20 bundle messages, 4 images, and 16,000 Unicode codepoints. Overflow is stored in transcript but routes yellow/no-auto.
- Standalone image behavior: inspect image plus existing conversation, active menu, food rules, and dietitian-authored context. If exact context is reliable, a natural short green response may be drafted/sent under the same green chain. If context is not reliable, route yellow review. No generic "I received the photo" clarification message is sent.
- Client-facing language: no AI, model, OCR, confidence, image-analysis, or limitation wording. The client must experience replies as coming from the dietitian.
- Correction policy: if the dietitian corrects a visual reading before decision, supersede analysis and rerun. If a draft is pending, invalidate and rerun. If a response was already sent, pause AI, create audit correction and manual follow-up, and send no automatic corrective client message.
- Notification policy: do not notify for every image. Notify only for yellow, red, low-confidence, error, overflow, correction, or explicit dietitian-review cases.

## 3. Current Architecture Baseline

- `/api/whatsapp/webhook` currently uses the legacy WhatsApp normalizer and rejects image/media payloads before delegating to mock inbound processing.
- P85-IF normalizes media into unsupported events and routes them to transcript side effects, not promptable clinical sources.
- `MessageRecord` stores text-centric bodies and provenance; it has no attachment/media contract.
- `simulator.ts` stores inbound text, classifies risk, invalidates drafts, calls the core orchestrator, and appends the result.
- The core orchestrator chain is text-first: preflight -> risk -> mode -> context -> canonical intent -> green taxonomy -> answerability -> response plan -> narrow autopilot -> provider -> output guard -> sent/draft/handoff.
- Existing invariant remains authoritative: red never calls provider; yellow creates draft/review only; green may send only if source-backed, narrow-autopilot eligible, and output-guard clean.
- Product label verification currently trusts written `user_label_text`, barcode/catalog evidence, and dietitian notes. Visual OCR must be introduced as `visual_label_ocr` and cannot be silently upgraded to trusted label evidence without completeness and integrity gates.
- Stage 4B-2 conversation APIs and UI are bounded, role-aware, and text-only.
- Current database has messages, decisions, risk records, channel events, revisions, and receipts, but no media tables or private storage bucket.

## 4. Non-Negotiable Boundaries

- No production-channel connection is enabled.
- No external vision or text provider egress is enabled.
- No raw image bytes are stored in database rows, logs, prompts, audit records, or test fixtures.
- No image-derived observation is retrieval-eligible as clinical source unless an explicit Stage 4B-3 source gate marks it safe for the exact downstream use.
- Risk overlay can retain or increase risk only; it can never downgrade a text or visual risk.
- Text-only message behavior must remain byte-for-byte equivalent outside active image bundles.
- Yellow/red and low-confidence visual cases must not produce client-facing AI boundary replies.
- Public object access and direct signed URLs in DTOs are forbidden. Media is streamed through authorized server routes only.

## 5. Phase Plan

### Faz 0 - Calisma Agaci, Kanonik Plan ve Handoff Kilidi

Purpose: make Stage 4B-3 the current authorized Phase 85 unit and block Stage 4C until visual-message safety closes.

Scope: documentation, current-status references, risk register, pilot readiness notes, and handoff instructions only. No runtime code, migration, API, UI, provider, or webhook behavior changes.

Prerequisites: Stage 4B-2 R0-R7 and security advisory hardening are closed locally; production pilot remains `NO-GO`; real provider/channel paths remain disabled.

Affected files: `README.md`, `PLAN.md`, `PROJECT_PLAN.md`, `HANDOFF_FOR_NEXT_CODEX.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`, `docs/PHASE_85_FRONTEND_REDESIGN_AND_DESIGN_SYSTEM_SPEC.md`, Stage 4B-2 continuity docs, P85-IF plan/spec notes, pilot readiness docs, gate docs, final readiness summary, `docs/RISK_REGISTER.md`, this plan, and Phase 0 evidence.

Architecture decisions: Stage order becomes Stage 4B-2 -> Stage 4B-3 -> Stage 4C. Stage 4B-3 owns visual media admission, observation, bundle correlation, multimodal risk/source/autopilot integration, media lifecycle, visual review UI, and correction workflow. Stage 4C remains dietitian AI chat and cannot begin until this plan closes.

Implementation steps: add this plan; add Phase 0 evidence; update current-status paragraphs; replace current handoff text that says Stage 4C is next with Stage 4B-3; add a supersession note to historical Stage 4B-2 closure/action-plan docs; add R-442 through R-450 to the risk register; update pilot/gate docs to state visual media is an open pre-Stage-4C safety track.

Technical method: use append-only documentation changes. Do not rewrite historical evidence bodies except to add explicit supersession notes at the top where needed. Preserve all prior verification counts as historical facts.

Data flow: none in runtime. Documentation data flow is handoff -> plan -> execution docs -> risk register -> pilot/gate status.

Dependencies: existing Stage 4B-2 closure evidence, P85-IF contracts, Phase 74 lifecycle policy, Phase 75 provider gate, Phase 76H product-label verification, Phase 77R food understanding, Stage 4B alert/notification ownership, and Stage 4B-2 bounded messaging.

Errors and boundary cases: stale references to Stage 4C as next are treated as documentation blockers; any doc implying production media support, real provider egress, or production pilot approval is invalid.

Tests: `rg` scan for active next-phase contradictions; `git diff --check`; no unit tests required because no runtime changes occur.

Validation metrics: active handoff references to "Stage 4C is next" outside historical paragraphs must be 0; new plan file exists; risk IDs R-442 through R-450 exist; production `NO-GO` and R-405 open remain present in updated docs.

Done criteria: all canonical continuity docs point to Stage 4B-3; Stage 4C is explicitly blocked; Phase 0 evidence records the changes and non-runtime scope.

### Faz 1 - Domain, Threat Model, Type Contract

Purpose: define the image domain model before storage, APIs, or orchestration are added.

Scope: TypeScript domain records, scene taxonomy, status machines, DTO contracts, and hard safety invariants.

Prerequisites: Phase 0 complete; all affected code paths read; no active runtime media feature exists.

Affected files: `app/src/lib/types.ts`, new `app/src/lib/phase-85-stage-4b3-visual-contracts.ts`, new contract tests, core shared type adapters where visual envelope crosses into orchestrator tests.

Architecture decisions: vision provider emits structured observations only. Core owns clinical interpretation. Add `MediaAssetRecord`, `VisualObservationV1`, `VisualAnalysisRecord`, `InboundMessageBundleRecord`, `InboundMessageBundleItemRecord`, `VisualCorrectionRecord`, `MultimodalMessageEnvelope`, `VisualAutopilotEligibility`, `ConversationMediaDto`, and `VisualReviewDto`.

Implementation steps: define scene types `meal`, `packaged_food_label`, `supplement_or_medication`, `screenshot_or_document`, `lab_or_medical_document`, `body_or_symptom`, `sensitive_identity_document`, `other`, `unknown`; define asset statuses `admitted`, `download_pending`, `sanitized`, `analysis_pending`, `analysis_ready`, `failed`, `expired`, `revoked`; define bundle statuses `open`, `ready`, `processing`, `decided`, `superseded`, `failed`, `cancelled`; define correction statuses `submitted`, `applied_to_pending`, `manual_follow_up_required`, `closed`.

Technical method: compile-time discriminated unions; exhaustive switch tests; runtime validators for inbound DTOs and observation JSON.

Data flow: channel event -> normalized media metadata -> asset record -> observation record -> bundle envelope -> core safety chain.

Dependencies: P85-IF provenance fields, Stage 4B-2 conversation DTOs, Phase 74 lifecycle categories, Phase 76H product verification source types, Phase 77N intent, Phase 77W autopilot eligibility.

Errors and boundary cases: unknown scene, multiple scene candidates, missing dimensions, unsupported MIME, corrupt metadata, low confidence, and sensitive scene must have explicit non-green state.

Tests: contract tests for all enums, DTO redaction, client-safe DTO exclusion of object keys/OCR/confidence, and risk overlay cannot downgrade.

Validation metrics: 100 percent exhaustive scene/status handling in tests; 0 client DTO fields exposing object key, OCR text, provider id, model name, confidence, or prompt text.

Done criteria: domain types compile; tests pass; no runtime route consumes images yet.

### Faz 2 - Database, Storage, RLS, Retention Foundation

Purpose: add private media persistence and queue tables without exposing media to unauthorized roles.

Scope: append-only Supabase migrations, private bucket, RLS policies, service-role RPCs, lifecycle metadata, and storage access tests.

Prerequisites: Phase 1 contracts complete.

Affected files: migrations `20260713120000_phase_85_stage_4b3_media_foundation.sql`, `20260713130000_phase_85_stage_4b3_atomic_bundle_decisions.sql`, `20260713140000_phase_85_stage_4b3_bounded_media_reads.sql`, `20260713150000_phase_85_stage_4b3_media_lifecycle.sql`; `supabase-store.ts`; RLS test suite.

Architecture decisions: create private bucket `p85-stage-4b3-media`; no direct anon/authenticated object access; stream media only through server routes after conversation permission check. Tables: `media_assets`, `visual_analysis_records`, `inbound_message_bundles`, `inbound_message_bundle_items`, `visual_corrections`.

Implementation steps: create tables with tenant/client/conversation composite constraints; add queue columns `status`, `retry_count`, `next_attempt_at`, `lease_expires_at`; add object metadata fields for sanitized full and thumbnail only; add `provider_media_id` nullable and clearable; store SHA-256 hash, MIME, dimensions, size, expiry; add service-role RPCs for claim/commit with `FOR UPDATE SKIP LOCKED`, 60-second leases, max 3 retries.

Technical method: append-only SQL; tenant-composite FKs; role-separated RLS; service-role-only mutation RPCs; owner/admin diagnostic read limited to aggregate metadata.

Data flow: admission creates message + asset + open bundle in one commit; worker claims asset; sanitizer writes object; analyzer writes observation; bundle worker claims ready bundle; decision commit writes send/draft/handoff atomically.

Dependencies: existing messages/channel-events/revision tables, Stage 4B-2 mutation idempotency, P85-IF actor provenance, Phase 74 data lifecycle.

Errors and boundary cases: duplicate provider media id, duplicate payload hash, stale lease, worker crash, object upload failure, DB commit failure after upload, RLS denied access, cross-tenant request, expired asset.

Tests: migration reset, RLS role matrix, cross-tenant media read denial, object access denial for anon/authenticated, service stream authorization, duplicate/idempotency tests, stale lease retry tests.

Validation metrics: RLS/storage tests zero skipped; public object count 0; cross-tenant media access 0; object-key exposure in client DTO 0.

Done criteria: storage and DB pass local reset and RLS; no UI or webhook path uses the tables yet.

### Faz 3 - Media Ingress Admission and Sanitization

Purpose: safely accept image messages from mock ingress and convert them into sanitized private media assets.

Scope: normalizer extensions, admission worker, image validation, EXIF stripping, thumbnail generation, and transcript placeholder behavior.

Prerequisites: Phase 2 complete.

Affected files: P85-IF normalizer/ledger files, legacy webhook route migration points, new `phase-85-stage-4b3-media-admission.ts`, worker command, tests, package dependency declarations for direct `sharp` and `file-type`.

Architecture decisions: accept only JPEG and PNG up to 5 MiB; magic-byte validation required; single frame only; minimum 32x32; maximum 8192 side and 25 MP; auto-orient, convert to sRGB, strip EXIF; sanitized full max 3072 long edge JPEG quality 90; thumbnail 640 quality 82; original raw bytes never persisted.

Implementation steps: extend channel event schema with media id, MIME, caption, size, digest; admit image metadata only through mock-gated P85-IF path; fetch bytes only in local worker; validate magic bytes before decode; sanitize through `sharp`; store full/thumb; clear transient provider media id after admission; record failure codes.

Technical method: stream-to-buffer cap at 5 MiB; no logging of bytes or OCR; deterministic error mapping; idempotent hash/object path; worker queue claim RPC.

Data flow: webhook image metadata -> asset `download_pending` -> worker fetch -> validate -> sanitized object -> thumbnail -> asset `sanitized` -> analysis queue.

Dependencies: Supabase storage service role, mock WhatsApp media fixture store, `sharp`, `file-type`, P85-IF secure ingress.

Errors and boundary cases: MIME spoof, decompression bomb, huge dimensions, corrupt image, animated PNG, EXIF geolocation, duplicate image, media URL expired, unsupported media, caption-only image, upload partial failure.

Tests: corrupt files, spoofed MIME, oversized image, EXIF stripped, duplicate idempotency, no raw bytes in DB/logs, worker retry/terminal failure.

Validation metrics: raw bytes in DB/log/prompt/audit 0; EXIF retained 0; unsupported file auto-send 0; terminal failure routes yellow/review notification.

Done criteria: mock image admission stores sanitized private assets and never triggers a client reply.

### Faz 4 - 120-Second Bundle Correlation

Purpose: correlate image and nearby text into a single decision window without premature replies.

Scope: bundle open/reset logic, cap enforcement, ready worker, stale-revision behavior, and transcript ordering.

Prerequisites: Phase 3 complete.

Affected files: simulator, P85-IF ledger, Stage 4B-2 message persistence, bundle worker, store mappers, tests.

Architecture decisions: first image opens bundle; every new client or dietitian message in the conversation resets `readyAt = now + 120s`; text during open bundle is stored but not immediately processed by text-only simulator; no response before silence; overflow routes yellow/no-auto.

Implementation steps: create bundle on image; append subsequent image/text/caption/dietitian messages; record conversation revision at bundle claim; ready worker processes only bundles whose `readyAt <= now`; commit fails if conversation revision changed during decision, then bundle reopens and resets timer.

Technical method: injected clock for tests; no real 120-second waits; atomic bundle item append RPC; `FOR UPDATE SKIP LOCKED` bundle claim; CAS on conversation and bundle revision.

Data flow: image -> bundle open -> messages appended -> timer reset -> ready -> claim -> multimodal envelope -> decision -> atomic commit.

Dependencies: Stage 4B-2 conversation sequence, P85-IF revisions, simulator state.

Errors and boundary cases: infinite conversation without silence, max cap overflow, new image during processing, dietitian manual reply during processing, duplicate channel event, stale bundle claim, red lock appears mid-bundle.

Tests: timer reset by each message, no response before 120 seconds, overflow yellow, stale commit reopens, duplicate image no duplicate bundle item, active text-only behavior unchanged when no image bundle exists.

Validation metrics: premature responses 0; duplicate responses 0; stale commits 0; text-only regression unchanged.

Done criteria: bundles coordinate message timing and never call core before silence.

### Faz 5 - Deterministic Local Vision Provider

Purpose: provide structured visual observations for local testing without external provider egress.

Scope: local fixture provider, observation schema, OCR safety, screenshot injection detection, confidence gates, and provider disabled checks.

Prerequisites: Phase 4 complete.

Affected files: new `phase-85-stage-4b3-local-vision-provider.ts`, fixture manifest, tests, provider gate checks.

Architecture decisions: fixture hash maps to deterministic `VisualObservationV1`; unknown image returns insufficient/unknown; no external network; no model name exposed to client DTOs; OCR text is untrusted data.

Implementation steps: create fixture hash manifest; return scene candidates, detected foods, OCR blocks, label completeness, sensitive markers, prompt-injection markers, quality flags, and observation confidence; validate schema; reject malformed provider output.

Technical method: pure local function; deterministic JSON; schema validation; raw OCR excluded from prompt unless source gate allows a bounded transformed summary.

Data flow: sanitized asset hash -> local provider -> visual analysis record -> multimodal envelope.

Dependencies: Phase 75 provider gate, Phase 76H product verification, Phase 77R food understanding.

Errors and boundary cases: unknown hash, conflicting scene candidates, OCR prompt injection, cropped label, glare, blurry image, supplement bottle, body image, lab document, internet screenshot.

Tests: known fixture outputs, unknown fixture fails closed, prompt injection routes yellow, malformed observation rejected, external egress count 0.

Validation metrics: external vision/text egress 0; unknown/low-confidence sends 0; client-facing OCR/confidence wording 0.

Done criteria: deterministic observations are available for core integration only.

### Faz 6 - Multimodal Understanding and Source Authority

Purpose: convert observations and bundle text into source-scoped, clinically safe understanding.

Scope: multimodal envelope builder, food/label/screenshot source gates, active-menu matching, and product verification bridge.

Prerequisites: Phase 5 complete.

Affected files: core visual understanding modules, product ingredient verification adapters, food understanding, PromptContext/answerability tests.

Architecture decisions: `visual_label_ocr` is a separate evidence type. It can support "forbidden ingredient present" only when OCR completeness/integrity is high; absence of evidence cannot support "allowed". Meal photos can only auto-positive when they exactly match active menu context and no contradiction appears.

Implementation steps: build envelope from bundle items; map observation to candidate intents; attach approved source refs from active menu/food rules/dietitian notes; mark screenshot content as untrusted client-supplied query; reject medical/lab/body scenes from autopilot.

Technical method: bounded text extraction; no raw OCR prompt injection; deterministic exact matching; source-reference manifest with visual provenance marked untrusted or limited-use.

Data flow: observation + transcript + existing approved sources -> multimodal source manifest -> risk/intent/answerability.

Dependencies: Phase 67 answerability, Phase 76H verification, Phase 77G food engine, Phase 77N canonical intent, Phase 77Q claim manifest.

Errors and boundary cases: mixed dish without recipe, hidden ingredients, brand photo without label, cropped label, screenshot misinformation, supplement/medication, lab result, body symptom, multiple images with different intents.

Tests: exact active-menu meal, mixed dish yellow, full label conflict, cropped label yellow, screenshot misinformation safe answerability only from approved sources, supplement/body/lab no-auto.

Validation metrics: absence-of-label-evidence allowed result 0; supplement/body/lab sends 0; mixed-dish auto-send 0 unless exact approved recipe evidence exists.

Done criteria: visual observations enter core only as bounded, source-scoped evidence.

### Faz 7 - Risk, Intent, Autopilot, and Output Guard Integration

Purpose: apply the existing green/yellow/red model to multimodal bundles.

Scope: visual risk overlay, canonical visual intents, narrow green allowlist, ineligibility codes, and client language guard.

Prerequisites: Phase 6 complete.

Affected files: core risk modules, `canonical-intent`, green taxonomy, answerability, response plan, deterministic templates, narrow autopilot eligibility, output guard, tests.

Architecture decisions: risk overlay can only retain/increase risk. Add ineligibility codes `visual_scene_not_allowlisted`, `visual_confidence_insufficient`, `visual_context_unresolved`, `visual_ocr_incomplete`, `visual_prompt_injection`, `visual_sensitive_class`, `visual_multiple_images_ambiguous`.

Implementation steps: add visual intent families; encode narrow allowlist for exact active-menu meal, limited trusted label conflict, and safe screenshot answer fully grounded in approved source; block client-facing wording that mentions AI/OCR/confidence/model/image analysis.

Technical method: deterministic pre-provider gates; provider not attempted for non-green; output guard regex and semantic checks; claim manifest requires approved source refs.

Data flow: multimodal source manifest -> risk overlay -> canonical intent -> answerability -> response plan -> autopilot eligibility -> output guard -> sent/draft/handoff.

Dependencies: existing orchestrator invariant, Phase 66 covenant, Phase 77W autopilot v2.

Errors and boundary cases: green-looking supplement question, false meal match, screenshot asking for clinical advice, label absence inference, conflicting text caption.

Tests: yellow/red client sends 0, low-confidence sends 0, output wording bans, risk downgrade impossible, non-allowlisted visual green blocked.

Validation metrics: yellow/red client sends 0; unknown/low-confidence sends 0; client-facing AI/OCR/confidence wording 0.

Done criteria: multimodal bundles obey the exact same safety send semantics as text.

### Faz 8 - Orchestration, Atomic Decision Commit, and Correction Workflow

Purpose: commit visual decisions atomically and handle dietitian corrections safely.

Scope: orchestrator adapter, draft/send/handoff commit, correction state machine, notification production, and AI pause behavior.

Prerequisites: Phase 7 complete.

Affected files: simulator, core orchestrator bridge, Supabase store, Stage 4B notification producers, tests.

Architecture decisions: already-sent visual error cannot be auto-corrected. The system pauses AI, records correction, creates manual follow-up work, and sends no automatic correction.

Implementation steps: add multimodal inbound processing path; write decision/draft/handoff/send in one transaction with expected conversation/bundle revision; invalidate stale drafts; correction before decision supersedes analysis; correction on pending draft invalidates and reruns; correction after sent pauses AI and opens manual follow-up.

Technical method: service-role RPC; idempotency key per bundle decision; correction RPC with expected revisions; notification dedupe by correction/bundle id.

Data flow: bundle decision -> atomic commit -> message/draft/handoff/risk/activity/notification -> UI read.

Dependencies: Stage 4B alerts/notifications, Stage 4B-2 mutations, P85-IF activation and human-control.

Errors and boundary cases: red lock mid-commit, manual reply mid-commit, duplicate worker commit, correction race, notification duplicate, review item dismissed then rerun.

Tests: commit rollback, duplicate idempotency, correction before/pending/sent, AI pause on sent correction, no automatic corrective message.

Validation metrics: duplicate responses 0; stale commits 0; correction auto-send 0; red lock violation 0.

Done criteria: decisions and corrections are atomic, auditable, and fail closed.

### Faz 9 - Bounded APIs and Conversation UI

Purpose: expose images safely in the Stage 4B-2 messaging UI.

Scope: media DTOs, authenticated streaming endpoint, thumbnails, preview modal, review/correction panel, list preview, and responsive visual QA.

Prerequisites: Phase 8 complete.

Affected files: `/api/conversations`, `/api/conversations/[id]/messages`, new `/api/conversations/[id]/media/[assetId]`, correction route, message bubble, conversation panel, messaging hook, visual tests.

Architecture decisions: DTOs contain safe media metadata only. Full/thumb media is streamed server-side with conversation permission checks, `no-store`, and `nosniff`. No signed URL or object key is returned.

Implementation steps: extend `ConversationMessageDto` with `media` array; render fixed-aspect thumbnail; add expired/revoked placeholder; add modal preview for authorized roles; add visual review panel for dietitian/owner/admin; add correction form with expected revision; list preview displays fixed `Gorsel`.

Technical method: role-gated route handlers; bounded pagination preserved; CSS stable aspect ratios; lucide icons; no nested cards; four Playwright viewports.

Data flow: list/detail reads metadata -> UI requests media stream -> server permission check -> storage stream.

Dependencies: Stage 4B-2 read permission contracts, RLS, storage bucket.

Errors and boundary cases: expired media, revoked media, unauthorized role, missing object, slow stream, thumbnail missing, mobile layout overflow.

Tests: unauthorized media 403, expired 410/placeholder, cross-tenant 404/403, desktop/tablet/Android/iOS screenshots, no overlap, no object-key leakage.

Validation metrics: cross-tenant media access 0; expired/revoked object access 0; UI text overlap 0; object key in network DTO 0.

Done criteria: dietitians can review visual messages safely; unauthorized users cannot access media.

### Faz 10 - Canonical Webhook, Worker, and Simulator Integration

Purpose: make the canonical P85-IF path the only local mock image ingress and add repeatable simulator workflows.

Scope: webhook unification, local workers, multipart simulator upload, fixture-backed scenarios, and channel replay expansion.

Prerequisites: Phase 9 complete.

Affected files: `/api/whatsapp/webhook`, P85-IF batch runner, worker scripts, simulator APIs/UI, package scripts, channel replay tests.

Architecture decisions: retire legacy single-message media rejection as the active local path after tests are migrated. Production/hosted refusal and mock secret remain mandatory. Worker command is `npm run worker:media:stage4b3`; no public internal worker endpoint.

Implementation steps: route mock webhook through canonical P85-IF batch; support multipart fixture upload in simulator; add caption/burst message controls; add injected clock flush for 120-second bundles; add fixture-hash observation cache.

Technical method: local-only env gates; explicit test fixtures; no real Meta media fetch; no external network.

Data flow: simulator/webhook -> canonical event ledger -> admission -> worker -> bundle -> decision.

Dependencies: P85-IF secure ingress, Stage 4B-2 simulator, Phase 79 replay harness.

Errors and boundary cases: missing mock secret, production host, non-local env, legacy route drift, duplicate replay, worker not running.

Tests: webhook text regression, image admission, mixed text/image burst, production refusal, hosted sandbox refusal, full channel replay with visual fixtures.

Validation metrics: real production image ingress 0; external egress 0; legacy/canonical duplicate handling 0 duplicate responses.

Done criteria: one canonical local ingress path handles text and image fixtures.

### Faz 11 - Lifecycle, DSAR, Operations, and Observability

Purpose: enforce retention, export, deletion, redaction, and operational visibility for visual media.

Scope: 30-day object expiry, revoke/delete, DSAR/export metadata, removal/anonymization, orphan detection, aggregate metrics.

Prerequisites: Phase 10 complete.

Affected files: Phase 74 lifecycle helpers, data governance/export, operational health, admin diagnostics, retention worker, tests.

Architecture decisions: sanitized full/thumb objects expire after 30 days; raw original retention is 0; OCR/analysis/correction metadata may remain for 24 months as evidence but becomes prompt/retrieval-ineligible after media expiry. Client export includes safe media manifest and still-live authenticated media stream option, not raw object keys.

Implementation steps: add expiry job; add revoke delete path; extend client removal/anonymization to cancel open bundles, delete objects, redact OCR/correction text; add prepare-delete-finalize saga; add orphan detector; add aggregate-only metrics.

Technical method: service-role lifecycle RPCs; retry on object deletion failure; immediately exclude client from app reads if deletion finalization is pending; no raw OCR in logs.

Data flow: lifecycle event -> cancel bundles -> delete objects -> redact metadata -> audit evidence -> operational aggregate.

Dependencies: Phase 74 retention, Phase 79 lifecycle evidence, P85-IF export leak detection.

Errors and boundary cases: storage deletion failure, legal hold, expired object with live analysis, DSAR during open bundle, revoke during worker claim, orphan object.

Tests: export no object key, deletion removes object, anonymization redacts OCR, expired media inaccessible, orphan detector catches seeded object.

Validation metrics: expired/revoked/DSAR object access 0; raw bytes in export 0; orphan detector pass; aggregate metrics contain no raw text.

Done criteria: visual lifecycle matches privacy policy and fails closed on deletion anomalies.

### Faz 12 - Verification, Red Team, Closure, and Stage 4C Handoff

Purpose: prove Stage 4B-3 is safe enough locally before Stage 4C begins.

Scope: full test matrix, synthetic fixture corpus, red-team cases, visual QA, RLS/storage, replay, scale, docs, and closure evidence.

Prerequisites: Phases 0-11 complete.

Affected files: closure evidence doc, rehearsal scripts, visual tests, risk register, handoff docs, pilot/gate docs.

Architecture decisions: all tests use synthetic fixtures only. No real health/person/brand images are required or stored.

Implementation steps: run core, app, RLS/storage, lint, build, visual, channel replay, production-scale, media rehearsal, release verify, diff check, secret scan; add red-team fixture set for meal, mixed dish, supplement, full/cropped/glare label, screenshot misinformation, prompt injection, body, lab, unknown, corrupt, spoof, huge, EXIF, duplicate, multiple images.

Technical method: cached-observation scale for 5,000 decisions plus at least 200 actual decode/storage round trips; four Playwright viewports; no skipped RLS/storage counted as pass.

Data flow: fixtures -> simulator/webhook -> media worker -> bundle worker -> core -> UI/API/lifecycle assertions -> evidence.

Dependencies: all previous phases.

Errors and boundary cases: any hard-zero metric failure blocks closure; skipped RLS/storage blocks closure; doc contradiction blocks closure.

Tests: complete suite plus targeted visual media safety matrix.

Validation metrics: yellow/red client sends 0; unknown/low-confidence sends 0; supplement/body/lab sends 0; no response before 120s silence; duplicate responses 0; stale commits 0; external egress 0; raw bytes in DB/log/prompt/audit 0; cross-tenant media access 0; public object 0; expired/revoked/DSAR object access 0; client-facing AI/OCR/confidence wording 0; absence-of-label-evidence allowed result 0; text-only regression unchanged.

Done criteria: closure evidence is complete, risk register reconciled, handoff updated to Stage 4C, and production remains `NO-GO`.
