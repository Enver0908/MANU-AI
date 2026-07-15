# Phase 85 Stage 4B-4 - Sesli Mesaj Guvenligi ve Transkripsiyon Orkestrasyonu Eylem Plani

Phase 0 status, 2026-07-14: canonical plan and handoff lock are active. Stage 4B-4 is inserted between completed Stage 4B-3 post-closure remediation R0-R9 and Stage 4C. Stage 4C is blocked until Stage 4B-4 implementation, verification, evidence closure, risk-register reconciliation, and handoff update are complete.

Phase 1 status, 2026-07-15: voice threat model, domain contract, and type boundary are complete locally. Evidence: `docs/PHASE_85_STAGE_4B_4_PHASE_1_DOMAIN_TYPE_CONTRACT_EVIDENCE.md`. Phase 2 status, 2026-07-15: database, private audio storage, RLS, and queue foundation are complete locally. Evidence: `docs/PHASE_85_STAGE_4B_4_PHASE_2_DATABASE_STORAGE_RLS_EVIDENCE.md`. Phase 3 status, 2026-07-15: canonical WhatsApp audio ingress and secure admission are complete locally. Evidence: `docs/PHASE_85_STAGE_4B_4_PHASE_3_CANONICAL_INGRESS_AUDIO_ADMISSION_EVIDENCE.md`. Phase 4 status, 2026-07-15: deterministic mock transcription provider and quality gate are complete locally. Evidence: `docs/PHASE_85_STAGE_4B_4_PHASE_4_DETERMINISTIC_TRANSCRIPTION_PROVIDER_EVIDENCE.md`. Phase 5 status, 2026-07-15: bundle correlation and typed-text bridge are complete locally. Evidence: `docs/PHASE_85_STAGE_4B_4_PHASE_5_BUNDLE_CORRELATION_TYPED_TEXT_BRIDGE_EVIDENCE.md`. Phase 6 status, 2026-07-15: existing risk chain and atomic response orchestration are complete locally. Evidence: `docs/PHASE_85_STAGE_4B_4_PHASE_6_RISK_CHAIN_ATOMIC_ORCHESTRATION_EVIDENCE.md`. Phase 7 status, 2026-07-15: transcript correction, revision locks, and human-control rerun are complete locally. Evidence: `docs/PHASE_85_STAGE_4B_4_PHASE_7_TRANSCRIPT_CORRECTION_HUMAN_CONTROL_EVIDENCE.md`. **Next:** Phase 8 bounded API, audio playback, and dietitian transcript review UI.

Production pilot remains `NO-GO`. R-405 remains open. Real WhatsApp, Telegram, Gemini, external LLM, production webhook, monitoring, backup, secret-manager, billing, and real client health-data paths remain disabled. Stage 4B-4 is limited to local gated WhatsApp-like audio payload handling, deterministic mock transcription, and text-only response orchestration.

## Locked Decisions

1. Stage 4B-4 accepts only direct WhatsApp-like `audio` events where the provider payload marks the media as a voice note (`audio.voice === true`) and the decoded media is OGG/Opus.
2. Generic audio files, videos, calls, group messages, forwarded voice clips without trusted direct-client identity, and business-human voice recordings are out of scope.
3. Client-facing replies remain text only. Stage 4B-4 does not add text-to-speech, voice replies, voice cloning, or generated audio.
4. A voice message becomes eligible for the existing typed-message risk and response chain only after transcription passes the Stage 4B-4 quality gate.
5. Accepted transcripts use the same clinical risk, intent, source-authority, answerability, output guard, autopilot, draft, manual-review, and red/yellow handling rules as typed client text.
6. The system must not infer emotion, urgency, speaker identity, age, health status, accent, or credibility from tone, prosody, background noise, or speaker characteristics.
7. Voice format alone is not a clinical risk category. Risk comes from the accepted transcript and existing conversation context.
8. The deterministic mock transcription provider is the only implementation allowed in this stage. Real speech-to-text provider egress is blocked by default and remains production `NO-GO`.
9. Original OGG/Opus bytes are worker-memory only after secure download. The persisted playable artifact is canonical 16 kHz mono PCM16 WAV in private storage.
10. Audio media retention is 30 days. Accepted and corrected transcripts persist as normal conversation text/audit evidence. Rejected transcript evidence is minimized and redacted after 30 days.
11. Client language is resolved from the client communication-language setting. Supported locales are `tr-TR`, `en-US`, `de-DE`, `fr-FR`, `es-ES`, `pt-PT`, and `cs-CZ`.
12. Audio admission caps are max 16 MiB input size, max 300 seconds per voice note, max 4 voice notes per inbound bundle, and max 600 seconds total voice duration per bundle.
13. Transcript acceptance requires overall confidence `>= 0.95`, minimum segment confidence `>= 0.90`, zero uncertain spans, language match with the client communication language, and normalized transcript length from 1 to 4096 Unicode codepoints.
14. A failed, pending, low-confidence, wrong-language, overlong, empty, multi-speaker-ambiguous, corrupted, unsupported, or provider-disabled transcription fails closed to dietitian review and must not produce an AI client send.

