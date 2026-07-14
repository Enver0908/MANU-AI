import { describe, expect, it } from "vitest";
import {
  PHASE_85_STAGE_4B_3_CLOSURE_VERSION,
  STAGE_4B3_ADMISSION_ROUNDTRIP_TARGET,
  STAGE_4B3_CACHED_DECISION_TARGET,
  STAGE_4B3_HARD_ZERO_METRIC_IDS,
  STAGE_4B3_RED_TEAM_CATEGORIES,
  buildStage4B3ClosureEvidencePackMetrics,
  collectStage4B3HardZeroFailures,
  evaluateStage4B3ProgramClosureEvidence,
  loadStage4B3GoldenCorpusCases,
  runStage4B3AdmissionAttackMatrix,
  runStage4B3AdmissionRoundTrips,
  runStage4B3CachedDecisionRehearsal,
  runStage4B3ClosureRehearsalFull,
  runStage4B3ClosureRehearsalSample,
  runStage4B3GoldenCorpusBatch,
  stage4B3ClosureMetricsAreAggregateOnly,
} from "./phase-85-stage-4b3-closure";

const runFullScale = process.env.STAGE_4B3_FULL_SCALE === "1";
const fullScaleIt = runFullScale ? it : it.skip;

describe("phase 85 stage 4b-3 closure", () => {
  it("loads synthetic golden corpus with full red-team category coverage", () => {
    const cases = loadStage4B3GoldenCorpusCases();
    expect(cases.length).toBeGreaterThanOrEqual(12);
    for (const category of STAGE_4B3_RED_TEAM_CATEGORIES) {
      expect(cases.some((entry) => entry.redTeamCategory === category)).toBe(true);
    }
  });

  it("passes golden corpus red-team batch with zero hard-zero failures", () => {
    const metrics = runStage4B3GoldenCorpusBatch();
    expect(metrics.failures).toEqual([]);
    expect(metrics.hardZeroFailures).toEqual([]);
    expect(metrics.redTeamInventory.every((entry) => entry.covered)).toBe(true);
    expect(STAGE_4B3_HARD_ZERO_METRIC_IDS).toHaveLength(13);
  });

  it("collects hard-zero failures when any metric is non-zero", () => {
    const failures = collectStage4B3HardZeroFailures({
      yellow_red_client_send_count: 1,
      unknown_low_confidence_client_send_count: 0,
      supplement_body_lab_client_send_count: 0,
      premature_reply_before_silence_count: 0,
      duplicate_response_count: 0,
      stale_commit_count: 0,
      external_vision_egress_count: 0,
      raw_byte_log_prompt_leak_count: 0,
      cross_tenant_media_read_count: 0,
      public_object_count: 0,
      expired_dsar_orphan_access_count: 0,
      client_facing_ai_ocr_confidence_leak_count: 0,
      absence_of_label_evidence_allowed_count: 0,
    });
    expect(failures).toEqual(["yellow_red_client_send_count"]);
  });

  it("passes sample cached-decision and admission rehearsal", async () => {
    const cached = runStage4B3CachedDecisionRehearsal(250);
    expect(cached.ready).toBe(true);
    expect(cached.executedCount).toBe(250);

    const admission = await runStage4B3AdmissionRoundTrips(24);
    expect(admission.ready).toBe(true);
    expect(admission.successCount).toBe(24);

    const attackMatrix = await runStage4B3AdmissionAttackMatrix();
    expect(attackMatrix.ready).toBe(true);
  });

  it("passes sample closure rehearsal and serializes aggregate-only evidence", async () => {
    const rehearsal = await runStage4B3ClosureRehearsalSample();
    expect(rehearsal.status).toBe("pass");
    expect(rehearsal.cachedDecisionStatus).toBe("sample_only");

    const evidence = buildStage4B3ClosureEvidencePackMetrics({
      goldenCorpus: rehearsal.goldenCorpus,
      cachedDecisionStatus: rehearsal.cachedDecisionStatus,
      admissionRoundTripStatus: rehearsal.admissionRoundTripStatus,
      status: rehearsal.status,
    });
    expect(evidence.phase).toBe(PHASE_85_STAGE_4B_3_CLOSURE_VERSION);
    expect(evidence.production_pilot_go).toBe(false);
    expect(evidence.r405_open).toBe(true);
    expect(stage4B3ClosureMetricsAreAggregateOnly(evidence)).toBe(true);
  });

  it("fails program closure when RLS suite is skipped", async () => {
    const rehearsal = await runStage4B3ClosureRehearsalSample();
    const closure = evaluateStage4B3ProgramClosureEvidence(rehearsal, {
      rlsSuite: "skipped",
      rlsSkippedCount: 21,
      visualSuite: "pass",
      channelReplay: "pass",
      productionScaleRehearsal: "pass",
      phaseEvidenceComplete: true,
    });
    expect(closure.status).toBe("fail");
    expect(closure.stage4cAuthorized).toBe(false);
    expect(closure.failures).toContain("rls_suite_skipped_not_allowed");
  });

  it("authorizes Stage 4C read gate only when verification inputs pass", async () => {
    const rehearsal = await runStage4B3ClosureRehearsalSample();
    const closure = evaluateStage4B3ProgramClosureEvidence(rehearsal, {
      rlsSuite: "pass",
      rlsSkippedCount: 0,
      visualSuite: "pass",
      channelReplay: "pass",
      productionScaleRehearsal: "pass",
      phaseEvidenceComplete: true,
    });
    expect(closure.status).toBe("pass");
    expect(closure.stage4cAuthorized).toBe(true);
    expect(closure.productionPilotGo).toBe(false);
    expect(closure.r405Open).toBe(true);
  });

  fullScaleIt(
    "runs full 5000 cached-decision and 200 admission round-trip closure rehearsal",
    async () => {
      const rehearsal = await runStage4B3ClosureRehearsalFull();
      expect(rehearsal.status).toBe("pass");
      expect(rehearsal.goldenCorpus.cachedDecisionCount).toBe(STAGE_4B3_CACHED_DECISION_TARGET);
      expect(rehearsal.goldenCorpus.admissionRoundTripCount).toBe(STAGE_4B3_ADMISSION_ROUNDTRIP_TARGET);
      expect(rehearsal.cachedDecisionStatus).toBe("pass");
      expect(rehearsal.admissionRoundTripStatus).toBe("pass");
    },
    600_000,
  );
});
