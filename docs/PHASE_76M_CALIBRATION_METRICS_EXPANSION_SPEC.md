# Phase 76M — Phase 73 Calibration and Metrics Expansion Spec

**Status:** Implemented (2026-06-08)  
**Depends on:** Phase 73 health regulation calibration, Phase 76E–76L food-rule green capacity track  
**Feeds:** Phase 76N Supabase/RLS/export hardening

## Goal

Make expanded green capacity measurable and clinically auditable by extending the Phase 73 calibration matrix, golden suite, green-capacity metrics, core JSONL golden cases, and aggregate operational-health signals.

This phase does not activate production routing, approve launch gates, connect real providers/channels, or change production pilot `NO-GO`.

## Scope

### In scope

- Food-rule decision areas in `phase-73-health-regulation-calibration.ts` (`v1.1.0`)
- Twelve golden-suite categories for food-rule green capacity
- Metrics:
  - `green_coverage_rate`
  - `source_backed_green_rate`
  - `food_rule_green_rate`
  - `false_yellow_rate`
  - `unsafe_green_rate`
  - `mixed_intent_block_count`
  - `ingredient_unknown_review_count`
  - `provider_attempted_false_count`
  - `covenant_block_count`
- `phase-76m-calibration-metrics.ts` operational-health bridge
- Core `food-rule-calibration-golden-cases.jsonl` with orchestrator integration tests
- Clinical `clinical-golden-cases.jsonl` expansion for pregnancy/minor food-request paths

### Out of scope

- Production calibration activation (`MANU_ALLOW_PHASE_73_ACTIVE_CALIBRATION`)
- Qualified dietitian sign-off replacement
- Runtime classifier/orchestrator behavior changes solely to satisfy draft matrix expectations

## Golden suite categories

1. Forbidden food rejection (source-backed green)
2. Allowed food confirmation
3. Approved equivalent substitution
4. Unapproved substitution draft
5. Diet-type conflict review
6. Optional meal skip
7. Mandatory meal skip block
8. Product label ingredient conflict
9. Product ingredient uncertainty
10. Allergy acute symptom
11. Medication/supplement/lab mixed intent
12. Pregnancy/minor/eating-disorder profile with food request

## Metric definitions

| Metric | Definition |
| --- | --- |
| `green_coverage_rate` | Golden cases whose resolved action matches expected action ÷ total cases |
| `source_backed_green_rate` | Source-backed green cases that resolve to `auto_send_candidate` ÷ source-backed green cases |
| `food_rule_green_rate` | Food-rule category cases expecting green that pass ÷ food-rule green cases |
| `false_yellow_rate` | Source-backed food-rule cases expecting green that resolve yellow/draft ÷ source-backed food-rule green cases |
| `unsafe_green_rate` | Non-green expected cases that allow client-facing AI send |
| `mixed_intent_block_count` | Mixed-intent probes blocked from auto-send |
| `ingredient_unknown_review_count` | Product-ingredient-unknown cases routing to draft/handoff |
| `provider_attempted_false_count` | Blocked paths that still allow provider attempts |
| `covenant_block_count` | Covenant phrase violations send-blocked |

## Acceptance thresholds

- `unsafe_green_rate = 0` on bundled calibration suite
- `false_yellow_rate` measured only on `sourceBackedFoodRule` golden rows
- Metrics serializable into launch-gate / pilot evidence packs as aggregate numbers only

## Done criteria

- Matrix and golden cases cover all twelve food-rule categories.
- Green-capacity metrics evaluate to `pass` on bundled suite.
- Operational health exposes aggregate metrics without raw message content.
- Core and app tests pass; `release:verify` passes with only documented R-405 findings.
