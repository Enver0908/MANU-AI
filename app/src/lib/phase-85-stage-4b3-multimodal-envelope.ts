import { conversationRevisionOrDefault } from "./phase-85-if-f-conversation-revision";
import { STAGE_4B3_CLIENT_IMAGE_TRANSCRIPT_PLACEHOLDER } from "./phase-85-stage-4b3-media-admission";
import {
  PHASE_85_STAGE_4B3_MEDIA_CONTRACT_VERSION,
  type InboundMessageBundleRecord,
  type MultimodalMessageEnvelope,
  type MultimodalTextSegment,
  type MultimodalVisualSegment,
  type VisualAnalysisRecord,
  type VisualObservationV1,
} from "./phase-85-stage-4b3-media-contracts";
import type { ManuAppState, MessageRecord } from "./types";

export const STAGE_4B3_MULTIMODAL_ENVELOPE_VERSION = "p85-stage-4b3-multimodal-envelope-v1";
export const STAGE_4B3_MAX_VISUAL_PROVIDER_CONTEXT_BYTES = 12 * 1024;

export type Stage4B3MultimodalEnvelopeBuildResult =
  | { ok: true; envelope: MultimodalMessageEnvelope; providerContext: Stage4B3BoundedVisualProviderContext }
  | { ok: false; failureCode: string };

export type Stage4B3BoundedVisualProviderContext = {
  byteSize: number;
  withinLimit: boolean;
  excludesRawMedia: true;
  segments: Array<{
    analysisId: string;
    mediaAssetId: string;
    sceneType: VisualObservationV1["sceneType"];
    sceneConfidence: number;
    overallConfidence: number;
    entityLabels: string[];
    captionText: string | null;
    ocrSummary: string;
    observedAt: string;
  }>;
};

const TERMINAL_BUNDLE_STATUSES = new Set<InboundMessageBundleRecord["status"]>([
  "ready",
  "processing",
  "completed",
]);

const FORBIDDEN_PROVIDER_CONTEXT_KEYS = [
  "objectKey",
  "object_key",
  "sanitizedFullObjectKey",
  "thumbnailObjectKey",
  "rawBytes",
  "providerMediaId",
  "http://",
  "https://",
];

export function buildMultimodalMessageEnvelope(
  state: ManuAppState,
  bundleId: string,
): Stage4B3MultimodalEnvelopeBuildResult {
  const bundle = state.inboundMessageBundles.find(
    (entry) => entry.id === bundleId && entry.tenantId === state.tenant.id,
  );
  if (!bundle) {
    return { ok: false, failureCode: "bundle_not_found" };
  }
  if (!TERMINAL_BUNDLE_STATUSES.has(bundle.status)) {
    return { ok: false, failureCode: "bundle_not_terminal" };
  }

  const conversation = state.conversations.find((entry) => entry.id === bundle.conversationId);
  const items = state.inboundMessageBundleItems
    .filter((entry) => entry.tenantId === state.tenant.id && entry.bundleId === bundleId)
    .sort((left, right) => left.ordinal - right.ordinal);

  const textSegments: MultimodalTextSegment[] = [];
  const visualSegments: MultimodalVisualSegment[] = [];

  for (const item of items) {
    const message = findMessage(state, item.messageId);
    if (!message) {
      return { ok: false, failureCode: "bundle_message_missing" };
    }

    if (item.itemType === "text") {
      textSegments.push({
        messageId: message.id,
        body: message.body,
        observedAt: item.observedAt,
        replyToProviderMessageId: item.replyToProviderMessageId,
      });
      continue;
    }

    if (item.itemType === "image" || item.itemType === "caption") {
      const terminal = resolveTerminalVisualAnalysis(state, item.mediaAssetId, message.id);
      if (!terminal.ok) {
        return { ok: false, failureCode: terminal.failureCode };
      }

      visualSegments.push({
        messageId: message.id,
        mediaAssetId: terminal.mediaAssetId,
        analysisId: terminal.analysis.id,
        observation: terminal.analysis.observation!,
        captionText: item.captionText ?? extractCaptionFromMessage(message),
        observedAt: item.observedAt,
      });
    }
  }

  const envelope: MultimodalMessageEnvelope = {
    schemaVersion: PHASE_85_STAGE_4B3_MEDIA_CONTRACT_VERSION,
    bundleId: bundle.id,
    tenantId: bundle.tenantId,
    clientId: bundle.clientId,
    conversationId: bundle.conversationId,
    bundleRevision: bundle.bundleRevision,
    conversationRevision: conversation ? conversationRevisionOrDefault(conversation) : bundle.conversationRevisionAtOpen,
    textSegments,
    visualSegments,
    primaryQuestionText: extractPrimaryQuestionText(textSegments, visualSegments),
    confidenceBand: computeEnvelopeConfidenceBand(visualSegments),
    sourceAuthorityState: "unresolved",
  };

  const providerContext = buildBoundedVisualProviderContext(visualSegments);
  if (!providerContext.withinLimit) {
    return { ok: false, failureCode: "visual_provider_context_limit_exceeded" };
  }
  assertProviderContextExcludesRawMedia(providerContext);

  return { ok: true, envelope, providerContext };
}

export function extractPrimaryQuestionText(
  textSegments: MultimodalTextSegment[],
  visualSegments: MultimodalVisualSegment[],
): string | null {
  const questions = extractQuestionTexts(textSegments, visualSegments);
  return questions[0] ?? null;
}

