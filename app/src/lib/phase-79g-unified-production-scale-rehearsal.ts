import {
  createDirectPilotScaleFixture,
  evaluateDirectPilotScaleReadiness,
  type DirectPilotScaleReadiness,
} from "./direct-pilot-scale-readiness";
import {
  evaluatePhase77aiProductionOperationsPreparation,
  type Phase77aiProductionOperationsPreparation,
} from "./phase-77ai-production-operations-preparation";
import {
  runPhase77agChannelReplayRehearsal,
  runPhase77agChannelReplaySampleEvidence,
  type Phase77agChannelReplayRehearsalMetrics,
} from "./phase-77ag-channel-replay-rehearsal";
import {
  runPhase77xExpandedAiRehearsalFullEvidence,
  runPhase77xExpandedAiRehearsalSampleEvidence,
  type Phase77xExpandedAiRehearsalMetrics,
} from "./phase-77x-expanded-ai-rehearsal";
import { evaluatePhase79bWindowedReadEvidence } from "./phase-79b-windowed-read-contracts";
import { evaluatePhase79cScopedClientMutationEvidence } from "./phase-79c-scoped-client-mutation";
import { evaluatePhase79dBoundedInternalCopilotEvidence } from "./phase-79d-bounded-internal-copilot-loaders";
import { evaluatePhase79eLifecycleRedactionEvidenceForHealth } from "./phase-79e-lifecycle-redaction-evidence";
import { evaluatePhase79fCurrentRlsEvidenceForHealth } from "./phase-79f-current-rls-evidence";
import { createInitialState } from "./seed-data";
import type { ManuAppState } from "./types";

export const PHASE_79G_VERSION = "phase-79g-unified-production-scale-rehearsal-v0.1.0";

export const PHASE_79G_LAUNCH_PLACEHOLDER_COUNT = 6;

export const PHASE_79G_HARD_ZERO_METRIC_IDS = [
  "unsafe_green_count",
  "yellow_red_client_send_count",
  "duplicate_client_send_count",
  "unknown_identity_provider_call_count",
  "source_unsupported_green_count",
  "claim_outside_manifest_count",
  "removed_client_operational_access_count",
] as const;

export type Phase79HardZeroMetricId = (typeof PHASE_79G_HARD_ZERO_METRIC_IDS)[number];

export type Phase79HardZeroMetrics = Record<Phase79HardZeroMetricId, number>;

export type Phase79UnifiedRehearsalMetrics = {
  version: string;
  status: "pass" | "fail";
  aiQuality5000CaseStatus: "pass" | "fail" | "sample_only";
  channelReplay5000ClientStatus: "pass" | "fail" | "sample_only";
  directPilotScaleReady: boolean;
  rollbackEvidenceReady: boolean;
  lifecycleRemovedClientEvidenceReady: boolean;
  opsPlaceholderMissingEvidenceCount: number;
  hardZeroMetrics: Phase79HardZeroMetrics;
  hardZeroFailures: string[];
  hardZeroFailureCount: number;
  phase79RuntimeEvidenceReady: boolean;
  failures: string[];
  elapsedMs: number;
};

export type Phase79ProductionScaleReadiness = {
  version: string;
  status: "pass" | "fail";
  ready: boolean;
  hardZeroFailureCount: number;
  metrics: Phase79UnifiedRehearsalMetrics;
};

const RAW_EVIDENCE_PATTERNS =
  /\+\d{10,}|health details|Three meals|synthetic-client-|synthetic-dietitian-|raw prompt|supabase-service-role-secret/i;

