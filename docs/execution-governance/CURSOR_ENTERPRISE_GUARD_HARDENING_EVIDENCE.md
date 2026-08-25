# Cursor Enterprise Guard Hardening Evidence

Date: 2026-08-25

Status: `LOCAL_GOVERNANCE_HARDENING_IMPLEMENTED`

Production impact: none. This work does not push, merge, deploy, enable provider/channel egress, enable live billing, roll out production schema, change production gates, or process real health data. Production remains `NO-GO`.

## Implemented Controls

- Phase 0 established an admin-owned Cursor enterprise hook trust root under `C:\ProgramData\Cursor\hooks.json` and `C:\ProgramData\MANU-AI-Governance\secure-cursor-guard.mjs`.
- Phase 1 added `tools/execution-governance/activate-secure-cursor-guard.mjs` and `tools/execution-governance/activate-secure-cursor-guard.test.mjs` so a locked plan can be converted into external activation state or explicitly deactivated to fail-closed.
- Phase 2 added segment-aware wildcard path enforcement for `**` and `*` in `tools/execution-governance/secure-cursor-guard.mjs`.
- Phase 3 requires `ACTIVE_SIGNED_SCOPE` activation integrity before shell, MCP, subagent, and file-mutation decisions can allow work.
- Phase 4 tightened installer verification for exact hook event coverage, pinned Node execution, activation shape, owner, ACL, and guard SHA matching.
- Phase 5 exposed activation through `node tools/execution-governance/governance-cli.mjs activate-cursor`.
- Phase 6 reconciled agent instructions and risk documentation.

## Verification

- `node --test tools/execution-governance/activate-secure-cursor-guard.test.mjs`: PASS, 2/2.
- `node tools/execution-governance/governance-hardening-red-team.mjs`: PASS, 12/12.
- `node tools/execution-governance/governance-cli.mjs doctor`: PASS.
- `node tools/execution-governance/governance-cli.mjs validate`: PASS, 24 files.
- `git diff --check`: PASS for committed governance changes.

## Known Residuals

- External ProgramData sync requires elevated Windows permission. Non-elevated install correctly fails with `EPERM`, proving the guard root is not user-writable.
- `node tools/execution-governance/install-secure-cursor-guard.mjs --verify` reports source/target SHA mismatch until the elevated installer copies the latest committed `secure-cursor-guard.mjs` into `C:\ProgramData\MANU-AI-Governance`.
- Existing uncommitted changes in `app/src/lib/hosted-sandbox-runtime-fixes.test.ts`, `docs/execution-governance/HOSTED_SANDBOX_PHASE_2_RUNTIME_FIXES_EVIDENCE.md`, and `.execution-governance/active/` were not created or staged by this hardening sequence.
