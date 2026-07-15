# Phase 85 Stage 4B-4 Post-Closure Remediation - R2 Evidence

Date: 2026-07-15
Status: **R2 complete; R3 next; Stage 4C blocked**

## Scope

R2 locks verified inbound source authority for voice admission and isolates bounded OGG/Opus decode from the Next.js app dependency graph via worker-thread orchestration, structural Ogg preflight, and canonical WAV validation.

## Deliverables

- `AudioIngressSourceAuthority` enum and `phase-85-stage-4b4-audio-source-authority.ts` policy resolver used by admission instead of hardcoded trust flags.
- Channel normalizer extracts `providerForwardedFlag`, `providerGroupId`, and `isProviderEcho` without making trust decisions.
- `phase-85-stage-4b4-ogg-preflight.ts` validates Ogg pages, `OpusHead`, mono channel count, and granule duration before decode.
- `phase-85-stage-4b4-audio-decode-worker.ts` + `phase-85-stage-4b4-audio-decode-worker-entry.mjs` run decode/resample/WAV encode in an isolated worker (64 MiB heap, 30s deadline, sample budget).
- `phase-85-stage-4b4-audio-canonicalizer.ts` v2 removes direct `ogg-opus-decoder` import from the app graph.
- Admission rejects forwarded/unknown-source voice before decode; golden harness payloads default `context.forwarded=false` for verified-direct fixtures.

## Verification

```powershell
git diff --check
cd app
npx vitest run src/lib/phase-85-stage-4b4-audio-source-authority.test.ts src/lib/phase-85-stage-4b4-audio-admission.test.ts src/lib/phase-85-stage-4b4-audio-canonicalizer.test.ts src/lib/phase-85-stage-4b4-ogg-preflight.test.ts src/lib/phase-85-stage-4b4-build-dependency-trace.test.ts src/lib/phase-85-stage-4b4-voice-contracts.test.ts --no-file-parallelism
npm run lint
npm run build
```

Results on 2026-07-15:

- Targeted R2 Vitest: **52/52 passed** (including dependency-trace isolation test)
- `npm run lint`: **0 errors** (pre-existing warnings only)
- `npm run build`: **passed** with no `ogg-opus-decoder` warning in app route import trace

## Locked Invariants

- Missing provider forwarding metadata is `unknown` and cannot auto-admit/decode.
- Only `verified_direct` source authority may pass ingress metadata admission.
- Stereo/multi-channel Ogg is fail-closed before and during decode; no automatic downmix in admission path.
- Decoder package is dynamically imported only inside the worker entry module.

## Next Phase

R3 is next: durable admission/transcription worker pipeline with lease-safe RPC commits. Stage 4C remains blocked until R9 fresh complete PASS.
