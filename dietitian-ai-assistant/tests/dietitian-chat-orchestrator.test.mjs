import test from "node:test";
import assert from "node:assert/strict";
import {
  createDietitianChatRunPlan,
  finalizeDietitianChatRun,
} from "../src/dietitian-chat-orchestrator.js";
import { buildProviderContext, selectVisibleMessages } from "../src/dietitian-chat-context-policy.js";
import { validateAssistantOutput } from "../src/dietitian-chat-output-guard.js";

test("context policy keeps only the latest visible messages within char budget", () => {
  const messages = Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    body: `message-${index}`,
  }));
  const { visibleMessages } = selectVisibleMessages(messages, 12, 18_000);
  assert.equal(visibleMessages.length, 12);
  assert.equal(visibleMessages[0].body, "message-8");
});

test("rolling summary is non-authoritative and bounded", () => {
  const context = buildProviderContext({
    messages: Array.from({ length: 30 }, (_, index) => ({
      role: "user",
      body: "x".repeat(500),
    })),
  });
  assert.equal(context.rollingSummary.isAuthoritative, false);
  assert.ok(context.rollingSummary.summaryText.length <= 4_000);
});

test("run plan includes retrieving/generating/validating phases", () => {
  const plan = createDietitianChatRunPlan({
    triggerBody: "__fixture:hello__",
    messages: [{ role: "user", body: "__fixture:hello__" }],
  });
  assert.deepEqual(plan.phases, ["retrieving", "generating", "validating"]);
  assert.equal(plan.context.visibleMessages.length, 1);
});

test("stopped runs keep partial text as incomplete", () => {
  const result = finalizeDietitianChatRun({
    runStatus: "cancel_requested",
    providerResult: {
      directAnswer: "partial answer",
      answerability: "partial",
      riskLevel: "green",
    },
  });
  assert.equal(result.terminalStatus, "stopped");
  assert.equal(result.validation.completionState, "incomplete");
  assert.equal(result.validation.directAnswer, "partial answer");
});

test("output guard rejects answerable with empty body", () => {
  const validation = validateAssistantOutput({
    directAnswer: "",
    answerability: "answerable",
    riskLevel: "green",
  });
  assert.equal(validation.ok, false);
  assert.equal(validation.answerability, "insufficient");
});
