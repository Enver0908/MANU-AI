import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FANOUT_BASELINE_ENVELOPE,
  checkFanoutEnvelope,
  checkFormsLifecycle,
  fanoutBaselineDistDir,
  sanitizeFanoutBaselineEvidence,
} from "./performance-plan-1-j1-fanout-envelope-baseline.mjs";

function goodShape() {
  return {
    totalRequests: 53,
    apiRequests: 24,
    documentRequests: 3,
    rscRequests: 26,
    apiRouteCounts: Object.fromEntries(
      Object.entries(FANOUT_BASELINE_ENVELOPE.apiRouteCounts).map(([route, rule]) => [
        route,
        rule.exact ?? rule.min,
      ]),
    ),
  };
}

test("accepts the predeclared legacy fan-out envelope", () => {
  const result = checkFanoutEnvelope(goodShape());
  assert.equal(result.status, "PASS");
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.unexpectedRoutes, []);
});

test("rejects the prior duplicate-Forms and high-fan-out boundary", () => {
  const shape = goodShape();
  shape.totalRequests = 60;
  shape.apiRequests = 31;
  shape.apiRouteCounts["/api/shell/bootstrap"] = 9;
  shape.apiRouteCounts["/api/clients/:clientId"] = 2;
  shape.apiRouteCounts["/api/clients/:clientId/forms"] = 2;
  const result = checkFanoutEnvelope(shape);
  assert.equal(result.status, "FAIL");
  assert.ok(result.failures.includes("total_request_count_outside_envelope"));
  assert.ok(result.failures.includes("api_request_count_outside_envelope"));
  assert.ok(result.failures.includes("route_count_outside_envelope:/api/clients/:clientId/forms"));
});

test("rejects a Forms lifecycle restart or abort", () => {
  const result = checkFormsLifecycle({
    trace: {
      measurement: {
        longTasks: {
          phase55Events: [
            { name: "stage6_workspace_effect_setup", domain: "forms" },
            { name: "stage6_workspace_load_started", domain: "forms" },
            { name: "stage6_workspace_load_aborted", domain: "forms" },
            { name: "stage6_workspace_effect_setup", domain: "forms" },
          ],
        },
      },
    },
  });
  assert.equal(result.status, "FAIL");
  assert.ok(result.failures.includes("forms_load_abort_observed"));
  assert.ok(result.failures.includes("forms_effect_setup_not_exactly_one"));
});

test("redacts UUIDs without changing route shape", () => {
  const result = sanitizeFanoutBaselineEvidence({
    route: "/api/clients/00000000-0000-4000-8000-000000005000/forms",
    body: "should be redacted",
  });
  assert.equal(result.route, "/api/clients/<uuid>/forms");
  assert.equal(result.body, "<redacted>");
});

test("uses a run-scoped diagnostic dist directory", () => {
  const distDir = fanoutBaselineDistDir(
    "aiya-performance-plan1-j1-fanout-envelope-baseline-v1-20260922T000000Z-12345678-1234-4234-8234-123456789012",
  );
  assert.match(distDir, /^\.next-fanout-baseline-[A-Za-z0-9_-]+$/);
  assert.ok(!distDir.includes("/"));
  assert.equal(distDir, fanoutBaselineDistDir(distDir.replace(".next-fanout-baseline-", "")));
});
