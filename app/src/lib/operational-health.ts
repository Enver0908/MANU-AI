import { evaluateProductionPilotLaunchGates, type LaunchGateId } from "./launch-gates";
import { buildNotificationSlaSnapshot } from "./notification-sla";
import { buildScopeGuardHealthSignal } from "./scope-guard-runtime";
import type { ManuAppState } from "./types";

export type OperationalHealthSnapshot = {
  generatedAt: string;
  openHandoffCount: number;
  urgentOpenHandoffCount: number;
  failedProviderDecisionCount: number;
  unreadNotificationCount: number;
  breachedNotificationSlaCount: number;
  urgentEscalationDueCount: number;
  pendingDraftCount: number;
  staleDraftCount: number;
  passiveClientCount: number;
  scopeGuardCorpusActive: boolean;
  scopeGuardApprovedRuleCount: number;
  scopeGuardDraftRuleCount: number;
  launchBlocked: boolean;
  openLaunchGateIds: LaunchGateId[];
  blockedLaunchGateCount: number;
};

const DEFAULT_STALE_DRAFT_HOURS = 24;

export function buildOperationalHealthSnapshot(
  state: ManuAppState,
  options: { now?: string; approvedLaunchGateIds?: string[]; staleDraftHours?: number } = {},
): OperationalHealthSnapshot {
  const now = options.now ? new Date(options.now) : new Date();
  const staleDraftMs = (options.staleDraftHours ?? DEFAULT_STALE_DRAFT_HOURS) * 60 * 60 * 1000;
  const launchGateEvaluation = evaluateProductionPilotLaunchGates(options.approvedLaunchGateIds);
  const notificationSla = buildNotificationSlaSnapshot(
    { notifications: state.notifications, handoffCases: state.handoffCases },
    { now: now.toISOString() },
  );
  const openHandoffs = state.handoffCases.filter((handoff) => handoff.status === "open");
  const pendingDrafts = state.messages.filter((message) => message.status === "draft");
  const scopeGuard = buildScopeGuardHealthSignal(state);

  return {
    generatedAt: now.toISOString(),
    openHandoffCount: openHandoffs.length,
    urgentOpenHandoffCount: openHandoffs.filter((handoff) => handoff.urgency === "urgent").length,
    failedProviderDecisionCount: state.aiDecisions.filter((decision) => decision.providerStatus === "failed").length,
    unreadNotificationCount: state.notifications.filter((notification) => !notification.read).length,
    breachedNotificationSlaCount: notificationSla.breachedNotificationCount,
    urgentEscalationDueCount: notificationSla.urgentEscalationDueCount,
    pendingDraftCount: pendingDrafts.length,
    staleDraftCount: pendingDrafts.filter((message) => now.getTime() - new Date(message.createdAt).getTime() > staleDraftMs)
      .length,
    passiveClientCount: state.clients.filter((client) => client.aiStatus === "passive").length,
    scopeGuardCorpusActive: scopeGuard.corpusActive,
    scopeGuardApprovedRuleCount: scopeGuard.approvedRuleCount,
    scopeGuardDraftRuleCount: scopeGuard.draftRuleCount,
    launchBlocked: launchGateEvaluation.blocked,
    openLaunchGateIds: launchGateEvaluation.openGateIds,
    blockedLaunchGateCount: launchGateEvaluation.openGateIds.length,
  };
}
