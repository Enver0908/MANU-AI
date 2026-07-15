import type { AudioTranscriptCorrectionReasonCode } from "./phase-85-stage-4b4-voice-contracts";
import type { ConversationVoiceTranscriptDto } from "./phase-85-stage-4b4-voice-contracts";
import type { SupportedLanguageCode } from "./languages";
import { t } from "./i18n";

export function resolveVoiceTranscriptStatusLabel(
  uiLanguage: SupportedLanguageCode,
  status: ConversationVoiceTranscriptDto["status"],
): string {
  switch (status) {
    case "pending":
      return t(uiLanguage, "conversationVoiceTranscriptPending");
    case "accepted":
      return t(uiLanguage, "conversationVoiceTranscriptAccepted");
    case "corrected":
      return t(uiLanguage, "conversationVoiceTranscriptCorrected");
    case "review_required":
      return t(uiLanguage, "conversationVoiceTranscriptReviewRequired");
    case "failed":
      return t(uiLanguage, "conversationVoiceTranscriptFailed");
    case "expired":
      return t(uiLanguage, "conversationVoiceTranscriptExpired");
    default:
      return status;
  }
}

export function resolveVoicePlaybackStateLabel(
  uiLanguage: SupportedLanguageCode,
  playbackState: "available" | "pending" | "review_required" | "failed" | "expired",
): string {
  switch (playbackState) {
    case "available":
      return t(uiLanguage, "conversationVoicePlaybackAvailable");
    case "pending":
      return t(uiLanguage, "conversationVoicePlaybackPending");
    case "review_required":
      return t(uiLanguage, "conversationVoicePlaybackReviewRequired");
    case "failed":
      return t(uiLanguage, "conversationVoicePlaybackFailed");
    case "expired":
      return t(uiLanguage, "conversationVoicePlaybackExpired");
    default:
      return playbackState;
  }
}

export function resolveVoiceCorrectionReasonLabel(
  uiLanguage: SupportedLanguageCode,
  reasonCode: AudioTranscriptCorrectionReasonCode,
): string {
  switch (reasonCode) {
    case "wrong_word":
      return t(uiLanguage, "voiceCorrectionReasonWrongWord");
    case "wrong_number":
      return t(uiLanguage, "voiceCorrectionReasonWrongNumber");
    case "wrong_medication":
      return t(uiLanguage, "voiceCorrectionReasonWrongMedication");
    case "wrong_language_fragment":
      return t(uiLanguage, "voiceCorrectionReasonWrongLanguageFragment");
    case "incomplete_transcript":
      return t(uiLanguage, "voiceCorrectionReasonIncompleteTranscript");
    case "other_clinical_mismatch":
      return t(uiLanguage, "voiceCorrectionReasonOtherClinicalMismatch");
    default:
      return reasonCode;
  }
}

export function formatVoiceDuration(durationMs: number | null): string {
  if (durationMs == null || durationMs <= 0) return "0:00";
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
