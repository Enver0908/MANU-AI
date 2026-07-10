import { getPersona } from "./personas.js";
import { classifyClinicalSafetyRisk } from "./clinical-safety-second-layer.js";
import { buildMemoryContext } from "./conversation-memory.js";
import { buildClientContextCapsule } from "./context-capsule.js";
import { compilePromptContext, renderPromptContext, CONTEXT_POLICY_V2 } from "./context-compiler.js";
import { createHandoffCase } from "./handoff-engine.js";
import { guardProviderOutput } from "./response-quality-guard.js";
import { evaluateGreenIntentTaxonomy } from "./green-intent-taxonomy.js";
import { resolveCanonicalIntentV2 } from "./canonical-intent-resolver-v2.js";
import { evaluateFoodRuleDecision } from "./food-rule-engine.js";
import { evaluateIntentSpecificAnswerability } from "./intent-specific-answerability.js";
import { isClaimManifestComplete } from "./claim-manifest-v1.js";
import { buildResponsePlanV1, isResponsePlanProviderEligible } from "./response-plan-v1.js";
import { appendResponsePlanPromptSegments } from "./response-plan-prompt-segments.js";
import {
  DETERMINISTIC_TEMPLATE_LIBRARY_V1_VERSION,
  renderDeterministicTemplate,
} from "./deterministic-template-library-v1.js";
import { defaultVoiceProfile } from "./voice-profile.js";
import { selectModelForRisk } from "./model-routing.js";
import { resolveAiActivation } from "./ai-activation.js";
import { evaluateInboundPreflight } from "./inbound-preflight.js";
import {
  applyNarrowAutopilotModeDowngrade,
  evaluateNarrowAutopilotEligibilityV2,
} from "./narrow-autopilot-eligibility-v2.js";

