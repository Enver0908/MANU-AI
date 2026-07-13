# Phase 85 Stage 4B-3 - Phase 1 Domain, Threat Model, and Type Contract Evidence

Date: 2026-07-13

## Scope

Phase 1 locks the Stage 4B-3 visual domain model before storage, ingress, orchestration, or UI work. It adds TypeScript media contracts, core `VisualObservationV1` validation, `ManuAppState` collection slots, `client_message_image` channel-event vocabulary, media retrieval exclusions, and targeted contract tests. No migration, API route, webhook behavior, storage bucket, provider egress, or runtime image processing was added.

## Files Added

- `app/src/lib/phase-85-stage-4b3-media-contracts.ts`
- `app/src/lib/phase-85-stage-4b3-media-contracts.test.ts`
- `dietitian-ai-assistant/src/visual-observation-v1.js`
- `dietitian-ai-assistant/tests/visual-observation-v1.test.mjs`

## Files Updated

- `app/src/lib/types.ts`
- `app/src/lib/phase-85-if-b-provenance-model.ts`
- `app/src/lib/phase-85-if-b-provenance-model.test.ts`
- `app/src/lib/seed-data.ts`
- `app/src/lib/supabase-store.ts`
- `app/src/lib/phase-79c-scoped-client-mutation.ts`
- `dietitian-ai-assistant/src/index.js`

## Locked Contracts

- Media asset, visual analysis, inbound bundle, bundle item, correction, multimodal envelope, autopilot eligibility, conversation media DTO, visual review DTO, and correction request records.
- Scene taxonomy: `meal`, `packaged_food_label`, `supplement_or_medication`, `screenshot_or_document`, `lab_or_medical_document`, `body_or_symptom`, `sensitive_identity_document`, `other`, `unknown`.
- Bundle limits: 120-second silence window, max 20 messages, max 4 images, max 16,000 Unicode codepoints.
- `ChannelEventKind` adds `client_message_image`; unsupported media kinds remain unchanged for runtime ingress until later phases.
- `MessageRetrievalEligibility` adds `excluded_media_pending`, `excluded_media_only`, `excluded_media_expired`.
- Visual risk overlay is monotonic: it may retain or increase risk only, never downgrade.
- Client-safe DTOs exclude object keys, provider media IDs, OCR text, confidence, and model/provider wording.

## Verification

Executed on 2026-07-13:

- `cd app && npm run lint` — 0 errors, 3 pre-existing warnings.
- `cd app && npx vitest run src/lib/phase-85-stage-4b3-media-contracts.test.ts src/lib/phase-85-if-b-provenance-model.test.ts` — 11/11 passed.
- `cd dietitian-ai-assistant && npm test -- tests/visual-observation-v1.test.mjs` — 4/4 passed.
- `cd app && npm run build` — passed.
- `git diff --check` — no whitespace errors.

## Handoff

Next implementation work is Stage 4B-3 Phase 2: Supabase schema, private storage bucket, RLS, and queue foundation. Stage 4C remains blocked. Production pilot remains `NO-GO`; R-405 remains open; real provider/channel/vision egress paths remain closed.
