# Phase 76H — Product Ingredient Verification Spec

**Status:** Implemented (2026-06-08)  
**Depends on:** Phase 76E food rule engine, Phase 76F intent-specific answerability  
**Feeds:** Phase 76I PromptContext and output guard hardening

## Goal

Bind product ingredient questions such as “does this chocolate contain milk?” to trusted-source verification before food-rule engine decisions. Uncertain products fail closed to review.

## Scope

### In scope

- Core `product-ingredient-verification.js` verification contract
- App `product-ingredient-verification.ts` bridge with user-label extraction from inbound messages
- Food rule engine consumes verification decisions on the product-ingredient path
- Food-rule runtime and simulator risk auto-build of user-label evidence when label text is embedded in the message
- Tests for forbidden keyword block, uncertain label review, unknown source review, and diet-type conflict on product labels

### Out of scope

- Open web browsing or grounding/search
- Photo OCR production path
- Real barcode/catalog provider connections
- PromptContext food-rule segments (implemented in Phase 76I)
- Provider, channel, launch-gate, R-405, or real-data changes

## Verification contract

`evaluateProductIngredientVerification` returns:

- `ingredientSourceType`: `user_label_text`, `barcode_database`, `approved_product_catalog`, `dietitian_product_note`, or `unknown`
- `ingredientConfidence`: `exact`, `high`, `low`, or `unknown`
- `matchedForbiddenKeywordIds`: normalized ids such as `keyword:sut` (no raw label text in audit ids)
- `decision`: `product_allowed`, `product_blocked`, or `requires_review`

Rules:

- Untrusted source type, missing label text, or low/unknown confidence → `requires_review`
- Exact/high confidence forbidden keyword match → `product_blocked`
- Exact/high confidence with no forbidden keyword but diet-type conflict in label text → `product_blocked` with `dietTypeConflict=true`
- Exact/high confidence with no forbidden or diet-type conflict → `product_allowed`

Food-rule engine mapping:

- `product_blocked` + forbidden keyword → `product_ingredient_conflict`
- `product_blocked` + diet type conflict → `diet_type_conflict`
- `product_allowed` → `allowed_food_confirmation`
- `requires_review` → `product_ingredient_unknown`

## Done criteria

- Product decisions depend on source type and confidence
- Uncertain products never receive green approval
- `npm run release:verify` passes
- Production pilot remains `NO-GO`
