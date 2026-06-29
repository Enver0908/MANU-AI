import { countActiveChannelAdapterRollbackScopes } from "./channel-adapter-rollback";
import {
  PRODUCTION_PILOT_LAUNCH_GATES,
  evaluateProductionPilotLaunchGates,
  type LaunchGateId,
} from "./launch-gates";
import { buildNotificationSlaSnapshot } from "./notification-sla";
import { buildOperationalHealthSnapshot } from "./operational-health";
import { createInitialState } from "./seed-data";

export const PHASE_77AI_PRODUCTION_OPERATIONS_PREPARATION_VERSION =
  "phase-77ai-production-operations-preparation-v1";

export const PRODUCTION_OPERATIONS_LAUNCH_GATE_IDS = [
  "incident_response_runbook",
  "backup_restore_test",
  "secret_rotation_plan",
] as const satisfies readonly LaunchGateId[];

export type ProductionOperationsLaunchGateId = (typeof PRODUCTION_OPERATIONS_LAUNCH_GATE_IDS)[number];

export type ProductionOperationsPlaceholderCandidate = {
  placeholderId: string;
  category:
    | "incident_owner"
    | "sla"
    | "monitoring"
    | "rollback"
    | "dsar"
    | "backup_restore"
    | "secret_rotation";
  gateId: ProductionOperationsLaunchGateId;
  runbookRef: string;
  reviewPacketRef: string;
  internalMockControl: string;
  externalEvidenceKeys: string[];
};

export const PRODUCTION_OPERATIONS_PLACEHOLDER_MANIFEST: ProductionOperationsPlaceholderCandidate[] = [
  {
    placeholderId: "incident_commander_placeholder",
    category: "incident_owner",
    gateId: "incident_response_runbook",
    runbookRef: "docs/INCIDENT_RESPONSE_RUNBOOK.md",
    reviewPacketRef: "docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md",
    internalMockControl: "notification_sla_snapshot",
    externalEvidenceKeys: [
      "incident response runbook",
      "breach escalation owner list",
      "client deletion and export operating procedure",
    ],
  },
  {
    placeholderId: "handoff_sla_placeholder",
    category: "sla",
    gateId: "incident_response_runbook",
    runbookRef: "docs/INCIDENT_RESPONSE_RUNBOOK.md",
    reviewPacketRef: "docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md",
    internalMockControl: "notification_sla_breach_counters",
    externalEvidenceKeys: ["incident response runbook"],
  },
  {
    placeholderId: "aggregate_monitoring_placeholder",
    category: "monitoring",
    gateId: "incident_response_runbook",
    runbookRef: "docs/INCIDENT_RESPONSE_RUNBOOK.md",
    reviewPacketRef: "docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md",
    internalMockControl: "operational_health_snapshot",
    externalEvidenceKeys: ["incident response runbook"],
  },
  {
    placeholderId: "channel_automation_rollback_placeholder",
    category: "rollback",
    gateId: "incident_response_runbook",
    runbookRef: "docs/INCIDENT_RESPONSE_RUNBOOK.md",
    reviewPacketRef: "docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md",
    internalMockControl: "channel_adapter_rollback_controls",
    externalEvidenceKeys: ["incident response runbook"],
  },
  {
    placeholderId: "dsar_export_anonymization_placeholder",
    category: "dsar",
    gateId: "incident_response_runbook",
    runbookRef: "docs/INCIDENT_RESPONSE_RUNBOOK.md",
    reviewPacketRef: "docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md",
    internalMockControl: "phase_74_export_and_dsar_redaction",
    externalEvidenceKeys: ["client deletion and export operating procedure"],
  },
  {
    placeholderId: "backup_restore_drill_placeholder",
    category: "backup_restore",
    gateId: "backup_restore_test",
    runbookRef: "docs/BACKUP_RESTORE_RUNBOOK.md",
    reviewPacketRef: "docs/PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md",
    internalMockControl: "operational_health_snapshot",
    externalEvidenceKeys: ["backup expiry policy", "restore drill result", "restore owner and cadence"],
  },
  {
    placeholderId: "secret_rotation_inventory_placeholder",
    category: "secret_rotation",
    gateId: "secret_rotation_plan",
    runbookRef: "docs/SECRET_ROTATION_RUNBOOK.md",
    reviewPacketRef: "docs/PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md",
    internalMockControl: "operational_health_snapshot",
    externalEvidenceKeys: ["secret inventory", "rotation cadence", "emergency revocation procedure"],
  },
];

