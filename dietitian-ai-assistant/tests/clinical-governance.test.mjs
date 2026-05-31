import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handleInboundMessage } from "../src/orchestrator.js";
import { classifyDieteticRisk } from "../src/safety-classifier.js";
import { personas } from "../src/personas.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const goldenCases = readFileSync(join(__dirname, "clinical-golden-cases.jsonl"), "utf8")
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
    selectedPersonaId: "balanced_coach",
    aiStatus: "active",
    aiMode: "autopilot",
    healthProfile: { goal: "fat_loss" },
    dietPlan: { breakfast: "eggs and vegetables" },
    allergies: ["peanut"],
    restrictedFoods: [],
    clinicalRiskNotes: [],
    pinnedNotes: ["No peanut suggestions."],
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
    rollingSummary: "Client usually asks for practical swaps.",
    durableFacts: {},
  },
};

for (const goldenCase of goldenCases) {
  test(`clinical golden case: ${goldenCase.id}`, async () => {
    let providerCalls = 0;
    const result = await handleInboundMessage(
      {
        ...baseInput,
        message: { body: goldenCase.message },
      },
      {
        generateReply: async () => {
          providerCalls += 1;
          return "Plana uygun kisa bir yanit taslagi.";
        },
      },
    );

    assert.equal(result.risk, goldenCase.expectedRisk);
    assert.equal(result.action, goldenCase.expectedAction);
    assert.equal(result.model, goldenCase.expectedModel);
    assert.equal(result.providerAttempted, goldenCase.providerCallExpected);
    assert.equal(providerCalls > 0, goldenCase.providerCallExpected);
  });
}

test("persona changes do not alter golden risk, action, or model decisions", async () => {
  const invariantCases = goldenCases.filter((item) => item.expectedRisk !== "green");

  for (const goldenCase of invariantCases) {
    const outcomes = [];

    for (const persona of personas) {
      const result = await handleInboundMessage(
        {
          ...baseInput,
          client: { ...baseInput.client, selectedPersonaId: persona.id },
          message: { body: goldenCase.message },
        },
        {
          generateReply: async () => "Plana uygun kisa bir yanit taslagi.",
        },
      );

      outcomes.push([result.risk, result.action, result.model]);
    }

    assert.deepEqual(
      outcomes,
      personas.map(() => [goldenCase.expectedRisk, goldenCase.expectedAction, goldenCase.expectedModel]),
      goldenCase.id,
    );
  }
});

test("classifier covers every golden case with the expected risk", () => {
  for (const goldenCase of goldenCases) {
    assert.equal(classifyDieteticRisk(goldenCase.message).level, goldenCase.expectedRisk, goldenCase.id);
  }
});
