# Phase 85 Stage 4B-4 - Phase 1 Domain, Threat Model, and Type Contract Evidence

Date: 2026-07-15
Status: **complete locally**

## Scope

Phase 1 locks the Stage 4B-4 voice domain model before persistence, ingress, transcription workers, or UI work. It adds TypeScript voice contracts, core `AudioTranscriptionObservationV1` validation, `ManuAppState` collection slots, `client_message_audio` channel-event vocabulary, voice retrieval exclusions, conversation DTO shape extensions, and targeted contract tests. No migration, API route, webhook behavior, storage bucket, provider egress, or runtime audio processing was added.

## Files Added

- `app/src/lib/phase-85-stage-4b4-voice-contracts.ts`
- `app/src/lib/phase-85-stage-4b4-voice-contracts.test.ts`
- `dietitian-ai-assistant/src/audio-transcription-observation-v1.js`
- `dietitian-ai-assistant/tests/audio-transcription-observation-v1.test.mjs`

## Files Updated

- `app/src/lib/types.ts`
- `app/src/lib/phase-85-if-b-provenance-model.ts`
- `app/src/lib/phase-85-if-b-provenance-model.test.ts`
- `app/src/lib/phase-85-stage-4b3-media-contracts.ts`
- `app/src/lib/phase-85-stage-4b3-bounded-media.ts`
- `app/src/lib/phase-85-stage-4b2-contracts.ts`
- `app/src/lib/phase-85-stage-4b2-api.ts`
- `app/src/lib/phase-85-stage-4b2-verification.ts`
- `app/src/lib/phase-85-stage-4b2-verification.test.ts`
- `app/src/lib/seed-data.ts`
- `app/src/lib/supabase-store.ts`
- `app/src/lib/phase-79c-scoped-client-mutation.ts`
- `dietitian-ai-assistant/src/index.js`

## Locked Contracts

- Audio transcription, correction, ingress evaluation, quality gate, conversation audio DTO, and conversation voice transcript DTO records.
- Supported locales: `tr-TR`, `en-US`, `de-DE`, `fr-FR`, `es-ES`, `pt-PT`, `cs-CZ`.
- Admission caps: 16 MiB input, 300 seconds per voice note, 4 voice notes per bundle, 600 seconds total bundle voice duration.
- Transcript acceptance thresholds: overall confidence `>= 0.95`, minimum segment confidence `>= 0.90`, zero uncertain spans, 1..4096 Unicode codepoints, locale match with client communication language.
- `ChannelEventKind` adds `client_message_audio`; runtime normalizer still routes live audio to `client_message_media_unsupported` until Phase 3 ingress.
- `MessageRetrievalEligibility` adds `excluded_voice_pending`, `excluded_voice_only`, `excluded_voice_expired`.
- Voice risk overlay is monotonic: it may retain or increase risk only, never downgrade.
- Client-safe DTOs exclude object keys, provider media IDs, hashes, confidence scores, segments, and raw provider payloads.

## Verification

Executed on 2026-07-15:

| Command | Result |
| --- | --- |
| `cd app && npm run lint` | PASS: 0 errors, 8 pre-existing warnings |
| `cd app && npx vitest run src/lib/phase-85-stage-4b4-voice-contracts.test.ts src/lib/phase-85-if-b-provenance-model.test.ts src/lib/phase-85-stage-4b2-verification.test.ts --no-file-parallelism --maxWorkers=1` | PASS: 20 passed, 1 existing skipped |
| `cd dietitian-ai-assistant && npm test -- tests/audio-transcription-observation-v1.test.mjs` | PASS: 4/4 |
| `cd app && npm run build` | PASS |
| `git diff --check` | PASS |

## Handoff

Next implementation work is Stage 4B-4 Phase 3: canonical WhatsApp audio ingress and secure admission. Stage 4C remains blocked. Production pilot remains `NO-GO`; R-405 remains open; real provider/channel/STT egress paths remain closed.
