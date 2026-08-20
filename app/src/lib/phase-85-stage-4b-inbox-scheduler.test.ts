import { describe, expect, it } from "vitest";
import {
  createStage4BInboxRequestGate,
  mergeStage4BInboxPageItems,
  resolveStage4BInboxPollDelayMs,
  shouldPauseStage4BInboxPolling,
  STAGE_4B_INBOX_POLL_INTERVAL_MS,
  fetchWithInflightDedupe,
} from "./phase-85-stage-4b-inbox-scheduler";

describe("phase-85-stage-4b inbox scheduler", () => {
  it("uses 30s polling when healthy", () => {
    expect(resolveStage4BInboxPollDelayMs(0)).toBe(STAGE_4B_INBOX_POLL_INTERVAL_MS);
  });

  it("applies capped backoff after errors", () => {
    expect(resolveStage4BInboxPollDelayMs(1)).toBe(60_000);
    expect(resolveStage4BInboxPollDelayMs(2)).toBe(120_000);
    expect(resolveStage4BInboxPollDelayMs(5)).toBe(120_000);
  });

  it("pauses polling while the document is hidden", () => {
    expect(shouldPauseStage4BInboxPolling(false)).toBe(true);
    expect(shouldPauseStage4BInboxPolling(true)).toBe(false);
  });

  it("dedupes in-flight requests for the same resource key", async () => {
    const inflight = new Map<string, Promise<string>>();
    let runs = 0;
    const run = () =>
      fetchWithInflightDedupe(inflight, "alerts", async () => {
        runs += 1;
        return "ok";
      });

    const [first, second] = await Promise.all([run(), run()]);
    expect(first).toBe("ok");
    expect(second).toBe("ok");
    expect(runs).toBe(1);
    expect(inflight.size).toBe(0);
  });

  it("rejects responses owned by an old filter or superseded request", () => {
    const gate = createStage4BInboxRequestGate("status=active");
    const first = gate.begin("status=active");
    const second = gate.begin("status=active");
    expect(gate.canApply(first)).toBe(false);
    expect(gate.canApply(second)).toBe(true);

    gate.setOwner("status=history");
    expect(gate.canApply(second)).toBe(false);
    const history = gate.begin("status=history");
    expect(gate.canApply(history)).toBe(true);
  });

  it("invalidates a pre-mutation response so it cannot restore stale receipt state", () => {
    const gate = createStage4BInboxRequestGate("status=unread");
    const beforeMutation = gate.begin("status=unread");
    gate.invalidateForMutation();
    expect(gate.canApply(beforeMutation)).toBe(false);
    expect(gate.canApply(gate.begin("status=unread"))).toBe(true);
  });

  it("merges paginated items by stable id without duplicates", () => {
    expect(
      mergeStage4BInboxPageItems(
        [
          { id: "alert-1", revision: 1 },
          { id: "alert-2", revision: 1 },
        ],
        [
          { id: "alert-2", revision: 2 },
          { id: "alert-3", revision: 1 },
        ],
      ),
    ).toEqual([
      { id: "alert-1", revision: 1 },
      { id: "alert-2", revision: 2 },
      { id: "alert-3", revision: 1 },
    ]);
  });
});