## Public Contracts To Add

- `ChannelEventKind`: add `client_message_audio`.
- `MediaAssetRecord`: add audio metadata fields for codec, container, duration, sample rate, channel count, canonical audio storage key, audio hash, transcription status, and transcription id.
- `VoiceTranscriptionRecord`: immutable provider attempt and accepted transcript record with tenant, client, conversation, source message, media asset, provider mode, locale, transcript text, segment list, confidence metrics, quality decision, rejection reasons, and audit timestamps.
- `VoiceTranscriptCorrectionRecord`: dietitian correction version with expected transcription revision, corrected transcript, correction reason enum, actor id, target message id, rerun decision id, and supersession metadata.
- `ConversationAudioDto`: client-safe audio playback metadata with `assetId`, `durationMs`, `streamUrl`, `expiresAt`, and no storage key, hash, provider score, or raw provider payload.
- `ConversationVoiceTranscriptDto`: client-safe transcript status and accepted/corrected transcript display metadata with no raw confidence scores.
- `ConversationMessageDto`: add optional `audio` and `voiceTranscript`.
- `POST /api/conversations/[id]/voice-transcript-corrections`: dietitian/owner/admin correction endpoint with expected revision, corrected transcript, correction reason, and rerun policy.
- `GET /api/conversations/[id]/media/[assetId]`: extend existing bounded media stream contract to support `audio` assets and HTTP Range responses.
- Scripts: `worker:audio:stage4b4`, `worker:audio:stage4b4:once`, and `rehearse:stage-4b4:audio`.
- Environment gate: `MANU_ALLOW_MOCK_VOICE_TRANSCRIPTION=true` is required for deterministic local transcription. Real provider env names must not be added in Stage 4B-4.

## Phase 0 - Worktree, Canonical Plan, and Handoff Lock

Purpose: Insert Stage 4B-4 into the active worktree as the next mandatory implementation stage, preserve the completed Stage 4B-3 R9 closure as an immutable checkpoint, block Stage 4C, and leave a clean tree.

Scope: Documentation, handoff, risk register, branch hygiene, and evidence only. No runtime TypeScript, SQL, package dependency, provider, API, worker, UI, or migration behavior changes.

Prerequisites: Stage 4B-3 post-closure remediation R0-R9 is complete locally and committed before this Stage 4B-4 documentation set. Current branch is moved to `codex/stage-4b4-voice-transcription` after the R9 commit.

Affected files: `PLAN.md`, `PROJECT_PLAN.md`, `README.md`, `HANDOFF_FOR_NEXT_CODEX.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`, `app/README.md`, `docs/RISK_REGISTER.md`, this plan file, and `docs/PHASE_85_STAGE_4B_4_PHASE_0_DOCUMENTATION_EVIDENCE.md`.

