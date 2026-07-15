# Phase 85 Stage 4B-4 - Phase 5 Bundle Correlation and Typed-Text Bridge Evidence

Date: 2026-07-15

## Scope

Phase 5 wires accepted voice transcripts into the existing Stage 4B-3 bundle silence queue as typed-text envelope segments without breaking text/image bundle behavior. Voice derivation readiness blocks bundle promotion until transcription is accepted and bridged; terminal voice failures move the bundle to `review_required`.

## Files Added

- `app/src/lib/phase-85-stage-4b4-transcript-bridge.ts`
- `app/src/lib/phase-85-stage-4b4-transcript-bridge.test.ts`
- `docs/PHASE_85_STAGE_4B_4_PHASE_5_BUNDLE_CORRELATION_TYPED_TEXT_BRIDGE_EVIDENCE.md`

## Files Updated

- `app/src/lib/phase-85-stage-4b4-voice-contracts.ts` — `processedTranscriptBridgeKeys` idempotency slice
- `app/src/lib/phase-85-stage-4b3-message-bundles.ts` — voice-aware promotion gate, voice bundle counters on open
- `app/src/lib/phase-85-stage-4b3-multimodal-envelope.ts` — bridged voice items become text segments
- `app/src/lib/phase-85-stage-4b4-transcription-worker.ts` — bridge + bundle reconcile hooks
- `app/src/lib/phase-85-stage-4b3-bundle-worker-outcomes.ts` — retryable voice bridge failures
- `app/src/lib/phase-85-stage-4b3-canonical-ingress.ts` — post-transcription bridge sweep
- `app/src/lib/phase-85-stage-4b3-message-bundles.test.ts` — vision fixture setup retained for image ingress regression

## Locked Behavior

- Accepted transcription atomically replaces `[client voice message]` with transcript text and sets `retrievalEligibility: eligible`.
- Bundle item receives `transcriptionId`; duplicate bridge execution is idempotent via `processedTranscriptBridgeKeys`.
- `promoteDueInboundBundles` keeps voice bundles `open` while transcription/bridge is pending; does not start decision early when silence expires first.
- Terminal voice transcription/asset failure marks the active bundle `review_required`.
- Multimodal envelope exposes bridged voice transcript as a chronological text segment; unbridged voice blocks envelope build with `voice_transcript_not_bridged`.
- Image/text bundle silence, caps, and promotion semantics remain unchanged (image readiness still enforced at envelope/orchestration time).

## Verification

Executed on 2026-07-15:

- `cd app && npx vitest run src/lib/phase-85-stage-4b4-transcript-bridge.test.ts src/lib/phase-85-stage-4b4-transcription-worker.test.ts src/lib/phase-85-stage-4b3-message-bundles.test.ts` — 20/20 passed
- `cd app && npm run lint` — 0 errors
- `cd app && npm run build` — passed

## Handoff

Next implementation work is Stage 4B-4 Phase 7: transcript correction, revision locks, and human-control rerun semantics. Stage 4C remains blocked. Production pilot remains `NO-GO`; R-405 remains open; real STT/Meta egress remains closed.
