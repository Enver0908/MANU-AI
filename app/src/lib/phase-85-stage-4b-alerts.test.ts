import { describe, expect, it } from "vitest";
import { assertDashboardMessagesComplete } from "./i18n";
import { createInitialState } from "./seed-data";
import { buildPhase70DietitianDemoAnswers } from "./phase-70-seed-answers";
import {
  buildRedClinicalAlertId,
  buildYellowClinicalAlertId,
  filterClinicalAlerts,
  projectClinicalAlerts,
  projectClinicalAlertsFromState,
  resolveClinicalAlertKind,
  resolveDietitianClinicalSla,
  sortClinicalAlerts,
  type ClinicalAlertListItem,
} from "./phase-85-stage-4b-alerts";
import { projectClinicalAlertsFromSupabaseState } from "./supabase-store";
import type { AppTenantContext } from "./auth-context";
import type { ClientRecord, ManuAppState } from "./types";
import { runInboundSimulation } from "./simulator";

const NOW = "2026-07-11T12:00:00.000Z";

function withClientPatch(state: ManuAppState, clientId: string, patch: Partial<ClientRecord>): ManuAppState {
  return {
    ...state,
    clients: state.clients.map((client) => (client.id === clientId ? { ...client, ...patch } : client)),
  };
}

function baseProjectionInput(state: ManuAppState) {
  return {
    now: NOW,
    defaultTimezone: state.dietitian.timezone,
    visibleClientIds: new Set(state.clients.map((client) => client.id)),
    clients: state.clients,
    conversations: state.conversations,
    handoffCases: state.handoffCases,
    messages: state.messages,
    dietitianFormResponses: state.dietitianFormResponses,
  };
}

