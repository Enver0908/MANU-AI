# Clean CI Verification Layer

Version: 1.0.0

Status: PHASE_6_RED_TEAM_PILOT_CLOSURE_COMMITTED_LOCAL

Authority:

- `docs/execution-governance/EXECUTION_ASSURANCE_PROTOCOL.md`
- `docs/execution-governance/MANU_AI_PLAN_IMPLEMENTATION_ASSURANCE_INTEGRATION_PLAN.md`

## 1. Purpose

The clean CI layer provides a repository-clean verification point for the governance system. It checks the committed repository state in GitHub Actions without changing product runtime behavior, production gates, dependencies, migrations, or deployment settings.

## 2. Workflow

Tracked workflow:

- `.github/workflows/execution-governance.yml`

Events:

- `pull_request`
- `workflow_dispatch`

Forbidden event:

- `pull_request_target`

Permissions:

- `contents: read`

No write permissions are required or granted.

## 3. Security Boundary

The workflow:

- Uses a clean GitHub-hosted checkout.
- Uses `actions/checkout` with `fetch-depth: 0` and `persist-credentials: false`.
- Uses Node.js 22.
- Runs the dependency-free governance CLI without installing project dependencies.
- Does not read secrets.
- Does not run deploy commands.
- Does not run package install/update commands.
- Does not push, merge, create PRs, or change production gates.
- Does not run product tests unless a later user-approved governance phase explicitly adds that scope.

## 4. Checks

The workflow runs:

- `node tools/execution-governance/governance-cli.mjs doctor`
- `node tools/execution-governance/governance-cli.mjs validate`
- `node tools/execution-governance/governance-cli.mjs validate --plan-dir .execution-governance/templates`
- Workflow hardening marker check
- `node tools/execution-governance/red-team-harness.mjs`
- `git diff --check`
- Tracked runtime artifact check for `.execution-governance/runtime/**`

## 5. Activation Boundary

Adding this workflow defines the clean CI layer in the repository. It does not push the branch, change the GitHub default branch, enable branch protection, open a PR, merge code, deploy code, or alter production readiness.

Remote execution starts only after the branch containing this workflow is pushed or the workflow is otherwise available on GitHub. Push remains a separate explicit user command.

## 6. Phase 6 Red-Team Boundary

Phase 6 extends the workflow with the dependency-free red-team harness in `tools/execution-governance/red-team-harness.mjs`. The harness exercises synthetic hook denials, active scope enforcement, shell-wrapper rejection, locked-plan tamper rejection, stale run-record rejection, forbidden diff rejection, skip/only rejection, positive no-review close, full-review template boundaries, targeted-review schema boundaries, workflow hardening, and tracked runtime artifact checks.

The red-team harness uses synthetic ignored runtime fixtures only. It does not install dependencies, run product code, create production artifacts, read secrets, push, merge, deploy, alter branch protection, change production gates, connect provider/channel egress, perform live billing, roll out production schema, or process real health data.

## 7. Phase 5 Boundary

Phase 5 installs the clean CI workflow and documentation only. It does not add product runtime behavior, dependencies, migrations, production schema rollout, provider/channel egress, live billing, deployment, branch protection, or production readiness changes.
