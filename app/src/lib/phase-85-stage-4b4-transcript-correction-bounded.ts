import { AppDomainError } from "./app-errors";
import type { ConversationPermissions } from "./phase-85-stage-4b2-contracts";
import {
  AUDIO_TRANSCRIPT_CORRECTION_REASON_CODES,
  canAccessVoiceTranscriptCorrection,
  countUnicodeCodepoints,
  type TranscriptCorrectionRequest,
} from "./phase-85-stage-4b4-voice-contracts";
import type { TenantRole } from "./types";

export const STAGE_4B4_MAX_CORRECTED_TRANSCRIPT_CODEPOINTS = 4096;

export function canSubmitTranscriptCorrection(role: TenantRole): boolean {
  return canAccessVoiceTranscriptCorrection(role);
}

export function assertTranscriptCorrectionAllowed(permissions: ConversationPermissions, role: TenantRole) {
  if (!permissions.canRead || !permissions.canMutateConversation) {
    throw new AppDomainError(403, "transcript_correction_forbidden");
  }
  if (!canSubmitTranscriptCorrection(role)) {
    throw new AppDomainError(403, "transcript_correction_forbidden");
  }
}

export function parseTranscriptCorrectionMutationBody(body: unknown): TranscriptCorrectionRequest {
  if (!body || typeof body !== "object") {
    throw new AppDomainError(400, "invalid_request_body");
  }

  const record = body as Record<string, unknown>;
  const transcriptionId = typeof record.transcriptionId === "string" ? record.transcriptionId.trim() : "";
  const requestId = typeof record.requestId === "string" ? record.requestId.trim() : "";
  const reasonCode = typeof record.reasonCode === "string" ? record.reasonCode.trim() : "";
  const explanation = typeof record.explanation === "string" ? record.explanation.trim() : "";
  const correctedTranscript =
    typeof record.correctedTranscript === "string" ? record.correctedTranscript.trim() : "";
  const expectedConversationRevision = record.expectedConversationRevision;
  const expectedTranscriptionRevision = record.expectedTranscriptionRevision;

  if (!transcriptionId) {
    throw new AppDomainError(400, "transcript_correction_transcription_id_required");
  }
  if (!requestId) {
    throw new AppDomainError(400, "transcript_correction_request_id_required");
  }
  if (!reasonCode || !AUDIO_TRANSCRIPT_CORRECTION_REASON_CODES.includes(reasonCode as TranscriptCorrectionRequest["reasonCode"])) {
    throw new AppDomainError(400, "transcript_correction_reason_invalid");
  }
  if (!explanation) {
    throw new AppDomainError(400, "transcript_correction_explanation_required");
  }
  if (!correctedTranscript) {
    throw new AppDomainError(400, "transcript_correction_text_required");
  }
  if (countUnicodeCodepoints(correctedTranscript) > STAGE_4B4_MAX_CORRECTED_TRANSCRIPT_CODEPOINTS) {
    throw new AppDomainError(400, "transcript_correction_text_too_long");
  }
  if (
    typeof expectedConversationRevision !== "number" ||
    !Number.isInteger(expectedConversationRevision) ||
    expectedConversationRevision < 1
  ) {
    throw new AppDomainError(400, "transcript_correction_conversation_revision_invalid");
  }
  if (
    typeof expectedTranscriptionRevision !== "number" ||
    !Number.isInteger(expectedTranscriptionRevision) ||
    expectedTranscriptionRevision < 1
  ) {
    throw new AppDomainError(400, "transcript_correction_revision_invalid");
  }

  return {
    transcriptionId,
    requestId,
    expectedConversationRevision,
    expectedTranscriptionRevision,
    reasonCode: reasonCode as TranscriptCorrectionRequest["reasonCode"],
    explanation,
    correctedTranscript,
  };
}