Architectural decisions: Stage 4B-4 is a Stage 4B consumer extension, not a new major product phase. It reuses Stage 4B-2 conversation ownership and Stage 4B-3 media/orchestration patterns. Stage 4C is blocked until voice safety closes. Production remains `NO-GO`.

Implementation steps: commit the existing R9 set, create the Stage 4B-4 branch, add this canonical plan, add Phase 0 evidence, update active authority blocks, add voice risks R-451 through R-461, run `git diff --check`, commit documentation only, and verify `git status --short` is clean.

Technical method: use repository-relative Markdown links, preserve historical paragraphs as historical snapshots, and put explicit current-authority paragraphs at the top of handoff files.

Data flow: no runtime data flow changes. Documentation flow changes from `Stage 4B-3 R9 -> Stage 4C` to `Stage 4B-3 R9 -> Stage 4B-4 -> Stage 4C`.

Dependencies: Git, Markdown docs, risk register, and existing Stage 4B-3 R9 evidence.

Errors and edge cases: if uncommitted non-R9 files are found before the R9 commit, stop and ask for user direction. If branch creation fails because the branch exists, switch to it only if it points at or descends from the R9 commit. If `git diff --check` fails, fix only whitespace introduced by Phase 0.

Tests: `git diff --check`, `git status --short`, and documentation grep for Stage 4B-4 current authority, Stage 4C blocked, production `NO-GO`, R-405 open, and real provider/channel paths disabled.

Validation metrics: one R9 code/evidence commit exists before Stage 4B-4 docs. One Stage 4B-4 docs commit exists after it. No runtime files are changed by the docs commit. Worktree is clean.

Completion criteria: this plan is present, Phase 0 evidence is present, handoff documents name Stage 4B-4 as current, Stage 4C is explicitly blocked, risks R-451 through R-461 are open, production remains `NO-GO`, R-405 remains open, and the worktree is clean after commit.

## Phase 1 - Voice Threat Model, Domain Contract, and Type Boundary

Purpose: Define audio-specific domain objects, threat boundaries, and type contracts before adding runtime ingestion.

Scope: TypeScript domain files, pure validators, fixtures, unit tests, and documentation evidence. No database migration, storage write, provider call, or UI.

Prerequisites: Phase 0 complete. Stage 4B-2 message DTO ownership and Stage 4B-3 media contracts are read and used as source patterns.

Affected files: `app/src/lib/phase-85-if-c-channel-event-normalizer.ts`, `app/src/lib/phase-85-stage-4b3-media-contracts.ts`, new `app/src/lib/phase-85-stage-4b4-voice-contracts.ts`, new tests, and a Phase 1 evidence doc.

Architectural decisions: audio is first-class `client_message_audio` until transcription acceptance. Accepted transcript then bridges into the existing typed text path with provenance.

Implementation steps: add the audio event kind; create voice enums for admission, transcription, transcript quality, correction reasons, and lifecycle; define immutable transcription/correction records; define DTOs; define validation helpers for locale, duration, size, confidence, uncertain spans, and codepoint length; add golden cases for valid direct voice note, unsupported audio file, group voice, wrong locale, low confidence, overlong transcript, empty transcript, duplicate media, and forwarded/untrusted voice.

Technical method: use discriminated unions and pure validator functions. Reuse Stage 4B-3 tenant/client/conversation identifiers. Do not add provider-specific payload fields to shared DTOs.

Data flow: provider payload becomes normalized audio event metadata only. No bytes are downloaded in Phase 1.

Dependencies: Stage 4B-3 contract naming, P85-IF event provenance model, and supported language list.

Errors and edge cases: unknown MIME, missing `voice === true`, absent media id, missing sender identity, group context, unsupported language, duration unknown, and duplicate event produce fail-closed domain decisions.

Tests: unit tests for type guards, validator tables, normalizer golden cases, DTO redaction, and unsupported event preservation.

Validation metrics: 100 percent of Phase 1 golden cases produce deterministic statuses. No raw provider payload appears in client-safe DTO snapshots.

Completion criteria: audio domain contracts compile, focused tests pass, unsupported audio stays quarantined/review-required, and no runtime storage/provider code is introduced.

