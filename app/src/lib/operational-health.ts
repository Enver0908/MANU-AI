import { evaluateProductionPilotLaunchGates, type LaunchGateId } from "./launch-gates";
import type { ManuAppState } from "./types";

export type OperationalHealthSnapshot = {
  generatedAt: string;
  openHandoffCount: number;
  urgentOpenHandoffCount: number;
  failedProviderDecisionCount: number;
  unreadNotificationCount: number;
  pendingDraftCount: number;
  staleDraftCount: number;
  passiveClientCount: number;
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
  const openHandoffs = state.handoffCases.filter((handoff) => handoff.status === "open");
  const pendingDrafts = state.messages.filter((message) => message.status === "draft");

  return {
    generatedAt: now.toISOString(),
    openHandoffCount: openHandoffs.length,
    urgentOpenHandoffCount: openHandoffs.filter((handoff) => handoff.urgency === "urgent").length,
    failedProviderDecisionCount: state.aiDecisions.filter((decision) => decision.providerStatus === "failed").length,
    unreadNotificationCount: state.notifications.filter((notification) => !notification.read).length,
    pendingDraftCount: pendingDrafts.length,
    staleDraftCount: pendingDrafts.filter((message) => now.getTime() - new Date(message.createdAt).getTime() > staleDraftMs)
      .length,
    passiveClientCount: state.clients.filter((client) => client.aiStatus === "passive").length,
    launchBlocked: launchGateEvaluation.blocked,
    openLaunchGateIds: launchGateEvaluation.openGateIds,
    blockedLaunchGateCount: launchGateEvaluation.openGateIds.length,
  };
}
