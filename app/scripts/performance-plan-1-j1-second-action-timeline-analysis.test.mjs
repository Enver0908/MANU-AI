import test from "node:test";
import assert from "node:assert/strict";
import {
  classifySecondActionTimeline,
  deriveSecondActionTimeline,
  sanitizeTimelineRoute,
} from "./performance-plan-1-j1-second-action-timeline-analysis.mjs";

test("sanitizes client identifiers in timeline routes", () => {
  assert.equal(
    sanitizeTimelineRoute("/api/clients/550e8400-e29b-41d4-a716-446655440000/food-rule-profile"),
    "/api/clients/%3Cuuid%3E/food-rule-profile",
  );
});

test("keeps request, context, and main-thread boundaries separate", () => {
  const trace = {
    journeyId: "J1",
    startedAtWallMs: 1_000,
    actions: {
      first: {
        requiredRequestTimings: [{
          route: "/api/clients/client-1/forms",
          method: "GET",
          startedAtMs: 50,
          responseHeaderAtMs: 100,
          bodyFinishedAtMs: 120,
          status: 200,
          failed: false,
        }],
      },
      second: {
        dispatchAtMs: 0,
        trustedEventAtMs: 100,
        routeCommittedAtMs: 101,
        requiredRequestStartAtMs: 125,
        responseHeaderAtMs: 500,
        responseBodyFinishedAtMs: 510,
        readyStateAtMs: 900,
        parseRenderCompletedAtMs: 930,
        requiredRequestTimings: [{
          route: "/api/clients/550e8400-e29b-41d4-a716-446655440000/food-rule-profile",
          method: "GET",
          startedAtMs: 125,
          responseHeaderAtMs: 500,
          bodyFinishedAtMs: 510,
          status: 200,
          failed: false,
        }],
      },
    },
    measurement: {
      requestSummary: {
        captureStartedAtWallMs: 900,
        requests: [{
          route: "/api/clients/550e8400-e29b-41d4-a716-446655440000/food-rule-profile",
          method: "GET",
          requestKind: "api_or_other",
          startedAtMs: 225,
          bodyFinishedAtMs: 700,
          status: 200,
          failed: false,
          serverTiming: [
            { name: "auth_total", durationMs: 220 },
            { name: "store", durationMs: 80 },
            { name: "route", durationMs: 450 },
          ],
        }],
      },
      longTasks: {
        phase52Events: [
          { name: "shell_context_state_committed", atWallMs: 1_400 },
        ],
        phase55Events: [],
        eventTimings: [],
        longTasks: [],
      },
    },
  };
  const timeline = deriveSecondActionTimeline(trace);
  assert.equal(timeline.status, "COMPLETE");
  assert.equal(timeline.requests.overlapCount, 1);
  assert.equal(timeline.browserWork.contextCommitCount, 1);
  assert.equal(timeline.browserWork.longTasksInWindow, null);
  assert.equal(timeline.actionDurations.requiredBodyToReadyMs, 390);
  assert.equal(
    classifySecondActionTimeline(timeline),
    "NETWORK_SERVER_FIRST_WITH_POST_BODY_READY_TAIL_UNRESOLVED",
  );
});