## Phase 2 - Persistence, Private Audio Storage, RLS, and Queue Foundation

Purpose: Add append-only database and private-storage foundation for audio assets, transcription attempts, correction versions, and worker claiming.

Scope: Supabase migrations, RLS policies, service-role RPCs, app mappers, fallback store shape, and tests. No real provider egress.

Prerequisites: Phase 1 complete and local Supabase available for reset/RLS verification.

Affected files: migrations `20260714170000_phase_85_stage_4b4_audio_foundation.sql` and `20260714180000_phase_85_stage_4b4_audio_queue.sql`, storage bucket policy extensions, new mappers, fallback store loaders, and RLS tests.

Architectural decisions: original OGG/Opus is never persisted beyond worker memory. Only canonical WAV is stored in the private media bucket. Transcription records are append-only except for bounded status transitions controlled by service-role RPCs.

Implementation steps: extend media schema or add audio companion table; create transcription table; create correction table; add queue lease fields; add tenant/client/conversation indexes; add service-role claim/complete/fail RPCs; add dietitian correction RPC; add RLS so assigned dietitian/owner/admin can read safe conversation-scoped rows and only service role can mutate worker state.

Technical method: append-only migrations only; use check constraints for status enums, confidence bounds, locale list, duration and size caps; use unique constraints for provider event id/media hash idempotency.

Data flow: normalized audio metadata persists as an admitted media asset and pending transcription queue item. Canonical WAV storage key is written only after secure admission completes.

Dependencies: existing Supabase helpers, Stage 4B-3 media tables/bucket, auth role model, and conversation assignment RLS.

Errors and edge cases: duplicate webhook event, duplicate media hash, expired media URL, worker lease timeout, tenant mismatch, missing conversation, revoked client, and deleted media fail closed.

Tests: migration contract tests, mapper tests, local RLS tests for owner/admin/dietitian/assistant/viewer/auditor/cross-tenant access, RPC stale lease tests, and export redaction tests.

Validation metrics: RLS suite has 0 skipped tests. Cross-tenant select/mutate attempts return no rows or controlled denial. Duplicate admission creates no duplicate queue items.

Completion criteria: database/storage foundation exists, local RLS passes, no direct user write path exists for worker fields, and real provider env gates remain absent.

## Phase 3 - Canonical WhatsApp Audio Ingress and Secure Admission

Purpose: Convert trusted local WhatsApp-like voice-note events into admitted audio assets without allowing unsupported audio into AI processing.

Scope: mock-gated ingress normalizer, metadata validation, media download abstraction, byte validation, Opus decode, WAV canonicalization, private storage write, and admission tests.

Prerequisites: Phase 2 complete. `MANU_ALLOW_MOCK_VOICE_TRANSCRIPTION` remains off by default.

Affected files: `phase-85-if-c-channel-event-normalizer.ts`, Stage 4B-3 canonical ingress files, new `phase-85-stage-4b4-audio-admission.ts`, deterministic audio fixtures, and package dependency updates only for MIT libraries `ogg-opus-decoder`, `wave-resampler`, and `wavefile`.

Architectural decisions: admission validates declared MIME and decoded codec/container facts. The worker writes only canonical WAV. GPL `ffmpeg-static` is not introduced.

Implementation steps: recognize direct `audio.voice === true`; fetch media through mock transport; cap bytes before decode; verify OGG/Opus; decode to PCM; resample to 16 kHz mono PCM16 WAV; compute hashes; write private object; persist sanitized metadata; mark unsupported/corrupt/oversized/overduration as review-required with no transcript job.

Technical method: stream or bounded-buffer decode with strict byte and duration caps. Store sanitized error codes, not raw byte excerpts.

Data flow: WhatsApp-like event -> channel ledger -> canonical audio event -> admission worker -> canonical WAV private object -> transcription pending.

Dependencies: Meta-style media id semantics, Stage 4B-3 durable media transport, private storage registry, and package lock.

