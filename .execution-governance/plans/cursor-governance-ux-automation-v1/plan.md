# Cursor Governance UX Automation Plan

Plan version: 1.0.0

Plan state: LOCKED_FOR_IMPLEMENTATION

<!-- GOV-PHASE id="CGUX-PHASE-1" title="Cursor Governance UX Automation" -->

## purpose
<!-- GOV-SECTION id="purpose" -->

Create a single-phase governance automation layer that lets a user start a governed Cursor phase through one session command and an installed launcher path while preserving the existing fail-closed enterprise guard, signed phase scope, ProgramData trust root, and no-production-change boundary.

## scope
<!-- GOV-SECTION id="scope" -->

The phase changes only execution-governance tooling, tests, installer support, the new plan package, and a governance evidence note. It adds a normal-user Cursor session command, an admin-owned activation broker script intended for ProgramData installation, installer packaging for that broker and launcher, a desktop shortcut created by the installer, and ancestry checks for implementation-head activation.

## out-of-scope
<!-- GOV-SECTION id="out-of-scope" -->

The phase does not change product application code, Supabase migrations, package manifests, lockfiles, CI write permissions, production gates, provider egress, billing, deployment, branch protection, default branch settings, or real health data paths. Hosted Sandbox Remediation v1.1 PHASE-1 scope defects remain separate product-plan issues and must be reported as `CHANGE_REQUEST_REQUIRED` by the automation.

## preconditions
<!-- GOV-SECTION id="preconditions" -->

The repository must be on `codex/stage-4c-remediation`, the worktree must start clean, governance `doctor` and `validate` must pass, and the installed Cursor guard must remain the admin-owned ProgramData trust root. Independent review remains `NOT_REQUESTED` unless the user later requests review.

## affected-files
<!-- GOV-SECTION id="affected-files" -->

Affected implementation files are `tools/execution-governance/governance-cli.mjs`, `tools/execution-governance/activate-secure-cursor-guard.mjs`, `tools/execution-governance/secure-cursor-guard.mjs`, `tools/execution-governance/install-secure-cursor-guard.mjs`, `tools/execution-governance/cursor-session.mjs`, and `tools/execution-governance/cursor-session-broker.mjs`. Affected tests are `tools/execution-governance/activate-secure-cursor-guard.test.mjs`, `tools/execution-governance/cursor-session.test.mjs`, and `tools/execution-governance/governance-hardening-red-team.mjs`. Governance records are under `.execution-governance/plans/cursor-governance-ux-automation-v1/` and `docs/execution-governance/CURSOR_GOVERNANCE_UX_AUTOMATION_EVIDENCE.md`.

## architecture-decisions
<!-- GOV-SECTION id="architecture-decisions" -->

The normal-user session script runs repository checks, plan validation, red-team checks, phase scope existence checks, and activation dry-runs before any activation write. The broker script is the only component intended to write `activation.json` under ProgramData and it validates lock hashes, phase membership, safe relative scope paths, command shapes, current HEAD, and lock ancestry before writing atomically. `--allow-implementation-head` means the lock commit must be an ancestor of current HEAD, not an unrestricted bypass.

## rejected-alternatives
<!-- GOV-SECTION id="rejected-alternatives" -->

A persistent privileged Windows service is rejected because the existing architecture uses an admin-owned file trust root and does not require a resident process. Broadening Cursor scope automatically is rejected because locked product plans remain the source of truth. Running repo-owned JavaScript with elevated write authority is rejected for activation writes; the broker copy installed under ProgramData is the trusted activation writer.

## api-data-contracts
<!-- GOV-SECTION id="api-data-contracts" -->

`governance-cli cursor-session --session <list|status|preflight|activate|deactivate|open>` delegates to `cursor-session.mjs`. `cursor-session.mjs` emits JSON reports with `status`, `repoRoot`, selected `planDir`, selected `phaseId`, and check records. `cursor-session-broker.mjs` accepts only fixed CLI arguments for `--activate` or `--deactivate`, `--repo`, `--plan-dir`, `--phase-id`, and `--allow-implementation-head`, then writes an activation object using schema version `1.0.0`.

## ordered-steps
<!-- GOV-SECTION id="ordered-steps" -->

<!-- GOV-STEP id="CGUX-STEP-001" -->
1. Add ancestry-aware lock checks to CLI preflight, postflight, activation rendering, and guard runtime validation.

<!-- GOV-STEP id="CGUX-STEP-002" -->
2. Add the Cursor session command and broker with JSON status, preflight, activation, deactivation, and launch flows.

<!-- GOV-STEP id="CGUX-STEP-003" -->
3. Extend the secure guard installer to package the broker, a launcher script under ProgramData, and a desktop shortcut for the launcher.

<!-- GOV-STEP id="CGUX-STEP-004" -->
4. Add automated tests and red-team coverage for selected-phase activation, non-ancestor denial, CLI session status, and broker output.

<!-- GOV-STEP id="CGUX-STEP-005" -->
5. Run governance and targeted test commands, record exact outcomes, and leave production state unchanged.

