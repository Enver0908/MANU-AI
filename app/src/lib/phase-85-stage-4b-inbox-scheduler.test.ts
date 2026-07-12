import { describe, expect, it } from "vitest";
import {
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
});
