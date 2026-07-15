# Phase 85 Stage 4B-4 - Phase 8 Bounded API, Audio Playback, and Dietitian UI Evidence

Date: 2026-07-15

## Scope

Phase 8 surfaces voice messages and accepted/corrected transcripts in the conversation dashboard through bounded read APIs, authorized audio streaming with byte-range support, and dietitian transcript review/correction UI without leaking storage keys, provider confidence, or raw provider payloads.

## Files Added

- `app/src/lib/phase-85-stage-4b4-bounded-audio.ts`
- `app/src/lib/phase-85-stage-4b4-bounded-audio-rpc.ts`
- `app/src/lib/phase-85-stage-4b4-fallback-audio-storage.ts`
- `app/src/lib/phase-85-stage-4b4-media-range.ts`
- `app/src/lib/phase-85-stage-4b4-voice-review-labels.ts`
- `app/src/lib/phase-85-stage-4b4-bounded-audio.test.ts`
- `app/src/lib/phase-85-stage-4b4-media-range.test.ts`
- `app/src/components/dashboard/conversation-message-audio.tsx`
- `app/src/components/dashboard/conversation-voice-transcript-review-panel.tsx`
- `app/supabase/migrations/20260714220000_phase_85_stage_4b4_bounded_audio_reads.sql`
- `app/tests/visual/stage-4b4-audio.visual.spec.ts`
- `docs/PHASE_85_STAGE_4B_4_PHASE_8_BOUNDED_API_AUDIO_UI_EVIDENCE.md`

## Files Updated

- `app/src/lib/phase-85-stage-4b3-bounded-media.ts` — voice projection hook, `variant=audio`
- `app/src/lib/phase-85-stage-4b3-media-stream.ts` — Range 200/206/416, audio bucket
- `app/src/app/api/conversations/[id]/media/[assetId]/route.ts` — Range forwarding
- `app/src/lib/phase-85-stage-4b2-messaging.ts` — voice projection source
- `app/src/lib/phase-85-stage-4b2-contracts.ts` — projection source voice slice
- `app/src/lib/phase-85-stage-4b4-voice-contracts.ts` — `transcriptionRevision` on client DTO
- `app/src/lib/supabase-store.ts` — bounded voice RPC load
- `app/src/components/dashboard/conversation-message-bubble.tsx` — audio row
- `app/src/components/dashboard/conversation-panel.tsx` — transcript review panel
- `app/src/components/dashboard-app.tsx` — correction submit wiring
- `app/src/lib/use-stage-4b2-messaging.ts` — `submitTranscriptCorrection`
- `app/src/lib/i18n.ts` — seven-language voice UI strings
- `app/scripts/rehearse-stage-4b4-audio.mjs` — Phase 8 suites

## Locked Behavior

- Browser receives only redacted `ConversationAudioDto` and `ConversationVoiceTranscriptDto`; no object keys, hashes, confidence, or provider/model fields.
- `<audio>` uses authorized server route `?variant=audio` with `Cache-Control: private, no-store` and `Accept-Ranges: bytes`.
- Unauthorized cross-tenant reads return 404; expired audio returns 410; invalid Range returns 416.
- Transcript correction controls render only for owner/admin/dietitian with mutation permission.
- Assistant, viewer, and auditor roles do not see correction affordances.

## Verification

Executed on 2026-07-15:

- `cd app && npx vitest run src/lib/phase-85-stage-4b4-bounded-audio.test.ts src/lib/phase-85-stage-4b4-media-range.test.ts src/lib/phase-85-stage-4b4-migration-contract.test.ts src/lib/phase-85-stage-4b4-voice-contracts.test.ts` — passed
- `cd app && npm run lint` — 0 errors
- `cd app && npm run build` — passed

## Hard-Zero Metrics (Phase 8 local slice)

| Metric | Result |
| --- | --- |
| object_key_or_confidence_browser_dto_leak | 0 |
| unauthorized_transcript_correction_control_visibility | 0 |

## Handoff

Next implementation work is Stage 4B-4 Phase 9: retention, DSAR, legal hold, and operational visibility. Stage 4C remains blocked. Production pilot remains `NO-GO`; R-405 remains open.
