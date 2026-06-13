import {
  PHASE_74_EXPORT_INCLUDED_FILES,
  PHASE_74_EXPORT_VERSION,
  buildPhase74ExportPackage,
} from "./phase-74-data-lifecycle-policy";
import type { LaunchGateEvidenceRecord } from "./launch-gates";
import { buildPhase76mCalibrationLaunchGateEvidence } from "./phase-76m-calibration-metrics";
import {
  evaluatePhase77kFoodDecisionV2GoldenSuite,
  PHASE_77K_FOOD_DECISION_V2_GOLDEN_VERSION,
  type Phase77kFoodDecisionV2GoldenMetrics,
} from "./phase-77k-food-decision-v2-golden";
import {
  buildPhase77kFoodMixEvidencePackMetrics,
  evaluatePhase77kFoodMixSampleEvidence,
  PHASE_77K_FOOD_MIX_REHEARSAL_VERSION,
  type Phase77kFoodMixRehearsalMetrics,
} from "./phase-77k-food-mix-rehearsal";
import { createInitialState } from "./seed-data";

export const PHASE_77K_CALIBRATION_EVIDENCE_VERSION = "phase-77k-calibration-evidence-v1";

export type Phase77kCalibrationClosureMetrics = {
  evidenceVersion: string;
  status: "pass" | "fail";
  goldenVersion: string;
  goldenStatus: Phase77kFoodDecisionV2GoldenMetrics["status"];
  rehearsalVersion: string;
  rehearsalStatus: Phase77kFoodMixRehearsalMetrics["status"];
  exportVersion: string;
  exportCoveragePass: boolean;
  totalGoldenCases: number;
  passedGoldenCases: number;
  unsafeGreenCount: number;
  inappropriateApprovalCount: number;
  forbiddenFoodApprovalCount: number;
  needsLabelCorrectCount: number;
  needsReviewCorrectCount: number;
  sourceManifestCompleteCount: number;
  manualSourceAuthorityTrackClosed: boolean;
  whatsappAdapterNext: boolean;
  failures: string[];
};

export function evaluatePhase77kExportCoverage() {
  const state = createInitialState();
  const exportPackage = buildPhase74ExportPackage(state, "client-mert");
  const hasV12Files =
    exportPackage.manifest.exportVersion === PHASE_74_EXPORT_VERSION &&
    PHASE_74_EXPORT_INCLUDED_FILES.every((file) => exportPackage.files[file] !== undefined) &&
    exportPackage.files["personal_form_v2.json"].includes("phase-77j-data-lifecycle-v1.2") &&
    exportPackage.files["catalog_version_refs.json"].includes("activeCatalog");
  return {
    exportVersion: exportPackage.manifest.exportVersion,
    exportCoveragePass: hasV12Files,
  };
}

export function evaluatePhase77kCalibrationClosure(): Phase77kCalibrationClosureMetrics {
  const golden = evaluatePhase77kFoodDecisionV2GoldenSuite();
  const rehearsal = evaluatePhase77kFoodMixSampleEvidence();
  const exportCoverage = evaluatePhase77kExportCoverage();
  const failures: string[] = [];

  if (golden.status !== "pass") failures.push("golden_suite_failed");
  if (rehearsal.status !== "pass") failures.push("rehearsal_sample_failed");
  if (!exportCoverage.exportCoveragePass) failures.push("export_coverage_failed");
  if (rehearsal.unsafeGreenCount > 0) failures.push("unsafe_green_detected");
  if (golden.inappropriateApprovalCount > 0 || rehearsal.inappropriateApprovalCount > 0) {
    failures.push("inappropriate_approval_detected");
  }
  if (golden.forbiddenFoodApprovalCount > 0 || rehearsal.forbiddenFoodApprovalCount > 0) {
    failures.push("forbidden_food_approval_detected");
  }

  const status = failures.length === 0 ? "pass" : "fail";

  return {
    evidenceVersion: PHASE_77K_CALIBRATION_EVIDENCE_VERSION,
    status,
    goldenVersion: PHASE_77K_FOOD_DECISION_V2_GOLDEN_VERSION,
    goldenStatus: golden.status,
    rehearsalVersion: PHASE_77K_FOOD_MIX_REHEARSAL_VERSION,
    rehearsalStatus: rehearsal.status,
    exportVersion: exportCoverage.exportVersion,
    exportCoveragePass: exportCoverage.exportCoveragePass,
    totalGoldenCases: golden.totalCaseCount,
    passedGoldenCases: golden.passedCaseCount,
    unsafeGreenCount: rehearsal.unsafeGreenCount,
    inappropriateApprovalCount: golden.inappropriateApprovalCount + rehearsal.inappropriateApprovalCount,
    forbiddenFoodApprovalCount: golden.forbiddenFoodApprovalCount + rehearsal.forbiddenFoodApprovalCount,
    needsLabelCorrectCount: golden.needsLabelCorrectCount + rehearsal.needsLabelCorrectCount,
    needsReviewCorrectCount: golden.needsReviewCorrectCount + rehearsal.needsReviewCorrectCount,
    sourceManifestCompleteCount: golden.sourceManifestCompleteCount + rehearsal.sourceManifestCompleteCount,
    manualSourceAuthorityTrackClosed: status === "pass",
    whatsappAdapterNext: status === "pass",
    failures,
  };
}

