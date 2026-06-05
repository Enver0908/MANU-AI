import test from "node:test";
import assert from "node:assert/strict";
import { decideModeAction, handleInboundMessage } from "../src/orchestrator.js";
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
  assert.equal(result.contextManifest?.answerability?.decision, "source_backed_green");
  assert.ok(result.contextManifest?.answerability?.sourceCategories.includes("active_diet_plan"));
  assert.equal(result.contextManifest?.greenIntent?.decision, "green_intent_allowed");
  assert.equal(result.contextManifest?.greenIntent?.intentFamily, "green_allowed_substitution");
});

test("green autopilot blocks before provider when approved sources are missing", async () => {
  let generated = false;
  const handoffs = [];

  const result = await handleInboundMessage(
    {
      ...baseInput,
      client: {
        ...baseInput.client,
        dietPlan: {},
        allergies: [],
        restrictedFoods: [],
        pinnedNotes: [],
        clientFormSummary: "",
        contextUpdates: [],
      },
      recentMessages: [],
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
  assert.equal(result.blockedReason, "approved_source_answerability_missing");
  assert.equal(result.providerAttempted, false);
  assert.equal(result.model, null);
  assert.equal(generated, false);
  assert.equal(handoffs.length, 1);
  assert.equal(result.contextManifest?.answerability?.decision, "handoff_required");
  assert.ok(result.reasons.includes("approved_source_missing"));
});

test("ai-generated messages do not satisfy approved source answerability", async () => {
  let generated = false;
  const result = await handleInboundMessage(
    {
      ...baseInput,
      client: {
        ...baseInput.client,
        dietPlan: {},
        allergies: [],
        restrictedFoods: [],
        pinnedNotes: [],
      },
      recentMessages: [
        {
          id: "message-ai-only",
          origin: "ai_generated",
          status: "sent",
          body: "Yumurta yerine lor peyniri olabilir.",
          createdAt: "2026-05-22T09:00:00.000Z",
        },
      ],
    },
    {
      generateReply: async () => {
        generated = true;
        return "ok";
      },
    },
  );

  assert.equal(result.action, "handoff");
  assert.equal(result.blockedReason, "approved_source_answerability_missing");
  assert.equal(result.providerAttempted, false);
  assert.equal(generated, false);
  assert.deepEqual(result.contextManifest?.answerability?.sourceCategories, []);
});

test("dietitian manual messages can satisfy approved source answerability", async () => {
  let generated = false;
  const result = await handleInboundMessage(
    {
      ...baseInput,
      client: {
        ...baseInput.client,
        dietPlan: {},
        allergies: [],
        restrictedFoods: [],
        pinnedNotes: [],
      },
      recentMessages: [
        {
          id: "message-dietitian-source",
          origin: "dietitian_manual",
          status: "sent",
          body: "Kahvaltida yumurta yerine lor peyniri kullanabilir.",
          createdAt: "2026-05-22T09:00:00.000Z",
        },
      ],
    },
    {
      generateReply: async () => {
        generated = true;
        return "Lor peyniri uygun bir alternatif olur.";
      },
      sendMessage: async () => {},
    },
  );

  assert.equal(result.action, "sent");
  assert.equal(result.providerAttempted, true);
  assert.equal(generated, true);
  assert.ok(result.contextManifest?.answerability?.sourceCategories.includes("dietitian_manual_message"));
});

test("answerability blocks sensitive mixed markers even when base risk is green", async () => {
  let generated = false;
  const result = await handleInboundMessage(
    {
      ...baseInput,
      message: {
        body: "Kahvaltida yumurta yerine ne yiyebilirim ve ilac saatimi degistirebilir miyim?",
      },
      riskDecisionOverride: {
        level: "green",
        reasons: ["test_green_override"],
        shouldHandoff: false,
        pauseAutopilot: false,
        classifierVersion: "test",
      },
    },
    {
      generateReply: async () => {
        generated = true;
        return "ok";
      },
    },
  );

  assert.equal(result.action, "handoff");
  assert.equal(result.blockedReason, "approved_source_answerability_missing");
  assert.equal(result.providerAttempted, false);
  assert.equal(generated, false);
  assert.equal(result.contextManifest?.answerability?.decision, "handoff_required");
  assert.ok(result.reasons.includes("mixed_or_sensitive_answerability_marker"));
});

test("green intent taxonomy records low-risk logistics intent", async () => {
  const result = await handleInboundMessage(
    {
      ...baseInput,
      message: {
        body: "Randevu saatini hatirlatir misin?",
      },
    },
    {
      generateReply: async () => "Randevu saatinizi notlarindaki bilgiye gore hatirlatirim.",
      sendMessage: async () => {},
    },
  );

  assert.equal(result.action, "sent");
  assert.equal(result.providerAttempted, true);
  assert.equal(result.contextManifest?.greenIntent?.decision, "green_intent_allowed");
  assert.equal(result.contextManifest?.greenIntent?.intentFamily, "green_logistics");
  assert.ok(result.contextManifest?.greenIntent?.sourceCategories.includes("active_diet_plan"));
});

test("green intent taxonomy blocks sensitive green-looking calorie requests before provider", async () => {
  let generated = false;
  const handoffs = [];
  const result = await handleInboundMessage(
    {
      ...baseInput,
      message: {
        body: "Bugun kahvaltida ne yiyebilirim ve kalorimi kac yapayim?",
      },
      riskDecisionOverride: {
        level: "green",
        reasons: ["test_green_override"],
        shouldHandoff: false,
        pauseAutopilot: false,
        classifierVersion: "test",
      },
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
  assert.equal(result.blockedReason, "green_intent_taxonomy_blocked");
  assert.equal(result.providerAttempted, false);
  assert.equal(result.model, null);
  assert.equal(generated, false);
  assert.equal(handoffs.length, 1);
  assert.equal(result.contextManifest?.greenIntent?.decision, "blocked_sensitive_intent");
  assert.equal(result.contextManifest?.greenIntent?.blockedFamily, "yellow_calorie_macro_portion_request");
  assert.ok(result.reasons.includes("green_intent_taxonomy_sensitive_family"));
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

test("core preflight blocks non-ready channel permission before provider call", async () => {
  let generated = false;
  const result = await handleInboundMessage(
    {
      ...baseInput,
      client: { ...baseInput.client, channelPermission: "pending" },
    },
    {
      generateReply: async () => {
        generated = true;
        return "ok";
      },
    },
  );

  assert.equal(result.action, "no_ai");
  assert.equal(result.blockedReason, "channel_permission_pending");
  assert.equal(result.model, null);
  assert.equal(result.providerAttempted, false);
  assert.equal(result.reasons.includes("permission_state_pending"), true);
  assert.equal(generated, false);
});

test("core preflight blocks red-risk locked clients before mode handoff or provider call", async () => {
  let generated = false;
  const handoffs = [];
  const result = await handleInboundMessage(
    {
      ...baseInput,
      client: {
        ...baseInput.client,
        aiMode: "paused",
        humanTakeoverLocked: true,
        redRiskLock: {
          status: "locked",
          handoffId: "handoff-red-lock-1",
          lockedAt: "2026-06-03T08:00:00.000Z",
          reasons: ["self_harm_or_suicidal_language"],
          previousAiStatus: "active",
          previousAiMode: "autopilot",
        },
      },
      message: { body: "Bugun kahvaltida yumurta yerine ne yiyebilirim?" },
    },
    {
      generateReply: async () => {
        generated = true;
        return "ok";
      },
      onHandoff: async (handoff) => handoffs.push(handoff),
    },
  );

  assert.equal(result.action, "no_ai");
  assert.equal(result.blockedReason, "red_risk_reactivation_required");
  assert.equal(result.providerAttempted, false);
  assert.equal(generated, false);
  assert.equal(handoffs.length, 0);
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
        return "Ic inceleme notu kaydedildi; client mesaji bekletildi.";
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
  assert.equal(result.contextManifest?.greenIntent?.decision, "not_applicable_non_green");
  assert.equal(result.contextManifest?.greenIntent?.allowed, true);
});

test("clinical safety second layer escalates ambiguous green messages to approval draft", async () => {
  const drafts = [];
  const sent = [];
  const models = [];

  const result = await handleInboundMessage(
    {
      ...baseInput,
      message: { body: "Bunu icsem olur mu?" },
      recentMessages: [{ body: "D vitamini takviyesi aldim.", origin: "client_inbound" }],
    },
    {
      generateReply: async ({ model }) => {
        models.push(model);
        return "Ic inceleme notu kaydedildi; client mesaji bekletildi.";
      },
      onDraftForApproval: async (draft) => drafts.push(draft),
      sendMessage: async (payload) => sent.push(payload),
    },
  );

  assert.equal(result.risk, "yellow");
  assert.equal(result.action, "draft_for_approval");
  assert.equal(result.model, "gemini-3");
  assert.equal(result.providerAttempted, true);
  assert.ok(result.reasons.includes("second_layer_ambiguous_clinical_reference"));
  assert.deepEqual(models, ["gemini-3"]);
  assert.equal(drafts.length, 1);
  assert.equal(sent.length, 0);
});

test("product communication covenant violations block green auto-send", async () => {
  const sent = [];
  const handoffs = [];

  const result = await handleInboundMessage(baseInput, {
    generateReply: async () => "As an AI, I cannot provide medical advice. Please consult your doctor.",
    sendMessage: async (payload) => sent.push(payload),
    onHandoff: async (handoff) => handoffs.push(handoff),
  });

  assert.equal(result.action, "handoff");
  assert.equal(result.blockedReason, "quality_guard_failed");
  assert.equal(result.providerAttempted, true);
  assert.equal(sent.length, 0);
  assert.equal(handoffs.length, 1);
  assert.ok(result.qualityIssues.includes("covenant_ai_self_disclosure"));
  assert.ok(result.qualityIssues.includes("covenant_ai_limitation_disclaimer"));
  assert.ok(result.qualityIssues.includes("covenant_referral_language"));
  assert.equal(result.providerOutputSafety?.allowed, false);
  assert.ok(
    result.providerOutputSafety?.issues?.some(
      (issue) => issue.code === "covenant_referral_language" && issue.category === "product_communication",
    ),
  );
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

test("unknown ai mode fails closed without auto send", () => {
  const decision = decideModeAction("future_mode", { level: "green", reasons: [] });
  assert.equal(decision.action, "ignore");
  assert.equal(decision.reason, "unknown_ai_mode_blocked");
});

test("unknown ai mode never calls provider or sends", async () => {
  let generated = false;
  const sent = [];
  const result = await handleInboundMessage(
    {
      ...baseInput,
      client: { ...baseInput.client, aiMode: "future_mode" },
    },
    {
      generateReply: async () => {
        generated = true;
        return "should not send";
      },
      sendMessage: async (payload) => sent.push(payload),
    },
  );

  assert.equal(result.action, "no_ai");
  assert.equal(result.blockedReason, "unknown_ai_mode_blocked");
  assert.equal(result.providerAttempted, false);
  assert.equal(generated, false);
  assert.equal(sent.length, 0);
});

test("unexpected provider error returns handoff without client send", async () => {
  let sent = [];
  let handoffs = [];
  const result = await handleInboundMessage(baseInput, {
    generateReply: async () => {
      throw new Error("upstream service unavailable");
    },
    sendMessage: async (payload) => {
      sent.push(payload);
    },
    onHandoff: async (handoff) => handoffs.push(handoff),
  });

  assert.equal(result.action, "handoff");
  assert.equal(result.blockedReason, "provider_error");
  assert.equal(result.providerAttempted, true);
  assert.equal(result.providerStatus, "failed");
  assert.equal(result.providerErrorCode, "provider_error");
  assert.equal(result.model, "gemini-1.5-flash");
  assert.equal(result.draft, null);
  assert.equal(sent.length, 0);
  assert.equal(handoffs.length, 1);
});

test("provider error with known code preserves error code and handoff", async () => {
  let handoffs = [];
  const result = await handleInboundMessage(baseInput, {
    generateReply: async () => {
      const error = new Error("timeout");
      error.code = "provider_timeout";
      throw error;
    },
    onHandoff: async (handoff) => handoffs.push(handoff),
  });

  assert.equal(result.action, "handoff");
  assert.equal(result.blockedReason, "provider_timeout");
  assert.equal(result.providerErrorCode, "provider_timeout");
  assert.equal(result.providerStatus, "failed");
  assert.equal(result.providerOutputSafety?.allowed, false);
  assert.equal(result.providerOutputSafety?.issues?.[0]?.code, "provider_timeout");
  assert.equal(handoffs.length, 1);
});

test("provider policy violation returns handoff with output safety metadata", async () => {
  let handoffs = [];
  const result = await handleInboundMessage(baseInput, {
    generateReply: async () => {
      const error = new Error("policy");
      error.code = "provider_policy_violation";
      throw error;
    },
    onHandoff: async (handoff) => handoffs.push(handoff),
  });

  assert.equal(result.action, "handoff");
  assert.equal(result.blockedReason, "provider_policy_violation");
  assert.equal(result.providerErrorCode, "provider_policy_violation");
  assert.equal(result.providerStatus, "failed");
  assert.equal(result.draft, null);
  assert.equal(result.providerOutputSafety?.allowed, false);
  assert.equal(handoffs.length, 1);
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
