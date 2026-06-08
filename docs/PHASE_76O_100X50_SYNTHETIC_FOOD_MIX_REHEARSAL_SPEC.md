# Phase 76O: 100x50 Synthetic Food-Mix Rehearsal

Date: 2026-06-08

## Goal

Simulate expanded food-rule green capacity across the direct production pilot scale target (100 dietitians x 50 clients = 5,000 clients) using synthetic food-mix scenarios, aggregate metrics, and operational-health evidence without raw message leakage.

This phase does not approve production pilot launch, close launch gates, connect real WhatsApp/Gemini, enable production lifecycle, or resolve R-405.

## Scope

- JSONL food-mix rehearsal scenario catalog.
- Deterministic 100x50 client-to-scenario assignment from `createDirectPilotScaleFixture()`.
- Lightweight scale rehearsal across all 5,000 synthetic client slots.
- Representative full-simulator integration checks for duplicate inbound, provider failure, stale draft context, removed client, and proposal apply during active conversation.
- Aggregate metrics: duplicate-ignore safety, unsafe green zero, food-rule green coverage, food-rule no-source handoff, operational-health safe output.
- Extend `direct-pilot-scale-readiness` and `operational-health` with food-mix rehearsal evidence fields.
- Update pilot evidence and continuity documentation.

## Non-Goals

- Real WhatsApp webhook replay.
- Real Gemini/provider egress.
- Production Supabase load test.
- Production GO or external gate closure.
- Full dashboard pagination rewrite.

## Rehearsal Scenarios

| Scenario id | Intent |
| --- | --- |
| `food_substitution_burst` | Approved equivalent exchange substitution |
| `forbidden_food_request` | Explicit forbidden-food permission query |
| `diet_type_conflict` | Diet-type incompatible packaged food |
| `product_ingredient_uncertainty` | Unknown product label ingredients |
| `duplicate_inbound` | Duplicate WhatsApp-like idempotency key |
| `opt_out_client` | Channel permission opted out |
| `removed_client` | Removed/anonymized lifecycle exclusion |
| `red_lock` | Active red-risk lock |
| `yellow_hold` | Active yellow-risk hold |
| `provider_failure` | Mock provider failure without client send |
| `draft_stale_context` | Stale draft after context revision bump |
| `proposal_apply_active_conversation` | Proposal apply during active conversation |

## Metrics

- `duplicate_ignored_count` must be > 0 in integration checks and no duplicate client sends recorded.
- `unsafe_green_count` must be 0 across scale + integration rehearsal.
- `food_rule_green_count` measures source-backed green food-rule decisions.
- `food_rule_no_source_handoff_count` measures fail-closed handoff when structured rules are missing.
- Operational health and evidence-pack output must remain aggregate-only (no raw messages, phones, prompts, or secrets).

## Edge Cases

| Scenario | Expected behavior |
| --- | --- |
| 5,000 client mapping | Each client index maps deterministically to one scenario via modulo |
| Removed client | Simulator path blocked; food-rule structured rules null |
| Opt-out / red lock / yellow hold | No client-facing AI send |
| Duplicate inbound | Second event returns `duplicate_ignored` |
| Provider failure | Handoff/internal path without client-facing provider error text |
| Stale draft | Draft invalidated or blocked before send |
| Proposal apply | Applies with context revision increment; no unsafe green |

## Done Criteria

- `phase-76o-food-mix-rehearsal` helpers and tests pass.
- Scale rehearsal covers 100 dietitians x 50 clients via synthetic fixture assignment.
- `unsafe_green_count = 0` on bundled rehearsal.
- Operational health includes food-mix rehearsal aggregate fields without raw content.
- `npm run release:verify` passes with only documented R-405 findings.
- Production pilot remains `NO-GO`.
