# [Decision-Complete Governed Plan Title]

Plan version: 0.0.0

Plan state: PLAN_DRAFT

Contract ID: replace-with-contract-id

Final acceptance authority: user

Independent review default: NOT_REQUESTED

<!-- GOV-PHASE id="PHASE-ID" title="Replace With Exact Phase Title" -->

## Authority Sources

- [specific authority file, user decision, commit, or test evidence]

## Problem Statement

[Describe the exact defect, missing capability, or governance/product gap. Explain why the plan exists and what failure it prevents.]

## Scope Summary

In scope:

- [exact in-scope outcome]

Out of scope:

- [exact excluded outcome]

Blocked decisions:

- [decision id and owner, or "None"]

## Requirement Ledger

| Requirement ID | Classification | Observable requirement | Dependencies |
| --- | --- | --- | --- |
| REQ-001 | IN_SCOPE | [observable behavior with a deterministic acceptance oracle] | [] |

## Phase PHASE-ID Purpose
<!-- GOV-SECTION id="purpose" -->

[State the precise phase objective and the invariant it establishes.]

## Phase PHASE-ID Scope
<!-- GOV-SECTION id="scope" -->

Allowed create paths:

- [repo-relative path]

Allowed modify paths:

- [repo-relative path]

Protected paths:

- [repo-relative path or glob]

Forbidden paths:

- [repo-relative path or glob]

## Phase PHASE-ID Out Of Scope
<!-- GOV-SECTION id="out-of-scope" -->

- [exact excluded file, behavior, external effect, or product claim]

## Phase PHASE-ID Preconditions
<!-- GOV-SECTION id="preconditions" -->

1. [exact command or state]

## Phase PHASE-ID Affected Files
<!-- GOV-SECTION id="affected-files" -->

- Create: [repo-relative path and purpose]
- Modify: [repo-relative path and exact reason]
- Preserve: [repo-relative path/glob and reason]

## Phase PHASE-ID Architecture Decisions
<!-- GOV-SECTION id="architecture-decisions" -->

1. [decision, affected boundary, and reason]

## Phase PHASE-ID Rejected Alternatives
<!-- GOV-SECTION id="rejected-alternatives" -->

1. [alternative and concrete rejection reason]

## Phase PHASE-ID API And Data Contracts
<!-- GOV-SECTION id="api-data-contracts" -->

- Module/function/API/data object: [exact signature or field inventory]

## Phase PHASE-ID Ordered Implementation Steps
<!-- GOV-SECTION id="ordered-steps" -->

<!-- GOV-STEP id="STEP-001" -->
1. [exact file, edit, method, and reason]

## Phase PHASE-ID Technical Methods
<!-- GOV-SECTION id="technical-methods" -->

- [specific parser/library/algorithm/command style and why]

## Phase PHASE-ID Data And Control Flow
<!-- GOV-SECTION id="data-control-flow" -->

1. [producer] -> [validator/service/store] -> [consumer/artifact], with exact fail-closed behavior.

## Phase PHASE-ID Dependencies
<!-- GOV-SECTION id="dependencies" -->

- [runtime/tool/dependency and whether additions are forbidden or allowed]

## Phase PHASE-ID State Transitions
<!-- GOV-SECTION id="state-transitions" -->

- Before: [plan_state, implementation_state, executor_checks, independent_review, user_acceptance]
- After success: [exact state axes]
- On failure: [exact state axes]

## Phase PHASE-ID Errors And Boundaries
<!-- GOV-SECTION id="errors-boundaries" -->

- [error/boundary case] -> [required behavior]

## Phase PHASE-ID Security And Privacy
<!-- GOV-SECTION id="security-privacy" -->

- [secret, PHI, tenant, prompt, production, or external-effect rule]

## Phase PHASE-ID Accessibility And Localization
<!-- GOV-SECTION id="accessibility-localization" -->

- [affected UI/accessibility/localization behavior, or explicit "no UI/localization surface"]

## Phase PHASE-ID Migration And Rollback
<!-- GOV-SECTION id="migration-rollback" -->

- Migration: [exact database/file migration behavior or "none"]
- Rollback: [exact revert/restore behavior]

## Phase PHASE-ID Tests
<!-- GOV-SECTION id="tests" -->

- [exact command, cwd, expected exit code, and required assertion]

## Phase PHASE-ID Acceptance Oracles
<!-- GOV-SECTION id="acceptance-oracles" -->

<!-- GOV-REQ id="REQ-001" -->
REQ-001 passes only when [exact oracle result]. It fails when [exact negative condition].

## Phase PHASE-ID Stop And Completion Criteria
<!-- GOV-SECTION id="stop-completion" -->

Stop before [scope expansion/verifier change/external effect]. Complete only when [full evidence and state criteria].

## Review Policy

Independent review starts only when the user explicitly requests it. If not requested, record `independent_review: NOT_REQUESTED`.