Errors and edge cases: MIME spoofing, corrupt OGG page, non-Opus audio, stereo/multichannel file, huge duration metadata, decode failure, storage write failure, missing tenant/client mapping, and replayed media id.

Tests: golden payload tests, malicious file fixtures, size/duration cap tests, duplicate tests, zero-external-egress assertions, and `git diff --check`.

Validation metrics: unsupported/corrupt inputs never create transcription jobs. Valid fixtures create exactly one canonical WAV and one transcription queue item.

Completion criteria: audio ingress exists behind local gates, no client send can originate from admission alone, and all admission failures route to manual review.

## Phase 4 - Deterministic Transcription Provider and Quality Gate

Purpose: Produce deterministic local transcripts and enforce strict acceptance before the transcript can enter the clinical chain.

Scope: provider-neutral interface, deterministic fixture provider, quality evaluator, transcript persistence, worker CLI, and tests.

Prerequisites: Phase 3 complete and canonical WAV assets available in private storage.

Affected files: new voice provider, mock transcription provider, transcription worker, `worker-audio-stage4b4.mjs`, package scripts, and tests.

Architectural decisions: provider interface is future-proof but real provider implementation is prohibited. Confidence absence is fail-closed unless the deterministic mock explicitly marks a fixture as manually accepted for a test case.

Implementation steps: define provider request/response contracts; load fixture transcript by canonical audio hash; compute language, confidence, segment, uncertain-span, and length checks; persist immutable transcription attempt; mark accepted transcripts `analysis_ready`; mark rejected transcripts `review_required`; record worker metrics.

Technical method: all provider calls pass through `assertMockVoiceTranscriptionAllowed`. Provider result schema validation rejects unknown fields and raw provider logs.

Data flow: transcription queue item -> canonical WAV read -> deterministic provider -> quality gate -> accepted/rejected transcription record -> media asset status.

Dependencies: private media storage read helper, queue RPC, language helpers, and test fixtures.

Errors and edge cases: missing fixture, provider disabled, confidence missing, low confidence, uncertain spans, wrong language, empty transcript, overlong transcript, segment overlap, duplicate completion, and stale lease.

Tests: provider gate tests, quality threshold matrix, worker once tests, stale lease tests, fixture hash determinism, and no external network call assertions.

Validation metrics: hard zero accepted transcripts below thresholds and hard zero network egress.

Completion criteria: deterministic transcription worker runs locally, accepted transcripts are sharply bounded, and rejected transcripts fail closed.

## Phase 5 - Bundle Correlation and Typed-Text Bridge

Purpose: Merge accepted voice transcripts into the existing 120-second client message bundle without breaking text/image behavior.

Scope: bundle builder, message provenance, bridge function from accepted transcript to synthetic typed-text input, cap handling, and tests.

Prerequisites: Phase 4 complete. Stage 4B-3 bundle code and R9 closure evidence are preserved.

Affected files: Stage 4B-3 message bundle/orchestration files, new `phase-85-stage-4b4-transcript-bridge.ts`, tests, and golden bundle cases.

Architectural decisions: the bridge does not erase audio provenance. The risk chain receives transcript text plus `sourceModality: voice_transcript`, transcription id, media asset id, and quality decision metadata.

Implementation steps: add audio bundle slots; enforce max 4 voice notes and 600 seconds total duration; wait for accepted transcript or timeout; overflow to review-required; create typed-text bridge only after acceptance; preserve order by original received timestamp; block bridge on corrected/superseded transcripts until correction rerun completes.

Technical method: use immutable bundle item records and existing silence queue semantics. Use stable idempotency keys derived from conversation id, media asset id, transcription id, and bundle id.

Data flow: accepted transcript -> bundle item -> silence queue due -> text bridge -> existing risk/orchestration input.

Dependencies: Stage 4B-3 bundle worker, message ledger, and transcription records.

Errors and edge cases: transcript arrives after bundle due time, text plus voice same bundle, image plus voice same bundle, four-plus voice notes, transcription pending timeout, deleted media before due, and duplicate bridge execution.

