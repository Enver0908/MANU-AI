# Phase 85 Stage 4B-4 - Phase 4 Deterministic Transcription Provider and Quality Gate Evidence

Date: 2026-07-15

## Scope

Phase 4 adds the mock-gated deterministic transcription provider, strict observation validation, fail-closed quality gate, in-memory and durable transcription workers, and rehearsal/worker scripts. No real STT egress is enabled; `MANU_ALLOW_MOCK_VOICE_TRANSCRIPTION=true` is required outside production.

## Files Added

- `app/src/lib/phase-85-stage-4b4-provider-gate.ts`
- `app/src/lib/phase-85-stage-4b4-transcription-provider.ts`
- `app/src/lib/phase-85-stage-4b4-transcription-fixture-manifest.ts`
- `app/src/lib/phase-85-stage-4b4-mock-transcription-provider.ts`
- `app/src/lib/phase-85-stage-4b4-transcript-quality.ts`
- `app/src/lib/phase-85-stage-4b4-transcription-worker.ts`
- `app/src/lib/phase-85-stage-4b4-durable-audio-worker.ts`
- `app/src/lib/phase-85-stage-4b4-durable-audio-worker-cli.ts`
- `app/src/lib/phase-85-stage-4b4-golden-corpus.jsonl`
- `app/src/lib/phase-85-stage-4b4-provider-gate.test.ts`
- `app/src/lib/phase-85-stage-4b4-mock-transcription-provider.test.ts`
- `app/src/lib/phase-85-stage-4b4-transcription-worker.test.ts`
- `app/scripts/worker-audio-stage4b4.mjs`
- `app/scripts/rehearse-stage-4b4-audio.mjs`

## Files Updated

- `app/package.json` — `worker:audio:stage4b4`, `worker:audio:stage4b4:once`, `rehearse:stage-4b4:audio`
- `app/src/lib/phase-85-stage-4b4-voice-contracts.ts` — transcription queue fields on records
- `app/src/lib/phase-85-stage-4b4-audio-admission.ts` — pending transcription row seeds retry metadata
- `app/src/lib/phase-85-stage-4b4-audio-storage.ts` — Supabase audio storage adapter
- `app/src/lib/phase-85-stage-4b3-canonical-ingress.ts` — transcription provider wiring and worker tick
- `app/src/lib/phase-85-if-c-channel-event-ledger.ts` — optional in-ledger transcription processing
- `app/src/lib/supabase-store.ts` — webhook keeps `autoProcessTranscription: false`

## Locked Behavior

- Provider port accepts only canonical WAV bytes, locale, content hash, and request ID.
- Mock provider resolves transcripts by canonical WAV hash manifest only; unknown hashes fail with `unknown_fixture` and zero external egress.
- `parseAudioTranscriptionObservationV1` and `evaluateTranscriptQualityGate` enforce confidence, locale, length, and uncertain-span fail-closed rules.
- Accepted transcripts: transcription `accepted`, asset `analysis_ready`.
- Rejected quality: transcription `review_required`, asset remains `analysis_pending`.
- Provider/worker failures retry with 30s/120s/300s backoff metadata; exhausted retries mark transcription `failed`.
- Supabase webhook path still commits metadata only; workers run out-of-band via `worker:audio:stage4b4`.

## Verification

Executed on 2026-07-15:

- `cd app && npx vitest run src/lib/phase-85-stage-4b4-provider-gate.test.ts src/lib/phase-85-stage-4b4-mock-transcription-provider.test.ts src/lib/phase-85-stage-4b4-transcription-worker.test.ts src/lib/phase-85-stage-4b4-audio-admission.test.ts src/lib/phase-85-stage-4b4-voice-contracts.test.ts` — passed.
- `cd app && npm run lint` — 0 errors.
- `cd app && npm run build` — passed.

## Handoff

Next implementation work is Stage 4B-4 Phase 5: bundle correlation and typed-text bridge for accepted transcripts. Stage 4C remains blocked. Production pilot remains `NO-GO`; R-405 remains open; real STT/provider egress paths remain closed.
