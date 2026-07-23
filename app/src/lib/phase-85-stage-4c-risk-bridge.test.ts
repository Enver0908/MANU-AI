import { beforeEach, describe, expect, it } from "vitest";
import { getFallbackState, saveFallbackState } from "./app-state-store";
import { AppRequestError } from "./app-errors";
import type { AppTenantContext } from "./auth-context";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";
import {
  applyClientChatRedNotification,
  assertClientChatRiskBridgeAllowed,
  buildSourceRevisionDigest,
  createAiChatDraftTransfer,
  createEmptyRiskBridgeState,
  evaluateAiChatRunRisk,
  persistAiChatRiskAssessment,
} from "./phase-85-stage-4c-risk-bridge";
import { classifyDietitianChatRisk } from "dietitian-ai-assistant-architecture/risk";
import {
  applyInMemoryRunRiskPipeline,
  createInMemoryRunHandoff,
} from "./phase-85-stage-4c-risk-store";

const tenantContext: AppTenantContext = {
  tenantId: DEMO_TENANT_ID,
  userId: "user-a",
  dietitianId: "dietitian-ayse",
  role: "dietitian",
  capabilities: ["dietitian_ai_chat", "handoff_update"],
};

const CLIENT_CONVERSATION_ID = "conversation-client-mert";

describe("dietitian chat risk classifier", () => {
  it("maps fixture tokens to green/yellow/red", () => {
    expect(classifyDietitianChatRisk({ triggerBody: "__fixture:risk:green__" }).riskLevel).toBe("green");
    expect(classifyDietitianChatRisk({ triggerBody: "__fixture:risk:yellow__" }).riskLevel).toBe("yellow");
    expect(classifyDietitianChatRisk({ triggerBody: "__fixture:risk:red__" }).riskLevel).toBe("red");
  });

  it("treats hypothetical red in sources only as yellow", () => {
    const result = classifyDietitianChatRisk({
      triggerBody: "normal question",
      sourceExcerptTexts: ["hypothetical chest pain example in source"],
      verifiedFactTexts: [],
    });
    expect(result.riskLevel).toBe("yellow");
    expect(result.hypotheticalRed).toBe(true);
  });
});

