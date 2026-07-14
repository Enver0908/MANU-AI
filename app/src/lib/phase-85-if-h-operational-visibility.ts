import { buildChannelAdapterHealthSignal } from "./channel-adapter-health";
import { getFallbackStage4B3MediaStorage } from "./phase-85-stage-4b3-fallback-media-storage";
import {
  buildStage4B3MediaOperationalHealth,
  detectStage4B3MediaOrphans,
  type Stage4B3MediaOperationalHealth,
} from "./phase-85-stage-4b3-media-lifecycle";
import { isVerifiedBusinessHumanMessage } from "./phase-85-if-b-provenance-model";
import { findActiveHumanControlSession } from "./phase-85-if-f-risk-reactivation";
import { CONTEXT_INTAKE_STRUCTURED_PANEL_LINKS } from "./phase-85-if-g-context-intake";
import type {
  ChannelEventRecord,
  ContextIntakeProposalRecord,
  DietitianRecord,
  HumanControlSessionReason,
  ManuAppState,
  MessageRecord,
} from "./types";

export const PHASE_85_IF_H_OPERATIONAL_VISIBILITY_VERSION = "p85-if-h-operational-visibility-v1";

export type MessageProvenanceKind =
  | "client"
  | "ai"
  | "exact_dietitian"
  | "verified_business_human"
  | "dietitian_manual"
  | "system"
  | "imported_unknown";

export type MessageProvenancePresentation = {
  kind: MessageProvenanceKind;
  i18nKey:
    | "provenanceClient"
    | "provenanceAi"
    | "provenanceExactDietitian"
    | "provenanceVerifiedBusinessHuman"
    | "provenanceDietitianManual"
    | "provenanceSystem"
    | "provenanceImportedUnknown";
  tone: "stone" | "emerald" | "amber";
};

export type HumanControlBannerModel = {
  sessionId: string;
  reason: HumanControlSessionReason;
  reasonI18nKey:
    | "humanControlReasonYellowHold"
    | "humanControlReasonRedLock"
    | "humanControlReasonManualTakeover"
    | "humanControlReasonChannelTrustGap"
    | "humanControlReasonExternalHumanActive";
  latestHumanResponseAt: string | null;
  humanResponseCount: number;
  canActivateAi: boolean;
  requiresAtomicRedActivation: boolean;
};

export type ChannelTrustOperationalSnapshot = {
  status: "healthy" | "degraded" | "blocked";
  statusI18nKey: "channelTrustHealthy" | "channelTrustDegraded" | "channelTrustBlocked";
  quarantinedEventCount: number;
  openQuarantineCount: number;
  activeAccountBindingCount: number;
  revokedAccountBindingCount: number;
  activeActorBindingCount: number;
  duplicateIgnoredCount: number;
  deliveryFailureCount: number;
  gateBlockedCount: number;
  optOutCount: number;
  rollbackScopeCount: number;
};

export type QuarantineInspectionRow = {
  id: string;
  source: "channel_event" | "inbound_quarantine";
  eventKind: string;
  processingStatus: string;
  reasonCode: string;
  observedAt: string;
  retryCount: number;
  payloadDigestPrefix: string;
};

export type StructuredUpdateSourceLink = {
  proposalId: string;
  proposalTitle: string;
  sourceMessageId: string | null;
  structuredImpactFlags: string[];
  panelDeepLinks: string[];
  status: ContextIntakeProposalRecord["status"];
};

export type OperationalFoundationInspectionDto = {
  channelTrust: ChannelTrustOperationalSnapshot;
  quarantineRows: QuarantineInspectionRow[];
  trustBindings: ReturnType<typeof buildTrustBindingInspectionSummary>;
  mediaLifecycle: Stage4B3MediaOperationalHealth;
};

