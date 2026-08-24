# Execution Assurance Protocol

Version: 1.0.0

Status: PHASE_6_RED_TEAM_PILOT_CLOSURE_COMMITTED_LOCAL

Authority: `docs/execution-governance/MANU_AI_PLAN_IMPLEMENTATION_ASSURANCE_INTEGRATION_PLAN.md`

## 1. Purpose

This protocol defines the model-independent loop for planning, implementing, verifying, optionally reviewing, and accepting work in MANU-AI. It applies to Codex, Cursor, another LLM, or a human implementer whenever a plan is locked under `.execution-governance/`.

The protocol does not change product runtime behavior. It defines how future work is authorized and evaluated.

## 2. Role Separation

Requirement authority:

- The user and explicitly named authority documents.
- Owns product decisions, waivers, scope expansion, and final acceptance.

Planner:

- Produces the plan, requirement ledger, scope manifest, acceptance manifest, and lock proposal.
- May later implement the plan, but cannot independently review its own implementation.

Implementer:

- Applies only requirements whose dependencies are satisfied.
- Works only inside the allowed scope manifest.
- Runs required executor checks.
- May report `IMPLEMENTED_UNVERIFIED` or `EXECUTOR_VERIFIED`.
- Cannot assign independent `PASS`, cannot waive requirements, and cannot broaden scope.

Automatic verifier:

- Runs protected deterministic checks once Phase 2 and later phases install them.
- Reads machine manifests instead of trusting evidence prose.
- May assign automated `PASS`, `FAIL`, or `BLOCKED` only for checks it actually executed.

Independent reviewer:

- Has no authority to modify the implementation being reviewed.
- Starts only when the user explicitly requests review.
- If the reviewer fixes findings, the reviewer becomes an implementer for those changes.

Manual reviewer:

- A named human role authorized by the plan or user for manual product, clinical, visual, accessibility, device, legal, or operational judgment.

Final acceptance authority:

- The user.
- May accept, reject, or explicitly waive a requirement with a versioned waiver record.

## 3. State Axes

The system keeps five independent state axes. A `PASS` on one axis does not imply `PASS` on another.

Plan state:

- `PLAN_DRAFT`: plan is being prepared and cannot be implemented.
- `PLAN_BLOCKED`: a decision or prerequisite is missing.
- `VERIFIER_SETUP_REQUIRED`: implementation cannot start because required protected verifier surfaces do not exist.
- `READY_FOR_IMPLEMENTATION`: plan is complete, but not locked by commit.
- `LOCKED_FOR_IMPLEMENTATION`: plan hash and lock files are committed as a separate plan-lock commit.

Implementation state:

- `NOT_STARTED`: no implementation work has begun.
- `IN_PROGRESS`: implementation work is active.
- `IMPLEMENTED_UNVERIFIED`: implementer reports changes complete, but required executor checks are incomplete or not passing.
- `BLOCKED`: implementation cannot proceed without a decision or external condition.
- `FAIL`: implementation was checked and did not meet the contract.
- `EXECUTOR_VERIFIED`: implementer ran required executor checks and they passed for the recorded scope.

Executor checks:

- `NOT_RUN`: required command or manual executor check was not attempted.
- `PASS`: command/check ran and met its expected assertions.
- `FAIL`: command/check ran and failed.
- `BLOCKED`: command/check could not run because of environment or missing prerequisite.
- `SKIPPED_WITH_REASON`: skip was explicitly authorized by the plan or user and cannot be treated as PASS.

Independent review:

- `NOT_REQUESTED`: the user has not requested independent review.
- `REQUESTED`: the user explicitly requested independent review.
- `IN_PROGRESS`: reviewer is inspecting without modifying implementation.
- `PASS`: authorized reviewer or protected oracle found no blocking findings for its scope.
- `FAIL`: authorized reviewer found blocking findings.
- `BLOCKED`: review could not be completed.

User acceptance:

- `PENDING`: user has not accepted, rejected, or waived.
- `ACCEPTED`: user accepted the implementation or phase.
- `REJECTED`: user rejected the implementation or phase.
- `WAIVED_BY_USER`: user accepted an explicitly recorded waiver.

## 4. Review Rule

Independent review is optional. The system must not ask whether to run independent review after a phase.

If the user does not explicitly request review:

- `independent_review` remains `NOT_REQUESTED`.
- The implementation can still be committed when executor checks and user acceptance allow it.
- No text may imply independent review happened.

If the user asks `review`, `audit`, `plan compliance review`, or equivalent:

- Review scope defaults to full plan compliance for the current phase.
- If the user says `only corrected items`, review scope is limited to corrected requirements, their dependencies, shared verifier surfaces, and required regression checks.

