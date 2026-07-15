import { upsertSystemNotificationInState } from "./phase-85-stage-4b-notifications";
import { buildStage4B3DedupeKey } from "./phase-85-stage-4b3-bundle-notifications";
import type { ManuAppState } from "./types";

export const STAGE_4B4_BUNDLE_NOTIFICATIONS_VERSION = "p85-stage-4b4-bundle-notifications-v1";

export function applyStage4B4TranscriptCorrectionFollowUpNotification(
  state: ManuAppState,
  input: {
    correctionId: string;
    clientId: string;
    conversationId: string;
    transcriptionId: string;
    clientName: string;
    now?: string;
  },
): ManuAppState {
  const now = input.now ?? new Date().toISOString();
  return upsertSystemNotificationInState(
    state,
    {
      kind: "voice_transcript_correction_follow_up",
      tenantId: state.tenant.id,
      type: "system",
      entityType: "audio_transcript_correction",
      entityId: input.correctionId,
      clientId: input.clientId,
      conversationId: input.conversationId,
      dedupeKey: buildStage4B3DedupeKey("correction", "voice_manual_follow_up", input.correctionId),
      title: "Voice transcript correction follow-up required",
      body: `A sent voice reply for ${input.clientName} was corrected. Manual follow-up is required; no automatic corrective message was sent.`,
      createdAt: now,
    },
    now,
  );
}