Tests: bundle ordering tests, timeout tests, mixed text/image/voice tests, cap overflow tests, and duplicate idempotency tests.

Validation metrics: exactly one bridge input per accepted transcription. Pending/rejected voice never enters typed text chain.

Completion criteria: voice transcripts participate in bundles only after quality acceptance and cannot bypass existing bundle safety gates.

## Phase 6 - Existing Risk Chain and Atomic Response Orchestration

Purpose: Route accepted voice transcripts through the same safety model as typed messages and commit the result atomically.

Scope: risk classification, intent, answerability, approved-source gating, narrow autopilot, output guard, draft/manual review, and atomic decision commit integration.

Prerequisites: Phase 5 complete and existing typed message tests passing.

Affected files: Stage 4B-2 messaging/orchestration files, Stage 4B-3 atomic decision files, simulator helpers, and voice-specific regression tests.

Architectural decisions: there is no voice-specific clinical relaxation or escalation. The only voice-specific gate is transcription quality. Once accepted, transcript text is processed by the existing typed-message chain.

Implementation steps: add `sourceModality` to risk input; assert every typed-message clinical gate runs for accepted transcripts; block client send for red/yellow/review-required; allow green autopilot only when existing typed rules pass; persist decision references to transcription id; include transcript provenance in audit evidence.

Technical method: reuse existing orchestrator functions and add tests that compare typed and accepted-voice outcomes for identical text.

Data flow: bundle bridge -> existing risk chain -> existing atomic decision commit -> draft/send/manual-review state -> conversation DTO.

Dependencies: Stage 4B-2 messaging contracts, Stage 4B-3 atomic decisions, core classifier, and output guard.

Errors and edge cases: risk chain throws, stale conversation revision, human takeover active, red lock active, channel permission disabled, client removed, unsupported source authority, and provider disabled.

Tests: typed/voice parity tests, red/yellow/green matrix, prompt-injection spoken transcript, source-answerability failures, atomic stale-revision tests, and no-send on non-green tests.

Validation metrics: hard zero unsafe voice sends, yellow/red voice sends, and low-confidence voice sends. Typed and accepted-voice outcomes match for identical text and context.

Completion criteria: accepted voice transcripts cannot bypass any text safety rule and every committed action is revision-safe and auditable.

## Phase 7 - Transcript Correction, Versioning, and Human Control

Purpose: Let authorized dietitians correct transcripts and trigger deterministic re-evaluation without mutating historical evidence.

Scope: correction API, correction records, expected revision checks, rerun policy, audit trail, DTO updates, and tests.

Prerequisites: Phase 6 complete.

Affected files: new API route `app/src/app/api/conversations/[id]/voice-transcript-corrections/route.ts`, correction helpers, migration `20260714190000_phase_85_stage_4b4_atomic_transcription_correction.sql`, conversation DTO helpers, and tests.

Architectural decisions: corrections are append-only versions. Historical transcript attempts remain immutable. A correction can rerun the existing risk chain or create a manual follow-up task through deterministic policy.

Implementation steps: validate correction request; enforce actor role and conversation assignment; require expected transcription revision; create correction version through service-role RPC; invalidate stale AI drafts tied to the old transcript; rerun risk chain only if the original message is still active and no human-control lock blocks it; otherwise create review evidence.

Technical method: use transaction/RPC for correction plus stale draft invalidation. Return controlled `409` for stale correction and `403` for unauthorized actor.

Data flow: dietitian correction -> RPC correction version -> draft invalidation -> optional rerun -> updated conversation DTO.

Dependencies: auth context, conversation assignment, Stage 4B-2 mutations, and Stage 4B-3 atomic outcomes.

Errors and edge cases: concurrent correction, correction to empty/overlong text, correction on deleted media, correction after manual reply, correction during red lock, cross-client correction attempt, and rerun failure.

Tests: API auth tests, stale revision tests, correction rerun matrix, draft invalidation tests, export/redaction tests, and audit log tests.

Validation metrics: no correction overwrites prior transcript and no stale draft remains sendable after correction.

