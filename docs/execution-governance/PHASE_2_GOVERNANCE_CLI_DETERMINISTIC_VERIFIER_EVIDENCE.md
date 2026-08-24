# Plan-Implementation Assurance Phase 2 Evidence

Date: 2026-08-24

Status: PHASE_2_GOVERNANCE_CLI_DETERMINISTIC_VERIFIER_COMMITTED_LOCAL

## Scope

Phase 2 adds the dependency-free governance CLI and deterministic verifier command surface.

This phase does not install Cursor hooks, root `AGENTS.md`, GitHub Actions, product code, migrations, schema changes, package dependencies, production gate changes, push, merge, PR, or deploy behavior.

## Baseline

Phase 2 starts after commit `e6a2a8b docs: define governance protocol status model`.

Expected branch:

- `codex/stage-4c-remediation`

Expected upstream:

- `origin/codex/stage-4c-remediation`

## Files Created

- `tools/execution-governance/governance-cli.mjs`
- `docs/execution-governance/PHASE_2_GOVERNANCE_CLI_DETERMINISTIC_VERIFIER_EVIDENCE.md`

## Files Modified

- `.execution-governance/schemas/acceptance.schema.json`
- `.execution-governance/templates/acceptance.json`
- `.gitignore`
- `README.md`
- `PLAN.md`
- `PROJECT_PLAN.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `app/README.md`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`
- `docs/RISK_REGISTER.md`
- `docs/execution-governance/MANU_AI_PLAN_IMPLEMENTATION_ASSURANCE_INTEGRATION_PLAN.md`

## Implemented Commands

- `doctor`
- `validate`
- `lock`
- `preflight`
- `scope-check`
- `run-checks`
- `postflight`
- `close`

## Deterministic Execution Rules

- Acceptance commands use `exactEvidenceCommandSpec`.
- `run-checks` executes commands with `spawn` and `shell: false`.
- Shell-expression executables containing separators are rejected by command-spec validation.
- Runtime run records are written under `.execution-governance/runtime/`, which remains ignored by Git.
- CLI commands do not require a root `package.json` or new npm dependency.

## Explicit Non-Changes

- No product code changed.
- No API code changed.
- No UI code changed.
- No Supabase migration or schema file changed.
- No package manifest or lockfile changed.
- No Cursor hook, root `AGENTS.md`, or CI workflow was installed in this phase.
- No push, merge, PR, deploy, or production gate change was performed.

## Verification

Commands executed after file creation:

- `node tools/execution-governance/governance-cli.mjs doctor`
- `node tools/execution-governance/governance-cli.mjs validate`
- `node tools/execution-governance/governance-cli.mjs validate --plan-dir .execution-governance/templates`
- `node tools/execution-governance/governance-cli.mjs help`
- Negative shell-expression validation against a temporary runtime fixture.
- Positive runtime fixture exercising `lock`, `preflight`, `scope-check`, `run-checks`, `postflight`, and `close`.
- `git diff --check`
- Secret and sensitive-token pattern scan over Phase 2 files.
- `git status --short --branch`

Observed results:

- `doctor` passed all repository, Git, Node, policy, schema, template, and JSON parse checks.
- `validate` passed for 16 governance JSON files.
- `validate --plan-dir .execution-governance/templates` passed for the four machine plan template JSON files.
- `help` printed all required commands.
- Negative shell-expression validation rejected `node; echo bad` with exit code 1.
- Positive runtime fixture passed `lock`, `preflight`, `scope-check`, `run-checks`, `postflight`, and `close`.
- The first positive fixture run exposed a Windows executable-path compatibility bug because `process.execPath` may contain spaces; the CLI was corrected to reject shell separator characters while allowing normal executable paths with spaces.
- Runtime fixture artifacts were created under ignored `.execution-governance/runtime/` and removed after verification.
- `git diff --check` passed with only Windows CRLF normalization warnings.
- Secret scan found no real secrets. Matches are historical documentation references to blocked/test Stripe key prefixes and the Phase 0 evidence command text.
- Final worktree contains only Phase 2 governance and documentation changes.

## Commit Boundary

This phase remains uncommitted until the user gives a separate commit command.
