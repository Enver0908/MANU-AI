# Phase 76E — Food Rule Engine Spec

**Status:** Implemented (2026-06-08)  
**Depends on:** Phase 76D structured food rule data model  
**Feeds:** Phase 76F intent-specific answerability, 76G clinical calibration

## Goal

Implement a deterministic food-rule evaluator that returns explicit decision values for allowed, forbidden, equivalent substitution, diet-type, skip, and product-ingredient questions using structured Phase 76D rules only.

## Scope

### In scope

- Core module `dietitian-ai-assistant/src/food-rule-engine.js`
- App bridge `app/src/lib/food-rule-runtime.ts`
- Audit-only orchestrator attachment as `contextManifest.foodRule`
- Simulator passes structured food rules into core input
- Golden unit tests for decision contract and conflict order

### Out of scope

- Intent-specific answerability gating (Phase 76F)
- Clinical second-layer carve-outs (Phase 76G)
- Trusted product catalog/barcode adapters (Phase 76H)
- PromptContext food-rule segments (Phase 76I)
- Routing changes based on food-rule decisions

## Decision contract

| Decision | Meaning |
| --- | --- |
| `allowed_food_confirmation` | Food explicitly allowed |
| `forbidden_food_rejection` | Food explicitly forbidden |
| `equivalent_substitution_allowed` | Swap in approved exchange group |
| `diet_type_compatible` | Food fits active diet type |
| `diet_type_conflict` | Food conflicts with diet type |
| `optional_skip_allowed` | Skip explicitly allowed |
| `mandatory_skip_blocked` | Mandatory item cannot be skipped |
| `unknown_food_requires_review` | No approved source for food |
| `product_ingredient_conflict` | Trusted ingredient evidence shows forbidden content |
| `product_ingredient_unknown` | Ingredient evidence insufficient |
| `mixed_intent_blocked` | Food plus clinical/plan-change intent |
| `not_applicable` | Message is not a food-rule query |

## Conflict order

1. Forbidden beats allowed.
2. Mixed clinical intent blocks before food decisions.
3. Mandatory beats optional for skip decisions.
4. Uncertainty fails closed to review decisions.

## Done criteria

- Deterministic evaluator is test-covered in core and app bridge.
- Orchestrator records `foodRule` audit metadata without changing routing.
- Production pilot remains `NO-GO`.
- `npm run release:verify` passes.
