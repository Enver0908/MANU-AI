# Phase 85 Stage 4B-3 - Phase 3 Secure Visual Ingress and File Admission Evidence

Date: 2026-07-13

## Scope

Phase 3 adds mock-gated secure image ingress, byte validation/sanitization, and private sanitized object storage without enabling bundle orchestration, vision analysis, UI surfaces, or client-facing replies.

## Files Added

- `app/src/lib/phase-85-stage-4b3-image-admission.ts`
- `app/src/lib/phase-85-stage-4b3-image-admission.test.ts`
- `app/src/lib/phase-85-stage-4b3-media-transport.ts`
- `app/src/lib/phase-85-stage-4b3-media-storage.ts`
- `app/src/lib/phase-85-stage-4b3-media-admission.ts`
- `app/src/lib/phase-85-stage-4b3-media-admission.test.ts`

## Files Updated

- `app/package.json` / `app/package-lock.json` — direct `sharp` and `file-type` dependencies
- `app/src/lib/phase-85-if-c-channel-event-normalizer.ts`
- `app/src/lib/phase-85-if-c-channel-event-normalizer.test.ts`
- `app/src/lib/phase-85-if-c-channel-event-golden-cases.jsonl`
- `app/src/lib/phase-85-if-c-channel-event-routing.ts`
- `app/src/lib/phase-85-if-c-channel-event-ledger.ts`

## Locked Behavior

- JPEG/PNG only; declared MIME must match magic-byte detection via `file-type`.
- Stream cap 5 MiB; dimensions 32–8192 px; max 25 MP; single frame only.
- Sanitized full image max long edge 3072 JPEG q90; thumbnail max edge 640 JPEG q82; sRGB; EXIF stripped.
- Original bytes are never persisted; provider media ID cleared after successful admission.
- `client_message_image` normalizer output includes media ID, MIME, SHA-256, caption, reply context, and byte size when present.
- Images without allowed MIME remain on `client_message_media_unsupported`.
- Ledger stages transcript placeholder + `download_pending` asset, then optional in-process worker admission via mock transport/storage ports.
- No `processMockChannelInbound` call and no AI draft/reply for admitted images.

## Verification

Executed on 2026-07-13:

- `cd app && npx vitest run src/lib/phase-85-stage-4b3-image-admission.test.ts src/lib/phase-85-stage-4b3-media-admission.test.ts src/lib/phase-85-if-c-channel-event-normalizer.test.ts` — 13/13 passed.
- `cd app && npx vitest run src/lib/phase-85-if-c-channel-event-ledger.test.ts` — 11/11 passed.
- `cd app && npm run lint` — 0 errors, 3 pre-existing warnings.
- `cd app && npm run build` — passed.

## Handoff

Next implementation work is Stage 4B-3 Phase 5: deterministic local vision provider. Stage 4C remains blocked. Production pilot remains `NO-GO`; R-405 remains open; real Meta/Gemini egress remains closed.