describe("risk bridge store slice", () => {
  beforeEach(() => {
    saveFallbackState(createInitialState());
  });

  it("dedupes red notifications by fingerprint", () => {
    const bridge = createEmptyRiskBridgeState();
    const digest = buildSourceRevisionDigest({ revisionToken: "rev-1", sourceRefIds: ["s1"] });
    const base = getFallbackState();
    const first = applyClientChatRedNotification(base, {
      tenantId: DEMO_TENANT_ID,
      clientId: "client-mert",
      conversationId: CLIENT_CONVERSATION_ID,
      runId: "run-1",
      createdByUserId: "user-a",
      reasons: ["verified_client_red_signal"],
      sourceRevisionDigest: digest,
    });
    const second = applyClientChatRedNotification(first, {
      tenantId: DEMO_TENANT_ID,
      clientId: "client-mert",
      conversationId: CLIENT_CONVERSATION_ID,
      runId: "run-1",
      createdByUserId: "user-a",
      reasons: ["verified_client_red_signal"],
      sourceRevisionDigest: digest,
    });
    const open = second.notifications.filter(
      (item) => item.kind === "ai_chat_red_review_required" && !item.resolvedAt,
    );
    expect(open).toHaveLength(1);
    expect(open[0]?.occurrenceCount).toBeGreaterThanOrEqual(2);
    void bridge;
  });

  it("blocks general chat transfer and handoff", () => {
    expect(() => assertClientChatRiskBridgeAllowed("general")).toThrow(AppRequestError);
  });

  it("blocks red draft transfer", () => {
    const bridge = createEmptyRiskBridgeState();
    const state = getFallbackState();
    persistAiChatRiskAssessment(bridge, {
      tenantId: DEMO_TENANT_ID,
      runId: "run-red",
      conversationId: "ai-conv",
      createdByUserId: "user-a",
      clientId: "client-mert",
      triggerBody: "__fixture:risk:red__",
      directAnswer: null,
      answerability: "complete",
      providerRiskLevel: "red",
      verifiedFactTexts: [],
      attachmentExcerpts: [],
      sourceExcerptTexts: [],
      sourceRefIds: [],
      sourceRevisionDigest: "digest",
      scopeType: "client",
      assessment: classifyDietitianChatRisk({ triggerBody: "__fixture:risk:red__" }),
      handoffConfirmationToken: "token-1",
    });

    expect(() =>
      createAiChatDraftTransfer(bridge, state, {
        tenantId: DEMO_TENANT_ID,
        runId: "run-red",
        sourceConversationId: "ai-chat-conv",
        destinationConversationId: CLIENT_CONVERSATION_ID,
        createdByUserId: "user-a",
        destinationRevision: state.conversations.find((item) => item.id === CLIENT_CONVERSATION_ID)!.revision,
        clientContextRevision: state.clients.find((item) => item.id === "client-mert")!.contextRevision,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "ai_chat_red_draft_blocked",
      }),
    );
  });

  it("creates green composer pending transfer without sending messages", () => {
    const bridge = createEmptyRiskBridgeState();
    const state = getFallbackState();
    const messageCountBefore = state.messages.length;
    applyInMemoryRunRiskPipeline(bridge, {
      tenantId: DEMO_TENANT_ID,
      runId: "run-green",
      conversationId: "ai-conv",
      createdByUserId: "user-a",
      scopeType: "client",
      clientId: "client-mert",
      triggerBody: "__fixture:risk:green__",
      directAnswer: "Safe draft body",
      answerability: "complete",
      providerRiskLevel: "green",
      verifiedFactTexts: [],
      attachmentExcerpts: [],
      sourceExcerptTexts: [],
      sourceRefIds: [],
      revisionToken: "rev-1",
    });
    const { transfer } = createAiChatDraftTransfer(bridge, state, {
      tenantId: DEMO_TENANT_ID,
      runId: "run-green",
      sourceConversationId: "ai-conv",
      destinationConversationId: CLIENT_CONVERSATION_ID,
      createdByUserId: "user-a",
      destinationRevision: state.conversations.find((item) => item.id === CLIENT_CONVERSATION_ID)!.revision,
      clientContextRevision: state.clients.find((item) => item.id === "client-mert")!.contextRevision,
    });
    expect(transfer.transferMode).toBe("composer_pending");
    expect(getFallbackState().messages.length).toBe(messageCountBefore);
  });

  it("creates explicit handoff without outbound client message", () => {
    const bridge = createEmptyRiskBridgeState();
    applyInMemoryRunRiskPipeline(bridge, {
      tenantId: DEMO_TENANT_ID,
      runId: "run-red-handoff",
      conversationId: "ai-conv",
      createdByUserId: "user-a",
      scopeType: "client",
      clientId: "client-mert",
      triggerBody: "__fixture:risk:red__",
      directAnswer: "blocked",
      answerability: "complete",
      providerRiskLevel: "red",
      verifiedFactTexts: [],
      attachmentExcerpts: [],
      sourceExcerptTexts: [],
      sourceRefIds: [],
      revisionToken: "rev-1",
    });
    const assessment = bridge.riskAssessments.find((item) => item.runId === "run-red-handoff");
    const beforeMessages = getFallbackState().messages.length;
    const { handoffId } = createInMemoryRunHandoff(bridge, tenantContext, {
      runId: "run-red-handoff",
      conversationId: "ai-conv",
      clientId: "client-mert",
      confirmationToken: assessment!.handoffConfirmationToken!,
      expectedClientContextRevision: getFallbackState().clients.find((item) => item.id === "client-mert")!
        .contextRevision,
      scopeType: "client",
    });
    expect(handoffId).toBeTruthy();
    expect(getFallbackState().messages.length).toBe(beforeMessages);
    const client = getFallbackState().clients.find((item) => item.id === "client-mert");
    expect(client?.redRiskLock?.status).toBe("locked");
  });
});

describe("evaluateAiChatRunRisk", () => {
  it("validates classifier output", () => {
    const assessment = evaluateAiChatRunRisk({
      tenantId: "tenant-a",
      runId: "run-1",
      conversationId: "conv-1",
      createdByUserId: "user-a",
      scopeType: "client",
      clientId: "client-1",
      triggerBody: "__fixture:risk:green__",
      directAnswer: "hello",
      answerability: "complete",
      providerRiskLevel: "green",
      verifiedFactTexts: [],
      attachmentExcerpts: [],
      sourceExcerptTexts: [],
      sourceRefIds: [],
      sourceRevisionDigest: "digest",
    });
    expect(assessment.riskLevel).toBe("green");
  });
});