export function buildPhase77kCalibrationHealthSignal() {
  const closure = evaluatePhase77kCalibrationClosure();
  return {
    evidenceVersion: closure.evidenceVersion,
    status: closure.status,
    goldenVersion: closure.goldenVersion,
    goldenStatus: closure.goldenStatus,
    rehearsalVersion: closure.rehearsalVersion,
    rehearsalStatus: closure.rehearsalStatus,
    exportVersion: closure.exportVersion,
    exportCoveragePass: closure.exportCoveragePass,
    unsafeGreenCount: closure.unsafeGreenCount,
    inappropriateApprovalCount: closure.inappropriateApprovalCount,
    forbiddenFoodApprovalCount: closure.forbiddenFoodApprovalCount,
    manualSourceAuthorityTrackClosed: closure.manualSourceAuthorityTrackClosed,
    whatsappAdapterNext: closure.whatsappAdapterNext,
  };
}

export function buildPhase77kCalibrationEvidencePackMetrics(): Record<string, number | string | boolean> {
  const closure = evaluatePhase77kCalibrationClosure();
  const golden = evaluatePhase77kFoodDecisionV2GoldenSuite();
  const rehearsal = evaluatePhase77kFoodMixSampleEvidence();

  return {
    evidence_version: closure.evidenceVersion,
    status: closure.status,
    golden_version: closure.goldenVersion,
    golden_status: closure.goldenStatus,
    rehearsal_version: closure.rehearsalVersion,
    rehearsal_status: closure.rehearsalStatus,
    export_version: closure.exportVersion,
    export_coverage_pass: closure.exportCoveragePass,
    total_golden_cases: closure.totalGoldenCases,
    passed_golden_cases: closure.passedGoldenCases,
    manual_source_authority_track_closed: closure.manualSourceAuthorityTrackClosed,
    whatsapp_adapter_next: closure.whatsappAdapterNext,
    ...buildPhase77kFoodMixEvidencePackMetrics(rehearsal),
    golden_category_count: golden.categoryCoverage.length,
  };
}

export function buildPhase77kCalibrationLaunchGateEvidence(): LaunchGateEvidenceRecord[] {
  const closure = evaluatePhase77kCalibrationClosure();
  return [
    ...buildPhase76mCalibrationLaunchGateEvidence(),
    {
      gateId: "clinical_taxonomy_approval",
      artifactTitle: "Phase 77K Food Decision V2 calibration and rehearsal closure",
      artifactRef: PHASE_77K_CALIBRATION_EVIDENCE_VERSION,
      approvalStatus: "draft",
      coveredEvidence: [
        "food_decision_v2_golden_suite",
        "food_mix_rehearsal_v2",
        `golden_status:${closure.goldenStatus}`,
        `rehearsal_status:${closure.rehearsalStatus}`,
        `export_coverage:${closure.exportCoveragePass}`,
        `manual_source_authority_track_closed:${closure.manualSourceAuthorityTrackClosed}`,
      ],
      sanitizedReference: true,
    },
  ];
}
