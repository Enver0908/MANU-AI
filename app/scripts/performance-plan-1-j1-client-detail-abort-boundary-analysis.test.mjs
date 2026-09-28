import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveAbortBoundaryOutcome,
  sanitizeAnalysisRoute,
} from "./performance-plan-1-j1-client-detail-abort-boundary-analysis.mjs";

test("sanitizes client identifiers in boundary routes", () => {
  assert.equal(
    sanitizeAnalysisRoute("/dashboard?section=clients&clientId=550e8400-e29b-41d4-a716-446655440000"),
    "/dashboard?section=clients&clientId=%3Cpresent%3E",
  );
});

test("classifies the Stage 6 cleanup correlation without claiming causality", () => {
  const outcome = deriveAbortBoundaryOutcome({
    targetRequests: [{ failed: true, responseHeaderAtMs: null, bodyFinishedAtMs: null }],
    routeHistory: [
      { route: "/dashboard?section=clients&clientId=%3Cpresent%3E" },
      { route: "/dashboard?section=clients&clientTask=forms&clientId=%3Cpresent%3E" },
      { route: "/dashboard?section=clients&clientTask=nutrition&clientId=%3Cpresent%3E" },
    ],
    phase55Events: [
      { name: "stage6_workspace_effect_cleanup", domain: "summary", routeClientTask: "forms" },
      { name: "stage6_workspace_effect_setup", domain: "forms", routeClientTask: "forms" },
      { name: "stage6_workspace_load_aborted", domain: "summary", routeClientTask: "forms" },
    ],
    code: {
      hookAbortsPreviousControllerOnLoad: true,
      hookAbortsControllerDuringEffectCleanup: true,
      hookLoadDependsOnDomain: true,
      summaryMapsToClientDetailRoute: true,
      workspaceMapsClientTaskToDomain: true,
      journeyChangesFormsThenNutrition: true,
    },
  });
  assert.equal(outcome, "CLIENT_DETAIL_ABORT_CORRELATED_WITH_STAGE6_DOMAIN_SWITCH_CLEANUP");
});
