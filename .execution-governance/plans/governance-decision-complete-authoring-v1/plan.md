# Governance Decision-Complete Authoring Assurance Plan

Plan version: 1.0.0

Plan state: READY_FOR_IMPLEMENTATION

Contract ID: governance-decision-complete-authoring-v1

Final acceptance authority: user

Independent review default: NOT_REQUESTED

<!-- GOV-PHASE id="GOV-DCPA-1" title="Decision-Complete Governance Authoring Enforcement" -->

## Authority Sources

- User approval in the current Codex task to implement the single-phase plan that closes the identified governance plan-authoring gaps.
- `AGENTS.md`
- `codex.md`
- `docs/execution-governance/EXECUTION_ASSURANCE_PROTOCOL.md`
- `docs/execution-governance/LIFECYCLE_AND_OPTIONAL_REVIEW_FLOW.md`
- Current Git state on `codex/stage-4c-remediation`

## Problem Statement

The current governance system can hash and guard a plan package, but it does not prove that the package is decision-complete. A compact or incomplete plan can be locked, and a later implementer can make technical decisions that should have been fixed by the plan author. The current CLI also accepts missing plan files when `--plan-dir` is used, does not perform full schema validation, does not verify one-to-one coverage between contract, scope, and acceptance records, does not semantically validate `plan.md`, and can activate Cursor with all scope records instead of the selected phase only.

## Scope Summary

In scope:

- Add a written decision-complete authoring standard.
- Expand governance templates so future plans must contain detailed per-phase implementation authority.
- Add dependency-free JSON Schema validation for the governance schema subset already used in this repository.
- Add semantic plan-package validation that rejects incomplete requirement coverage, vague language, missing phase sections, missing requirement anchors, placeholders, and missing files.
- Wire strict validation into `governance-cli.mjs`, lock, preflight, postflight, close, and Cursor activation.
- Make Cursor activation phase-specific.
- Record legacy active/reopenable plan disposition so older incomplete plan packages cannot be treated as lockable implementation authority.
- Add tests and red-team cases proving the new failure modes.
- Reconcile governance docs, root agent instructions, Cursor rules, handoff, and risk register only where the authority changes.

Out of scope:

- Product runtime changes under `app/src/**`, `dietitian-ai-assistant/**`, or Supabase migrations.
- Any push, deploy, PR, production gate, live billing, provider/channel egress, production schema rollout, or real health data operation.
- Reopening Stage 5, Stage 6, or Stage 7.
- Changing the iPhone physical-device waiver from `WAIVED_NOT_EXECUTED`.
- Treating independent review as requested.

Blocked decisions:

- None for this phase. Production, remote CI, branch protection, Supabase, VPS, and hosted activation remain outside this phase.

## Requirement Ledger

| Requirement ID | Classification | Observable requirement | Dependencies |
| --- | --- | --- | --- |
| DCPA-001 | IN_SCOPE | A canonical written standard defines decision-complete governed plan authoring and states that hash/scope enforcement is not sufficient when plan content leaves implementation decisions open. | [] |
| DCPA-002 | IN_SCOPE | `.execution-governance/templates/plan.md` contains mandatory detailed phase sections and machine-readable anchors that future plan packages must follow. | [DCPA-001] |
| DCPA-003 | IN_SCOPE | Agent-facing instructions distinguish brief execution checklists from governed implementation plans and require decision-complete governed plans. | [DCPA-001] |
| DCPA-004 | IN_SCOPE | `governance-cli validate --plan-dir <dir>` fails when any required plan file is missing or any authority JSON fails its schema. | [] |
| DCPA-005 | IN_SCOPE | Validation rejects contract/scope/acceptance mismatches, including the hosted sandbox 30 contract requirements, 2 scope records, and 12 acceptance records pattern. | [DCPA-004] |
| DCPA-006 | IN_SCOPE | Validation rejects vague plan text, placeholder text, missing required sections, and requirements lacking `GOV-REQ` anchors in `plan.md`. | [DCPA-001, DCPA-004] |
| DCPA-007 | IN_SCOPE | Lock, preflight, postflight, close, and activate-cursor refuse packages that fail strict plan validation. | [DCPA-004, DCPA-005, DCPA-006] |
| DCPA-008 | IN_SCOPE | Cursor activation includes only scope records for the selected phase and refuses activation without a valid phase id and a non-empty lock commit or base commit. | [DCPA-004] |
| DCPA-009 | IN_SCOPE | Existing active/reopenable legacy plan packages are classified as requiring reauthoring before they can be locked or activated. | [DCPA-001, DCPA-004] |
| DCPA-010 | IN_SCOPE | Automated tests and red-team checks prove missing-file, schema, mismatch, vague-plan, phase-scope, and legacy-plan rejection. | [DCPA-004, DCPA-005, DCPA-006, DCPA-008, DCPA-009] |
| DCPA-011 | IN_SCOPE | Governance evidence records exact commands, exit codes, changed files, residual risks, and the fact that no production/app/deploy side effect occurred. | [DCPA-010] |
| DCPA-012 | IN_SCOPE | Handoff and risk docs state the new governance authoring authority without changing product readiness claims. | [DCPA-001, DCPA-011] |

