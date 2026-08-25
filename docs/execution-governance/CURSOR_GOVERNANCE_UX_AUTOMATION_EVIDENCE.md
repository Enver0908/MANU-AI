# Cursor Governance UX Automation Evidence

Date: 2026-08-25

Branch: `codex/stage-4c-remediation`

Plan: `.execution-governance/plans/cursor-governance-ux-automation-v1`

Phase: `CGUX-PHASE-1`

Independent review: `NOT_REQUESTED`

Production impact: none. Production remains `NO-GO`.

## Implementation Summary

- Added ancestry-aware lock validation for implementation-head activation.
- Added a normal-user Cursor session command for status, preflight, activation, deactivation, and launch flow.
- Added an activation broker designed for ProgramData installation and atomic `activation.json` writes.
- Extended the secure Cursor installer to package the broker and launcher.
- Added automated tests and red-team coverage for selected-phase activation and non-ancestor denial.

## Command Evidence

All commands below were run on 2026-08-25 from `C:\Users\Dell\OneDrive\Masaüstü\MANU-AI`.

- `node --test tools/execution-governance/activate-secure-cursor-guard.test.mjs` -> exit 0, PASS, 4 tests passed.
- `node --test tools/execution-governance/cursor-session.test.mjs` -> exit 0, PASS, 3 tests passed, including installer desktop shortcut dry-run coverage.
- `node tools/execution-governance/governance-hardening-red-team.mjs` -> exit 0, PASS, including `deny-non-ancestor-implementation-head`.
- `node tools/execution-governance/governance-cli.mjs doctor` -> exit 0, PASS.
- `node tools/execution-governance/governance-cli.mjs validate` -> exit 0, PASS.
- `node tools/execution-governance/governance-cli.mjs validate --all-plans` -> exit 0, PASS with legacy `REAUTHOR_REQUIRED` warnings for historical packages.
- `node tools/execution-governance/install-secure-cursor-guard.mjs --dry-run` -> exit 0, PASS, including guard, broker, launcher, desktop shortcut, and hooks checks.
- `node tools/execution-governance/governance-cli.mjs cursor-session --session status` -> exit 0, PASS, activation remained `INACTIVE_FAIL_CLOSED`.
- `node tools/execution-governance/governance-cli.mjs run-checks --plan-dir .execution-governance/plans/cursor-governance-ux-automation-v1 --phase-id CGUX-PHASE-1` -> exit 0, PASS.
- `node tools/execution-governance/install-secure-cursor-guard.mjs` -> exit 1, BLOCKED by `EPERM` writing `C:\ProgramData\MANU-AI-Governance\secure-cursor-guard.mjs` without elevation.
- `node tools/execution-governance/install-secure-cursor-guard.mjs --verify` -> exit 1, BLOCKED until elevated install updates ProgramData; target broker and launcher are not installed and target guard SHA is stale.
- `node tools/execution-governance/governance-cli.mjs cursor-session --session preflight --plan-dir .execution-governance/plans/hosted-sandbox-remediation-v1-1 --phase-id PHASE-1` -> exit 0, `CHANGE_REQUEST_REQUIRED`, correctly reports missing PHASE-1 allowed modify paths.

## Residual Notes

- ProgramData installation can require an elevated installer run because the enterprise guard root is admin-owned.
- Hosted Sandbox Remediation v1.1 PHASE-1 scope defects are intentionally surfaced as `CHANGE_REQUEST_REQUIRED`; this plan does not edit the locked product remediation package.
