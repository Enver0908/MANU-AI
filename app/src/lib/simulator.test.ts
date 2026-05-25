import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import {
  acknowledgeNotificationInState,
  markNotificationReadInState,
  runInboundSimulation,
  updateClientInState,
} from "./simulator";

describe("local inbound simulator", () => {
  it("auto-sends green autopilot messages with model routing", async () => {
    const next = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Bugun kahvalti icin pratik bir degisim onerir misin?",
      idempotencyKey: "green-1",
      now: "2026-05-22T10:00:00.000Z",
    });

    expect(next.lastSimulation?.action).toBe("sent");
    expect(next.lastSimulation?.risk).toBe("green");
    expect(next.lastSimulation?.model).toBe("gemini-1.5-flash");
    expect(next.messages.some((message) => message.origin === "ai_generated" && message.status === "sent")).toBe(true);
    expect(next.riskAssessments).toHaveLength(2);
    expect(next.riskAssessments.at(-1)?.level).toBe("green");
    expect(next.aiDecisions.at(-1)?.promptVersion).toBe("manu-prompt-v0.1.0");
    expect(next.aiDecisions.at(-1)?.providerId).toBe("mock-local-provider-v0");
    expect(next.aiDecisions.at(-1)?.providerStatus).toBe("ok");
    expect(next.aiDecisions.at(-1)?.providerErrorCode).toBeNull();
  });

  it("keeps passive clients at no_ai without generated messages", async () => {
    const state = updateClientInState(createInitialState(), "client-mert", {
      aiStatus: "passive",
      aiMode: "autopilot",
    });

    const next = await runInboundSimulation(state, {
      clientId: "client-mert",
      body: "Ara ogunumu neyle degistirebilirim?",
      idempotencyKey: "passive-1",
      now: "2026-05-22T10:05:00.000Z",
    });

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("client_ai_passive");
    expect(countGeneratedMessages(next)).toBe(countGeneratedMessages(state));
    expect(next.riskAssessments).toHaveLength(state.riskAssessments.length + 1);
    expect(next.riskAssessments.at(-1)?.level).toBe("green");
  });

  it("blocks generation before a scheduled activation window starts", async () => {
    const state = updateClientInState(createInitialState(), "client-mert", {
      aiActiveFrom: "2026-05-22T12:00:00.000Z",
    });

    const next = await runInboundSimulation(state, {
      clientId: "client-mert",
      body: "Bugun kahvalti degisimi yapabilir miyim?",
      idempotencyKey: "scheduled-1",
      now: "2026-05-22T10:00:00.000Z",
    });

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("client_ai_not_started");
  });

  it("routes yellow messages to approval drafts on gemini-3", async () => {
    const next = await runInboundSimulation(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "yellow-1",
      now: "2026-05-22T10:10:00.000Z",
    });

    expect(next.lastSimulation?.action).toBe("draft_for_approval");
    expect(next.lastSimulation?.risk).toBe("yellow");
    expect(next.lastSimulation?.model).toBe("gemini-3");
    expect(next.messages.some((message) => message.origin === "ai_generated" && message.status === "draft")).toBe(true);
  });

  it("opens handoff for red messages and does not create an AI message", async () => {
    const state = createInitialState();
    const next = await runInboundSimulation(state, {
      clientId: "client-mert",
      body: "Alerjiden nefes alamiyorum, bogazim sisti.",
      idempotencyKey: "red-1",
      now: "2026-05-22T10:15:00.000Z",
    });

    expect(next.lastSimulation?.action).toBe("handoff");
    expect(next.lastSimulation?.risk).toBe("red");
    expect(next.lastSimulation?.model).toBeNull();
    expect(next.handoffCases).toHaveLength(1);
    expect(next.auditEvents.some((event) => event.eventType === "handoff_notification_queued")).toBe(true);
    expect(countGeneratedMessages(next)).toBe(countGeneratedMessages(state));
    expect(next.aiDecisions.at(-1)?.providerStatus).toBe("not_called");
  });

  it("records provider failures as safe no-send decisions", async () => {
    const state = createInitialState();
    const next = await runInboundSimulation(state, {
      clientId: "client-mert",
      body: "Bugun kahvaltida yumurta yerine ne yiyebilirim?",
      idempotencyKey: "provider-timeout-1",
      mockProviderFailure: "provider_timeout",
      now: "2026-05-22T10:16:00.000Z",
    });

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("provider_timeout");
    expect(countGeneratedMessages(next)).toBe(countGeneratedMessages(state));
    expect(next.aiDecisions.at(-1)?.providerStatus).toBe("failed");
    expect(next.aiDecisions.at(-1)?.providerErrorCode).toBe("provider_timeout");
  });

  it("records provider policy violations as safe no-send decisions", async () => {
    const state = updateClientInState(createInitialState(), "client-mert", {
      dietPlan: { summary: 42 as unknown as string },
    });
    const next = await runInboundSimulation(state, {
      clientId: "client-mert",
      body: "Bugun kahvaltida yumurta yerine ne yiyebilirim?",
      idempotencyKey: "provider-policy-1",
      now: "2026-05-22T10:17:00.000Z",
    });

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("provider_policy_violation");
    expect(countGeneratedMessages(next)).toBe(countGeneratedMessages(state));
    expect(next.aiDecisions.at(-1)?.providerStatus).toBe("failed");
    expect(next.aiDecisions.at(-1)?.providerErrorCode).toBe("provider_policy_violation");
  });

  it("does not duplicate messages or AI decisions for the same idempotency key", async () => {
    const first = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: "duplicate-1",
      now: "2026-05-22T10:20:00.000Z",
    });
    const second = await runInboundSimulation(first, {
      clientId: "client-mert",
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: "duplicate-1",
      now: "2026-05-22T10:21:00.000Z",
    });

    expect(second.lastSimulation?.action).toBe("duplicate_ignored");
    expect(second.messages).toHaveLength(first.messages.length);
    expect(second.aiDecisions).toHaveLength(first.aiDecisions.length);
    expect(second.riskAssessments).toHaveLength(first.riskAssessments.length);
  });

  it("blocks auto-send when the dietitian takeover lock is active", async () => {
    const state = updateClientInState(createInitialState(), "client-mert", {
      humanTakeoverLocked: true,
    });

    const next = await runInboundSimulation(state, {
      clientId: "client-mert",
      body: "Aksam yemeginde corba olur mu?",
      idempotencyKey: "takeover-1",
      now: "2026-05-22T10:25:00.000Z",
    });

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("human_takeover_lock");
    expect(next.lastSimulation?.risk).toBe("green");
    expect(countGeneratedMessages(next)).toBe(countGeneratedMessages(state));
    expect(next.riskAssessments).toHaveLength(state.riskAssessments.length + 1);
  });

  it("blocks autopilot when mandatory safety fields are incomplete", async () => {
    const state = updateClientInState(createInitialState(), "client-mert", {
      mandatorySafetyComplete: false,
      safetyChecklist: {
        goalReviewed: true,
        dietPlanReviewed: false,
        allergiesReviewed: true,
        restrictedFoodsReviewed: true,
        riskFlagsReviewed: true,
        channelPermissionVerified: true,
        adultStatusConfirmed: true,
      },
    });

    const next = await runInboundSimulation(state, {
      clientId: "client-mert",
      body: "Bugun kahvaltida neyi degistirebilirim?",
      idempotencyKey: "safety-fields-1",
      now: "2026-05-22T10:30:00.000Z",
    });

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("mandatory_safety_fields_missing");
    expect(next.lastSimulation?.reasons).toContain("dietPlanReviewed");
    expect(countGeneratedMessages(next)).toBe(countGeneratedMessages(state));
    expect(next.riskAssessments).toHaveLength(state.riskAssessments.length + 1);
  });
  it("blocks generation when channel permission is pending", async () => {
    const state = updateClientInState(createInitialState(), "client-mert", {
      channelPermission: "pending",
    });

    const next = await runInboundSimulation(state, {
      clientId: "client-mert",
      body: "Bugun kahvaltida ne yiyebilirim?",
      idempotencyKey: "pending-perm-1",
      now: "2026-05-22T10:35:00.000Z",
    });

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("channel_permission_pending");
    expect(countGeneratedMessages(next)).toBe(countGeneratedMessages(state));
  });

  it("blocks generation when channel permission is opted_out", async () => {
    const state = updateClientInState(createInitialState(), "client-mert", {
      channelPermission: "opted_out",
    });

    const next = await runInboundSimulation(state, {
      clientId: "client-mert",
      body: "Bugun kahvaltida ne yiyebilirim?",
      idempotencyKey: "opted-out-1",
      now: "2026-05-22T10:36:00.000Z",
    });

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("channel_permission_opted_out");
    expect(countGeneratedMessages(next)).toBe(countGeneratedMessages(state));
  });

  it("blocks generation for clients with empty channelUserId (identity quarantine)", async () => {
    const state = updateClientInState(createInitialState(), "client-mert", {
      channelUserId: "",
    });

    const next = await runInboundSimulation(state, {
      clientId: "client-mert",
      body: "Bugun kahvaltida ne yiyebilirim?",
      idempotencyKey: "no-channel-id-1",
      now: "2026-05-22T10:37:00.000Z",
    });

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("identity_quarantine_no_channel_id");
    expect(countGeneratedMessages(next)).toBe(countGeneratedMessages(state));
  });

  it("blocks generation for clients with unknown adultStatus (identity quarantine)", async () => {
    const state = updateClientInState(createInitialState(), "client-mert", {
      healthProfile: {
        ...createInitialState().clients[0].healthProfile,
        adultStatus: "unknown",
      },
    });

    const next = await runInboundSimulation(state, {
      clientId: "client-mert",
      body: "Bugun kahvaltida ne yiyebilirim?",
      idempotencyKey: "unknown-adult-1",
      now: "2026-05-22T10:38:00.000Z",
    });

    expect(next.lastSimulation?.action).toBe("no_ai");
    expect(next.lastSimulation?.blockedReason).toBe("identity_quarantine_adult_status_unknown");
    expect(countGeneratedMessages(next)).toBe(countGeneratedMessages(state));
  });

  it("audits permission changes with previous and new values", () => {
    const state = createInitialState();
    const next = updateClientInState(state, "client-mert", {
      channelPermission: "blocked",
    });

    const auditEvent = next.auditEvents.find(
      (event) => event.eventType === "channel_permission_changed",
    );
    expect(auditEvent).toBeDefined();
    expect(auditEvent?.entityId).toBe("client-mert");
    expect((auditEvent?.metadata as Record<string, unknown>).previousPermission).toBe("ready");
    expect((auditEvent?.metadata as Record<string, unknown>).newPermission).toBe("blocked");
  });

  it("audits opt-out events with a distinct event type", () => {
    const state = createInitialState();
    const next = updateClientInState(state, "client-mert", {
      channelPermission: "opted_out",
    });

    const auditEvent = next.auditEvents.find(
      (event) => event.eventType === "channel_permission_opted_out",
    );
    expect(auditEvent).toBeDefined();
    expect(auditEvent?.entityId).toBe("client-mert");
    expect((auditEvent?.metadata as Record<string, unknown>).previousPermission).toBe("ready");
    expect((auditEvent?.metadata as Record<string, unknown>).newPermission).toBe("opted_out");
  });
  it("creates a notification record for urgent handoffs without raw message content", async () => {
    const state = createInitialState();
    const next = await runInboundSimulation(state, {
      clientId: "client-mert",
      body: "Alerjiden nefes alamiyorum, bogazim sisti.",
      idempotencyKey: "red-notification-1",
      now: "2026-05-22T10:40:00.000Z",
    });

    expect(next.notifications).toHaveLength(1);
    const notification = next.notifications[0];
    expect(notification.type).toBe("handoff_urgent");
    expect(notification.entityType).toBe("handoff_case");
    expect(notification.title).toContain("Mert Kaya");
    expect(notification.body).not.toContain("nefes");
    expect(notification.body).not.toContain("bogazim");
    expect(notification.read).toBe(false);
    expect(notification.acknowledgedAt).toBeNull();
  });

  it("marks notifications as read and acknowledged", () => {
    const state = createInitialState();
    const notificationId = "notif-1";
    state.notifications.push({
      id: notificationId,
      tenantId: state.tenant.id,
      type: "handoff_urgent",
      entityType: "handoff_case",
      entityId: "case-1",
      title: "Handoff",
      body: "Review required.",
      read: false,
      acknowledgedAt: null,
      createdAt: new Date().toISOString(),
    });

    const readState = markNotificationReadInState(state, notificationId);
    expect(readState.notifications[0].read).toBe(true);
    expect(readState.notifications[0].acknowledgedAt).toBeNull();

    const ackState = acknowledgeNotificationInState(readState, notificationId);
    expect(ackState.notifications[0].read).toBe(true);
    expect(ackState.notifications[0].acknowledgedAt).not.toBeNull();
  });
});

function countGeneratedMessages(state: ReturnType<typeof createInitialState>) {
  return state.messages.filter((message) => message.origin === "ai_generated").length;
}
