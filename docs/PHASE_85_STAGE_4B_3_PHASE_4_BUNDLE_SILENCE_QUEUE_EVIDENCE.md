# Phase 85 Stage 4B-3 - Phase 4 Bundle Correlation and Silence Queue Evidence

Date: 2026-07-13

## Scope

Phase 4 adds 120-second inbound message bundle correlation and a silence queue on top of Phase 3 image ingress. Client text/image events during an open bundle are stored in transcript and appended to the bundle without calling `processMockChannelInbound`. No client-facing AI reply is produced during the silence window. A due-bundle worker promotes `open` bundles to `ready` and claims them into `processing`; vision/orchestration remains deferred to Phase 5+.

## Files Added

- `app/src/lib/phase-85-stage-4b3-message-bundles.ts`
- `app/src/lib/phase-85-stage-4b3-message-bundles.test.ts`
- `app/src/lib/phase-85-stage-4b3-media-worker.ts`

## Files Updated

- `app/src/lib/phase-85-if-c-channel-event-ledger.ts` — bundle-aware text/image dispatch, business-human echo supersede, optional bundle worker hook
- `app/src/lib/phase-85-stage-4b3-media-admission.test.ts` — asserts bundle + bundle item after image ingress

## Locked Behavior

- Time source is `observedAt`; `readyAt = observedAt + 120s`.
- First admitted `client_message_image` opens a bundle; subsequent client text/image appends and resets the silence timer.
- Text without an active bundle keeps the legacy `processMockChannelInbound` path (text-only regression preserved).
- Bundled client text is stored via `applyBundledClientTextIngress` without orchestrator invocation.
- `business_human_echo_text` supersedes active bundles (`open`/`ready`/`processing`) before transcript effects when routing resolves.
- Caps: 20 messages, 4 images, 16,000 Unicode codepoints; overflow moves bundle to `review_required` with failure codes.
- Duplicate append for the same `messageId` is idempotent.
- `processStage4B3DueInboundBundles` promotes due bundles and claims exactly one `ready` bundle per pass with a 60s lease; no core/orchestrator call yet.
- Stale conversation revision at claim reopens the bundle with a fresh timer instead of claiming.

## Verification

Executed on 2026-07-13:

- `cd app && npx vitest run src/lib/phase-85-stage-4b3-message-bundles.test.ts` — 8/8 passed.
- `cd app && npx vitest run src/lib/phase-85-stage-4b3-media-admission.test.ts` — passed.
- `cd app && npx vitest run src/lib/phase-85-if-c-channel-event-ledger.test.ts` — 11/11 passed.
- `cd app && npm run lint` — 0 errors, 3 pre-existing warnings.
- `cd app && npm run build` — passed.

## Handoff

Next implementation work is Stage 4B-3 Phase 6: multimodal understanding and source authority. Stage 4C remains blocked. Production pilot remains `NO-GO`; R-405 remains open; real Meta/Gemini egress remains closed.
