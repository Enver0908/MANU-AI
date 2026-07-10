import type {
  AiMode,
  ClientRecord,
  HumanControlSessionRecord,
  ManuAppState,
  RiskActivityEventRecord,
} from "./types";

export const PHASE_85_IF_F_RISK_REACTIVATION_VERSION = "p85-if-f-risk-reactivation-v1";
export const DIRECT_DIETITIAN_REACTIVATION_REASON_CODE = "direct_dietitian_reactivation_v1";

export type ControlledAiActivationInput = {
  requestedAiMode?: "copilot" | "autopilot";
  expectedConversationRevision?: number;
  expectedClientContextRevision?: number;
  activationSource?: "client_patch" | "activate_ai_api" | "handoff_resolve_reactivate";
  reactivationReason?: string;
  useFixedReactivationReasonCode?: boolean;
};

export function findActiveHumanControlSession(state: ManuAppState, clientId: string) {
  return state.humanControlSessions.find((session) => session.clientId === clientId && session.status === "active") || null;
}

export function resolveTargetAiModeForReactivation(
  state: ManuAppState,
  client: ClientRecord,
  isQualified: (client: ClientRecord) => boolean,
  requested?: AiMode | null,
  fallback?: AiMode | null,
): "copilot" | "autopilot" {
  let mode = requested ?? fallback ?? client.aiMode;
  if (mode === "manual" || mode === "paused") {
    mode = "copilot";
  }
  if (mode !== "autopilot") {
    return "copilot";
  }
  return isQualified(client) ? "autopilot" : "copilot";
}

export function closeHumanControlSessionsForReactivation(
  state: ManuAppState,
  clientId: string,
  dietitianId: string,
  restoredMode: AiMode,
  clinicalResolution: boolean,
  now: string,
): ManuAppState {
  const activeSessions = state.humanControlSessions.filter(
    (session) => session.clientId === clientId && session.status === "active",
  );
  if (activeSessions.length === 0) return state;

  const closedSessions = activeSessions.map((session) => ({
    ...session,
    status: clinicalResolution ? ("resolved" as const) : ("reactivated" as const),
    resolvedAt: now,
    reactivatedByDietitianId: dietitianId,
    reactivationReasonCode: DIRECT_DIETITIAN_REACTIVATION_REASON_CODE,
    restoredAiMode: restoredMode,
  }));
  const closedIds = new Set(closedSessions.map((session) => session.id));

  const riskActivity: RiskActivityEventRecord[] = [];
  for (const session of closedSessions) {
    if (clinicalResolution) {
      riskActivity.push({
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        clientId,
        conversationId: session.conversationId,
        humanControlSessionId: session.id,
        eventType: "risk_resolved",
        sourceMessageId: session.latestHumanMessageId,
        handoffId: session.linkedHandoffId,
        aiDecisionId: null,
        metadata: { reasonCode: DIRECT_DIETITIAN_REACTIVATION_REASON_CODE },
        createdAt: now,
      });
    }
    riskActivity.push({
      id: crypto.randomUUID(),
      tenantId: state.tenant.id,
      clientId,
      conversationId: session.conversationId,
      humanControlSessionId: session.id,
      eventType: "ai_reactivated",
      sourceMessageId: session.latestHumanMessageId,
      handoffId: session.linkedHandoffId,
      aiDecisionId: null,
      metadata: {
        reasonCode: DIRECT_DIETITIAN_REACTIVATION_REASON_CODE,
        clinicalResolution,
      },
      createdAt: now,
    });
  }

  return {
    ...state,
    humanControlSessions: state.humanControlSessions.map((session) =>
      closedIds.has(session.id)
        ? (closedSessions.find((item) => item.id === session.id) as HumanControlSessionRecord)
        : session,
    ),
    riskActivityEvents: [...state.riskActivityEvents, ...riskActivity],
  };
}

export function ensureHumanControlSessionForRiskState(
  state: ManuAppState,
  input: {
    clientId: string;
    conversationId: string;
    reason: HumanControlSessionRecord["reason"];
    previousAiStatus: ClientRecord["aiStatus"];
    previousAiMode: ClientRecord["aiMode"];
    linkedHandoffId?: string | null;
    linkedYellowHoldMessageId?: string | null;
    openedByMessageId?: string | null;
    openedAt: string;
  },
): ManuAppState {
  if (findActiveHumanControlSession(state, input.clientId)) {
    return state;
  }

  const session: HumanControlSessionRecord = {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    clientId: input.clientId,
    conversationId: input.conversationId,
    reason: input.reason,
    status: "active",
    previousAiStatus: input.previousAiStatus,
    previousAiMode: input.previousAiMode,
    linkedHandoffId: input.linkedHandoffId ?? null,
    linkedYellowHoldMessageId: input.linkedYellowHoldMessageId ?? null,
    openedByMessageId: input.openedByMessageId ?? null,
    latestHumanMessageId: input.openedByMessageId ?? null,
    humanResponseObservedCount: 0,
    openedAt: input.openedAt,
    resolvedAt: null,
    reactivatedByDietitianId: null,
    reactivationReasonCode: null,
    restoredAiMode: null,
  };

  return {
    ...state,
    humanControlSessions: [...state.humanControlSessions, session],
  };
}

export function appendControlledActivationAudit(
  state: ManuAppState,
  clientId: string,
  handoffId: string | null,
  aiMode: AiMode,
  resolutionKind: string,
  now: string,
): ManuAppState {
  return {
    ...state,
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "controlled_ai_activation_completed",
        entityType: "client",
        entityId: clientId,
        metadata: {
          reasonCode: DIRECT_DIETITIAN_REACTIVATION_REASON_CODE,
          resolutionKind,
          aiMode,
          handoffId,
        },
        createdAt: now,
      },
    ],
  };
}