export type Phase77aiProductionOperationsPreparation = {
  preparationVersion: string;
  status: "pass" | "fail";
  productionOpsPrepared: boolean;
  productionPilotGo: false;
  r405Open: true;
  realMonitoringConnected: false;
  realSecretManagerConnected: false;
  opsLaunchGatesOpen: boolean;
  openOpsLaunchGateIds: ProductionOperationsLaunchGateId[];
  openOpsLaunchGateCount: number;
  placeholderCandidateCount: number;
  internalMockControlCount: number;
  missingEvidenceByGate: Record<ProductionOperationsLaunchGateId, string[]>;
  missingEvidenceCount: number;
  missingEvidenceList: string[];
  notificationSlaBreachedCount: number;
  channelRollbackActiveScopeCount: number;
  operationalHealthLaunchBlocked: boolean;
  failures: string[];
};

function collectMissingEvidenceByGate(): Record<ProductionOperationsLaunchGateId, string[]> {
  const missing: Record<ProductionOperationsLaunchGateId, string[]> = {
    incident_response_runbook: [],
    backup_restore_test: [],
    secret_rotation_plan: [],
  };

  for (const gateId of PRODUCTION_OPERATIONS_LAUNCH_GATE_IDS) {
    const gate = PRODUCTION_PILOT_LAUNCH_GATES.find((item) => item.id === gateId);
    missing[gateId] = gate ? [...gate.requiredEvidence] : [];
  }

  return missing;
}

export function evaluatePhase77aiProductionOperationsPreparation(
  options: { now?: string } = {},
): Phase77aiProductionOperationsPreparation {
  const launchGates = evaluateProductionPilotLaunchGates();
  const state = createInitialState();
  const notificationSla = buildNotificationSlaSnapshot(
    { notifications: state.notifications, handoffCases: state.handoffCases },
    { now: options.now },
  );
  const operationalHealth = buildOperationalHealthSnapshot(state, { now: options.now });
  const missingEvidenceByGate = collectMissingEvidenceByGate();
  const missingEvidenceList = PRODUCTION_OPERATIONS_LAUNCH_GATE_IDS.flatMap(
    (gateId) => missingEvidenceByGate[gateId].map((item) => `${gateId}:${item}`),
  );
  const internalMockControls = new Set(
    PRODUCTION_OPERATIONS_PLACEHOLDER_MANIFEST.map((candidate) => candidate.internalMockControl),
  );

  const openOpsLaunchGateIds = PRODUCTION_OPERATIONS_LAUNCH_GATE_IDS.filter((gateId) =>
    launchGates.openGateIds.includes(gateId),
  );
  const failures: string[] = [];

  if (!launchGates.blocked) failures.push("launch_gates_not_blocked");
  if (openOpsLaunchGateIds.length !== PRODUCTION_OPERATIONS_LAUNCH_GATE_IDS.length) {
    failures.push("ops_launch_gate_not_open");
  }
  if (PRODUCTION_OPERATIONS_PLACEHOLDER_MANIFEST.length < 7) {
    failures.push("placeholder_manifest_incomplete");
  }
  if (internalMockControls.size < 5) failures.push("internal_mock_controls_incomplete");
  if (missingEvidenceList.length === 0) failures.push("missing_evidence_list_empty");

  for (const gateId of PRODUCTION_OPERATIONS_LAUNCH_GATE_IDS) {
    if (missingEvidenceByGate[gateId].length === 0) {
      failures.push(`missing_evidence_not_listed_for_${gateId}`);
    }
  }

  const status = failures.length === 0 ? "pass" : "fail";

  return {
    preparationVersion: PHASE_77AI_PRODUCTION_OPERATIONS_PREPARATION_VERSION,
    status,
    productionOpsPrepared: status === "pass",
    productionPilotGo: false,
    r405Open: true,
    realMonitoringConnected: false,
    realSecretManagerConnected: false,
    opsLaunchGatesOpen: openOpsLaunchGateIds.length === PRODUCTION_OPERATIONS_LAUNCH_GATE_IDS.length,
    openOpsLaunchGateIds,
    openOpsLaunchGateCount: openOpsLaunchGateIds.length,
    placeholderCandidateCount: PRODUCTION_OPERATIONS_PLACEHOLDER_MANIFEST.length,
    internalMockControlCount: internalMockControls.size,
    missingEvidenceByGate,
    missingEvidenceCount: missingEvidenceList.length,
    missingEvidenceList,
    notificationSlaBreachedCount: notificationSla.breachedNotificationCount,
    channelRollbackActiveScopeCount: countActiveChannelAdapterRollbackScopes(state.channelAdapterRollback),
    operationalHealthLaunchBlocked: operationalHealth.launchBlocked,
    failures,
  };
}

