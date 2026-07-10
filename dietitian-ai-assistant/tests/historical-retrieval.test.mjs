import test from "node:test";
import assert from "node:assert/strict";
import {
  compilePromptContext,
  CONTEXT_POLICY_V2,
} from "../src/context-compiler.js";
import {
  isGenericGreeting,
  isRetrievalEvidencedDietitianMessage,
  retrieveHistoricalMessages,
  evaluateTemporalInstruction,
} from "../src/historical-retrieval.js";
import { evaluateIntentSpecificAnswerability } from "../src/intent-specific-answerability.js";

const capsule = {
  tenantId: "tenant-1",
  client: {
    id: "client-1",
    communicationLanguage: "tr",
    dietPlan: { breakfast: "eggs" },
    allergies: [],
    restrictedFoods: [],
    pinnedNotes: [],
    clientFormSummary: "Goal: fat loss",
    contextUpdates: [],
    contextRevision: 1,
  },
  conversation: { id: "conversation-1", channel: "whatsapp" },
  persona: { id: "balanced_coach", behavior: {} },
  voiceProfile: {},
  memory: { rollingSummary: "" },
};

function fillerMessages(count, startIndex = 0) {
  return Array.from({ length: count }, (_, index) => ({
    id: `filler-${startIndex + index}`,
    origin: "client_inbound",
    status: "stored",
    body: `Logistics note ${startIndex + index}`,
    createdAt: `2026-05-22T10:${String(index).padStart(2, "0")}:00.000Z`,
  }));
}

test("historical retrieval keeps dietitian instruction after more than eight later messages", () => {
  const instruction = {
    id: "instruction-1",
    origin: "dietitian_manual",
    status: "sent",
    body: "Kahvaltida yumurta yerine lor peyniri kullanabilirsin.",
    createdAt: "2026-05-22T08:00:00.000Z",
    actorType: "business_operator",
  };
  const corpus = [instruction, ...fillerMessages(10, 1)];
  const retrieval = retrieveHistoricalMessages({
    query: "Bugun kahvaltida yumurta yerine ne yiyebilirim?",
    messages: corpus,
    recentMessageIds: corpus.slice(-8).map((message) => message.id),
    timezone: "Europe/Istanbul",
    now: "2026-05-22T12:00:00.000Z",
    policy: {
      ...CONTEXT_POLICY_V2,
      currentMessageId: "current-1",
    },
  });

  assert.ok(retrieval.selected.some((source) => source.sourceId === "instruction-1"));
  assert.equal(retrieval.overflowRequiredDietitian, false);
});

test("generic greeting does not count as retrieval-evidenced dietitian source", () => {
  assert.equal(isGenericGreeting("Merhaba"), true);
  assert.equal(
    isRetrievalEvidencedDietitianMessage(
      "Bugun kahvaltida ne yiyebilirim?",
      { origin: "dietitian_manual", body: "Merhaba" },
    ),
    false,
  );
});

test("standalone Merhaba does not satisfy plan lookup as relevant dietitian evidence", () => {
  const compiled = compilePromptContext({
    capsule,
    currentMessage: { id: "current-1", body: "Bugun kahvaltida ne yiyebilirim?" },
    recentMessages: [],
    conversationMessages: [
      {
        id: "greeting-1",
        origin: "dietitian_manual",
        status: "sent",
        body: "Merhaba",
        createdAt: "2026-05-22T08:00:00.000Z",
      },
    ],
    riskLevel: "green",
    policy: CONTEXT_POLICY_V2,
    dietitianTimezone: "Europe/Istanbul",
    retrievalNow: "2026-05-22T12:00:00.000Z",
  });

  const answerability = evaluateIntentSpecificAnswerability({
    promptContext: compiled.promptContext,
    riskDecision: { level: "green" },
    greenIntent: { allowed: true, intentFamily: "green_plan_lookup", reasons: [] },
    foodRule: null,
    structuredFoodRules: null,
    canonicalIntent: { intentFamily: "green_plan_lookup", allowed: true, reasons: [] },
  });

  assert.equal(answerability.decision, "source_backed_green");
  assert.ok(answerability.sourceCategories.includes("active_diet_plan"));
  assert.equal(answerability.sourceCategories.includes("relevant_dietitian_manual_message"), false);
});

