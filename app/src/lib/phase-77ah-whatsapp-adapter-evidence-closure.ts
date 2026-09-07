import { evaluateProductionPilotLaunchGates } from "./launch-gates";
import {
  PHASE_77AG_CHANNEL_REPLAY_REHEARSAL_VERSION,
  runPhase77agChannelReplaySampleEvidence,
} from "./phase-77ag-channel-replay-rehearsal";

export const PHASE_77AH_WHATSAPP_ADAPTER_EVIDENCE_CLOSURE_VERSION =
  "phase-77ah-whatsapp-adapter-evidence-closure-v1";

export const WHATSAPP_ADAPTER_TRACK_PHASE_MANIFEST = [
  {
    phaseId: "77AA",
    specId: "PHASE_77AA_WHATSAPP_MOCK_GATED_ADAPTER_PRD_AND_SCOPE_LOCK_SPEC",
    version: "phase-77aa-whatsapp-mock-gated-adapter-prd-v1",
  },
  {
    phaseId: "77AB",
    specId: "PHASE_77AB_WHATSAPP_CLOUD_PAYLOAD_NORMALIZATION_SPEC",
    version: "phase-77ab-whatsapp-cloud-payload-normalization-v1",
  },
  {
    phaseId: "77AC",
    specId: "PHASE_77AC_DISABLED_WEBHOOK_BOUNDARY_AND_IDENTITY_QUARANTINE_SPEC",
    version: "phase-77ac-disabled-webhook-boundary-v1",
  },
  {
    phaseId: "77AD",
    specId: "PHASE_77AD_OPT_OUT_SERVICE_WINDOW_TEMPLATE_POLICY_MOCK_SPEC",
    version: "phase-77ad-whatsapp-channel-policy-mock-v1",
  },
  {
    phaseId: "77AE",
    specId: "PHASE_77AE_OUTBOUND_DELIVERY_LEDGER_AND_MOCK_SEND_FAILURES_SPEC",
    version: "phase-77ae-outbound-delivery-ledger-v1",
  },
  {
    phaseId: "77AF",
    specId: "PHASE_77AF_ADAPTER_OPERATIONAL_HEALTH_AND_ROLLBACK_CONTROLS_SPEC",
    version: "phase-77af-adapter-operational-health-rollback-v1",
  },
  {
    phaseId: "77AG",
    specId: "PHASE_77AG_100X50_WHATSAPP_LIKE_CHANNEL_REPLAY_REHEARSAL_SPEC",
    version: PHASE_77AG_CHANNEL_REPLAY_REHEARSAL_VERSION,
  },
] as const;

export type Phase77ahWhatsappAdapterEvidenceClosure = {
  closureVersion: string;
  status: "pass" | "fail";
  whatsappAdapterTrackClosed: boolean;
  productionOperationsNext: boolean;
  productionPilotGo: false;
  r405Open: true;
  channelPolicyGateOpen: boolean;
  openLaunchGateCount: number;
  realWhatsAppConnected: false;
  realZaiConnected: false;
  channelReplayStatus: "pass" | "fail";
  channelReplayVersion: string;
  duplicateClientSendCount: number;
  unknownIdentityProviderCallCount: number;
  yellowRedClientSendCount: number;
  unsafeGreenCount: number;
  duplicateIgnoredCount: number;
  quarantineCount: number;
  providerFailureHandoffCount: number;
  staleDraftInvalidatedCount: number;
  completedTrackPhaseCount: number;
  hardZeroFailures: string[];
  failures: string[];
};

