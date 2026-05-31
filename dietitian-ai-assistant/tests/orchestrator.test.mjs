import test from "node:test";
import assert from "node:assert/strict";
import { handleInboundMessage } from "../src/orchestrator.js";
import { buildDietitianVoiceProfile } from "../src/voice-profile.js";
import { MESSAGE_ORIGINS, buildMessageProvenance } from "../src/message-provenance.js";

const baseInput = {
  tenantId: "tenant-1",
  dietitian: {
    id: "dietitian-1",
    tenantId: "tenant-1",
    displayName: "Dyt. Ayşe",
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
  message: {
    body: "Bugün kahvaltıda yumurta yerine ne yiyebilirim?",
  },
  recentMessages: [],
  memory: {
    rollingSummary: "Client usually asks for practical swaps.",
    durableFacts: {},
  },
};

test("green autopilot sends guarded reply", async () => {
  const sent = [];
  const models = [];
  const result = await handleInboundMessage(baseInput, {
    generateReply: async ({ model }) => {
      models.push(model);
      return "Yumurta yerine lor peyniri ve bol yeşillik iyi bir seçenek olur.";
    },
    sendMessage: async (payload) => sent.push(payload),
  });

  assert.equal(result.action, "sent");
  assert.equal(result.risk, "green");
  assert.equal(result.model, "gemini-1.5-flash");
  assert.equal(result.providerAttempted, true);
  assert.deepEqual(models, ["gemini-1.5-flash"]);
  assert.equal(sent.length, 1);
});

test("red risk creates handoff and does not generate", async () => {
  let generated = false;
  const handoffs = [];

  const result = await handleInboundMessage(
    {
      ...baseInput,
      message: { body: "Boğazım şişti ve alerjiden nefes alamıyorum." },
    },
    {
      generateReply: async () => {
        generated = true;
        return "ok";
      },
      onHandoff: async (handoff) => handoffs.push(handoff),
    },
  );

  assert.equal(result.action, "handoff");
  assert.equal(result.risk, "red");
  assert.equal(result.model, null);
  assert.equal(result.providerAttempted, false);
  assert.equal(generated, false);
  assert.equal(handoffs.length, 1);
  assert.equal(handoffs[0].urgency, "urgent");
});

test("passive client does not call AI even for green message", async () => {
  let generated = false;
  const result = await handleInboundMessage(
    {
      ...baseInput,
      client: { ...baseInput.client, aiStatus: "passive" },
    },
    {
      generateReply: async () => {
        generated = true;
        return "ok";
      },
    },
  );

  assert.equal(result.action, "no_ai");
  assert.equal(result.blockedReason, "client_ai_passive");
  assert.equal(result.aiStatus, "passive");
  assert.equal(result.model, null);
  assert.equal(result.providerAttempted, false);
  assert.equal(generated, false);
});

test("scheduled activation waits until active window starts", async () => {
  let generated = false;
  const result = await handleInboundMessage(
    {
      ...baseInput,
      now: "2026-05-22T10:00:00.000Z",
      client: {
        ...baseInput.client,
        aiStatus: "active",
        aiActiveFrom: "2026-05-22T11:00:00.000Z",
      },
    },
    {
      generateReply: async () => {
        generated = true;
        return "ok";
      },
    },
  );

  assert.equal(result.action, "no_ai");
  assert.equal(result.blockedReason, "client_ai_not_started");
  assert.equal(result.activation.status, "scheduled");
  assert.equal(result.model, null);
  assert.equal(result.providerAttempted, false);
  assert.equal(generated, false);
});

test("manual, paused, and context-budget blocks do not report provider attempts", async () => {
  let generated = false;

  const manual = await handleInboundMessage(
    {
      ...baseInput,
      client: { ...baseInput.client, aiMode: "manual" },
    },
    {
      generateReply: async () => {
        generated = true;
        return "ok";
      },
    },
  );
  assert.equal(manual.action, "no_ai");
  assert.equal(manual.model, null);
  assert.equal(manual.providerAttempted, false);

  const paused = await handleInboundMessage(
    {
      ...baseInput,
      client: { ...baseInput.client, aiMode: "paused" },
    },
    {
      generateReply: async () => {
        generated = true;
        return "ok";
      },
    },
  );
  assert.equal(paused.action, "handoff");
  assert.equal(paused.model, null);
  assert.equal(paused.providerAttempted, false);

  const overBudget = await handleInboundMessage(
    {
      ...baseInput,
      message: { id: "message-over-budget", body: "a".repeat(1600) },
    },
    {
      generateReply: async () => {
        generated = true;
        return "ok";
      },
    },
  );
  assert.equal(overBudget.action, "no_ai");
  assert.equal(overBudget.blockedReason, "current_message_token_budget_exceeded");
  assert.equal(overBudget.model, null);
  assert.equal(overBudget.providerAttempted, false);
  assert.equal(generated, false);
});

test("copilot mode drafts green messages for approval with flash model", async () => {
  const drafts = [];
  const models = [];
  const result = await handleInboundMessage(
    {
      ...baseInput,
      client: { ...baseInput.client, aiMode: "copilot" },
    },
    {
      generateReply: async ({ model }) => {
        models.push(model);
        return "Bunu plana uygun şekilde yoğurt ve meyveyle değiştirebilirsiniz.";
      },
      onDraftForApproval: async (draft) => drafts.push(draft),
    },
  );

  assert.equal(result.action, "draft_for_approval");
  assert.equal(result.model, "gemini-1.5-flash");
  assert.equal(result.providerAttempted, true);
  assert.deepEqual(models, ["gemini-1.5-flash"]);
  assert.equal(drafts.length, 1);
});

test("yellow risk uses gemini 3 for approval draft", async () => {
  const drafts = [];
  const models = [];

  const result = await handleInboundMessage(
    {
      ...baseInput,
      message: { body: "D vitamini takviyesi kullanayım mı?" },
    },
    {
      generateReply: async ({ model }) => {
        models.push(model);
        return "Bunu diyetisyeninizin onaylaması daha doğru olur; taslak olarak not düşüyorum.";
      },
      onDraftForApproval: async (draft) => drafts.push(draft),
    },
  );

  assert.equal(result.risk, "yellow");
  assert.equal(result.action, "draft_for_approval");
  assert.equal(result.model, "gemini-3");
  assert.equal(result.providerAttempted, true);
  assert.deepEqual(models, ["gemini-3"]);
  assert.equal(drafts.length, 1);
});

test("quality guard blocks unsafe draft", async () => {
  const handoffs = [];
  const result = await handleInboundMessage(baseInput, {
    generateReply: async () => "Diyetini değiştirelim ve kalorini 900 yapalım.",
    onHandoff: async (handoff) => handoffs.push(handoff),
  });

  assert.equal(result.action, "handoff");
  assert.equal(result.blockedReason, "quality_guard_failed");
  assert.equal(result.providerAttempted, true);
  assert.match(result.qualityIssues.join(","), /unsupported_plan_change/);
  assert.equal(handoffs.length, 1);
});

test("tenant isolation prevents cross-client context", async () => {
  await assert.rejects(
    () =>
      handleInboundMessage(
        {
          ...baseInput,
          conversation: { ...baseInput.conversation, clientId: "other-client" },
        },
        {
          generateReply: async () => "ok",
        },
      ),
    /Conversation does not match/,
  );
});

test("voice profile captures style from samples", () => {
  const profile = buildDietitianVoiceProfile([
    "Harika gidiyorsun canım, bugün su takibini unutma 😊",
    "Süper, aynı şekilde devam.",
  ]);

  assert.equal(profile.formality, "informal");
  assert.equal(profile.emojiPolicy, "limited");
  assert.ok(profile.averageMessageChars > 10);
});

test("message provenance distinguishes AI and dietitian messages", () => {
  const aiMessage = buildMessageProvenance({
    origin: MESSAGE_ORIGINS.aiGenerated,
    generatedByAiDecisionId: "decision-1",
    sourceMessageId: "client-message-1",
  });

  const dietitianMessage = buildMessageProvenance({
    origin: MESSAGE_ORIGINS.dietitianManual,
    authorDietitianId: "dietitian-1",
    sourceMessageId: "client-message-2",
  });

  assert.equal(aiMessage.origin, "ai_generated");
  assert.equal(aiMessage.generatedByAiDecisionId, "decision-1");
  assert.equal(dietitianMessage.origin, "dietitian_manual");
  assert.equal(dietitianMessage.authorDietitianId, "dietitian-1");
});
