# Phase 85 Stage 4B-4 Post-Closure Remediation - R5 Evidence

Date: 2026-07-15
Status: **R5 complete; R6 next; Stage 4C blocked**

## Scope

R5 bridges accepted transcription revisions into bundle items without silent body overwrite, enforces the 120-second voice transcription deadline, revalidates bundle voice caps at promotion, routes accepted voice bundles through the existing typed risk chain with revision-aware idempotency keys, and adds durable bridge worker RPCs plus bundle deadline promotion.

## Deliverables

- `phase-85-stage-4b4-transcript-bridge.ts` v2: revision-aware bridge idempotency keys, placeholder-only body updates, voice deadline helpers (`resolveBundleVoiceTranscriptionDeadline`, `isBundleVoiceTranscriptionDeadlineExceeded`).
- `phase-85-stage-4b3-message-bundles.ts`: `promoteDueInboundBundles` closes pending voice bundles to `review_required/transcription_timeout` after 120s and revalidates 4-voice / 600s caps before promotion.
- `phase-85-stage-4b4-voice-bundle-orchestration.ts` v2: `buildBundleOrchestrationIdempotencyKey` from conversation, bundle revision, and accepted transcription revisions.
- `phase-85-stage-4b3-bundle-orchestration.ts`: default voice orchestration idempotency uses transcript revisions; duplicate replay returns existing decision without new outbound send.
- `phase-85-stage-4b4-transcript-bridge-saga.ts`: claim/complete/fail bridge RPC wrappers and `promoteVoiceBundleDeadlinesV2`.
- `phase-85-stage-4b4-durable-transcript-bridge-worker.ts` + CLI + `worker:audio:stage4b4:bridge` script; supervisor includes bridge worker.
- Migration `20260715130000_phase_85_stage_4b4_transcript_bridge_pipeline.sql`: bridge lease columns, claim/complete/fail RPCs, and `promote_voice_bundle_deadlines_v2`.

## Verification

```powershell
git diff --check
cd app
npx vitest run src/lib/phase-85-stage-4b4-transcript-bridge.test.ts src/lib/phase-85-stage-4b4-voice-bundle-orchestration.test.ts src/lib/phase-85-stage-4b4-durable-transcript-bridge-worker.test.ts src/lib/phase-85-stage-4b4-migration-contract.test.ts src/lib/phase-85-stage-4b4-durable-pipeline.test.ts --no-file-parallelism
npm run lint
npm run build
```

## Locked Invariants

- Only accepted transcription revisions enqueue durable bridge jobs; bridge worker updates message body only when it still equals the placeholder.
- Pending voice transcription past first voice `observedAt + 120s` closes the bundle to `review_required/transcription_timeout` without auto-response.
- Failed/rejected/unknown voice terminal states block bundle promotion to ready.
- Voice bundles use the existing typed-message risk chain; no separate voice risk classifier.
- Orchestration idempotency keys bind conversation, bundle revision, and accepted transcription revisions; stale/duplicate replay cannot create a second outbound send.
- External STT egress remains zero; production pilot remains `NO-GO`.

## Next Phase

R7 is next: bounded API, secure audio streaming, and UI correctness. Stage 4C remains blocked until R9 fresh complete PASS.
