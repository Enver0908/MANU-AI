import {
  detectVisualMetadataLeaks,
  renderDeterministicTemplate,
} from "dietitian-ai-assistant-architecture";
import { conversationRevisionOrDefault } from "./phase-85-if-f-conversation-revision";
import type { MultimodalMessageEnvelope } from "./phase-85-stage-4b3-media-contracts";
import {
  evaluateMultimodalBundleSafetyChain,
  type Stage4B3MultimodalSafetyChain,
} from "./phase-85-stage-4b3-multimodal-safety";
import { resolveMultimodalBundleUnderstanding } from "./phase-85-stage-4b3-multimodal-understanding";
import { commitAtomicBundleDecisionV2 } from "./phase-85-stage-4b3-atomic-bundle-decision";
import { bundleHasDietitianReply } from "./phase-85-stage-4b3-message-bundles";
import {
  bundleShouldUseTypedTextRiskChain,
  buildBundleOrchestrationIdempotencyKey,
  computeTypedBundleCoreResult,
  isBundleEvaluationTextReady,
  resolveVoiceTranscriptProvenance,
} from "./phase-85-stage-4b4-voice-bundle-orchestration";
import {
  prepareInboundTurnPipeline,
  type InboundCoreResult,
} from "./simulator";
import { classifySimulationRisk } from "./simulator-risk";
import type { ClientRecord, ConversationRecord, ManuAppState, MessageRecord, RiskLevel, SimulationRequest } from "./types";