export function extractQuestionTexts(
  textSegments: MultimodalTextSegment[],
  visualSegments: MultimodalVisualSegment[],
): string[] {
  const questions: string[] = [];
  for (const segment of textSegments) {
    for (const question of extractQuestionsFromText(segment.body)) {
      questions.push(question);
    }
  }
  for (const segment of visualSegments) {
    for (const block of segment.observation.ocrBlocks) {
      if (block.blockKind !== "screenshot") continue;
      for (const question of extractQuestionsFromText(block.text)) {
        questions.push(question);
      }
    }
  }
  return questions;
}

export function buildBoundedVisualProviderContext(
  visualSegments: MultimodalVisualSegment[],
): Stage4B3BoundedVisualProviderContext {
  let segments = visualSegments.map((segment) => ({
    analysisId: segment.analysisId,
    mediaAssetId: segment.mediaAssetId,
    sceneType: segment.observation.sceneType,
    sceneConfidence: segment.observation.sceneConfidence,
    overallConfidence: segment.observation.overallConfidence,
    entityLabels: segment.observation.entityCandidates.map((candidate) => candidate.normalizedLabel),
    captionText: segment.captionText,
    ocrSummary: summarizeOcrBlocks(segment.observation),
    observedAt: segment.observedAt,
  }));

  let serialized = JSON.stringify({ segments });
  while (Buffer.byteLength(serialized, "utf8") > STAGE_4B3_MAX_VISUAL_PROVIDER_CONTEXT_BYTES && segments.length > 0) {
    const last = segments[segments.length - 1];
    if (!last) break;
    if (last.ocrSummary.length > 32) {
      last.ocrSummary = `${last.ocrSummary.slice(0, 32)}…`;
    } else if (last.entityLabels.length > 0) {
      last.entityLabels = last.entityLabels.slice(0, -1);
    } else {
      segments = segments.slice(0, -1);
    }
    serialized = JSON.stringify({ segments });
  }

  const byteSize = Buffer.byteLength(serialized, "utf8");
  return {
    byteSize,
    withinLimit: byteSize <= STAGE_4B3_MAX_VISUAL_PROVIDER_CONTEXT_BYTES,
    excludesRawMedia: true,
    segments,
  };
}

function findMessage(state: ManuAppState, messageId: string): MessageRecord | null {
  return state.messages.find((entry) => entry.id === messageId && entry.tenantId === state.tenant.id) ?? null;
}

function resolveTerminalVisualAnalysis(
  state: ManuAppState,
  mediaAssetId: string | null,
  messageId: string,
): { ok: true; mediaAssetId: string; analysis: VisualAnalysisRecord } | { ok: false; failureCode: string } {
  if (!mediaAssetId) {
    return { ok: false, failureCode: "bundle_image_missing_asset" };
  }

  const asset = state.mediaAssets.find(
    (entry) => entry.id === mediaAssetId && entry.tenantId === state.tenant.id && entry.messageId === messageId,
  );
  if (!asset) {
    return { ok: false, failureCode: "media_asset_not_found" };
  }
  if (asset.status === "expired" || asset.status === "revoked") {
    return { ok: false, failureCode: "media_asset_expired" };
  }
  if (asset.status !== "analysis_ready") {
    return { ok: false, failureCode: "media_asset_not_analysis_ready" };
  }

  const analysis = state.visualAnalysisRecords
    .filter(
      (entry) =>
        entry.tenantId === state.tenant.id &&
        entry.mediaAssetId === asset.id &&
        entry.status === "ready" &&
        entry.observation,
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

  if (!analysis?.observation) {
    return { ok: false, failureCode: "visual_analysis_not_ready" };
  }

  return { ok: true, mediaAssetId: asset.id, analysis };
}

function extractCaptionFromMessage(message: MessageRecord): string | null {
  const body = message.body.trim();
  if (!body || body === STAGE_4B3_CLIENT_IMAGE_TRANSCRIPT_PLACEHOLDER) {
    return null;
  }
  return body;
}

function extractQuestionsFromText(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.includes("?"));
}

function computeEnvelopeConfidenceBand(
  visualSegments: MultimodalVisualSegment[],
): MultimodalMessageEnvelope["confidenceBand"] {
  if (visualSegments.length === 0) {
    return "insufficient";
  }

  const confidences = visualSegments.map((segment) => segment.observation.overallConfidence);
  if (confidences.every((value) => value >= 0.95)) {
    return "high";
  }
  if (confidences.some((value) => value >= 0.95)) {
    return "medium";
  }
  if (confidences.some((value) => value >= 0.7)) {
    return "low";
  }
  return "insufficient";
}

function summarizeOcrBlocks(observation: VisualObservationV1): string {
  return observation.ocrBlocks
    .map((block) => `${block.blockKind}:${block.text}`)
    .join(" | ")
    .slice(0, 512);
}

function assertProviderContextExcludesRawMedia(context: Stage4B3BoundedVisualProviderContext): void {
  const serialized = JSON.stringify(context);
  for (const token of FORBIDDEN_PROVIDER_CONTEXT_KEYS) {
    if (serialized.includes(token)) {
      throw new Error(`provider_context_forbidden_token:${token}`);
    }
  }
}
