import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { scopeSupabaseState, type DbClientAssignment } from "./supabase-store";
import type { AppTenantContext } from "./auth-context";

const OTHER_DIETITIAN_ID = "dietitian-other";

describe("Supabase scoped access", () => {
  it("keeps owner and admin access tenant-wide", () => {
    const state = scopedFixture();

    expect(scopeSupabaseState(state, context("owner"), []).clients).toHaveLength(state.clients.length);
    expect(scopeSupabaseState(state, context("admin"), []).messages).toHaveLength(state.messages.length);
  });

  it("lets dietitians see owned and explicitly assigned clients only", () => {
    const state = scopedFixture();
    const assignedClientId = state.clients[1].id;
    const hiddenClientId = state.clients[2].id;
    const scoped = scopeSupabaseState(state, context("dietitian"), [
      assignment(assignedClientId, state.dietitian.id),
    ]);

    expect(scoped.clients.map((client) => client.id)).toContain(state.clients[0].id);
    expect(scoped.clients.map((client) => client.id)).toContain(assignedClientId);
    expect(scoped.clients.map((client) => client.id)).not.toContain(hiddenClientId);
    expect(scoped.messages.every((message) => scoped.conversations.some((item) => item.id === message.conversationId))).toBe(true);
  });

  it("limits assistants to assigned clients", () => {
    const state = scopedFixture();
    const assignedClientId = state.clients[1].id;
    const scoped = scopeSupabaseState(state, context("assistant"), [
      assignment(assignedClientId, state.dietitian.id),
    ]);

    expect(scoped.clients.map((client) => client.id)).toEqual([assignedClientId]);
    expect(scoped.handoffCases.every((handoff) => handoff.clientId === assignedClientId)).toBe(true);
    expect(scoped.dataRequests.every((request) => request.clientId === assignedClientId)).toBe(true);
  });

  it("keeps auditor app state free of raw client and message records", () => {
    const state = scopedFixture();
    const scoped = scopeSupabaseState(state, context("auditor"), [
      assignment(state.clients[0].id, state.dietitian.id),
    ]);

    expect(scoped.clients).toEqual([]);
    expect(scoped.messages).toEqual([]);
    expect(scoped.aiDecisions).toEqual([]);
    expect(scoped.handoffCases).toEqual([]);
    expect(scoped.notifications).toEqual([]);
    expect(scoped.dataRequests).toEqual([]);
    expect(scoped.internalCopilotMessages).toEqual([]);
    expect(scoped.internalCopilotToolCalls).toEqual([]);
  });

  it("scopes internal copilot history to owner/admin/dietitian only", () => {
    const state = scopedFixture();

    expect(scopeSupabaseState(state, context("owner"), []).internalCopilotMessages).toHaveLength(1);
    expect(scopeSupabaseState(state, context("dietitian"), []).internalCopilotToolCalls).toHaveLength(1);
    expect(scopeSupabaseState(state, context("assistant"), []).internalCopilotMessages).toEqual([]);
    expect(scopeSupabaseState(state, context("auditor"), []).internalCopilotToolCalls).toEqual([]);
  });

  it("removes operational trust and quarantine inspection details from common app state", () => {
    const state = operationalFixture();
    const scopedOwner = scopeSupabaseState(state, context("owner"), []);
    const scopedDietitian = scopeSupabaseState(state, context("dietitian"), []);

    for (const scoped of [scopedOwner, scopedDietitian]) {
      expect(scoped.inboundQuarantines).toEqual([]);
      expect(scoped.channelAccountBindings).toEqual([]);
      expect(scoped.channelActorBindings).toEqual([]);
      expect(scoped.channelEvents).toEqual([]);
      expect(scoped.channelMessageRevisions).toHaveLength(1);
      expect(scoped.channelMessageRevisions[0]?.channelEventId).toBeNull();
    }
  });
});

function scopedFixture() {
  const state = createInitialState();
  return {
    ...state,
    clients: state.clients.map((client, index) =>
      index === 0 ? client : { ...client, dietitianId: OTHER_DIETITIAN_ID },
    ),
    conversations: state.conversations.map((conversation, index) =>
      index === 0 ? conversation : { ...conversation, dietitianId: OTHER_DIETITIAN_ID },
    ),
    handoffCases: state.handoffCases.map((handoff) => ({ ...handoff, clientId: state.clients[1].id })),
    dataRequests: [
      {
        id: "data-request-assigned",
        tenantId: state.tenant.id,
        clientId: state.clients[1].id,
        requestType: "export",
        status: "completed",
        requestedByDietitianId: state.dietitian.id,
        completedAt: "2026-05-25T00:00:00.000Z",
        createdAt: "2026-05-25T00:00:00.000Z",
      },
      {
        id: "data-request-hidden",
        tenantId: state.tenant.id,
        clientId: state.clients[2].id,
        requestType: "export",
        status: "completed",
        requestedByDietitianId: OTHER_DIETITIAN_ID,
        completedAt: "2026-05-25T00:00:00.000Z",
        createdAt: "2026-05-25T00:00:00.000Z",
      },
    ],
    internalCopilotMessages: [
      {
        id: "internal-message-1",
        tenantId: state.tenant.id,
        dietitianId: state.dietitian.id,
        role: "assistant",
        body: "Grounded answer",
        sourceRefs: [],
        toolCallIds: ["internal-tool-1"],
        safetyStatus: "ok",
        createdAt: "2026-05-30T10:00:00.000Z",
      },
      {
        id: "internal-message-hidden",
        tenantId: state.tenant.id,
        dietitianId: OTHER_DIETITIAN_ID,
        role: "assistant",
        body: "Hidden answer",
        sourceRefs: [],
        toolCallIds: [],
        safetyStatus: "ok",
        createdAt: "2026-05-30T10:00:00.000Z",
      },
    ],
    internalCopilotToolCalls: [
      {
        id: "internal-tool-1",
        tenantId: state.tenant.id,
        dietitianId: state.dietitian.id,
        toolName: "getClientDietPlan",
        arguments: { clientId: state.clients[0].id },
        status: "ok",
        sourceRefs: [],
        resultSummary: "Visible result",
        createdAt: "2026-05-30T10:00:00.000Z",
      },
    ],
  };
}

