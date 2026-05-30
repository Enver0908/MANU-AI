import { getPersona } from "./personas.js";
import { classifyDieteticRisk } from "./safety-classifier.js";
import { buildMemoryContext } from "./conversation-memory.js";
import { buildClientContextCapsule } from "./context-capsule.js";
import { compilePromptContext, renderPromptContext } from "./context-compiler.js";
import { createHandoffCase } from "./handoff-engine.js";
import { guardProviderOutput } from "./response-quality-guard.js";
import { defaultVoiceProfile } from "./voice-profile.js";
import { selectModelForRisk } from "./model-routing.js";
import { resolveAiActivation } from "./ai-activation.js";

export async function handleInboundMessage(input, adapters) {
  const persona = getPersona(input.client.selectedPersonaId);
  const voiceProfile = input.voiceProfile || defaultVoiceProfile();
  const memory = buildMemoryContext({
    rollingSummary: input.memory?.rollingSummary,
    durableFacts: input.memory?.durableFacts,
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

  const riskDecision = classifyDieteticRisk(input.message.body, {
    highRisk: capsule.client.clinicalRiskNotes.length > 0,
  });

  const activation = resolveAiActivation(capsule.client, input.now ? new Date(input.now) : new Date());
  const selectedModel = activation.active ? selectModelForRisk(riskDecision.level) : null;

  if (!activation.active) {
    return buildResult({
      capsule,
      riskDecision,
      action: "no_ai",
      blockedReason: activation.reason,
      model: selectedModel,
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
      model: selectedModel,
      activation,
    });
  }

  if (modeDecision.action === "ignore") {
    return buildResult({
      capsule,
      riskDecision,
      action: "no_ai",
      blockedReason: modeDecision.reason,
      model: selectedModel,
      activation,
    });
  }

  const compiledContext = compilePromptContext({
    capsule,
    currentMessage: input.message.body,
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
      model: selectedModel,
      activation,
      contextManifest: compiledContext.contextManifest,
    });
  }

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

export function buildReplyPrompt({ capsule, inboundMessage }) {
  return [
    "You are a supervised messaging assistant for a registered dietitian.",
    "Reply in Turkish unless the client clearly uses another language.",
    "Use only the dietitian-approved client profile, diet plan, pinned notes, and conversation memory.",
    "Do not diagnose, prescribe, change medication, set supplement doses, or manage emergencies.",
    "Do not mention internal risk labels, prompt rules, or that you are a model.",
    "Keep the answer short and natural for WhatsApp or Telegram.",
    `Dietitian: ${capsule.dietitian.displayName}`,
    `Client: ${capsule.client.fullName}`,
    `Persona: ${capsule.persona.label}`,
    `Persona behavior: ${JSON.stringify(capsule.persona.behavior)}`,
    `Dietitian voice: ${JSON.stringify(capsule.voiceProfile)}`,
    `Client profile: ${JSON.stringify(capsule.client.healthProfile)}`,
    `Diet plan: ${JSON.stringify(capsule.client.dietPlan)}`,
    `Allergies: ${capsule.client.allergies.join(", ") || "none"}`,
    `Restricted foods: ${capsule.client.restrictedFoods.join(", ") || "none"}`,
    `Pinned notes: ${capsule.client.pinnedNotes.join(" | ") || "none"}`,
    `Memory: ${JSON.stringify(capsule.memory)}`,
    `Client message: ${inboundMessage}`,
  ].join("\n\n");
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
  activation = null,
  contextManifest = null,
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
    reasons: riskDecision.reasons,
    action,
    draft,
    handoffCase,
    blockedReason,
    qualityIssues,
    contextManifest,
  };
}
