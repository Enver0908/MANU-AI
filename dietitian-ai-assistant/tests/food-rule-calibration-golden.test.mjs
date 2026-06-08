import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handleInboundMessage } from "../src/orchestrator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const goldenCases = readFileSync(join(__dirname, "food-rule-calibration-golden-cases.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));

const baseInput = {
  tenantId: "tenant-1",
  dietitian: {
    id: "dietitian-1",
    tenantId: "tenant-1",
    displayName: "Dyt. Ayse",
    timezone: "Europe/Istanbul",
  },
  client: {
    id: "client-1",
    tenantId: "tenant-1",
    dietitianId: "dietitian-1",
    fullName: "Mert Kaya",
    lifecycleStatus: "active",
    selectedPersonaId: "balanced_coach",
    aiStatus: "active",
    aiMode: "autopilot",
    channelPermission: "ready",
    channelUserId: "wa-mert",
    mandatorySafetyComplete: true,
    humanTakeoverLocked: false,
    redRiskLock: { status: "none" },
    healthProfile: { goal: "fat_loss", adultStatus: "adult" },
    dietPlan: { breakfast: "eggs and vegetables" },
    allergies: [],
    restrictedFoods: [],
    clinicalRiskNotes: [],
    pinnedNotes: [],
  },
  conversation: {
    id: "conversation-1",
    tenantId: "tenant-1",
    dietitianId: "dietitian-1",
    clientId: "client-1",
    channel: "whatsapp",
  },
  recentMessages: [],
  memory: {
    rollingSummary: "Client asks about structured food rules.",
    durableFacts: {},
  },
};

for (const goldenCase of goldenCases) {
  test(`food rule calibration golden case: ${goldenCase.id}`, async () => {
    let providerCalls = 0;
    const result = await handleInboundMessage(
      {
        ...baseInput,
        message: { body: goldenCase.message },
        structuredFoodRules: goldenCase.structuredFoodRules,
        productIngredientEvidence: goldenCase.productIngredientEvidence || null,
      },
      {
        generateReply: async () => {
          providerCalls += 1;
          return "Plana uygun kisa bir yanit taslagi.";
        },
      },
    );

    assert.equal(result.risk, goldenCase.expectedRisk, goldenCase.id);
    assert.equal(result.action, goldenCase.expectedAction, goldenCase.id);
    assert.equal(result.model, goldenCase.expectedModel, goldenCase.id);
    assert.equal(result.providerAttempted, goldenCase.providerCallExpected, goldenCase.id);
    assert.equal(providerCalls > 0, goldenCase.providerCallExpected, goldenCase.id);
  });
}
