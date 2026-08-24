# Cursor Hook BOM Compatibility Hotfix Evidence

Date: 2026-08-25

Branch: `codex/stage-4c-remediation`

Plan package: `.execution-governance/plans/cursor-hook-bom-compatibility-hotfix-v1/`

Plan-lock commit: `de50be8 governance: lock cursor hook bom compatibility hotfix`

## Scope

This hotfix changes only the Cursor governance hook parser and its red-team regression coverage.

Changed implementation surfaces:

- `.cursor/hooks/governance-guard.mjs`
- `tools/execution-governance/red-team-harness.mjs`

Changed documentation and lifecycle surfaces:

- `docs/execution-governance/CURSOR_HOOK_BOM_COMPATIBILITY_HOTFIX_EVIDENCE.md`
- `docs/RISK_REGISTER.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `.execution-governance/plans/cursor-hook-bom-compatibility-hotfix-v1/lifecycle-record.json`
- `.execution-governance/plans/cursor-hook-bom-compatibility-hotfix-v1/implementation-report.json`

No product code, UI code, API route, migration, package manifest, lockfile, provider/channel integration, Supabase remote state, VPS state, deployment, push, merge, branch protection, production gate, live billing, or real health-data path changed.

## Implementation

`.cursor/hooks/governance-guard.mjs` now parses JSON through one helper:

- `parseJsonText(value)` converts the value to string.
- It removes exactly one leading `U+FEFF` when that byte-order mark is the first character.
- It then calls `JSON.parse()`.
- `readStdinJson()` uses the helper for Cursor hook stdin payloads.
- `loadActiveScope()` uses the helper for `.execution-governance/active/scope.json`.

The helper does not sanitize arbitrary JSON content and does not strip BOM characters outside index `0`.

`tools/execution-governance/red-team-harness.mjs` now includes BOM regression scenarios covering:

- `CHBOM-001-BOM-STDIN-ALLOW`
- `CHBOM-001-BOM-SAFE-SHELL-ALLOW`
- `CHBOM-001-MALFORMED-DENY`
- `CHBOM-002-BOM-ACTIVE-SCOPE-ALLOW`
- `CHBOM-002-BOM-ACTIVE-SCOPE-PROTECTED-DENY`
- `CHBOM-002-BOM-ACTIVE-SCOPE-OUTSIDE-DENY`
- `CHBOM-003-BOM-SECRET-READ-DENY`
- `CHBOM-003-BOM-UNSAFE-SHELL-DENY`
- `CHBOM-003-BOM-PRODUCT-WRITE-DENY`

## Verification

Commands run from repository root:

| Command | Exit | Result |
| --- | ---: | --- |
| `node tools/execution-governance/red-team-harness.mjs` | 0 | PASS, `PHASE6_RED_TEAM_SUMMARY total=24 passed=24 failed=0` |
| `node tools/execution-governance/governance-cli.mjs run-checks --plan-dir .execution-governance/plans/cursor-hook-bom-compatibility-hotfix-v1` | 0 | PASS, latest run record `.execution-governance/runtime/run-records/run-2026-08-24T23-29-54-819Z-24936.json` |
| `node tools/execution-governance/governance-cli.mjs doctor` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs validate` | 0 | PASS, 24 files |
| `node tools/execution-governance/governance-cli.mjs scope-check --plan-dir .execution-governance/plans/cursor-hook-bom-compatibility-hotfix-v1` | 0 | PASS, 7 changed paths after documentation reconciliation |
| `git diff --check` | 0 | PASS |
| `node tools/execution-governance/governance-cli.mjs postflight --plan-dir .execution-governance/plans/cursor-hook-bom-compatibility-hotfix-v1` | 1 | Scope-check PASS with 7 changed paths; FAIL only because `lock.json` baseCommit is `f069f5250c1d1669a18fea58ab7a94568532a2e3` and current HEAD after the plan-lock commit is `de50be880d2cbce53aa4ac23582fe69830e28cce` |

## Governance Note

The postflight failure is a lock self-reference limitation in the current governance CLI flow: the generated `lock.json` binds `baseCommit` to the commit before the plan-lock commit, while commit-time execution naturally moves `HEAD` to the plan-lock commit. This hotfix does not modify `tools/execution-governance/governance-cli.mjs` because that file is protected and not in this plan scope.

The Cursor BOM compatibility issue is resolved in the current worktree by the hook parser and red-team regression coverage. The implementation commit should include only the allowed files listed by the plan.

## Residual Risks

- Remote CI evidence remains unavailable until the branch is pushed and GitHub Actions runs under separately approved scope.
- The governance CLI plan-lock self-reference behavior remains open for a separate governance maintenance plan.
- Production remains `NO-GO`.
- Physical iPhone Safari/PWA validation remains `WAIVED_NOT_EXECUTED`, not PASS.
