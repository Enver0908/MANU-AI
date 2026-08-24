# Lifecycle And Optional Review Flow

Version: 1.0.0

Status: PHASE_4_LIFECYCLE_OPTIONAL_REVIEW_IMPLEMENTED_UNVERIFIED

Authority:

- `docs/execution-governance/EXECUTION_ASSURANCE_PROTOCOL.md`
- `docs/execution-governance/MANU_AI_PLAN_IMPLEMENTATION_ASSURANCE_INTEGRATION_PLAN.md`

## 1. Purpose

This document defines how a governed plan moves from planning to implementation, executor checks, optional independent review, user acceptance, and commit.

The flow is intentionally model-independent. Codex, Cursor, another LLM, or a human implementer can use the same records.

## 2. Required Record Types

Each governed plan may create records under its plan directory:

- `lifecycle-record.json`
- `implementation-report.json`
- `review-record.json`, only when the user explicitly requests independent review
- `scope-change-request.json`, only when implementation needs scope expansion
- `verifier-change-request.json`, only when acceptance or verifier behavior must change
- `waiver-record.json`, only when the user explicitly approves a waiver

Runtime records may be generated under ignored `.execution-governance/runtime/`. Runtime records are evidence inputs, not tracked authority by themselves.

## 3. Planning Flow

1. Planner reads the authority documents and current Git state.
2. Planner creates `plan.md`, `contract.json`, `scope.json`, and `acceptance.json`.
3. If a protected verifier is missing for a required automated oracle, plan state is `VERIFIER_SETUP_REQUIRED`.
4. If a user decision is missing, plan state is `PLAN_BLOCKED`.
5. If the plan is complete and implementation can start after lock, plan state is `READY_FOR_IMPLEMENTATION`.
6. User approves the plan.
7. Planner or authorized operator runs the lock step and creates `lock.json`.
8. Plan-lock commit is created separately.
9. After the plan-lock commit, plan state is `LOCKED_FOR_IMPLEMENTATION`.

Implementation cannot start before the separate plan-lock commit.

## 4. Implementation Flow

1. Implementer verifies the active `lock.json`.
2. Implementer verifies that the worktree base matches the lock.
3. Implementer selects only requirements whose dependencies are satisfied.
4. Implementer edits only paths allowed by `scope.json`.
5. Implementer stops before any scope-external edit and creates `scope-change-request.json`.
6. Implementer stops before changing acceptance behavior and creates `verifier-change-request.json`.
7. Implementer runs required executor checks.
8. Implementer records actual files changed, commands run, exit codes, artifacts, skipped checks, blocked checks, and residual risks in `implementation-report.json`.
9. Implementer may set implementation state to `IMPLEMENTED_UNVERIFIED` or `EXECUTOR_VERIFIED`.
10. Implementer cannot set independent review to `PASS`.

## 5. Optional Independent Review Flow

Independent review is not automatic.

If the user does not explicitly request review:

- `independent_review` remains `NOT_REQUESTED`.
- No review record is created.
- The system does not ask whether to review.
- Commit may proceed if executor checks, scope checks, documentation reconciliation, and user acceptance allow it.

If the user explicitly requests review:

1. A `review-record.json` is created with `requestedByUser: true`.
2. Review scope is `FULL_PLAN_COMPLIANCE` unless the user explicitly asks for `TARGETED_CORRECTED_ITEMS`.
3. Reviewer inspects without modifying implementation.
4. Reviewer records findings and result.
5. If reviewer edits files to fix findings, the reviewer becomes an implementer and the review result cannot be independent PASS.
6. A new independent review may occur only if the user explicitly requests it again.

## 6. Targeted Revalidation Rule

When the user asks to recheck only corrected items, the verifier/reviewer must include:

- Corrected requirements
- Dependencies of corrected requirements
- Shared contract or verifier surfaces touched by the correction
- Required regression checks named by the acceptance manifest
- Any manually approved waiver or scope change touched by the correction

If verifier configuration, shared fixtures, protected schemas, hooks, CI, or common runtime contracts changed, targeted review is invalid and full plan compliance review is required.

## 7. Commit Flow

Before a phase commit:

1. Scope check passes or all deviations have approved scope-change records.
2. Required executor checks are recorded with raw exit codes.
3. Skipped, blocked, stale, or unrun checks are not represented as PASS.
4. Independent review is either `NOT_REQUESTED` or has a valid user-requested review record.
5. User acceptance is explicit for the phase.
6. Documentation reconciliation matches the real state.
7. Runtime artifacts are ignored or removed.
8. `git diff --check` passes.
9. Secret/sensitive-data scan has no real secret or real user/client data.
10. Commit is created only after the user gives a separate commit command.

## 8. Invalid Closure States

The following states cannot close a phase:

- `independent_review: REQUESTED` without completed review result
- `independent_review: IN_PROGRESS`
- `executor_checks: NOT_RUN`
- `executor_checks: FAIL`
- `executor_checks: BLOCKED`
- `executor_checks: SKIPPED_WITH_REASON` unless user accepted the skip as a waiver
- Scope-external diffs without approved scope change
- Verifier behavior changes without approved verifier change
- Missing user acceptance

## 9. Phase 4 Boundary

Phase 4 installs lifecycle and optional review records only. It does not install GitHub Actions, product runtime changes, package dependencies, migrations, production gate changes, or deployment behavior.
