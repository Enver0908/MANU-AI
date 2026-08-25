# Cursor Protected Effect Governance Evidence

Date: 2026-08-26

Plan: `.execution-governance/plans/cursor-protected-effect-governance-v1`

Phase: `CPEG-PHASE-1`

Plan-lock commit: `d0d735bd5d4c1bab3f4cc0d10ba8a81492833060`

Executor state: `EXECUTOR_VERIFIED`

Independent review: `NOT_REQUESTED`

Production impact: none. Production remains `NO-GO`.

## Summary

Cursor governance now enforces protected effects instead of blocking whole sessions. Ordinary prompts, empty/non-MANU workspaces, safe reads, and non-MANU shell work are allowed without activation. MANU-AI protected mutations, protected shell/MCP/subagent effects, secret reads, production/deploy/network effects, and out-of-scope writes remain denied unless an active signed phase scope permits the exact target.

The enterprise guard installed in `C:\ProgramData\MANU-AI-Governance\secure-cursor-guard.mjs` was updated and verified. The guard no longer treats `C:\ProgramData\Cursor` or enterprise hook `process.cwd()` as the MANU-AI repo authority.

## Changed Files

- `tools/execution-governance/secure-cursor-guard.mjs`
- `tools/execution-governance/install-secure-cursor-guard.mjs`
- `tools/execution-governance/activate-secure-cursor-guard.test.mjs`
- `tools/execution-governance/governance-hardening-red-team.mjs`
- `.vscode/settings.json`
- `.execution-governance/plans/cursor-protected-effect-governance-v1/lifecycle-record.json`
- `.execution-governance/plans/cursor-protected-effect-governance-v1/implementation-report.json`
- `docs/execution-governance/CURSOR_PROTECTED_EFFECT_GOVERNANCE_EVIDENCE.md`

## Command Evidence

| Command | Exit | Result |
| --- | ---: | --- |
| `node --test tools/execution-governance/activate-secure-cursor-guard.test.mjs` | 0 | PASS, 7 tests passed |
| `node tools/execution-governance/governance-hardening-red-team.mjs` | 0 | PASS, 21 cases passed |
| `node tools/execution-governance/install-secure-cursor-guard.mjs --dry-run` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs doctor` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs validate` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs validate --all-plans` | 0 | PASS with legacy disposition warnings only |
| `node tools/execution-governance/governance-cli.mjs validate --plan-dir .execution-governance/plans/cursor-protected-effect-governance-v1 --phase-id CPEG-PHASE-1` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs run-checks --plan-dir .execution-governance/plans/cursor-protected-effect-governance-v1 --phase-id CPEG-PHASE-1` | 0 | PASS |
| Elevated `node tools/execution-governance/install-secure-cursor-guard.mjs` | 0 | PASS |
| `node tools/execution-governance/install-secure-cursor-guard.mjs --verify` | 0 | PASS |
| Installed guard ordinary prompt smoke | 0 | PASS, allowed |
| Installed guard protected write smoke | 1 | PASS, denied while inactive |
| Installed guard outside shell smoke | 0 | PASS, allowed |
| `git diff --check` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs scope-check --plan-dir .execution-governance/plans/cursor-protected-effect-governance-v1 --phase-id CPEG-PHASE-1` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs postflight --plan-dir .execution-governance/plans/cursor-protected-effect-governance-v1 --phase-id CPEG-PHASE-1` | 1 | EXPECTED_RETRY_REQUIRED, implementation HEAD after plan-lock |
| `node tools/execution-governance/governance-cli.mjs postflight --plan-dir .execution-governance/plans/cursor-protected-effect-governance-v1 --phase-id CPEG-PHASE-1 --allow-implementation-head` | 0 | PASS |
| `git diff \| rg -i "(api[_-]?key\|password\|BEGIN .*PRIVATE\|supabase_service_role\|sk_live\|whsec)"` | 1 | PASS, no matches |

`validate --all-plans` retained historical legacy warnings for:

- `.execution-governance/plans/cursor-hook-bom-compatibility-hotfix-v1`
- `.execution-governance/plans/hosted-sandbox-environment-assurance-v1`
- `.execution-governance/plans/hosted-sandbox-verifier-setup-v1`

These are not new failures.

## Behavior Evidence

- `beforeSubmitPrompt` with `merhaba` and empty workspace returned `allow`.
- `beforeShellExecution` from `C:\Windows\Temp` with a non-MANU command returned `allow`.
- `preToolUse` attempting to write `C:\Users\Dell\OneDrive\Masaüstü\MANU-AI\AGENTS.md` while activation was `INACTIVE_FAIL_CLOSED` returned `deny`.
- Safe protected read-only shell commands such as `git status --short --branch` remain allowed without write activation.
- Cursor inline/Tab-style completion was disabled for this workspace through `.vscode/settings.json`.

## Residual Risk

This remains a hook-visible governance model. It is designed to govern Cursor hook-visible actions, not to provide OS-level isolation against a hostile independent process running under the same Windows user.