Completion criteria: dietitians can safely correct transcripts, and correction effects are explicit, versioned, and auditable.

## Phase 8 - Bounded API, Audio Playback, and Conversation UI

Purpose: Surface voice messages and accepted/corrected transcripts in the conversation dashboard without leaking storage keys, hashes, raw provider data, or clinical internals.

Scope: read APIs, media streaming, Range support, UI rendering, keyboard/accessibility behavior, visual tests, and client-safe DTO tests.

Prerequisites: Phase 7 complete.

Affected files: conversation message API, media route, messaging panel components/helpers, UI tests, Playwright visual tests, and DTO contract tests.

Architectural decisions: audio playback uses server-mediated private streaming only. Browser never receives object keys. UI shows status categories, transcript text when accepted/corrected, and review-required state when rejected.

Implementation steps: extend DTO projection; extend media route for audio with `206 Partial Content` and `416 Range Not Satisfiable`; add authorization checks before stream; add transcript correction affordance for authorized dietitian/owner/admin only; hide correction controls from assistant/viewer/auditor; add responsive layout for desktop, tablet, iOS mobile, and Android mobile.

Technical method: reuse Stage 4B-3 bounded media stream helper with explicit audio MIME and byte-range handling. Use existing design-system components.

Data flow: conversation read API -> safe DTO -> UI audio row -> authorized stream request -> private object stream.

Dependencies: Stage 4B-2 read API, Stage 4B-3 media route, UI design system, and Playwright.

Errors and edge cases: expired/revoked audio, missing object, unauthorized stream request, invalid Range header, transcript pending, transcript rejected, correction pending, and mobile text overflow.

Tests: DTO leak tests, API role tests, Range 200/206/416 tests, Playwright visual tests across four viewports, keyboard navigation, and no-overlap assertions.

Validation metrics: hard zero storage key/hash/provider confidence exposure in client DTO. Visual snapshots have no overlap and controls are role-correct.

Completion criteria: voice messages are visible and playable only through bounded authorized APIs, and transcript state is understandable without leaking internals.

## Phase 9 - Retention, DSAR, Legal Hold, and Operational Visibility

Purpose: Make audio lifecycle, export, deletion, redaction, and operational counters consistent with existing privacy boundaries.

Scope: retention jobs, DSAR export/redaction, legal hold handling, ops metrics, and tests.

Prerequisites: Phase 8 complete.

Affected files: migration `20260714200000_phase_85_stage_4b4_audio_lifecycle_bounded_reads.sql`, lifecycle worker, export/anonymization helpers, operational-health helpers, risk register, and tests.

Architectural decisions: audio media expires at 30 days unless legal hold blocks deletion. Accepted/corrected transcript remains in conversation history like typed text. Rejected provider evidence is minimized/redacted on schedule.

Implementation steps: add audio lifecycle states; add deletion queue handling for canonical WAV; add DSAR export entries for accepted/corrected transcript and minimized media metadata; redact storage keys and provider evidence; add legal-hold skip evidence; expose aggregate counters only.

Technical method: extend Stage 4B-3 lifecycle runner with explicit audio variant and idempotent delete operations.

Data flow: retention due asset -> lifecycle worker -> object delete/redaction -> export/anonymization state -> aggregate operational metric.

Dependencies: Stage 4B-3 lifecycle worker, DSAR helpers, and operational-health policy.

Errors and edge cases: object already deleted, storage delete failure, legal hold active, transcript correction after media deletion, export during pending deletion, tenant removal, and orphaned transcription record.

Tests: lifecycle unit tests, DSAR export/redaction tests, legal-hold tests, orphan detection tests, and RLS tests for lifecycle rows.

Validation metrics: hard zero expired audio object references after successful lifecycle run. DSAR export contains no raw provider payload or private storage key.

Completion criteria: audio lifecycle is enforceable, privacy-safe, and observable through aggregate metrics only.

## Phase 10 - Simulator, Golden Corpus, Red Team, and Scale Rehearsal

