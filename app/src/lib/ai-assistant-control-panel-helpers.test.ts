import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import {
  collectAiPreflightBlockers,
  formatActivationWindowLabel,
  resolveAiControlDisabledState,
  summarizeAutopilotReadinessGate,
} from "./ai-assistant-control-panel-helpers";
import type { ClientRecord } from "./types";

function buildClient(partial: Partial<ClientRecord> = {}): ClientRecord {
  const base = createInitialState().clients[0];
  return {
    ...base,
    ...partial,
    healthProfile: { ...base.healthProfile, ...(partial.healthProfile || {}) },
    redRiskLock: partial.redRiskLock || base.redRiskLock,
    yellowRiskHold: partial.yellowRiskHold || base.yellowRiskHold,
  };
}

describe("ai assistant control panel helpers", () => {
  it("detects red risk lock as configuration lock without hard activation blocker", () => {
    const client = buildClient({
      aiStatus: "passive",
      aiMode: "copilot",
      humanTakeoverLocked: false,
      redRiskLock: {
        status: "locked",
        handoffId: "handoff-1",
        lockedAt: "2026-07-08T00:00:00.000Z",
        reasons: ["red"],
        previousAiStatus: "active",
        previousAiMode: "copilot",
      },
    });
    const gates = resolveAiControlDisabledState(client);
    expect(gates.activationDisabled).toBe(false);
    expect(gates.configurationDisabled).toBe(true);
    const blockers = collectAiPreflightBlockers(createInitialState(), client);
    const redBlocker = blockers.find((blocker) => blocker.code === "red_risk_lock_active");
    expect(redBlocker?.severity).toBe("warn");
    expect(blockers.some((blocker) => blocker.severity === "block" && blocker.code === "red_risk_lock_active")).toBe(
      false,
    );
  });

  it("formats activation window labels", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const client = buildClient({
      aiStatus: "active",
      aiActiveFrom: future,
      aiActiveUntil: null,
    });
    expect(formatActivationWindowLabel(client)).toContain("baslamadi");
  });

  it("summarizes autopilot readiness as incomplete when form response is missing", () => {
    const state = createInitialState();
    const base = state.clients[0];
    const client = buildClient({
      id: "missing-client-id",
      aiStatus: "active",
      aiMode: "autopilot",
      channelPermission: "ready",
      channelUserId: base.channelUserId,
    });
    const readiness = summarizeAutopilotReadinessGate(state, client);
    expect(readiness.ready).toBe(false);
    expect(readiness.missingLabels.length).toBeGreaterThan(0);
  });

  it("collects human takeover and channel permission blockers", () => {
    const client = buildClient({
      humanTakeoverLocked: true,
      channelPermission: "ready",
      channelUserId: "+905551234567",
    });
    const blockers = collectAiPreflightBlockers(createInitialState(), client);
    expect(blockers.some((blocker) => blocker.code === "human_takeover_lock")).toBe(true);
  });
});
