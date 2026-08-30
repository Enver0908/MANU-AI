import {
  evaluateProductionReadinessBoundary,
  type ProductionReadinessBoundaryInput,
  type ProductionReadinessOperationId,
  type ProductionReadinessProvider,
} from "./production-readiness-contracts";
import type { AiChatAttachmentStatus, AiChatRiskLevel } from "./phase-85-stage-4c-contracts";

export const PRODUCTION_AI_ADAPTER_CONTRACT_VERSION =
  "production-readiness-stage-1-phase-4-ai-adapters-v1";

export const PRODUCTION_AI_SUPPORTED_PROVIDER = "gemini" as const;

export const PRODUCTION_AI_ALLOWED_TEXT_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
] as const;

export const PRODUCTION_AI_ALLOWED_MULTIMODAL_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.5-flash",
] as const;

export const PRODUCTION_AI_REQUIRED_SAFETY_CATEGORIES = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
] as const;

export const PRODUCTION_AI_FORBIDDEN_PAYLOAD_KEYS = [
  "rawPrompt",
  "rawMessages",
  "messages",
  "healthProfile",
  "clinicalNotes",
  "channelIdentity",
  "phone",
  "phoneNumber",
  "whatsappId",
  "secret",
  "apiKey",
] as const;

export type ProductionAiOperation =
  | "ai_text_generate"
  | "ai_vision_analyze"
  | "ocr_extract"
  | "audio_transcribe";

export type ProductionAiAdapterApprovalState = {
  vendorRiskApproved: boolean;
  clinicalSafetyApproved: boolean;
  privacyLegalApproved: boolean;
  providerTrainingDisabled: boolean;
  providerRetentionDisabledOrBounded: boolean;
  nativeTokenCountingVerified: boolean;
  safetySettingsConfigured: boolean;
};

export type ProductionAiPayloadSafetyInput = {
  riskLevel: AiChatRiskLevel | "red";
  serializedCharCount: number;
  topLevelKeys: string[];
  attachmentStatuses?: AiChatAttachmentStatus[];
  mediaEvidence?: {
    sanitizedImageOnly?: boolean;
    acceptedTranscriptOnly?: boolean;
    extractedTextReviewedOrDeterministic?: boolean;
    malwareScanPassed?: boolean;
  };
};

export type ProductionAiPayloadSafetyDecision = {
  ok: boolean;
  blockingReasons: string[];
};

export type ProductionAiAdapterReadinessInput = {
  provider: Extract<ProductionReadinessProvider, "gemini" | "vision" | "ocr" | "transcription">;
  operation: ProductionAiOperation;
  model: string;
  approvalState: ProductionAiAdapterApprovalState;
  boundary: Omit<ProductionReadinessBoundaryInput, "provider" | "operation">;
  payloadSafety: ProductionAiPayloadSafetyInput;
};

export type ProductionAiAdapterReadinessDecision = {
  version: typeof PRODUCTION_AI_ADAPTER_CONTRACT_VERSION;
  realProviderCallAllowed: boolean;
  provider: ProductionAiAdapterReadinessInput["provider"];
  operation: ProductionAiOperation;
  model: string;
  blockingReasons: string[];
};

export function evaluateProductionAiPayloadSafety(
  input: ProductionAiPayloadSafetyInput,
): ProductionAiPayloadSafetyDecision {
  const blockingReasons: string[] = [];

  if (input.riskLevel === "red") {
    blockingReasons.push("red risk payload must not reach an AI provider");
  }
  if (!Number.isFinite(input.serializedCharCount) || input.serializedCharCount <= 0) {
    blockingReasons.push("provider payload is empty or invalid");
  }
  if (input.serializedCharCount > 60_000) {
    blockingReasons.push("provider payload exceeds bounded serialization budget");
  }

  const forbiddenKeys = input.topLevelKeys.filter((key) =>
    PRODUCTION_AI_FORBIDDEN_PAYLOAD_KEYS.includes(key as (typeof PRODUCTION_AI_FORBIDDEN_PAYLOAD_KEYS)[number]),
  );
  if (forbiddenKeys.length > 0) {
    blockingReasons.push(`forbidden provider payload keys: ${forbiddenKeys.join(", ")}`);
  }

  const nonReadyAttachments = (input.attachmentStatuses ?? []).filter((status) => status !== "ready");
  if (nonReadyAttachments.length > 0) {
    blockingReasons.push("all provider-bound attachments must be ready");
  }

  const mediaEvidence = input.mediaEvidence;
  if (mediaEvidence) {
    if (mediaEvidence.sanitizedImageOnly === false) {
      blockingReasons.push("provider-bound images must be sanitized derivatives only");
    }
    if (mediaEvidence.acceptedTranscriptOnly === false) {
      blockingReasons.push("provider-bound audio must use accepted transcripts only");
    }
    if (mediaEvidence.extractedTextReviewedOrDeterministic === false) {
      blockingReasons.push("provider-bound document text must be deterministic or reviewed");
    }
    if (mediaEvidence.malwareScanPassed !== true) {
      blockingReasons.push("provider-bound files require malware scan pass evidence");
    }
  }

  return { ok: blockingReasons.length === 0, blockingReasons };
}

export function evaluateProductionAiAdapterReadiness(
  input: ProductionAiAdapterReadinessInput,
): ProductionAiAdapterReadinessDecision {
  const boundary = evaluateProductionReadinessBoundary({
    ...input.boundary,
    provider: input.provider,
    operation: input.operation as ProductionReadinessOperationId,
  });
  const payloadSafety = evaluateProductionAiPayloadSafety(input.payloadSafety);
  const blockingReasons = [...boundary.blockingReasons, ...payloadSafety.blockingReasons];

  if (!isModelAllowed(input.operation, input.model)) {
    blockingReasons.push(`model is not allowlisted for ${input.operation}`);
  }

  for (const reason of approvalBlockingReasons(input.approvalState)) {
    blockingReasons.push(reason);
  }

  return {
    version: PRODUCTION_AI_ADAPTER_CONTRACT_VERSION,
    realProviderCallAllowed: blockingReasons.length === 0,
    provider: input.provider,
    operation: input.operation,
    model: input.model,
    blockingReasons,
  };
}

export function buildGeminiSafetySettingsContract() {
  return PRODUCTION_AI_REQUIRED_SAFETY_CATEGORIES.map((category) => ({
    category,
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  }));
}

function isModelAllowed(operation: ProductionAiOperation, model: string) {
  const allowed: readonly string[] =
    operation === "ai_text_generate" ? PRODUCTION_AI_ALLOWED_TEXT_MODELS : PRODUCTION_AI_ALLOWED_MULTIMODAL_MODELS;
  return allowed.includes(model);
}

function approvalBlockingReasons(state: ProductionAiAdapterApprovalState) {
  const reasons: string[] = [];
  if (!state.vendorRiskApproved) reasons.push("provider vendor-risk approval is missing");
  if (!state.clinicalSafetyApproved) reasons.push("clinical safety approval is missing");
  if (!state.privacyLegalApproved) reasons.push("privacy/legal approval is missing");
  if (!state.providerTrainingDisabled) reasons.push("provider training disablement is not evidenced");
  if (!state.providerRetentionDisabledOrBounded) reasons.push("provider retention disablement or bounded retention is not evidenced");
  if (!state.nativeTokenCountingVerified) reasons.push("provider-native token counting is not verified");
  if (!state.safetySettingsConfigured) reasons.push("provider safety settings are not configured");
  return reasons;
}
