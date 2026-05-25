import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { buildOperationalHealthSnapshot } from "./operational-health";
import type { ManuAppState } from "./types";

describe("operational health snapshot", () => {
  it("counts safe operational signals", () => {
    const state = operationalFixture();
    const snapshot = buildOperationalHealthSnapshot(state, { now: "2026-05-25T12:00:00.000Z" });

    expect(snapshot).toMatchObject({
      openHandoffCount: 2,
      urgentOpenHandoffCount: 1,
      failedProviderDecisionCount: 1,
      unreadNotificationCount: 1,
      pendingDraftCount: 2,
      staleDraftCount: 1,
      passiveClientCount: 1,
      launchBlocked: true,
      blockedLaunchGateCount: 8,
    });
  });

  it("unblocks launch when all known launch gates are approved", () => {
    const snapshot = buildOperationalHealthSnapshot(createInitialState(), {
      approvedLaunchGateIds: [
        "legal_privacy_review",
        "clinical_taxonomy_approval",
        "provider_vendor_review",
        "channel_policy_review",
        "incident_response_runbook",
        "backup_restore_test",
        "secret_rotation_plan",
        "dependency_audit_clearance",
      ],
    });

    expect(snapshot.launchBlocked).toBe(false);
    expect(snapshot.openLaunchGateIds).toEqual([]);
  });

  it("does not include raw health, message, channel, prompt, or secret content", () => {
    const state = operationalFixture();
    const json = JSON.stringify(
      buildOperationalHealthSnapshot(state, {
        now: "2026-05-25T12:00:00.000Z",
        approvedLaunchGateIds: ["unknown_gate"],
      }),
    );

    expect(json).not.toContain("Alerjiden nefes alamiyorum");
    expect(json).not.toContain("+905551110001");
    expect(json).not.toContain("Three meals");
    expect(json).not.toContain("raw prompt");
    expect(json).not.toContain("supabase-service-role-secret");
  });
});

function operationalFixture(): ManuAppState {
  const state = createInitialState();
  return {
    ...state,
    messages: [
      ...state.messages,
      {
        id: "draft-stale",
        tenantId: state.tenant.id,
        conversationId: state.conversations[0].id,
        sender: "assistant",
        body: "Alerjiden nefes alamiyorum raw prompt supabase-service-role-secret",
        origin: "ai_generated",
        status: "draft",
        createdAt: "2026-05-23T09:00:00.000Z",
      },
      {
        id: "draft-fresh",
        tenantId: state.tenant.id,
        conversationId: state.conversations[0].id,
        sender: "assistant",
        body: "Fresh draft",
        origin: "ai_generated",
        status: "draft",
        createdAt: "2026-05-25T11:00:00.000Z",
      },
    ],
    aiDecisions: [
      ...state.aiDecisions,
      {
        id: "decision-failed",
        tenantId: state.tenant.id,
        conversationId: state.conversations[0].id,
        clientId: state.clients[0].id,
        mode: "autopilot",
        aiStatus: "active",
        personaId: "balanced_coach",
        risk: "green",
        model: "mock",
        promptVersion: "raw prompt",
        providerId: "mock-local-provider-v0",
        providerStatus: "failed",
        providerErrorCode: "provider_timeout",
        action: "no_ai",
        blockedReason: "provider_timeout",
        qualityIssues: [],
        reasons: [],
        createdAt: "2026-05-25T10:00:00.000Z",
      },
    ],
    handoffCases: [
      {
        id: "handoff-urgent",
        tenantId: state.tenant.id,
        dietitianId: state.dietitian.id,
        clientId: state.clients[0].id,
        conversationId: state.conversations[0].id,
        triggeringMessageId: "draft-stale",
        risk: "red",
        reasons: ["red"],
        status: "open",
        urgency: "urgent",
        safeAcknowledgement: "Review required",
        recommendedAction: "Review required",
        createdAt: "2026-05-25T10:00:00.000Z",
      },
      {
        id: "handoff-normal",
        tenantId: state.tenant.id,
        dietitianId: state.dietitian.id,
        clientId: state.clients[1].id,
        conversationId: state.conversations[1].id,
        triggeringMessageId: null,
        risk: "yellow",
        reasons: ["review"],
        status: "open",
        urgency: "normal",
        safeAcknowledgement: "Review required",
        recommendedAction: "Review required",
        createdAt: "2026-05-25T10:00:00.000Z",
      },
    ],
    notifications: [
      {
        id: "notification-unread",
        tenantId: state.tenant.id,
        type: "handoff_urgent",
        entityType: "handoff_case",
        entityId: "handoff-urgent",
        title: "Safe title",
        body: "Safe body",
        read: false,
        acknowledgedAt: null,
        createdAt: "2026-05-25T10:00:00.000Z",
      },
    ],
  };
}
