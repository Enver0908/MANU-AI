# Phase 85 Stage 4B-3 - Phase 5 Deterministic Local Vision Provider Evidence

Date: 2026-07-14

## Scope

Phase 5 adds a gated deterministic local vision provider that converts sanitized image hashes into schema-valid `VisualObservationV1` records without external provider egress, client profile access, or orchestration. Multimodal envelope building and client-facing replies remain deferred to Phase 6+.

## Files Added

- `app/src/lib/phase-85-stage-4b3-vision-provider.ts`
- `app/src/lib/phase-85-stage-4b3-vision-fixture-manifest.ts`
- `app/src/lib/phase-85-stage-4b3-mock-vision-provider.ts`
- `app/src/lib/phase-85-stage-4b3-visual-observation-validator.ts`
- `app/src/lib/phase-85-stage-4b3-provider-gate.ts`
- `app/src/lib/phase-85-stage-4b3-vision-analysis.ts`
- `app/src/lib/phase-85-stage-4b3-provider-gate.test.ts`
- `app/src/lib/phase-85-stage-4b3-visual-observation-validator.test.ts`
- `app/src/lib/phase-85-stage-4b3-mock-vision-provider.test.ts`
- `app/src/lib/phase-85-stage-4b3-vision-analysis.test.ts`

## Files Updated

- `app/src/lib/phase-85-if-c-channel-event-ledger.ts` — optional post-admission vision analysis via `MANU_ALLOW_MOCK_VISION`

## Locked Behavior

- Vision runs only when `MANU_ALLOW_MOCK_VISION=true`; otherwise sanitized assets remain unanalyzed (fail-closed).
- Real vision egress (`MANU_ALLOW_REAL_VISION_EGRESS`) is always denied.
- Mock provider input is limited to `contentSha256` and `detectedMimeType`; no client/menu/profile context is passed.
- Registered sanitized-hash fixtures return deterministic scene templates; unknown hashes return `unknown` + `insufficient` observation.
- Provider output passes JSON allowlist validation, OCR/entity caps, and forbidden clinical-advice key rejection before persistence.
- Sanitized assets transition `sanitized` → `analysis_pending` → `analysis_ready` with immutable `VisualAnalysisRecord`; failures honor 2 in-process retries and durable retry cap 5.
- No `processMockChannelInbound`, orchestrator, or client-facing AI reply is introduced by vision analysis.

## Verification

Executed on 2026-07-14:

- `cd app && npx vitest run src/lib/phase-85-stage-4b3-provider-gate.test.ts src/lib/phase-85-stage-4b3-visual-observation-validator.test.ts src/lib/phase-85-stage-4b3-mock-vision-provider.test.ts src/lib/phase-85-stage-4b3-vision-analysis.test.ts` — 26/26 passed.
- `cd app && npx vitest run src/lib/phase-85-stage-4b3-media-admission.test.ts src/lib/phase-85-stage-4b3-message-bundles.test.ts src/lib/phase-85-if-c-channel-event-ledger.test.ts` — regression passed.
- `cd app && npm run lint` — 0 errors, pre-existing warnings only.
- `cd app && npm run build` — passed.

## Handoff

Next implementation work is Stage 4B-3 Phase 6: multimodal understanding and source authority. Stage 4C remains blocked. Production pilot remains `NO-GO`; R-405 remains open; real Meta/Gemini egress remains closed.
