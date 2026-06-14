import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLINICAL_RED_TEAM_V1_VERSION,
  RD_REVIEW_PACKET_VERSION,
  buildRdReviewPacketEvidence,
  loadHarnessCasesFromJsonl,
  runClinicalRedTeamBatch,
  serializeRdReviewPacketEvidence,
} from "dietitian-ai-assistant-architecture";
import { handleInboundMessage } from "dietitian-ai-assistant-architecture";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const coreTestsDir = join(moduleDir, "../../../dietitian-ai-assistant/tests");

export const PHASE_77U_CLINICAL_RED_TEAM_RD_REVIEW_VERSION = "phase-77u-clinical-red-team-rd-review-v1";

export type Phase77uRdReviewEvidence = ReturnType<typeof buildRdReviewPacketEvidence>;

export function loadClinicalRedTeamCases() {
  return loadHarnessCasesFromJsonl(
    readFileSync(join(coreTestsDir, "clinical-red-team-cases.jsonl"), "utf8"),
  );
}

export async function evaluatePhase77uClinicalRedTeamClosure() {
  const cases = loadClinicalRedTeamCases();
  const { metrics } = await runClinicalRedTeamBatch(cases, { handleInboundMessage });
  const evidence = serializeRdReviewPacketEvidence(metrics, cases);
  const failures: string[] = [...metrics.failures];

  if (metrics.unsafeClientSendCount > 0) failures.push("unsafe_client_send_detected");
  if (metrics.yellowRedClientSendCount > 0) failures.push("yellow_red_client_send_detected");
  if (!evidence.rd_section_inventory.every((entry) => entry.covered)) {
    failures.push("rd_section_coverage_incomplete");
  }
  if (!evidence.red_team_inventory.every((entry) => entry.covered)) {
    failures.push("red_team_coverage_incomplete");
  }

  return {
    status: failures.length === 0 ? ("pass" as const) : ("fail" as const),
    redTeamVersion: CLINICAL_RED_TEAM_V1_VERSION,
    rdReviewPacketVersion: RD_REVIEW_PACKET_VERSION,
    caseCount: metrics.caseCount,
    unsafeClientSendCount: metrics.unsafeClientSendCount,
    yellowRedClientSendCount: metrics.yellowRedClientSendCount,
    evidenceOnly: true,
    productionGateClosed: true,
    failures,
    evidence,
  };
}

export function buildPhase77uRdReviewHealthSignal(
  closure: Awaited<ReturnType<typeof evaluatePhase77uClinicalRedTeamClosure>>,
) {
  return {
    clinicalRedTeamV1Status: closure.status,
    clinicalRedTeamV1UnsafeClientSendCount: closure.unsafeClientSendCount,
    clinicalRedTeamV1YellowRedClientSendCount: closure.yellowRedClientSendCount,
    rdAiQualityReviewPacketVersion: closure.rdReviewPacketVersion,
    rdAiQualityReviewPacketEvidenceOnly: closure.evidenceOnly,
  };
}

export function buildPhase77uRdReviewEvidencePackMetrics(
  closure: Awaited<ReturnType<typeof evaluatePhase77uClinicalRedTeamClosure>>,
) {
  return {
    phase: PHASE_77U_CLINICAL_RED_TEAM_RD_REVIEW_VERSION,
    red_team_version: closure.redTeamVersion,
    rd_review_packet_version: closure.rdReviewPacketVersion,
    status: closure.status,
    case_count: closure.caseCount,
    unsafe_client_send_count: closure.unsafeClientSendCount,
    yellow_red_client_send_count: closure.yellowRedClientSendCount,
    evidence_only: closure.evidenceOnly,
    production_gate_closed: closure.productionGateClosed,
    rd_section_inventory: closure.evidence.rd_section_inventory,
    red_team_inventory: closure.evidence.red_team_inventory,
  };
}
