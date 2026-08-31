import {
  evaluateProductionReadinessBoundary,
  type ProductionReadinessBoundaryInput,
  type ProductionReadinessOperationId,
  type ProductionReadinessProvider,
} from "./production-readiness-contracts";
import type { AiChatAttachmentStatus, AiChatRiskLevel } from "./phase-85-stage-4c-contracts";

export const PRODUCTION_AI_ADAPTER_CONTRACT_VERSION =
  "production-readiness-stage-1-phase-4-ai-adapters-v2-zai-glm-5-3-flash";

export const PRODUCTION_AI_SUPPORTED_PROVIDER = "zai" as const;

export const PRODUCTION_AI_GLM_5_3_FLASH_MODEL = "glm-5.3-flash" as const;

export const PRODUCTION_AI_ALLOWED_TEXT_MODELS = [PRODUCTION_AI_GLM_5_3_FLASH_MODEL] as const;

export const PRODUCTION_AI_ALLOWED_MULTIMODAL_MODELS = [PRODUCTION_AI_GLM_5_3_FLASH_MODEL] as const;

export const PRODUCTION_AI_ZAI_BASE_URL = "https://api.z.ai/api/paas/v4" as const;

export const PRODUCTION_AI_ZAI_CHAT_COMPLETIONS_PATH = "/chat/completions" as const;

export const PRODUCTION_AI_ZAI_REQUEST_PARAMETERS = {
  temperature: 1,
  top_p: 0.95,
  reasoning_effort: "max",
  thinking: {
    type: "enabled",
    clear_thinking: false,
  },
} as const;

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
  provider: Extract<ProductionReadinessProvider, "zai" | "vision" | "ocr" | "transcription">;
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

export function buildZaiGlmFlashRequestContract() {
  return {
    baseUrl: PRODUCTION_AI_ZAI_BASE_URL,
    path: PRODUCTION_AI_ZAI_CHAT_COMPLETIONS_PATH,
    provider: PRODUCTION_AI_SUPPORTED_PROVIDER,
    model: PRODUCTION_AI_GLM_5_3_FLASH_MODEL,
    parameters: PRODUCTION_AI_ZAI_REQUEST_PARAMETERS,
    disabledProviderFeatures: [
      "web_search",
      "external_tools",
      "provider_file_storage",
      "model_training",
      "fine_tuning_with_client_data",
      "raw_prompt_logging",
      "raw_completion_logging",
    ],
    reasoningContentPolicy: "discard_before_app_logging",
  } as const;
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
