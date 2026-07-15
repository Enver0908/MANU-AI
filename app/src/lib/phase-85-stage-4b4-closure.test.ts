import { describe, expect, it } from "vitest";
import {
  PHASE_85_STAGE_4B_4_CLOSURE_VERSION,
  STAGE_4B4_ADMISSION_ROUNDTRIP_TARGET,
  STAGE_4B4_CACHED_DECISION_TARGET,
  STAGE_4B4_HARD_ZERO_METRIC_IDS,
  buildStage4B4ClosureEvidencePackMetrics,
  collectStage4B4HardZeroFailures,
  evaluateStage4B4ProgramClosureEvidence,
  loadStage4B4GoldenCorpusCases,
  runStage4B4AdmissionRoundTrips,
  runStage4B4CachedDecisionRehearsal,
  runStage4B4ClosureRehearsalFull,
  runStage4B4ClosureRehearsalSample,
  runStage4B4GoldenCorpusBatch,
  stage4B4ClosureMetricsAreAggregateOnly,
  syncStage4B4GoldenCorpusJsonl,
} from "./phase-85-stage-4b4-closure";
import {
  STAGE_4B4_GOLDEN_CORPUS_MIN_CASES,
  STAGE_4B4_RED_TEAM_CATEGORIES,
  buildStage4B4GoldenCorpusCases,
} from "./phase-85-stage-4b4-golden-corpus-catalog";

const runFullScale = process.env.STAGE_4B4_FULL_SCALE === "1";
const fullScaleIt = runFullScale ? it : it.skip;

describe("phase 85 stage 4b-4 closure", () => {
  it("builds at least 60 golden voice cases with full red-team category coverage", () => {
    const cases = buildStage4B4GoldenCorpusCases();
    expect(cases.length).toBeGreaterThanOrEqual(STAGE_4B4_GOLDEN_CORPUS_MIN_CASES);
    for (const category of STAGE_4B4_RED_TEAM_CATEGORIES) {
      expect(cases.some((entry) => entry.redTeamCategory === category)).toBe(true);
    }
  });

  it("syncs golden corpus jsonl with the deterministic catalog", () => {
    syncStage4B4GoldenCorpusJsonl();
    const loaded = loadStage4B4GoldenCorpusCases();
    expect(loaded.length).toBeGreaterThanOrEqual(STAGE_4B4_GOLDEN_CORPUS_MIN_CASES);
  });

  it("passes golden corpus red-team batch with zero hard-zero failures", async () => {
    const metrics = await runStage4B4GoldenCorpusBatch();
    expect(metrics.failures).toEqual([]);
    expect(metrics.hardZeroFailures).toEqual([]);
    expect(metrics.redTeamInventory.every((entry) => entry.covered)).toBe(true);
    expect(STAGE_4B4_HARD_ZERO_METRIC_IDS).toHaveLength(8);
  }, 120_000);

  it("collects hard-zero failures when any metric is non-zero", () => {
    const failures = collectStage4B4HardZeroFailures({
      unsafe_voice_client_send_count: 1,
      yellow_red_voice_send_count: 0,
      low_confidence_send_count: 0,
      duplicate_voice_reply_count: 0,
      raw_audio_leak_count: 0,
      cross_tenant_audio_read_count: 0,
      external_transcription_egress_count: 0,
      stale_correction_send_count: 0,
    });
    expect(failures).toEqual(["unsafe_voice_client_send_count"]);
  });

  it("passes sample cached-decision, admission, and voice replay rehearsal", async () => {
    const cached = await runStage4B4CachedDecisionRehearsal(250);
    expect(cached.ready).toBe(true);
    expect(cached.executedCount).toBe(250);

    const admission = await runStage4B4AdmissionRoundTrips(24);
    expect(admission.ready).toBe(true);
    expect(admission.successCount).toBe(24);
  }, 120_000);

  it("passes sample closure rehearsal and serializes aggregate-only evidence", async () => {
    const rehearsal = await runStage4B4ClosureRehearsalSample();
    expect(rehearsal.status).toBe("pass");
    expect(rehearsal.cachedDecisionStatus).toBe("sample_only");

    const evidence = buildStage4B4ClosureEvidencePackMetrics({
      goldenCorpus: rehearsal.goldenCorpus,
      cachedDecisionStatus: rehearsal.cachedDecisionStatus,
      admissionRoundTripStatus: rehearsal.admissionRoundTripStatus,
      voiceReplayStatus: rehearsal.voiceReplayStatus,
      status: rehearsal.status,
    });
    expect(evidence.phase).toBe(PHASE_85_STAGE_4B_4_CLOSURE_VERSION);
    expect(evidence.production_pilot_go).toBe(false);
    expect(evidence.r405_open).toBe(true);
    expect(stage4B4ClosureMetricsAreAggregateOnly(evidence)).toBe(true);
  }, 180_000);

  it("keeps Stage 4C blocked during Phase 10 rehearsal evidence", async () => {
    const rehearsal = await runStage4B4ClosureRehearsalSample();
    const closure = evaluateStage4B4ProgramClosureEvidence(rehearsal, {
      rlsSuite: "pass",
      rlsSkippedCount: 0,
      visualSuite: "pass",
      channelReplay: "pass",
      productionScaleRehearsal: "pass",
      phaseEvidenceComplete: true,
    });
    expect(closure.status).toBe("pass");
    expect(closure.stage4cAuthorized).toBe(false);
    expect(closure.productionPilotGo).toBe(false);
    expect(closure.r405Open).toBe(true);
  }, 180_000);

  fullScaleIt(
    "runs full 5000 cached-decision, 200 admission, and 5000 voice replay closure rehearsal",
    async () => {
      const rehearsal = await runStage4B4ClosureRehearsalFull();
      expect(rehearsal.status).toBe("pass");
      expect(rehearsal.goldenCorpus.cachedDecisionCount).toBe(STAGE_4B4_CACHED_DECISION_TARGET);
      expect(rehearsal.goldenCorpus.admissionRoundTripCount).toBe(STAGE_4B4_ADMISSION_ROUNDTRIP_TARGET);
      expect(rehearsal.cachedDecisionStatus).toBe("pass");
      expect(rehearsal.admissionRoundTripStatus).toBe("pass");
      expect(rehearsal.voiceReplayStatus).toBe("pass");
    },
    600_000,
  );
});
