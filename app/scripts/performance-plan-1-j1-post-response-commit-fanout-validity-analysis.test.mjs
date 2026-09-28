import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyFanoutValidityBoundary,
  deriveMatchedComparisons,
  sanitizeAnalysisRoute,
  summarizeTrace,
} from "./performance-plan-1-j1-post-response-commit-fanout-validity-analysis.mjs";

function tracePayload({
  unitKey,
  formsRecords,
  apiRequestCount,
  formsRouteCount = formsRecords.length,
  validSample = true,
  functionalOutcome = "SUCCESS",
} = {}) {
  const requestRoutes = [
    ...Array.from({ length: apiRequestCount - formsRouteCount }, (_, index) => ({
      route: `/api/example-${index}`,
      requestKind: "api_or_other",
    })),
    ...Array.from({ length: formsRouteCount }, () => ({
      route: "/api/clients/00000000-0000-4000-8000-000000005000/forms",
      requestKind: "api_or_other",
    })),
  ];
  return {
    unitKey,
    validSample,
    observationValidity: "VALID",
    functionalOutcome,
    trace: {
      measurement: {
        requestSummary: {
          requests: requestRoutes.map((request, index) => ({
            ...request,
            method: "GET",
            status: request.route.endsWith("/forms") && index === apiRequestCount - formsRouteCount
              ? 200
              : 200,
            failed: request.route.endsWith("/forms") && index === apiRequestCount - formsRouteCount
              ? formsRecords[index - (apiRequestCount - formsRouteCount)]?.failed === true
              : false,
            responseHeaderAtMs: 100 + index,
            bodyFinishedAtMs: request.route.endsWith("/forms") && index === apiRequestCount - formsRouteCount
              ? formsRecords[index - (apiRequestCount - formsRouteCount)]?.bodyFinishedAtMs ?? null
              : 200 + index,
            failureReason: "net::ERR_ABORTED",
          })),
        },
        requiredReads: [
          {
            actionId: "first",
            pattern: "/api/clients/:clientId/forms",
            count: formsRecords.length,
            valid: formsRecords.every((record) => record.bodyFinishedAtMs != null && record.failed !== true),
            records: formsRecords,
          },
          {
            actionId: "second",
            pattern: "/api/clients/:clientId/food-rule-profile",
            count: 1,
            valid: true,
            records: [{ method: "GET", status: 200, responseHeaderAtMs: 300, bodyFinishedAtMs: 310, failed: false }],
          },
        ],
        longTasks: {
          phase52Events: [{ name: "shell_dirty_registration_policy", policy: unitKey.startsWith("B") ? "stable" : "legacy" }],
          phase55Events: [
            { name: "stage6_workspace_effect_setup", domain: "forms", atPerformanceMs: 10 },
            { name: "stage6_workspace_load_started", domain: "forms", atPerformanceMs: 11 },
          ],
        },
      },
    },
  };
}

test("sanitizes client identifiers from path routes", () => {
  assert.equal(
    sanitizeAnalysisRoute("/api/clients/00000000-0000-4000-8000-000000005000/forms"),
    "/api/clients/:clientId/forms",
  );
});

test("retains the aborted first Forms record even when a later duplicate succeeds", () => {
  const row = summarizeTrace(tracePayload({
    unitKey: "B:diagnostic:J1:r3",
    formsRecords: [
      { method: "GET", status: 200, responseHeaderAtMs: 100, bodyFinishedAtMs: null, failed: true },
      { method: "GET", status: 200, responseHeaderAtMs: 200, bodyFinishedAtMs: 210, failed: false },
    ],
    requestCount: 60,
    apiRequestCount: 31,
    formsRouteCount: 2,
    validSample: false,
    functionalOutcome: "FAILURE",
  }));
  assert.equal(row.requiredReads.forms.valid, false);
  assert.equal(row.requiredReads.forms.recordCount, 2);
  assert.equal(row.requiredReads.forms.incompleteBodyCount, 1);
  assert.equal(row.requiredReads.forms.duplicateCount, 1);
  assert.equal(row.formsTransport.failed, 1);
  assert.equal(row.stage6Lifecycle.forms.restarted, false);
});

test("marks fan-out as open when B differs in a fully present matched row", () => {
  const rows = [];
  for (const variantId of ["A1", "B", "A2"]) {
    rows.push(summarizeTrace(tracePayload({
      unitKey: `${variantId}:diagnostic:J1:r1`,
      formsRecords: [{ method: "GET", status: 200, responseHeaderAtMs: 100, bodyFinishedAtMs: 110, failed: false }],
      requestCount: variantId === "B" ? 56 : 53,
      apiRequestCount: variantId === "B" ? 27 : 24,
    })));
  }
  const comparisons = deriveMatchedComparisons(rows);
  assert.equal(comparisons[0].allEligible, true);
  assert.equal(comparisons[0].fanout.bMinusA1, 3);
  assert.equal(comparisons[0].fanout.apiBMinusA2, 3);
  assert.equal(
    classifyFanoutValidityBoundary({
      rows,
      comparisons,
      assertions: { requiredReadUsesEveryMatchingRecord: true },
    }),
    "B_REQUIRED_READ_AND_FANOUT_BOUNDARY_NOT_REPRODUCED",
  );
});
