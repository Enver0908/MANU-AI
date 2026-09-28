# AIya Performance Plan 1 Phase 4 Cyclic Execution Specification

## Purpose

Plan 1 Phase 4 remains one open phase. A measurement blocker, harness defect,
or newly discovered failure starts a recorded cycle inside that phase. The
phase closes only after the locked four-environment baseline contract is
complete and the final evidence passes its required integrity checks.

## Cycle states and order

Every cycle has one immutable `cycleId` and one monotonically increasing
`cycleNumber`. The allowed order is:

`DIAGNOSE -> FIX -> VALIDATE -> REMEASURE -> DIAGNOSE`

The cycle may enter `BLOCKED` from `DIAGNOSE`, `FIX`, `VALIDATE`, or
`REMEASURE`. It may enter `COMPLETE` only from `REMEASURE`. A blocked cycle is
closed for that attempt, while the phase remains open and a later cycle may be
started with a `parentCycleId`.

## Durable records

The shared checkpoint store records `phase.cycle.started` and
`phase.cycle.state` events with the existing SHA-256 chain and single-writer
lock. A cycle event contains only cycle identifiers, short reasons, evidence
file references, and sanitized structured details. It never contains a
password, token, cookie, raw request body, clinical content, or device serial.

## Measurement rule

Diagnostic and validation probes do not count as official Phase 4 samples. A
remeasurement cycle may reuse an earlier round only when source, fixture,
migration, dependency, artifact, and harness identities are compatible. A
changed identity creates a new comparable cycle and preserves the old cycle as
history. The 20-valid-sample and 28-attempt rules are never relaxed inside a
cycle.

## Required loop

1. Open a cycle at `DIAGNOSE` with a concrete trigger and parent reference.
2. Reproduce the observed failure at least three times using the same route,
   fixture, authentication mode, device, and interaction order.
3. Record the broken boundary: click, navigation, request header, response
   body finish, ready selector, paint, or device connection.
4. Enter `FIX` only when the evidence identifies a specific measurement or
   runtime component and the permitted scope for that component is recorded;
   every state transition must persist a non-empty reason and at least one
   evidence-file reference.
5. Enter `VALIDATE` after the targeted test for that fix passes.
6. Enter `REMEASURE` only after the same controlled scenario is rerun and the
   result is classified as valid, invalid, or blocked without deleting history.
7. Return to `DIAGNOSE` when the remeasurement exposes another problem. Close
   the cycle as `BLOCKED` when an external prerequisite or unresolved cause
   prevents the next action; start a new cycle when work can continue.
8. Close the phase only when the ordered Phase 4 stages, four environments,
   nine scenarios, 20 valid samples per scenario, evidence integrity, and
   document reconciliation all pass. A budget overrun remains a measured
   candidate under the existing Plan 1 contract and is not silently erased.

## Interruption and restart

The cycle is written before any long operation. Every completed diagnostic,
fix validation, and committed measurement boundary is durable. A computer
shutdown or session interruption leaves the cycle and checkpoint inspectable;
the next process resumes only after identity and lock checks. An unfinished
attempt is recorded as interrupted and cannot become a valid sample.

## Operator sequence

Run these commands from `app` and keep the returned `runId` and `cycleId` in
the evidence record. First inspect the current state:

`npm run audit:performance:plan1:phase4:cycle-status`

Open a new cycle, or resume its active cycle after an interruption:

`node ../tools/phase-execution/phase-cycle-cli.mjs --open --root ../.manu-runtime/phase-execution --phase-id aiya-performance-plan1-phase4 --run-id <runId> --trigger <short_trigger>`

Advance only after the preceding state evidence is complete:

`node ../tools/phase-execution/phase-cycle-cli.mjs --root ../.manu-runtime/phase-execution --phase-id aiya-performance-plan1-phase4 --run-id <runId> --cycle-id <cycleId> --state FIX --reason <short_reason>`

Repeat the same command with `VALIDATE`, then `REMEASURE`. Only then may the
official harness run:

`node scripts/performance-plan-1-phase-4.mjs --resume <runId> --cycle <cycleId>`

The harness rejects a missing, inactive, mismatched, or non-`REMEASURE`
cycle. After remeasurement it records `COMPLETE` only if the ordered Phase 4
closure passes; otherwise it returns the same cycle to `DIAGNOSE` and
preserves the run as blocked for the next controlled diagnosis. A new cycle
with the prior cycle as `parentCycleId` is opened only when the current cycle
is explicitly closed as `BLOCKED` because its next action cannot proceed. A
process interruption is resumed with the same cycle; the operator does not
create a replacement cycle merely because the process was interrupted.

## Scope boundary

This specification permits targeted harness, fixture, environment, and
measurement corrections inside Phase 4. An application runtime performance
fix requires a causal trace, a focused regression test, and an explicit scope
decision because the original Plan 1 contract assigns runtime remediation to
Plan 2. No production deployment, production migration, provider egress,
billing, or real health-data processing is part of this phase.
