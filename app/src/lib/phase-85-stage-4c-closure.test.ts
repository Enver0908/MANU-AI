import { describe, expect, it } from "vitest";
import {
  buildStage4CGoldenCorpusCases,
  buildStage4CRedTeamCorpusCases,
  countStage4CTrueRedCases,
  STAGE_4C_GOLDEN_CATEGORY_COUNTS,
  STAGE_4C_GOLDEN_CORPUS_MIN_CASES,
  STAGE_4C_MIN_TRUE_RED_CASES,
  STAGE_4C_RED_TEAM_CATEGORIES,
  STAGE_4C_RED_TEAM_MIN_CASES,
} from "./phase-85-stage-4c-golden-corpus-catalog";
import {
  PHASE_85_STAGE_4C_CLOSURE_VERSION,
  PHASE_85_STAGE_4C_PROGRAM_CLOSURE_VERSION,
  STAGE_4C_FAIL_VERDICT,
  STAGE_4C_HARD_ZERO_METRIC_IDS,
  STAGE_4C_PASS_VERDICT,
  STAGE_4C_RISK_REGISTER_IDS,
  STAGE_4C_SCALE_REHEARSAL_TARGETS,
  buildStage4CRiskReconciliationReport,
  collectStage4CHardZeroFailures,
  evaluateStage4CProgramClosureEvidence,
  loadStage4CGoldenCorpusCases,
  loadStage4CRedTeamCorpusCases,
  parseVitestRunSummary,
  runStage4CClosureRehearsalSample,
  runStage4CGoldenCorpusBatch,
  runStage4CRedTeamCorpusBatch,
  runStage4CScaleRehearsal,
  runStage4CForbiddenNamingScan,
  runStage4CSecretScan,
  stage4CClosureMetricsAreAggregateOnly,
  syncStage4CGoldenCorpusJsonl,
  syncStage4CRedTeamCorpusJsonl,
  verifyStage4CCopilotIsolation,
  verifyStage4CProductionProviderFlagsClosed,
} from "./phase-85-stage-4c-closure";

