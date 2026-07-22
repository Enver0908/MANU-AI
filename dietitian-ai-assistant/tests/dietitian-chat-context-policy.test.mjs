import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AI_CHAT_CONTEXT_TOOLS,
  classifyDietitianChatIntentFromSignals,
  DIETITIAN_CHAT_INTENTS,
  planDietitianChatContextTools,
} from "../src/dietitian-chat-context-policy.js";

describe("dietitian chat context policy", () => {
  it("exposes closed intent and tool enums", () => {
    assert.equal(DIETITIAN_CHAT_INTENTS.length, 11);
    assert.equal(AI_CHAT_CONTEXT_TOOLS.length, 13);
  });

  it("classifies general scope as general_non_client", () => {
    assert.equal(
      classifyDietitianChatIntentFromSignals({
        triggerBody: "What is protein?",
        scopeType: "general",
      }),
      "general_non_client",
    );
  });

  it("plans zero client tools for general scope", () => {
    assert.deepEqual(
      planDietitianChatContextTools("client_current_status", "general"),
      [],
    );
  });

  it("maps risk review intent to bounded risk tools", () => {
    const tools = planDietitianChatContextTools("client_risk_review", "client");
    assert.ok(tools.includes("load_client_risk_timeline"));
    assert.ok(tools.includes("load_client_handoffs"));
  });

  it("uses fixture intent prefix deterministically", () => {
    assert.equal(
      classifyDietitianChatIntentFromSignals({
        triggerBody: "__fixture:intent:client_trend__",
        scopeType: "client",
      }),
      "client_trend",
    );
  });
});