export async function handleInboundMessage(input, adapters) {
  const persona = getPersona(input.client.selectedPersonaId);
  const voiceProfile = input.voiceProfile || defaultVoiceProfile();
  const providerId = input.providerId || null;
  const memory = buildMemoryContext({
    rollingSummary: input.memory?.rollingSummary,
    durableFacts: input.memory?.durableFacts,
    memoryVersion: input.memory?.memoryVersion,
    memoryRevision: input.memory?.memoryRevision,
    memoryStale: input.memory?.memoryStale,
    recentMessages: input.recentMessages || [],
  });

  const capsule = buildClientContextCapsule({
    tenantId: input.tenantId,
    dietitian: input.dietitian,
    client: input.client,
    conversation: input.conversation,
    persona,
    voiceProfile,
    memory,
  });

  const foodRule = input.foodRuleDecisionOverride
    ? input.foodRuleDecisionOverride
    : input.structuredFoodRules
      ? evaluateFoodRuleDecision({
          message: input.message.body,
          structuredFoodRules: input.structuredFoodRules,
          mixedIntentBlocked: false,
          productIngredientEvidence: input.productIngredientEvidence || null,
        })
      : null;

  const foodDecisionV2 = input.foodDecisionV2 || null;

  // App/simulator paths pass riskDecisionOverride as the single classification source.
  // The fallback below exists for standalone core tests and direct handleInboundMessage callers only.
  const foodRuleDecisionForRisk = input.foodRuleDecisionForRisk || foodRule;

  const riskDecision =
    input.riskDecisionOverride ||
    classifyClinicalSafetyRisk({
      message: input.message.body,
      recentMessages: input.recentMessages || [],
      clientProfile: {
        highRisk: capsule.client.clinicalRiskNotes.length > 0,
        healthProfile: capsule.client.healthProfile,
        allergies: capsule.client.allergies,
        restrictedFoods: capsule.client.restrictedFoods,
      },
      foodRuleDecision: foodRuleDecisionForRisk,
    });

  const preflightBlock = evaluateInboundPreflight(input.client);
  if (preflightBlock) {
    return buildResult({
      capsule,
      riskDecision,
      action: "no_ai",
      blockedReason: preflightBlock.blockedReason,
      model: null,
      activation: null,
      overrideReasons: [...riskDecision.reasons, ...preflightBlock.reasons],
    });
  }

  const activation = resolveAiActivation(capsule.client, input.now ? new Date(input.now) : new Date());

  if (!activation.active) {
    return buildResult({
      capsule,
      riskDecision,
      action: "no_ai",
      blockedReason: activation.reason,
      model: null,
      activation,
    });
  }

  const modeDecision = decideModeAction(capsule.client.aiMode, riskDecision);

  if (modeDecision.action === "handoff") {
    const handoffCase = createHandoffCase({
      capsule,
      inboundMessage: input.message.body,
      riskDecision,
    });
    await adapters?.onHandoff?.(handoffCase);
    return buildResult({
      capsule,
      riskDecision,
      action: "handoff",
      handoffCase,
      blockedReason: modeDecision.reason,
      model: null,
      activation,
    });
  }

  if (modeDecision.action === "ignore") {
    return buildResult({
      capsule,
      riskDecision,
      action: "no_ai",
      blockedReason: modeDecision.reason,
      model: null,
      activation,
    });
  }

  const compiledContext = compilePromptContext({
    capsule,
    currentMessage: input.message,
    recentMessages: input.recentMessages || [],
    conversationMessages: input.conversationMessages || input.recentMessages || [],
    riskLevel: riskDecision.level,
    promptVersion: input.promptVersion || null,
    policy: CONTEXT_POLICY_V2,
    dietitianTimezone: input.dietitian?.timezone || "UTC",
    retrievalNow: input.now || new Date().toISOString(),
    structuredFoodRules: input.structuredFoodRules || null,
    foodRuleDecision: foodRuleDecisionForRisk,
    foodDecisionV2,
    productIngredientEvidence: input.productIngredientEvidence || null,
  });

  if (compiledContext.blockedReason) {
    return buildResult({
      capsule,
      riskDecision,
      action: "no_ai",
      blockedReason: compiledContext.blockedReason,
      model: null,
      activation,
      contextManifest: compiledContext.contextManifest,
    });
  }

  const contextManifest = {
    ...compiledContext.contextManifest,
  };

  if (foodRule) {
    contextManifest.foodRule = foodRule;
  }
  if (foodDecisionV2) {
    contextManifest.foodDecisionV2 = foodDecisionV2;
  }

  const canonicalIntent = resolveCanonicalIntentV2({
    message: input.message.body,
    riskDecision,
    foodDecisionV2,
    foodRule: foodRuleDecisionForRisk,
  });
  contextManifest.canonicalIntent = canonicalIntent;

  const greenIntent = evaluateGreenIntentTaxonomy({
    promptContext: compiledContext.promptContext,
    riskDecision,
    answerability: null,
    canonicalIntent,
    foodDecisionV2,
    foodRule: foodRuleDecisionForRisk,
  });
  contextManifest.greenIntent = greenIntent;

  if (!greenIntent.allowed) {
    const blockedReason =
      greenIntent.decision === "blocked_unknown_intent"
        ? "canonical_unknown_intent"
        : "green_intent_taxonomy_blocked";
    const handoffCase = createHandoffCase({
      capsule,
      inboundMessage: input.message.body,
      riskDecision: {
        ...riskDecision,
        reasons: [...riskDecision.reasons, ...greenIntent.reasons],
        shouldHandoff: true,
      },
    });
    await adapters?.onHandoff?.(handoffCase);
    return buildResult({
      capsule,
      riskDecision,
      action: "handoff",
      handoffCase,
      blockedReason,
      model: null,
      activation,
      contextManifest,
      overrideReasons: [...riskDecision.reasons, ...greenIntent.reasons],
    });
  }

  if (
    foodDecisionV2?.decision === "needs_review" &&
    riskDecision.level === "green"
  ) {
    const handoffCase = createHandoffCase({
      capsule,
      inboundMessage: input.message.body,
      riskDecision: {
        ...riskDecision,
        reasons: [...riskDecision.reasons, ...foodDecisionV2.reasonCodes],
        shouldHandoff: true,
      },
    });
    await adapters?.onHandoff?.(handoffCase);
    return buildResult({
      capsule,
      riskDecision,
      action: "handoff",
      handoffCase,
      blockedReason: "food_decision_v2_needs_review",
      model: null,
      activation,
      contextManifest,
      overrideReasons: [...riskDecision.reasons, ...foodDecisionV2.reasonCodes],
    });
  }

  const answerability = evaluateIntentSpecificAnswerability({
    promptContext: compiledContext.promptContext,
    riskDecision,
    greenIntent,
    foodRule,
    foodDecisionV2,
    structuredFoodRules: input.structuredFoodRules || null,
    productIngredientEvidence: input.productIngredientEvidence || null,
    canonicalIntent,
    ambiguousCompetingSources: compiledContext.contextManifest.ambiguousCompetingSources || [],
  });
  contextManifest.answerability = answerability;

  const responsePlan = buildResponsePlanV1({
    riskDecision,
    canonicalIntent,
    greenIntent,
    answerability,
    foodDecisionV2,
    foodRule,
    modeDecision,
    tenantId: input.tenantId,
    dietitianId: input.dietitian?.id,
    voiceProfile,
    styleEditHistorySignals: input.styleEditHistorySignals || null,
    knownClientNames: capsule.client.knownOtherClientNames || [],
  });
  let effectiveModeDecision = modeDecision;
  let effectiveResponsePlan = responsePlan;
  const narrowAutopilotEligibility = evaluateNarrowAutopilotEligibilityV2({
    clientAiMode: capsule.client.aiMode,
    riskDecision,
    modeDecision,
    canonicalIntent,
    greenIntent,
    answerability,
    foodDecisionV2,
    foodRule,
    responsePlan,
  });
  contextManifest.narrowAutopilotEligibility = narrowAutopilotEligibility;

  if (narrowAutopilotEligibility.applies && !narrowAutopilotEligibility.eligible) {
    effectiveModeDecision = applyNarrowAutopilotModeDowngrade(modeDecision, narrowAutopilotEligibility);
    effectiveResponsePlan = buildResponsePlanV1({
      riskDecision,
      canonicalIntent,
      greenIntent,
      answerability,
      foodDecisionV2,
      foodRule,
      modeDecision: effectiveModeDecision,
      tenantId: input.tenantId,
      dietitianId: input.dietitian?.id,
      voiceProfile,
      styleEditHistorySignals: input.styleEditHistorySignals || null,
      knownClientNames: capsule.client.knownOtherClientNames || [],
    });
  }

  contextManifest.responsePlan = effectiveResponsePlan;
  contextManifest.claimManifest = effectiveResponsePlan.claimManifest;
  contextManifest.styleDna = effectiveResponsePlan.styleDna;

  if (!answerability.allowed) {
    if (responsePlan.templateId && !isResponsePlanProviderEligible(responsePlan)) {
      contextManifest.deterministicClientMessage = buildDeterministicClientMessage({
        responsePlan,
        language: capsule.client.communicationLanguage,
      });
    }
    const handoffCase = createHandoffCase({
      capsule,
      inboundMessage: input.message.body,
      riskDecision: {
        ...riskDecision,
        reasons: [...riskDecision.reasons, ...answerability.reasons],
        shouldHandoff: true,
      },
    });
    await adapters?.onHandoff?.(handoffCase);
    return buildResult({
      capsule,
      riskDecision,
      action: "handoff",
      handoffCase,
      blockedReason: "approved_source_answerability_missing",
      model: null,
      activation,
      contextManifest,
      overrideReasons: [...riskDecision.reasons, ...answerability.reasons],
    });
  }

  if (!isResponsePlanProviderEligible(effectiveResponsePlan)) {
    if (effectiveResponsePlan.templateId) {
      contextManifest.deterministicClientMessage = buildDeterministicClientMessage({
        responsePlan: effectiveResponsePlan,
        language: capsule.client.communicationLanguage,
      });
    }
    const handoffCase = createHandoffCase({
      capsule,
      inboundMessage: input.message.body,
      riskDecision: {
        ...riskDecision,
        reasons: [...riskDecision.reasons, "response_plan_not_provider_eligible", effectiveResponsePlan.replyMode],
        shouldHandoff: true,
      },
    });
    await adapters?.onHandoff?.(handoffCase);
    return buildResult({
      capsule,
      riskDecision,
      action: "handoff",
      handoffCase,
      blockedReason: "response_plan_not_provider_eligible",
      model: null,
      activation,
      contextManifest,
      overrideReasons: [...riskDecision.reasons, "response_plan_not_provider_eligible", effectiveResponsePlan.replyMode],
    });
  }

  if (!isClaimManifestComplete(effectiveResponsePlan.claimManifest, { providerEligible: true })) {
    const handoffCase = createHandoffCase({
      capsule,
      inboundMessage: input.message.body,
      riskDecision: {
        ...riskDecision,
        reasons: [...riskDecision.reasons, "claim_manifest_incomplete"],
        shouldHandoff: true,
      },
    });
    await adapters?.onHandoff?.(handoffCase);
    return buildResult({
      capsule,
      riskDecision,
      action: "handoff",
      handoffCase,
      blockedReason: "claim_manifest_incomplete",
      model: null,
      activation,
      contextManifest,
      overrideReasons: [...riskDecision.reasons, "claim_manifest_incomplete"],
    });
  }

  const selectedModel = selectModelForRisk(riskDecision.level);
  const providerPromptContext = appendResponsePlanPromptSegments(compiledContext.promptContext, effectiveResponsePlan);
  const prompt = renderPromptContext(providerPromptContext);
  let draft;
  try {
    draft = await adapters.generateReply({
      prompt,
      promptContext: providerPromptContext,
      contextManifest,
      riskDecision,
      model: selectedModel,
      responsePlan: effectiveResponsePlan,
    });
  } catch (error) {
    const providerErrorCode = resolveProviderErrorCode(error);
    const handoffCase = createHandoffCase({
      capsule,
      inboundMessage: input.message.body,
      riskDecision: {
        ...riskDecision,
        level: riskDecision.level === "red" ? "red" : "yellow",
        reasons: [...riskDecision.reasons, providerErrorCode],
        shouldHandoff: true,
        pauseAutopilot: riskDecision.pauseAutopilot === true,
      },
    });
    await adapters?.onHandoff?.(handoffCase);
    return buildResult({
      capsule,
      riskDecision,
      action: "handoff",
      handoffCase,
      blockedReason: providerErrorCode,
      model: selectedModel,
      providerAttempted: true,
      providerId,
      activation,
      contextManifest,
      providerStatus: "failed",
      providerErrorCode,
      providerOutputSafety: buildProviderFailureOutputSafety(providerErrorCode),
      overrideReasons: [...riskDecision.reasons, providerErrorCode],
    });
  }
  const quality = guardProviderOutput({
    output: draft,
    capsule,
    riskDecision,
    foodRule,
    foodDecisionV2,
    structuredFoodRules: input.structuredFoodRules || null,
    claimManifest: effectiveResponsePlan.claimManifest,
    styleDna: effectiveResponsePlan.styleDna,
  });

  if (!quality.allowed) {
    const qualityIssueCodes = quality.issues.map((issue) => issue.code || issue);
    const blockedReason = qualityIssueCodes.includes("missing_historical_context")
      ? "missing_historical_context"
      : "quality_guard_failed";
    const handoffCase = createHandoffCase({
      capsule,
      inboundMessage: input.message.body,
      riskDecision: {
        ...riskDecision,
        level: "yellow",
        reasons: [...riskDecision.reasons, ...qualityIssueCodes],
        shouldHandoff: true,
        pauseAutopilot: false,
      },
    });
    await adapters?.onHandoff?.(handoffCase);
    return buildResult({
      capsule,
      riskDecision,
      action: "handoff",
      draft,
      handoffCase,
      qualityIssues: qualityIssueCodes,
      blockedReason,
      model: selectedModel,
      providerAttempted: true,
      providerId,
      activation,
      contextManifest,
      providerOutputSafety: quality,
    });
  }

  const postNarrowAutopilotEligibility = evaluateNarrowAutopilotEligibilityV2({
    clientAiMode: capsule.client.aiMode,
    riskDecision,
    modeDecision: effectiveModeDecision,
    canonicalIntent,
    greenIntent,
    answerability,
    foodDecisionV2,
    foodRule,
    responsePlan: effectiveResponsePlan,
    providerOutputSafety: quality,
    phase: "post_provider",
  });
  contextManifest.narrowAutopilotEligibility = {
    ...narrowAutopilotEligibility,
    postProvider: postNarrowAutopilotEligibility,
  };

  if (effectiveModeDecision.action === "draft_for_approval") {
    await adapters?.onDraftForApproval?.({ capsule, draft, riskDecision });
    return buildResult({
      capsule,
      riskDecision,
      action: "draft_for_approval",
      draft,
      model: selectedModel,
      providerAttempted: true,
      providerId,
      activation,
      contextManifest,
      blockedReason:
        effectiveModeDecision.reason === "narrow_autopilot_ineligible"
          ? "narrow_autopilot_ineligible"
          : null,
    });
  }

  if (postNarrowAutopilotEligibility.applies && !postNarrowAutopilotEligibility.eligible) {
    await adapters?.onDraftForApproval?.({ capsule, draft, riskDecision });
    return buildResult({
      capsule,
      riskDecision,
      action: "draft_for_approval",
      draft,
      model: selectedModel,
      providerAttempted: true,
      providerId,
      activation,
      contextManifest,
      blockedReason: "narrow_autopilot_post_provider_ineligible",
    });
  }

  await adapters?.sendMessage?.({ capsule, body: draft });
  return buildResult({
    capsule,
    riskDecision,
    action: "sent",
    draft,
    model: selectedModel,
    providerAttempted: true,
    providerId,
    activation,
    contextManifest,
  });
}

