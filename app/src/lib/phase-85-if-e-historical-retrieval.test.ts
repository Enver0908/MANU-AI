import { describe, expect, it } from "vitest";
import {
  appendP85IfEHistoricalRetrievalNotifications,
  mapConversationMessagesForRetrieval,
  mapMessageRecordToRetrievalCandidate,
  resolveStructuredRecordUpdateNotificationInState,
} from "./phase-85-if-e-historical-retrieval";
import { createInitialState } from "./seed-data";
import { buildTestNotification } from "./phase-85-stage-4b-notifications";
import { mapSupabaseSearchRowToRetrievalCandidate } from "./phase-85-if-e-supabase-search";
import { buildP85IfEStructuredRevisionContext } from "./simulator";
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
  it("derives target-specific structured revisions from application state", () => {
    const state = createInitialState();
    const client = state.clients.find((item) => item.id === "client-mert")!;
    const context = buildP85IfEStructuredRevisionContext(client, {
      ...state,
      clientMenuPlans: [{
        id: "menu-context-1",
        tenantId: state.tenant.id,
        clientId: client.id,
        dietitianId: state.dietitian.id,
        templateType: "day_by_day_detailed",
        status: "active",
        version: 1,
        revision: 9,
        title: "Menu",
        effectiveDate: null,
        mealSlots: [],
        preferredFoods: [],
        avoidFoods: [],
        dietitianNotes: "",
        clientFacingNotes: "",
        exportVisible: true,
        migratedFromLegacyDietPlan: false,
        catalogVersion: "test",
        catalogSourceSha256: "test",
        catalogRecordSetSha256: "test",
        createdAt: "2026-05-22T08:00:00.000Z",
        updatedAt: "2026-05-22T09:00:00.000Z",
        activatedAt: "2026-05-22T09:00:00.000Z",
      }],
    });

    expect(context.menuPlanRevision).toBe(9);
    expect(context.menuPlanUpdatedAt).toBe("2026-05-22T09:00:00.000Z");
    expect(context.dietPlanRevision).toBe(client.contextRevision);
  });

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
            baselineRevision: 3,
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
            baselineRevision: 3,
            reason: "newer_dietitian_whatsapp_instruction",
          },
        ],
      },
    });
    expect(deduped).toHaveLength(2);
    expect(deduped[0]?.occurrenceCount).toBe(2);
    expect(deduped[0]?.dedupeKey).toContain("p85-4b:v1:structured_record_update_required:");
  });

  it("requires the target panel revision to advance before structured notification closure", () => {
    const state = createInitialState();
    const notification = buildTestNotification({
      id: "structured-update-1",
      tenantId: state.tenant.id,
      type: "system",
      kind: "structured_record_update_required",
      entityType: "client",
      entityId: "client-mert",
      clientId: "client-mert",
      title: "Structured record update required",
      body: "Update required",
      read: false,
      acknowledgedAt: null,
      dedupeKey: "p85-4b:v1:structured_record_update_required:client-mert:menu:message-1",
      sourceMessageId: "message-1",
      targetPanel: "menu",
      baselineRevision: 3,
      resolvedAt: null,
      resolvedByDietitianId: null,
      createdAt: "2026-05-22T12:00:00.000Z",
    });

    expect(() => resolveStructuredRecordUpdateNotificationInState(
      {
        ...state,
        clientMenuPlans: [{
          id: "menu-1",
          tenantId: state.tenant.id,
          clientId: "client-mert",
          dietitianId: state.dietitian.id,
          templateType: "day_by_day_detailed",
          status: "active",
          version: 1,
          revision: 3,
          title: "Menu",
          effectiveDate: null,
          mealSlots: [],
          preferredFoods: [],
          avoidFoods: [],
          dietitianNotes: "",
          clientFacingNotes: "",
          exportVisible: true,
          migratedFromLegacyDietPlan: false,
          catalogVersion: "test",
          catalogSourceSha256: "test",
          catalogRecordSetSha256: "test",
          createdAt: "2026-05-22T10:00:00.000Z",
          updatedAt: "2026-05-22T10:00:00.000Z",
          activatedAt: "2026-05-22T10:00:00.000Z",
        }],
        notifications: [notification],
      },
      notification.id,
      state.dietitian.id,
    )).toThrowError(/structured_update_revision_pending/);

    const resolved = resolveStructuredRecordUpdateNotificationInState(
      {
        ...state,
        clientMenuPlans: [{
          id: "menu-1",
          tenantId: state.tenant.id,
          clientId: "client-mert",
          dietitianId: state.dietitian.id,
          templateType: "day_by_day_detailed",
          status: "active",
          version: 1,
          revision: 4,
          title: "Menu",
          effectiveDate: null,
          mealSlots: [],
          preferredFoods: [],
          avoidFoods: [],
          dietitianNotes: "",
          clientFacingNotes: "",
          exportVisible: true,
          migratedFromLegacyDietPlan: false,
          catalogVersion: "test",
          catalogSourceSha256: "test",
          catalogRecordSetSha256: "test",
          createdAt: "2026-05-22T10:00:00.000Z",
          updatedAt: "2026-05-22T11:00:00.000Z",
          activatedAt: "2026-05-22T10:00:00.000Z",
        }],
        notifications: [notification],
      },
      notification.id,
      state.dietitian.id,
    );
    expect(resolved.notifications[0]?.resolvedAt).toBeTruthy();
  });

  it("does not close a menu notification when only client context revision advances", () => {
    const state = createInitialState();
    const notification = buildTestNotification({
      id: "structured-update-context-only",
      tenantId: state.tenant.id,
      type: "system",
      kind: "structured_record_update_required",
      entityType: "client",
      entityId: "client-mert",
      clientId: "client-mert",
      title: "Structured record update required",
      body: "Update required",
      read: false,
      acknowledgedAt: null,
      dedupeKey: "p85-4b:v1:structured_record_update_required:client-mert:menu:message-1",
      sourceMessageId: "message-1",
      targetPanel: "menu",
      baselineRevision: 2,
      resolvedAt: null,
      resolvedByDietitianId: null,
      createdAt: "2026-05-22T12:00:00.000Z",
    });

    expect(() => resolveStructuredRecordUpdateNotificationInState(
      {
        ...state,
        clients: state.clients.map((client) =>
          client.id === "client-mert" ? { ...client, contextRevision: client.contextRevision + 10 } : client,
        ),
        clientMenuPlans: [],
        notifications: [notification],
      },
      notification.id,
      state.dietitian.id,
    )).toThrowError(/structured_update_revision_pending/);
  });
});
