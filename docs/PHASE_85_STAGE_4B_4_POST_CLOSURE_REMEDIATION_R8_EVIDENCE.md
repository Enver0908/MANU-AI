# Phase 85 Stage 4B-4 Post-Closure Remediation - R8 Evidence

Date: 2026-07-15
Status: **R8 complete; R9 next; Stage 4C blocked**

## Scope

R8 wires audio lifecycle into a dedicated worker with audio-only queue claims, two-step deletion saga, legal-hold deferral, DSAR export orchestration, storage-native orphan reconciliation, and operational visibility hooks.

## Deliverables

- Migration `20260715160000_phase_85_stage_4b4_lifecycle_workers.sql`: `claim`/`release`/`complete` audio lifecycle RPCs, orphan cleanup enqueue, row-without-object failure RPC.
- `phase-85-stage-4b4-audio-lifecycle-saga.ts` v2: dedicated claim path (no generic queue skip), orphan scan/reconcile, aggregate worker counters.
- `phase-85-stage-4b4-audio-lifecycle.ts` v2: DSAR export package with correction manifest and authorized stream URLs (no storage keys).
- `phase-85-stage-4b4-audio-storage.ts`: paginated `listObjectKeys` for orphan scans.
- `phase-85-stage-4b4-audio-lifecycle-worker-cli.ts` + `worker:audio:lifecycle:stage4b4` scripts.
- `phase-85-if-h-operational-visibility.ts`: optional runtime audio storage / orphan report injection.

## Verification

```powershell
git diff --check
cd app
npx vitest run src/lib/phase-85-stage-4b4-audio-lifecycle.test.ts src/lib/phase-85-stage-4b4-audio-lifecycle-saga.test.ts src/lib/phase-85-stage-4b4-migration-contract.test.ts --no-file-parallelism
npm run lint
npm run build
```

## Locked Invariants

- Audio lifecycle worker claims only `/voice.wav` operations via dedicated RPC; unrelated media leases are never released by skip/continue.
- Expiry prepares DB delete intent and pending keys before storage delete; legal hold defers physical delete while preserving pending keys.
- Orphan object-without-row entries enqueue cleanup; row-without-object marks terminal `row_without_object` failure.
- DSAR export includes transcript/correction manifest and authorized stream references only; object keys, hashes, and provider confidence remain forbidden.
- Operational visibility accepts runtime storage adapters instead of hardcoded fallback-only orphan scans.

## Next Phase

R9 is next: measured closure gate, mandatory verification, and Stage 4C handoff only on fresh complete PASS.