export function buildPhase77aiProductionOperationsEvidencePackMetrics(
  preparation: Phase77aiProductionOperationsPreparation,
) {
  return {
    phase: preparation.preparationVersion,
    status: preparation.status,
    production_ops_prepared: preparation.productionOpsPrepared,
    production_pilot_go: preparation.productionPilotGo,
    r405_open: preparation.r405Open,
    real_monitoring_connected: preparation.realMonitoringConnected,
    real_secret_manager_connected: preparation.realSecretManagerConnected,
    ops_launch_gates_open: preparation.opsLaunchGatesOpen,
    open_ops_launch_gate_count: preparation.openOpsLaunchGateCount,
    placeholder_candidate_count: preparation.placeholderCandidateCount,
    internal_mock_control_count: preparation.internalMockControlCount,
    missing_evidence_count: preparation.missingEvidenceCount,
    missing_evidence_list: preparation.missingEvidenceList,
    notification_sla_breached_count: preparation.notificationSlaBreachedCount,
    channel_rollback_active_scope_count: preparation.channelRollbackActiveScopeCount,
    operational_health_launch_blocked: preparation.operationalHealthLaunchBlocked,
  };
}

export function buildPhase77aiProductionOpsHealthSignal(
  preparation: Phase77aiProductionOperationsPreparation = buildPhase77aiProductionOpsDefaultPreparation(),
) {
  return {
    productionOpsPreparationVersion: preparation.preparationVersion,
    productionOpsPreparationStatus: preparation.status,
    productionOpsOpenGateCount: preparation.openOpsLaunchGateCount,
    productionOpsMissingEvidenceCount: preparation.missingEvidenceCount,
    productionOpsPlaceholderCandidateCount: preparation.placeholderCandidateCount,
    productionOpsInternalMockControlCount: preparation.internalMockControlCount,
    productionOpsLaunchGatesOpen: preparation.opsLaunchGatesOpen,
  };
}

export function buildPhase77aiProductionOpsDefaultPreparation(): Phase77aiProductionOperationsPreparation {
  return {
    preparationVersion: PHASE_77AI_PRODUCTION_OPERATIONS_PREPARATION_VERSION,
    status: "fail",
    productionOpsPrepared: false,
    productionPilotGo: false,
    r405Open: true,
    realMonitoringConnected: false,
    realSecretManagerConnected: false,
    opsLaunchGatesOpen: false,
    openOpsLaunchGateIds: [],
    openOpsLaunchGateCount: 0,
    placeholderCandidateCount: 0,
    internalMockControlCount: 0,
    missingEvidenceByGate: {
      incident_response_runbook: [],
      backup_restore_test: [],
      secret_rotation_plan: [],
    },
    missingEvidenceCount: 0,
    missingEvidenceList: [],
    notificationSlaBreachedCount: 0,
    channelRollbackActiveScopeCount: 0,
    operationalHealthLaunchBlocked: true,
    failures: ["production_ops_preparation_not_run"],
  };
}
