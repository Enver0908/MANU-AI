import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEnvelopeMeasuredEffect,
  classifyEnvelopeMeasuredEffect,
  compareEnvelopeMetric,
  postResponseEnvelopeDistDir,
  summarizeEnvelopeDiagnosticResult,
} from "./performance-plan-1-j1-post-response-commit-envelope-ab-a.mjs";
import { FANOUT_BASELINE_ENVELOPE } from "./performance-plan-1-j1-fanout-envelope-baseline.mjs";

function validFanout() {
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
    status: "PASS",
  };
}

function row(variantId, repetition, commits, trustedToReadyMs, eligible = true) {
  return {
    variantId,
    policy: variantId === "B" ? "stable" : "legacy",
    repetition,
    eligible,
    observationValidity: eligible ? "VALID" : "INVALID",
    functionalOutcome: eligible ? "SUCCESS" : "FAILURE",
    fanout: validFanout(),
    shellProviderCommits: commits,
    trustedToReadyMs,
  };
}

test("requires B eligibility and an exact fan-out shape for every repetition", () => {
  const rows = [];
  for (const repetition of [1, 2, 3]) {
    rows.push(row("A1", repetition, 20, 500));
    rows.push(row("B", repetition, 5, 490));
    rows.push(row("A2", repetition, 19, 510));
  }
  const effect = buildEnvelopeMeasuredEffect(rows);
  assert.equal(effect.candidateGate.strictThreeVariantGate, true);
  assert.equal(effect.commitOwnership.repeatableReductionAcrossStrictRows, true);
  assert.equal(
    classifyEnvelopeMeasuredEffect(effect),
    "POST_RESPONSE_COMMIT_OWNERSHIP_EFFECT_AND_SPEED_IMPROVEMENT_OBSERVED_GLOBAL_FREEZE_UNRESOLVED",
  );
});

test("does not promote a commit signal when B has an invalid Forms or fan-out row", () => {
  const rows = [];
  for (const repetition of [1, 2, 3]) {
    rows.push(row("A1", repetition, 20, 500));
    rows.push(row("B", repetition, 5, 490, repetition !== 2));
    rows.push(row("A2", repetition, 19, 510));
  }
  const effect = buildEnvelopeMeasuredEffect(rows);
  assert.equal(effect.candidateGate.strictThreeVariantGate, false);
  assert.equal(
    classifyEnvelopeMeasuredEffect(effect),
    "POST_RESPONSE_COMMIT_ENVELOPE_VALIDITY_OPEN_GLOBAL_FREEZE_UNRESOLVED",
  );
});

test("rejects a fan-out drift even when all rows are otherwise eligible", () => {
  const rows = [];
  for (const repetition of [1, 2, 3]) {
    rows.push(row("A1", repetition, 20, 500));
    const middle = row("B", repetition, 5, 490);
    if (repetition === 2) middle.fanout.apiRequests = 25;
    rows.push(middle);
    rows.push(row("A2", repetition, 19, 510));
  }
  const effect = buildEnvelopeMeasuredEffect(rows);
  assert.equal(effect.candidateGate.BEligible, true);
  assert.equal(effect.requestFanout.matchedRowCount, 2);
  assert.equal(effect.candidateGate.strictThreeVariantGate, false);
});

test("summarizes the established envelope and lifecycle gates from a trace", () => {
  const result = summarizeEnvelopeDiagnosticResult({
    repetition: 1,
    validSample: true,
    observationValidity: "VALID",
    functionalOutcome: "SUCCESS",
    trace: {
      actions: { second: { trustedEventAtMs: 100, readyStateAtMs: 500, dispatchAtMs: 90 } },
      measurement: {
        requestSummary: {
          requests: [
            { route: "/api/auth/password-login", requestKind: "api_or_other" },
          ],
        },
        requiredReads: [
          { actionId: "first", valid: true, records: [{ method: "GET", status: 200, bodyFinishedAtMs: 1, failed: false }] },
          { actionId: "second", valid: true, records: [{ method: "GET", status: 200, bodyFinishedAtMs: 1, failed: false }] },
        ],
        longTasks: {
          phase55Events: [
            { name: "stage6_workspace_effect_setup", domain: "forms" },
            { name: "stage6_workspace_load_started", domain: "forms" },
            { name: "stage6_workspace_load_succeeded", domain: "forms" },
          ],
          phase52Events: [
            { name: "react_commit", profilerId: "shell-provider", actualDurationMs: 2 },
            { name: "shell_dirty_registration_policy", policy: "stable" },
          ],
        },
      },
    },
  }, { id: "B", policy: "stable" });
  assert.equal(result.trustedToReadyMs, 400);
  assert.equal(result.dispatchToReadyMs, 410);
  assert.equal(result.shellProviderCommits, 1);
  assert.equal(result.policyMarker, "stable");
  assert.equal(result.eligible, false);
  assert.equal(result.formsLifecycle.status, "PASS");
});

test("uses isolated variant dist directories", () => {
  const runId = "aiya-performance-plan1-j1-post-response-commit-envelope-ab-a-v1-20260922T000000Z-12345678";
  const a1 = postResponseEnvelopeDistDir(runId, "A1");
  const b = postResponseEnvelopeDistDir(runId, "B");
  assert.match(a1, /^\.next-post-response-envelope-[A-Za-z0-9_-]+-a1$/);
  assert.match(b, /^\.next-post-response-envelope-[A-Za-z0-9_-]+-b$/);
  assert.notEqual(a1, b);
});

test("compares only eligible rows", () => {
  const rows = {
    A1: [row("A1", 1, 10, 500, true)],
    B: [row("B", 1, 5, 490, false)],
    A2: [row("A2", 1, 11, 510, true)],
  };
  const comparison = compareEnvelopeMetric(rows, "shellProviderCommits");
  assert.equal(comparison[0].allEligible, false);
  assert.equal(comparison[0].bLowerThanBoth, false);
});