Purpose: Prove Stage 4B-4 behavior across realistic, malicious, multilingual, and scale scenarios before closure.

Scope: synthetic fixtures, red-team cases, replay rehearsal, scale test, visual acceptance, and release checks.

Prerequisites: Phase 9 complete.

Affected files: `app/src/lib/phase-85-stage-4b4-golden-corpus.jsonl`, `app/scripts/rehearse-stage-4b4-audio.mjs`, simulator helpers, tests, and evidence docs.

Architectural decisions: no free-form user audio upload is added. All audio fixtures are synthetic and repository-controlled. Scale rehearsal may cache deterministic fixture decode output but must still exercise admission, transcription, bundle, and orchestration state transitions.

Implementation steps: add at least 60 golden voice cases; add typed/voice parity cases; add malformed media cases; add multilingual language mismatch cases; add supplement/medication/number-sensitive transcript cases; add prompt injection spoken transcript cases; run 5000 cached fixture cases, 200 admission rounds, and 100x50 replay.

Technical method: use deterministic fixture hashes and stable expected outcomes. Capture pass/fail metrics in evidence without storing raw audio in logs.

Data flow: synthetic voice fixtures -> ingress -> admission -> transcription -> bundle -> risk chain -> DTO/lifecycle -> closure metrics.

Dependencies: all prior phases, Vitest, Playwright, and rehearsal scripts.

Errors and edge cases: fixture drift, nondeterministic decode, slow worker queues, memory spikes, duplicate sends, stale corrections, and lifecycle leftovers.

Tests: golden corpus tests, red-team tests, scale rehearsal, visual tests, release verify, secret scan, and `git diff --check`.

Validation metrics: hard zero unsafe voice sends, non-green voice sends, low-confidence sends, duplicate sends, cross-tenant reads, storage leaks, real provider egress, stale correction sends, and lifecycle orphan leaks.

Completion criteria: rehearsal evidence shows deterministic hard-zero metrics and no skipped required verification.

## Phase 11 - Measured Closure, Risk Reconciliation, and Stage 4C Handoff

Purpose: Close Stage 4B-4 only after measured evidence proves the voice path preserves the existing safety model.

Scope: closure evidence, risk-register reconciliation, canonical docs update, handoff update, final verification, and clean worktree.

Prerequisites: Phase 10 complete and all previous phase evidence docs present.

Affected files: this plan, Phase 11 evidence doc, top-level handoff docs, risk register, package scripts, and release evidence.

Architectural decisions: Stage 4C opens only after Stage 4B-4 has a complete PASS. Production remains `NO-GO`; real provider/channel paths remain disabled; R-405 remains open.

Implementation steps: run full targeted tests; run local RLS with zero skips; run Playwright visual suite for voice UI; run Stage 4B-4 audio rehearsal; run release verify; run secret scan; run forbidden real-provider env scan; run `git diff --check`; update risks R-451 through R-461 with mitigated-local or open-production status; update active handoff to Stage 4C.

Technical method: evidence must include commands, pass/fail counts, skipped tests, residual risks, and exact hard-zero metrics.

Data flow: verification outputs -> closure evaluator -> evidence doc -> handoff docs.

Dependencies: all Stage 4B-4 implementation files, RLS environment, and release verification.

Errors and edge cases: any skipped required test, unsafe send, egress, leak, stale correction send, or lifecycle orphan blocks closure.

Tests: full closure command set from Phase 10 plus local RLS and release verify.

Validation metrics: `unsafe_voice_send_count = 0`, `yellow_or_red_voice_send_count = 0`, `low_confidence_voice_send_count = 0`, `duplicate_voice_send_count = 0`, `raw_audio_leak_count = 0`, `cross_tenant_audio_read_count = 0`, `external_transcription_egress_count = 0`, `stale_correction_send_count = 0`, and `audio_lifecycle_orphan_count = 0`.

Completion criteria: Stage 4B-4 closure evidence is complete, Stage 4C is unblocked only as the next local stage, production remains `NO-GO`, R-405 remains open, and the worktree is clean after commit.