test("aligns long tasks and event timing with paired wall and performance clocks", () => {
  const trace = {
    startedAtWallMs: 100_000,
    actions: { second: { trustedEventAtMs: 4_000, readyStateAtMs: 4_100 } },
    measurement: {
      requestSummary: { captureStartedAtWallMs: 100_000, requests: [] },
      longTasks: {
        phase52Events: [
          { name: "shell_context_state_committed", atWallMs: 104_050, atPerformanceMs: 7_050 },
          { name: "shell_context_state_committed", atWallMs: 104_075, atPerformanceMs: 7_076 },
        ],
        phase55Events: [],
        longTasks: [
          { startTimeMs: 7_000, durationMs: 60 },
          { startTimeMs: 7_200, durationMs: 55 },
        ],
        eventTimings: [{
          name: "click",
          startTimeMs: 7_005,
          processingStartMs: 7_012,
          processingEndMs: 7_024,
          durationMs: 64,
          interactionId: 2,
        }],
      },
    },
  };
  const timeline = deriveSecondActionTimeline(trace);
  assert.equal(timeline.browserWork.performanceClock.status, "ALIGNED");
  assert.equal(timeline.browserWork.performanceClock.spreadMs, 1);
  assert.deepEqual(timeline.browserWork.longTasksInWindow, [{ relativeStartMs: 0, durationMs: 60 }]);
  assert.equal(timeline.browserWork.eventTimings[0].relativeStartMs, 5);
  assert.equal(timeline.browserWork.eventTimings[0].processingDelayMs, 7);
});

test("does not claim a long-task absence when the browser clocks cannot be aligned", () => {
  const trace = {
    startedAtWallMs: 100_000,
    actions: { second: { trustedEventAtMs: 4_000, readyStateAtMs: 4_100 } },
    measurement: {
      requestSummary: { captureStartedAtWallMs: 100_000, requests: [] },
      longTasks: {
        phase52Events: [
          { name: "state_a", atWallMs: 104_000, atPerformanceMs: 7_000 },
          { name: "state_b", atWallMs: 104_020, atPerformanceMs: 7_200 },
        ],
        phase55Events: [],
        longTasks: [],
        eventTimings: [],
      },
    },
  };
  const timeline = deriveSecondActionTimeline(trace);
  assert.equal(timeline.browserWork.performanceClock.status, "UNCERTAIN");
  assert.equal(timeline.browserWork.longTasksInWindow, null);
  assert.equal(timeline.browserWork.eventTimings, null);
});

test("aligns rebased request records and reports both instrumentation boundaries", () => {
  const trace = {
    startedAtWallMs: 1_000,
    actions: {
      second: {
        trustedEventAtMs: 300,
        requiredRequestTimings: [{
          route: "/api/clients/client-1/food-rule-profile",
          method: "GET",
          startedAtMs: 420,
          responseHeaderAtMs: 880,
          bodyFinishedAtMs: 890,
          status: 200,
          failed: false,
        }],
        requiredRequestStartAtMs: 420,
        responseHeaderAtMs: 880,
        responseBodyFinishedAtMs: 890,
        readyStateAtMs: 900,
      },
    },
    measurement: {
      requestSummary: {
        captureStartedAtWallMs: 900_000,
        requestTimebase: "first_request_relative",
        requests: [
          {
            route: "/api/clients/client-1/forms",
            method: "GET",
            requestKind: "api_or_other",
            startedAtMs: 30,
            responseHeaderAtMs: 80,
            bodyFinishedAtMs: 100,
            status: 200,
            failed: false,
            serverTiming: [],
          },
          {
            route: "/api/clients/client-1/food-rule-profile",
            method: "GET",
            requestKind: "api_or_other",
            startedAtMs: 400,
            responseHeaderAtMs: 860,
            bodyFinishedAtMs: 870,
            status: 200,
            failed: false,
            serverTiming: [],
          },
        ],
      },
      longTasks: {
        phase52Events: [],
        phase55Events: [],
        longTasks: [],
        eventTimings: [],
      },
    },
  };
  const timeline = deriveSecondActionTimeline(trace);
  assert.equal(timeline.requests.overlapCount, 1);
  assert.deepEqual(timeline.requests.clockAlignment, {
    requestTimebase: "first_request_relative",
    requestOrigin: "required_read_inferred",
    inferredSpreadMs: 0,
  });
  assert.deepEqual(timeline.requests.requiredBoundaryToRequestSummaryDeltaMs, {
    requestStart: 0,
    responseHeader: 0,
    responseBody: 0,
    note: "Non-zero deltas are retained as instrumentation-boundary differences; the two timing sources are not silently merged.",
  });
});
