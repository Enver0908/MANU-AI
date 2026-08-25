# Decision-Complete Plan Authoring Standard

Version: 1.0.0

Status: ACTIVE_LOCAL_GOVERNANCE_AUTHORITY

Authority:

- `AGENTS.md`
- `docs/execution-governance/EXECUTION_ASSURANCE_PROTOCOL.md`
- `.execution-governance/plans/governance-decision-complete-authoring-v1/plan.md`

## Purpose

This standard closes the governance gap where a plan package can be hashed, scoped, and guarded while still leaving implementation decisions open. Hashes and scope limits preserve a plan; they do not prove the plan is sufficiently detailed. A compact governed plan can cryptographically lock ambiguity unless the authoring quality is validated before lock, activation, implementation, postflight, and closure.

## Decision-Complete Definition

A governed implementation plan is decision-complete only when an implementer can execute every phase without inventing product, architecture, data, security, privacy, migration, UI, test, or release decisions.

Decision-complete does not mean verbose for its own sake. It means each requirement has:

- a unique requirement ID,
- exact affected files or protected files,
- exact ordered implementation steps,
- named APIs, functions, modules, data structures, or schema changes when relevant,
- explicit accepted and rejected architecture decisions,
- concrete data and control flow,
- concrete error and boundary behavior,
- exact security and privacy limits,
- exact tests and acceptance oracles,
- stop criteria for scope or verifier changes.

## Mandatory Phase Sections

Every executable governed phase in a new format `2.0.0` plan must include all of these sections in `plan.md`:

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

Each section must contain concrete content. Empty headings, placeholder text, and generic instructions fail validation.

## Required Markers

`plan.md` must include machine-readable markers:

- `<!-- GOV-PHASE id="PHASE-ID" title="..." -->` for every executable phase in `contract.json`.
- `<!-- GOV-SECTION id="section-id" -->` for every mandatory section.
- `<!-- GOV-REQ id="REQ-ID" -->` for every in-scope requirement in `contract.json`.
- `<!-- GOV-STEP id="STEP-ID" -->` for ordered implementation steps.

The markers are not decorative. The validator uses them to bind prose, requirements, and phase-scoped execution authority.

## Forbidden Ambiguity

Executable governed plan packages must not contain instructions that leave decisions to the implementer. The validator rejects placeholder or vague phrases including:

- `TBD`
- `TODO`
- `[todo]`
- `[tbd]`
- `as needed`
- `etc.`
- `gerekli düzenlemeleri yap`
- `uygun şekilde uygula`
- `ilgili testleri ekle`
- `make the necessary changes`

Equivalent vague wording must be treated as a planning defect even when it is not yet part of the automated phrase list.

## JSON Coverage Rules

For every in-scope requirement:

- `contract.json` must define the requirement.
- `scope.json` must define a matching `requirementId` and `phaseId`.
- `acceptance.json` must define a matching `requirementId` and `phaseId`.
- Unknown scope or acceptance requirement IDs fail validation.
- New packages must use `governanceFormatVersion: "2.0.0"`.

## Lock And Activation Rules

`validate --plan-dir <dir>` must pass before a package can be locked.

`lock`, `preflight`, `scope-check`, `postflight`, `close`, and `activate-cursor` must invoke strict plan-package validation. Cursor activation must name a valid phase id and must expose only that phase's scope to the external guard.

## Legacy Plan Disposition

Legacy plans created before this standard remain historical evidence. A legacy package that is still active, reopenable, or intended for implementation must be reauthored into the decision-complete format before it can be locked or activated.

The machine-readable registry is `.execution-governance/policy/legacy-plan-disposition.json`.

## Non-Goals

This standard does not change product runtime behavior, production readiness, Stage 5/6/7 closure, the physical iPhone waiver, Supabase state, VPS state, billing, provider/channel egress, or real health data handling.
