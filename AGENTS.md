# MANU-AI Agent Instructions

These repository instructions apply to Codex-compatible agents working from the MANU-AI repository root.

## Current Authority

- Current branch authority remains the local Git state.
- Production remains `NO-GO`.
- Do not push, merge, open PRs, deploy, change production gates, enable provider/channel egress, enable live billing, roll out production schema, or process real health data without an explicit user command.
- Stage 7 is locally `STAGE_7_CLOSED`; physical iPhone Safari/PWA remains `WAIVED_NOT_EXECUTED`, not PASS, and cannot support iOS production pilot/readiness claims.

## Governance Loop

- Read `docs/execution-governance/EXECUTION_ASSURANCE_PROTOCOL.md` before planning or implementing governed work.
- Use `docs/execution-governance/MANU_AI_PLAN_IMPLEMENTATION_ASSURANCE_INTEGRATION_PLAN.md` as the current governance integration plan.
- Approved implementation plans require a separate plan-lock commit before implementation starts.
- Cursor work must remain behind the admin-owned enterprise guard installed under `C:\ProgramData\Cursor\hooks.json` and `C:\ProgramData\MANU-AI-Governance\secure-cursor-guard.mjs`. Repo-local `.cursor` hooks are compatibility adapters only; they are not the trust root.
- Cursor implementation is allowed only after a locked plan is converted into external activation with `node tools/execution-governance/governance-cli.mjs activate-cursor --plan-dir <plan-dir> --phase-id <phase-id> --allow-implementation-head --apply`. Without this activation, Cursor must remain `INACTIVE_FAIL_CLOSED`.
- Before asking Cursor to implement a phase, verify the external guard with `node tools/execution-governance/install-secure-cursor-guard.mjs --verify` and run `node tools/execution-governance/governance-hardening-red-team.mjs`.
- Keep `plan_state`, `implementation_state`, `executor_checks`, `independent_review`, and `user_acceptance` separate.
- Independent review starts only when the user explicitly requests it. If not requested, record `independent_review: NOT_REQUESTED`; do not ask whether to start review.
- An implementer may report executor verification, but cannot claim independent review PASS for its own work.
- If a reviewer fixes findings, that actor becomes an implementer for those changes.
- Use lifecycle records from `docs/execution-governance/LIFECYCLE_AND_OPTIONAL_REVIEW_FLOW.md` when a governed plan is active.
- Do not create a review record unless the user explicitly requested independent review.
- Create a scope-change request before editing outside the active scope.
- Create a verifier-change request before changing acceptance or verifier behavior.

## Implementation Discipline

- Prefer exact, scoped changes over opportunistic refactors.
- Do not broaden allowed files, commands, dependencies, schemas, or network effects beyond the active plan contract.
- If the active plan does not allow a change, stop and create a scope-change request before editing.
- Use `node tools/execution-governance/governance-cli.mjs doctor` and `validate` when touching governance files.
- Treat `.github/workflows/execution-governance.yml` as the read-only clean CI layer. Do not add write permissions, secrets, deployment, package install/update, `pull_request_target`, branch protection, or production-gate behavior without explicit user-approved scope.
- For product app changes, run the tests required by the active plan. Do not count skipped, blocked, stale, or unrun checks as PASS.
- Do not commit runtime artifacts under `.execution-governance/runtime/`.
- Do not treat a Markdown plan, evidence note, or user approval as a Cursor write permission by itself. Cursor write permission is the intersection of the committed lock files, external activation scope, enterprise hook enforcement, and the current Git `HEAD`.

## Protected Boundaries

- Do not edit package manifests, lockfiles, migrations, verifier scripts, fixtures, baselines, hooks, CI, or production-readiness gate documents unless the active plan explicitly allows it.
- Do not log secrets, raw prompts, raw health data, file contents containing sensitive data, or real user/client data.
- Do not read `.env`, private keys, or secret files unless the active plan explicitly authorizes that read.
