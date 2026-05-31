import test from "node:test";
import assert from "node:assert/strict";
import {
  LATEST_DIETITIAN_CONTEXT_INSTRUCTION,
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
    contextUpdates: [
      {
        id: "context-update-1",
        source: "phone",
        occurredAt: "2026-05-30T10:00:00.000Z",
        title: "Phone follow-up",
        summary: "Client will travel tomorrow and needs portable snack options.",
        details: "Dietitian confirmed yogurt is not practical during travel.",
        importance: "critical",
        status: "active",
      },
    ],
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
  assert.ok(renderPromptContext(compiled.promptContext).includes(LATEST_DIETITIAN_CONTEXT_INSTRUCTION));
  assert.ok(compiled.promptContext.segments.some((segment) => segment.type === "recent_message"));
  assert.equal(compiled.contextManifest.hashMode, "none_v1");
  assert.equal(compiled.contextManifest.memoryIncluded, true);
  assert.equal(compiled.contextManifest.memoryRevision, 3);
  assert.ok(compiled.promptContext.segments.some((segment) => segment.type === "client_form_summary"));
  assert.ok(compiled.promptContext.segments.some((segment) => segment.type === "dietitian_context_update"));
  assert.ok(
    compiled.promptContext.segments.some(
      (segment) =>
        segment.type === "recent_message" &&
        segment.origin === "client_inbound" &&
        segment.authority === "client_authored",
    ),
  );
  assert.ok(renderPromptContext(compiled.promptContext).includes("authority: client_authored"));
  assert.equal(compiled.contextManifest.excludedCounts.nonPromptableMessages, 1);
  assert.ok(
    compiled.contextManifest.segments.some(
      (segment) => segment.type === "dietitian_context_update" && segment.authority === "newest_dietitian_authored",
    ),
  );
  assert.equal(JSON.stringify(compiled.contextManifest).includes("Bugun kahvaltida"), false);
  assert.equal(JSON.stringify(compiled.contextManifest).includes("Dunku ara"), false);
  assert.equal(JSON.stringify(compiled.contextManifest).includes("portable snack"), false);
});

test("newer dietitian manual messages remain promptable after older context updates", () => {
  const compiled = compilePromptContext({
    capsule,
    currentMessage: { id: "message-current-2", body: "Ara ogun ne olsun?" },
    recentMessages: [
      {
        id: "message-dietitian-latest",
        origin: "dietitian_manual",
        status: "sent",
        body: "WhatsApp update: yogurt is now allowed for the travel snack.",
        createdAt: "2026-05-30T12:00:00.000Z",
      },
    ],
    riskLevel: "green",
  });

  const rendered = renderPromptContext(compiled.promptContext);
  assert.ok(rendered.includes("Dietitian confirmed yogurt is not practical during travel."));
  assert.ok(rendered.includes("WhatsApp update: yogurt is now allowed for the travel snack."));
  assert.ok(rendered.indexOf("WhatsApp update: yogurt is now allowed") > rendered.indexOf("Dietitian confirmed yogurt"));
  assert.equal(
    compiled.promptContext.segments.find((segment) => segment.sourceId === "message-dietitian-latest")?.authority,
    "newest_dietitian_authored",
  );
  assert.ok(rendered.includes("newest_dietitian_authored"));
});

test("newer dietitian context update is visibly newer than older manual messages", () => {
  const compiled = compilePromptContext({
    capsule: {
      ...capsule,
      client: {
        ...capsule.client,
        contextUpdates: [
          {
            id: "context-update-new",
            source: "zoom",
            occurredAt: "2026-05-30T14:00:00.000Z",
            title: "Zoom follow-up",
            summary: "Dietitian confirmed yogurt is not allowed this week.",
            details: "",
            importance: "critical",
            status: "active",
          },
        ],
      },
    },
    currentMessage: { id: "message-current-3", body: "Ara ogun ne olsun?" },
    recentMessages: [
      {
        id: "message-dietitian-older",
        origin: "dietitian_manual",
        status: "sent",
        body: "WhatsApp update: yogurt is allowed.",
        createdAt: "2026-05-30T12:00:00.000Z",
      },
    ],
    riskLevel: "green",
  });

  const rendered = renderPromptContext(compiled.promptContext);
  assert.ok(rendered.includes("createdAt: 2026-05-30T14:00:00.000Z"));
  assert.ok(rendered.includes("createdAt: 2026-05-30T12:00:00.000Z"));
  assert.equal(
    compiled.promptContext.segments.find((segment) => segment.sourceId === "context-update-new")?.authority,
    "newest_dietitian_authored",
  );
  assert.equal(
    compiled.promptContext.segments.find((segment) => segment.sourceId === "message-dietitian-older")?.authority,
    "dietitian_authored",
  );
  assert.ok(rendered.indexOf("Dietitian confirmed yogurt is not allowed") < rendered.indexOf("WhatsApp update"));
});

test("compiler records current message id and excludes superseded dietitian context updates", () => {
  const compiled = compilePromptContext({
    capsule: {
      ...capsule,
      client: {
        ...capsule.client,
        contextUpdates: [
          ...capsule.client.contextUpdates,
          {
            id: "context-update-old",
            source: "zoom",
            occurredAt: "2026-05-29T10:00:00.000Z",
            title: "Old update",
            summary: "This should not be promptable.",
            details: "",
            importance: "routine",
            status: "superseded",
          },
        ],
      },
    },
    currentMessage: { id: "message-current", body: "Dunku telefon gorusmesindeki ara ogun neydi?" },
    recentMessages: [],
    riskLevel: "green",
  });

  const rendered = renderPromptContext(compiled.promptContext);
  assert.equal(compiled.contextManifest.currentMessageId, "message-current");
  assert.ok(rendered.includes("Phone follow-up"));
  assert.equal(rendered.includes("This should not be promptable"), false);
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
