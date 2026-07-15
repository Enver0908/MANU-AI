# Phase 85 Stage 4B-4 - Phase 10 Simulator, Golden Corpus, Red Team, and Scale Rehearsal Evidence

Date: 2026-07-15

## Scope

Phase 10 proves Stage 4B-4 voice behavior across deterministic golden corpus cases, typed/voice parity, red-team categories, admission ingress fixtures, sample scale rehearsal, and repository-controlled voice simulator wiring.

## Files Added

- `app/src/lib/phase-85-stage-4b4-golden-corpus-catalog.ts`
- `app/src/lib/phase-85-stage-4b4-closure.ts`
- `app/src/lib/phase-85-stage-4b4-closure.test.ts`
- `app/src/lib/phase-85-stage-4b4-voice-simulator.ts`
- `app/src/lib/phase-85-stage-4b4-voice-simulator.test.ts`
- `app/src/app/api/simulator/voice/route.ts`
- `docs/PHASE_85_STAGE_4B_4_PHASE_10_SIMULATOR_GOLDEN_CORPUS_RED_TEAM_EVIDENCE.md`

## Files Updated

- `app/src/lib/phase-85-stage-4b4-golden-corpus.jsonl` (62 deterministic catalog cases)
- `app/src/components/dashboard/simulator-panel.tsx` (voice simulator panel)
- `app/src/components/dashboard-app.tsx`
- `app/src/lib/use-manu-state.ts`
- `app/src/lib/app-state-store.ts`
- `app/src/lib/supabase-store.ts`
- `app/scripts/rehearse-stage-4b4-audio.mjs`

## Locked Behavior

- Golden corpus has at least 60 deterministic cases covering all 20 red-team categories.
- No free-form user audio upload; only allowlisted repository fixtures (`golden_voice_note`, `stereo_voice_note`).
- Typed/voice parity cases compare decision snapshots from `runInboundSimulation` and `runMultimodalBundleInboundTurn`.
- Hard-zero closure metrics must remain zero in sample rehearsal: unsafe voice send, yellow/red voice send, low-confidence send, duplicate voice reply, raw audio leak, cross-tenant audio read, external transcription egress, stale correction send.
- `stage4cAuthorized` remains `false` during Phase 10 evidence; Stage 4C opens only after Phase 11 closure.

## Verification

```powershell
cd app
npx vitest run src/lib/phase-85-stage-4b4-closure.test.ts
npx vitest run src/lib/phase-85-stage-4b4-voice-simulator.test.ts
npm run rehearse:stage-4b4:audio
npm run build
```

Optional full-scale rehearsal (long-running):

```powershell
cd app
$env:STAGE_4B4_FULL_SCALE="1"
npx vitest run src/lib/phase-85-stage-4b4-closure.test.ts -t "runs full"
```

Production pilot remains `NO-GO`. R-405 remains open. Stage 4C remains blocked until Stage 4B-4 Phase 11 closure.
