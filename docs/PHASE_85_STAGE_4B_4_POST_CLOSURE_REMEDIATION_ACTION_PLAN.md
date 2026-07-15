# Phase 85 Stage 4B-4 Post-Closure Remediation Action Plan

Date opened: 2026-07-15
Status: **R7 complete; remediation active; Stage 4C blocked**

This document is the active authority after the post-closure audit of the local Stage 4B-4 voice-message implementation. The original Stage 4B-4 plan and Phase 11 closure evidence remain historical records. Stage 4C authorization is revoked until R9 produces a fresh complete PASS.

## Decision

The Phase 11 closure is reopened because the audit found gaps between the intended durable voice pipeline and the implemented local closure: audio admission work can remain unconsumed, source trust is not bounded by verified channel authority, real-STT enablement names exist contrary to the mock-only lock, lifecycle worker wiring is incomplete, measured closure can pass with optional full-scale checks, and active continuity documents authorize Stage 4C despite the remediation findings.

Production remains `NO-GO`. R-405 remains open. Real WhatsApp, Telegram, Gemini/external LLM, real STT provider egress, production webhook, monitoring, secret-manager, billing, and real client health-data paths remain disabled.

## Remediation Phase Order

1. **R0 - Kapanisi Geri Acma ve Remediation Kilidi:** reopen Phase 11 closure as an authorization artifact, add this remediation plan, revoke Stage 4C authorization, and update risk/continuity documents.
2. **R1 - Domain Contracts, Lineage, and Database Invariants:** lock voice-source authority, audio/transcript lineage, accepted-transcript invariants, idempotency keys, and migration-level constraints.
3. **R2 - Source Authority and Bounded Audio Admission:** replace hardcoded trust with verified inbound provenance, enforce admission caps before decode/storage, and fail closed on forwarded/group/business echo/unknown-source audio.
4. **R3 - Durable Admission and Transcription Worker Pipeline:** consume admission queue rows with lease semantics, persist canonical audio and transcription state transitions, and make worker success dependent on durable commits.
5. **R4 - Fail-Closed Provider and Quality Gate:** keep transcription mock-only, remove real-STT enablement paths, require explicit acceptance thresholds, and route all uncertain transcripts to review without typed-risk ingestion.
6. **R5 - Durable Transcript Bridge and Atomic Risk Orchestration:** bridge only accepted transcripts into the existing typed risk chain with bundle deadlines, revision checks, and atomic decision/draft/handoff/audit writes.
7. **R6 - Correction Lineage, Decision Supersession, and Human Control:** make transcript correction, rerun, draft invalidation, AI pause, and manual follow-up state transactional and idempotent.
8. **R7 - Bounded API, Secure Audio Streaming, and UI Correctness:** expose only bounded DTOs, use server-mediated range streaming, close auth fallback paths, and verify voice review/correction UI states.
9. **R8 - Retention, DSAR, Legal Hold, and Orphan Reconciliation:** wire audio lifecycle worker scripts, enforce retrieval ineligibility/deletion/legal-hold behavior, and measure orphan storage counts.
10. **R9 - Measured Closure, Risk Reconciliation, and Stage 4C Handoff:** require zero-skip local verification, real measured counters, full-scale closure gate, risk-register reconciliation, and a new Stage 4C handoff only on complete PASS.

## Locked Remediation Decisions

- Only verified direct client voice notes from the canonical inbound path can enter audio admission.
- Forwarded audio, group audio, business echoes, unsupported providers, missing account binding, missing actor binding, and unknown source authority fail closed before transcription.
- Original OGG bytes are not retained as promptable data. Canonical processing output is bounded 16 kHz mono PCM16 WAV plus minimized metadata.
- Admission caps are fixed at 16 MiB and 300 seconds unless a later explicit plan changes them.
- Bundle caps are fixed at 4 audio items and 600 seconds of total audio per decision window.
- No real speech-to-text provider, real STT environment variable, or external transcription egress is allowed in this remediation track.
- Only accepted transcripts enter the existing typed-message safety chain. Rejected, uncertain, low-confidence, wrong-language, multi-speaker, empty, overlong, or clinically ambiguous transcripts route to dietitian review.
- Transcript acceptance requires overall confidence >= 0.95, minimum segment confidence >= 0.90, zero uncertain spans, single speaker, locale match, and transcript length from 1 to 4096 codepoints.
- Voice decisions produce text responses only. Audio replies are out of scope.
- A zero-valued closure metric is invalid unless it includes measured source, scenario count, timestamp, and command/test evidence.
- Missing Docker/Supabase, skipped RLS/storage cases, optional full-scale omission, blocked browser verification, or timeout is `BLOCKED`, not `PASS`, for R9.

## R0 Completion Gate

R0 is complete only when active handoff documents name this remediation track as current, the Phase 11 closure evidence is explicitly historical/superseded for authorization, R-451 through R-461 are reopened, Stage 4C authorization is false, production `NO-GO` and R-405 open remain explicit, runtime files are unchanged by R0, and `git diff --check` passes.

R0 is complete. Evidence: `docs/PHASE_85_STAGE_4B_4_POST_CLOSURE_REMEDIATION_R0_EVIDENCE.md`.

R1 is complete. Evidence: `docs/PHASE_85_STAGE_4B_4_POST_CLOSURE_REMEDIATION_R1_EVIDENCE.md`.

R2 is complete. Evidence: `docs/PHASE_85_STAGE_4B_4_POST_CLOSURE_REMEDIATION_R2_EVIDENCE.md`.

R3 is complete. Evidence: `docs/PHASE_85_STAGE_4B_4_POST_CLOSURE_REMEDIATION_R3_EVIDENCE.md`.

R4 is complete. Evidence: `docs/PHASE_85_STAGE_4B_4_POST_CLOSURE_REMEDIATION_R4_EVIDENCE.md`.

R5 is complete. Evidence: `docs/PHASE_85_STAGE_4B_4_POST_CLOSURE_REMEDIATION_R5_EVIDENCE.md`.

R6 is complete. Evidence: `docs/PHASE_85_STAGE_4B_4_POST_CLOSURE_REMEDIATION_R6_EVIDENCE.md`.

R7 is complete. Evidence: `docs/PHASE_85_STAGE_4B_4_POST_CLOSURE_REMEDIATION_R7_EVIDENCE.md`.

## R9 Closure Gate

R9 may close only when all R1-R8 phases have evidence, local verification is complete with no skipped required checks, voice risks are reconciled from measured evidence, and active handoff documents are updated from remediation to Stage 4C. Until that file exists and passes, Stage 4C remains blocked.