function readRecordString(record: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function readNestedRecordString(
  record: Record<string, unknown> | null | undefined,
  parentKey: string,
  childKey: string,
): string | null {
  const parent = record?.[parentKey];
  if (!parent || typeof parent !== "object") return null;
  const value = (parent as Record<string, unknown>)[childKey];
  return typeof value === "string" ? value : null;
}

function readStringArray(record: Record<string, unknown> | null | undefined, key: string): string[] {
  const value = record?.[key];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function buildVisualHandoffCase(input: {
  risk: RiskLevel;
  reasons: string[];
}) {
  return {
    risk: input.risk,
    reasons: input.reasons,
    urgency: input.risk === "red" ? "urgent" : "normal",
    safeAcknowledgement:
      input.risk === "red" ? "Internal urgent handoff queued." : "Internal review handoff queued.",
    recommendedAction:
      input.risk === "red"
        ? "Review immediately. If the message suggests urgent symptoms, contact the client directly and advise appropriate emergency care where applicable."
        : "Review context, decide the manual client response, and decide whether client mode should remain copilot.",
  };
}

export const STAGE_4B3_BUNDLE_ORCHESTRATION_VERSION = "p85-stage-4b3-bundle-orchestration-v1";

export type MultimodalBundleTurnResult =
  | { ok: true; state: ManuAppState; decisionId: string; bundleId: string }
  | { ok: false; failureCode: string; state: ManuAppState };

export function buildBundleEvaluationText(envelope: MultimodalMessageEnvelope): string {
  const textParts = envelope.textSegments.map((segment) => segment.body.trim()).filter(Boolean);
  const question = envelope.primaryQuestionText?.trim();
  if (question) textParts.push(question);
  if (textParts.length > 0) {
    return textParts.join("\n");
  }
  return "[client image]";
}

export function buildBoundedVisualContextManifest(input: {
  envelope: MultimodalMessageEnvelope;
  safety: Stage4B3MultimodalSafetyChain;
}) {
  const visualRefs = input.envelope.visualSegments.map((segment) => ({
    analysisId: segment.analysisId,
    mediaAssetId: segment.mediaAssetId,
    confidenceBand: input.envelope.confidenceBand,
    sceneType: segment.observation.sceneType,
    reasonCodes: input.safety.visualRiskOverlay.reasonCodes,
    sourceAuthority: (() => {
      const sourceRefs = input.safety.responsePlan?.sourceRefs;
      if (!Array.isArray(sourceRefs)) return [];
      return sourceRefs
        .map((ref) => (ref && typeof ref === "object" ? (ref as { id?: unknown }).id : null))
        .filter((id): id is string => typeof id === "string" && id.length > 0);
    })(),
    workflowState: input.safety.visualCanonicalIntent?.workflowState ?? null,
  }));

  return {
    version: STAGE_4B3_BUNDLE_ORCHESTRATION_VERSION,
    bundleId: input.envelope.bundleId,
    bundleRevision: input.envelope.bundleRevision,
    conversationRevision: input.envelope.conversationRevision,
    visualRefs,
    mergedRiskLevel: input.safety.mergedRiskDecision.level,
    intentFamily: input.safety.visualCanonicalIntent?.intentFamily ?? null,
    narrowAutopilotEligible: input.safety.narrowAutopilotEligibility?.eligible === true,
    providerAttempted: false,
  };
}

export function mapMultimodalSafetyToCoreResult(input: {
  client: ClientRecord;
  conversation: ConversationRecord;
  evaluationText: string;
  safety: Stage4B3MultimodalSafetyChain;
  contextManifest: Record<string, unknown>;
}): InboundCoreResult {
  const { client, conversation, evaluationText, safety, contextManifest } = input;
  const mergedRisk = safety.mergedRiskDecision.level;
  const reasons = [...safety.mergedRiskDecision.reasons];

  if (safety.modeDecision.action === "handoff" || mergedRisk === "red") {
    const handoffCase = buildVisualHandoffCase({
      risk: mergedRisk,
      reasons,
    });
    return {
      mode: client.aiMode,
      aiStatus: client.aiStatus,
      personaId: client.selectedPersonaId,
      risk: mergedRisk,
      model: null,
      providerAttempted: false,
      promptVersion: null,
      providerId: null,
      providerStatus: "not_called",
      providerErrorCode: null,
      reasons,
      action: "handoff",
      draft: null,
      handoffCase,
      blockedReason: mergedRisk === "red" ? "red_risk" : (safety.modeDecision.reason ?? null),
      qualityIssues: [],
      contextManifest,
    };
  }

  if (mergedRisk === "yellow" || safety.modeDecision.action === "draft_for_approval") {
    return {
      mode: client.aiMode,
      aiStatus: client.aiStatus,
      personaId: client.selectedPersonaId,
      risk: "yellow",
      model: null,
      providerAttempted: false,
      promptVersion: null,
      providerId: null,
      providerStatus: "not_called",
      providerErrorCode: null,
      reasons,
      action: "draft_for_approval",
      draft:
        readNestedRecordString(safety.responsePlan, "clientMessagePlan", "summary") ??
        "Visual review required.",
      handoffCase: null,
      blockedReason: null,
      qualityIssues: [],
      contextManifest,
    };
  }

  const templateId = readRecordString(safety.responsePlan, "templateId");
  if (safety.clientSendEligible && templateId) {
    const draft = renderDeterministicTemplate({
      templateId,
      language: client.communicationLanguage,
      replyMode: readRecordString(safety.responsePlan, "replyMode") ?? undefined,
      riskClass: readRecordString(safety.responsePlan, "riskClass") ?? undefined,
    });
    const leakIssues = detectVisualMetadataLeaks(draft);
    if (leakIssues.length > 0) {
      return {
        mode: client.aiMode,
        aiStatus: client.aiStatus,
        personaId: client.selectedPersonaId,
        risk: mergedRisk,
        model: null,
        providerAttempted: false,
        promptVersion: null,
        providerId: null,
        providerStatus: "not_called",
        providerErrorCode: null,
        reasons: [...reasons, ...leakIssues],
        action: "handoff",
        draft: null,
        handoffCase: buildVisualHandoffCase({
          risk: mergedRisk,
          reasons: [...reasons, ...leakIssues],
        }),
        blockedReason: "visual_metadata_leak",
        qualityIssues: leakIssues,
        contextManifest,
      };
    }

    return {
      mode: client.aiMode,
      aiStatus: client.aiStatus,
      personaId: client.selectedPersonaId,
      risk: "green",
      model: null,
      providerAttempted: false,
      promptVersion: null,
      providerId: null,
      providerStatus: "not_called",
      providerErrorCode: null,
      reasons,
      action: "sent",
      draft,
      handoffCase: null,
      blockedReason: null,
      qualityIssues: [],
      contextManifest,
    };
  }

  return {
    mode: client.aiMode,
    aiStatus: client.aiStatus,
    personaId: client.selectedPersonaId,
    risk: mergedRisk,
    model: null,
    providerAttempted: false,
    promptVersion: null,
    providerId: null,
    providerStatus: "not_called",
    providerErrorCode: null,
    reasons,
    action: "no_ai",
    draft: null,
    handoffCase: null,
    blockedReason: "visual_autopilot_ineligible",
    qualityIssues: readStringArray(safety.narrowAutopilotEligibility, "reasonCodes"),
    contextManifest,
  };
}

function findBundleAnchorMessage(
  state: ManuAppState,
  bundleId: string,
): { bundle: NonNullable<ReturnType<typeof findBundle>>; anchorMessage: MessageRecord } | null {
  const bundle = findBundle(state, bundleId);
  if (!bundle) return null;
  const anchorMessage = state.messages.find((message) => message.id === bundle.anchorMessageId);
  if (!anchorMessage) return null;
  return { bundle, anchorMessage };
}

function findBundle(state: ManuAppState, bundleId: string) {
  return state.inboundMessageBundles.find((entry) => entry.tenantId === state.tenant.id && entry.id === bundleId) ?? null;
}

export async function runMultimodalBundleInboundTurn(
  state: ManuAppState,
  bundleId: string,
  input: {
    now?: string;
    idempotencyKey?: string;
    channelPolicyMock?: SimulationRequest["channelPolicyMock"];
  } = {},
): Promise<MultimodalBundleTurnResult> {
  const located = findBundleAnchorMessage(state, bundleId);
  if (!located) {
    return { ok: false, failureCode: "bundle_not_found", state };
  }

  const { bundle, anchorMessage } = located;
  const voiceProvenance = resolveVoiceTranscriptProvenance(state, bundleId);
  const idempotencyKey =
    input.idempotencyKey ??
    (voiceProvenance.length > 0
      ? buildBundleOrchestrationIdempotencyKey({
          conversationId: bundle.conversationId,
          bundleId,
          bundleRevision: bundle.bundleRevision,
          transcriptionRevisions: voiceProvenance.map((entry) => entry.transcriptionRevision),
        })
      : `bundle-decision-${bundleId}-${bundle.bundleRevision}`);
  if (state.processedBundleDecisionKeys.includes(idempotencyKey) && bundle.decisionId) {
    const replay = state.bundleDecisionReplayByKey[idempotencyKey];
    if (!replay || replay.decisionId === bundle.decisionId) {
      return { ok: true, state, decisionId: bundle.decisionId, bundleId };
    }
    return { ok: false, failureCode: "idempotency_key_conflict", state };
  }
  if (bundleHasDietitianReply(state, bundleId)) {
    return { ok: false, failureCode: "bundle_human_handled", state };
  }
  if (bundle.status !== "processing" && bundle.status !== "ready") {
    return {
      ok: false,
      failureCode: bundle.status === "review_required" ? "bundle_review_required" : "bundle_not_processable",
      state,
    };
  }
  if (bundle.decisionId) {
    return { ok: false, failureCode: "bundle_decision_already_committed", state };
  }

  const conversation = state.conversations.find((entry) => entry.id === bundle.conversationId);
  const client = state.clients.find((entry) => entry.id === bundle.clientId);
  if (!conversation || !client) {
    return { ok: false, failureCode: "bundle_context_missing", state };
  }
  if (conversationRevisionOrDefault(conversation) !== bundle.conversationRevisionAtOpen) {
    return { ok: false, failureCode: "stale_conversation_revision", state };
  }

  const understanding = resolveMultimodalBundleUnderstanding(state, bundleId);
  if (!understanding.ok) {
    return { ok: false, failureCode: understanding.failureCode, state };
  }

  const priorMessages = state.messages.filter(
    (message) => message.conversationId === conversation.id && message.id !== anchorMessage.id,
  );
  const evaluationText = buildBundleEvaluationText(understanding.envelope);
  const classified = await classifySimulationRisk(state, client, evaluationText, priorMessages, {
    conversationId: conversation.id,
    messageId: anchorMessage.id,
  });

  const useTypedTextRiskChain =
    bundleShouldUseTypedTextRiskChain(understanding.envelope) && isBundleEvaluationTextReady(evaluationText);
  const textRisk = classified.riskDecision.level;
  const safety = useTypedTextRiskChain
    ? null
    : evaluateMultimodalBundleSafetyChain({
        understanding,
        baseRiskDecision: {
          level: textRisk,
          reasons: classified.riskDecision.reasons,
        },
        textMessage: evaluationText,
        clientAiMode: client.aiMode,
      });
  const contextManifest = useTypedTextRiskChain
    ? null
    : buildBoundedVisualContextManifest({ envelope: understanding.envelope, safety: safety! });
  const coreResult: InboundCoreResult = useTypedTextRiskChain
    ? await computeTypedBundleCoreResult({
        state,
        client,
        conversation,
        inboundMessage: anchorMessage,
        envelope: understanding.envelope,
        evaluationText,
        classified,
        now: input.now,
      })
    : mapMultimodalSafetyToCoreResult({
        client,
        conversation,
        evaluationText,
        safety: safety!,
        contextManifest: contextManifest!,
      });

  const now = input.now ?? new Date().toISOString();
  const prepared = await prepareInboundTurnPipeline({
    state,
    client,
    conversation,
    inboundMessage: anchorMessage,
    evaluationText,
    riskDecisionOverride: useTypedTextRiskChain ? undefined : safety!.mergedRiskDecision,
    classified,
    now,
  });
  if (prepared.blocked) {
    return { ok: false, failureCode: prepared.blockedReason, state: prepared.state };
  }

  const committed = commitAtomicBundleDecisionV2(state, {
    bundleId,
    idempotencyKey,
    expectedBundleRevision: bundle.bundleRevision,
    expectedConversationRevision: bundle.conversationRevisionAtOpen,
    preparedState: prepared.state,
    client,
    conversation,
    inboundMessage: anchorMessage,
    coreResult,
    channelPolicyMock: input.channelPolicyMock,
    now,
  });
  if (!committed.ok) {
    return { ok: false, failureCode: committed.failureCode, state };
  }

  return { ok: true, state: committed.state, decisionId: committed.decisionId, bundleId };
}
