# MANU-AI Plan-Implementation Assurance System Integration Plan

Date: 2026-08-24

Status: PHASE_3_CODEX_CURSOR_ADAPTERS_IMPLEMENTED_UNVERIFIED

Repository authority baseline:

- Local repository: `C:\Users\Dell\OneDrive\Masaüstü\MANU-AI`
- Expected branch: `codex/stage-4c-remediation`
- Expected upstream: `origin/codex/stage-4c-remediation`
- Phase 0 start HEAD: `f0f69a9dd52c5934cb2f8fb06208d6d4af25e799`
- Phase 0 start status: clean worktree, ahead 45, behind 0
- Product runtime scope: no product code, migration, schema, dependency, deployment, provider/channel egress, live billing, production gate, or real-data path changes.

## Objective

Integrate a model-independent plan-to-implementation assurance loop into MANU-AI. The system must make implementation plans machine-checkable, constrain the allowed change surface, preserve plan locks, distinguish executor checks from independent review, and keep the user as the final acceptance authority.

The first implementation target is MANU-AI. The core protocol must remain portable enough to later extract into another repository without carrying MANU-AI product assumptions.

## Non-Negotiable Decisions

- The user is the final acceptance authority.
- Every approved plan requires a separate plan-lock commit before implementation starts.
- Executor tests are mandatory when listed by the plan.
- Independent review is optional and starts only when the user explicitly requests it.
- The system must not ask whether to start independent review after each implementation phase.
- If no independent review is requested, the review state is `NOT_REQUESTED`.
- The same actor may plan and implement, but cannot claim independent review for its own implementation.
- If a reviewer fixes findings, that actor becomes an implementer for those changes.
- Cursor enforcement must block forbidden action immediately where project hooks can do so, and postflight verification must also check the final diff.
- Codex enforcement must rely on root instructions plus the same deterministic verifier CLI and postflight checks.
- No product runtime behavior changes are allowed by this integration unless a later user-approved product phase explicitly authorizes them.

## State Model

Plan state values:

- `PLAN_DRAFT`
- `PLAN_BLOCKED`
- `VERIFIER_SETUP_REQUIRED`
- `READY_FOR_IMPLEMENTATION`
- `LOCKED_FOR_IMPLEMENTATION`

Implementation state values:

- `NOT_STARTED`
- `IN_PROGRESS`
- `IMPLEMENTED_UNVERIFIED`
- `BLOCKED`
- `FAIL`
- `EXECUTOR_VERIFIED`

Executor checks values:

- `NOT_RUN`
- `PASS`
- `FAIL`
- `BLOCKED`
- `SKIPPED_WITH_REASON`

Independent review values:

- `NOT_REQUESTED`
- `REQUESTED`
- `IN_PROGRESS`
- `PASS`
- `FAIL`
- `BLOCKED`

User acceptance values:

- `PENDING`
- `ACCEPTED`
- `REJECTED`
- `WAIVED_BY_USER`

Only a protected automatic oracle or explicitly authorized manual reviewer may assign independent `PASS`. An implementer may report `IMPLEMENTED_UNVERIFIED` or `EXECUTOR_VERIFIED`, but that report is not independent review.

## Architecture

The governance system uses documentation as the human-readable contract and JSON as the machine authority.

Planned surfaces:

- Root `AGENTS.md`: concise repo-wide rules for Codex-compatible agents.
- `docs/execution-governance/EXECUTION_ASSURANCE_PROTOCOL.md`: portable protocol and role model.
- `docs/execution-governance/MANU_AI_PLAN_IMPLEMENTATION_ASSURANCE_INTEGRATION_PLAN.md`: this MANU-AI integration plan.
- `.execution-governance/`: versioned policy, schemas, templates, locked plan contracts, and ignored runtime artifacts.
- `tools/execution-governance/`: dependency-free Node.js verifier CLI.
- `.cursor/rules/execution-governance.mdc`: Cursor project rule.
- `.cursor/hooks.json` and `.cursor/hooks/governance-guard.mjs`: fail-closed Cursor action guard.
- `.github/workflows/execution-governance.yml`: clean checkout verification workflow, once explicitly authorized.

Planned locked contract files per approved implementation plan:

- `plan.md`
- `contract.json`
- `scope.json`
- `acceptance.json`
- `lock.json`

The lock must bind the plan hash, base commit, base tree, allowed paths, protected paths, acceptance commands, protected test inventory, artifact freshness policy, and status axes.

## Phase Plan

### Phase 0 - Authority And Baseline Lock

Purpose: establish the current repository baseline, persist this integration plan, reconcile existing authority text, and fix known historical/current wording contradictions before any enforcement code exists.

Allowed create paths:

- `docs/execution-governance/MANU_AI_PLAN_IMPLEMENTATION_ASSURANCE_INTEGRATION_PLAN.md`
- `docs/execution-governance/PHASE_0_AUTHORITY_AND_BASELINE_LOCK_EVIDENCE.md`

