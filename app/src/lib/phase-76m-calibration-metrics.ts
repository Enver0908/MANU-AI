import {
  evaluatePhase73GreenCapacityMetrics,
  PHASE_73_CALIBRATION_VERSION,
  type Phase73GreenCapacityMetrics,
} from "./phase-73-health-regulation-calibration";
import type { LaunchGateEvidenceRecord } from "./launch-gates";

export const PHASE_76M_CALIBRATION_METRICS_VERSION = "phase-76m-calibration-metrics-v1";

export type Phase76mGreenCapacityHealthSignal = {
  metricsVersion: string;
  calibrationVersion: string;
  status: Phase73GreenCapacityMetrics["status"];
  totalCaseCount: number;
  greenCoverageRate: number;
  sourceBackedGreenRate: number;
  foodRuleGreenRate: number;
  falseYellowRate: number;
  unsafeGreenRate: number;
  mixedIntentBlockCount: number;
  ingredientUnknownReviewCount: number;
  providerAttemptedFalseCount: number;
  covenantBlockCount: number;
  goldenCasePassCount: number;
  goldenCaseFailCount: number;
};

export function buildPhase76mGreenCapacityHealthSignal(): Phase76mGreenCapacityHealthSignal {
  const metrics = evaluatePhase73GreenCapacityMetrics();

  return {
    metricsVersion: PHASE_76M_CALIBRATION_METRICS_VERSION,
    calibrationVersion: PHASE_73_CALIBRATION_VERSION,
    status: metrics.status,
    totalCaseCount: metrics.totalCaseCount,
    greenCoverageRate: metrics.greenCoverageRate,
    sourceBackedGreenRate: metrics.sourceBackedGreenRate,
    foodRuleGreenRate: metrics.foodRuleGreenRate,
    falseYellowRate: metrics.falseYellowRate,
    unsafeGreenRate: metrics.unsafeGreenRate,
    mixedIntentBlockCount: metrics.mixedIntentBlockCount,
    ingredientUnknownReviewCount: metrics.ingredientUnknownReviewCount,
    providerAttemptedFalseCount: metrics.providerAttemptedFalseCount,
    covenantBlockCount: metrics.covenantBlockCount,
    goldenCasePassCount: metrics.goldenCasePassCount,
    goldenCaseFailCount: metrics.goldenCaseFailCount,
  };
}

export function buildPhase76mCalibrationEvidencePackMetrics(): Record<string, number | string> {
  const metrics = evaluatePhase73GreenCapacityMetrics();

  return {
    calibrationVersion: metrics.calibrationVersion,
    metricsVersion: PHASE_76M_CALIBRATION_METRICS_VERSION,
    status: metrics.status,
    green_coverage_rate: metrics.greenCoverageRate,
    source_backed_green_rate: metrics.sourceBackedGreenRate,
    food_rule_green_rate: metrics.foodRuleGreenRate,
    false_yellow_rate: metrics.falseYellowRate,
    unsafe_green_rate: metrics.unsafeGreenRate,
    mixed_intent_block_count: metrics.mixedIntentBlockCount,
    ingredient_unknown_review_count: metrics.ingredientUnknownReviewCount,
    provider_attempted_false_count: metrics.providerAttemptedFalseCount,
    covenant_block_count: metrics.covenantBlockCount,
    golden_case_pass_count: metrics.goldenCasePassCount,
    golden_case_fail_count: metrics.goldenCaseFailCount,
  };
}

export function buildPhase76mCalibrationLaunchGateEvidence(): LaunchGateEvidenceRecord[] {
  const metrics = evaluatePhase73GreenCapacityMetrics();

  return [
    {
      gateId: "clinical_taxonomy_approval",
      artifactTitle: "Phase 76M green-capacity calibration metrics report",
      artifactRef: PHASE_76M_CALIBRATION_METRICS_VERSION,
      approvalStatus: "draft",
      coveredEvidence: [
        "green_capacity_metrics_report",
        "food_rule_calibration_golden_suite",
        `unsafe_green_rate:${metrics.unsafeGreenRate}`,
        `green_coverage_rate:${metrics.greenCoverageRate}`,
      ],
      sanitizedReference: true,
    },
  ];
}
