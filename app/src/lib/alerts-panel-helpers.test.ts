import { describe, expect, it } from "vitest";
import type { ClinicalAlertListItem } from "./phase-85-stage-4b-contracts";
import {
  buildAlertSeveritySegmentLabel,
  canNavigateToAlertTarget,
  formatAlertElapsedMinutes,
  formatAlertStartedAt,
  resolveAlertAdditionalReasonSuffix,
  resolveAlertClientDisplayName,
  resolveAlertEmptyStateKeys,
  resolveAlertSlaPresentation,
  resolveAlertTypeLabelKey,
} from "./alerts-panel-helpers";

function buildAlert(overrides: Partial<ClinicalAlertListItem> = {}): ClinicalAlertListItem {
  return {
    id: "red:handoff-1",
    clientId: "client-1",
    conversationId: "conversation-1",
    clientFullName: "Mert Kaya",
    severity: "red",
    kind: "emergency_symptom",
    reasonLabelKey: "alertReasonEmergencySymptom",
    additionalReasonCount: 0,
    sourceMessageId: "message-1",
    activeDraftMessageId: null,
    handoffId: "handoff-1",
    startedAt: "2026-07-12T10:00:00.000Z",
    elapsedMinutes: 45,
    slaDeadline: null,
    slaState: "unconfigured",
    target: {
      section: "messages",
      clientId: "client-1",
      conversationId: "conversation-1",
      source: "alert",
      sourceId: "red:handoff-1",
      messageId: "message-1",
    },
    ...overrides,
  };
}

describe("alerts-panel-helpers", () => {
  it("falls back to generic client label when name is missing", () => {
    expect(resolveAlertClientDisplayName("  ", "Danışan")).toBe("Danışan");
    expect(resolveAlertClientDisplayName("Elif Demir", "Danışan")).toBe("Elif Demir");
  });

  it("formats elapsed minutes without inventing SLA deadlines", () => {
    expect(formatAlertElapsedMinutes(25)).toBe("25 dk");
    expect(formatAlertElapsedMinutes(90)).toBe("1 sa 30 dk");
    const sla = resolveAlertSlaPresentation(buildAlert({ slaState: "unconfigured", slaDeadline: null }));
    expect(sla?.deadlineLabel).toBeNull();
    expect(sla?.elapsedLabel).toBe("45 dk");
  });

  it("builds severity segment labels with active totals", () => {
    const label = buildAlertSeveritySegmentLabel(
      "red",
      { all: 4, red: 2, yellow: 2 },
      { all: "Tümü", red: "Kırmızı", yellow: "Sarı" },
    );
    expect(label).toBe("Kırmızı (2)");
  });

  it("selects empty-state keys by active filter and search", () => {
    expect(resolveAlertEmptyStateKeys("all", "").titleKey).toBe("noAlertsYet");
    expect(resolveAlertEmptyStateKeys("red", "alerji").titleKey).toBe("alertsEmptySearchTitle");
    expect(resolveAlertEmptyStateKeys("yellow", "").titleKey).toBe("alertsEmptyYellowTitle");
  });

  it("maps alert kind to type label keys and blocks invalid navigation", () => {
    expect(resolveAlertTypeLabelKey("lab_result")).toBe("alertTypeLabResult");
    expect(canNavigateToAlertTarget(buildAlert())).toBe(true);
    expect(canNavigateToAlertTarget(buildAlert({ clientId: "" }))).toBe(false);
    expect(canNavigateToAlertTarget(buildAlert({ conversationId: null }))).toBe(false);
    expect(canNavigateToAlertTarget(buildAlert(), new Set(["other"]))).toBe(false);
  });

  it("formats additional reason suffix and started timestamps", () => {
    expect(resolveAlertAdditionalReasonSuffix(2)).toBe(" +2");
    expect(resolveAlertAdditionalReasonSuffix(0)).toBe("");
    expect(formatAlertStartedAt("invalid")).toBeNull();
    expect(formatAlertStartedAt("2026-07-12T10:00:00.000Z")).toMatch(/2026/);
  });
});