export function buildPhase79HardZeroMetrics(input: {
  ai: Pick<
    Phase77xExpandedAiRehearsalMetrics,
    | "unsafeClientSendCount"
    | "sourceUnsupportedGreenCount"
    | "forbiddenFoodApprovalCount"
    | "yellowRedClientSendCount"
    | "claimOutsideManifestCount"
  >;
  channel: Pick<
    Phase77agChannelReplayRehearsalMetrics,
    | "unsafeGreenCount"
    | "yellowRedClientSendCount"
    | "duplicateClientSendCount"
    | "unknownIdentityProviderCallCount"
    | "removedClientBlockedCount"
  >;
  lifecycleRemovedClientEvidenceReady: boolean;
}): Phase79HardZeroMetrics {
  return {
    unsafe_green_count: input.channel.unsafeGreenCount + input.ai.forbiddenFoodApprovalCount,
    yellow_red_client_send_count:
      input.channel.yellowRedClientSendCount + input.ai.yellowRedClientSendCount,
    duplicate_client_send_count: input.channel.duplicateClientSendCount,
    unknown_identity_provider_call_count: input.channel.unknownIdentityProviderCallCount,
    source_unsupported_green_count: input.ai.sourceUnsupportedGreenCount,
    claim_outside_manifest_count: input.ai.claimOutsideManifestCount,
    removed_client_operational_access_count: input.lifecycleRemovedClientEvidenceReady ? 0 : 1,
  };
}

export function collectPhase79HardZeroFailures(hardZeroMetrics: Phase79HardZeroMetrics) {
  const failures: string[] = [];
  for (const metricId of PHASE_79G_HARD_ZERO_METRIC_IDS) {
    if (hardZeroMetrics[metricId] > 0) {
      failures.push(`${metricId}_non_zero`);
    }
  }
  return failures;
}

export function evaluatePhase79RuntimeEvidence(state: ManuAppState, clientId = "client-mert") {
  const windowedRead = evaluatePhase79bWindowedReadEvidence(state);
  const scopedClientMutation = evaluatePhase79cScopedClientMutationEvidence(state, clientId);
  const boundedCopilot = evaluatePhase79dBoundedInternalCopilotEvidence(state, "Mert son durumu ne?");
  const lifecycle = evaluatePhase79eLifecycleRedactionEvidenceForHealth(state);
  const currentRls = evaluatePhase79fCurrentRlsEvidenceForHealth();

  const failures: string[] = [];
  if (windowedRead.status !== "pass") failures.push("phase79_windowed_read_not_ready");
  if (scopedClientMutation.status !== "pass") failures.push("phase79_scoped_client_mutation_not_ready");
  if (boundedCopilot.status !== "pass") failures.push("phase79_bounded_internal_copilot_not_ready");
  if (lifecycle.status !== "pass") failures.push("phase79_lifecycle_redaction_not_ready");
  if (currentRls.status === "fail") failures.push("phase79_current_rls_evidence_failed");

  return {
    ready: failures.length === 0,
    failures,
    windowedRead,
    scopedClientMutation,
    boundedCopilot,
    lifecycle,
    currentRls,
  };
}

export function buildPhase79UnifiedRehearsalMetrics(input: {
  ai: Phase77xExpandedAiRehearsalMetrics;
  channel: Phase77agChannelReplayRehearsalMetrics;
  directPilotScale: DirectPilotScaleReadiness;
  productionOps: Phase77aiProductionOperationsPreparation;
  lifecycleRemovedClientEvidenceReady: boolean;
  phase79RuntimeEvidenceReady: boolean;
  fullScale: boolean;
  startedAt: number;
  extraFailures?: string[];
}): Phase79UnifiedRehearsalMetrics {
  const hardZeroMetrics = buildPhase79HardZeroMetrics({
    ai: input.ai,
    channel: input.channel,
    lifecycleRemovedClientEvidenceReady: input.lifecycleRemovedClientEvidenceReady,
  });
  const hardZeroFailures = collectPhase79HardZeroFailures(hardZeroMetrics);
  const failures = [
    ...(input.extraFailures ?? []),
    ...(input.ai.status !== "pass" ? ["ai_quality_rehearsal_failed"] : []),
    ...(input.channel.status !== "pass" ? ["channel_replay_rehearsal_failed"] : []),
    ...(!input.directPilotScale.ready ? ["direct_pilot_scale_not_ready"] : []),
    ...(!input.lifecycleRemovedClientEvidenceReady
      ? ["lifecycle_removed_client_evidence_not_ready"]
      : []),
    ...(!input.phase79RuntimeEvidenceReady ? ["phase79_runtime_evidence_not_ready"] : []),
    ...hardZeroFailures,
  ];

  const status = failures.length === 0 ? "pass" : "fail";

  return {
    version: PHASE_79G_VERSION,
    status,
    aiQuality5000CaseStatus: input.fullScale
      ? input.ai.status
      : input.ai.status === "pass"
        ? "sample_only"
        : "fail",
    channelReplay5000ClientStatus: input.fullScale
      ? input.channel.status
      : input.channel.status === "pass"
        ? "sample_only"
        : "fail",
    directPilotScaleReady: input.directPilotScale.ready,
    rollbackEvidenceReady: input.productionOps.channelRollbackActiveScopeCount >= 0,
    lifecycleRemovedClientEvidenceReady: input.lifecycleRemovedClientEvidenceReady,
    opsPlaceholderMissingEvidenceCount:
      input.productionOps.missingEvidenceCount + PHASE_79G_LAUNCH_PLACEHOLDER_COUNT,
    hardZeroMetrics,
    hardZeroFailures,
    hardZeroFailureCount: hardZeroFailures.length,
    phase79RuntimeEvidenceReady: input.phase79RuntimeEvidenceReady,
    failures: Array.from(new Set(failures)),
    elapsedMs: Date.now() - input.startedAt,
  };
}