Allowed modify paths:

- `codex.md`
- `README.md`
- `PLAN.md`
- `PROJECT_PLAN.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `app/README.md`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`
- `docs/RISK_REGISTER.md`
- `docs/PHASE_85_STAGE_7_VISUAL_QA_POLISH_ACCESSIBILITY_CLOSURE_ACTION_PLAN.md`

Forbidden changes:

- Product code under `app/src/**`
- Supabase migrations or schema files
- Package manifests or lockfiles
- Existing test, fixture, visual baseline, or verification scripts
- Production readiness gate changes
- Push, merge, PR, deploy, or default branch changes

Completion criteria:

- Branch, upstream, HEAD, ahead/behind, and clean start state are recorded.
- This plan is persisted in `docs/execution-governance/`.
- `codex.md` no longer forces unrelated broad documentation rewrites; it points to scoped reconciliation and the governance protocol when active.
- Stage 7 action plan no longer states, in current tense, that Stage 7 requires Stage 7R before Stage 7.5 can begin after Stage 7 is already locally closed.
- Continuity documents mention that the governance integration has begun and that it does not alter Stage 7 closure or production `NO-GO`.
- `git diff --check` and `git status --short --branch` are run.
- The phase is not committed until the user separately approves the commit.

### Phase 1 - Core Protocol And Status Model

Create the portable protocol, role separation, status model, JSON schemas, templates, and waiver/review records. The protocol must preserve the rule that optional independent review is never auto-requested.

Phase 1 local implementation status, 2026-08-24: committed as `e6a2a8b`. Added `docs/execution-governance/EXECUTION_ASSURANCE_PROTOCOL.md`, machine-readable schemas under `.execution-governance/schemas/`, templates under `.execution-governance/templates/`, and governance policy under `.execution-governance/policy/governance-policy.json`. No CLI, hook, CI, product code, schema, migration, dependency, or production gate change is included in Phase 1.

### Phase 2 - Governance CLI And Deterministic Verifier

Build a dependency-free Node.js CLI under `tools/execution-governance/` with `doctor`, `validate`, `lock`, `preflight`, `scope-check`, `run-checks`, `postflight`, and `close`. Commands must use `spawn` with `shell: false`, normalized repository-relative paths, and explicit exit code handling.

Phase 2 local implementation status, 2026-08-24: committed as `e4de06a`. Added `tools/execution-governance/governance-cli.mjs` with the required command surface. Acceptance command execution uses `exactEvidenceCommandSpec` objects and `spawn` with `shell: false`; shell-expression executables are rejected. Runtime run records are written only under ignored `.execution-governance/runtime/`.

### Phase 3 - Codex And Cursor Adapters

Add root `AGENTS.md`, Cursor project rules, and fail-closed Cursor hooks. Hooks must block forbidden writes, unsafe shell commands, protected path edits, unauthorized dependency changes, and secret reads when an active locked plan does not allow them.

Phase 3 local implementation status, 2026-08-24: implemented-unverified. Added root `AGENTS.md`, `.cursor/rules/execution-governance.mdc`, `.cursor/hooks.json`, and `.cursor/hooks/governance-guard.mjs`. The Cursor guard blocks product writes without an active locked scope, blocks secret-like reads, blocks unsafe shell commands, and enforces active `scope.json` allow/protected path lists when present.

### Phase 4 - Lifecycle And Optional Review Flow

Implement plan lifecycle records and optional review handoff. The no-review path must remain valid as `independent_review: NOT_REQUESTED`; the system must not prompt for review unless the user explicitly asks for it.

### Phase 5 - Clean CI Verification

Add a read-only GitHub Actions workflow for clean checkout verification. It must verify plan hash, protected manifest integrity, test inventory, allowed diff, artifact freshness, and executor check results without using evidence Markdown as acceptance authority. Remote activation, branch protection, push, and default branch changes require separate explicit user commands.

### Phase 6 - Red-Team, Pilot, And Documentation Reconciliation

Exercise the governance system with synthetic tamper, stale artifact, forbidden diff, skip/only, shell-wrapper, hook-crash, no-review, full-review, and targeted-review scenarios. Reconcile the continuity docs based on real results only.

## Current Known Constraints

- There is no tracked root CI workflow at Phase 0 start.
- Existing app verifiers are same-repository writable scripts. They are useful executor checks, but not protected independent oracles yet.
- Cursor hook enforcement is not present at Phase 0 start.
- Root `AGENTS.md` is not present at Phase 0 start.
- The current repository uses Windows paths and Git settings with `core.ignorecase=true`, `core.symlinks=false`, `core.autocrlf=true`, and `core.filemode=false`; path normalization and integrity checks must account for those settings.

## Production Boundary

This governance integration does not change production readiness. Production remains `NO-GO`. The integration does not authorize push, merge, PR, deploy, production gate changes, provider/channel egress, live billing, production schema rollout, real health-data processing, or iOS production pilot/readiness claims.
