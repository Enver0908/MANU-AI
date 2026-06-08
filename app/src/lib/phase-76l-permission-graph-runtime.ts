import {
  evaluatePhase72PermissionRouting,
  inferPhase72IntentIdsFromMessage,
  isPhase72ActiveProductionRoutingAllowed,
  mapFoodRuleDecisionToPermissionIntents,
  PHASE_72_PERMISSION_GRAPH_VERSION,
  type Phase72FoodRuleDecisionLike,
  type Phase72RoutingBand,
} from "./phase-72-permission-graph";
import type { LaunchGateEvidenceRecord } from "./launch-gates";
import type { ClientRecord, ManuAppState, PermissionGraphEvaluationRecord, RiskLevel } from "./types";

export const PHASE_76L_PERMISSION_GRAPH_BRIDGE_VERSION = "phase-76l-permission-graph-bridge-v1";

export type PermissionGraphRuntimeInput = {
  state: ManuAppState;
  client: ClientRecord;
  message: string;
  baseDecision: {
    level: RiskLevel;
    reasons: string[];
    shouldHandoff?: boolean;
    pauseAutopilot?: boolean;
    classifierVersion?: string;
    foodRuleDecision?: Phase72FoodRuleDecisionLike;
    [key: string]: unknown;
  };
  conversationId?: string | null;
  messageId?: string | null;
  launchGateEvidence?: LaunchGateEvidenceRecord[];
  activePlanAvailable?: boolean;
};

export type PermissionGraphManifest = {
  bridgeVersion: string;
  graphVersion: string;
  mode: "shadow" | "enforce";
  finalRoutingBand: Phase72RoutingBand;
  mixedIntentFailClosed: boolean;
  foodRuleIntentIds: string[];
  messageIntentIds: string[];
  triggeredPrivacyGates: string[];
  blockingReasons: string[];
  activeProductionRoutingAllowed: boolean;
};

export type PermissionGraphRuntimeResult = {
  decision: PermissionGraphRuntimeInput["baseDecision"] & {
    classifierVersion: string;
    permissionGraph: PermissionGraphManifest;
  };
  evaluationRecord: PermissionGraphEvaluationRecord;
};

function routingBandToRiskLevel(band: Phase72RoutingBand): RiskLevel | null {
  if (band === "green") return null;
  if (band === "draft_only" || band === "handoff_no_send" || band === "internal_only") return "yellow";
  return "red";
}

function riskSeverity(level: RiskLevel) {
  if (level === "red") return 2;
  if (level === "yellow") return 1;
  return 0;
}

function buildPrivacyGateFromClient(client: ClientRecord) {
  return {
    channelPermissionReady: client.channelPermission === "ready",
    optOut: client.channelPermission === "opted_out",
    unknownIdentity: false,
    groupMessage: false,
    legalPrivacyApproval: false,
    providerVendorApproval: false,
    whatsappPolicyApproval: false,
    sensitiveDataConsentRevoked: false,
    dsarDeletionRequest: false,
  };
}

function buildClinicalContextFromClient(client: ClientRecord) {
  return {
    acuteEmergency: client.clinicalRiskNotes.some((note) => /acil|emergency/i.test(note)),
    numericGlucoseRisk: client.clinicalRiskNotes.some((note) => /glukoz|glucose/i.test(note)),
    pregnancyComplicationRisk: client.healthProfile.pregnancyOrBreastfeedingFlag,
    minorBodyImageRisk: client.healthProfile.adultStatus === "minor",
  };
}

export function applyPermissionGraphToRiskDecision(input: PermissionGraphRuntimeInput): PermissionGraphRuntimeResult {
  const messageIntentIds = inferPhase72IntentIdsFromMessage(input.message);
  const foodRuleDecision = (input.baseDecision.foodRuleDecision as Phase72FoodRuleDecisionLike | undefined) ?? null;
  const routing = evaluatePhase72PermissionRouting({
    intentIds: messageIntentIds,
    privacyGate: buildPrivacyGateFromClient(input.client),
    clinicalContext: buildClinicalContextFromClient(input.client),
    activePlanAvailable: input.activePlanAvailable ?? Boolean(input.client.dietPlan.summary?.trim()),
    foodRuleDecision,
    launchGateEvidence: input.launchGateEvidence,
  });
  const enforcementActive = isPhase72ActiveProductionRoutingAllowed(input.launchGateEvidence ?? []);
  const foodRuleIntentIds = mapFoodRuleDecisionToPermissionIntents(foodRuleDecision).map(String);
  const permissionGraph: PermissionGraphManifest = {
    bridgeVersion: PHASE_76L_PERMISSION_GRAPH_BRIDGE_VERSION,
    graphVersion: routing.graphVersion,
    mode: enforcementActive ? "enforce" : "shadow",
    finalRoutingBand: routing.finalRoutingBand,
    mixedIntentFailClosed: routing.mixedIntentFailClosed,
    foodRuleIntentIds,
    messageIntentIds,
    triggeredPrivacyGates: routing.triggeredPrivacyGates,
    blockingReasons: routing.blockingReasons,
    activeProductionRoutingAllowed: routing.activeProductionRoutingAllowed,
  };

  let decision: PermissionGraphRuntimeResult["decision"] = {
    ...input.baseDecision,
    classifierVersion: input.baseDecision.classifierVersion || PHASE_72_PERMISSION_GRAPH_VERSION,
    permissionGraph,
  };

  if (enforcementActive) {
    const escalated = routingBandToRiskLevel(routing.finalRoutingBand);
    if (escalated && riskSeverity(escalated) > riskSeverity(input.baseDecision.level)) {
      decision = {
        ...decision,
        level: escalated,
        reasons: Array.from(new Set([...input.baseDecision.reasons, "phase72_permission_graph_enforced", ...routing.blockingReasons])),
        shouldHandoff: escalated !== "green" ? true : input.baseDecision.shouldHandoff,
        pauseAutopilot: escalated === "yellow" ? true : input.baseDecision.pauseAutopilot,
      };
    }
  }

  const evaluationRecord: PermissionGraphEvaluationRecord = {
    id: crypto.randomUUID(),
    tenantId: input.state.tenant.id,
    conversationId: input.conversationId ?? null,
    messageId: input.messageId ?? null,
    decisionLevel: decision.level,
    graphVersion: routing.graphVersion,
    bridgeVersion: PHASE_76L_PERMISSION_GRAPH_BRIDGE_VERSION,
    mode: permissionGraph.mode,
    finalRoutingBand: routing.finalRoutingBand,
    mixedIntentFailClosed: routing.mixedIntentFailClosed,
    foodRuleIntentIds,
    messageIntentIds,
    triggeredPrivacyGates: routing.triggeredPrivacyGates,
    blockingReasons: routing.blockingReasons,
    status: enforcementActive && decision.level !== input.baseDecision.level ? "enforced" : "evaluated",
    createdAt: new Date().toISOString(),
  };

  return { decision, evaluationRecord };
}

export function appendPermissionGraphEvaluation(
  state: ManuAppState,
  record: PermissionGraphEvaluationRecord | null,
): ManuAppState {
  if (!record) return state;
  return {
    ...state,
    permissionGraphEvaluations: [...(state.permissionGraphEvaluations ?? []), record],
  };
}
