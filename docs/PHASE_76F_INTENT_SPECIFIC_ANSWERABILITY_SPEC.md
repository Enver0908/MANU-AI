# Phase 76F — Intent-Specific Answerability Spec

**Status:** Implemented (2026-06-08)  
**Depends on:** Phase 76E food rule engine, Phase 76D structured food rules  
**Feeds:** Phase 76G clinical second-layer calibration

## Goal

Replace Phase 67 coarse “any approved segment present” green answerability with intent-family source matching and food-rule engine alignment before provider calls.

## Scope

### In scope

- Core `intent-specific-answerability.js` evaluator
- Orchestrator reorder: prelude → green intent → food rule → intent-specific answerability
- Structured food-rule source categories derived from Phase 76D manifest
- Legacy plan/manual/form fallback when structured food rules are absent for non-food intents
- Tests for food and non-food intent families

### Out of scope

- Clinical second-layer false-yellow calibration (Phase 76G)
- Product catalog/barcode adapters (Phase 76H)
- PromptContext food-rule segments (Phase 76I)

## Decision contract

Answerability returns `source_backed_green` only when:

1. Prompt context exists and sensitive mixed markers are absent.
2. Green intent taxonomy allows the message.
3. For food intents resolved from the food-rule engine, the engine decision matches the intent family and required structured sources are populated.
4. For non-food green intents, at least one intent-specific approved source category is present.

Food-rule review decisions (`unknown_food_requires_review`, `product_ingredient_unknown`, `mixed_intent_blocked`, `mandatory_skip_blocked`) route to handoff, except `green_allowed_substitution` may use legacy `active_diet_plan` or `dietitian_manual_message` fallback when the engine returns `unknown_food_requires_review` on a substitution query.

Yellow/red risk decisions bypass intent-specific answerability gating so clinical second-layer routing is not blocked before provider generation.

## Done criteria

- Intent-specific answerability is test-covered and wired on the orchestrator hot path.
- Production pilot remains `NO-GO`.
- `npm run release:verify` passes.
