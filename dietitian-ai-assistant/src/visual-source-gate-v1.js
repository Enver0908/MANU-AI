import { normalizeFoodPhrase } from "./food-understanding-v3.js";
import {
  assertProviderContextExcludesRawOcr,
  buildSourceGatedVisualSummary,
  mapVisualOcrIngredientSourceType,
} from "./visual-evidence-source-v2.js";

export const VISUAL_SOURCE_GATE_V1_VERSION = "visual-source-gate-v1-v0.1.0";

const ALLOWLISTED_CONFLICT_TOKEN_PATTERN = /^[a-z0-9][a-z0-9 _-]{0,48}$/i;
const ANALYSIS_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidAnalysisId(analysisId) {
  return typeof analysisId === "string" && ANALYSIS_ID_RE.test(analysisId.trim());
}

export function extractAllowlistedConflictTokens({ observation, foodRules = {} }) {
  const ingredientText = (observation?.ocrBlocks || [])
    .filter((block) => block.blockKind === "label")
    .map((block) => block.text)
    .join(" ")
    .trim();
  if (!ingredientText) {
    return [];
  }

  const normalizedText = normalizeFoodPhrase(ingredientText);
  const candidates = uniqueKeywords([
    ...(foodRules.ingredientAllergenKeywords || []),
    ...(foodRules.forbiddenFoodItems || []),
    ...(foodRules.forbiddenFoodGroups || []),
  ]);

  const tokens = [];
  for (const keyword of candidates) {
    const normalizedKeyword = normalizeFoodPhrase(keyword);
    if (!normalizedKeyword || !normalizedText.includes(normalizedKeyword)) continue;
    const token = `forbidden_conflict_${normalizedKeyword}`;
    if (ALLOWLISTED_CONFLICT_TOKEN_PATTERN.test(token)) {
      tokens.push(token);
    }
  }

  return Array.from(new Set(tokens));
}

export function buildSegmentSourceGatedSummary({ segmentResolution, observation, foodRules = {} }) {
  const analysisId = segmentResolution?.analysisId;
  if (!isValidAnalysisId(analysisId)) {
    return null;
  }

  if (segmentResolution.workflowState === "label_conflict_high_integrity") {
    let boundedTokens = extractAllowlistedConflictTokens({ observation, foodRules });
    if (boundedTokens.length === 0) {
      boundedTokens = ["forbidden_conflict:detected"];
    }
    return buildSourceGatedVisualSummary({
      evidenceRef: {
        sourceType: mapVisualOcrIngredientSourceType(),
        authority: "limited_visual_label_conflict",
        allowedUses: ["forbidden_conflict_only"],
        analysisId,
        approvedSourceId: null,
      },
      boundedTokens,
    });
  }

  if (segmentResolution.workflowState === "meal_exact_menu" && segmentResolution.menuMatch?.menuItemId) {
    return buildSourceGatedVisualSummary({
      evidenceRef: {
        sourceType: "visual_menu_match",
        authority: "approved_menu_exact",
        allowedUses: ["menu_exact_match"],
        analysisId,
        approvedSourceId: segmentResolution.menuMatch.menuItemId,
      },
      boundedTokens: [`menu_exact_${segmentResolution.menuMatch.matchedLabel}`],
    });
  }

  if (segmentResolution.workflowState === "screenshot_approved_source_hit" && segmentResolution.approvedSourceId) {
    return buildSourceGatedVisualSummary({
      evidenceRef: {
        sourceType: "visual_screenshot_query",
        authority: "approved_source_only",
        allowedUses: ["approved_source_claim"],
        analysisId,
        approvedSourceId: segmentResolution.approvedSourceId,
      },
      boundedTokens: [`approved_source_${segmentResolution.approvedSourceId}`],
    });
  }

  return null;
}

export function buildSourceGatedVisualProviderContext({ envelope, meaning, foodRules = {} }) {
  const segments = [];
  for (const segmentResolution of meaning?.visualSegments || []) {
    const envelopeSegment = (envelope?.visualSegments || []).find(
      (entry) => entry.analysisId === segmentResolution.analysisId,
    );
    const summary = buildSegmentSourceGatedSummary({
      segmentResolution,
      observation: envelopeSegment?.observation,
      foodRules,
    });

    segments.push({
      analysisId: segmentResolution.analysisId,
      mediaAssetId: segmentResolution.mediaAssetId,
      sceneType: segmentResolution.sceneType,
      workflowState: segmentResolution.workflowState,
      sourceAuthority: segmentResolution.sourceAuthority,
      approvedSourceId: segmentResolution.approvedSourceId ?? segmentResolution.menuMatch?.menuItemId ?? null,
      entityLabels: (envelopeSegment?.observation?.entityCandidates || [])
        .map((candidate) => candidate.normalizedLabel)
        .filter(Boolean),
      captionText: envelopeSegment?.captionText ?? null,
      sourceGatedSummary: summary,
      observedAt: envelopeSegment?.observedAt ?? null,
    });
  }

  const providerContext = {
    version: VISUAL_SOURCE_GATE_V1_VERSION,
    byteSize: 0,
    withinLimit: true,
    excludesRawMedia: true,
    excludesRawOcr: true,
    segments,
  };
  providerContext.byteSize = Buffer.byteLength(JSON.stringify(providerContext), "utf8");
  providerContext.withinLimit = providerContext.byteSize <= 12 * 1024;
  assertProviderContextExcludesRawOcr(providerContext);
  return providerContext;
}

export function buildApprovedDietitianVisualSources({ pinnedNotes = [], contextUpdates = [] }) {
  const sources = [];

  for (const [index, note] of pinnedNotes.entries()) {
    const text = String(note || "").trim();
    if (!text) continue;
    sources.push({
      category: "pinned_note",
      segmentType: "pinned_note",
      sourceId: `pinned-note-${index + 1}`,
      authority: "dietitian_authored",
      origin: "dietitian_manual",
      text,
    });
  }

  for (const update of contextUpdates) {
    const text = String(update?.summary || update?.body || "").trim();
    if (!text) continue;
    sources.push({
      category: "dietitian_context_update",
      segmentType: "dietitian_context_update",
      sourceId: update?.id ? String(update.id) : null,
      authority: "dietitian_authored",
      origin: "dietitian_manual",
      text,
    });
  }

  return sources;
}

export function evaluateMultiImageSourceIdentity(segmentResolutions = []) {
  if (segmentResolutions.length <= 1) {
    return { consistent: true, reasonCode: null };
  }

  const approvedSourceIds = segmentResolutions
    .map((segment) => segment.approvedSourceId ?? segment.menuMatch?.menuItemId ?? null)
    .filter(Boolean);
  const workflowStates = segmentResolutions.map((segment) => segment.workflowState);
  const uniqueWorkflows = new Set(workflowStates);

  if (uniqueWorkflows.size > 1) {
    return { consistent: false, reasonCode: "visual_multiple_images_ambiguous" };
  }

  if (approvedSourceIds.length !== segmentResolutions.length) {
    return { consistent: false, reasonCode: "visual_multiple_images_missing_approved_source" };
  }

  if (new Set(approvedSourceIds).size > 1) {
    return { consistent: false, reasonCode: "visual_multiple_images_source_identity_mismatch" };
  }

  return { consistent: true, reasonCode: null };
}

function uniqueKeywords(values) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}
