import test from "node:test";
import assert from "node:assert/strict";
import {
  MISSING_HISTORICAL_CONTEXT_INSTRUCTION,
  compilePromptContext,
  renderPromptContext,
} from "../src/context-compiler.js";
import { guardProviderOutput } from "../src/response-quality-guard.js";
import { getPersona } from "../src/personas.js";
import { defaultVoiceProfile } from "../src/voice-profile.js";

const capsule = {
  tenantId: "tenant-1",
  dietitian: { id: "dietitian-1", displayName: "Dyt. Ayse", timezone: "Europe/Istanbul" },
  client: {
    id: "client-1",
    fullName: "Mert Kaya",
    dietPlan: { summary: "Three meals and one snack." },
    allergies: ["peanut"],
    restrictedFoods: ["fried foods"],
    pinnedNotes: ["No peanut suggestions."],
    clientFormSummary: "Daily routine: walks after dinner",
    contextRevision: 2,
  },
  conversation: { id: "conversation-1", channel: "whatsapp" },
  persona: getPersona("balanced_coach"),
  voiceProfile: defaultVoiceProfile(),
  memory: { rollingSummary: "Client prefers practical swaps.", memoryVersion: "memory-v1", memoryRevision: 3 },
};

test("compiler creates prompt context and manifest without raw text in manifest segments", () => {
  const compiled = compilePromptContext({
    capsule,
    currentMessage: "Bugun kahvaltida ne yiyebilirim?",
    recentMessages: [
      { id: "message-1", origin: "client_inbound", status: "stored", body: "Dunku ara ogun nasildi?" },
      { id: "message-2", origin: "system_event", status: "stored", body: "internal event" },
    ],
    riskLevel: "green",
    promptVersion: "prompt-v1",
  });

  assert.equal(compiled.blockedReason, null);
  assert.ok(renderPromptContext(compiled.promptContext).includes(MISSING_HISTORICAL_CONTEXT_INSTRUCTION));
  assert.ok(compiled.promptContext.segments.some((segment) => segment.type === "recent_message"));
  assert.equal(compiled.contextManifest.hashMode, "none_v1");
  assert.equal(compiled.contextManifest.memoryIncluded, true);
  assert.equal(compiled.contextManifest.memoryRevision, 3);
  assert.ok(compiled.promptContext.segments.some((segment) => segment.type === "client_form_summary"));
  assert.equal(compiled.contextManifest.excludedCounts.nonPromptableMessages, 1);
  assert.equal(JSON.stringify(compiled.contextManifest).includes("Bugun kahvaltida"), false);
  assert.equal(JSON.stringify(compiled.contextManifest).includes("Dunku ara"), false);
});

test("compiler blocks over-budget current messages without truncating", () => {
  const compiled = compilePromptContext({
    capsule,
    currentMessage: "a".repeat(1600),
    recentMessages: [],
    riskLevel: "green",
  });

  assert.equal(compiled.blockedReason, "current_message_token_budget_exceeded");
  assert.deepEqual(compiled.promptContext.segments, []);
  assert.deepEqual(compiled.contextManifest.validation.reasons, ["current_message_token_budget_exceeded"]);
});

test("compiler keeps at most eight recent promptable messages", () => {
  const recentMessages = Array.from({ length: 500 }, (_, index) => ({
    id: `message-${index + 1}`,
    origin: "client_inbound",
    status: "stored",
    body: `message ${index + 1}`,
  }));

  const compiled = compilePromptContext({
    capsule,
    currentMessage: "Bugun ne yiyebilirim?",
    recentMessages,
    riskLevel: "green",
  });

  assert.equal(compiled.promptContext.segments.filter((segment) => segment.type === "recent_message").length, 8);
});

test("provider output guard blocks missing historical context token", () => {
  const result = guardProviderOutput({
    output: "[ERROR: missing_historical_context]",
    capsule,
    riskDecision: { level: "green" },
  });

  assert.equal(result.allowed, false);
  assert.ok(result.issues.some((issue) => issue.code === "missing_historical_context"));
});
