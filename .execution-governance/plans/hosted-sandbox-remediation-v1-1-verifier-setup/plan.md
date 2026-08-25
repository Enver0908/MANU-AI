# Hosted Sandbox Remediation v1.1 Verifier Setup

Plan version: 1.0.0

Plan state: LOCKED_FOR_IMPLEMENTATION

Contract ID: hosted-sandbox-remediation-v1-1-verifier-setup

Final acceptance authority: user

Independent review default: NOT_REQUESTED

<!-- GOV-PHASE id="PHASE-0" title="Decision-Complete Package, Verifier, And Plan Lock" -->

## Authority Sources

- User instruction in the current Codex task.
- `AGENTS.md`
- `docs/execution-governance/EXECUTION_ASSURANCE_PROTOCOL.md`
- `docs/execution-governance/DECISION_COMPLETE_PLAN_AUTHORING_STANDARD.md`
- `docs/execution-governance/LIFECYCLE_AND_OPTIONAL_REVIEW_FLOW.md`
- Current Git state on `codex/stage-4c-remediation`.

## Problem Statement

The previous hosted sandbox work created broad local changes without a valid decision-complete lock, with acceptance drift, scope drift, and no reliable path for Cursor activation. This setup package authorizes only the Phase 0 creation of a replacement decision-complete plan package and its package-integrity verifier. It does not authorize product remediation implementation.

## Requirement Ledger

| Requirement ID | Classification | Observable requirement | Dependencies |
| --- | --- | --- | --- |
| HSR11-SETUP-001 | IN_SCOPE | Create the main v1.1 package, setup package, verifier, and Phase 0 evidence while preserving product and external-system boundaries. | [] |

## Phase PHASE-0 Purpose
<!-- GOV-SECTION id="purpose" -->

Create a narrow, lockable governance bootstrap surface for Hosted Sandbox Remediation v1.1. The invariant is that later implementation may start only from the main locked package, not from the historical v1 package or from a Markdown-only plan.

## Phase PHASE-0 Scope
<!-- GOV-SECTION id="scope" -->

Allowed create paths are exactly the setup package files, the main package files, `tools/hosted-sandbox/verify-hosted-sandbox-remediation-v1-1.mjs`, and `docs/HOSTED_SANDBOX_REMEDIATION_V1_1_PHASE_0_EVIDENCE.md`.

Allowed modify paths are empty for this setup package.

Protected paths include `app/**`, `dietitian-ai-assistant/**`, `.github/workflows/**`, `.execution-governance/schemas/**`, `.execution-governance/templates/**`, `tools/execution-governance/**`, and production readiness gate documents.

Forbidden paths include `.execution-governance/runtime/**` for tracked commits, `app/package.json`, `app/package-lock.json`, `app/supabase/migrations/**`, and `app/src/**`.

## Phase PHASE-0 Out Of Scope
<!-- GOV-SECTION id="out-of-scope" -->

- No application source change.
- No Supabase migration, reset, link, push, or SQL execution.
- No GitHub push, PR, merge, branch protection change, Actions secret change, or workflow execution request.
- No VPS, Nginx, PM2, systemd, domain, DNS, TLS, or production deployment mutation.
- No production readiness claim, production GO claim, billing activation, provider egress, or real health-data processing.

## Phase PHASE-0 Preconditions
<!-- GOV-SECTION id="preconditions" -->

1. `git branch --show-current` returns `codex/stage-4c-remediation`.
2. `git status --short --branch` shows no tracked or untracked work before Phase 0 starts.
3. `node tools/execution-governance/governance-cli.mjs doctor` exits 0.
4. `node tools/execution-governance/governance-cli.mjs validate` exits 0.

## Phase PHASE-0 Affected Files
<!-- GOV-SECTION id="affected-files" -->

- Create `.execution-governance/plans/hosted-sandbox-remediation-v1-1-verifier-setup/plan.md` as this human setup authority.
- Create `.execution-governance/plans/hosted-sandbox-remediation-v1-1-verifier-setup/contract.json`, `scope.json`, `acceptance.json`, and `lock.json` as setup machine authority.
- Create `.execution-governance/plans/hosted-sandbox-remediation-v1-1/plan.md`, `contract.json`, `scope.json`, `acceptance.json`, `lock.json`, `lifecycle-record.json`, and `implementation-report.json` as main remediation authority.
- Create `tools/hosted-sandbox/verify-hosted-sandbox-remediation-v1-1.mjs` as the Phase 0 automated oracle.
- Create `docs/HOSTED_SANDBOX_REMEDIATION_V1_1_PHASE_0_EVIDENCE.md` as the Phase 0 evidence summary.
- Preserve all protected application, migration, dependency, workflow, schema, verifier-core, production readiness, and runtime artifact paths.

