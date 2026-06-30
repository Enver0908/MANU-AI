import { describe, expect, it } from "vitest";
import {
  EXPANDED_REHEARSAL_CLIENT_COUNT,
  EXPANDED_REHEARSAL_MESSAGES_PER_CLIENT,
  EXPANDED_REHEARSAL_TARGET_COUNT,
} from "dietitian-ai-assistant-architecture";
import { createDirectPilotScaleFixture } from "./direct-pilot-scale-readiness";
import { buildOperationalHealthSnapshot } from "./operational-health";
import {
  PHASE_79G_HARD_ZERO_METRIC_IDS,
  PHASE_79G_LAUNCH_PLACEHOLDER_COUNT,
  PHASE_79G_VERSION,
  buildPhase79HardZeroMetrics,
  buildPhase79ProductionScaleReadiness,
  buildPhase79UnifiedRehearsalEvidencePackMetrics,
  collectPhase79HardZeroFailures,
  evaluatePhase79RuntimeEvidence,
  runPhase79UnifiedProductionScaleRehearsalFull,
  runPhase79UnifiedProductionScaleRehearsalSample,
  unifiedRehearsalMetricsAreAggregateOnly,
} from "./phase-79g-unified-production-scale-rehearsal";
import { createInitialState } from "./seed-data";

const runFullRehearsal = process.env.PHASE_79G_FULL_REHEARSAL === "1";
const fullRehearsalIt = runFullRehearsal ? it : it.skip;

describe("phase 79g unified production-scale rehearsal", () => {
  it("evaluates Phase 79 runtime evidence on seed state", () => {
    const evidence = evaluatePhase79RuntimeEvidence(createInitialState());
    expect(evidence.ready).toBe(true);
    expect(evidence.failures).toEqual([]);
  });

  it("collects hard-zero failures when any metric is non-zero", () => {
    const hardZeroMetrics = buildPhase79HardZeroMetrics({
      ai: {
        unsafeClientSendCount: 0,
        sourceUnsupportedGreenCount: 1,
        forbiddenFoodApprovalCount: 0,
        yellowRedClientSendCount: 0,
        claimOutsideManifestCount: 0,
      },
      channel: {
        unsafeGreenCount: 0,
        yellowRedClientSendCount: 0,
        duplicateClientSendCount: 0,
        unknownIdentityProviderCallCount: 0,
        removedClientBlockedCount: 1,
      },
      lifecycleRemovedClientEvidenceReady: true,
    });

    expect(hardZeroMetrics.source_unsupported_green_count).toBe(1);
    expect(collectPhase79HardZeroFailures(hardZeroMetrics)).toEqual(["source_unsupported_green_count_non_zero"]);
    expect(PHASE_79G_HARD_ZERO_METRIC_IDS).toHaveLength(7);
  });

  it("passes sample unified rehearsal with hard-zero safety metrics", async () => {
    const metrics = await runPhase79UnifiedProductionScaleRehearsalSample();
    const readiness = buildPhase79ProductionScaleReadiness(metrics);

    expect(metrics.status).toBe("pass");
    expect(readiness.ready).toBe(true);
    expect(metrics.hardZeroFailureCount).toBe(0);
    expect(metrics.hardZeroFailures).toEqual([]);
    expect(metrics.directPilotScaleReady).toBe(true);
    expect(metrics.lifecycleRemovedClientEvidenceReady).toBe(true);
    expect(metrics.phase79RuntimeEvidenceReady).toBe(true);
    expect(metrics.aiQuality5000CaseStatus).toBe("sample_only");
    expect(metrics.channelReplay5000ClientStatus).toBe("sample_only");
    expect(metrics.opsPlaceholderMissingEvidenceCount).toBeGreaterThanOrEqual(
      PHASE_79G_LAUNCH_PLACEHOLDER_COUNT,
    );
    expect(createDirectPilotScaleFixture().clients).toHaveLength(5000);
  });

  it("serializes unified evidence without raw health or roster content", async () => {
    const metrics = await runPhase79UnifiedProductionScaleRehearsalSample();
    const evidence = buildPhase79UnifiedRehearsalEvidencePackMetrics(metrics);
    const json = JSON.stringify(evidence);

    expect(evidence.phase).toBe(PHASE_79G_VERSION);
    expect(evidence.production_pilot_go).toBe(false);
    expect(evidence.r405_open).toBe(true);
    expect(unifiedRehearsalMetricsAreAggregateOnly(metrics)).toBe(true);
    expect(json).not.toContain("synthetic-client-");
    expect(json).not.toContain("+9055");
    expect(json).not.toContain("health details");
  });

  it("records aggregate production-scale fields on operational health", async () => {
    const metrics = await runPhase79UnifiedProductionScaleRehearsalSample();
    const snapshot = buildOperationalHealthSnapshot(createInitialState(), {
      phase79UnifiedRehearsalMetrics: metrics,
    });

    expect(snapshot.phase79ProductionScaleStatus).toBe("pass");
    expect(snapshot.phase79ProductionScaleReady).toBe(true);
    expect(snapshot.phase79HardZeroFailureCount).toBe(0);
  });

  fullRehearsalIt(
    "runs the full unified 100x50 production-scale acceptance rehearsal",
    async () => {
      const metrics = await runPhase79UnifiedProductionScaleRehearsalFull();

      expect(metrics.status).toBe("pass");
      expect(metrics.hardZeroFailures).toEqual([]);
      expect(metrics.aiQuality5000CaseStatus).toBe("pass");
      expect(metrics.channelReplay5000ClientStatus).toBe("pass");
      expect(metrics.hardZeroMetrics.unsafe_green_count).toBe(0);
      expect(metrics.hardZeroMetrics.yellow_red_client_send_count).toBe(0);
      expect(metrics.hardZeroMetrics.duplicate_client_send_count).toBe(0);
      expect(metrics.hardZeroMetrics.unknown_identity_provider_call_count).toBe(0);
      expect(metrics.hardZeroMetrics.source_unsupported_green_count).toBe(0);
      expect(metrics.hardZeroMetrics.claim_outside_manifest_count).toBe(0);
      expect(metrics.hardZeroMetrics.removed_client_operational_access_count).toBe(0);
    },
    600_000,
  );

  fullRehearsalIt(
    "covers the 5,000 client AI quality target in full rehearsal mode",
    async () => {
      const metrics = await runPhase79UnifiedProductionScaleRehearsalFull();
      expect(EXPANDED_REHEARSAL_CLIENT_COUNT).toBe(100);
      expect(EXPANDED_REHEARSAL_MESSAGES_PER_CLIENT).toBe(50);
      expect(EXPANDED_REHEARSAL_TARGET_COUNT).toBe(5000);
      expect(metrics.aiQuality5000CaseStatus).toBe("pass");
    },
    600_000,
  );
});