function context(role: AppTenantContext["role"]): AppTenantContext {
  const state = createInitialState();
  return {
    tenantId: state.tenant.id,
    dietitianId: state.dietitian.id,
    userId: "user-test",
    role,
  };
}

function assignment(clientId: string, dietitianId: string): DbClientAssignment {
  return { client_id: clientId, dietitian_id: dietitianId };
}

function operationalFixture() {
  const state = scopedFixture();
  const message = state.messages[0]!;
  return {
    ...state,
    inboundQuarantines: [
      {
        id: "quarantine-1",
        tenantId: state.tenant.id,
        channel: "whatsapp" as const,
        sourceConversationType: "group" as const,
        sourceConversationId: "group-1",
        sourceMessageId: "provider-message-1",
        senderChannelUserId: "+905551110001",
        reason: "whatsapp_group_unsupported" as const,
        createdAt: "2026-07-10T10:00:00.000Z",
      },
    ],
    channelAccountBindings: [
      {
        id: "account-binding-1",
        tenantId: state.tenant.id,
        provider: "whatsapp_cloud" as const,
        providerAccountId: "provider-account-1",
        wabaId: "waba-1",
        businessPhoneNumberId: "phone-number-1",
        normalizedDisplayNumber: "+905550000000",
        operatingMode: "mock" as const,
        lifecycleStatus: "active" as const,
        attributionPolicy: "shared_authorized_team" as const,
        verifiedAt: "2026-07-10T10:00:00.000Z",
        revokedAt: null,
        createdByDietitianId: state.dietitian.id,
        revokedByDietitianId: null,
        createdAt: "2026-07-10T10:00:00.000Z",
        updatedAt: "2026-07-10T10:00:00.000Z",
      },
    ],
    channelActorBindings: [
      {
        id: "actor-binding-1",
        tenantId: state.tenant.id,
        accountBindingId: "account-binding-1",
        dietitianId: null,
        actorType: "business_operator" as const,
        attributionBasis: "shared_authorized_team" as const,
        validFrom: "2026-07-10T10:00:00.000Z",
        validTo: null,
        verifiedAt: "2026-07-10T10:00:00.000Z",
        revokedAt: null,
        createdByDietitianId: state.dietitian.id,
        revokedByDietitianId: null,
        auditReasonCode: "test",
        createdAt: "2026-07-10T10:00:00.000Z",
      },
    ],
    channelEvents: [
      {
        id: "channel-event-1",
        tenantId: state.tenant.id,
        accountBindingId: "account-binding-1",
        eventKind: "malformed_event" as const,
        processingStatus: "quarantined" as const,
        providerAccountId: "provider-account-1",
        providerEventId: "provider-event-1",
        providerMessageId: null,
        fromIdentity: null,
        toIdentity: null,
        counterpartyIdentity: null,
        payloadDigest: "abcdef1234567890",
        payloadSchemaVersion: "test",
        providerTime: null,
        observedAt: "2026-07-10T10:00:00.000Z",
        committedAt: null,
        quarantineId: "quarantine-1",
        replayOfEventId: null,
        retryCount: 0,
        internalSequence: 1,
      },
    ],
    channelMessageRevisions: [
      {
        id: "revision-visible-message",
        tenantId: state.tenant.id,
        messageId: message.id,
        channelEventId: null,
        providerEventId: "provider-event-visible",
        revisionAction: "edit" as const,
        priorContentStatus: "available" as const,
        currentContentStatus: "edited" as const,
        priorBodyDigest: "old",
        currentBodyDigest: "new",
        revisionSequence: 1,
        providerTime: null,
        observedAt: "2026-07-10T10:00:00.000Z",
      },
      {
        id: "revision-channel-event-only",
        tenantId: state.tenant.id,
        messageId: null,
        channelEventId: "channel-event-1",
        providerEventId: "provider-event-hidden",
        revisionAction: "unknown_target" as const,
        priorContentStatus: null,
        currentContentStatus: "content_unavailable" as const,
        priorBodyDigest: null,
        currentBodyDigest: null,
        revisionSequence: 1,
        providerTime: null,
        observedAt: "2026-07-10T10:00:00.000Z",
      },
    ],
  };
}