## Phase PHASE-0 Architecture Decisions
<!-- GOV-SECTION id="architecture-decisions" -->

1. Use a separate setup package so the act of creating the main package has its own scope and acceptance boundary.
2. Keep the main package in `governanceFormatVersion: "2.0.0"` and make `plan.md` the canonical human technical authority.
3. Keep future external effects named but not authorized; phases 5 and 6 need separate explicit user commands before GitHub, Supabase, VPS, or live site mutation.
4. Use a dependency-free Node verifier that reads tracked files and lock hashes, with no network access and no secret reads.

## Phase PHASE-0 Rejected Alternatives
<!-- GOV-SECTION id="rejected-alternatives" -->

1. Reusing `.execution-governance/plans/hosted-sandbox-environment-assurance-v1` is rejected because legacy disposition requires reauthoring before lock or activation.
2. Treating the chat plan as Cursor permission is rejected because `AGENTS.md` requires committed locks plus external phase activation.
3. Updating product code in Phase 0 is rejected because package and verifier setup must be reviewable before remediation begins.

## Phase PHASE-0 API And Data Contracts
<!-- GOV-SECTION id="api-data-contracts" -->

- Setup contract ID: `hosted-sandbox-remediation-v1-1-verifier-setup`.
- Main contract ID: `hosted-sandbox-remediation-v1-1`.
- Verifier CLI: `node tools/hosted-sandbox/verify-hosted-sandbox-remediation-v1-1.mjs --phase PHASE-0`.
- Verifier result contract: exit code 0 means package, scope, coverage, and hash checks passed; exit code 1 means one or more assertions failed.
- Runtime run-records are written only by governance CLI under `.execution-governance/runtime/run-records/` and remain untracked.

## Phase PHASE-0 Ordered Implementation Steps
<!-- GOV-SECTION id="ordered-steps" -->

<!-- GOV-STEP id="HSR11-SETUP-STEP-001" -->
1. Create the setup package `plan.md`, `contract.json`, `scope.json`, and `acceptance.json` with exactly one in-scope setup requirement.

<!-- GOV-STEP id="HSR11-SETUP-STEP-002" -->
2. Create the main package files with seven phases, phase-scoped requirement IDs, phase-scoped scope records, and phase-scoped acceptance records.

<!-- GOV-STEP id="HSR11-SETUP-STEP-003" -->
3. Create the verifier script that validates main and setup package file presence, `governanceFormatVersion`, phase inventory, requirement coverage, Phase 0 protected boundaries, and lock hash integrity.

<!-- GOV-STEP id="HSR11-SETUP-STEP-004" -->
4. Run `node tools/execution-governance/governance-cli.mjs lock --plan-dir <setup-plan-dir> --write --allow-dirty` and the same command for the main package to generate `lock.json` files bound to the current base commit.

<!-- GOV-STEP id="HSR11-SETUP-STEP-005" -->
5. Run setup validation, main validation, verifier execution, setup run-checks, setup postflight, `git diff --check`, and final `git status --short --branch`.

## Phase PHASE-0 Technical Methods
<!-- GOV-SECTION id="technical-methods" -->

- JSON files use the existing governance schemas under `.execution-governance/schemas/`.
- Lock files are generated by `tools/execution-governance/governance-cli.mjs lock` so hashes and protected manifest use the same implementation as later preflight.
- The verifier uses `fs`, `path`, `crypto`, and `child_process` from Node core only.

## Phase PHASE-0 Data And Control Flow
<!-- GOV-SECTION id="data-control-flow" -->

1. `contract.json` defines requirement IDs and phase IDs.
2. `scope.json` maps every in-scope requirement to exact file and command authority.
3. `acceptance.json` maps each requirement to an oracle.
4. `lock.json` binds package files and protected manifests to the current Git base.
5. The verifier reads these files, checks cross-file coverage and hash equality, then exits fail-closed on the first set of accumulated violations.

## Phase PHASE-0 Dependencies
<!-- GOV-SECTION id="dependencies" -->

