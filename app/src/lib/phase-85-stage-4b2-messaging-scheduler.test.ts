import { describe, expect, it } from "vitest";
import {
  resolveStage4B2MessagingPollDelayMs,
  shouldPauseStage4B2MessagingPolling,
  STAGE_4B2_MESSAGING_DETAIL_POLL_INTERVAL_MS,
  STAGE_4B2_MESSAGING_LIST_POLL_INTERVAL_MS,
} from "./phase-85-stage-4b2-messaging-scheduler";

describe("phase-85-stage-4b2 messaging scheduler", () => {
  it("uses 30s list polling and 15s detail polling when healthy", () => {
    expect(resolveStage4B2MessagingPollDelayMs(0, false)).toBe(STAGE_4B2_MESSAGING_LIST_POLL_INTERVAL_MS);
    expect(resolveStage4B2MessagingPollDelayMs(0, true)).toBe(STAGE_4B2_MESSAGING_DETAIL_POLL_INTERVAL_MS);
  });

  it("applies capped backoff after errors", () => {
    expect(resolveStage4B2MessagingPollDelayMs(1, false)).toBe(60_000);
    expect(resolveStage4B2MessagingPollDelayMs(2, true)).toBe(120_000);
  });

  it("pauses polling while the document is hidden", () => {
    expect(shouldPauseStage4B2MessagingPolling(false)).toBe(true);
    expect(shouldPauseStage4B2MessagingPolling(true)).toBe(false);
  });
});
