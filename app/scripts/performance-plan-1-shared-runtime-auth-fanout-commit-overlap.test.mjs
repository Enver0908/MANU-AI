import { describe, expect, it } from "vitest";
import {
  analyzeAuthFanoutCommitTrace,
  deriveRequestIntervals,
} from "./performance-plan-1-shared-runtime-auth-fanout-commit-overlap.mjs";

function traceFixture() {
  return {
    journeyId: "J1",
    startedAtWallMs: 1_000,
    functionalOutcome: "SUCCESS",
    observationValidity: "VALID",
    actions: {
      first: { trustedEventAtMs: 100 },
      second: { trustedEventAtMs: 300, readyStateAtMs: 500 },
    },
    measurement: {
      unitKey: "diagnostic:J1:r1",
      validSample: true,
      requestSummary: {
        captureStartedAtWallMs: 900,
        requests: [
          {
            route: "/api/app-state",
            method: "GET",
            requestKind: "api_or_other",
            startedAtMs: 380,
            bodyFinishedAtMs: 460,
            status: 200,
            serverTiming: [
              { name: "auth_total", durationMs: 80 },
              { name: "auth_get_user", durationMs: 20 },
            ],
          },
          {
            route: "/dashboard?clientId=present",
            method: "GET",
            requestKind: "rsc",
            startedAtMs: 250,
            bodyFinishedAtMs: 420,
            status: 200,
            serverTiming: [],
          },
        ],
      },
      longTasks: {
        longTaskCount: 0,
        phase52Events: [
          {
            name: "react_commit",
            atWallMs: 1_350,
            profilerId: "shell-provider",
            actualDurationMs: 4,
            commitTimeMs: 10,
          },
          {
            name: "react_commit",
            atWallMs: 1_350,
            profilerId: "authenticated-shell",
            actualDurationMs: 5,
            commitTimeMs: 10,
          },
          { name: "shell_context_state_committed", atWallMs: 1_400 },
        ],
      },
    },
  };
}

describe("shared runtime auth/fan-out/commit overlap analysis", () => {
  it("converts request capture time into the trace clock", () => {
    const intervals = deriveRequestIntervals(traceFixture());
    expect(intervals).toHaveLength(2);
    expect(intervals[0]).toMatchObject({ startAtMs: 280, endAtMs: 360 });
    expect(intervals[1]).toMatchObject({ startAtMs: 150, endAtMs: 320 });
  });

  it("uses the explicit first-request origin after request records are rebased", () => {
    const trace = traceFixture();
    trace.measurement.requestSummary = {
      captureStartedAtWallMs: 900_000,
      requestTimeOriginWallMs: 1_020,
      requestTimebase: "first_request_relative",
      requests: [{
        route: "/api/clients/c1/food-rule-profile",
        method: "GET",
        requestKind: "api_or_other",
        startedAtMs: 400,
        responseHeaderAtMs: 860,
        bodyFinishedAtMs: 870,
        status: 200,
      }],
    };
    const intervals = deriveRequestIntervals(trace);
    expect(intervals[0]).toMatchObject({
      startAtMs: 420,
      responseHeaderAtMs: 880,
      bodyFinishedAtMs: 890,
    });
  });

  it("separates request fan-out from available auth timing and nested profiler events", () => {
    const result = analyzeAuthFanoutCommitTrace(traceFixture());
    expect(result.windows.firstToSecondTrusted).toMatchObject({
      apiRequestCount: 1,
      rscRequestCount: 1,
      timedApiRequestCount: 1,
      authTimingCoverage: 1,
    });
    expect(result.windows.secondAction).toMatchObject({
      apiRequestCount: 1,
      rscRequestCount: 1,
      authTotalMs: 80,
    });
    expect(result.secondActionReact).toMatchObject({
      profilerCommitEventCount: 2,
      commitWaveCount: 1,
    });
    expect(result.secondActionReact.contextEventCounts).toEqual({
      shell_context_state_committed: 1,
    });
  });
});
