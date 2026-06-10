# Phase 77D: Master Food Catalog V1

Date: 2026-06-10
Status: Planned for local implementation; production pilot remains NO-GO.

## Source

User-supplied workbook: `C:\Users\Dell\Downloads\manual.xlsx`

Workbook SHA-256: `DB3AF129BC9E814DBB5247E5A2FBCD49A0184FB0B6BC046B75DE99F78A266C21`

Authoritative sheet: `Besin Veritabani`

The workbook has two sheets. Only `Besin Veritabani` is in scope for this phase. `Baslangic,Hedef, Guncel` is not imported into the catalog.

Extracted catalog facts:

- 12 repeated column blocks in the form `Ana Kategori / Alt Kategori / Gida`.
- 518 unique category-subcategory-food triples.
- 12 main categories.
- 113 subcategories.
- 518 food rows.
- No duplicate triples.
- 18 food names appear in more than one category/subcategory context, so runtime identity must use stable ids instead of food name alone.
- Extracted record-set SHA-256: `6b9e53577dfcba8f9af2839f0bb3017163f756b5880582ac2e18f6d274042e9f`

## Product Requirements

- The dietitian must be able to mark forbidden foods at three hierarchy levels:
  - main category,
  - subcategory,
  - individual food.
- Selecting a main category means every subcategory and every food under that main category is forbidden for the client.
- Selecting a subcategory means every food under that subcategory is forbidden for the client.
- Selecting an individual food means only that food record is forbidden for the client.
- Unchecked foods are not automatically treated as clinically approved. They are simply not forbidden by this catalog selection.
- The catalog is global and source-controlled in the local prototype. Per-client selections are stored in client form answers.
- The catalog must preserve Turkish food names from the user workbook.
- The UI must avoid forcing the dietitian to type from memory; the catalog hierarchy must be available as checkbox controls.

## Technical Requirements

- Add a generated local catalog data file under `app/src/lib`.
- Add a typed catalog module that:
  - exposes catalog metadata and stats,
  - validates uniqueness and hierarchy integrity,
  - finds main categories, subcategories, and foods by stable id,
  - expands forbidden selections into forbidden group names and forbidden food names,
  - deduplicates expanded names while preserving stable ids.
- Extend the existing food-rule dashboard state with:
  - `forbiddenCatalogMainCategoryIds`,
  - `forbiddenCatalogSubCategoryIds`,
  - `forbiddenCatalogFoodIds`.
- Keep compatibility with the existing Phase 76 runtime by writing expanded catalog selections into:
  - `forbidden_food_items`,
  - `forbidden_food_groups`.
- Store catalog provenance alongside form answers:
  - `food_catalog_version`,
  - `food_catalog_source_sha256`,
  - `food_catalog_record_set_sha256`,
  - `food_catalog_forbidden_main_category_ids`,
  - `food_catalog_forbidden_sub_category_ids`,
  - `food_catalog_forbidden_food_ids`.
- Loading a saved dashboard state must subtract catalog-expanded names from the manual free-text forbidden lists so unchecking a category does not leave stale expanded foods behind.

## Runtime Boundary

This phase creates the master catalog and the hierarchical forbidden-selection bridge.

It does not implement Food Decision Engine V2. The current core food-rule engine still has limited keyword/group inference. Phase 77G must replace that with catalog-aware deterministic matching, aliases, confidence thresholds, and Food Decision V2 send semantics.

## Edge Cases

- Duplicate food names in different categories must remain separate food ids.
- If a main category and one of its subcategories are both selected, the expanded forbidden foods must not duplicate.
- If a subcategory and one food inside it are both selected, the expanded forbidden foods must not duplicate.
- Unknown saved ids must not crash the dashboard; they should be ignored by expansion and surfaced through validation warnings where applicable.
- Turkish characters must be preserved in names, but stable ids must remain ASCII slugs.
- Selecting `Süt Ürünleri` must forbid every food under that main category.
- Selecting `Yağ / Hayvansal Yağlar` must forbid all foods under that subcategory.
- Selecting only one food must forbid only that food record.

## Verification

Required local checks:

```text
cd app
npx vitest run src/lib/phase-77d-master-food-catalog.test.ts src/lib/phase-76j-food-rule-dashboard.test.ts src/lib/food-rule-runtime.test.ts
npm run release:verify
```

## Done Criteria

- Source workbook is parsed into the local catalog data.
- Catalog stats and checksums are documented.
- Main/subcategory/food checkbox selections expand deterministically.
- Dashboard save path stores selection ids and expanded forbidden food/group values.
- Existing Phase 76 food-rule runtime remains compatible.
- Tests and release verification pass.
- Production pilot remains NO-GO.
