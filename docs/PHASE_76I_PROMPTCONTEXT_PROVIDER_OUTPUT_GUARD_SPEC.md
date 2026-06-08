# Phase 76I — PromptContext and Provider Output Guard Hardening Spec

**Status:** Implemented (2026-06-08)  
**Depends on:** Phase 76E food rule engine, Phase 76F intent-specific answerability, Phase 76H product ingredient verification  
**Feeds:** Phase 76J dashboard food-rule UX

## Goal

Give the provider bounded, typed food-rule context and block provider output that contradicts deterministic engine decisions or invents unsupported plan changes.

## Scope

### In scope

- Bounded PromptContext segments: `food_rule_decision`, `allowed_food_rules`, `forbidden_food_rules`, `equivalent_exchange_rules`, `diet_type_rules`, `ingredient_verification`
- Food-rule provider instruction system segment
- Core `food-rule-prompt-segments.js` builder and `context-compiler.js` wiring
- Core `response-quality-guard.js` food-rule output violations
- Orchestrator passes structured food rules and engine decision into context compile and output guard
- App `ai-provider.ts` segment allowlist and Phase 75 prompt-field allowlist updates
- Tests for segment inclusion/exclusion, provider allowlist, output guard blocks, persona preservation

### Out of scope

- Dashboard food-rule UX (Phase 76J)
- Chat proposals (Phase 76K)
- Real Gemini egress
- Open web browsing
- Production pilot GO
- Launch-gate closure or R-405 resolution

## PromptContext segments

| Segment type | Content | Authority |
| --- | --- | --- |
| `food_rule_decision` | Engine decision, query type, matched food token ids — no raw inbound text | `food_rule_engine` |
| `allowed_food_rules` | Bounded allowed items/groups count and labels | `dietitian_approved_context` |
| `forbidden_food_rules` | Bounded forbidden items/groups count and labels | `dietitian_approved_context` |
| `equivalent_exchange_rules` | Exchange group ids and member counts | `dietitian_approved_context` |
| `diet_type_rules` | Diet type label and strictness summary | `dietitian_approved_context` |
| `ingredient_verification` | Verification decision, source type, confidence, keyword ids — no raw label text | `food_rule_engine` |

Segments are omitted when empty. Each segment is capped at 480 characters. Raw product label text never enters audit manifest keyword ids (Phase 76H contract preserved).

## Provider guard rules

Output guard blocks when a food-rule decision is active (`not_applicable` excluded):

- `food_rule_forbidden_food_approved` — rejection decisions paired with client-facing approval language
- `food_rule_unauthorized_skip_relaxation` — skip/relax language without `optional_skip_allowed`
- `food_rule_portion_or_macro_change` — portion, calorie, or macro increase suggestions
- `food_rule_unauthorized_substitution` — new alternative suggestions without `equivalent_substitution_allowed`

Existing covenant, persona, and `unsupported_plan_change` guards remain unchanged.

## Done criteria

- Provider receives only allowlisted food-rule segment types
- Engine decision bounds provider wording; rule-breaking output does not reach clients
- `npm run release:verify` passes
- Production pilot remains `NO-GO`
