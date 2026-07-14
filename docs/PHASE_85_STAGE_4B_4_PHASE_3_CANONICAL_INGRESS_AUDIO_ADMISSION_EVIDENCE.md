# Phase 85 Stage 4B-4 - Phase 3 Canonical WhatsApp Audio Ingress and Secure Admission Evidence

Date: 2026-07-15

## Scope

Phase 3 enables mock-gated canonical WhatsApp voice-note ingress for `audio.voice === true` OGG/Opus payloads. Webhook commits metadata without blocking on decode; a local/Supabase worker path admits pending audio asynchronously into private WAV storage and opens a pending `audio_transcription_records` row. No real Meta egress, no STT provider egress, and `MANU_ALLOW_MOCK_VOICE_TRANSCRIPTION` remains off.

## Files Added

- `app/supabase/migrations/20260714190000_phase_85_stage_4b4_canonical_ingress_v3.sql`
- `app/src/lib/phase-85-stage-4b4-audio-canonicalizer.ts`
- `app/src/lib/phase-85-stage-4b4-audio-canonicalizer.test.ts`
- `app/src/lib/phase-85-stage-4b4-audio-admission.ts`
- `app/src/lib/phase-85-stage-4b4-audio-admission.test.ts`
- `app/src/lib/phase-85-stage-4b4-audio-transport.ts`
- `app/src/lib/phase-85-stage-4b4-audio-storage.ts`
- `app/src/lib/phase-85-stage-4b4-audio-fixture-resolver.ts`
- `app/src/lib/fixtures/stage-4b4-golden-voice-note.ogg`
- `app/src/lib/fixtures/stage-4b4-stereo-voice-note.ogg`

## Files Updated

- `app/package.json` — `ogg-opus-decoder`, `wave-resampler`, `wavefile`
- `app/src/lib/phase-85-if-c-channel-event-normalizer.ts`
- `app/src/lib/phase-85-if-c-channel-event-routing.ts`
- `app/src/lib/phase-85-if-c-channel-event-ledger.ts`
- `app/src/lib/phase-85-stage-4b3-message-bundles.ts`
- `app/src/lib/phase-85-stage-4b3-media-admission.ts` — image worker ignores `mediaKind: audio`
- `app/src/lib/phase-85-stage-4b3-canonical-ingress.ts`
- `app/src/lib/phase-85-stage-4b3-supabase-canonical-ingress.ts`
- `app/src/lib/supabase-store.ts`
- `app/src/lib/phase-85-stage-4b4-voice-contracts.test.ts`
- `app/src/lib/phase-85-stage-4b4-migration-contract.test.ts`

## Locked Behavior

- Normalizer routes `type: audio` with `voice: true` and OGG mime to `client_message_audio`.
- Metadata gate via `evaluateAudioIngressMetadata`; placeholder message body `[client voice message]` with `excluded_voice_pending` retrieval.
- Webhook Supabase path: `autoProcessAudioPending: false`; durable mock fixture transport only; commits via `p85_stage_4b4_commit_canonical_inbound_v3`.
- Worker path: OGG download → byte/mime/hash validation → mono Opus decode → 16 kHz PCM16 WAV → private `p85-stage-4b4-audio` upload → asset `analysis_pending` + pending transcription row.
- Failure paths: stereo, hash mismatch, oversize stream, transport unavailable, ingress metadata rejection.
- Bundle integration: `integrateClientVoiceIntoBundle` with `audioCount` / `audioDurationMs` caps.

## Verification

Executed on 2026-07-15:

- `cd app && npx supabase db reset` — passed (includes V3 migration).
- `cd app && npm run lint` — 0 errors.
- `cd app && npx vitest run src/lib/phase-85-stage-4b4-audio-canonicalizer.test.ts src/lib/phase-85-stage-4b4-audio-admission.test.ts src/lib/phase-85-stage-4b4-voice-contracts.test.ts src/lib/phase-85-stage-4b4-migration-contract.test.ts src/lib/phase-85-stage-4b3-canonical-ingress.test.ts` — 35/35 passed.
- `cd app && npm run build` — passed (webpack warning from `ogg-opus-decoder` worker dependency only).

## Handoff

Next implementation work is Stage 4B-4 Phase 4: deterministic mock transcription provider and quality gate. Stage 4C remains blocked. Production pilot remains `NO-GO`; R-405 remains open; real provider/channel/STT egress paths remain closed.
