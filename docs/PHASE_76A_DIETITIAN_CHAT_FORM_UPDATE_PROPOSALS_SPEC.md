# Phase 76A: Dietitian Chat Form Update Proposals Spec

Date: 2026-06-08

## Goal

Let a dietitian turn a natural-language note in the MANU-AI app into a structured client form/context update proposal, then apply it only after explicit dietitian approval.

This phase does not expand green/yellow/red routing, connect real Gemini, connect WhatsApp/Telegram, process real production health data, close launch gates, resolve R-405, or approve production pilot launch.

## Scope

- Add `ClientUpdateProposalRecord` with `pending`, `applied`, `rejected`, `needs_clarification`, and `unsupported` statuses.
- Add deterministic proposal extraction for selected Phase 70 client fields only.
- Add create/apply/reject proposal APIs under the selected client.
- Add dashboard controls in the internal copilot surface for proposal creation and approval.
- Apply approved proposals through existing form response, client mirror-field, context update, audit, context revision, and draft invalidation invariants.
- Add Supabase persistence for proposal records behind tenant-scoped RLS.

## Non-Goals

- No automatic or silent form mutation.
- No real LLM-based extraction.
- No overwrite/delete semantics for form fields.
- No clinical/risk routing change or green-capacity expansion.
- No mutation through the existing read-only internal copilot answer endpoint.

## Edge Cases

- Pending proposal apply fails if the client context revision changed after proposal creation.
- Removed/anonymized clients cannot create or apply proposals.
- Unsupported clinical/system changes such as medication, insulin, symptoms, lab, pregnancy, minor, AI mode/status, channel permission, red lock, or yellow hold do not produce applicable patches.
- Missing active Phase 70 form response blocks apply.
- Duplicate proposed values are not appended twice.
- Client removal/anonymization redacts proposal source text and patch values.

## Done Criteria

- Proposal creation never mutates form/context by itself.
- Apply updates Phase 70 form answers, mirrored client fields, Critical Context, audit events, context revision, and pending draft invalidation.
- Reject leaves client form/context unchanged.
- Internal copilot remains read-only; proposal apply is a separate approved action.
- Continuity/evidence docs record Phase 76A status.
- `npm run release:verify` passes with only documented R-405 findings.
