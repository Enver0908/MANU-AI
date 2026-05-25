import { describe, expect, it } from "vitest";
import { buildNotificationSlaSnapshot } from "./notification-sla";
import type { HandoffCaseRecord, NotificationRecord } from "./types";

describe("notification SLA snapshot", () => {
  it("counts only unacknowledged open handoff notification breaches", () => {
    const snapshot = buildNotificationSlaSnapshot(
      {
        handoffCases: [
          handoff("open-urgent", "open", "urgent"),
          handoff("open-standard", "open", "normal"),
          handoff("resolved-urgent", "resolved", "urgent"),
        ],
        notifications: [
          notification("urgent-breached", "handoff_urgent", "open-urgent", null, "2026-05-25T11:30:00.000Z"),
          notification("urgent-acknowledged", "handoff_urgent", "open-urgent", "2026-05-25T11:50:00.000Z", "2026-05-25T11:20:00.000Z"),
          notification("standard-breached", "handoff_standard", "open-standard", null, "2026-05-25T07:00:00.000Z"),
          notification("resolved-ignored", "handoff_urgent", "resolved-urgent", null, "2026-05-25T07:00:00.000Z"),
          notification("missing-handoff-ignored", "handoff_urgent", "missing", null, "2026-05-25T07:00:00.000Z"),
        ],
      },
      { now: "2026-05-25T12:00:00.000Z" },
    );

    expect(snapshot).toEqual({
      breachedNotificationCount: 2,
      urgentEscalationDueCount: 1,
    });
  });

  it("keeps fresh urgent handoff notifications below the escalation threshold", () => {
    const snapshot = buildNotificationSlaSnapshot(
      {
        handoffCases: [handoff("open-urgent", "open", "urgent")],
        notifications: [
          notification("urgent-fresh", "handoff_urgent", "open-urgent", null, "2026-05-25T11:50:00.000Z"),
        ],
      },
      { now: "2026-05-25T12:00:00.000Z" },
    );

    expect(snapshot).toEqual({
      breachedNotificationCount: 0,
      urgentEscalationDueCount: 0,
    });
  });

  it("does not emit raw notification or handoff content", () => {
    const snapshot = buildNotificationSlaSnapshot(
      {
        handoffCases: [handoff("open-urgent", "open", "urgent")],
        notifications: [
          {
            ...notification("urgent-private", "handoff_urgent", "open-urgent", null, "2026-05-25T11:30:00.000Z"),
            title: "Alerjiden nefes alamiyorum",
            body: "+905551110001 raw prompt supabase-service-role-secret",
          },
        ],
      },
      { now: "2026-05-25T12:00:00.000Z" },
    );
    const json = JSON.stringify(snapshot);

    expect(json).not.toContain("Alerjiden nefes alamiyorum");
    expect(json).not.toContain("+905551110001");
    expect(json).not.toContain("raw prompt");
    expect(json).not.toContain("supabase-service-role-secret");
  });
});

function handoff(id: string, status: HandoffCaseRecord["status"], urgency: string): HandoffCaseRecord {
  return {
    id,
    tenantId: "tenant-manu-demo",
    dietitianId: "dietitian-ayse",
    clientId: "client-mert",
    conversationId: "conversation-client-mert",
    triggeringMessageId: null,
    risk: urgency === "urgent" ? "red" : "yellow",
    reasons: [],
    status,
    urgency,
    safeAcknowledgement: "Review required",
    recommendedAction: "Review required",
    createdAt: "2026-05-25T07:00:00.000Z",
  };
}

function notification(
  id: string,
  type: NotificationRecord["type"],
  entityId: string,
  acknowledgedAt: string | null,
  createdAt: string,
): NotificationRecord {
  return {
    id,
    tenantId: "tenant-manu-demo",
    type,
    entityType: "handoff_case",
    entityId,
    title: "Safe title",
    body: "Safe body",
    read: false,
    acknowledgedAt,
    createdAt,
  };
}