export function decideModeAction(mode, riskDecision) {
  if (mode === "manual") return { action: "ignore", reason: "client_manual_mode" };
  if (mode === "paused") return { action: "handoff", reason: "client_paused_mode" };
  if (riskDecision.level === "red") return { action: "handoff", reason: "red_risk" };
  if (riskDecision.level === "yellow") return { action: "draft_for_approval", reason: "yellow_risk" };
  if (mode === "copilot") return { action: "draft_for_approval", reason: "client_copilot_mode" };
  if (mode === "autopilot") return { action: "auto_send", reason: "green_autopilot" };
  return { action: "ignore", reason: "unknown_ai_mode_blocked" };
}

function resolveProviderErrorCode(error) {
  if (!error || typeof error !== "object") return "provider_error";
  const code = error.code;
  if (code === "provider_timeout" || code === "provider_policy_violation" || code === "provider_error") {
    return code;
  }
  return "provider_error";
}

function buildDeterministicClientMessage({ responsePlan, language }) {
  return {
    version: DETERMINISTIC_TEMPLATE_LIBRARY_V1_VERSION,
    templateId: responsePlan.templateId,
    replyMode: responsePlan.replyMode,
    text: renderDeterministicTemplate({
      templateId: responsePlan.templateId,
      language,
      replyMode: responsePlan.replyMode,
      riskClass: responsePlan.riskClass,
    }),
  };
}

