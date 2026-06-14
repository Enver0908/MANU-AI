import { detectClientFacingMetadataLeaks } from "./ai-quality-evaluation-harness-v1.js";
import { clinicalSnapshotsEqual, extractClinicalDecisionSnapshot } from "./style-dna-v2.js";

export const COPILOT_QUALITY_WORKFLOW_V1_VERSION = "copilot-quality-workflow-v1-v0.1.0";

export const CLIENT_EXPORT_FORBIDDEN_FIELDS = [
  "contextManifest",
  "blockedReason",
  "styleDna",
  "claimManifest",
  "responsePlan",
  "sourceRefs",
];

const EXPORT_LEAK_MARKERS = [
  /response-plan-v1/i,
  /claim-manifest-v1/i,
  /style-dna-v2/i,
  /intentFamily=/i,
  /replyMode=/i,
  /templateId=/i,
  /"contextManifest"\s*:\s*\{/i,
  /"styleDna"\s*:\s*\{/i,
  /"claimManifest"\s*:\s*\{/i,
  /"responsePlan"\s*:\s*\{/i,
];

export function buildCopilotQualityReviewContext(input = {}) {
  const decision = input.decision || null;
  const manifest = decision?.contextManifest || input.contextManifest || null;
  const responsePlan = manifest?.responsePlan || null;
  const claimManifest = manifest?.claimManifest || responsePlan?.claimManifest || null;

  return {
    version: COPILOT_QUALITY_WORKFLOW_V1_VERSION,
    internalOnly: true,
    decisionId: decision?.id || null,
    responsePlanSummary: summarizeResponsePlan(responsePlan),
    sourceRefs: summarizeSourceRefs(responsePlan?.sourceRefs || []),
    claimManifestSummary: summarizeClaimManifest(claimManifest),
    blockOrHandoffReason: decision?.blockedReason || input.blockedReason || null,
    suggestedEditFocus: buildSuggestedEditFocus({
      responsePlan,
      claimManifest,
      qualityIssues: decision?.qualityIssues || input.qualityIssues || [],
      draftBody: input.draftBody || null,
    }),
  };
}

export function sanitizeAiDecisionForClientExport(decision) {
  if (!decision || typeof decision !== "object") return decision;

  return {
    id: decision.id,
    tenantId: decision.tenantId,
    conversationId: decision.conversationId,
    clientId: decision.clientId,
    mode: decision.mode,
    aiStatus: decision.aiStatus,
    personaId: decision.personaId,
    risk: decision.risk,
    model: decision.model,
    promptVersion: decision.promptVersion,
    providerAttempted: decision.providerAttempted,
    providerId: decision.providerId,
    providerStatus: decision.providerStatus,
    providerErrorCode: decision.providerErrorCode,
    sendStatus: decision.sendStatus,
    action: decision.action,
    qualityIssues: Array.isArray(decision.qualityIssues) ? [...decision.qualityIssues] : [],
    reasons: Array.isArray(decision.reasons) ? [...decision.reasons] : [],
    createdAt: decision.createdAt,
    exportSanitizationVersion: COPILOT_QUALITY_WORKFLOW_V1_VERSION,
    contextManifest: null,
    blockedReason: null,
    providerOutputSafety: summarizeProviderOutputSafety(decision.providerOutputSafety),
    tokenBudget: null,
  };
}

export function sanitizeClientScopedExportForClientFacing(exportData) {
  if (!exportData || typeof exportData !== "object") {
    throw new Error("client_export_required");
  }

  return {
    ...exportData,
    aiDecisions: (exportData.aiDecisions || []).map(sanitizeAiDecisionForClientExport),
    exportSanitizationVersion: COPILOT_QUALITY_WORKFLOW_V1_VERSION,
  };
}

export function detectClientExportMetadataLeaks(exportPayload) {
  const leaks = [];
  const serialized = typeof exportPayload === "string" ? exportPayload : JSON.stringify(exportPayload);

  for (const pattern of EXPORT_LEAK_MARKERS) {
    if (pattern.test(serialized)) {
      leaks.push(pattern.source);
    }
  }

  for (const field of CLIENT_EXPORT_FORBIDDEN_FIELDS) {
    if (new RegExp(`"${field}"\\s*:\\s*(?!null\\b)`).test(serialized)) {
      leaks.push(`forbidden_field:${field}`);
    }
  }

  return Array.from(new Set(leaks));
}

export function assertClientExportMetadataSafe(exportPayload) {
  const leaks = detectClientExportMetadataLeaks(exportPayload);
  if (leaks.length > 0) {
    throw new Error(`client_export_metadata_leak:${leaks.join(",")}`);
  }
}

export function assertStyleEditDoesNotMutateClinicalDecision(beforePlan, afterPlan) {
  const before = extractClinicalDecisionSnapshot(beforePlan);
  const after = extractClinicalDecisionSnapshot(afterPlan);
  if (!clinicalSnapshotsEqual(before, after)) {
    throw new Error("style_edit_mutated_clinical_decision");
  }
}

function summarizeResponsePlan(responsePlan) {
  if (!responsePlan) return null;
  return {
    version: responsePlan.version || null,
    intentFamily: responsePlan.intentFamily || null,
    replyMode: responsePlan.replyMode || null,
    templateId: responsePlan.templateId || null,
    riskClass: responsePlan.riskClass || null,
    foodDecision: responsePlan.foodDecision?.decision || null,
    providerEligible: responsePlan.providerEligible === true,
  };
}

function summarizeSourceRefs(sourceRefs) {
  return (sourceRefs || []).map((ref) => ({
    id: ref.id || null,
    category: ref.category || null,
    segmentType: ref.segmentType || null,
  }));
}

function summarizeClaimManifest(claimManifest) {
  if (!claimManifest) return null;
  return {
    version: claimManifest.version || null,
    complete: claimManifest.complete === true,
    claimTypeCount: Array.isArray(claimManifest.claims) ? claimManifest.claims.length : 0,
    claimTypes: Array.isArray(claimManifest.claims)
      ? claimManifest.claims.map((claim) => claim.type).filter(Boolean)
      : [],
  };
}

function summarizeProviderOutputSafety(providerOutputSafety) {
  if (!providerOutputSafety || typeof providerOutputSafety !== "object") return null;
  return {
    allowed: providerOutputSafety.allowed === true,
    issueCount: Array.isArray(providerOutputSafety.issues) ? providerOutputSafety.issues.length : 0,
  };
}

function buildSuggestedEditFocus({ responsePlan, claimManifest, qualityIssues, draftBody }) {
  const focus = [];

  if (responsePlan?.replyMode === "draft") focus.push("draft_tone_and_clarity");
  if (responsePlan?.replyMode === "send") focus.push("final_send_wording");
  if (Array.isArray(qualityIssues) && qualityIssues.length > 0) focus.push("quality_guard_followup");
  if (claimManifest?.claims?.length) focus.push("claim_manifest_alignment");
  if (responsePlan?.intentFamily === "green_allowed_substitution") focus.push("substitution_clarity");
  if (responsePlan?.intentFamily === "green_product_ingredient_check") focus.push("label_request_clarity");
  if (typeof draftBody === "string" && detectClientFacingMetadataLeaks(draftBody).length > 0) {
    focus.push("remove_internal_metadata_from_draft");
  }

  return Array.from(new Set(focus));
}