describe("phase 85 stage 4c closure", () => {
  it("builds at least 240 golden cases with required category counts", () => {
    const cases = buildStage4CGoldenCorpusCases();
    expect(cases.length).toBeGreaterThanOrEqual(STAGE_4C_GOLDEN_CORPUS_MIN_CASES);
    for (const [category, count] of Object.entries(STAGE_4C_GOLDEN_CATEGORY_COUNTS)) {
      expect(cases.filter((entry) => entry.category === category).length).toBe(count);
    }
    expect(countStage4CTrueRedCases(cases)).toBeGreaterThanOrEqual(STAGE_4C_MIN_TRUE_RED_CASES);
  });

  it("builds at least 100 red-team cases with category coverage", () => {
    const cases = buildStage4CRedTeamCorpusCases();
    expect(cases.length).toBe(STAGE_4C_RED_TEAM_MIN_CASES);
    for (const category of STAGE_4C_RED_TEAM_CATEGORIES) {
      expect(cases.some((entry) => entry.redTeamCategory === category)).toBe(true);
    }
  });

  it("syncs golden and red-team jsonl corpora", () => {
    syncStage4CGoldenCorpusJsonl();
    syncStage4CRedTeamCorpusJsonl();
    expect(loadStage4CGoldenCorpusCases().length).toBeGreaterThanOrEqual(STAGE_4C_GOLDEN_CORPUS_MIN_CASES);
    expect(loadStage4CRedTeamCorpusCases().length).toBeGreaterThanOrEqual(STAGE_4C_RED_TEAM_MIN_CASES);
  });

  it("parses vitest summaries and rejects skipped-only success", () => {
    const parsed = parseVitestRunSummary("Tests  12 passed | 3 skipped (15)");
    expect(parsed.parseable).toBe(true);
    expect(parsed.passed).toBe(12);
    expect(parsed.skipped).toBe(3);
    expect(parsed.exitCode).toBe(0);
  });

  it("collects hard-zero failures when any metric is non-zero", () => {
    const failures = collectStage4CHardZeroFailures({
      cross_tenant_client_data_leak_count: 0,
      foreign_creator_chat_read_count: 0,
      auto_client_send_count: 1,
      auto_clinical_write_count: 0,
      missed_synthetic_red_case_count: 0,
      invalid_unauthorized_citation_count: 0,
      deleted_data_retrieval_count: 0,
      unsourced_major_clinical_claim_count: 0,
      stopped_superseded_run_complete_count: 0,
      general_chat_phi_egress_count: 0,
      second_client_retrieval_count: 0,
      unaccepted_ocr_transcript_use_count: 0,
      production_provider_flag_count: 0,
      serious_critical_accessibility_violation_count: 0,
      rls_skipped_test_count: 0,
      unexplained_production_dependency_finding_count: 0,
    });
    expect(failures).toEqual(["auto_client_send_count"]);
    expect(STAGE_4C_HARD_ZERO_METRIC_IDS).toHaveLength(16);
  });

  it("passes golden and red-team corpus batches with zero hard-zero failures", async () => {
    const golden = await runStage4CGoldenCorpusBatch(buildStage4CGoldenCorpusCases());
    const redTeam = await runStage4CRedTeamCorpusBatch(buildStage4CRedTeamCorpusCases());
    expect(golden.failures).toEqual([]);
    expect(golden.hardZeroFailures).toEqual([]);
    expect(redTeam.failures).toEqual([]);
    expect(redTeam.hardZeroFailures).toEqual([]);
    expect(golden.trueRedCaseCount).toBeGreaterThanOrEqual(STAGE_4C_MIN_TRUE_RED_CASES);
  }, 120_000);

  it("passes sample scale rehearsal within latency targets", async () => {
    const metrics = await runStage4CScaleRehearsal(24);
    expect(metrics.chatCount).toBe(STAGE_4C_SCALE_REHEARSAL_TARGETS.chats);
    expect(metrics.messageVersionCount).toBe(STAGE_4C_SCALE_REHEARSAL_TARGETS.messageVersions);
    expect(metrics.latencyTargetsMet).toBe(true);
    expect(metrics.failures).toEqual([]);
  }, 120_000);

  it("verifies copilot isolation and closed production provider flags", () => {
    expect(verifyStage4CCopilotIsolation().verified).toBe(true);
    expect(verifyStage4CProductionProviderFlagsClosed()).toBe(true);
  });

  it("passes secret and forbidden naming scans", () => {
    expect(runStage4CSecretScan().status).toBe("pass");
    expect(runStage4CForbiddenNamingScan().status).toBe("pass");
  });

  it("passes sample closure rehearsal and serializes aggregate-only evidence", async () => {
    const rehearsal = await runStage4CClosureRehearsalSample();
    expect(rehearsal.failures).toEqual([]);
    expect(rehearsal.status).toBe("pass");
    expect(rehearsal.phase).toBe(PHASE_85_STAGE_4C_CLOSURE_VERSION);

    const closure = evaluateStage4CProgramClosureEvidence(rehearsal, {
      coreTests: "pass",
      lint: "pass",
      typecheck: "pass",
      unitTests: "pass",
      rlsSuite: "pass",
      rlsSkippedCount: 0,
      visualSuite: "pass",
      accessibilitySuite: "pass",
      releaseVerify: "pass",
      dependencyAudit: "pass",
      secretScan: "pass",
      forbiddenNamingScan: "pass",
      migrationReset: "pass",
    });
    expect(closure.verdict).toBe(STAGE_4C_PASS_VERDICT);
    expect(closure.productionPilotGo).toBe(false);
    expect(closure.r405Open).toBe(true);
    expect(stage4CClosureMetricsAreAggregateOnly(closure)).toBe(true);
  }, 180_000);

  it("fails program closure when RLS suite is skipped", async () => {
    const rehearsal = await runStage4CClosureRehearsalSample();
    const closure = evaluateStage4CProgramClosureEvidence(rehearsal, {
      coreTests: "pass",
      lint: "pass",
      typecheck: "pass",
      unitTests: "pass",
      rlsSuite: "skipped",
      rlsSkippedCount: 46,
      visualSuite: "pass",
      accessibilitySuite: "pass",
      releaseVerify: "pass",
      dependencyAudit: "pass",
      secretScan: "pass",
      forbiddenNamingScan: "pass",
      migrationReset: "pass",
    });
    expect(closure.status).toBe("fail");
    expect(closure.verdict).toBe(STAGE_4C_FAIL_VERDICT);
    expect(closure.failures.some((failure) => failure.includes("rls"))).toBe(true);
  }, 180_000);

  it("reconciles R-462 through R-480 as mitigated locally on pass", () => {
    const report = buildStage4CRiskReconciliationReport("pass");
    expect(report).toHaveLength(STAGE_4C_RISK_REGISTER_IDS.length);
    expect(report.every((entry) => entry.status === "mitigated_locally")).toBe(true);
    expect(PHASE_85_STAGE_4C_PROGRAM_CLOSURE_VERSION).toBe("p85-stage-4c-program-closure-v2");
  });
});
