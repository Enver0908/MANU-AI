# Hosted Sandbox Phase 0 Verifier Setup Evidence

Date: 2026-08-25

Contract: `hosted-sandbox-verifier-setup-v1`

Main plan: `hosted-sandbox-environment-assurance-v1`

Independent review: `NOT_REQUESTED`

Production: `NO-GO`

## What this phase did

Faz 0 created two governance plan packages and installed a protected Hosted Sandbox verifier. It did not change product runtime behavior, migrations, package manifests, lockfiles, the governance CLI, the red-team harness, or `.github/workflows/execution-governance.yml`.

## Packages

- `.execution-governance/plans/hosted-sandbox-verifier-setup-v1/`
- `.execution-governance/plans/hosted-sandbox-environment-assurance-v1/`

Each package contains `plan.md`, `contract.json`, `scope.json`, `acceptance.json`, `lock.json`, `lifecycle-record.json`, and `implementation-report.json`.

`lock.json` was generated with `governance-cli lock --write --allow-dirty`. `lockCommit` is empty. `LOCKED_FOR_IMPLEMENTATION` is not claimed until a separate user-approved lock commit exists.

The main plan `plan_state` is `READY_FOR_IMPLEMENTATION` because the protected verifier now exists. Product phases remain `NOT_STARTED`.

## Verifier

- `app/scripts/verify-hosted-sandbox-contracts.mjs`
- `tools/hosted-sandbox/run-verifier.mjs`
- `tools/hosted-sandbox/lib/identity.mjs`
- `tools/hosted-sandbox/lib/negative-controls.mjs`
- `tools/hosted-sandbox/hosted-sandbox-verifier.test.mjs`

Live identity from `node app/scripts/verify-hosted-sandbox-contracts.mjs`:

- result: PASS
- commitSha: `c62bcdd85bd5056269b8a7fd65bea9d6fb1cbc26`
- migrationFingerprint: `e720dda14ea8a4d5c614a33cbe0ce03c1197ef521fe24b3fbe9eecfd254cd0be`

Negative controls are fixture/self-tests. They do not claim hosted demo seed is already removed from production code.

## Commands

| Command | Exit code | Result |
| --- | --- | --- |
| `node tools/execution-governance/governance-cli.mjs doctor` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs validate` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs validate --plan-dir .execution-governance/plans/hosted-sandbox-verifier-setup-v1` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs validate --plan-dir .execution-governance/plans/hosted-sandbox-environment-assurance-v1` | 0 | PASS |
| `node tools/execution-governance/red-team-harness.mjs` | 0 | PASS 24/24 |
| `node app/scripts/verify-hosted-sandbox-contracts.mjs` | 0 | PASS |
| `node --test tools/hosted-sandbox/hosted-sandbox-verifier.test.mjs` | 0 | PASS 6/6 |

Runtime artifacts under `.execution-governance/runtime/` must not be committed.

## Residual

- No plan-lock commit yet.
- No Faz 1 product implementation.
- Branch `codex/stage-4c-remediation` HEAD `c62bcdd` is ahead of origin by 2 commits relative to this worktree snapshot.
- Push, PR, merge, deploy, remote migration, hosted cleanup, and paid purchase remain forbidden without a later explicit user command.
