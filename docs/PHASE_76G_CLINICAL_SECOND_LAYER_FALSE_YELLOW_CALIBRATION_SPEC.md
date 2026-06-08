# Phase 76G — Clinical Second-Layer False-Yellow Calibration Spec

**Status:** Implemented (2026-06-08)  
**Depends on:** Phase 76E food rule engine, Phase 76F intent-specific answerability, Phase 76C calibration rules  
**Feeds:** Phase 76H product ingredient verification

## Goal

Reduce false-yellow clinical second-layer escalations for source-backed food permission, substitution, and skip questions while preserving acute allergy, reaction, and clinical escalation paths.

## Problem

`evaluateClinicalSafetySecondLayer` escalates to yellow when client allergy or restriction terms appear in the message. That is safe for ambiguous clinical references but blocks source-backed green paths such as “can I drink milk?” when milk is explicitly forbidden in structured food rules.

## Scope

### In scope

- Core `clinical-safety-second-layer.js` source-backed food-rule carve-out contract
- Optional `foodRuleDecision` input on `classifyClinicalSafetyRisk` and `evaluateClinicalSafetySecondLayer`
- Simulator risk path evaluates food rules before second-layer merge
- Orchestrator fallback classification passes structured food rules into second layer when no `riskDecisionOverride`
- JSONL fixture expansion for carve-out and severe-allergy cases
- App runtime test for seeded forbidden-food green path without false yellow

### Out of scope

- Product catalog/barcode adapters (Phase 76H)
- PromptContext food-rule segments (Phase 76I)
- Production clinical taxonomy gate closure
- Qualified dietitian external approval artifacts
- Provider, channel, launch-gate, R-405, or real-data changes

## Carve-out contract

Carve-out may suppress **only** `second_layer_client_allergy_or_restriction_mentioned` when all conditions hold:

1. `foodRuleDecision.decision` is one of:
   - `forbidden_food_rejection`
   - `allowed_food_confirmation`
   - `equivalent_substitution_allowed`
   - `diet_type_compatible`
   - `diet_type_conflict`
   - `optional_skip_allowed`
   - `mandatory_skip_blocked`
2. Message is a prospective food permission/substitution/skip query, not an ingestion reaction report.
3. No acute clinical escalation markers (breathing difficulty, anaphylaxis, emergency, medication/insulin/lab/symptom interpretation, plan change, calorie/macro change).
4. Client `healthProfile.allergySeverity` is not `Agir/anafilaksi` (severe allergy profile keeps yellow review).

Carve-out never applies when:

- Base classifier is already yellow or red.
- Other second-layer reasons remain (ambiguous clinical reference, missing history, minor weight context, eating-disorder ambiguous restriction).
- `foodRuleDecision` is missing, `not_applicable`, `unknown_food_requires_review`, `product_ingredient_unknown`, or `mixed_intent_blocked`.

## Version

Second-layer version bumps to `clinical-safety-second-layer-v0.2.0`. Combined classifier string becomes `dietetic-risk-v0.3.1+clinical-safety-second-layer-v0.2.0` (+ scope guard when active).

## External gate

Qualified dietitian approval is required before production activation of second-layer carve-outs. Local prototype evidence only; clinical taxonomy launch gate remains open.

## Done criteria

- Unsafe green rate remains zero in tests.
- Source-backed forbidden-food reminders can stay green when food-rule engine and carve-out align.
- Ingestion/reaction and acute allergy messages never receive carve-out.
- `npm run release:verify` passes.
- Production pilot remains `NO-GO`.
