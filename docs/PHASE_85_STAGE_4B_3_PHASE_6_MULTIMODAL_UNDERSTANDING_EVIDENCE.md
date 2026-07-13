# Phase 85 Stage 4B-3 - Phase 6 Multimodal Understanding and Source Authority Evidence

Date: 2026-07-14

## Scope

Phase 6 converts terminal bundle items plus `VisualObservationV1` records into a bounded `MultimodalMessageEnvelope`, resolves visual meaning through core source-authority gates, and bridges active menu / food-rule context without orchestration, risk overlay, or client-facing AI replies.

## Files Added

- `app/src/lib/phase-85-stage-4b3-multimodal-envelope.ts`
- `app/src/lib/phase-85-stage-4b3-multimodal-understanding.ts`
- `app/src/lib/phase-85-stage-4b3-multimodal-understanding.test.ts`
- `dietitian-ai-assistant/src/visual-meaning-resolver-v1.js`
- `dietitian-ai-assistant/tests/visual-meaning-resolver-v1.test.mjs`

## Files Updated

- `app/src/lib/phase-85-stage-4b3-media-contracts.ts` — `MultimodalVisualSegment.messageId` for reply/caption binding
- `app/src/lib/phase-85-stage-4b3-media-worker.ts` — post-claim `understandings[]` via `resolveMultimodalBundleUnderstanding`
- `app/src/types/dietitian-ai-assistant-architecture.d.ts` — visual meaning resolver type exports
- `dietitian-ai-assistant/src/index.js` — export visual meaning resolver surface

## Locked Behavior

- Terminal bundles (`ready`, `processing`, `completed`) build chronological text/visual segments from bundle items and `analysis_ready` assets only.
- `[client image]` transcript placeholders are excluded from caption binding; real captions and explicit reply-to-image text keep priority over sequential bundle text.
- Provider context is bounded to 12 KiB, excludes raw URLs/object keys, and carries scene summaries only.
- Core `resolveVisualMeaningV1` applies deterministic source authority:
  - meal exact active-menu match → `approved_menu_exact`
  - ambiguous/high-multiplicity food candidates → no authority
  - high-integrity label forbidden hits → `limited_visual_label_conflict`
  - label absence / cropped / incomplete panels → no `product_allowed`
  - screenshot OCR → untrusted retrieval query; exact approved menu hit only via normalized equality
  - supplement/body/lab/sensitive scenes → non-autopilot review states
- OCR is never treated as an approved source; `absenceOfEvidenceAllowedCount` remains 0 in covered fixtures.
- No orchestrator, `processMockChannelInbound`, provider generation, or client send path is introduced.

## Bugfix Included

- `buildMultimodalMessageEnvelope` now imports `STAGE_4B3_CLIENT_IMAGE_TRANSCRIPT_PLACEHOLDER` from `phase-85-stage-4b3-media-admission.ts` instead of an undefined media-contracts export, preventing `[client image]` from being mis-bound as a caption.

## Verification

Executed on 2026-07-14:

- `cd app && npx vitest run src/lib/phase-85-stage-4b3-multimodal-understanding.test.ts` — 11/11 passed.
- `cd dietitian-ai-assistant && npm test -- tests/visual-meaning-resolver-v1.test.mjs` — 6/6 passed.
- `cd app && npx vitest run src/lib/phase-85-stage-4b3-message-bundles.test.ts src/lib/phase-85-stage-4b3-vision-analysis.test.ts src/lib/phase-85-if-c-channel-event-ledger.test.ts` — regression passed (45 tests in combined run with understanding suite).
- `cd app && npm run lint` — 0 errors, pre-existing warnings only.
- `cd app && npm run build` — passed.

## Handoff

Next implementation work is Stage 4B-3 Phase 7: visual risk overlay, canonical visual intents, narrow green allowlist, and output guard integration. Stage 4C remains blocked. Production pilot remains `NO-GO`; R-405 remains open; real Meta/Gemini egress remains closed.
