import { beforeEach, describe, expect, it } from "vitest";
import { processInboundWhatsAppChannelBatch } from "./phase-85-if-c-channel-event-ledger";
import {
  channelMessageRevisionToDbRow,
  humanControlSessionToDbRow,
  riskActivityEventToDbRow,
} from "./phase-85-if-d-supabase-mappers";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";
import { resetRateLimits } from "./rate-limit";
import type { ChannelAccountBindingRecord, ChannelActorBindingRecord, ManuAppState, MessageRecord } from "./types";

const TEST_SECRET = "synthetic-ifd-test-secret";

function testEnv() {
  return {
    NODE_ENV: "test",
    MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK: "true",
    MANU_MOCK_WHATSAPP_WEBHOOK_SECRET: TEST_SECRET,
  } as NodeJS.ProcessEnv;
}

function buildAccountBinding(overrides: Partial<ChannelAccountBindingRecord> = {}): ChannelAccountBindingRecord {
  return {
    id: "account-binding-1",
    tenantId: DEMO_TENANT_ID,
    provider: "whatsapp_cloud",
    providerAccountId: "SYNTHETIC_PHONE_1",
    wabaId: "SYNTHETIC_WABA_1",
    businessPhoneNumberId: "SYNTHETIC_PHONE_1",
    normalizedDisplayNumber: null,
    operatingMode: "mock",
    lifecycleStatus: "active",
    attributionPolicy: "shared_authorized_team",
    verifiedAt: "2024-06-01T00:00:00.000Z",
    revokedAt: null,
    createdByDietitianId: null,
    revokedByDietitianId: null,
    createdAt: "2024-06-01T00:00:00.000Z",
    updatedAt: "2024-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildSharedActorBinding(): ChannelActorBindingRecord {
  return {
    id: "actor-binding-1",
    tenantId: DEMO_TENANT_ID,
    accountBindingId: "account-binding-1",
    dietitianId: null,
    actorType: "business_operator",
    attributionBasis: "shared_authorized_team",
    validFrom: "2024-06-01T00:00:00.000Z",
    validTo: null,
    verifiedAt: "2024-06-01T00:00:00.000Z",
    revokedAt: null,
    createdByDietitianId: null,
    revokedByDietitianId: null,
    auditReasonCode: null,
    createdAt: "2024-06-01T00:00:00.000Z",
  };
}

function stateWithTrustRoots(clientPatch: Partial<ManuAppState["clients"][number]> = {}): ManuAppState {
  const state = createInitialState();
  return {
    ...state,
    channelAccountBindings: [buildAccountBinding()],
    channelActorBindings: [buildSharedActorBinding()],
    clients: state.clients.map((client) =>
      client.id === "client-mert" ? { ...client, aiStatus: "active", aiMode: "autopilot", ...clientPatch } : client,
    ),
  };
}

function businessEchoPayload(providerEventId: string, body = "Yarin gorusuruz", to = "905551110001") {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "SYNTHETIC_WABA_1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "SYNTHETIC_PHONE_1" },
              smb_message_echoes: [
                {
                  from: "SYNTHETIC_PHONE_1",
                  to,
                  id: providerEventId,
                  timestamp: "1720000000",
                  type: "text",
                  text: { body },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function historyClientPayload(providerEventId: string, body = "Eski mesaj") {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "SYNTHETIC_WABA_1",
        changes: [
          {
            field: "history",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "SYNTHETIC_PHONE_1" },
              history_messages: [
                {
                  from: "905551110001",
                  id: providerEventId,
                  timestamp: "1719000000",
                  type: "text",
                  text: { body },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function editPayload(providerEventId: string, targetMessageId: string, body: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "SYNTHETIC_WABA_1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "SYNTHETIC_PHONE_1" },
              messages: [
                {
                  from: "905551110001",
                  id: providerEventId,
                  timestamp: "1720000100",
                  type: "text",
                  edited_message_id: targetMessageId,
                  text: { body },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function revokePayload(providerEventId: string, targetMessageId: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "SYNTHETIC_WABA_1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "SYNTHETIC_PHONE_1" },
              messages: [
                {
                  from: "905551110001",
                  id: providerEventId,
                  timestamp: "1720000200",
                  type: "revoked",
                  edited_message_id: targetMessageId,
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function unsupportedClientMediaPayload(providerEventId: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "SYNTHETIC_WABA_1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "SYNTHETIC_PHONE_1" },
              messages: [
                {
                  from: "905551110001",
                  id: providerEventId,
                  timestamp: "1720000300",
                  type: "image",
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function stateWithPendingDraft(state: ManuAppState): ManuAppState {
  const client = state.clients.find((item) => item.id === "client-mert")!;
  const conversation = state.conversations.find((item) => item.clientId === "client-mert")!;
  const decisionId = crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const createdAt = "2024-07-01T09:30:00.000Z";

  return {
    ...state,
    clients: state.clients.map((item) =>
      item.id === client.id
        ? { ...item, aiStatus: "active", aiMode: "autopilot", humanTakeoverLocked: false }
        : item,
    ),
    aiDecisions: [
      ...state.aiDecisions,
      {
        id: decisionId,
        tenantId: state.tenant.id,
        conversationId: conversation.id,
        clientId: client.id,
        mode: "autopilot",
        aiStatus: "active",
        personaId: client.selectedPersonaId,
        risk: "yellow",
        model: "gemini-3",
        promptVersion: "test",
        providerAttempted: true,
        providerId: "gemini",
        providerStatus: "ok",
        providerErrorCode: null,
        sendStatus: "draft_created",
        action: "draft_for_approval",
        blockedReason: null,
        qualityIssues: [],
        reasons: ["test_pending_draft"],
        createdAt,
      },
    ],
    messages: [
      ...state.messages,
      {
        id: messageId,
        tenantId: state.tenant.id,
        conversationId: conversation.id,
        sender: "assistant",
        body: "Draft awaiting approval",
        origin: "ai_generated",
        generatedByAiDecisionId: decisionId,
        authorDietitianId: null,
        approvedByDietitianId: null,
        sourceMessageId: null,
        risk: "yellow",
        status: "draft",
        createdAt,
      },
    ],
  };
}


describe("phase 85 if-d transcript and human control", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("stores a business-human echo as verified dietitian_manual without invoking the client inbound path", async () => {
    const state = stateWithTrustRoots();
    const initialCount = state.messages.length;

    const { state: next, result } = await processInboundWhatsAppChannelBatch(
      state,
      businessEchoPayload("wamid.IFD_ECHO_1"),
      { providedSecret: TEST_SECRET, env: testEnv() },
    );

    expect(result.ok).toBe(true);
    expect(next.messages).toHaveLength(initialCount + 1);
    expect(next.processedSimulationKeys).not.toContain("wamid.IFD_ECHO_1");
    expect(next.lastSimulation).toBe(state.lastSimulation);

    const stored = next.messages.find((message) => message.providerMessageId === "wamid.IFD_ECHO_1");
    expect(stored).toMatchObject({
      sender: "dietitian",
      origin: "dietitian_manual",
      actorType: "business_operator",
      authorInterface: "whatsapp_business_surface",
      actorResolutionBasis: "shared_authorized_team",
      authorDietitianId: null,
      contentStatus: "available",
      retrievalEligibility: "eligible",
    });
  });

  it("auto-pauses active AI, invalidates drafts, and opens an external human-control session", async () => {
    const state = stateWithPendingDraft(stateWithTrustRoots());
    expect(state.aiDecisions.some((decision) => decision.sendStatus === "draft_created")).toBe(true);

    const { state: next } = await processInboundWhatsAppChannelBatch(state, businessEchoPayload("wamid.IFD_ECHO_2"), {
      providedSecret: TEST_SECRET,
      env: testEnv(),
    });

    const client = next.clients.find((item) => item.id === "client-mert");
    expect(client).toMatchObject({
      aiStatus: "passive",
      aiMode: "paused",
      humanTakeoverLocked: true,
    });
    expect(next.aiDecisions.some((decision) => decision.sendStatus === "draft_invalidated")).toBe(true);
    expect(next.humanControlSessions).toHaveLength(1);
    expect(next.humanControlSessions[0]).toMatchObject({
      reason: "external_human_active",
      status: "active",
      humanResponseObservedCount: 1,
    });
    expect(next.riskActivityEvents.some((event) => event.eventType === "ai_paused")).toBe(true);
    expect(next.riskActivityEvents.some((event) => event.eventType === "human_response_observed")).toBe(true);
  });

  it("joins an existing passive session and records another human_response_observed without resolving risk", async () => {
    let state = stateWithTrustRoots({ aiStatus: "passive", aiMode: "manual", humanTakeoverLocked: true });
    state = {
      ...state,
      humanControlSessions: [
        {
          id: "session-existing",
          tenantId: DEMO_TENANT_ID,
          clientId: "client-mert",
          conversationId: state.conversations.find((item) => item.clientId === "client-mert")!.id,
          reason: "manual_takeover",
          status: "active",
          previousAiStatus: "active",
          previousAiMode: "autopilot",
          linkedHandoffId: null,
          linkedYellowHoldMessageId: null,
          openedByMessageId: null,
          latestHumanMessageId: null,
          humanResponseObservedCount: 1,
          openedAt: "2024-07-01T09:00:00.000Z",
          resolvedAt: null,
          reactivatedByDietitianId: null,
          reactivationReasonCode: null,
          restoredAiMode: null,
        },
      ],
    };

    const { state: next } = await processInboundWhatsAppChannelBatch(state, businessEchoPayload("wamid.IFD_ECHO_3"), {
      providedSecret: TEST_SECRET,
      env: testEnv(),
    });

    expect(next.humanControlSessions).toHaveLength(1);
    expect(next.humanControlSessions[0].humanResponseObservedCount).toBe(2);
    expect(next.clients.find((item) => item.id === "client-mert")?.aiStatus).toBe("passive");
  });

  it("reconciles history messages by provider message id without AI side effects", async () => {
    const state = stateWithTrustRoots();
    const { state: next } = await processInboundWhatsAppChannelBatch(
      state,
      historyClientPayload("wamid.IFD_HISTORY_1"),
      { providedSecret: TEST_SECRET, env: testEnv() },
    );

    const stored = next.messages.find((message) => message.providerMessageId === "wamid.IFD_HISTORY_1");
    expect(stored).toMatchObject({
      origin: "client_inbound",
      sender: "client",
      body: "Eski mesaj",
    });
    expect(next.lastSimulation).toBe(state.lastSimulation);
  });

  it("applies edit and revoke lifecycle with revision records and draft invalidation", async () => {
    let state = stateWithTrustRoots();
    const inbound = await processInboundWhatsAppChannelBatch(state, {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "SYNTHETIC_WABA_1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "SYNTHETIC_PHONE_1" },
                messages: [
                  {
                    from: "905551110001",
                    id: "wamid.IFD_TARGET",
                    timestamp: "1720000000",
                    type: "text",
                    text: { body: "Ilk metin" },
                  },
                ],
              },
            },
          ],
        },
      ],
    }, { providedSecret: TEST_SECRET, env: testEnv() });
    state = stateWithPendingDraft(inbound.state);
    const target = state.messages.find((message) => message.providerMessageId === "wamid.IFD_TARGET") as MessageRecord;

    const edited = await processInboundWhatsAppChannelBatch(
      state,
      editPayload("wamid.IFD_EDIT", "wamid.IFD_TARGET", "Guncel metin"),
      { providedSecret: TEST_SECRET, env: testEnv() },
    );
    const editedMessage = edited.state.messages.find((message) => message.id === target.id);
    expect(editedMessage?.body).toBe("Guncel metin");
    expect(editedMessage?.contentStatus).toBe("edited");
    expect(edited.state.channelMessageRevisions.some((revision) => revision.revisionAction === "edit")).toBe(true);
    expect(edited.state.aiDecisions.some((decision) => decision.sendStatus === "draft_invalidated")).toBe(true);

    const revoked = await processInboundWhatsAppChannelBatch(
      edited.state,
      revokePayload("wamid.IFD_REVOKE", "wamid.IFD_TARGET"),
      { providedSecret: TEST_SECRET, env: testEnv() },
    );
    const revokedMessage = revoked.state.messages.find((message) => message.id === target.id);
    expect(revokedMessage?.contentStatus).toBe("revoked");
    expect(revokedMessage?.retrievalEligibility).toBe("excluded_revoked");
    expect(revoked.state.channelMessageRevisions.some((revision) => revision.revisionAction === "revoke")).toBe(true);
  });

  it("stores unsupported client media as content_unavailable and pauses the client with a review notification", async () => {
    const state = stateWithTrustRoots({ aiStatus: "active", aiMode: "autopilot" });
    const { state: next } = await processInboundWhatsAppChannelBatch(
      state,
      unsupportedClientMediaPayload("wamid.IFD_MEDIA_1"),
      { providedSecret: TEST_SECRET, env: testEnv() },
    );

    const stored = next.messages.find((message) => message.providerMessageId === "wamid.IFD_MEDIA_1");
    expect(stored?.contentStatus).toBe("content_unavailable");
    expect(next.clients.find((item) => item.id === "client-mert")).toMatchObject({
      aiStatus: "passive",
      aiMode: "paused",
    });
    expect(next.notifications.some((notification) => notification.entityId === "client-mert")).toBe(true);
  });

  it("maps human-control, revision, and risk-activity records to Supabase rows", () => {
    const session = humanControlSessionToDbRow({
      id: "session-1",
      tenantId: DEMO_TENANT_ID,
      clientId: "client-mert",
      conversationId: "conversation-1",
      reason: "external_human_active",
      status: "active",
      previousAiStatus: "active",
      previousAiMode: "autopilot",
      linkedHandoffId: null,
      linkedYellowHoldMessageId: null,
      openedByMessageId: "message-1",
      latestHumanMessageId: "message-1",
      humanResponseObservedCount: 1,
      openedAt: "2024-07-01T10:00:00.000Z",
      resolvedAt: null,
      reactivatedByDietitianId: null,
      reactivationReasonCode: null,
      restoredAiMode: null,
    });
    expect(session.reason).toBe("external_human_active");

    const revision = channelMessageRevisionToDbRow({
      id: "revision-1",
      tenantId: DEMO_TENANT_ID,
      messageId: "message-1",
      channelEventId: "event-1",
      providerEventId: "wamid.EDIT",
      revisionAction: "edit",
      priorContentStatus: "available",
      currentContentStatus: "edited",
      priorBodyDigest: "a",
      currentBodyDigest: "b",
      revisionSequence: 1,
      providerTime: "2024-07-01T10:00:00.000Z",
      observedAt: "2024-07-01T10:00:00.000Z",
    });
    expect(revision.revision_action).toBe("edit");

    const riskEvent = riskActivityEventToDbRow({
      id: "risk-1",
      tenantId: DEMO_TENANT_ID,
      clientId: "client-mert",
      conversationId: "conversation-1",
      humanControlSessionId: "session-1",
      eventType: "human_response_observed",
      sourceMessageId: "message-1",
      handoffId: null,
      aiDecisionId: null,
      metadata: {},
      createdAt: "2024-07-01T10:00:00.000Z",
    });
    expect(riskEvent.event_type).toBe("human_response_observed");
  });
});