export function buildOperationalFoundationInspectionDto(
  state: ManuAppState,
  limit = 8,
): OperationalFoundationInspectionDto {
  const storage = getFallbackStage4B3MediaStorage();
  const orphanReport = detectStage4B3MediaOrphans(state, storage);
  return {
    channelTrust: buildChannelTrustOperationalSnapshot(state),
    quarantineRows: buildQuarantineInspectionRows(state, limit),
    trustBindings: buildTrustBindingInspectionSummary(state),
    mediaLifecycle: buildStage4B3MediaOperationalHealth(state, orphanReport),
  };
}

export function resolveMessageProvenancePresentation(
  message: Pick<
    MessageRecord,
    "origin" | "actorType" | "actorResolutionBasis" | "authorDietitianId"
  >,
): MessageProvenancePresentation {
  if (message.origin === "client_inbound" || message.actorType === "client") {
    return { kind: "client", i18nKey: "provenanceClient", tone: "stone" };
  }
  if (message.origin === "ai_generated" || message.actorType === "ai") {
    return { kind: "ai", i18nKey: "provenanceAi", tone: "emerald" };
  }
  if (isVerifiedBusinessHumanMessage(message)) {
    return {
      kind: "verified_business_human",
      i18nKey: "provenanceVerifiedBusinessHuman",
      tone: "amber",
    };
  }
  if (message.origin === "dietitian_manual" && message.actorType === "exact_dietitian") {
    return { kind: "exact_dietitian", i18nKey: "provenanceExactDietitian", tone: "amber" };
  }
  if (message.origin === "dietitian_manual") {
    return { kind: "dietitian_manual", i18nKey: "provenanceDietitianManual", tone: "amber" };
  }
  if (message.origin === "system_event" || message.actorType === "system") {
    return { kind: "system", i18nKey: "provenanceSystem", tone: "stone" };
  }
  return { kind: "imported_unknown", i18nKey: "provenanceImportedUnknown", tone: "stone" };
}