export async function evaluatePhase77ahWhatsappAdapterEvidenceClosure(): Promise<Phase77ahWhatsappAdapterEvidenceClosure> {
  const channelReplay = await runPhase77agChannelReplaySampleEvidence();
  const launchGates = evaluateProductionPilotLaunchGates();
  const failures: string[] = [];

  if (channelReplay.status !== "pass") failures.push("channel_replay_sample_failed");
  if (channelReplay.duplicateClientSendCount > 0) failures.push("duplicate_client_send_detected");
  if (channelReplay.unknownIdentityProviderCallCount > 0) {
    failures.push("unknown_identity_provider_call_detected");
  }
  if (channelReplay.yellowRedClientSendCount > 0) failures.push("yellow_red_client_send_detected");
  if (channelReplay.unsafeGreenCount > 0) failures.push("unsafe_green_detected");
  if (!launchGates.blocked) failures.push("launch_gates_not_blocked");
  if (!launchGates.openGateIds.includes("channel_policy_review")) {
    failures.push("channel_policy_gate_not_open");
  }
  if (WHATSAPP_ADAPTER_TRACK_PHASE_MANIFEST.length !== 7) {
    failures.push("adapter_track_manifest_incomplete");
  }

  const hardZeroFailures = [
    ...(channelReplay.duplicateClientSendCount > 0 ? ["duplicate_client_send_detected"] : []),
    ...(channelReplay.unknownIdentityProviderCallCount > 0
      ? ["unknown_identity_provider_call_detected"]
      : []),
    ...(channelReplay.yellowRedClientSendCount > 0 ? ["yellow_red_client_send_detected"] : []),
    ...(channelReplay.unsafeGreenCount > 0 ? ["unsafe_green_detected"] : []),
  ];

  const status = failures.length === 0 ? "pass" : "fail";

  return {
    closureVersion: PHASE_77AH_WHATSAPP_ADAPTER_EVIDENCE_CLOSURE_VERSION,
    status,
    whatsappAdapterTrackClosed: status === "pass",
    productionOperationsNext: status === "pass",
    productionPilotGo: false,
    r405Open: true,
    channelPolicyGateOpen: launchGates.openGateIds.includes("channel_policy_review"),
    openLaunchGateCount: launchGates.openGateIds.length,
    realWhatsAppConnected: false,
    realZaiConnected: false,
    channelReplayStatus: channelReplay.status,
    channelReplayVersion: channelReplay.rehearsalVersion,
    duplicateClientSendCount: channelReplay.duplicateClientSendCount,
    unknownIdentityProviderCallCount: channelReplay.unknownIdentityProviderCallCount,
    yellowRedClientSendCount: channelReplay.yellowRedClientSendCount,
    unsafeGreenCount: channelReplay.unsafeGreenCount,
    duplicateIgnoredCount: channelReplay.duplicateIgnoredCount,
    quarantineCount: channelReplay.quarantineCount,
    providerFailureHandoffCount: channelReplay.providerFailureHandoffCount,
    staleDraftInvalidatedCount: channelReplay.staleDraftInvalidatedCount,
    completedTrackPhaseCount: WHATSAPP_ADAPTER_TRACK_PHASE_MANIFEST.length,
    hardZeroFailures,
    failures: Array.from(new Set([...failures, ...hardZeroFailures])),
  };
}

export function buildPhase77ahWhatsappAdapterEvidencePackMetrics(
  closure: Phase77ahWhatsappAdapterEvidenceClosure,
) {
  return {
    phase: PHASE_77AH_WHATSAPP_ADAPTER_EVIDENCE_CLOSURE_VERSION,
    status: closure.status,
    whatsapp_adapter_track_closed: closure.whatsappAdapterTrackClosed,
    production_operations_next: closure.productionOperationsNext,
    production_pilot_go: closure.productionPilotGo,
    r405_open: closure.r405Open,
    channel_policy_gate_open: closure.channelPolicyGateOpen,
    open_launch_gate_count: closure.openLaunchGateCount,
    real_whatsapp_connected: closure.realWhatsAppConnected,
    real_zai_connected: closure.realZaiConnected,
    channel_replay_status: closure.channelReplayStatus,
    channel_replay_version: closure.channelReplayVersion,
    duplicate_client_send_count: closure.duplicateClientSendCount,
    unknown_identity_provider_call_count: closure.unknownIdentityProviderCallCount,
    yellow_red_client_send_count: closure.yellowRedClientSendCount,
    unsafe_green_count: closure.unsafeGreenCount,
    duplicate_ignored_count: closure.duplicateIgnoredCount,
    quarantine_count: closure.quarantineCount,
    provider_failure_handoff_count: closure.providerFailureHandoffCount,
    stale_draft_invalidated_count: closure.staleDraftInvalidatedCount,
    completed_track_phase_count: closure.completedTrackPhaseCount,
    hard_zero_failures: closure.hardZeroFailures,
  };
}
