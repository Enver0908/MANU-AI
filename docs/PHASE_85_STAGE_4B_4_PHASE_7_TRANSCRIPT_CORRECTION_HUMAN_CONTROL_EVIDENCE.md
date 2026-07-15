# Phase 85 Stage 4B-4 - Phase 7 Transcript Correction, Versioning, and Human Control Evidence

Date: 2026-07-15

## Scope

Phase 7 lets authorized dietitians correct accepted voice transcripts with immutable revisioning, CAS locks, draft invalidation, sent-response manual follow-up, and atomic persistence. Provider observations on superseded revisions remain unchanged.

## Files Added

- `app/src/lib/phase-85-stage-4b4-atomic-transcript-correction.ts`
- `app/src/lib/phase-85-stage-4b4-transcript-corrections.ts`
- `app/src/lib/phase-85-stage-4b4-transcript-correction-bounded.ts`
- `app/src/lib/phase-85-stage-4b4-bundle-notifications.ts`
- `app/src/lib/phase-85-stage-4b4-transcript-corrections.test.ts`
- `app/src/lib/phase-85-stage-4b4-transcript-correction-bounded.test.ts`
- `app/src/app/api/conversations/[id]/voice-transcript-corrections/route.ts`
- `app/supabase/migrations/20260714210000_phase_85_stage_4b4_atomic_transcription_correction.sql`
- `docs/PHASE_85_STAGE_4B_4_PHASE_7_TRANSCRIPT_CORRECTION_HUMAN_CONTROL_EVIDENCE.md`

## Files Updated

- `app/src/lib/supabase-store.ts` — `submitSupabaseTranscriptCorrection`
- `app/src/lib/app-state-store.ts` — `submitFallbackTranscriptCorrection`
- `app/src/lib/phase-85-stage-4b3-supabase-atomic-decisions.ts` — RPC commit helper
- `app/src/lib/phase-85-stage-4b-contracts.ts`, notifications, API labels, i18n — `voice_transcript_correction_follow_up`
- `app/scripts/rehearse-stage-4b4-audio.mjs` — Phase 7 suites

## Locked Behavior

- Correction creates a new `accepted` transcription revision; prior revision becomes `superseded` without mutating provider observation.
- Message body, bundle item `transcriptionId`, and media asset `transcriptionId` update atomically in local state and RPC.
- Pre-send correction invalidates pending drafts and reopens bundle for rerun (`invalidate_pending` / `supersede_rerun`).
- Post-send correction pauses AI, locks human takeover, emits one follow-up notification, and forbids automatic client send (`manual_follow_up`).
- Active `redRiskLock` remains locked through pre-send correction.
- Request ID idempotency replays the same correction without duplicate side effects.

## Verification

Executed on 2026-07-15:

- `cd app && npx vitest run src/lib/phase-85-stage-4b4-transcript-corrections.test.ts src/lib/phase-85-stage-4b4-transcript-correction-bounded.test.ts src/lib/phase-85-stage-4b4-migration-contract.test.ts` — 15/15 passed
- `cd app && npm run lint` — 0 errors
- `cd app && npm run build` — passed

## Hard-Zero Metrics (Phase 7 local slice)

| Metric | Result |
| --- | --- |
| stale_correction_commit | 0 |
| post_send_automatic_second_client_send | 0 |
| duplicate_correction_notification | 0 |

## Handoff

Next implementation work is Stage 4B-4 Phase 8: bounded API, audio playback, and dietitian transcript review UI. Stage 4C remains blocked. Production pilot remains `NO-GO`; R-405 remains open.