function buildProviderFailureOutputSafety(providerErrorCode) {
  return {
    allowed: false,
    issues: [
      {
        code: providerErrorCode,
        severity: "block",
        category: "policy",
        evidence: "provider_error",
      },
    ],
  };
}

function buildResult({
  capsule,
  riskDecision,
  action,
  draft = null,
  handoffCase = null,
  blockedReason = null,
  qualityIssues = [],
  model = null,
  providerAttempted = false,
  providerId = null,
  providerStatus = null,
  providerErrorCode = null,
  providerOutputSafety = null,
  activation = null,
  contextManifest = null,
  overrideReasons = null,
}) {
  const resolvedProviderStatus =
    providerStatus ?? (providerAttempted ? "ok" : "not_called");
  const resolvedProviderErrorCode =
    providerErrorCode ?? (resolvedProviderStatus === "failed" ? "provider_error" : null);

  return {
    tenantId: capsule.tenantId,
    dietitianId: capsule.dietitian.id,
    clientId: capsule.client.id,
    conversationId: capsule.conversation.id,
    mode: capsule.client.aiMode,
    aiStatus: capsule.client.aiStatus,
    activation,
    personaId: capsule.persona.id,
    risk: riskDecision.level,
    model,
    providerAttempted,
    promptVersion: providerAttempted ? contextManifest?.promptVersion || null : null,
    providerId: providerAttempted ? providerId : null,
    providerStatus: resolvedProviderStatus,
    providerErrorCode: resolvedProviderErrorCode,
    reasons: overrideReasons || riskDecision.reasons,
    action,
    draft,
    handoffCase,
    blockedReason,
    qualityIssues,
    contextManifest,
    providerOutputSafety,
  };
}
