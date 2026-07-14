import test from "node:test";
import assert from "node:assert/strict";
import {
  buildApprovedDietitianVisualSources,
  buildSourceGatedVisualProviderContext,
  evaluateMultiImageSourceIdentity,
  extractAllowlistedConflictTokens,
} from "../src/visual-source-gate-v1.js";
import { assertProviderContextExcludesRawOcr } from "../src/visual-evidence-source-v2.js";

const ANALYSIS_ID = "11111111-1111-4111-8111-111111111111";
const ANALYSIS_ID_2 = "22222222-2222-4222-8222-222222222222";

test("source gate extracts only allowlisted forbidden conflict tokens", () => {
  const tokens = extractAllowlistedConflictTokens({
    observation: {
      ocrBlocks: [{ text: "Icindekiler: sut, seker, fistik", blockKind: "label" }],
    },
    foodRules: {
      forbiddenFoodItems: ["fistik"],
      forbiddenFoodGroups: [],
      ingredientAllergenKeywords: ["sut"],
    },
  });
  assert.ok(tokens.some((token) => token.startsWith("forbidden_conflict_")));
  assert.equal(tokens.some((token) => token.includes("Icindekiler")), false);
});

test("source gated provider context excludes raw OCR payloads", () => {
  const context = buildSourceGatedVisualProviderContext({
    envelope: {
      visualSegments: [
        {
          analysisId: ANALYSIS_ID,
          observation: {
            entityCandidates: [{ normalizedLabel: "izgara tavuk" }],
            ocrBlocks: [{ text: "secret ocr", blockKind: "label" }],
          },
          captionText: null,
          observedAt: "2026-07-14T10:00:00.000Z",
        },
      ],
    },
    meaning: {
      visualSegments: [
        {
          analysisId: ANALYSIS_ID,
          mediaAssetId: "asset-1",
          sceneType: "meal",
          workflowState: "meal_exact_menu",
          sourceAuthority: "approved_menu_exact",
          approvedSourceId: "menu-item-1",
          menuMatch: { menuItemId: "menu-item-1", matchedLabel: "izgara tavuk" },
        },
      ],
    },
    foodRules: {},
  });

  assert.equal(context.excludesRawOcr, true);
  assert.equal(JSON.stringify(context).includes("secret ocr"), false);
  assert.doesNotThrow(() => assertProviderContextExcludesRawOcr(context));
});

test("multi-image source identity requires same approved source id", () => {
  const mismatch = evaluateMultiImageSourceIdentity([
    { workflowState: "meal_exact_menu", approvedSourceId: "menu-item-1", menuMatch: { menuItemId: "menu-item-1" } },
    { workflowState: "meal_exact_menu", approvedSourceId: "menu-item-2", menuMatch: { menuItemId: "menu-item-2" } },
  ]);
  assert.equal(mismatch.consistent, false);
  assert.equal(mismatch.reasonCode, "visual_multiple_images_source_identity_mismatch");

  const match = evaluateMultiImageSourceIdentity([
    { workflowState: "meal_exact_menu", approvedSourceId: "menu-item-1", menuMatch: { menuItemId: "menu-item-1" } },
    { workflowState: "meal_exact_menu", approvedSourceId: "menu-item-1", menuMatch: { menuItemId: "menu-item-1" } },
  ]);
  assert.equal(match.consistent, true);
});

test("approved dietitian sources include pinned notes and context updates", () => {
  const sources = buildApprovedDietitianVisualSources({
    pinnedNotes: ["Avoid peanut suggestions."],
    contextUpdates: [{ id: "ctx-1", summary: "Client prefers evening snacks." }],
  });
  assert.equal(sources.length, 2);
  assert.equal(sources[0].authority, "dietitian_authored");
  assert.equal(sources[1].sourceId, "ctx-1");
});

test("multi-image identity fails when approved source is missing", () => {
  const result = evaluateMultiImageSourceIdentity([
    { workflowState: "screenshot_approved_source_hit", approvedSourceId: "menu-item-1" },
    { workflowState: "screenshot_approved_source_hit", approvedSourceId: null },
  ]);
  assert.equal(result.consistent, false);
  assert.equal(result.reasonCode, "visual_multiple_images_missing_approved_source");
});
