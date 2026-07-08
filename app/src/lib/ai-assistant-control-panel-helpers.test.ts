import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import {
  collectAiPreflightBlockers,
  countAiControlBlockers,
  formatActivationWindowLabel,
  isAiControlLockedByRedRisk,
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
  it("detects red risk lock as control blocker", () => {
    const client = buildClient({
      redRiskLock: {
        status: "locked",
        handoffId: "handoff-1",
        lockedAt: "2026-07-08T00:00:00.000Z",
        reasons: ["red"],
        previousAiStatus: "active",
        previousAiMode: "copilot",
      },
    });
    expect(isAiControlLockedByRedRisk(client)).toBe(true);
    expect(countAiControlBlockers(createInitialState(), client)).toBeGreaterThan(0);
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