export function buildClientHumanControlBanner(state: ManuAppState, clientId: string): HumanControlBannerModel | null {
  const session = findActiveHumanControlSession(state, clientId);
  if (!session) return null;

  const client = state.clients.find((item) => item.id === clientId);
  const latestHumanMessage = session.latestHumanMessageId
    ? state.messages.find((message) => message.id === session.latestHumanMessageId)
    : null;
  const latestHumanResponseAt =
    latestHumanMessage?.providerSentAt ||
    latestHumanMessage?.createdAt ||
    state.riskActivityEvents
      .filter(
        (event) =>
          event.clientId === clientId &&
          event.eventType === "human_response_observed" &&
          event.humanControlSessionId === session.id,
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt ||
    null;

  return {
    sessionId: session.id,
    reason: session.reason,
    reasonI18nKey: humanControlReasonKey(session.reason),
    latestHumanResponseAt,
    humanResponseCount: session.humanResponseObservedCount,
    canActivateAi: Boolean(client && client.aiStatus !== "active"),
    requiresAtomicRedActivation: client?.redRiskLock.status === "locked",
  };
}

export function buildChannelTrustOperationalSnapshot(state: ManuAppState): ChannelTrustOperationalSnapshot {
  const adapter = buildChannelAdapterHealthSignal(state);
  const rollbackControls = state.channelAdapterRollback ?? {
    globalChannelAutomationDisabled: false,
    tenantChannelAutomationDisabled: false,
    disabledDietitianIds: [],
    disabledClientIds: [],
  };
  const quarantinedEventCount = state.channelEvents.filter((event) => event.processingStatus === "quarantined").length;
  const openQuarantineCount = state.inboundQuarantines.length + quarantinedEventCount;
  const activeAccountBindingCount = state.channelAccountBindings.filter(
    (binding) => binding.lifecycleStatus === "active",
  ).length;
  const revokedAccountBindingCount = state.channelAccountBindings.filter(
    (binding) => binding.lifecycleStatus === "revoked",
  ).length;
  const activeActorBindingCount = state.channelActorBindings.filter((binding) => !binding.revokedAt).length;
  const rollbackScopeCount =
    (rollbackControls.globalChannelAutomationDisabled ? 1 : 0) +
    (rollbackControls.tenantChannelAutomationDisabled ? 1 : 0) +
    rollbackControls.disabledClientIds.length +
    rollbackControls.disabledDietitianIds.length;

  const blocked =
    rollbackScopeCount > 0 ||
    rollbackControls.globalChannelAutomationDisabled ||
    rollbackControls.tenantChannelAutomationDisabled;
  const degraded =
    !blocked &&
    (openQuarantineCount > 0 ||
      adapter.channelGateBlockedCount > 0 ||
      adapter.channelMockDeliveryFailureCount > 0 ||
      revokedAccountBindingCount > 0);

  return {
    status: blocked ? "blocked" : degraded ? "degraded" : "healthy",
    statusI18nKey: blocked ? "channelTrustBlocked" : degraded ? "channelTrustDegraded" : "channelTrustHealthy",
    quarantinedEventCount,
    openQuarantineCount,
    activeAccountBindingCount,
    revokedAccountBindingCount,
    activeActorBindingCount,
    duplicateIgnoredCount: adapter.channelDuplicateIgnoredCount,
    deliveryFailureCount: adapter.channelMockDeliveryFailureCount,
    gateBlockedCount: adapter.channelGateBlockedCount,
    optOutCount: adapter.channelOptOutCount,
    rollbackScopeCount,
  };
}

export function buildQuarantineInspectionRows(state: ManuAppState, limit = 8): QuarantineInspectionRow[] {
  const channelRows = state.channelEvents
    .filter((event) => event.processingStatus === "quarantined" || event.processingStatus === "expired")
    .map((event) => mapChannelEventInspectionRow(event));
  const inboundRows = state.inboundQuarantines.map((quarantine) => ({
    id: quarantine.id,
    source: "inbound_quarantine" as const,
    eventKind: quarantine.reason,
    processingStatus: "quarantined",
    reasonCode: quarantine.reason,
    observedAt: quarantine.createdAt,
    retryCount: 0,
    payloadDigestPrefix: "group",
  }));

  return [...channelRows, ...inboundRows]
    .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
    .slice(0, limit);
}

export function buildTrustBindingInspectionSummary(state: ManuAppState) {
  return {
    accounts: state.channelAccountBindings.map((binding) => ({
      id: binding.id,
      provider: binding.provider,
      operatingMode: binding.operatingMode,
      lifecycleStatus: binding.lifecycleStatus,
      normalizedDisplayNumber: binding.normalizedDisplayNumber,
      verifiedAt: binding.verifiedAt,
      revokedAt: binding.revokedAt,
    })),
    actors: state.channelActorBindings.map((binding) => ({
      id: binding.id,
      accountBindingId: binding.accountBindingId,
      actorType: binding.actorType,
      attributionBasis: binding.attributionBasis,
      dietitianId: binding.dietitianId,
      verifiedAt: binding.verifiedAt,
      revokedAt: binding.revokedAt,
    })),
  };
}

export function buildStructuredUpdateSourceLinks(state: ManuAppState, clientId: string): StructuredUpdateSourceLink[] {
  const intakeLinks = state.contextIntakeProposals
    .filter((proposal) => proposal.clientId === clientId)
    .filter((proposal) => proposal.structuredImpactFlags.length > 0)
    .filter((proposal) => !["applied", "rejected", "expired"].includes(proposal.status))
    .map((proposal) => mapStructuredUpdateSourceLink(state, proposal));

  const notificationLinks = buildStructuredUpdateSourceLinksFromNotifications(state, clientId);
  const seen = new Set(intakeLinks.map((link) => `${link.proposalId}:${link.sourceMessageId ?? "none"}`));
  return [
    ...intakeLinks,
    ...notificationLinks.filter((link) => {
      const key = `${link.proposalId}:${link.sourceMessageId ?? "none"}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ];
}

export function buildStructuredUpdateSourceLinksFromNotifications(
  state: ManuAppState,
  clientId: string,
): StructuredUpdateSourceLink[] {
  return state.notifications
    .filter(
      (notification) =>
        notification.entityId === clientId && notification.title === "Structured record update required",
    )
    .map((notification) => {
      const match = notification.body.match(/WhatsApp instruction ([^\s]+) requires/);
      const sourceMessageId = match?.[1] ?? null;
      const messageExists = sourceMessageId != null && messageBelongsToClient(state, sourceMessageId, clientId);
      return {
        proposalId: notification.id,
        proposalTitle: notification.title,
        sourceMessageId: messageExists ? sourceMessageId : null,
        structuredImpactFlags: [],
        panelDeepLinks: [],
        status: "pending_confirmation" as const,
      };
    })
    .filter((link) => link.sourceMessageId != null);
}

export function resolveDietitianDisplayName(dietitian: DietitianRecord | undefined, message: MessageRecord) {
  if (message.authorDietitianId && dietitian?.id === message.authorDietitianId) {
    return dietitian.displayName;
  }
  return null;
}

function messageBelongsToClient(state: ManuAppState, messageId: string, clientId: string) {
  const message = state.messages.find((item) => item.id === messageId);
  if (!message) return false;
  const conversation = state.conversations.find((item) => item.id === message.conversationId);
  return conversation?.clientId === clientId;
}

function mapStructuredUpdateSourceLink(state: ManuAppState, proposal: ContextIntakeProposalRecord): StructuredUpdateSourceLink {
  return {
    proposalId: proposal.id,
    proposalTitle: proposal.title,
    sourceMessageId: resolveStructuredSourceMessageId(state, proposal),
    structuredImpactFlags: proposal.structuredImpactFlags,
    panelDeepLinks: proposal.structuredImpactFlags
      .map((flag) => CONTEXT_INTAKE_STRUCTURED_PANEL_LINKS[flag as keyof typeof CONTEXT_INTAKE_STRUCTURED_PANEL_LINKS])
      .filter(Boolean),
    status: proposal.status,
  };
}

function resolveStructuredSourceMessageId(state: ManuAppState, proposal: ContextIntakeProposalRecord) {
  const rawReference = proposal.rawSourceReference?.trim();
  if (rawReference && messageBelongsToClient(state, rawReference, proposal.clientId)) {
    return rawReference;
  }

  const session = state.humanControlSessions.find(
    (item) =>
      item.clientId === proposal.clientId && (item.openedByMessageId || item.linkedYellowHoldMessageId),
  );
  const sessionMessageId = session?.openedByMessageId || session?.linkedYellowHoldMessageId || null;
  if (sessionMessageId && messageBelongsToClient(state, sessionMessageId, proposal.clientId)) {
    return sessionMessageId;
  }

  const riskEvent = state.riskActivityEvents
    .filter((event) => event.clientId === proposal.clientId && event.sourceMessageId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (riskEvent?.sourceMessageId && messageBelongsToClient(state, riskEvent.sourceMessageId, proposal.clientId)) {
    return riskEvent.sourceMessageId;
  }

  return null;
}

function mapChannelEventInspectionRow(event: ChannelEventRecord): QuarantineInspectionRow {
  return {
    id: event.id,
    source: "channel_event",
    eventKind: event.eventKind,
    processingStatus: event.processingStatus,
    reasonCode: event.eventKind,
    observedAt: event.observedAt,
    retryCount: event.retryCount,
    payloadDigestPrefix: event.payloadDigest.slice(0, 8),
  };
}

function humanControlReasonKey(
  reason: HumanControlSessionReason,
): HumanControlBannerModel["reasonI18nKey"] {
  switch (reason) {
    case "yellow_risk_hold":
      return "humanControlReasonYellowHold";
    case "red_risk_lock":
      return "humanControlReasonRedLock";
    case "manual_takeover":
      return "humanControlReasonManualTakeover";
    case "channel_trust_gap":
      return "humanControlReasonChannelTrustGap";
    case "external_human_active":
      return "humanControlReasonExternalHumanActive";
  }
}
