# Phase 70: User-Supplied Form Hardening Spec

Date: 2026-06-07

## Goal

Convert the user-supplied Phase 70 dietitian and client form package into versioned production-grade local schemas, field classifications, prompt visibility rules, answerability source metadata, and autopilot qualification checks.

This phase does not connect real WhatsApp, Gemini, monitoring, secret manager, production Supabase migrations for dietitian forms, or real client health data. It does not close launch gates or approve production pilot.

## User Input Source

External package: `faz_70_istenilenler.md` (project-external working file, 2026-06-07).

## Scope

- Add a canonical Phase 70 field registry for dietitian and client forms.
- Extend form field definitions with:
  - `prompt_allowed`
  - `dietitian_only`
  - `sensitive_never_prompt`
  - `system_rule`
- Add answerability roles:
  - `answerability_source`
  - `risk_modifier`
  - `logistics_only`
  - `policy_source`
- Build immutable published production schemas from the registry.
- Store client responses with schema snapshots (existing Phase 25 behavior).
- Add local dietitian form schema/response state for dietitian profile and policy fields.
- Enforce prompt summary sanitization and visibility from registry metadata.
- Evaluate Phase 70 minimum autopilot client field completeness before autopilot processing.
- Invalidate pending drafts on prompt-affecting form changes (existing behavior preserved).
- Add tests for registry visibility, answerability metadata, autopilot qualification, and draft invalidation.

## Non-Goals

- No official PDF ingestion (Phase 71).
- No regulation permission graph (Phase 72).
- No real provider/channel/monitoring integration.
- No external legal/privacy or clinical launch-gate approval.
- No production Supabase migration for dietitian form tables in this phase.

## Field Classification Rules

- `prompt_allowed`: may enter bounded PromptContext only as structured/sanitized summary text.
- `dietitian_only`: dashboard/admin only; never prompt.
- `sensitive_never_prompt`: critical identity/clinical/raw detail; never prompt.
- `system_rule`: routing/guardrail only; never raw prompt content.

Answerability roles mark which form fields may support green answerability evidence. AI-generated messages remain non-authoritative.

## Minimum Autopilot Client Requirements

Autopilot remains blocked unless all Phase 70 minimum client requirements are satisfied:

- Client record safety/profile gates (adult status, channel permission, safety checklist, AI mode/status).
- Published client form response covering required minimum field ids from the user package.
- Sensitive consent and prompt-visibility acknowledgements approved.

Qualification states:

- `qualified`
- `incomplete`
- `not_qualified`

## Edge Cases

- Missing published client form response blocks autopilot qualification as `incomplete`.
- `sensitive_never_prompt` answers never appear in `client_form_summary`.
- `system_rule` and `dietitian_only` answers never appear in prompt summaries.
- Prompt-affecting form saves invalidate pending AI drafts.
- Removed/anonymized clients cannot save form responses.
- Minor/unknown adult status or non-ready channel permission yields `not_qualified`.
- Production pilot remains `NO-GO` after this phase.

## Done Criteria

- Registry-backed published client and dietitian schemas exist locally.
- Prompt-hidden fields never enter PromptContext summaries.
- Answerability source fields are classified and test-covered.
- Autopilot qualification enforces minimum client field completeness.
- `npm run release:verify` passes with only documented R-405 findings.
- Continuity docs updated.
