import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import {
  analyzeDirtyRegistrationSamples,
  DIRTY_VERIFY_PATHS,
  DIRTY_VERIFY_PRIOR_EVIDENCE_PATH,
  DIRTY_VERIFY_PRIOR_EVIDENCE_SHA256,
  parseDirtyVerifyArguments,
} from "./performance-plan-1-j1-dirty-registration-verification.mjs";

test("resolves the application root from the runner script directory", () => {
  assert.equal(dirname(DIRTY_VERIFY_PATHS.appRoot), DIRTY_VERIFY_PATHS.repoRoot);
  assert.equal(relative(DIRTY_VERIFY_PATHS.appRoot, DIRTY_VERIFY_PATHS.nextCliPath), join("node_modules", "next", "dist", "bin", "next"));
  assert.ok(existsSync(DIRTY_VERIFY_PATHS.nextCliPath));
});

test("selects the smoke-only mode without enabling J1 capture", () => {
  assert.deepEqual(parseDirtyVerifyArguments(["--smoke-only"]), {
    run: false,
    status: false,
    smokeOnly: true,
    baseUrl: null,
  });
});

test("keeps smoke-only execution separate from J1, status, and caller-selected origins", () => {
  assert.throws(() => parseDirtyVerifyArguments(["--smoke-only", "--run"]), /cannot_combine/);
  assert.throws(() => parseDirtyVerifyArguments(["--smoke-only", "--status"]), /cannot_combine/);
  assert.throws(() => parseDirtyVerifyArguments(["--smoke-only", "--base-url", "http://127.0.0.1:3170"]), /cannot_combine/);
});

test("pins the smoke-only continuation to the preserved three-record J1 evidence", () => {
  const evidence = readFileSync(join(DIRTY_VERIFY_PATHS.repoRoot, DIRTY_VERIFY_PRIOR_EVIDENCE_PATH));
  const actualHash = createHash("sha256").update(evidence).digest("hex");
  assert.equal(actualHash, DIRTY_VERIFY_PRIOR_EVIDENCE_SHA256);
});

function successfulSample(repetition) {
  return {
    unitKey: `stable:diagnostic:J1:r${repetition}`,
    repetition,
    validSample: true,
    observationValidity: "VALID",
    functionalOutcome: "SUCCESS",
    performanceOutcome: "NOT_EVALUABLE",
    trace: {
      startedAtWallMs: 0,
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
          dispatchAtMs: 290,
          trustedEventAtMs: 300,
          routeCommittedAtMs: 301,
          requiredRequestStartAtMs: 320,
          responseHeaderAtMs: 450,
          responseBodyFinishedAtMs: 470,
          readyStateAtMs: 500,
          parseRenderCompletedAtMs: 510,
          secondActionAccepted: true,
          clickAttemptCount: 1,
          functionalOutcome: "SUCCESS",
          targetReadyStatus: "READY",
          requiredRequestTimings: [{
            route: "/api/clients/client-1/food-rule-profile",
            method: "GET",
            startedAtMs: 320,
            responseHeaderAtMs: 450,
            bodyFinishedAtMs: 470,
            status: 200,
            failed: false,
          }],
        },
      },
      measurement: {
        requiredReads: [
          { actionId: "first", pattern: "/api/clients/:clientId/forms", valid: true, records: [{ method: "GET", status: 200, bodyFinishedAtMs: 120, failed: false }] },
          { actionId: "second", pattern: "/api/clients/:clientId/food-rule-profile", valid: true, records: [{ method: "GET", status: 200, bodyFinishedAtMs: 470, failed: false }] },
        ],
        requestSummary: {
          captureStartedAtWallMs: 100,
          requestTimeOriginWallMs: 50,
          requestTimebase: "first_request_relative",
          requests: [
            { route: "/api/clients/client-1/forms", method: "GET", requestKind: "api_or_other", startedAtMs: 0, responseHeaderAtMs: 50, bodyFinishedAtMs: 70, status: 200, failed: false, serverTiming: [] },
            { route: "/api/clients/client-1/food-rule-profile", method: "GET", requestKind: "api_or_other", startedAtMs: 270, responseHeaderAtMs: 400, bodyFinishedAtMs: 420, status: 200, failed: false, serverTiming: [] },
          ],
        },
        longTasks: {
          phase52Events: [
            { name: "shell_dirty_registration_policy", policy: "stable", atWallMs: 400, atPerformanceMs: 400 },
            { name: "shell_context_state_committed", atWallMs: 410, atPerformanceMs: 410 },
          ],
          phase55Events: [
            { name: "stage6_workspace_effect_setup", domain: "forms" },
            { name: "stage6_workspace_load_started", domain: "forms" },
            { name: "stage6_workspace_load_succeeded", domain: "forms" },
          ],
          longTasks: [],
          eventTimings: [],
        },
      },
    },
  };
}

test("accepts three valid stable-policy records without applying the legacy fan-out envelope", () => {
  const analysis = analyzeDirtyRegistrationSamples([1, 2, 3].map(successfulSample));
  assert.equal(analysis.outcome, "J1_STABLE_THREE_VALID_FUNCTIONAL_RECORDS");
  assert.equal(analysis.counts.eligible, 3);
  assert.equal(analysis.samples[0].fanout.status, "FAIL");
  assert.equal(analysis.samples[0].stablePolicyObserved, true);
  assert.equal(analysis.samples[0].secondAction.clickAttempts, 1);
  assert.equal(analysis.samples[0].performanceOutcome, "NOT_EVALUABLE");
});

test("keeps a repeated or aborted Forms read from counting as a valid sample", () => {
  const sample = successfulSample(1);
  sample.trace.measurement.longTasks.phase55Events.push(
    { name: "stage6_workspace_load_aborted", domain: "forms" },
  );
  const analysis = analyzeDirtyRegistrationSamples([sample]);
  assert.equal(analysis.counts.eligible, 0);
  assert.equal(analysis.samples[0].formsLifecycle.status, "FAIL");
});

test("returns incomplete instead of treating missing recordings as a pass", () => {
  const analysis = analyzeDirtyRegistrationSamples([successfulSample(1), successfulSample(2)]);
  assert.equal(analysis.outcome, "J1_STABLE_CAPTURE_INCOMPLETE");
  assert.equal(analysis.counts.eligible, 2);
});
