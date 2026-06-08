import { getPersona } from "./personas.js";
import { classifyClinicalSafetyRisk } from "./clinical-safety-second-layer.js";
import { buildMemoryContext } from "./conversation-memory.js";
import { buildClientContextCapsule } from "./context-capsule.js";
import { compilePromptContext, renderPromptContext } from "./context-compiler.js";
import { createHandoffCase } from "./handoff-engine.js";
import { guardProviderOutput } from "./response-quality-guard.js";
import { evaluateGreenIntentTaxonomy } from "./green-intent-taxonomy.js";
import { evaluateFoodRuleDecision } from "./food-rule-engine.js";
import { evaluateIntentSpecificAnswerability } from "./intent-specific-answerability.js";
import { defaultVoiceProfile } from "./voice-profile.js";
import { selectModelForRisk } from "./model-routing.js";
import { resolveAiActivation } from "./ai-activation.js";
import { evaluateInboundPreflight } from "./inbound-preflight.js";

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

  // App/simulator paths pass riskDecisionOverride as the single classification source.
  // The fallback below exists for standalone core tests and direct handleInboundMessage callers only.
  const foodRuleDecisionForRisk =
    input.foodRuleDecisionForRisk ||
    (input.structuredFoodRules
      ? evaluateFoodRuleDecision({
          message: input.message.body,
          structuredFoodRules: input.structuredFoodRules,
          mixedIntentBlocked: false,
          productIngredientEvidence: input.productIngredientEvidence || null,
        })
      : null);

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
    riskLevel: riskDecision.level,
    promptVersion: input.promptVersion || null,
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

  const greenIntent = evaluateGreenIntentTaxonomy({
    promptContext: compiledContext.promptContext,
    riskDecision,
    answerability: null,
  });
  contextManifest.greenIntent = greenIntent;

  if (!greenIntent.allowed) {
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
      blockedReason: "green_intent_taxonomy_blocked",
      model: null,
      activation,
      contextManifest,
      overrideReasons: [...riskDecision.reasons, ...greenIntent.reasons],
    });
  }

  const foodRule = input.structuredFoodRules
    ? evaluateFoodRuleDecision({
        message: input.message.body,
        structuredFoodRules: input.structuredFoodRules,
        mixedIntentBlocked: false,
        productIngredientEvidence: input.productIngredientEvidence || null,
      })
    : null;
  if (foodRule) {
    contextManifest.foodRule = foodRule;
  }

  const answerability = evaluateIntentSpecificAnswerability({
    promptContext: compiledContext.promptContext,
    riskDecision,
    greenIntent,
    foodRule,
    structuredFoodRules: input.structuredFoodRules || null,
    productIngredientEvidence: input.productIngredientEvidence || null,
  });
  contextManifest.answerability = answerability;

  if (!answerability.allowed) {
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

  const selectedModel = selectModelForRisk(riskDecision.level);
  const prompt = renderPromptContext(compiledContext.promptContext);
  let draft;
  try {
    draft = await adapters.generateReply({
      prompt,
      promptContext: compiledContext.promptContext,
      contextManifest,
      riskDecision,
      model: selectedModel,
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
  const quality = guardProviderOutput({ output: draft, capsule, riskDecision });

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

  if (modeDecision.action === "draft_for_approval") {
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
