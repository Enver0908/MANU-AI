import { PHASE_74_REDACTION_MARKER } from "./data-governance";
import { PHASE_76D_STRUCTURED_FOOD_RULE_FIELD_IDS } from "./phase-76d-food-rule-fields";
import { buildStructuredFoodRuleManifest } from "./phase-76d-food-rule-model";
import type { ClientFormResponseRecord, ClientRecord, ClientUpdateProposalRecord } from "./types";

export const PHASE_76N_LIFECYCLE_VERSION = "phase-76n-food-rule-lifecycle-v1";

export const PHASE_76N_EXPORT_FOOD_RULE_CATEGORIES = [
  "structured_food_rule_fields",
  "equivalent_exchange_groups",
  "ingredient_allergen_keywords",
  "product_label_review_policy",
  "client_update_proposals_food_rule",
] as const;

export const PHASE_76N_TRANSACTIONAL_REDACTION_FIELDS = [
  "structured_food_rule_fields",
  "product_label_evidence",
  "food_rule_proposal_patches",
  "food_rule_proposal_source_text",
] as const;

export function extractStructuredFoodRulesForExport(answers: Record<string, unknown>) {
  return buildStructuredFoodRuleManifest(answers);
}

export function redactStructuredFoodRuleAnswers(answers: Record<string, unknown>) {
  const redacted: Record<string, unknown> = { ...answers };

  for (const fieldId of PHASE_76D_STRUCTURED_FOOD_RULE_FIELD_IDS) {
    if (fieldId in redacted) {
      redacted[fieldId] = PHASE_74_REDACTION_MARKER;
    }
  }

  return redacted;
}

export function answersContainUnredactedFoodRuleData(answers: Record<string, unknown>) {
  for (const fieldId of PHASE_76D_STRUCTURED_FOOD_RULE_FIELD_IDS) {
    const value = answers[fieldId];
    if (value === undefined || value === null) continue;
    if (value === PHASE_74_REDACTION_MARKER) continue;
    if (typeof value === "string" && value.trim().length === 0) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    return true;
  }

  return false;
}

export function clientContainsUnredactedFoodRuleProfile(client: ClientRecord) {
  return client.allergies.length > 0 || client.restrictedFoods.length > 0;
}

export function proposalContainsUnredactedFoodRuleData(proposal: ClientUpdateProposalRecord) {
  if (proposal.sourceText !== PHASE_74_REDACTION_MARKER) return true;
  if (proposal.proposedPatches.length > 0) return true;
  return false;
}

export function buildFoodRuleExportSection(responses: ClientFormResponseRecord[]) {
  const latest =
    [...responses].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null;

  if (!latest) {
    return {
      version: PHASE_76N_LIFECYCLE_VERSION,
      populatedFieldIds: [],
      manifest: null,
    };
  }

  return {
    version: PHASE_76N_LIFECYCLE_VERSION,
    schemaId: latest.schemaId,
    schemaVersion: latest.schemaVersion,
    updatedAt: latest.updatedAt,
    populatedFieldIds: PHASE_76D_STRUCTURED_FOOD_RULE_FIELD_IDS.filter((fieldId) => fieldId in latest.answers),
    manifest: extractStructuredFoodRulesForExport(latest.answers),
  };
}

export function buildProposalExportSection(proposals: ClientUpdateProposalRecord[]) {
  return proposals.map((proposal) => ({
    id: proposal.id,
    status: proposal.status,
    safetyFlags: proposal.safetyFlags,
    expectedContextRevision: proposal.expectedContextRevision,
    createdAt: proposal.createdAt,
    resolvedAt: proposal.resolvedAt,
    patchCategories: [...new Set(proposal.proposedPatches.map((patch) => patch.category))],
    foodRulePatchFieldIds: proposal.proposedPatches
      .filter((patch) => patch.category === "food_rule")
      .map((patch) => patch.fieldId),
    patchCount: proposal.proposedPatches.length,
    sourceTextIncluded: proposal.sourceText.length > 0,
    proposedPatches: proposal.proposedPatches.map((patch) => ({
      target: patch.target,
      fieldId: patch.fieldId,
      category: patch.category,
      operation: patch.operation,
      value: patch.value,
    })),
  }));
}