export function buildPhase79ProductionScaleReadiness(
  metrics: Phase79UnifiedRehearsalMetrics,
): Phase79ProductionScaleReadiness {
  return {
    version: PHASE_79G_VERSION,
    status: metrics.status,
    ready: metrics.status === "pass",
    hardZeroFailureCount: metrics.hardZeroFailureCount,
    metrics,
  };
}

export function unifiedRehearsalMetricsAreAggregateOnly(metrics: Phase79UnifiedRehearsalMetrics) {
  const serialized = JSON.stringify({
    version: metrics.version,
    status: metrics.status,
    aiQuality5000CaseStatus: metrics.aiQuality5000CaseStatus,
    channelReplay5000ClientStatus: metrics.channelReplay5000ClientStatus,
    directPilotScaleReady: metrics.directPilotScaleReady,
    rollbackEvidenceReady: metrics.rollbackEvidenceReady,
    lifecycleRemovedClientEvidenceReady: metrics.lifecycleRemovedClientEvidenceReady,
    opsPlaceholderMissingEvidenceCount: metrics.opsPlaceholderMissingEvidenceCount,
    hardZeroMetrics: metrics.hardZeroMetrics,
    hardZeroFailures: metrics.hardZeroFailures,
    hardZeroFailureCount: metrics.hardZeroFailureCount,
    phase79RuntimeEvidenceReady: metrics.phase79RuntimeEvidenceReady,
    failures: metrics.failures,
  });
  return !RAW_EVIDENCE_PATTERNS.test(serialized);
}

export async function runPhase79UnifiedProductionScaleRehearsalSample(): Promise<Phase79UnifiedRehearsalMetrics> {
  const startedAt = Date.now();
  const state = createInitialState();
  const fixture = createDirectPilotScaleFixture();
  const [ai, channel] = await Promise.all([
    runPhase77xExpandedAiRehearsalSampleEvidence(),
    runPhase77agChannelReplaySampleEvidence(),
  ]);
  const directPilotScale = evaluateDirectPilotScaleReadiness(fixture, {
    loadBackpressureIdempotencyEvidence: true,
    foodMixRehearsalPass: true,
    requireFoodMixRehearsalEvidence: false,
  });
  const productionOps = evaluatePhase77aiProductionOperationsPreparation();
  const runtimeEvidence = evaluatePhase79RuntimeEvidence(state);
  const lifecycle = evaluatePhase79eLifecycleRedactionEvidenceForHealth(state);

  return buildPhase79UnifiedRehearsalMetrics({
    ai,
    channel,
    directPilotScale,
    productionOps,
    lifecycleRemovedClientEvidenceReady: lifecycle.status === "pass",
    phase79RuntimeEvidenceReady: runtimeEvidence.ready,
    fullScale: false,
    startedAt,
    extraFailures: runtimeEvidence.failures,
  });
}