## 5. Scope Change Rule

An implementer must stop before making any change outside the active `scope.json`.

The implementer must create a scope change request record containing:

- `request_id`
- `reason`
- `affected_requirement_ids`
- `requested_create_paths`
- `requested_modify_paths`
- `requested_commands`
- `architecture_impact`
- `security_privacy_impact`
- `required_tests`
- `rollback_impact`
- `plan_version_change`

No scope expansion is valid until the user approves it and the plan lock is regenerated.

## 6. Waiver Rule

A waiver is valid only when recorded in a waiver record and approved by the user.

A waiver must state:

- Requirement ID
- Original requirement
- Waived scope
- Reason
- Authority
- Date
- Expiration or permanence
- Residual risk
- Replacement verification, if any

Absence of evidence is never a waiver.

## 7. Evidence Rule

Evidence prose is not acceptance authority. Evidence documents may summarize results, but the authority for automated checks is the command result or protected verifier artifact named by the acceptance manifest.

Invalid equivalences:

- File exists is not behavior proven.
- Build passes is not scenario correctness.
- Screenshot exists is not visual comparison.
- Report says PASS is not protected oracle PASS.
- Old artifact is not a fresh run.
- Local PASS is not clean CI PASS.
- Skipped check is not PASS.
- Implementer summary is not independent review.

## 8. Machine Authority Files

Every locked plan must include:

- `contract.json`: identity, authority, requirement ledger, states, and role bindings.
- `scope.json`: exact allowed and protected change surfaces.
- `acceptance.json`: exact automated/manual/hybrid acceptance records.
- `lock.json`: hashes, base commit/tree, protected manifest, artifact freshness policy, and commit binding.

Markdown files are explanatory. JSON files are the machine authority.

## 9. Phase 1 Boundary

Phase 1 installs this protocol, schemas, and templates only. It does not install enforcement hooks, verifier CLI commands, or CI. Until later phases complete, the protocol is authoritative but not technically enforced.

## 10. Lifecycle Records

Governed plans use lifecycle records to prevent state axes from collapsing into one another.

Required tracked records when applicable:

- `lifecycle-record.json`: current phase, status axes, events, and independent review policy.
- `implementation-report.json`: implementer-reported changed files, commands, artifacts, skipped or blocked checks, and residual risks.
- `scope-change-request.json`: required before any scope expansion.
- `verifier-change-request.json`: required before acceptance or verifier behavior changes.
- `review-record.json`: created only when the user explicitly requests independent review.
- `waiver-record.json`: created only when the user explicitly approves a waiver.

The no-review path creates no review record and keeps `independent_review: NOT_REQUESTED`.

See `docs/execution-governance/LIFECYCLE_AND_OPTIONAL_REVIEW_FLOW.md` for the full flow.

## 11. Clean CI Layer

The clean CI layer is defined in `docs/execution-governance/CLEAN_CI_VERIFICATION_LAYER.md` and `.github/workflows/execution-governance.yml`.

The workflow is read-only:

- `permissions: contents: read`
- `pull_request` and `workflow_dispatch` only
- no `pull_request_target`
- no dependency installation
- no secrets
- no deploy, push, merge, PR, production gate, provider/channel egress, live billing, production schema rollout, or real-data processing

CI output is an automated executor check only. It does not replace user acceptance and does not create independent review unless the user explicitly requested review through the lifecycle protocol.

## 12. Red-Team And Pilot Closure

The Phase 6 red-team harness is `tools/execution-governance/red-team-harness.mjs`.

The harness is a dependency-free executor verification surface for the governance system itself. It must cover:

- Cursor hook denial for product writes without an active locked scope.
- Governance bootstrap write allowance without an active locked scope.
- Fail-closed hook behavior for malformed hook payloads.
- Secret-like read denial.
- Unsafe shell denial and safe status command allowance.
- Active scope allow/protected/outside-path enforcement.
- Shell-wrapper executable rejection in acceptance manifests.
- Locked plan hash tamper rejection.
- Stale run-record artifact rejection.
- Forbidden diff rejection.
- Changed test skip/only marker rejection.
- Positive synthetic pilot close with `independent_review: NOT_REQUESTED`.
- Full-plan review template boundaries.
- Targeted corrected-item review schema boundaries.
- Clean CI workflow hardening.
- Runtime artifact non-tracking.

Postflight must reject automated requirements that lack a fresh `PASS` run-record bound to the current `HEAD`. Postflight must also reject changed test/spec files that introduce `.only`, `.skip`, or `skip: true` markers. Evidence Markdown remains non-authoritative.
