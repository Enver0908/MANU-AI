import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  FOOD_UNDERSTANDING_V3_VERSION,
  evaluateMixedDishUnderstanding,
  findMenuRecipeForPhrase,
  isBrandOrPackagedProductQuery,
  resolveFoodAliasMatches,
} from "../src/food-understanding-v3.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));

function loadGoldenCases() {
  const raw = readFileSync(join(moduleDir, "food-understanding-golden-cases.jsonl"), "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("food understanding v3 version", () => {
  assert.equal(FOOD_UNDERSTANDING_V3_VERSION, "food-understanding-v3-v0.1.0");
});

test("food understanding v3 golden cases", () => {
  const globalAliases = [
    {
      id: "alias-global-et",
      tenantId: "global",
      alias: "et",
      foodId: "et__kirmizi-et__dana-eti",
      matchType: "exact",
      qaApproved: false,
      autopilotEligible: false,
    },
    {
      id: "alias-global-beyaz-peynir",
      tenantId: "global",
      alias: "beyaz peynir",
      foodId: "sut-urunleri__peynir__beyaz-peynir",
      matchType: "exact",
      qaApproved: true,
      autopilotEligible: true,
    },
  ];

  for (const entry of loadGoldenCases()) {
    if (entry.kind === "alias_match") {
      const matches = resolveFoodAliasMatches(entry.phrase, { globalAliases, tenantApprovedAliases: [] });
      if (entry.expectMatch) {
        assert.ok(matches.length > 0, entry.id);
        assert.equal(matches[0].foodId, entry.expectedFoodId, entry.id);
        assert.equal(matches[0].autopilotEligible, entry.expectedAutopilotEligible, entry.id);
      } else {
        assert.equal(matches.length, 0, entry.id);
      }
    }

    if (entry.kind === "brand_query") {
      assert.equal(isBrandOrPackagedProductQuery(entry.message), entry.expected, entry.id);
    }

    if (entry.kind === "mixed_dish") {
      const result = evaluateMixedDishUnderstanding({
        message: entry.message,
        menu: entry.menu || null,
        foodPhrase: entry.foodPhrase || null,
      });
      assert.equal(result.decision, entry.expectedDecision, entry.id);
    }
  }
});

test("findMenuRecipeForPhrase returns recipe ingredients when present", () => {
  const menu = {
    mealSlots: [
      {
        items: [
          {
            id: "item-kisir",
            label: "Kisir",
            freeText: "kisir",
            recipe: {
              title: "Kisir",
              ingredients: ["bulgur", "maydanoz", "domates"],
              instructions: "Karistir",
            },
          },
        ],
        alternatives: [],
      },
    ],
  };

  const recipe = findMenuRecipeForPhrase(menu, "kisir");
  assert.ok(recipe);
  assert.equal(recipe.ingredients.length, 3);
});