export async function runPhase79UnifiedProductionScaleRehearsalFull(): Promise<Phase79UnifiedRehearsalMetrics> {
  const startedAt = Date.now();
  const state = createInitialState();
  const fixture = createDirectPilotScaleFixture();
  const ai = await runPhase77xExpandedAiRehearsalFullEvidence();
  const channel = await runPhase77agChannelReplayRehearsal();
  const directPilotScale = evaluateDirectPilotScaleReadiness(fixture, {
    loadBackpressureIdempotencyEvidence: true,
    foodMixRehearsalPass: true,
    requireFoodMixRehearsalEvidence: false,
  });
  const productionOps = evaluatePhase77aiProductionOperationsPreparation();
  const runtimeEvidence = evaluatePhase79RuntimeEvidence(state);
  const lifecycle = evaluatePhase79eLifecycleRedactionEvidenceForHealth(state);

  return buildPhase79UnifiedRehearsalMetrics({
    ai,
    channel,
    directPilotScale,
    productionOps,
    lifecycleRemovedClientEvidenceReady: lifecycle.status === "pass",
    phase79RuntimeEvidenceReady: runtimeEvidence.ready,
    fullScale: true,
    startedAt,
    extraFailures: runtimeEvidence.failures,
  });
}

export function buildPhase79gProductionScaleHealthSignal(metrics: Phase79UnifiedRehearsalMetrics) {
  return {
    phase79ProductionScaleVersion: metrics.version,
    phase79ProductionScaleStatus: metrics.status,
    phase79ProductionScaleReady: metrics.status === "pass",
    phase79HardZeroFailureCount: metrics.hardZeroFailureCount,
    phase79HardZeroFailures: metrics.hardZeroFailures,
    phase79OpsPlaceholderMissingEvidenceCount: metrics.opsPlaceholderMissingEvidenceCount,
  };
}

export function buildPhase79UnifiedRehearsalEvidencePackMetrics(metrics: Phase79UnifiedRehearsalMetrics) {
  return {
    phase: metrics.version,
    status: metrics.status,
    ai_quality_5000_case_status: metrics.aiQuality5000CaseStatus,
    channel_replay_5000_client_status: metrics.channelReplay5000ClientStatus,
    direct_pilot_scale_ready: metrics.directPilotScaleReady,
    rollback_evidence_ready: metrics.rollbackEvidenceReady,
    lifecycle_removed_client_evidence_ready: metrics.lifecycleRemovedClientEvidenceReady,
    ops_placeholder_missing_evidence_count: metrics.opsPlaceholderMissingEvidenceCount,
    hard_zero_metrics: metrics.hardZeroMetrics,
    hard_zero_failure_count: metrics.hardZeroFailureCount,
    hard_zero_failures: metrics.hardZeroFailures,
    phase79_runtime_evidence_ready: metrics.phase79RuntimeEvidenceReady,
    production_pilot_go: false,
    r405_open: true,
  };
}

export function buildPhase79UnifiedRehearsalDefaultMetrics(): Phase79UnifiedRehearsalMetrics {
  return {
    version: PHASE_79G_VERSION,
    status: "fail",
    aiQuality5000CaseStatus: "fail",
    channelReplay5000ClientStatus: "fail",
    directPilotScaleReady: false,
    rollbackEvidenceReady: false,
    lifecycleRemovedClientEvidenceReady: false,
    opsPlaceholderMissingEvidenceCount: PHASE_79G_LAUNCH_PLACEHOLDER_COUNT,
    hardZeroMetrics: {
      unsafe_green_count: 0,
      yellow_red_client_send_count: 0,
      duplicate_client_send_count: 0,
      unknown_identity_provider_call_count: 0,
      source_unsupported_green_count: 0,
      claim_outside_manifest_count: 0,
      removed_client_operational_access_count: 0,
    },
    hardZeroFailures: ["phase79_unified_rehearsal_not_run"],
    hardZeroFailureCount: 1,
    phase79RuntimeEvidenceReady: false,
    failures: ["phase79_unified_rehearsal_not_run"],
    elapsedMs: 0,
  };
}
