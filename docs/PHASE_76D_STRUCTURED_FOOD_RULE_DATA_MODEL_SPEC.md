# Phase 76D — Structured Food Rule Data Model Spec

**Status:** Implemented (2026-06-08)  
**Depends on:** Phase 76C structured food rule green capacity spec  
**Feeds:** Phase 76E food rule engine, 76F intent-specific answerability

## Goal

Convert Phase 70 coarse free-text food fields into registry-backed, answerability-ready structured food rules without changing orchestrator runtime behavior in this phase.

## Scope

### In scope

- Registry-backed structured food rule field families on the client intake form
- Deterministic parsing and validation helpers for list, group, exchange, and policy fields
- Autopilot qualification fail-closed checks when required structured food rule fields are incomplete
- Demo seed answers with realistic structured food rules
- Client record sync for `allergies` and `restrictedFoods` from structured answers on form save
- Field-level structured food rule manifest for downstream engine wiring

### Out of scope

- Food rule engine runtime decisions (Phase 76E)
- Intent-specific answerability matching (Phase 76F)
- Clinical second-layer calibration (Phase 76G)
- Product ingredient verification adapter (Phase 76H)
- Dashboard UX beyond registry metadata (Phase 76J)

## Structured field families

| Field id | Type | Authoritative role |
| --- | --- | --- |
| `forbidden_food_items` | textarea (comma list) | Explicit banned foods |
| `forbidden_food_groups` | multiselect | Banned food groups |
| `allowed_food_items` | textarea (comma list) | Explicit allowed foods |
| `allowed_food_groups` | multiselect | Allowed food groups |
| `diet_type_rules` | select | Active diet type compatibility |
| `equivalent_exchange_groups` | textarea (group syntax) | Approved swaps |
| `mandatory_foods_or_meals` | textarea (comma list) | Must-consume items |
| `optional_foods_or_meals` | textarea (comma list) | Flexible skip candidates |
| `skip_tolerance_rules` | select | Skip policy |
| `portion_boundaries` | textarea | Portion reminder bounds only |
| `ingredient_allergen_keywords` | multiselect | Product ingredient conflict keywords |
| `product_label_review_policy` | select | Product verification gate |
| `uncertainty_policy` | select | Unknown food/product routing |

Legacy Phase 70 free-text fields (`allergies`, `restricted_foods_medical`, `allowed_substitutions`, `forbidden_substitutions`) remain migration-compatible summaries. Structured fields become the authoritative answerability source for downstream phases.

## Exchange group syntax

`equivalent_exchange_groups` uses deterministic pipe-and-semicolon syntax:

```text
group_label: item_a|item_b|item_c; other_group: item_x|item_y
```

Example:

```text
nut_swap: almond|walnut|hazelnut; dairy_alt: lor|labne
```

## Autopilot minimum structured food rule set

Autopilot qualification requires:

1. All `PHASE_76D_MINIMUM_STRUCTURED_FOOD_RULE_FIELD_IDS` populated
2. At least one forbidden source: `forbidden_food_items`, `forbidden_food_groups`, `restricted_foods_medical`, or `allergies`
3. At least one allowed source: `allowed_food_items`, `allowed_food_groups`, or `allowed_substitutions`

Missing structured food rule coverage returns `incomplete` with explicit `structured_food_rule_*` missing codes.

## Client record sync

On published client form save:

- `allergies` textarea + `forbidden_food_items` merge into `ClientRecord.allergies` (deduped, lowercased)
- `forbidden_food_groups`, `forbidden_food_items`, and `restricted_foods_medical` merge into `ClientRecord.restrictedFoods`

Sync is additive normalization only; no orchestrator consumption in 76D.

## Registry version

`PHASE_70_REGISTRY_VERSION` bumps to `phase-76d-food-rule-registry-v1`.

## Done criteria

- Structured food rules registry-backed and test-covered
- Autopilot fails closed when required food-rule fields incomplete
- Production pilot remains `NO-GO`
- `npm run release:verify` passes
