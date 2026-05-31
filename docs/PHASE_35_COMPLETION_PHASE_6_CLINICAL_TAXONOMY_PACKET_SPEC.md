# Phase 35 - Completion Roadmap Phase 6: Clinical Taxonomy Review Packet

Date: 2026-05-31

## Goal

Run Completion Roadmap Phase 6 by preparing the `clinical_taxonomy_approval` production-pilot launch gate for qualified dietitian review.

## Scope

This phase is documentation and clinical-review readiness only.

In scope:

- Create a qualified dietitian review packet for the current clinical taxonomy and golden test set.
- Summarize current red/yellow/green routing expectations.
- Map internal evidence to the required external clinical approval artifact.
- Update planning, evidence, risk, dossier, and handoff documents.

Out of scope:

- Clinical approval or sign-off.
- Changing classifier behavior.
- Adding or editing clinical golden cases.
- Medical diagnosis or medical-device/CDS classification.
- Runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data changes.
- Resolving R-405 or R-406.

## Assumptions

- The user has not supplied qualified dietitian approval artifacts in this phase.
- Therefore `clinical_taxonomy_approval` remains open.
- The current implementation evidence is useful for review but cannot substitute for qualified dietitian sign-off.

## Deliverables

- `docs/PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md`
- Updates to:
  - `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`
  - `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`
  - `docs/PILOT_READINESS_EVIDENCE_PACK.md`
  - `docs/NEXT_PHASE_EXECUTION_PLAN.md`
  - `docs/RISK_REGISTER.md`
  - `PLAN.md`
  - `PROJECT_PLAN.md`
  - `HANDOFF_FOR_NEXT_CODEX.md`

## Edge Cases

- Passing golden tests do not approve clinical safety for pilot use.
- Persona invariants prove style does not alter routing in tests, but a qualified dietitian must still approve the taxonomy.
- Yellow cases may call the mock provider for drafts, but client-facing send remains review-gated.
- Red cases must remain no-provider-call handoffs.
- No review packet may contain real client messages or identifiers.

## Done Criteria

- The clinical review packet lists taxonomy scope, golden cases, expected behavior, and required sign-off.
- `clinical_taxonomy_approval` remains open.
- R-405 remains open.
- R-406 remains blocked.
- `npm run release:verify` passes after documentation updates: core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.