## Phase GOV-DCPA-1 Purpose

Install a single, enforceable governance authoring layer that prevents a future compact or incomplete plan from being locked, activated in Cursor, or closed as implementation authority. The phase changes governance authoring and verifier surfaces only.

## Phase GOV-DCPA-1 Scope

Allowed create paths:

- `docs/execution-governance/DECISION_COMPLETE_PLAN_AUTHORING_STANDARD.md`
- `docs/execution-governance/GOVERNANCE_DECISION_COMPLETE_AUTHORING_EVIDENCE.md`
- `.execution-governance/policy/legacy-plan-disposition.json`
- `.execution-governance/plans/governance-decision-complete-authoring-v1/plan.md`
- `.execution-governance/plans/governance-decision-complete-authoring-v1/contract.json`
- `.execution-governance/plans/governance-decision-complete-authoring-v1/scope.json`
- `.execution-governance/plans/governance-decision-complete-authoring-v1/acceptance.json`
- `.execution-governance/plans/governance-decision-complete-authoring-v1/lock.json`
- `.execution-governance/plans/governance-decision-complete-authoring-v1/lifecycle-record.json`
- `.execution-governance/plans/governance-decision-complete-authoring-v1/implementation-report.json`
- `tools/execution-governance/lib/json-schema-validator.mjs`
- `tools/execution-governance/lib/plan-package-validator.mjs`
- `tools/execution-governance/governance-plan-quality.test.mjs`

Allowed modify paths:

- `AGENTS.md`
- `codex.md`
- `.cursor/rules/execution-governance.mdc`
- `.execution-governance/templates/plan.md`
- `.execution-governance/templates/contract.json`
- `.execution-governance/templates/scope.json`
- `.execution-governance/templates/acceptance.json`
- `.execution-governance/schemas/contract.schema.json`
- `.execution-governance/schemas/scope.schema.json`
- `.execution-governance/schemas/acceptance.schema.json`
- `.execution-governance/schemas/lock.schema.json`
- `docs/execution-governance/EXECUTION_ASSURANCE_PROTOCOL.md`
- `docs/execution-governance/MANU_AI_PLAN_IMPLEMENTATION_ASSURANCE_INTEGRATION_PLAN.md`
- `docs/execution-governance/LIFECYCLE_AND_OPTIONAL_REVIEW_FLOW.md`
- `tools/execution-governance/governance-cli.mjs`
- `tools/execution-governance/activate-secure-cursor-guard.mjs`
- `tools/execution-governance/governance-hardening-red-team.mjs`
- `tools/execution-governance/activate-secure-cursor-guard.test.mjs`
- `.github/workflows/execution-governance.yml`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `docs/RISK_REGISTER.md`

Protected paths:

- `app/**`
- `dietitian-ai-assistant/**`
- `app/supabase/migrations/**`
- `package.json`
- `app/package.json`
- `app/package-lock.json`
- `.execution-governance/runtime/**`
- `docs/PILOT_READINESS_EVIDENCE_PACK.md`
- `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`
- `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md`

## Phase GOV-DCPA-1 Preconditions

1. `git branch --show-current` returns `codex/stage-4c-remediation`.
2. `git status --short --branch` shows no tracked or untracked changes before the plan package is created.
3. `node tools/execution-governance/governance-cli.mjs doctor` exits 0.
4. `node tools/execution-governance/governance-cli.mjs validate` exits 0 before the implementation starts.
5. The plan package is committed and locked before enforcement implementation edits start.

