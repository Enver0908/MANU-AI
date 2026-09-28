import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveAuthCoverageOutcome,
  sanitizeCoverageRoute,
  summarizeAuthCoverage,
} from "./performance-plan-1-j1-shared-runtime-auth-coverage.mjs";

function resultWithRequests(requests, phase52Events = []) {
  return {
    status: "COMPLETE",
    validSample: true,
    observationValidity: "VALID",
    functionalOutcome: "SUCCESS",
    performanceOutcome: "NOT_EVALUABLE",
    trace: {
      measurement: {
        requestSummary: { requests },
        longTasks: { phase52Events },
        secondActionTailMs: 420,
      },
    },
  };
}

const timed = (route) => ({
  route,
  method: "GET",
  requestKind: "api_or_other",
  startedAtMs: 10,
  endAtMs: 30,
  responseHeaderAtMs: 25,
  bodyFinishedAtMs: 30,
  status: 200,
  failed: false,
  serverTiming: [{ name: "auth_total", durationMs: 120 }, { name: "route", durationMs: 130 }],
});

test("summarizes completed shared API timings and bounded RSC marker", () => {
  const result = resultWithRequests([
    timed("/api/conversations"),
    timed("/api/alerts"),
    timed("/api/notifications"),
    timed("/api/shell/preferences"),
    timed("/api/clients/%3Cuuid%3E"),
    timed("/api/clients/%3Cuuid%3E/forms"),
  ], [{
    name: "rsc_auth_server_marker_observed",
    scope: "layout",
    atWallMs: 100,
    atPerformanceMs: 50,
    authTotalMs: 260,
  }]);

  const summary = summarizeAuthCoverage(result);

  assert.equal(summary.apiRequestCount, 6);
  assert.equal(summary.timedApiRequestCount, 6);
  assert.deepEqual(summary.missingExpectedRoutes, []);
  assert.equal(summary.rscMarkerCount, 1);
  assert.equal(
    deriveAuthCoverageOutcome({ result, summary }),
    "SHARED_RUNTIME_AUTH_COVERAGE_CAPTURED_RSC_MARKER_OBSERVED",
  );
});

test("does not treat a missing or failed response as measured auth coverage", () => {
  const result = resultWithRequests([
    timed("/api/conversations"),
    { ...timed("/api/alerts"), status: null, failed: true, serverTiming: [] },
  ]);
  const summary = summarizeAuthCoverage(result);

  assert.equal(summary.timedApiRequestCount, 1);
  assert.ok(summary.missingExpectedRoutes.includes("/api/alerts"));
  assert.equal(summary.rscMarkerCount, 0);
  assert.equal(
    deriveAuthCoverageOutcome({ result, summary }),
    "SHARED_API_AUTH_COVERAGE_PARTIAL_RSC_MARKER_NOT_OBSERVED",
  );
});

test("sanitizes client identifiers before evidence serialization", () => {
  assert.equal(
    sanitizeCoverageRoute("/api/clients/00000000-0000-4000-8000-000000005000/forms"),
    "/api/clients/%3Cuuid%3E/forms",
  );
  assert.equal(
    sanitizeCoverageRoute("/dashboard?section=clients&clientId=00000000-0000-4000-8000-000000005000"),
    "/dashboard?section=clients&clientId=%3Cpresent%3E",
  );
});
