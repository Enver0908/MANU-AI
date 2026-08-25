# Hosted Sandbox Verifier Setup v1

Plan version: 1.0.0

Plan state: READY_FOR_IMPLEMENTATION

Final acceptance authority: user

Independent review default: NOT_REQUESTED

## Authority Sources

- User command on 2026-08-25 to apply Faz 0 of the Hosted Sandbox Bütünlük, Güvenlik ve Dağıtım Güvence Planı
- Current Git state and working code
- AGENTS.md
- docs/execution-governance/EXECUTION_ASSURANCE_PROTOCOL.md
- docs/execution-governance/LIFECYCLE_AND_OPTIONAL_REVIEW_FLOW.md
- docs/execution-governance/MANU_AI_PLAN_IMPLEMENTATION_ASSURANCE_INTEGRATION_PLAN.md

## Purpose

Install the separate lockable verifier-setup contract and the protected Hosted Sandbox verifier so the main plan `.execution-governance/plans/hosted-sandbox-environment-assurance-v1/` can leave `VERIFIER_SETUP_REQUIRED` and become `READY_FOR_IMPLEMENTATION`.

This plan does not implement tenant isolation, runtime fixes, migrations, CI/deploy workflows, hosted cleanup, push, merge, or production activation.

## Scope Summary

- In scope: both governance plan packages; `app/scripts/verify-hosted-sandbox-contracts.mjs`; `tools/hosted-sandbox/**`; targeted Node tests; Phase 0 evidence; HANDOFF current-status lines; lifecycle and implementation-report files under both plan directories.
- Out of scope: product runtime behavior, UI, API route logic, RLS/migrations, package manifests, lockfiles, GitHub workflow changes, VPS, remote Supabase, billing, provider/channel egress, default-branch change, and independent review unless the user requests it.
- Protected: existing governance schemas, CLI, red-team harness, and `.github/workflows/execution-governance.yml`.

## Requirement Ledger

| Requirement ID | Classification | Observable requirement | Dependencies |
| --- | --- | --- | --- |
| HS-GOV-VS-001 | IN_SCOPE | Verifier-setup and main Hosted Sandbox plan packages exist with `plan.md`, `contract.json`, `scope.json`, and `acceptance.json`. | [] |
| HS-GOV-VS-002 | IN_SCOPE | Protected verifier binds Git SHA, migration fingerprint, required API contract files, and plan-package presence, and writes a freshness-bound runtime artifact. | [HS-GOV-VS-001] |
| HS-GOV-VS-003 | IN_SCOPE | Verifier negative controls fail closed for wrong SHA, missing migration set, demo-tenant fixture, and unauthorized diff. | [HS-GOV-VS-002] |
| HS-GOV-VS-004 | IN_SCOPE | Governance `doctor`, `validate`, and red-team harness PASS without changing protected governance surfaces. | [HS-GOV-VS-001] |
| HS-GOV-VS-005 | IN_SCOPE | Phase 0 evidence and HANDOFF record verifier setup, remaining lock-commit gap, and that production remains NO-GO. | [HS-GOV-VS-002, HS-GOV-VS-003, HS-GOV-VS-004] |

## Implementation Phase

### Phase 0: Governance package and protected verifier

Commands:

- `node tools/execution-governance/governance-cli.mjs doctor`
- `node tools/execution-governance/governance-cli.mjs validate`
- `node tools/execution-governance/governance-cli.mjs validate --plan-dir .execution-governance/plans/hosted-sandbox-verifier-setup-v1`
- `node tools/execution-governance/governance-cli.mjs validate --plan-dir .execution-governance/plans/hosted-sandbox-environment-assurance-v1`
- `node tools/execution-governance/red-team-harness.mjs`
- `node app/scripts/verify-hosted-sandbox-contracts.mjs`
- `node --test tools/hosted-sandbox/hosted-sandbox-verifier.test.mjs`
- `git diff --check`
- `git status --short --branch`

Stop criteria:

- Stop before editing product runtime, migrations, manifests, lockfiles, or the protected governance CLI/workflow/schemas.
- Stop before push, merge, deploy, remote migration, hosted data cleanup, or paid purchase.
- Do not claim the main plan is `LOCKED_FOR_IMPLEMENTATION` until a separate plan-lock commit exists.

## Review Policy

Independent review starts only when the user explicitly requests it. Record `independent_review: NOT_REQUESTED` and do not create a review record unless requested.