## Phase GOV-DCPA-1 Affected Components And Files

Governance authoring authority:

- `docs/execution-governance/DECISION_COMPLETE_PLAN_AUTHORING_STANDARD.md`
- `AGENTS.md`
- `codex.md`
- `.cursor/rules/execution-governance.mdc`

Machine contract, schema, and templates:

- `.execution-governance/templates/plan.md`
- `.execution-governance/templates/contract.json`
- `.execution-governance/templates/scope.json`
- `.execution-governance/templates/acceptance.json`
- `.execution-governance/schemas/contract.schema.json`
- `.execution-governance/schemas/scope.schema.json`
- `.execution-governance/schemas/acceptance.schema.json`
- `.execution-governance/schemas/lock.schema.json`
- `.execution-governance/policy/legacy-plan-disposition.json`

Verifier and activation code:

- `tools/execution-governance/lib/json-schema-validator.mjs`
- `tools/execution-governance/lib/plan-package-validator.mjs`
- `tools/execution-governance/governance-cli.mjs`
- `tools/execution-governance/activate-secure-cursor-guard.mjs`

Verification:

- `tools/execution-governance/governance-plan-quality.test.mjs`
- `tools/execution-governance/activate-secure-cursor-guard.test.mjs`
- `tools/execution-governance/governance-hardening-red-team.mjs`
- `.github/workflows/execution-governance.yml`

Continuity:

