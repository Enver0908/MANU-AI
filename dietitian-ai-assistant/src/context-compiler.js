export const MISSING_HISTORICAL_CONTEXT_TOKEN = "[ERROR: missing_historical_context]";

export const MISSING_HISTORICAL_CONTEXT_INSTRUCTION =
  "Eğer danışan, senin elindeki PromptContext (son 8 mesaj ve özet) içinde yer almayan geçmiş bir konuşmaya, yemeğe veya detaya atıf yapıyorsa; danışana hitaben herhangi bir cevap üretme. Bunun yerine sadece [ERROR: missing_historical_context] çıktısını üret.";

export const CONTEXT_POLICY_V1 = {
  version: "context-policy-v1",
  totalPrompt: 3500,
  reserve: 900,
  currentMessage: 500,
  recentMessages: 900,
  memory: 700,
  profileDietAllergyPinned: 700,
  personaVoice: 300,
  output: 350,
  maxRecentMessages: 8,
  candidateMultiplier: 3,
  estimateTokens(text) {
    return Math.ceil(String(text || "").length / 3);
  },
};

const PROMPTABLE_ORIGINS = new Set(["client_inbound", "dietitian_manual"]);

export function compilePromptContext({
  capsule,
  currentMessage,
  recentMessages = [],
  riskLevel,
  promptVersion = null,
  policy = CONTEXT_POLICY_V1,
}) {
  const currentText = String(currentMessage || "").trim();
  const currentTokens = policy.estimateTokens(currentText);

  if (currentTokens > policy.currentMessage) {
    return blockedContext({
      capsule,
      currentMessage,
      riskLevel,
      promptVersion,
      policy,
      reason: "current_message_token_budget_exceeded",
      currentTokens,
    });
  }

  const selectedRecent = selectPromptableRecentMessages(recentMessages, policy);
  const segments = [
    textSegment("system_instruction", "system_instruction_missing_history", MISSING_HISTORICAL_CONTEXT_INSTRUCTION),
    textSegment("current_message", "current_message", currentText),
    textSegment("diet_plan_summary", "diet_plan_summary", capsule.client.dietPlan?.summary || ""),
    textSegment("allergies", "allergies", capsule.client.allergies?.join(", ") || ""),
    textSegment("restricted_foods", "restricted_foods", capsule.client.restrictedFoods?.join(", ") || ""),
    ...buildPinnedSegments(capsule.client.pinnedNotes || []),
    textSegment("client_form_summary", "client_form_summary", capsule.client.clientFormSummary || ""),
    textSegment("rolling_summary", "rolling_summary", capsule.memory?.rollingSummary || ""),
    ...selectedRecent.map((message) => textSegment("recent_message", message.id || null, message.body || "")),
    textSegment("persona", capsule.persona?.id || "persona", JSON.stringify(capsule.persona?.behavior || {})),
    textSegment("voice_profile", "voice_profile", JSON.stringify(capsule.voiceProfile || {})),
  ].filter((segment) => segment.text.trim());

  const shrunk = shrinkSegments(segments, policy);
  const totalTokens = tokenTotal(shrunk.segments, policy);
  const usablePromptBudget = policy.totalPrompt - policy.reserve;
  const validation = {
    ok: totalTokens <= usablePromptBudget,
    reasons: totalTokens <= usablePromptBudget ? [] : ["context_token_budget_exceeded"],
  };

  return {
    promptContext: {
      schemaVersion: "prompt-context-v1",
      policyVersion: policy.version,
      segments: shrunk.segments.map((segment) => ({ type: segment.type, text: segment.text })),
    },
    contextManifest: buildManifest({
      capsule,
      currentMessage,
      riskLevel,
      promptVersion,
      policy,
      segments: shrunk.segments,
      excludedCounts: {
        nonPromptableMessages: recentMessages.length - selectedRecent.length,
        droppedRecentMessages: shrunk.droppedRecentMessages,
      },
      validation,
      totalTokens,
    }),
    blockedReason: validation.ok ? null : "context_token_budget_exceeded",
  };
}

export function selectPromptableRecentMessages(messages, policy = CONTEXT_POLICY_V1) {
  return [...(messages || [])]
    .filter((message) => {
      if (!message || !message.body) return false;
      if (PROMPTABLE_ORIGINS.has(message.origin)) return true;
      return message.origin === "ai_generated" && message.status === "sent";
    })
    .slice(-policy.maxRecentMessages);
}

