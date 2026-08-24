# Red-Team, Pilot, And Documentation Closure

Version: 1.0.0

Status: PHASE_6_RED_TEAM_PILOT_CLOSURE_COMMITTED_LOCAL

Authority:

- `docs/execution-governance/EXECUTION_ASSURANCE_PROTOCOL.md`
- `docs/execution-governance/MANU_AI_PLAN_IMPLEMENTATION_ASSURANCE_INTEGRATION_PLAN.md`

## Purpose

Phase 6 validates the governance system against synthetic anti-gaming scenarios before treating the plan-implementation assurance loop as usable for later work.

## Deterministic Harness

Tracked command:

- `node tools/execution-governance/red-team-harness.mjs`

The harness creates temporary fixtures only under `.execution-governance/runtime/phase6-red-team/` and removes them before exit. It may create `.execution-governance/active/scope.json` during the active-scope smoke test and removes that directory before exit. Runtime artifacts are ignored and must not be tracked.

## Required Scenario Inventory

The harness must report all of these scenarios:

- Hook denies product write without active scope.
- Hook allows governance bootstrap write without active scope.
- Hook fails closed on malformed payload.
- Hook denies secret-like reads.
- Hook denies unsafe shell commands and allows safe status command.
- Hook enforces active scope allow and protected lists.
- `validate` rejects shell-wrapper executable specs.
- `preflight` rejects tampered locked plan hash.
- `postflight` rejects stale run-record artifact.
- `scope-check` rejects forbidden diff outside manifest.
- `postflight` rejects changed test skip/only markers.
- Positive pilot closes with no independent review requested.
- Review templates preserve explicit full and targeted review boundaries.
- Clean CI workflow remains read-only and runs the red-team harness.
- Governance runtime artifacts are not tracked.

## Added Postflight Protections

Postflight now requires every automated or hybrid acceptance record to have a fresh `PASS` run-record for the same `contractId` and `requirementId`, with `commitSha` equal to current `HEAD` and a parseable timestamp.

Postflight now scans changed `.test.*` and `.spec.*` files and rejects `.only`, `.skip`, or `skip: true` markers. This is a governance anti-gaming gate; it is not a product test runner.

## Production Boundary

Phase 6 does not alter production readiness. Production remains `NO-GO`.

Phase 6 does not authorize push, merge, PR, deploy, production gate changes, provider/channel egress, live billing, production schema rollout, real health-data processing, branch protection changes, default branch changes, or dependency installation.
