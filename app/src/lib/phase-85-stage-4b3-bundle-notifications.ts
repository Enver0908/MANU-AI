import { upsertSystemNotificationInState } from "./phase-85-stage-4b-notifications";
import type { BundleDecisionAction, BundleDecisionOutcomeV2 } from "./phase-85-stage-4b3-atomic-outcomes";
import type { ManuAppState } from "./types";

export const STAGE_4B3_BUNDLE_NOTIFICATIONS_VERSION = "p85-stage-4b3-bundle-notifications-v1";

export function buildStage4B3DedupeKey(
  scope: "bundle" | "correction",
  reason: string,
  entityId: string,
): string {
  return `stage4b3:${scope}:${reason}:${entityId}`;
}

export function applyStage4B3BundleDecisionNotifications(
  state: ManuAppState,
  input: {
    bundleId: string;
    clientId: string;
    conversationId: string;
    anchorMessageId: string;
    action: BundleDecisionAction;
    risk: BundleDecisionOutcomeV2["risk"];
    clientName: string;
    now?: string;
  },
): ManuAppState {
  const now = input.now ?? new Date().toISOString();
  let next = state;

  if (input.risk === "yellow" || input.action === "draft_for_approval") {
    next = upsertSystemNotificationInState(
      next,
      {
        kind: "visual_message_review",
        tenantId: next.tenant.id,
        type: "system",
        entityType: "inbound_message_bundle",
        entityId: input.bundleId,
        clientId: input.clientId,
        conversationId: input.conversationId,
        messageId: input.anchorMessageId,
        sourceMessageId: input.anchorMessageId,
        dedupeKey: buildStage4B3DedupeKey("bundle", "yellow_review", input.bundleId),
        title: "Visual message review required",
        body: `A visual client message for ${input.clientName} needs dietitian review before any client send.`,
        createdAt: now,
      },
      now,
    );
  }

  if (input.risk === "red" || input.action === "handoff") {
    next = upsertSystemNotificationInState(
      next,
      {
        kind: "safe_reply_unavailable",
        tenantId: next.tenant.id,
        type: "system",
        entityType: "inbound_message_bundle",
        entityId: input.bundleId,
        clientId: input.clientId,
        conversationId: input.conversationId,
        messageId: input.anchorMessageId,
        sourceMessageId: input.anchorMessageId,
        dedupeKey: buildStage4B3DedupeKey("bundle", "red_handoff", input.bundleId),
        title: "Visual handoff required",
        body: `Automated visual reply could not be sent safely for ${input.clientName}. Review and respond manually.`,
        createdAt: now,
      },
      now,
    );
  }

  return next;
}

export function applyStage4B3CorrectionFollowUpNotification(
  state: ManuAppState,
  input: {
    correctionId: string;
    clientId: string;
    conversationId: string;
    analysisId: string;
    clientName: string;
    now?: string;
  },
): ManuAppState {
  const now = input.now ?? new Date().toISOString();
  return upsertSystemNotificationInState(
    state,
    {
      kind: "visual_correction_follow_up",
      tenantId: state.tenant.id,
      type: "system",
      entityType: "visual_correction",
      entityId: input.correctionId,
      clientId: input.clientId,
      conversationId: input.conversationId,
      dedupeKey: buildStage4B3DedupeKey("correction", "manual_follow_up", input.correctionId),
      title: "Visual correction follow-up required",
      body: `A sent visual reply for ${input.clientName} was corrected. Manual follow-up is required; no automatic corrective message was sent.`,
      createdAt: now,
    },
    now,
  );
}
