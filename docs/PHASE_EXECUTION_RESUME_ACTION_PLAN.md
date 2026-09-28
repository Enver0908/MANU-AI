# Phase Execution Resume Support

## Purpose

The repository now has one resumable execution contract for long-running
phases. The first adapter is AIya Performance Plan 1 Phase 4. This feature
does not alter application runtime behavior, Supabase schema, deployment, or
the locked Phase 4 measurement contract.

## Durable contract

- Runtime records live under `.manu-runtime/phase-execution/<phase>/<run>/`.
- `manifest.json` stores the immutable phase identity and current status.
- `events/00000000-*.json` stores one hash-chained event per committed action.
- Events are written to a same-directory temporary file, flushed, renamed, and
  only then acknowledged as committed. A summary file is never the authority.
- One writer lock is held per run. A live owner is never killed or displaced;
  an owner that is proven dead may be moved aside as a stale lock.
- A `phase4.round.committed` event is the atomic measurement unit. It contains
  all nine scenarios from one fixture/profile round. Partial rounds are never
  added to the official sample pool.
- `phase4.attempt.started` is written before browser activity. Therefore an
  interrupted attempt remains part of the existing 28-attempt limit.
- Each browser/CDP session runs one uncounted preparation round. Preparation
  results are diagnostic only and cannot satisfy the twenty-sample contract.
- Credentials, cookies, tokens, raw bodies, prompts, clinical content, and
  device serials are not persisted. Phase 4 sanitization runs before event
  serialization.

## Commands

Run the existing Phase 4 command to continue the only compatible incomplete
run:

`npm run audit:performance:plan1:phase4`

Inspect run status without taking the writer lock:

`npm run audit:performance:plan1:phase4 -- --status`

Request a graceful stop. The current nine-scenario round finishes first:

`npm run audit:performance:plan1:phase4 -- --pause [runId]`

Explicitly select a compatible run or intentionally create a new run:

`npm run audit:performance:plan1:phase4 -- --resume <runId>`

`npm run audit:performance:plan1:phase4 -- --new-run`

`--new-run` never deletes or merges an earlier run. A changed source,
fixture, artifact, migration, or harness identity blocks silent continuation;
the affected run remains available for inspection.

When the identity changes only because this resume implementation adds
checkpoint recovery or harness-error observability, use the explicit
one-time compatible migration command from `app/`:

`node scripts/performance-plan-1-phase-4.mjs --migrate-compatible <sourceRunId>`

This command is not a measurement run. It first reads every source event and
verifies the manifest, event sequence, and hash chain. It then requires the
same phase schema, scenario list, sample/attempt contract, fixture hash, and
build identity; it rejects a completed source or any fixture/build change. It
creates a new run with the current identity, records the migration reason, and
copies only preparation, attempt-terminal, fixture-failure, and atomic-round
events. The source run is never edited or deleted. The normal Phase 4 command
then resumes the new run.

An attempt is not counted as valid merely because it started. A process
interruption leaves `phase4.attempt.started` without a terminal event; the
next resume records `phase4.attempt.failed` with
`execution_interrupted/recovered_on_resume` before allocating the next attempt.
Browser/context/timeout/response errors are recorded with a sanitized
classification, phase, scenario, and bounded message. Credentials, query
values, cookies, raw bodies, and stack secrets are excluded.

## Phase 4 integration

The Phase 4 launcher creates the persistent run before readiness and binds it
to the current measurement identity. Readiness, local build, release health,
hosted access, Android Chrome, and installed PWA checks still gate stage 4.1.
The launcher may repeat those ephemeral checks after a restart, but it reuses
committed measurement rounds whose identity remains compatible.

The local desktop, owner-PC hosted, Android Chrome, and installed Android PWA
paths use the same round commit policy. Warm scenarios remain real clicks in
the same authenticated context; a new process creates a new browser context
and must complete preparation again.

## Latest Phase 4 execution - 2026-09-15

The compatible migration created run
`aiya-performance-plan1-phase4-20260915T130141721Z-6aa263db-c0ff-4192-9333-c20d769f4692`
from the preserved blocked source run. The official continuation completed
local desktop and owner-PC hosted baselines at 20 valid rounds per scenario.
Android ADB/CDP and target launch passed, but Android Chrome preparation
stopped at `locator.click: Timeout 8000ms exceeded`; installed PWA was not
run because of the ordered dependency. Evidence remains
`docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_EVIDENCE.json` with status
`BLOCKED / PERFORMANCE_BLOCKED`, valid environments `2/4`. This is an
environment interaction blocker, not a root-cause performance conclusion.

## Future phase requirement

Every new phase must provide a descriptor with ordered stages, explicit
postcondition verifiers, stable work-unit IDs, input/output identity, and an
external-side-effect policy. Read-only/build/test work may be reused only
when its input identity and outputs verify. An uncertain deployment, migration,
or other external side effect requires an idempotency receipt or explicit
reconciliation; it is never replayed automatically.

## Non-goals and limits

This mechanism protects committed checkpoints, not an in-flight operation
that has not reached its commit boundary. It cannot make a power-loss event
stronger than the operating system/filesystem durability guarantees. It does
not make a failed sample valid, reduce twenty samples, increase 28 attempts,
or turn a blocked environment into PASS. Production remains NO-GO.