test("expired today-only dietitian instruction is excluded from retrieval", () => {
  const temporal = evaluateTemporalInstruction(
    {
      body: "Bugun kahvaltida lor peyniri kullan.",
      createdAt: "2026-05-21T08:00:00.000Z",
    },
    "Europe/Istanbul",
    "2026-05-22T12:00:00.000Z",
  );
  assert.equal(temporal.expired, true);
});

test("tomorrow-only instruction is valid only on the authoring day plus one", () => {
  const message = {
    body: "Yarin kahvaltida lor peyniri kullan.",
    createdAt: "2026-05-21T08:00:00.000Z",
  };

  assert.equal(
    evaluateTemporalInstruction(message, "Europe/Istanbul", "2026-05-22T12:00:00.000Z").expired,
    false,
  );
  assert.equal(
    evaluateTemporalInstruction(message, "Europe/Istanbul", "2026-05-23T12:00:00.000Z").expired,
    true,
  );
});

test("explicit until date is inclusive and unparseable temporal text fails closed", () => {
  const until = {
    body: "15.06.2026 tarihine kadar aksam ara ogununu ekle.",
    createdAt: "2026-05-21T08:00:00.000Z",
  };
  assert.equal(
    evaluateTemporalInstruction(until, "Europe/Istanbul", "2026-06-15T18:00:00.000Z").expired,
    false,
  );
  assert.equal(
    evaluateTemporalInstruction(until, "Europe/Istanbul", "2026-06-16T08:00:00.000Z").expired,
    true,
  );
  assert.equal(
    evaluateTemporalInstruction(
      { body: "Belirsiz bir tarihe kadar bunu uygula.", createdAt: "2026-05-21T08:00:00.000Z" },
      "Europe/Istanbul",
      "2026-05-22T12:00:00.000Z",
    ).expired,
    true,
  );
});

test("irrelevant dietitian messages are not injected as historical authority", () => {
  const retrieval = retrieveHistoricalMessages({
    query: "Kahvaltida yumurta yerine ne yiyebilirim?",
    messages: [
      {
        id: "irrelevant-manual",
        origin: "dietitian_manual",
        status: "sent",
        body: "Ofiste gorusuruz.",
        createdAt: "2026-05-21T08:00:00.000Z",
      },
    ],
    timezone: "Europe/Istanbul",
    now: "2026-05-21T12:00:00.000Z",
    policy: { ...CONTEXT_POLICY_V2, currentMessageId: "current-1" },
  });

  assert.equal(retrieval.selected.length, 0);
});

test("compilePromptContext includes historical segments under policy v2", () => {
  const compiled = compilePromptContext({
    capsule,
    currentMessage: { id: "current-1", body: "Bugun kahvaltida yumurta yerine ne yiyebilirim?" },
    recentMessages: fillerMessages(8),
    conversationMessages: [
      {
        id: "instruction-1",
        origin: "dietitian_manual",
        status: "sent",
        body: "Kahvaltida yumurta yerine lor peyniri kullanabilirsin.",
        createdAt: "2026-05-22T08:00:00.000Z",
      },
      ...fillerMessages(8),
    ],
    riskLevel: "green",
    policy: CONTEXT_POLICY_V2,
    dietitianTimezone: "Europe/Istanbul",
    retrievalNow: "2026-05-22T12:00:00.000Z",
  });

  assert.equal(compiled.contextManifest.contextPolicyVersion, "context-policy-v2");
  assert.ok(compiled.promptContext.segments.some((segment) => segment.type === "historical_message"));
});