- Node.js 22 or newer is required because the existing governance CLI already requires it.
- Git is required for lock generation and status verification.
- No package dependency, lockfile dependency, Supabase dependency, browser dependency, VPS dependency, GitHub token, or network dependency is introduced.

## Phase PHASE-0 State Transitions
<!-- GOV-SECTION id="state-transitions" -->

- Before: setup package absent, main v1.1 package absent, implementation not started, independent review not requested.
- After success: setup package `plan_state` is `LOCKED_FOR_IMPLEMENTATION`, setup `implementation_state` is `EXECUTOR_VERIFIED`, main package `plan_state` is `LOCKED_FOR_IMPLEMENTATION`, main `implementation_state` is `NOT_STARTED`, independent review remains `NOT_REQUESTED`.
- On failure: do not start Phase 1; report the failing command and leave production boundaries unchanged.

## Phase PHASE-0 Errors And Boundaries
<!-- GOV-SECTION id="errors-boundaries" -->

- If `validate --plan-dir` fails, fix only the new package files or stop with the validation output.
- If the verifier reports a missing phase, missing requirement anchor, missing scope record, missing acceptance record, or lock hash mismatch, update only the new package files and regenerate locks.
- If any product, migration, dependency, workflow, external-system, or production gate change becomes necessary, stop before editing and create a scope-change request.

## Phase PHASE-0 Security And Privacy
<!-- GOV-SECTION id="security-privacy" -->

- Do not read `.env`, private keys, database URLs, service-role keys, user health data, prompt logs, or live customer records.
- Do not write secrets, PHI, real user data, raw prompt text, or live credentials into evidence.
- Production remains `NO-GO`; iPhone Safari/PWA remains `WAIVED_NOT_EXECUTED`.

## Phase PHASE-0 Accessibility And Localization
<!-- GOV-SECTION id="accessibility-localization" -->

No UI, user-facing copy, accessibility behavior, or localization behavior is changed in this setup phase.

## Phase PHASE-0 Migration And Rollback
<!-- GOV-SECTION id="migration-rollback" -->

- Migration: no database migration is created or executed.
- Rollback: remove the new setup package, main package, verifier script, and evidence file before commit if Phase 0 is rejected; after commit, revert only the Phase 0 commit with user approval.

## Phase PHASE-0 Tests
<!-- GOV-SECTION id="tests" -->

- `node tools/execution-governance/governance-cli.mjs validate --plan-dir .execution-governance/plans/hosted-sandbox-remediation-v1-1-verifier-setup` must exit 0.
- `node tools/execution-governance/governance-cli.mjs validate --plan-dir .execution-governance/plans/hosted-sandbox-remediation-v1-1` must exit 0.
- `node tools/hosted-sandbox/verify-hosted-sandbox-remediation-v1-1.mjs --phase PHASE-0` must exit 0.
- `node tools/execution-governance/governance-cli.mjs run-checks --plan-dir .execution-governance/plans/hosted-sandbox-remediation-v1-1-verifier-setup --phase-id PHASE-0` must exit 0.
- `node tools/execution-governance/governance-cli.mjs postflight --plan-dir .execution-governance/plans/hosted-sandbox-remediation-v1-1-verifier-setup --phase-id PHASE-0 --allow-dirty` must exit 0.
- `git diff --check` must exit 0.

## Phase PHASE-0 Acceptance Oracles
<!-- GOV-SECTION id="acceptance-oracles" -->

<!-- GOV-REQ id="HSR11-SETUP-001" -->
HSR11-SETUP-001 passes only when the setup package validates, the main package validates, the Phase 0 verifier exits 0, setup run-checks produce a fresh PASS run-record for the current HEAD, setup postflight exits 0 with the Phase 0 scope, and no protected product or external-system file is changed.

## Phase PHASE-0 Stop And Completion Criteria
<!-- GOV-SECTION id="stop-completion" -->

Stop before any edit outside the allowed create paths. Stop before changing governance core schemas, governance CLI, application code, migrations, package manifests, workflows, VPS files, Supabase state, DNS, production gates, provider egress, billing, or live data handling. Complete Phase 0 only when validation, verifier, run-checks, postflight, diff hygiene, and final status evidence are recorded.

## Review Policy

Independent review starts only when the user explicitly requests it. If the user does not request review, record `independent_review: NOT_REQUESTED` and do not create a review record.
