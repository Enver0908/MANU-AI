import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMeasuredEffect,
  classifyMeasuredEffect,
  summarizeDiagnosticResult,
} from "./performance-plan-1-j1-post-response-commit-ownership-ab-a.mjs";

function row(variantId, repetition, shellProviderCommits, trustedToReadyMs, validSample = true) {
  return {
    variantId,
    policy: variantId === "B" ? "stable" : "legacy",
    repetition,
    validSample,
    observationValidity: validSample ? "VALID" : "INVALID",
    functionalOutcome: validSample ? "SUCCESS" : "FAILURE",
    trustedToReadyMs,
    requestCount: 53,
    apiRequestCount: 24,
    documentRequestCount: 3,
    shellProviderCommits,
  };
}

test("summarizes the post-response profiler ownership signal", () => {
  const result = summarizeDiagnosticResult({
    repetition: 1,
    validSample: true,
    observationValidity: "VALID",
    functionalOutcome: "SUCCESS",
    trace: {
      actions: { second: { trustedEventAtMs: 100, readyStateAtMs: 500, dispatchAtMs: 90 } },
      measurement: {
        requestSummary: { requests: [{ route: "/api/shell/bootstrap", requestKind: "api_or_other" }] },
        longTasks: {
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
});

test("requires fully valid rows before classifying a repeated commit effect", () => {
  const results = [];
  for (const repetition of [1, 2, 3]) {
    results.push(row("A1", repetition, 2000 + repetition, 500));
    results.push(row("B", repetition, 30 + repetition, 500, repetition !== 1));
    results.push(row("A2", repetition, 1900 + repetition, 500));
  }
  const effect = buildMeasuredEffect(results);
  assert.equal(effect.commitOwnership.repeatableReductionAcrossFullyValidRows, false);
  assert.equal(effect.commitOwnership.reductionRowCount, 2);
  assert.equal(classifyMeasuredEffect(effect), "POST_RESPONSE_COMMIT_OWNERSHIP_SIGNAL_OBSERVED_VALIDITY_OR_FANOUT_BOUNDARY_OPEN");
});