- `docs/execution-governance/GOVERNANCE_DECISION_COMPLETE_AUTHORING_EVIDENCE.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `docs/RISK_REGISTER.md`

## Phase GOV-DCPA-1 Architectural Decisions

1. The canonical human technical authority for governed implementation is a detailed `plan.md`, not a compact checklist and not a separate hidden spec.
2. JSON files remain machine authority for identity, requirements, exact scope, acceptance, and lock hashes.
3. The validator uses deterministic structural checks instead of raw word-count gates. A long vague document fails; a shorter but complete and anchored document can pass.
4. Plan semantic validation is marker-based. Every executable phase must have `<!-- GOV-PHASE id="..." -->`; every in-scope requirement must have `<!-- GOV-REQ id="..." -->`; ordered implementation steps use `<!-- GOV-STEP id="..." -->`.
5. The dependency-free JSON Schema validator supports only the schema subset used by this repository. Unsupported schema keywords fail closed so future schema authors cannot think a keyword is enforced when it is ignored.
6. Legacy packages stay readable as history, but any non-closed legacy package listed in the disposition registry must be reauthored before lock or activation.
7. Cursor activation is phase-specific. The selected `phaseId` filters scope and acceptance records; all-phase activation is forbidden for implementation.
8. `lockCommit` remains generated by Git and can be empty only at lock-file creation time before the separate lock commit exists. Activation refuses a package where both `lockCommit` and `baseCommit` are missing or malformed.

## Phase GOV-DCPA-1 Rejected Alternatives

1. Reject a minimum word-count rule because it rewards verbosity and still permits ambiguous decisions.
2. Reject keeping detailed plans outside `.execution-governance/plans/**` because Cursor and CLI need one canonical package.
3. Reject trusting agent discipline alone because the identified failure mode is model-independent and must be machine-rejected.
4. Reject allowing historical v1 packages to auto-upgrade because missing requirement/scope/acceptance coverage must be explicit.
5. Reject activation of all scope records because it lets a phase inherit permissions that were not needed for that phase.

## Phase GOV-DCPA-1 Data And Control Flow

Planning flow:

1. Planner writes detailed `plan.md` with phase, section, requirement, and step anchors.
2. Planner writes `contract.json`, `scope.json`, and `acceptance.json`.
3. `validate --plan-dir <dir>` parses JSON, validates each JSON file against its schema, validates cross-file references, validates the plan text, and checks legacy disposition.
4. `lock --plan-dir <dir> --write` refuses invalid packages, writes `lock.json`, and records the current base commit/tree.
5. The plan package and lock file are committed separately before implementation.

Implementation flow:

1. `preflight` re-runs strict validation and lock hash checks.
2. The implementer edits only allowed files.
3. `scope-check` compares changed paths to phase-filtered allowed scope.
4. `run-checks` runs exact acceptance commands with `shell:false`.
5. `postflight` verifies strict validation, lock hashes, scope, fresh run records, and forbidden skip/only markers.
6. `close` requires postflight PASS and valid lifecycle state.

Cursor activation flow:

1. `activate-cursor --phase-id GOV-DCPA-1` calls strict plan validation.
2. The activation script filters scope records to `phaseId = GOV-DCPA-1`.
3. The external activation contains only selected phase scope.
4. The enterprise guard enforces that scope and fails closed outside it.

## Phase GOV-DCPA-1 Required Sections For Future Plans

Every executable governed phase must contain all of these `GOV-SECTION` anchors:

- `purpose`
- `scope`
- `out-of-scope`
- `preconditions`
- `affected-files`
- `architecture-decisions`
- `rejected-alternatives`
- `api-data-contracts`
- `ordered-steps`
- `technical-methods`
- `data-control-flow`
- `dependencies`
- `state-transitions`
- `errors-boundaries`
- `security-privacy`
- `accessibility-localization`
- `migration-rollback`
- `tests`
- `acceptance-oracles`
- `stop-completion`

Each required section must contain non-placeholder prose or structured bullets. Empty headings, `[todo]`, `TBD`, `gerekli düzenlemeleri yap`, `uygun şekilde uygula`, `ilgili testleri ekle`, `as needed`, `etc.`, and equivalent ambiguity markers fail validation.

## Phase GOV-DCPA-1 API, Function, And Data Contracts

New module `tools/execution-governance/lib/json-schema-validator.mjs` exports:

- `validateJsonAgainstSchema(value, schema, options)`: returns `{ ok, errors }`.
- `loadSchemas(schemaDir)`: returns a map keyed by schema filename and `$id`.
- `validateFileAgainstNamedSchema({ repoRoot, schemaName, targetPath })`: parses and validates a JSON file.

New module `tools/execution-governance/lib/plan-package-validator.mjs` exports:

- `validatePlanPackage({ repoRoot, planDir, phaseId, mode })`: returns `{ ok, errors, warnings, packageInfo }`.
- `strictValidatePlanPackageOrThrow(context)`: throws a governance failure message for CLI callers.
- `loadPlanPackage(repoRoot, planDir)`: reads `plan.md`, `contract.json`, `scope.json`, `acceptance.json`, optional `lock.json`, and optional lifecycle records.
- `selectPhaseScope(scope, phaseId)`: returns a scope object containing only records whose `phaseId` matches the selected phase.
- `flattenScope(scope)`: returns the guard activation scope shape.

Updated CLI behavior:

- `validate` without `--plan-dir` validates policy, schemas, templates, and all non-historical active plan packages.
- `validate --plan-dir <dir>` requires `plan.md`, `contract.json`, `scope.json`, `acceptance.json`, and, when present or required by mode, validates `lock.json`.
- `validate --all-plans` validates every plan package and applies legacy disposition.
- `validate-template` validates `.execution-governance/templates/**`.
- `lock`, `preflight`, `scope-check`, `postflight`, `close`, and `activate-cursor` call strict package validation before doing their existing work.

Schema additions:

- `contract.json`: optional `governanceFormatVersion`, required for new packages as `2.0.0`; optional `currentPhaseId`; optional `phases[]`.
- `scope.json`: each requirement scope record has optional `phaseId`; new packages require it; `allowedMcpTools` and `allowSubagents` are first-class properties.
- `acceptance.json`: each acceptance record has optional `phaseId`; new packages require it.
- `lock.json`: `lockCommit` may be empty during lock file creation; activation requires a usable commit binding.

## Phase GOV-DCPA-1 Ordered Implementation Steps

<!-- GOV-STEP id="DCPA-STEP-001" -->
1. Create this plan package and run baseline `doctor` and `validate`.

<!-- GOV-STEP id="DCPA-STEP-002" -->
2. Generate `lock.json` for this package and create the separate plan-lock commit.

<!-- GOV-STEP id="DCPA-STEP-003" -->
3. Add `DECISION_COMPLETE_PLAN_AUTHORING_STANDARD.md` with exact authoring rules, required anchors, forbidden vague phrases, coverage rules, and legacy disposition policy.

<!-- GOV-STEP id="DCPA-STEP-004" -->
4. Expand templates and schemas to represent format `2.0.0`, phase IDs, MCP/subagent scope fields, and required decision-complete plan structure.

<!-- GOV-STEP id="DCPA-STEP-005" -->
5. Implement the JSON Schema validator and plan package validator.

<!-- GOV-STEP id="DCPA-STEP-006" -->
6. Wire strict validation into CLI commands and Cursor activation.

<!-- GOV-STEP id="DCPA-STEP-007" -->
7. Update red-team and tests for missing files, schema failures, coverage mismatches, vague plan rejection, legacy reauthor rejection, and phase-specific activation.

<!-- GOV-STEP id="DCPA-STEP-008" -->
8. Reconcile AGENTS, codex, Cursor rules, execution protocol, lifecycle flow, handoff, risk, evidence, lifecycle, and implementation report.

<!-- GOV-STEP id="DCPA-STEP-009" -->
9. Run all acceptance commands, record results, run `git diff --check`, and verify no protected product or production surface changed.

## Phase GOV-DCPA-1 Technical Methods

- Use `node:fs`, `node:path`, `node:crypto`, and `node:test` only.
- Keep CLI execution `shell:false`.
- Preserve existing command names and add only backward-compatible options.
- Fail closed on unsupported schema keywords, unresolved refs, missing files, duplicate requirement IDs, unknown phase IDs, and phase records that do not map to contract requirements.
- Treat `.execution-governance/runtime/**` as runtime evidence only and never commit it.
- Do not add package dependencies.

## Phase GOV-DCPA-1 Dependencies

- Node.js v22 or newer.
- Git available in the repo.
- Existing governance CLI and secure Cursor activation scripts.
- No network dependency.
- No Supabase, VPS, Stripe, provider, browser, or production dependency.

## Phase GOV-DCPA-1 State Transitions

Initial package state:

- `plan_state`: `READY_FOR_IMPLEMENTATION`
- `implementation_state`: `NOT_STARTED`
- `executor_checks`: `NOT_RUN`
- `independent_review`: `NOT_REQUESTED`
- `user_acceptance`: `PENDING`

After plan-lock commit:

- `plan_state`: `LOCKED_FOR_IMPLEMENTATION`
- `implementation_state`: `NOT_STARTED`
- `executor_checks`: `NOT_RUN`
- `independent_review`: `NOT_REQUESTED`
- `user_acceptance`: `PENDING`

After implementation and passing executor checks:

- `plan_state`: `LOCKED_FOR_IMPLEMENTATION`
- `implementation_state`: `EXECUTOR_VERIFIED`
- `executor_checks`: `PASS`
- `independent_review`: `NOT_REQUESTED`
- `user_acceptance`: `PENDING`

## Phase GOV-DCPA-1 Error And Boundary Cases

- Missing `plan.md` fails `validate --plan-dir`.
- Missing `contract.json`, `scope.json`, `acceptance.json`, or required `lock.json` fails in lock/preflight/postflight/close.
- Placeholder strings in templates may exist only under `.execution-governance/templates/**`; placeholders in executable plan packages fail.
- Legacy active packages listed as `REAUTHOR_REQUIRED` fail lock and activation.
- Historical packages listed as `HISTORICAL_READ_ONLY` are skipped by default validation but still parse as JSON if directly targeted.
- Manual or proposed-not-installed acceptance records block automated closure unless explicitly modeled as verifier setup.
- A selected phase without matching scope records fails activation.
- A scope record without `phaseId` in a format `2.0.0` package fails validation.
- A contract requirement without matching scope and acceptance records fails validation.
- A scope or acceptance record for an unknown requirement fails validation.
- Production/app/supabase changes fail scope-check.

## Phase GOV-DCPA-1 Security And Privacy

- No secrets, `.env`, private keys, raw prompts, raw health data, real user records, client records, or production data may be read or logged.
- No external network call is needed or allowed by acceptance.
- The external Cursor guard trust root remains under `C:\ProgramData\Cursor\hooks.json` and `C:\ProgramData\MANU-AI-Governance\secure-cursor-guard.mjs`.
- The repo-local Cursor rule remains an adapter and documentation surface, not the trust root.
- The implementation cannot enable provider/channel egress, live billing, production schema rollout, branch protection, or deployment.

## Phase GOV-DCPA-1 Accessibility And Localization

- No product UI or user-facing web surface changes are in scope.
- Governance documents remain English to match the existing execution-governance corpus.
- No accessibility claim changes are made.

## Phase GOV-DCPA-1 Migration And Rollback

- No database migration is in scope.
- Rollback is `git revert` of the implementation commit plus the plan-lock/proposal commits if the governance change must be removed.
- Because no product runtime files are touched, rollback has no Supabase, VPS, billing, or provider side effects.

## Phase GOV-DCPA-1 Tests

Required commands:

- `node tools/execution-governance/governance-cli.mjs doctor`
- `node tools/execution-governance/governance-cli.mjs validate`
- `node tools/execution-governance/governance-cli.mjs validate --plan-dir .execution-governance/plans/governance-decision-complete-authoring-v1`
- `node tools/execution-governance/governance-cli.mjs validate --all-plans`
- `node --test tools/execution-governance/governance-plan-quality.test.mjs`
- `node --test tools/execution-governance/activate-secure-cursor-guard.test.mjs`
- `node tools/execution-governance/governance-hardening-red-team.mjs`
- `node tools/execution-governance/install-secure-cursor-guard.mjs --verify`
- `node tools/execution-governance/governance-cli.mjs activate-cursor --plan-dir .execution-governance/plans/governance-decision-complete-authoring-v1 --phase-id GOV-DCPA-1 --allow-implementation-head`
- `git diff --check`
- `git status --short --branch`

## Phase GOV-DCPA-1 Acceptance Oracles

<!-- GOV-REQ id="DCPA-001" -->
DCPA-001 passes only when the standard file exists, names the compact-plan failure mode, states hash/scope enforcement is insufficient for plan quality, defines required phase sections, and forbids ambiguous implementation directives.

<!-- GOV-REQ id="DCPA-002" -->
DCPA-002 passes only when the plan template includes `GOV-PHASE`, `GOV-SECTION`, `GOV-REQ`, and `GOV-STEP` markers and every required section listed in this plan.

<!-- GOV-REQ id="DCPA-003" -->
DCPA-003 passes only when `AGENTS.md`, `codex.md`, and Cursor rules explicitly distinguish brief execution plans from governed implementation plans.

<!-- GOV-REQ id="DCPA-004" -->
DCPA-004 passes only when targeted validation fails missing required plan files and invalid schema records.

<!-- GOV-REQ id="DCPA-005" -->
DCPA-005 passes only when targeted validation rejects requirement/scope/acceptance coverage mismatches.

<!-- GOV-REQ id="DCPA-006" -->
DCPA-006 passes only when targeted validation rejects placeholder and vague plan language in executable plan packages.

<!-- GOV-REQ id="DCPA-007" -->
DCPA-007 passes only when lock/preflight/postflight/close/activate-cursor all invoke strict package validation.

<!-- GOV-REQ id="DCPA-008" -->
DCPA-008 passes only when Cursor activation output contains only the selected phase scope and fails for unknown phases.

<!-- GOV-REQ id="DCPA-009" -->
DCPA-009 passes only when current legacy active/reopenable packages are listed as `REAUTHOR_REQUIRED` and cannot be locked or activated.

<!-- GOV-REQ id="DCPA-010" -->
DCPA-010 passes only when node tests and the hardening red-team pass.

<!-- GOV-REQ id="DCPA-011" -->
DCPA-011 passes only when evidence and implementation report record actual commands, exit codes, changed files, and residual risks.

<!-- GOV-REQ id="DCPA-012" -->
DCPA-012 passes only when handoff and risk docs describe the new governance authoring authority and preserve `NO-GO` and iPhone waiver claims.

## Phase GOV-DCPA-1 Stop And Completion Criteria

Stop immediately before editing outside the allowed paths, before changing product runtime files, before using network-dependent commands, or before representing skipped/blocked checks as PASS.

The phase is complete only when every DCPA requirement has a matching scope record, matching acceptance record, fresh evidence command result, strict validation passes, red-team passes, runtime artifacts are untracked, no protected product files changed, and the final implementation report records `independent_review: NOT_REQUESTED`.

## Review Policy

Independent review starts only when the user explicitly requests it. This plan records `independent_review: NOT_REQUESTED`.
