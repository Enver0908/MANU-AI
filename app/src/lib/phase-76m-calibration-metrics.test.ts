import { describe, expect, it } from "vitest";
import { evaluatePhase73GreenCapacityMetrics, PHASE_73_GOLDEN_CASES } from "./phase-73-health-regulation-calibration";
import {
  buildPhase76mCalibrationEvidencePackMetrics,
  buildPhase76mCalibrationLaunchGateEvidence,
  buildPhase76mGreenCapacityHealthSignal,
  PHASE_76M_CALIBRATION_METRICS_VERSION,
} from "./phase-76m-calibration-metrics";
import { buildOperationalHealthSnapshot } from "./operational-health";
import { createInitialState } from "./seed-data";

describe("phase 76m calibration metrics expansion", () => {
  it("passes green-capacity metrics with zero unsafe green on bundled suite", () => {
    const metrics = evaluatePhase73GreenCapacityMetrics();

    expect(metrics.status).toBe("pass");
    expect(metrics.unsafeGreenRate).toBe(0);
    expect(metrics.totalCaseCount).toBe(PHASE_73_GOLDEN_CASES.length);
    expect(metrics.mixedIntentBlockCount).toBeGreaterThan(0);
    expect(metrics.ingredientUnknownReviewCount).toBeGreaterThan(0);
    expect(metrics.covenantBlockCount).toBeGreaterThan(0);
  });

  it("covers all twelve food-rule golden categories", () => {
    const categories = new Set(
      PHASE_73_GOLDEN_CASES.map((record) => record.category).filter((value): value is NonNullable<typeof value> => Boolean(value)),
    );

    expect(categories.size).toBe(12);
  });

  it("serializes evidence-pack metrics without raw message content", () => {
    const evidence = buildPhase76mCalibrationEvidencePackMetrics();
    const json = JSON.stringify(evidence);

    expect(evidence.metricsVersion).toBe(PHASE_76M_CALIBRATION_METRICS_VERSION);
    expect(evidence.unsafe_green_rate).toBe(0);
    expect(evidence.green_coverage_rate).toBe(1);
    expect(json).not.toContain("Fistik yiyebilir miyim");
  });

  it("records draft launch-gate evidence for green-capacity metrics", () => {
    const records = buildPhase76mCalibrationLaunchGateEvidence();

    expect(records).toHaveLength(1);
    expect(records[0]?.approvalStatus).toBe("draft");
    expect(records[0]?.coveredEvidence).toContain("green_capacity_metrics_report");
  });

  it("adds aggregate green-capacity fields to operational health", () => {
    const snapshot = buildOperationalHealthSnapshot(createInitialState());
    const signal = buildPhase76mGreenCapacityHealthSignal();

    expect(snapshot.greenCapacityMetricsStatus).toBe(signal.status);
    expect(snapshot.greenCoverageRate).toBe(signal.greenCoverageRate);
    expect(snapshot.unsafeGreenRate).toBe(0);
    expect(JSON.stringify(snapshot)).not.toContain("Hamileyim bugun");
  });
});