export function renderPromptContext(promptContext) {
  return (promptContext?.segments || [])
    .map((segment) => `[${segment.type}]\n${segment.text}`)
    .join("\n\n");
}

function blockedContext({ capsule, currentMessage, riskLevel, promptVersion, policy, reason, currentTokens }) {
  const validation = { ok: false, reasons: [reason] };
  return {
    promptContext: {
      schemaVersion: "prompt-context-v1",
      policyVersion: policy.version,
      segments: [],
    },
    contextManifest: buildManifest({
      capsule,
      currentMessage,
      riskLevel,
      promptVersion,
      policy,
      segments: [],
      excludedCounts: { nonPromptableMessages: 0, droppedRecentMessages: 0 },
      validation,
      totalTokens: currentTokens,
    }),
    blockedReason: reason,
  };
}

function textSegment(type, sourceId, text) {
  return {
    id: `${type}-${String(sourceId || "none")}`,
    type,
    sourceId,
    text: String(text || ""),
    truncated: false,
  };
}

function buildPinnedSegments(notes) {
  return notes.map((note, index) => textSegment("pinned_note", `pinned-${index + 1}`, note));
}

function shrinkSegments(segments, policy) {
  let nextSegments = [...segments];
  let droppedRecentMessages = 0;
  const usablePromptBudget = policy.totalPrompt - policy.reserve;

  while (tokenTotal(nextSegments, policy) > usablePromptBudget && hasRecentMessage(nextSegments)) {
    const firstRecentIndex = nextSegments.findIndex((segment) => segment.type === "recent_message");
    nextSegments.splice(firstRecentIndex, 1);
    droppedRecentMessages += 1;
  }

  nextSegments = nextSegments.map((segment) =>
    segment.type === "rolling_summary" && tokenTotal(nextSegments, policy) > usablePromptBudget
      ? truncateSegment(segment, policy.memory, policy)
      : segment,
  );

  nextSegments = nextSegments.map((segment) =>
    segment.type === "pinned_note" && tokenTotal(nextSegments, policy) > usablePromptBudget
      ? truncateSegment(segment, Math.floor(policy.profileDietAllergyPinned / 4), policy)
      : segment,
  );

  return { segments: nextSegments, droppedRecentMessages };
}

function truncateSegment(segment, maxTokens, policy) {
  if (policy.estimateTokens(segment.text) <= maxTokens) return segment;

  return {
    ...segment,
    text: segment.text.slice(0, Math.max(0, maxTokens * 3)),
    truncated: true,
  };
}

function hasRecentMessage(segments) {
  return segments.some((segment) => segment.type === "recent_message");
}

function tokenTotal(segments, policy) {
  return segments.reduce((total, segment) => total + policy.estimateTokens(segment.text), 0);
}

function buildManifest({
  capsule,
  currentMessage,
  riskLevel,
  promptVersion,
  policy,
  segments,
  excludedCounts,
  validation,
  totalTokens,
}) {
  return {
    schemaVersion: "context-manifest-v1",
    contextPolicyVersion: policy.version,
    hashMode: "none_v1",
    tenantId: capsule.tenantId,
    clientId: capsule.client.id,
    conversationId: capsule.conversation.id,
    channel: capsule.conversation.channel,
    currentMessageId: currentMessage?.id || null,
    clientContextRevision: capsule.client.contextRevision || 1,
    memoryIncluded: Boolean(capsule.memory?.rollingSummary),
    memoryVersion: capsule.memory?.memoryVersion || "memory-v1",
    memoryRevision: capsule.memory?.memoryRevision || 1,
    lastPromptableMessageId: lastPromptableMessageId(segments),
    riskLevel,
    personaId: capsule.persona?.id || null,
    promptVersion,
    segments: segments.map((segment) => ({
      segmentId: segment.id,
      type: segment.type,
      sourceId: segment.sourceId,
      included: true,
      truncated: segment.truncated,
      tokenEstimate: policy.estimateTokens(segment.text),
      excludeReason: null,
    })),
    excludedCounts,
    tokenBudget: {
      totalPrompt: policy.totalPrompt,
      reserve: policy.reserve,
      used: totalTokens,
      output: policy.output,
    },
    validation,
  };
}

function lastPromptableMessageId(segments) {
  const recent = segments.filter((segment) => segment.type === "recent_message");
  return recent.at(-1)?.sourceId || null;
}
