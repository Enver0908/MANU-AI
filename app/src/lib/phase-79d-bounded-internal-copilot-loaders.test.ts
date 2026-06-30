import { describe, expect, it } from "vitest";
import { createBlankClient, createInitialState } from "./seed-data";
import { addClientToState } from "./simulator";
import { runInternalCopilotInState } from "./internal-copilot";
import {
  assembleBoundedInternalCopilotToolState,
  boundedToolStateExcludesUnrelatedClientMessages,
  evaluatePhase79dBoundedInternalCopilotEvidence,
  INTERNAL_COPILOT_TOOL_BOUNDS,
  mergeInternalCopilotMutationIntoAppState,
  minimizeInternalCopilotToolCallSourceRefs,
} from "./phase-79d-bounded-internal-copilot-loaders";
import type { MessageRecord } from "./types";

function stateWithHiddenClientMessages() {
  const state = createInitialState();
  const hiddenClient = createBlankClient({
    id: "client-hidden",
    fullName: "Hidden Client",
    primaryPhoneE164: "+905551110099",
    channelUserId: "hidden-user",
  });
  const withHidden = addClientToState(state, hiddenClient);
  return {
    ...withHidden,
    conversations: [
      ...withHidden.conversations,
      {
        id: "conversation-client-hidden",
        tenantId: withHidden.tenant.id,
        dietitianId: withHidden.dietitian.id,
        clientId: hiddenClient.id,
        channel: "whatsapp",
        rollingSummary: "",
        memoryVersion: 1,
        memoryRevision: 1,
        memoryStale: false,
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ],
    messages: [
      ...withHidden.messages,
      {
        id: "msg-hidden-other",
        tenantId: withHidden.tenant.id,
        conversationId: "conversation-client-hidden",
        sender: "client",
        body: "Hidden client secret message",
        origin: "inbound",
        status: "sent",
        createdAt: "2026-06-01T00:00:00.000Z",
      } satisfies MessageRecord,
    ],
  };
}

describe("Phase 79D bounded internal copilot loaders", () => {
  it("resolves a visible client in bounded tool state", () => {
    const bounded = assembleBoundedInternalCopilotToolState(createInitialState(), "Mert son durumu ne?");

    expect(bounded.clients.some((client) => client.id === "client-mert")).toBe(true);
    expect(bounded.messages.every((message) => message.conversationId === "conversation-client-mert")).toBe(true);
  });

  it("blocks removed clients from bounded visible state", () => {
    const base = createInitialState();
    base.clients.push({
      ...base.clients[0],
      id: "client-removed",
      lifecycleStatus: "removed_anonymized",
      removedAt: "2026-06-20T00:00:00.000Z",
      fullName: "[REDACTED]",
      primaryPhoneE164: null,
    });

    const bounded = assembleBoundedInternalCopilotToolState(base, "Mert son durumu ne?");
    expect(bounded.clients.some((client) => client.id === "client-removed")).toBe(false);
  });

  it("does not leak unrelated client messages into bounded tool state", () => {
    const base = stateWithHiddenClientMessages();
    const bounded = assembleBoundedInternalCopilotToolState(base, "Mert son mesajlari");

    expect(bounded.messages.some((message) => message.id === "msg-hidden-other")).toBe(false);
    expect(boundedToolStateExcludesUnrelatedClientMessages(bounded)).toBe(true);
  });

  it("caps bounded tool arrays at Phase 79D limits", () => {
    const base = createInitialState();
    for (let index = 0; index < 30; index += 1) {
      base.messages.push({
        id: `msg-bulk-${index}`,
        tenantId: base.tenant.id,
        conversationId: "conversation-client-mert",
        sender: "client",
        body: `Message ${index}`,
        origin: "inbound",
        status: "sent",
        createdAt: `2026-06-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      });
      base.handoffCases.push({
        id: `handoff-bulk-${index}`,
        tenantId: base.tenant.id,
        dietitianId: base.dietitian.id,
        clientId: "client-mert",
        conversationId: "conversation-client-mert",
        triggeringMessageId: null,
        risk: "yellow",
        reasons: ["test"],
        status: "open",
        urgency: "standard",
        safeAcknowledgement: "",
        recommendedAction: "",
        createdAt: `2026-06-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      });
      base.aiDecisions.push({
        id: `decision-bulk-${index}`,
        tenantId: base.tenant.id,
        conversationId: "conversation-client-mert",
        clientId: "client-mert",
        mode: "copilot",
        aiStatus: "active",
        personaId: "balanced_coach",
        risk: "green",
        model: null,
        promptVersion: null,
        providerAttempted: false,
        providerId: null,
        providerStatus: "skipped",
        providerErrorCode: null,
        sendStatus: "blocked",
        action: "draft_only",
        blockedReason: null,
        createdAt: `2026-06-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      });
    }

    const bounded = assembleBoundedInternalCopilotToolState(base, "Mert son mesajlari");
    expect(bounded.messages.length).toBeLessThanOrEqual(INTERNAL_COPILOT_TOOL_BOUNDS.recentMessagesMax);
    expect(bounded.handoffCases.length).toBeLessThanOrEqual(INTERNAL_COPILOT_TOOL_BOUNDS.handoffsMax);
    expect(bounded.aiDecisions.length).toBeLessThanOrEqual(INTERNAL_COPILOT_TOOL_BOUNDS.aiDecisionsMax);
  });

  it("minimizes source ref labels", () => {
    const minimized = minimizeInternalCopilotToolCallSourceRefs([
      {
        id: "tool-1",
        tenantId: "tenant-1",
        dietitianId: "dietitian-1",
        toolName: "getClientRecentMessages",
        arguments: { clientId: "client-mert" },
        status: "ok",
        sourceRefs: [
          {
            entityType: "message",
            entityId: "message-1",
            clientId: "client-mert",
            label: "x".repeat(200),
            createdAt: "2026-06-29T00:00:00.000Z",
          },
        ],
        resultSummary: "sample",
        createdAt: "2026-06-29T00:00:00.000Z",
      },
    ]);

    expect(minimized[0]?.sourceRefs[0]?.label.length).toBeLessThanOrEqual(
      INTERNAL_COPILOT_TOOL_BOUNDS.sourceRefLabelMaxChars,
    );
  });

  it("merges copilot mutation records without dropping existing dashboard state", () => {
    const base = createInitialState();
    const toolState = assembleBoundedInternalCopilotToolState(base, "Mert diyet plan ozeti");
    const mutationResult = runInternalCopilotInState(toolState, "Mert diyet plan ozeti");
    const merged = mergeInternalCopilotMutationIntoAppState(base, mutationResult);

    expect(merged.internalCopilotMessages.length).toBeGreaterThan(base.internalCopilotMessages.length);
    expect(merged.clients).toEqual(base.clients);
    expect(merged.messages).toEqual(base.messages);
    expect(merged.internalCopilotToolCalls.every((call) => call.dietitianId === base.dietitian.id)).toBe(true);
    expect(merged.auditEvents.every((event) => event.tenantId === base.tenant.id)).toBe(true);
  });

  it("evaluates bounded internal copilot evidence as pass on clean fixture", () => {
    const evidence = evaluatePhase79dBoundedInternalCopilotEvidence(createInitialState(), "Mert son durumu ne?");

    expect(evidence.status).toBe("pass");
    expect(evidence.visibleClientResolveReady).toBe(true);
    expect(evidence.removedClientBlocked).toBe(true);
    expect(evidence.hiddenStateLeakDetected).toBe(false);
    expect(evidence.sourceRefsBounded).toBe(true);
    expect(evidence.tenantDietitianScopedRecords).toBe(true);
  });
});
