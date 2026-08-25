# Cursor Zero-Command Governed Execution Evidence

Date: 2026-08-25

Plan: `.execution-governance/plans/cursor-zero-command-governed-execution-v1`

Phase: `CZC-PHASE-1`

Status: `EXECUTOR_VERIFIED`

Independent review: `NOT_REQUESTED`

Production boundary: unchanged `NO-GO`; no push, merge, PR, deploy, production gate change, provider egress, live billing, production schema rollout, package dependency change, migration, or real health-data path change was performed.

## Implemented Behavior

- Added `cursor-plan-resolver.mjs` to resolve governed execution intent to one locked plan and one next runnable phase.
- Added `auto-preflight`, `auto-activate`, and `auto-open` Cursor session flows without user-supplied phase IDs.
- Added `DISCOVERY_READ_ONLY` guard behavior for safe discovery while keeping writes, secrets, network-capable commands, MCP, subagents, and production actions blocked.
- Added `beforeSubmitPrompt` handling that treats `Bu planı uygula` as intent only, never as scope authority.
- Added workspace Cursor skill text for the natural Cursor workflow.
- Updated installer dry-run checks and launcher text so it no longer tells the user to type phase activation commands.

## Command Evidence

| Command | Exit code | Result |
| --- | ---: | --- |
| `node tools/execution-governance/governance-cli.mjs preflight --plan-dir .execution-governance/plans/cursor-zero-command-governed-execution-v1 --phase-id CZC-PHASE-1 --allow-implementation-head` | 0 | PASS |
| `node --test tools/execution-governance/cursor-plan-resolver.test.mjs` | 0 | PASS |
| `node --test tools/execution-governance/cursor-session.test.mjs` | 0 | PASS |
| `node --test tools/execution-governance/activate-secure-cursor-guard.test.mjs` | 0 | PASS |
| `node tools/execution-governance/governance-hardening-red-team.mjs` | 0 | PASS |
| `node tools/execution-governance/install-secure-cursor-guard.mjs --dry-run` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs doctor` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs validate --plan-dir .execution-governance/plans/cursor-zero-command-governed-execution-v1 --phase-id CZC-PHASE-1` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs run-checks --plan-dir .execution-governance/plans/cursor-zero-command-governed-execution-v1 --phase-id CZC-PHASE-1` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs validate --all-plans` | 0 | PASS with legacy reauthor warnings for historical plans |
| `git diff --check` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs scope-check --plan-dir .execution-governance/plans/cursor-zero-command-governed-execution-v1 --phase-id CZC-PHASE-1` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs postflight --plan-dir .execution-governance/plans/cursor-zero-command-governed-execution-v1 --phase-id CZC-PHASE-1 --allow-implementation-head` | 0 | PASS |

Run-record: `.execution-governance/runtime/run-records/run-2026-08-25T16-56-59-013Z-2184.json`

## Residual Notes

- The source implementation is complete, but the installed ProgramData guard still needs a post-commit installer run before Cursor itself can use the new `beforeSubmitPrompt` and resolver-aware launcher behavior.
- The installed-state update is local machine setup, not production readiness.

## 2026-08-26 Hardening Remediation

Status: `EXECUTOR_VERIFIED_WITH_INSTALL_BLOCKED`

Additional behavior implemented:

- `beforeSubmitPrompt` now attempts resolver-backed `auto-activate` when the user gives governed execution intent such as `Bu planı uygula`; prompt text remains intent/plan hint only and is not scope authority.
- Hook responses now include Cursor-compatible `continue: true/false` while preserving the existing `permission` field.
- `workspaceOpen` and `sessionStart` enter discovery read-only mode or preserve a still-valid active signed scope.
- Cursor activation now rejects writable glob scope entries; create and modify permissions are enforced separately.
- Active signed scopes now include an activation lease and expire fail-closed.
- Resolver phase selection now filters requirements by selected phase and honors dependencies instead of treating every requirement as runnable.
- Installer verification now requires skill frontmatter and the expanded enterprise hook event set.
- Full `red-team-harness` was reconciled with the external activation model and now passes 24/24 scenarios.
- Hosted Sandbox Remediation v1.1 PHASE-1 activation scope was narrowed from broad app/page/API globs to exact mapped files via `HSR11-PHASE-1-SCOPE-CHANGE-002`; no product implementation was started.

Additional command evidence:

| Command | Exit code | Result |
| --- | ---: | --- |
| `node tools/execution-governance/governance-cli.mjs doctor` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs validate` | 0 | PASS |
| `node --test tools/execution-governance/cursor-plan-resolver.test.mjs tools/execution-governance/cursor-session.test.mjs tools/execution-governance/activate-secure-cursor-guard.test.mjs` | 0 | PASS |
| `node tools/execution-governance/governance-hardening-red-team.mjs` | 0 | PASS |
| `node tools/execution-governance/red-team-harness.mjs` | 0 | PASS, 24/24 |
| `node tools/execution-governance/governance-cli.mjs validate --all-plans` | 0 | PASS with legacy reauthor warnings for historical plans |
| `node tools/execution-governance/governance-cli.mjs validate --plan-dir .execution-governance/plans/hosted-sandbox-remediation-v1-1 --phase-id PHASE-1` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs activate-cursor --plan-dir .execution-governance/plans/hosted-sandbox-remediation-v1-1 --phase-id PHASE-1 --allow-implementation-head` | 0 | PASS dry-run; exact writable scope rendered |
| `git diff --check` | 0 | PASS |
| `node tools/execution-governance/install-secure-cursor-guard.mjs` | 1 | BLOCKED: non-elevated ProgramData copy failed with `EPERM` |
| `node tools/execution-governance/install-secure-cursor-guard.mjs --verify` | 1 | BLOCKED: installed ProgramData guard/broker SHA and hook event set are still stale |

Residual notes:

- Repo source and plan scope are ready, but the actual installed Cursor trust root remains stale until the installer is run elevated once.
- PHASE-1 product work remains `NOT_STARTED`; this update only makes the next Cursor/Codex execution path safer and more automatic.
- Production remains `NO-GO`; no push, merge, PR, deploy, production gate, Supabase remote mutation, VPS change, provider egress, live billing, schema rollout, or real health-data path was changed.
