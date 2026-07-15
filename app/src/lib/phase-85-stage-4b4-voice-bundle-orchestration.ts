import { detectVisualMetadataLeaks } from "dietitian-ai-assistant-architecture";
import type { MultimodalMessageEnvelope } from "./phase-85-stage-4b3-media-contracts";
import { STAGE_4B3_CLIENT_IMAGE_TRANSCRIPT_PLACEHOLDER } from "./phase-85-stage-4b3-media-admission";
import type { AudioTranscriptionRecord } from "./phase-85-stage-4b4-voice-contracts";
import { computeInboundTurnCoreResult, type InboundCoreResult } from "./simulator";
import { classifySimulationRisk } from "./simulator-risk";
import type { ClientRecord, ConversationRecord, ManuAppState, MessageRecord } from "./types";

export const STAGE_4B4_VOICE_BUNDLE_ORCHESTRATION_VERSION = "p85-stage-4b4-voice-bundle-orchestration-v2";

export function buildBundleOrchestrationIdempotencyKey(input: {
  conversationId: string;
  bundleId: string;
  bundleRevision: number;
  transcriptionRevisions: number[];
}): string {
  const revisionToken = [...input.transcriptionRevisions].sort((left, right) => left - right).join(",");
  return `bundle-decision:${input.conversationId}:${input.bundleId}:${input.bundleRevision}:${revisionToken}`;
}

export type VoiceTranscriptProvenance = {
  messageId: string;
  mediaAssetId: string;
  transcriptionId: string;
  transcriptionRevision: number;
  sourceModality: "voice_transcript";
  voiceOrigin: {
    channelEventKind: "client_message_audio";
    providerMessageId: string | null;
    providerEventId: string | null;
  };
};

export function bundleShouldUseTypedTextRiskChain(envelope: MultimodalMessageEnvelope): boolean {
  return envelope.visualSegments.length === 0;
}

export function resolveVoiceTranscriptProvenance(
  state: ManuAppState,
  bundleId: string,
): VoiceTranscriptProvenance[] {
  const items = state.inboundMessageBundleItems.filter(
    (entry) => entry.tenantId === state.tenant.id && entry.bundleId === bundleId && entry.itemType === "voice",
  );

  return items.flatMap((item) => {
    if (!item.mediaAssetId) {
      return [];
    }
    const message = state.messages.find((entry) => entry.id === item.messageId && entry.tenantId === state.tenant.id);
    const asset = state.mediaAssets.find(
      (entry) => entry.id === item.mediaAssetId && entry.tenantId === state.tenant.id,
    );
    const transcription = resolveAcceptedTranscriptionRecord(state, item.transcriptionId, item.mediaAssetId);
    if (!message || !asset || !transcription) {
      return [];
    }

    return [
      {
        messageId: message.id,
        mediaAssetId: asset.id,
        transcriptionId: transcription.id,
        transcriptionRevision: transcription.transcriptionRevision,
        sourceModality: "voice_transcript" as const,
        voiceOrigin: {
          channelEventKind: "client_message_audio" as const,
          providerMessageId: message.providerMessageId ?? null,
          providerEventId: message.providerEventId ?? null,
        },
      },
    ];
  });
}

export function buildVoiceTranscriptContextManifest(input: {
  envelope: MultimodalMessageEnvelope;
  provenance: VoiceTranscriptProvenance[];
}): Record<string, unknown> {
  const hasVoiceTranscript = input.provenance.length > 0;
  return {
    version: STAGE_4B4_VOICE_BUNDLE_ORCHESTRATION_VERSION,
    bundleId: input.envelope.bundleId,
    bundleRevision: input.envelope.bundleRevision,
    conversationRevision: input.envelope.conversationRevision,
    sourceKind: hasVoiceTranscript ? "voice_transcript" : "typed_text",
    transcriptionRevisions: input.provenance.map((entry) => ({
      transcriptionId: entry.transcriptionId,
      transcriptionRevision: entry.transcriptionRevision,
      messageId: entry.messageId,
      mediaAssetId: entry.mediaAssetId,
    })),
    voiceOrigins: input.provenance.map((entry) => entry.voiceOrigin),
  };
}

export function enrichCoreResultWithVoiceTranscriptManifest(
  coreResult: InboundCoreResult,
  voiceManifest: Record<string, unknown>,
): InboundCoreResult {
  return {
    ...coreResult,
    contextManifest: {
      ...(coreResult.contextManifest ?? {}),
      ...voiceManifest,
    },
  };
}

export function assertVoiceTranscriptMetadataSafe(coreResult: InboundCoreResult): InboundCoreResult {
  const draft = coreResult.draft ?? "";
  const leakIssues = detectVisualMetadataLeaks(draft);
  if (leakIssues.length === 0 || coreResult.action !== "sent") {
    return coreResult;
  }

  return {
    ...coreResult,
    action: "handoff",
    draft: null,
    blockedReason: "visual_metadata_leak",
    qualityIssues: [...coreResult.qualityIssues, ...leakIssues],
    handoffCase: coreResult.handoffCase ?? {
      risk: coreResult.risk,
      reasons: [...coreResult.reasons, ...leakIssues],
      urgency: coreResult.risk === "red" ? "urgent" : "normal",
      safeAcknowledgement: "Internal review handoff queued.",
      recommendedAction: "Review context and decide the manual client response.",
    },
  };
}

export async function computeTypedBundleCoreResult(input: {
  state: ManuAppState;
  client: ClientRecord;
  conversation: ConversationRecord;
  inboundMessage: MessageRecord;
  envelope: MultimodalMessageEnvelope;
  evaluationText: string;
  classified: Awaited<ReturnType<typeof classifySimulationRisk>>;
  now?: string;
}): Promise<InboundCoreResult> {
  const provenance = resolveVoiceTranscriptProvenance(input.state, input.envelope.bundleId);
  const voiceManifest = buildVoiceTranscriptContextManifest({
    envelope: input.envelope,
    provenance,
  });
  const coreResult = await computeInboundTurnCoreResult({
    state: input.state,
    client: input.client,
    conversation: input.conversation,
    inboundMessage: input.inboundMessage,
    evaluationText: input.evaluationText,
    classified: input.classified,
    now: input.now,
  });
  return assertVoiceTranscriptMetadataSafe(enrichCoreResultWithVoiceTranscriptManifest(coreResult, voiceManifest));
}

export function isBundleEvaluationTextReady(evaluationText: string): boolean {
  const trimmed = evaluationText.trim();
  return trimmed.length > 0 && trimmed !== STAGE_4B3_CLIENT_IMAGE_TRANSCRIPT_PLACEHOLDER;
}

function resolveAcceptedTranscriptionRecord(
  state: ManuAppState,
  transcriptionId: string | null | undefined,
  mediaAssetId: string,
): AudioTranscriptionRecord | null {
  if (transcriptionId) {
    const byId = state.audioTranscriptionRecords.find(
      (entry) => entry.id === transcriptionId && entry.tenantId === state.tenant.id,
    );
    if (byId?.status === "accepted") {
      return byId;
    }
  }

  const byAsset = state.audioTranscriptionRecords.find(
    (entry) =>
      entry.tenantId === state.tenant.id &&
      entry.mediaAssetId === mediaAssetId &&
      entry.status === "accepted",
  );
  return byAsset ?? null;
}
