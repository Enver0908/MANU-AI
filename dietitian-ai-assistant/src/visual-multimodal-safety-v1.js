import { decideModeAction } from "./orchestrator.js";
import { evaluateGreenIntentTaxonomy } from "./green-intent-taxonomy.js";
import { buildResponsePlanV1 } from "./response-plan-v1.js";
import { renderDeterministicTemplate } from "./deterministic-template-library-v1.js";
import { evaluateNarrowAutopilotEligibilityV2 } from "./narrow-autopilot-eligibility-v2.js";
import { detectVisualMetadataLeaks } from "./response-quality-guard.js";
import { evaluateVisualAnswerability } from "./visual-answerability-v1.js";
import { resolveVisualCanonicalIntent } from "./visual-intent-bridge-v1.js";
import { evaluateVisualRiskOverlay } from "./visual-risk-overlay-v1.js";

export const VISUAL_MULTIMODAL_SAFETY_V1_VERSION = "visual-multimodal-safety-v1-v0.1.0";

export function evaluateMultimodalVisualSafetyChainV1(input = {}) {
  const baseRiskDecision = input.baseRiskDecision || { level: "green", reasons: [] };
  const meaning = input.meaning;
  const envelope = input.envelope;

  const visualRiskOverlay = evaluateVisualRiskOverlay({
    baseRiskDecision,
    meaning,
    envelope,
  });

  const mergedRiskDecision = {
    ...baseRiskDecision,
    level: visualRiskOverlay.mergedRiskLevel,
    reasons: Array.from(
      new Set([...(baseRiskDecision.reasons || []), ...visualRiskOverlay.reasonCodes, "visual_risk_overlay_applied"]),
    ),
  };

  const promptContext =
    input.promptContext ||
    buildVisualOnlyPromptContext({
      textMessage: input.textMessage,
      riskLevel: mergedRiskDecision.level,
    });

  const visualCanonicalIntent = resolveVisualCanonicalIntent({
    meaning,
    envelope,
    mergedRiskDecision,
    textMessage: input.textMessage,
  });

  const answerability =
    evaluateVisualAnswerability({
      canonicalIntent: visualCanonicalIntent,
      meaning,
      visualRiskOverlay,
    }) || input.answerability || {
      allowed: false,
      decision: "handoff_required",
      reasons: ["visual_answerability_missing"],
      sourceCategories: [],
      sources: [],
    };

  const greenIntent = evaluateGreenIntentTaxonomy({
    promptContext,
    riskDecision: mergedRiskDecision,
    answerability,
    canonicalIntent: visualCanonicalIntent,
    foodDecisionV2: input.foodDecisionV2 || null,
    foodRule: input.foodRule || null,
  });

  const modeDecision = decideModeAction(input.clientAiMode || "autopilot", mergedRiskDecision);

  const responsePlan = buildResponsePlanV1({
    riskDecision: mergedRiskDecision,
    canonicalIntent: visualCanonicalIntent,
    greenIntent,
    answerability,
    foodDecisionV2: input.foodDecisionV2 || null,
    foodRule: input.foodRule || null,
    modeDecision,
    tenantId: input.tenantId || null,
    dietitianId: input.dietitianId || null,
    voiceProfile: input.voiceProfile || null,
    styleEditHistorySignals: input.styleEditHistorySignals || null,
    knownClientNames: input.knownClientNames || [],
  });

  const narrowAutopilotEligibility = evaluateNarrowAutopilotEligibilityV2({
    clientAiMode: input.clientAiMode || "autopilot",
    riskDecision: mergedRiskDecision,
    modeDecision,
    canonicalIntent: visualCanonicalIntent,
    greenIntent,
    answerability,
    foodDecisionV2: input.foodDecisionV2 || null,
    foodRule: input.foodRule || null,
    responsePlan,
    visualRiskOverlay,
    phase: "pre_provider",
  });

  const providerAttempted = false;
  const outboundDraftText = resolveOutboundDraftText(responsePlan);
  const outputGuardIssues = detectVisualMetadataLeaks(outboundDraftText);
  const outputGuard = {
    allowed: outputGuardIssues.length === 0,
    issues: outputGuardIssues,
    textSample: outboundDraftText.slice(0, 240),
  };
  const outputGuardSample = input.outputSampleText
    ? {
        allowed: detectVisualMetadataLeaks(input.outputSampleText).length === 0,
        issues: detectVisualMetadataLeaks(input.outputSampleText),
      }
    : outputGuard;

  const clientSendEligible =
    mergedRiskDecision.level === "green" &&
    modeDecision.action === "auto_send" &&
    responsePlan.replyMode === "send" &&
    narrowAutopilotEligibility.eligible === true &&
    outputGuard.allowed;

  return {
    version: VISUAL_MULTIMODAL_SAFETY_V1_VERSION,
    visualRiskOverlay,
    mergedRiskDecision,
    visualCanonicalIntent,
    answerability,
    greenIntent,
    modeDecision,
    responsePlan,
    narrowAutopilotEligibility,
    providerAttempted,
    clientSendEligible,
    outputGuard,
    outputGuardSample,
  };
}

export function isVisualClientSendEligible(chainResult) {
  return Boolean(chainResult?.clientSendEligible);
}

function buildVisualOnlyPromptContext({ textMessage, riskLevel }) {
  const body = String(textMessage || "[client image]").trim() || "[client image]";
  return {
    version: "visual-only-prompt-context-v1",
    risk: riskLevel,
    segments: [{ type: "current_message", text: body }],
    rendered: body,
  };
}

function resolveOutboundDraftText(responsePlan) {
  const templateId = responsePlan?.templateId;
  if (!templateId) {
    return responsePlan?.clientMessagePlan?.summary || "";
  }

  try {
    return renderDeterministicTemplate({
      templateId,
      language: "tr",
      replyMode: responsePlan.replyMode,
      riskClass: responsePlan.riskClass,
    });
  } catch {
    return responsePlan?.clientMessagePlan?.summary || "";
  }
}
