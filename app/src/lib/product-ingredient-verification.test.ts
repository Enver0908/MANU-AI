import { describe, expect, it } from "vitest";
import {
  buildProductIngredientEvidenceFromMessage,
  evaluateProductIngredientVerification,
  extractUserLabelTextFromMessage,
} from "./product-ingredient-verification";
import { createInitialState } from "./seed-data";
import { runInboundSimulation } from "./simulator";

describe("product ingredient verification", () => {
  it("extracts user label text from inbound message", () => {
    expect(extractUserLabelTextFromMessage("Bu cikolatanin icindekiler: sut, seker, kakao")).toBe(
      "sut, seker, kakao",
    );
  });

  it("builds trusted user-label evidence from product query messages", () => {
    const evidence = buildProductIngredientEvidenceFromMessage(
      "Bu cikolatanin icindekiler: milk, whey, casein, sugar",
    );

    expect(evidence).toEqual({
      ingredientSourceType: "user_label_text",
      ingredientText: "milk, whey, casein, sugar",
      ingredientConfidence: "exact",
    });
  });

  it("requires review when source type is unknown", () => {
    const result = evaluateProductIngredientVerification({
      ingredientSourceType: "unknown",
      ingredientText: "milk",
      ingredientConfidence: "exact",
      ingredientAllergenKeywords: ["sut"],
      forbiddenFoodGroups: ["Sut urunleri"],
    });

    expect(result.decision).toBe("requires_review");
  });
});

describe("product ingredient verification runtime", () => {
  it("blocks dairy label conflict on autopilot green path via simulator", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Bu cikolatanin icindekiler: sut, laktoz, seker, kakao",
      idempotencyKey: "phase76h-product-block-1",
      now: "2026-06-08T12:00:00.000Z",
    });

    const foodRule = state.aiDecisions.at(-1)?.contextManifest?.foodRule as {
      decision?: string;
      verification?: { decision?: string };
    };

    expect(state.lastSimulation?.action).toBe("sent");
    expect(foodRule?.decision).toBe("product_ingredient_conflict");
    expect(foodRule?.verification?.decision).toBe("product_blocked");
  });

  it("routes uncertain embedded label text to review without green approval", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Bu cikolatanin icindekiler belirsiz, emin degilim",
      idempotencyKey: "phase76h-product-uncertain-1",
      now: "2026-06-08T12:01:00.000Z",
    });

    const foodRule = state.aiDecisions.at(-1)?.contextManifest?.foodRule as { decision?: string };

    expect(state.lastSimulation?.action).not.toBe("sent");
    expect(foodRule?.decision).toBe("product_ingredient_unknown");
  });
});
