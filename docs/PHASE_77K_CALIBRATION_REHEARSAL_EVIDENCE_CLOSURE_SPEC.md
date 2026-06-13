# Phase 77K: Calibration, 100x50 Rehearsal, And Evidence Closure

Date: 2026-06-10

## Goal

Close the Phase 77A-77K manual source authority rebaseline track with Food Decision V2 golden calibration, synthetic 100x50 rehearsal, aggregate evidence updates, and continuity documentation. WhatsApp production adapter becomes the next implementation track only after this phase passes local verification.

This phase does not approve production pilot launch, close external launch gates, connect real WhatsApp/Gemini, enable production lifecycle, or resolve R-405.

## Scope

- Food Decision V2 golden suite (`food-decision-v2-golden-cases.jsonl`) covering fourteen calibration categories from the master plan.
- `phase-77k-food-decision-v2-golden.ts` evaluator with profile V2 + active menu seeding.
- `phase-77k-food-mix-rehearsal.ts` deterministic 100 dietitian x 50 client rehearsal using V2 scenarios.
- `phase-77k-calibration-evidence.ts` aggregate metrics, export coverage (`phase74-export-v1.2`), and operational-health bridge.
- Operational-health and direct-pilot-scale-readiness fields for V2 calibration/rehearsal evidence.
- Continuity, pilot evidence, gate dossier, risk-register, and clinical taxonomy packet updates.

## Non-Goals

- Real WhatsApp webhook replay.
- Real Gemini/provider egress.
- Production GO or external gate closure.
- New persistent models or Supabase migrations.
- R-405 remediation.

## Golden Categories

| Category | Expected V2 posture |
| --- | --- |
| `allowed_food` | `allow` |
| `forbidden_food` | `forbid` |
| `forbidden_group` | `forbid` |
| `forbidden_ingredient` | `forbid` or `needs_review` via product path |
| `menu_substitution` | `allow` or legacy-approved substitution |
| `off_menu_allowed` | `allow` under flexible profile |
| `off_menu_discouraged` | `discourage` under restricted profile |
| `out_of_catalog_uncertain` | `needs_review` |
| `product_label_needs_ingredients` | `needs_label` |
| `weight_loss_flexibility` | `discourage` for treat off-menu |
| `weight_gain_flexibility` | `allow` under flexible goal |
| `mixed_clinical_intent` | `needs_review` |
| `allergy_acute_ingestion` | `not_applicable` on non-green risk |
| `pregnancy_context` | `needs_review` clinical escalation |

## Metrics

- `unsafe_green_count` must be 0 across V2 rehearsal.
- `inappropriate_approval_count` must be 0.
- `forbidden_food_approval_count` must be 0.
- `needs_label_correct_count` and `needs_review_correct_count` tracked against golden expectations.
- `export_coverage_pass` for `phase74-export-v1.2` files.
- `source_manifest_complete_count` when V2 results include profile/catalog/menu references.
- Operational-health output remains aggregate-only.

## Done Criteria

- Golden suite passes with zero failures.
- Sample and full 100x50 V2 rehearsal pass with zero unsafe green.
- Integration checks from Phase 76O remain green (duplicate inbound, provider failure, stale draft, chat mutation block, manual food-rule save).
- `npm run release:verify` passes with only documented R-405 findings.
- Continuity docs updated; next track is WhatsApp production adapter.
- Production pilot remains `NO-GO`.