## technical-methods
<!-- GOV-SECTION id="technical-methods" -->

Use dependency-free Node.js scripts and `spawnSync` with `shell: false` for Git, Node, and PowerShell calls. Normalize repository-relative paths before scope checks. Write activation files through a temporary file followed by rename. Keep runtime artifacts under `.execution-governance/runtime/` and leave them untracked.

## data-control-flow
<!-- GOV-SECTION id="data-control-flow" -->

User action enters `governance-cli cursor-session` or `cursor-session.mjs`. The session script reads Git state, plan JSON, installed guard status, and selected phase scope. If every preflight check passes, it calls the broker for activation. Cursor hooks later read only ProgramData `activation.json` and enforce the signed scope against shell, MCP, task, read, and file-mutation events.

## dependencies
<!-- GOV-SECTION id="dependencies" -->

The phase depends on Git, Node.js, local PowerShell for Windows launcher support, and the existing execution-governance schemas, validator, CLI, installer, guard, and red-team harness. It introduces no npm dependency and no external network requirement.

## state-transitions
<!-- GOV-SECTION id="state-transitions" -->

The plan package transitions from locked implementation authority to executor-verified only after the listed automated commands pass. Cursor activation transitions from `INACTIVE_FAIL_CLOSED` to `ACTIVE_SIGNED_SCOPE` only when the selected phase is valid and the broker writes the activation. Deactivation writes `INACTIVE_FAIL_CLOSED`.

## errors-boundaries
<!-- GOV-SECTION id="errors-boundaries" -->

Missing phase ID, missing concrete allowed modify path, validation failure, red-team failure, lock hash mismatch, non-ancestor lock commit, malformed command spec, ProgramData write denial, and missing Cursor executable return `BLOCKED` or `CHANGE_REQUEST_REQUIRED` without widening scope. Stale Hosted Sandbox PHASE-1 scope defects are surfaced rather than repaired by this phase.

## security-privacy
<!-- GOV-SECTION id="security-privacy" -->

The automation must not read secret files, log secrets, log raw prompts, log health data, broaden tenant boundaries, enable network egress, or commit runtime activation files. The broker rejects path traversal and absolute activation scope paths. ProgramData remains the guard trust root.

## accessibility-localization
<!-- GOV-SECTION id="accessibility-localization" -->

The first implementation is command and launcher based with concise JSON and console text. It does not alter app UI accessibility or localization. Future graphical UI work must preserve keyboard-readable status and clear blocker text.

## migration-rollback
<!-- GOV-SECTION id="migration-rollback" -->

Rollback is removing the new session and broker files, reverting installer packaging changes, and deactivating Cursor by writing `INACTIVE_FAIL_CLOSED`. No database migration, package migration, production deploy, or remote state change exists.

## tests
<!-- GOV-SECTION id="tests" -->

Run `node --test tools/execution-governance/activate-secure-cursor-guard.test.mjs`, `node --test tools/execution-governance/cursor-session.test.mjs`, `node tools/execution-governance/governance-hardening-red-team.mjs`, `node tools/execution-governance/governance-cli.mjs doctor`, `node tools/execution-governance/governance-cli.mjs validate`, `node tools/execution-governance/governance-cli.mjs validate --all-plans`, targeted plan validation, installer dry-run or verify, `git diff --check`, and `git status --short --branch`.

## acceptance-oracles
<!-- GOV-SECTION id="acceptance-oracles" -->

Acceptance requires automated command exit code 0 for activation tests, cursor session tests, red-team, governance validation, selected plan validation, and diff hygiene. Installer verification may require elevated ProgramData update after source guard changes; an unavailable elevation is recorded as a residual installation step, not product readiness.

## stop-completion
<!-- GOV-SECTION id="stop-completion" -->

Stop before product changes, package changes, migrations, CI permission changes, production gate changes, push, deploy, or locked Hosted Sandbox product plan edits. Complete only when code, tests, plan records, and evidence are consistent and the worktree contains only the authorized governance automation changes.

<!-- GOV-REQ id="CGUX-001" -->
CGUX-001 requires implementation-head activation to be ancestry-aware in CLI activation, CLI preflight/postflight, and the Cursor guard.

<!-- GOV-REQ id="CGUX-002" -->
CGUX-002 requires a user-facing Cursor session command that reports status, validates a selected phase, detects scope defects, and can call activation or deactivation.

<!-- GOV-REQ id="CGUX-003" -->
CGUX-003 requires an admin-owned broker design for activation writes with hash, phase, path, command, and ancestry validation.

<!-- GOV-REQ id="CGUX-004" -->
CGUX-004 requires installer packaging for the broker, launcher, and desktop shortcut without replacing the ProgramData guard trust root.

<!-- GOV-REQ id="CGUX-005" -->
CGUX-005 requires automated tests and red-team cases covering session status, selected phase activation, and non-ancestor denial.

<!-- GOV-REQ id="CGUX-006" -->
CGUX-006 requires evidence and lifecycle records showing exact command outcomes, remaining installation notes, and unchanged production boundaries.