describe("phase-85-stage-4b alerts", () => {
  it("keeps dashboard alert reason translations complete", () => {
    expect(() => assertDashboardMessagesComplete()).not.toThrow();
  });

  it("maps reason codes to the highest-priority clinical alert kind", () => {
    expect(resolveClinicalAlertKind(["supplement_or_medication_question", "possible_emergency_symptom"])).toEqual({
      kind: "emergency_symptom",
      reasonLabelKey: "alertReasonEmergencySymptom",
      additionalReasonCount: 1,
    });
    expect(resolveClinicalAlertKind(["unknown_reason_code"])).toEqual({
      kind: "clinical_review_required",
      reasonLabelKey: "alertReasonClinicalReviewRequired",
      additionalReasonCount: 0,
    });
    expect(resolveClinicalAlertKind(["lab_or_diagnostic_result"])).toEqual({
      kind: "lab_result",
      reasonLabelKey: "alertReasonLabResult",
      additionalReasonCount: 0,
    });
    expect(resolveClinicalAlertKind(["prompt_injection_attempt"])).toEqual({
      kind: "security_review",
      reasonLabelKey: "alertReasonSecurityReview",
      additionalReasonCount: 0,
    });
  });

  it("drops foreign conversation messages from alert linkage", () => {
    const state = createInitialState();
    const foreignMessageId = state.messages[0]!.id;
    const patched = withClientPatch(state, "client-elif", {
      yellowRiskHold: {
        status: "active",
        startedAt: NOW,
        firstMessageId: foreignMessageId,
        latestMessageId: foreignMessageId,
        activeDraftMessageId: foreignMessageId,
        activeDecisionId: null,
        messageIds: [foreignMessageId],
        reasons: ["symptom_question"],
        previousAiStatus: "active",
        previousAiMode: "copilot",
        blockedByRedHandoffId: null,
      },
    });

    const alert = projectClinicalAlertsFromState(patched, { now: NOW }).find(
      (item) => item.clientId === "client-elif",
    );
    expect(alert?.sourceMessageId).toBeNull();
    expect(alert?.activeDraftMessageId).toBeNull();
    expect(alert?.target.messageId).toBeUndefined();
  });

  it("resolves SLA states for configured, same-day, and invalid values", () => {
    expect(
      resolveDietitianClinicalSla({
        severity: "red",
        startedAt: "2026-07-11T11:00:00.000Z",
        now: NOW,
        timezone: "Europe/Istanbul",
        redResponseSla: "30dk",
      }),
    ).toMatchObject({
      elapsedMinutes: 60,
      slaState: "overdue",
    });

    expect(
      resolveDietitianClinicalSla({
        severity: "yellow",
        startedAt: "2026-07-11T11:30:00.000Z",
        now: NOW,
        timezone: "Europe/Istanbul",
        yellowReviewSla: "2s",
      }),
    ).toMatchObject({
      elapsedMinutes: 30,
      slaState: "within_sla",
    });

    const sameDay = resolveDietitianClinicalSla({
      severity: "yellow",
      startedAt: "2026-07-11T08:00:00.000Z",
      now: NOW,
      timezone: "Europe/Istanbul",
      yellowReviewSla: "Ayni gun",
    });
    expect(sameDay.slaDeadline).not.toBeNull();
    expect(sameDay.slaState).toBe("within_sla");

    expect(
      resolveDietitianClinicalSla({
        severity: "red",
        startedAt: "2026-07-11T11:00:00.000Z",
        now: NOW,
        timezone: "Europe/Istanbul",
        redResponseSla: "invalid",
      }),
    ).toMatchObject({
      slaDeadline: null,
      slaState: "unconfigured",
    });
  });

  it("suppresses yellow alerts when red lock is active for the same client", async () => {
    const redState = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Gogsum agriyor ve nefes alamiyorum",
      idempotencyKey: "p85-4b-red-precedence",
      now: NOW,
    });
    const client = redState.clients.find((item) => item.id === "client-mert");
    expect(client?.redRiskLock.status).toBe("locked");

    const withYellow = withClientPatch(redState, "client-mert", {
      yellowRiskHold: {
        status: "active",
        startedAt: "2026-07-11T10:00:00.000Z",
        firstMessageId: "msg-yellow-shadow",
        latestMessageId: "msg-yellow-shadow",
        activeDraftMessageId: null,
        activeDecisionId: null,
        messageIds: ["msg-yellow-shadow", "msg-yellow-shadow-2"],
        reasons: ["supplement_or_medication_question"],
        previousAiStatus: "passive",
        previousAiMode: "paused",
        blockedByRedHandoffId: client?.redRiskLock.status === "locked" ? client.redRiskLock.handoffId : null,
      },
    });

    const alerts = projectClinicalAlerts(baseProjectionInput(withYellow));
    const clientAlerts = alerts.filter((alert) => alert.clientId === "client-mert");
    expect(clientAlerts).toHaveLength(1);
    expect(clientAlerts[0]?.severity).toBe("red");
  });

  it("groups multiple yellow message ids into one alert row", async () => {
    const yellowState = await runInboundSimulation(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "p85-4b-yellow-group",
      now: NOW,
    });
    const hold = yellowState.clients.find((item) => item.id === "client-elif")?.yellowRiskHold;
    expect(hold?.status).toBe("active");

    const grouped = withClientPatch(yellowState, "client-elif", {
      yellowRiskHold:
        hold?.status === "active"
          ? {
              ...hold,
              messageIds: [...hold.messageIds, "msg-extra-1", "msg-extra-2"],
              reasons: ["supplement_or_medication_question", "plan_change_request"],
            }
          : hold,
    });

    const alerts = projectClinicalAlerts(baseProjectionInput(grouped));
    const yellowAlerts = alerts.filter((alert) => alert.clientId === "client-elif");
    expect(yellowAlerts).toHaveLength(1);
    expect(yellowAlerts[0]?.additionalReasonCount).toBe(1);
    expect(yellowAlerts[0]?.id).toBe(
      buildYellowClinicalAlertId("client-elif", hold?.status === "active" ? hold.firstMessageId : ""),
    );
  });

  it("does not leak raw clinical content or reason codes in alert DTOs", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "p85-4b-no-leak",
      now: NOW,
    });
    const alerts = projectClinicalAlerts(baseProjectionInput(state));
    const serialized = JSON.stringify(alerts);
    expect(serialized).not.toContain("supplement_or_medication_question");
    expect(serialized).not.toContain("takviye");
    expect(serialized).not.toContain("safeAcknowledgement");
    for (const alert of alerts) {
      expect(alert).not.toHaveProperty("reasons");
      expect(alert).not.toHaveProperty("body");
      expect(alert.reasonLabelKey).toMatch(/^alertReason/);
    }
  });

  it("sorts red before yellow and newest starts first with stable id tie-break", () => {
    const alerts: ClinicalAlertListItem[] = [
      {
        id: "yellow:client-b:msg-1",
        clientId: "client-b",
        conversationId: "conv-b",
        clientFullName: "Beta",
        severity: "yellow",
        kind: "clinical_review_required",
        reasonLabelKey: "alertReasonClinicalReviewRequired",
        additionalReasonCount: 0,
        sourceMessageId: "msg-1",
        activeDraftMessageId: null,
        handoffId: null,
        startedAt: "2026-07-11T11:00:00.000Z",
        elapsedMinutes: 60,
        slaDeadline: null,
        slaState: "unconfigured",
        target: { section: "messages", clientId: "client-b", conversationId: "conv-b", source: "alert", sourceId: "yellow:client-b:msg-1" },
      },
      {
        id: "red:handoff-a",
        clientId: "client-a",
        conversationId: "conv-a",
        clientFullName: "Alpha",
        severity: "red",
        kind: "emergency_symptom",
        reasonLabelKey: "alertReasonEmergencySymptom",
        additionalReasonCount: 0,
        sourceMessageId: "msg-a",
        activeDraftMessageId: null,
        handoffId: "handoff-a",
        startedAt: "2026-07-11T10:00:00.000Z",
        elapsedMinutes: 120,
        slaDeadline: null,
        slaState: "unconfigured",
        target: { section: "messages", clientId: "client-a", conversationId: "conv-a", source: "alert", sourceId: "red:handoff-a" },
      },
      {
        id: "red:handoff-b",
        clientId: "client-c",
        conversationId: "conv-c",
        clientFullName: "Gamma",
        severity: "red",
        kind: "emergency_symptom",
        reasonLabelKey: "alertReasonEmergencySymptom",
        additionalReasonCount: 0,
        sourceMessageId: "msg-c",
        activeDraftMessageId: null,
        handoffId: "handoff-b",
        startedAt: "2026-07-11T11:30:00.000Z",
        elapsedMinutes: 30,
        slaDeadline: null,
        slaState: "unconfigured",
        target: { section: "messages", clientId: "client-c", conversationId: "conv-c", source: "alert", sourceId: "red:handoff-b" },
      },
    ];

    expect(sortClinicalAlerts(alerts).map((alert) => alert.id)).toEqual([
      "red:handoff-b",
      "red:handoff-a",
      "yellow:client-b:msg-1",
    ]);
  });

  it("filters alerts by severity and Turkish-insensitive client name query", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "p85-4b-filter",
      now: NOW,
    });
    const alerts = projectClinicalAlerts(baseProjectionInput(state));
    expect(filterClinicalAlerts(alerts, { severity: "yellow" })).toHaveLength(1);
    expect(filterClinicalAlerts(alerts, { severity: "red" })).toHaveLength(0);
    expect(filterClinicalAlerts(alerts, { query: "ELİF" })).toHaveLength(1);
    expect(filterClinicalAlerts(alerts, { query: "mert" })).toHaveLength(0);
  });

  it("uses safe clients fallback target when conversation linkage is broken", () => {
    const state = createInitialState();
    const client = state.clients[0]!;
    const handoffId = "handoff-missing-link";
    const patched = withClientPatch(state, client.id, {
      redRiskLock: {
        status: "locked",
        handoffId,
        lockedAt: NOW,
        reasons: ["possible_emergency_symptom"],
        previousAiStatus: "passive",
        previousAiMode: "paused",
      },
    });

    const alerts = projectClinicalAlerts(baseProjectionInput(patched));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.id).toBe(buildRedClinicalAlertId(handoffId));
    expect(alerts[0]?.conversationId).toBeNull();
    expect(alerts[0]?.target).toEqual({
      section: "clients",
      clientId: client.id,
      source: "alert",
      sourceId: buildRedClinicalAlertId(handoffId),
    });
  });

  it("projects alerts for 5,000 clients within a bounded runtime budget", () => {
    const state = createInitialState();
    const clients: ClientRecord[] = [];
    const conversations = [...state.conversations];
    const messages = [...state.messages];
    const handoffCases = [...state.handoffCases];

    for (let index = 0; index < 5000; index += 1) {
      const clientId = `scale-client-${index}`;
      const conversationId = `scale-conv-${index}`;
      const messageId = `scale-msg-${index}`;
      const isRed = index % 17 === 0;
      const isYellow = !isRed && index % 5 === 0;

      clients.push({
        ...state.clients[0]!,
        id: clientId,
        fullName: `Scale Client ${index}`,
        channelUserId: `scale-user-${index}`,
        primaryPhoneE164: `+9055500${String(index).padStart(5, "0")}`,
        redRiskLock: isRed
          ? {
              status: "locked",
              handoffId: `scale-handoff-${index}`,
              lockedAt: `2026-07-11T${String(index % 24).padStart(2, "0")}:00:00.000Z`,
              reasons: ["possible_emergency_symptom"],
              previousAiStatus: "passive",
              previousAiMode: "paused",
            }
          : { status: "none" },
        yellowRiskHold: isYellow
          ? {
              status: "active",
              startedAt: `2026-07-11T${String(index % 24).padStart(2, "0")}:15:00.000Z`,
              firstMessageId: messageId,
              latestMessageId: messageId,
              activeDraftMessageId: null,
              activeDecisionId: null,
              messageIds: [messageId],
              reasons: ["supplement_or_medication_question"],
              previousAiStatus: "active",
              previousAiMode: "copilot",
              blockedByRedHandoffId: null,
            }
          : { status: "none" },
      });
      conversations.push({
        ...state.conversations[0]!,
        id: conversationId,
        clientId,
      });
      messages.push({
        ...state.messages[0]!,
        id: messageId,
        conversationId,
      });
      if (isRed) {
        handoffCases.push({
          id: `scale-handoff-${index}`,
          tenantId: state.tenant.id,
          dietitianId: state.dietitian.id,
          clientId,
          conversationId,
          triggeringMessageId: messageId,
          risk: "red",
          reasons: ["possible_emergency_symptom"],
          status: "open",
          urgency: "urgent",
          safeAcknowledgement: "hidden",
          recommendedAction: "hidden",
          createdAt: NOW,
        });
      }
    }

    const scaledState: ManuAppState = {
      ...state,
      clients,
      conversations,
      messages,
      handoffCases,
      dietitianFormResponses: [
        {
          ...state.dietitianFormResponses[0]!,
          answers: buildPhase70DietitianDemoAnswers(),
        },
      ],
    };

    const started = performance.now();
    const alerts = projectClinicalAlertsFromState(scaledState, { now: NOW });
    const elapsedMs = performance.now() - started;

    expect(alerts.length).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(1500);
    expect(alerts.every((alert) => alert.severity === "red" || alert.severity === "yellow")).toBe(true);
  });

  it("produces identical safe output for fallback and scoped supabase projection", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "p85-4b-parity",
      now: NOW,
    });

    const fallbackAlerts = projectClinicalAlertsFromState(state, { now: NOW });
    const context: AppTenantContext = {
      tenantId: state.tenant.id,
      userId: "user-demo",
      dietitianId: state.dietitian.id,
      role: "dietitian",
    };
    const supabaseAlerts = projectClinicalAlertsFromSupabaseState(state, context, [], { now: NOW });

    expect(supabaseAlerts).toEqual(fallbackAlerts);
  });
});
