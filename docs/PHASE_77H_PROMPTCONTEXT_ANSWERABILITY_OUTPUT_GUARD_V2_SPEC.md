# Phase 77H: PromptContext, Answerability, Permission Graph, And Output Guard V2

Date: 2026-06-10
Status: Implemented locally; production pilot remains NO-GO.

## Goal

Adapt the AI pipeline so Food Decision Engine V2 and manual source authority bound provider styling without raw-data leakage or contradictory client-facing output.

## PromptContext V2 segments

| Segment type | Content | Authority |
| --- | --- | --- |
| `food_decision_v2` | V2 decision, query type, reason codes, menuOnPlan, flexibility — no raw inbound text | `food_decision_engine_v2` |
| `food_profile_summary` | Bounded forbidden/allowed counts from profile V2 | `food_rule_profile_v2` |
| `menu_authority` | Active menu template/status and on-plan flag | `menu_plan_v1` |
| `flexibility_modifier` | Effective flexibility, meal key, goal key | `food_rule_profile_v2` |
| `ingredient_evidence_v2` | Verification decision, source type, confidence, keyword ids — no raw label text | `product_ingredient_verification` |
| `food_source_manifest` | Approved source reference ids only | `food_decision_engine_v2` |

When `foodDecisionV2` is present and provider-eligible, V2 segments and provider instruction replace legacy `food_rule_decision` segments. Legacy structured forbidden/allowed segments remain as secondary context when structured rules exist.

## Answerability V2

- `food_rule_profile_v2`, `active_menu_plan`, and `master_food_catalog` are approved source categories when referenced by V2.
- Flexibility is a modifier segment, not a standalone clinical source.
- AI-generated `recent_message` segments remain excluded from source authority.
- Deprecated chat proposal records are not prompt sources (unchanged Phase 77B boundary).
- `needs_review` and `not_applicable` V2 decisions fail closed before provider generation.
- `needs_label` requires ingredient-keyword or trusted-product evidence categories.

## Output guard V2

| V2 decision | Blocked provider wording |
| --- | --- |
| `forbid` | Strong eat/drink approval language |
| `discourage` | Strong approval language (`food_decision_v2_discourage_strong_approval`) |
| `needs_label` | Allowed-food approval without label request (`food_decision_v2_needs_label_answered_as_allowed`) |
| `needs_review` | Provider call blocked upstream |

Legacy Phase 76I food-rule guard remains active for mapped legacy decisions. Product communication covenant unchanged.

## Permission graph V2

`mapFoodDecisionV2ToPermissionIntents` maps V2 decisions to Phase 72 food-rule intent bands for shadow/audit routing on the simulator path.

## Verification

```text
cd dietitian-ai-assistant
node --test tests/food-decision-v2-prompt-guard.test.mjs
cd ../app
npx vitest run src/lib/phase-77h-prompt-context-guard-v2.test.ts
npm run release:verify
```

Phase 77H verified on 2026-06-10: `npm run release:verify` passed with core tests 173/173, app tests 315/315, lint with two pre-existing warnings, production build, and only documented R-405 findings. Production pilot remains `NO-GO`.

## Out of scope

- Simplified dietitian UX (Phase 77I).
- DOCX/PDF export (Phase 77J).
- Real provider/channel connections.
- R-405 remediation.
