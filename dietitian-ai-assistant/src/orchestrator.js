import { getPersona } from "./personas.js";
import { classifyClinicalSafetyRisk } from "./clinical-safety-second-layer.js";
import { buildMemoryContext } from "./conversation-memory.js";
import { buildClientContextCapsule } from "./context-capsule.js";
import { compilePromptContext, renderPromptContext } from "./context-compiler.js";
import { createHandoffCase } from "./handoff-engine.js";
import { guardProviderOutput } from "./response-quality-guard.js";
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

  const riskDecision = classifyClinicalSafetyRisk({
    message: input.message.body,
    recentMessages: input.recentMessages || [],
    clientProfile: {
      highRisk: capsule.client.clinicalRiskNotes.length > 0,
      healthProfile: capsule.client.healthProfile,
      allergies: capsule.client.allergies,
      restrictedFoods: capsule.client.restrictedFoods,
    },
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

  const selectedModel = selectModelForRisk(riskDecision.level);
  const prompt = renderPromptContext(compiledContext.promptContext);
  const draft = await adapters.generateReply({
    prompt,
    promptContext: compiledContext.promptContext,
    contextManifest: compiledContext.contextManifest,
    riskDecision,
    model: selectedModel,
  });
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
      contextManifest: compiledContext.contextManifest,
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
      contextManifest: compiledContext.contextManifest,
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
    contextManifest: compiledContext.contextManifest,
  });
}

export function decideModeAction(mode, riskDecision) {
  if (mode === "manual") return { action: "ignore", reason: "client_manual_mode" };
  if (mode === "paused") return { action: "handoff", reason: "client_paused_mode" };
  if (riskDecision.level === "red") return { action: "handoff", reason: "red_risk" };
  if (riskDecision.level === "yellow") return { action: "draft_for_approval", reason: "yellow_risk" };
  if (mode === "copilot") return { action: "draft_for_approval", reason: "client_copilot_mode" };
  return { action: "auto_send", reason: "green_autopilot" };
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
  activation = null,
  contextManifest = null,
  overrideReasons = null,
}) {
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
    providerStatus: providerAttempted ? "ok" : "not_called",
    providerErrorCode: null,
    reasons: overrideReasons || riskDecision.reasons,
    action,
    draft,
    handoffCase,
    blockedReason,
    qualityIssues,
    contextManifest,
  };
}
