# Phase 76N: Supabase, RLS, Export, Redaction, and Transactional Coverage

Date: 2026-06-08

## Goal

Extend Phase 74 data lifecycle coverage so structured food-rule fields, product-label evidence, chat update proposals, and Supabase transactional paths meet the same export, redaction, RLS, and removal standards as the rest of the pilot foundation.

This phase does not approve legal/privacy counsel review, enable production lifecycle (`MANU_ALLOW_PHASE_74_PRODUCTION_LIFECYCLE`), connect real providers/channels, close launch gates, or change production pilot status.

## Scope

- Export manifest categories for structured food rules and client update proposals.
- Transactional redaction invariants for food-rule form fields, allergies/restricted foods, proposal source text, and proposal patches.
- Removed-client operational exclusion from food-rule engine and simulator paths (verify existing guards).
- Supabase `manu_commit_state_delta` extensions for `client_update_proposals` upserts and redaction-related updates.
- `commit_client_update_proposal` RPC wrapper for create/apply proposal flows.
- `commit_client_removal_lifecycle` used for bulk client redaction state deltas where the RPC payload covers the change set.
- RLS integration coverage for `client_update_proposals` tenant isolation when local Supabase is available.

## Non-Goals

- Production Supabase hard-delete automation.
- Real PDF corpus activation.
- WhatsApp/Gemini egress.
- Production pilot GO.

## Edge Cases

| Scenario | Expected behavior |
| --- | --- |
| Client export with structured food rules | `structured_food_rules.json` includes manifest from latest form response; raw product label text excluded from minimized audit exports |
| Client removal/anonymization | Food-rule form fields, allergies, restricted foods, proposal source/patches redacted |
| Removed client simulator inbound | `client_removed_anonymized` fail-closed |
| Removed client food-rule evaluation | Engine returns `food_rule_structured_rules_missing` or path blocked before engine |
| Proposal apply with stale revision | `proposal_stale_recreate_required` |
| Proposal apply Supabase path | Single transactional RPC commit for client, form response, context update, proposal status, draft invalidation |
| Cross-tenant proposal write | RLS blocks |

## Done Criteria

- `phase-76n-food-rule-lifecycle` helpers and tests pass.
- Phase 74 export package includes `structured_food_rules.json` and `client_update_proposals.json`.
- Redaction invariants fail when food-rule fields or proposal text remain promptable.
- Supabase proposal create/apply uses `commit_client_update_proposal`.
- Client removal uses `commit_client_removal_lifecycle` for in-RPC-covered redaction deltas.
- `npm run release:verify` passes with only documented R-405 findings.
- Production pilot remains `NO-GO`.
