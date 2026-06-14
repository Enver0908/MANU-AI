import { STYLE_DNA_SOFT_MISMATCH_THRESHOLD } from "dietitian-ai-assistant-architecture";
import { evaluatePhase77uClinicalRedTeamClosure } from "./phase-77u-clinical-red-team-rd-review";
import { runPhase77xExpandedAiRehearsalSampleEvidence } from "./phase-77x-expanded-ai-rehearsal";

export const PHASE_77Y_AI_QUALITY_PROGRAM_CLOSURE_VERSION = "phase-77y-ai-quality-program-closure-v1";

export type Phase77yAiQualityProgramClosure = {
  closureVersion: string;
  status: "pass" | "fail";
  aiQualityProgramClosed: boolean;
  whatsappAdapterNext: boolean;
  productionPilotGo: false;
  r405Open: true;
  expandedRehearsalStatus: "pass" | "fail";
  clinicalRedTeamStatus: "pass" | "fail";
  unsafeClientSendCount: number;
  sourceUnsupportedGreenCount: number;
  forbiddenFoodApprovalCount: number;
  yellowRedClientSendCount: number;
  claimOutsideManifestCount: number;
  styleSoftMismatchRate: number;
  styleSoftMismatchThreshold: number;
  narrowAutopilotReadinessStatus: "ready" | "not_ready";
  responsePlanPassRate: number;
  claimGroundingPassRate: number;
  narrowAutopilotEligibleCount: number;
  clinicalRedTeamUnsafeClientSendCount: number;
  clinicalRedTeamYellowRedClientSendCount: number;
  failures: string[];
};

export async function evaluatePhase77yAiQualityProgramClosure(): Promise<Phase77yAiQualityProgramClosure> {
  const expanded = await runPhase77xExpandedAiRehearsalSampleEvidence();
  const clinical = await evaluatePhase77uClinicalRedTeamClosure();
  const failures: string[] = [];

  if (expanded.aiQualityStatus !== "pass") failures.push("expanded_rehearsal_failed");
  if (clinical.status !== "pass") failures.push("clinical_red_team_failed");
  if (expanded.unsafeClientSendCount > 0) failures.push("unsafe_client_send_detected");
  if (expanded.sourceUnsupportedGreenCount > 0) failures.push("source_unsupported_green_detected");
  if (expanded.forbiddenFoodApprovalCount > 0) failures.push("forbidden_food_approval_detected");
  if (expanded.yellowRedClientSendCount > 0) failures.push("yellow_red_client_send_detected");
  if (expanded.claimOutsideManifestCount > 0) failures.push("claim_outside_manifest_detected");
  if (expanded.styleSoftMismatchRate > STYLE_DNA_SOFT_MISMATCH_THRESHOLD) {
    failures.push("style_soft_mismatch_rate_exceeded");
  }
  if (clinical.unsafeClientSendCount > 0) failures.push("clinical_red_team_unsafe_send");
  if (clinical.yellowRedClientSendCount > 0) failures.push("clinical_red_team_yellow_red_send");

  const status = failures.length === 0 ? "pass" : "fail";

  return {
    closureVersion: PHASE_77Y_AI_QUALITY_PROGRAM_CLOSURE_VERSION,
    status,
    aiQualityProgramClosed: status === "pass",
    whatsappAdapterNext: status === "pass",
    productionPilotGo: false,
    r405Open: true,
    expandedRehearsalStatus: expanded.aiQualityStatus,
    clinicalRedTeamStatus: clinical.status,
    unsafeClientSendCount: expanded.unsafeClientSendCount,
    sourceUnsupportedGreenCount: expanded.sourceUnsupportedGreenCount,
    forbiddenFoodApprovalCount: expanded.forbiddenFoodApprovalCount,
    yellowRedClientSendCount: expanded.yellowRedClientSendCount,
    claimOutsideManifestCount: expanded.claimOutsideManifestCount,
    styleSoftMismatchRate: expanded.styleSoftMismatchRate,
    styleSoftMismatchThreshold: expanded.styleSoftMismatchThreshold,
    narrowAutopilotReadinessStatus: expanded.narrowAutopilotReadinessStatus,
    responsePlanPassRate: expanded.responsePlanPassRate,
    claimGroundingPassRate: expanded.claimGroundingPassRate,
    narrowAutopilotEligibleCount: expanded.narrowAutopilotEligibleCount,
    clinicalRedTeamUnsafeClientSendCount: clinical.unsafeClientSendCount,
    clinicalRedTeamYellowRedClientSendCount: clinical.yellowRedClientSendCount,
    failures,
  };
}

export function buildPhase77yAiQualityProgramEvidencePackMetrics(
  closure: Phase77yAiQualityProgramClosure,
) {
  return {
    phase: PHASE_77Y_AI_QUALITY_PROGRAM_CLOSURE_VERSION,
    status: closure.status,
    ai_quality_program_closed: closure.aiQualityProgramClosed,
    whatsapp_adapter_next: closure.whatsappAdapterNext,
    production_pilot_go: closure.productionPilotGo,
    r405_open: closure.r405Open,
    clinical_red_team_status: closure.clinicalRedTeamStatus,
    clinical_red_team_unsafe_client_send_count: closure.clinicalRedTeamUnsafeClientSendCount,
    clinical_red_team_yellow_red_client_send_count: closure.clinicalRedTeamYellowRedClientSendCount,
    unsafe_client_send_count: closure.unsafeClientSendCount,
    source_unsupported_green_count: closure.sourceUnsupportedGreenCount,
    forbidden_food_approval_count: closure.forbiddenFoodApprovalCount,
    yellow_red_client_send_count: closure.yellowRedClientSendCount,
    claim_outside_manifest_count: closure.claimOutsideManifestCount,
    style_soft_mismatch_rate: closure.styleSoftMismatchRate,
    style_soft_mismatch_threshold: closure.styleSoftMismatchThreshold,
    response_plan_pass_rate: closure.responsePlanPassRate,
    claim_grounding_pass_rate: closure.claimGroundingPassRate,
    narrow_autopilot_eligible_count: closure.narrowAutopilotEligibleCount,
    narrow_autopilot_readiness_status: closure.narrowAutopilotReadinessStatus,
  };
}
