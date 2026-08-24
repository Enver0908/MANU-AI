# Plan-Implementation Assurance Phase 3 Evidence

Date: 2026-08-24

Status: PHASE_3_CODEX_CURSOR_ADAPTERS_IMPLEMENTED_UNVERIFIED

## Scope

Phase 3 adds Codex and Cursor adapter surfaces for the MANU-AI plan-implementation assurance system.

This phase does not add GitHub Actions, product code, migrations, schema changes, package dependencies, production gate changes, push, merge, PR, or deploy behavior.

## Baseline

Phase 3 starts after commit `e4de06a feat: add governance verifier cli`.

Expected branch:

- `codex/stage-4c-remediation`

Expected upstream:

- `origin/codex/stage-4c-remediation`

## Files Created

- `AGENTS.md`
- `.cursor/rules/execution-governance.mdc`
- `.cursor/hooks.json`
- `.cursor/hooks/governance-guard.mjs`
- `docs/execution-governance/PHASE_3_CODEX_CURSOR_ADAPTERS_EVIDENCE.md`

## Files Modified

- `README.md`
- `PLAN.md`
- `PROJECT_PLAN.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `app/README.md`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`
- `docs/RISK_REGISTER.md`
- `docs/execution-governance/MANU_AI_PLAN_IMPLEMENTATION_ASSURANCE_INTEGRATION_PLAN.md`

## Adapter Behavior

- Root `AGENTS.md` gives Codex-compatible agents concise repository governance instructions.
- Cursor project rule is `alwaysApply: true`.
- Cursor hooks use `.cursor/hooks.json` with `version: 1`.
- Cursor hook entries use `failClosed: true`.
- Cursor guard exits with code `2` and JSON `permission: "deny"` for blocked actions.
- Without an active locked plan under `.execution-governance/active/scope.json`, product writes are blocked while governance bootstrap paths remain allowed.
- Reads of secret-like paths are blocked.
- Shell commands for push, merge, destructive Git reset/clean, dependency install/update, Supabase DB reset/push, deploy, broad recursive delete, and similar unsafe operations are blocked.
- When an active scope exists, file mutations must be listed in `allowedCreatePaths` or `allowedModifyPaths` and must not be listed in `protectedPaths`.

## Explicit Non-Changes

- No product code changed.
- No API code changed.
- No UI code changed.
- No Supabase migration or schema file changed.
- No package manifest or lockfile changed.
- No GitHub Actions workflow was installed.
- No push, merge, PR, deploy, or production gate change was performed.

## Verification

Commands executed after file creation:

- JSON parse of `.cursor/hooks.json`.
- Cursor guard allow test for governance bootstrap write with no active plan.
- Cursor guard deny test for product write with no active plan.
- Cursor guard deny test for secret-like read.
- Cursor guard deny test for unsafe shell command.
- Cursor guard allow test for safe shell command.
- Cursor guard active-scope test allowing a listed product path.
- Cursor guard active-scope test denying a protected path.
- Cursor guard active-scope test denying a scope-external path.
- `node tools/execution-governance/governance-cli.mjs doctor`
- `node tools/execution-governance/governance-cli.mjs validate`
- `git diff --check`
- Secret and sensitive-token pattern scan over Phase 3 files.
- `git status --short --branch`

Observed results:

- `.cursor/hooks.json` parsed successfully.
- Governance bootstrap write with no active plan was allowed.
- Product write with no active plan was denied with exit code 2.
- Secret-like read of `.env` was denied with exit code 2.
- Unsafe shell command `git push origin main` was denied with exit code 2.
- Safe shell command `git status --short` was allowed.
- Temporary active scope allowed `app/src/app/page.tsx`, denied protected `PLAN.md`, and denied scope-external `app/src/app/other.tsx`.
- Temporary `.execution-governance/active/scope.json` used for the active-scope test was removed after verification.
- Governance CLI `doctor` passed.
- Governance CLI `validate` passed for 16 JSON files.
- `.execution-governance/active` was absent after verification.
- `git diff --check` passed with only Windows CRLF normalization warnings.
- Secret scan found no real secrets. Matches are historical documentation references to blocked/test Stripe key prefixes and the Phase 0 evidence command text.
- Final worktree contains only Phase 3 adapter and documentation changes.

## Commit Boundary

This phase remains uncommitted until the user gives a separate commit command.
