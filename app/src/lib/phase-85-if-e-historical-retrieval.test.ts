import { describe, expect, it } from "vitest";
import {
  appendP85IfEHistoricalRetrievalNotifications,
  mapConversationMessagesForRetrieval,
  mapMessageRecordToRetrievalCandidate,
  resolveStructuredRecordUpdateNotificationInState,
} from "./phase-85-if-e-historical-retrieval";
import { createInitialState } from "./seed-data";
import { mapSupabaseSearchRowToRetrievalCandidate } from "./phase-85-if-e-supabase-search";
import type { MessageRecord } from "./types";

function buildMessage(overrides: Partial<MessageRecord> = {}): MessageRecord {
  return {
    id: "message-1",
    tenantId: "tenant-1",
    conversationId: "conversation-1",
    clientId: "client-1",
    sender: "dietitian",
    origin: "dietitian_manual",
    body: "Kahvaltida lor peyniri kullan.",
    status: "sent",
    createdAt: "2026-05-22T08:00:00.000Z",
    risk: null,
    sourceMessageId: null,
    ...overrides,
  };
}

describe("phase-85-if-e historical retrieval", () => {
  it("maps message records into retrieval candidates with legacy eligibility", () => {
    const candidate = mapMessageRecordToRetrievalCandidate(
      buildMessage({ contentStatus: "revoked", retrievalEligibility: undefined }),
    );
    expect(candidate.retrievalEligibility).toBe("excluded_revoked");
  });

  it("isolates conversation corpus by tenant and conversation", () => {
    const corpus = mapConversationMessagesForRetrieval(
      [
        buildMessage({ id: "keep-1" }),
        buildMessage({ id: "drop-tenant", tenantId: "tenant-2" }),
        buildMessage({ id: "drop-conversation", conversationId: "conversation-2" }),
      ],
      "tenant-1",
      "conversation-1",
    );
    expect(corpus.map((item) => item.id)).toEqual(["keep-1"]);
  });

  it("maps supabase search rows into retrieval candidates", () => {
    const candidate = mapSupabaseSearchRowToRetrievalCandidate(
      {
        id: "row-1",
        body: "Menu plan updated for dinner.",
        origin: "dietitian_manual",
        sender: "dietitian",
        actor_type: "business_operator",
        actor_resolution_basis: "shared_authorized_team",
        provider_sent_at: "2026-05-22T08:00:00.000Z",
        created_at: "2026-05-22T08:00:00.000Z",
        conversation_sequence: 12,
        content_status: "available",
        retrieval_eligibility: "eligible",
        rank: 0.42,
      },
      "tenant-1",
      "conversation-1",
    );
    expect(candidate.id).toBe("row-1");
    expect(candidate.tenantId).toBe("tenant-1");
    expect(candidate.conversationId).toBe("conversation-1");
  });

  it("appends structured record update and ambiguous source notifications", () => {
    const notifications = appendP85IfEHistoricalRetrievalNotifications({
      notifications: [],
      tenantId: "tenant-1",
      clientId: "client-1",
      createdAt: "2026-05-22T12:00:00.000Z",
      contextManifest: {
        structuredRecordUpdates: [
          {
            kind: "structured_record_update_required",
            targetPanel: "menu",
            sourceMessageId: "message-1",
            reason: "newer_dietitian_whatsapp_instruction",
          },
        ],
        ambiguousCompetingSources: [
          {
            kind: "ambiguous_competing_authoritative_source",
            sourceMessageIds: ["message-1", "message-2"],
            reason: "competing_dietitian_instructions",
          },
        ],
      },
    });

    expect(notifications).toHaveLength(2);
    expect(notifications[0]?.title).toBe("Structured record update required");
    expect(notifications[1]?.title).toContain("Competing dietitian instructions");
    expect(notifications.every((notification) => notification.type === "system")).toBe(true);

    const deduped = appendP85IfEHistoricalRetrievalNotifications({
      notifications,
      tenantId: "tenant-1",
      clientId: "client-1",
      createdAt: "2026-05-22T12:01:00.000Z",
      contextManifest: {
        structuredRecordUpdates: [
          {
            kind: "structured_record_update_required",
            targetPanel: "menu",
            sourceMessageId: "message-1",
            reason: "newer_dietitian_whatsapp_instruction",
          },
        ],
      },
    });
    expect(deduped).toHaveLength(2);
  });

  it("requires a post-notification context revision before structured notification closure", () => {
    const state = createInitialState();
    const notification = {
      id: "structured-update-1",
      tenantId: state.tenant.id,
      type: "system" as const,
      entityType: "client",
      entityId: "client-mert",
      title: "Structured record update required",
      body: "Update required",
      read: false,
      acknowledgedAt: null,
      dedupeKey: "p85-if-e:structured:client-mert:menu:message-1",
      sourceMessageId: "message-1",
      targetPanel: "menu",
      baselineRevision: 1,
      resolvedAt: null,
      resolvedByDietitianId: null,
      createdAt: "2026-05-22T12:00:00.000Z",
    };

    expect(() => resolveStructuredRecordUpdateNotificationInState(
      { ...state, notifications: [notification] },
      notification.id,
      state.dietitian.id,
    )).toThrowError(/structured_update_revision_pending/);

    const resolved = resolveStructuredRecordUpdateNotificationInState(
      {
        ...state,
        clients: state.clients.map((client) =>
          client.id === "client-mert" ? { ...client, contextRevision: 2 } : client,
        ),
        notifications: [notification],
      },
      notification.id,
      state.dietitian.id,
    );
    expect(resolved.notifications[0]?.resolvedAt).toBeTruthy();
  });
});
