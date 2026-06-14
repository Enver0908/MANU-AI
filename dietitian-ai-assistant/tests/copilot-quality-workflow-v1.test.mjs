import assert from "node:assert/strict";
import test from "node:test";
import {
  COPILOT_QUALITY_WORKFLOW_V1_VERSION,
  assertClientExportMetadataSafe,
  assertStyleEditDoesNotMutateClinicalDecision,
  buildCopilotQualityReviewContext,
  detectClientExportMetadataLeaks,
  sanitizeAiDecisionForClientExport,
  sanitizeClientScopedExportForClientFacing,
} from "../src/copilot-quality-workflow-v1.js";

const sampleDecision = {
  id: "decision-1",
  tenantId: "tenant-1",
  conversationId: "conversation-1",
  clientId: "client-1",
  mode: "copilot",
  aiStatus: "active",
  personaId: "balanced",
  risk: "green",
  model: "mock-provider",
  promptVersion: "v1",
  providerAttempted: true,
  providerId: "mock",
  providerStatus: "ok",
  providerErrorCode: null,
  sendStatus: "draft",
  action: "draft",
  qualityIssues: [],
  reasons: [],
  createdAt: "2026-06-13T12:00:00.000Z",
  blockedReason: "clinical_safety_handoff",
  contextManifest: {
    responsePlan: {
      version: "response-plan-v1",
      intentFamily: "green_allowed_substitution",
      replyMode: "draft",
      templateId: "green_substitution_v1",
      riskClass: "green",
      sourceRefs: [{ id: "src-1", category: "approved_source", segmentType: "food_rule" }],
      claimManifest: {
        version: "claim-manifest-v1",
        complete: true,
        claims: [{ type: "food_allowed" }],
      },
    },
    styleDna: {
      version: "style-dna-v2",
      candidatePhrases: ["Merhaba"],
    },
  },
  providerOutputSafety: { allowed: true, issues: [] },
  tokenBudget: { promptTokens: 100 },
};

test("copilot quality workflow exposes version", () => {
  assert.equal(COPILOT_QUALITY_WORKFLOW_V1_VERSION, "copilot-quality-workflow-v1-v0.1.0");
});

test("buildCopilotQualityReviewContext is internal-only and summarized", () => {
  const review = buildCopilotQualityReviewContext({ decision: sampleDecision, draftBody: "Merhaba" });
  assert.equal(review.internalOnly, true);
  assert.equal(review.responsePlanSummary?.intentFamily, "green_allowed_substitution");
  assert.equal(review.sourceRefs.length, 1);
  assert.equal(review.claimManifestSummary?.claimTypeCount, 1);
  assert.equal(review.blockOrHandoffReason, "clinical_safety_handoff");
  assert.ok(review.suggestedEditFocus.includes("draft_tone_and_clarity"));
});

test("sanitizeAiDecisionForClientExport strips internal metadata", () => {
  const sanitized = sanitizeAiDecisionForClientExport(sampleDecision);
  assert.equal(sanitized.contextManifest, null);
  assert.equal(sanitized.blockedReason, null);
  assert.equal(sanitized.tokenBudget, null);
  assert.equal(sanitized.exportSanitizationVersion, COPILOT_QUALITY_WORKFLOW_V1_VERSION);
  assert.equal(sanitized.id, "decision-1");
});

test("sanitizeClientScopedExportForClientFacing passes leak detection", () => {
  const exportData = {
    tenantId: "tenant-1",
    clientId: "client-1",
    generatedAt: "2026-06-13T12:00:00.000Z",
    client: { id: "client-1" },
    conversations: [],
    messages: [],
    aiDecisions: [sampleDecision],
    handoffCases: [],
    clientFormResponses: [],
    clientFoodRuleProfiles: [],
    clientMenuPlans: [],
    clientContextUpdates: [],
    clientUpdateProposals: [],
    riskAssessments: [],
    notifications: [],
    dataRequests: [],
    auditEvents: [],
  };

  const leaksBefore = detectClientExportMetadataLeaks(exportData);
  assert.ok(leaksBefore.length > 0);

  const sanitized = sanitizeClientScopedExportForClientFacing(exportData);
  assert.equal(detectClientExportMetadataLeaks(sanitized).length, 0);
  assert.doesNotThrow(() => assertClientExportMetadataSafe(sanitized));
});

test("style edit assertion rejects clinical mutation", () => {
  const before = sampleDecision.contextManifest.responsePlan;
  const mutated = {
    ...before,
    foodDecision: { decision: "forbidden" },
  };
  assert.throws(
    () => assertStyleEditDoesNotMutateClinicalDecision(before, mutated),
    /style_edit_mutated_clinical_decision/,
  );
  assert.doesNotThrow(() => assertStyleEditDoesNotMutateClinicalDecision(before, before));
});
