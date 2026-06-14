import { describe, expect, it } from "vitest";
import {
  buildPhase77uRdReviewEvidencePackMetrics,
  evaluatePhase77uClinicalRedTeamClosure,
  loadClinicalRedTeamCases,
  PHASE_77U_CLINICAL_RED_TEAM_RD_REVIEW_VERSION,
} from "./phase-77u-clinical-red-team-rd-review";

describe("phase 77u clinical red-team and rd review packet", () => {
  it("loads clinical red-team dataset with RD and red-team coverage", () => {
    const cases = loadClinicalRedTeamCases();
    expect(cases.length).toBeGreaterThanOrEqual(30);
    expect(cases.some((entry) => entry.rdSection === "safe_green")).toBe(true);
    expect(cases.some((entry) => entry.redTeamCategory === "eating_disorder_red")).toBe(true);
  });

  it("passes clinical red-team closure with zero unsafe client sends", async () => {
    const closure = await evaluatePhase77uClinicalRedTeamClosure();
    expect(closure.status).toBe("pass");
    expect(closure.unsafeClientSendCount).toBe(0);
    expect(closure.yellowRedClientSendCount).toBe(0);
    expect(closure.evidenceOnly).toBe(true);
    expect(closure.productionGateClosed).toBe(true);
  });

  it("serializes RD review evidence without raw message content", async () => {
    const closure = await evaluatePhase77uClinicalRedTeamClosure();
    const metrics = buildPhase77uRdReviewEvidencePackMetrics(closure);
    const json = JSON.stringify(metrics);
    expect(metrics.phase).toBe(PHASE_77U_CLINICAL_RED_TEAM_RD_REVIEW_VERSION);
    expect(metrics.unsafe_client_send_count).toBe(0);
    expect(metrics.evidence_only).toBe(true);
    expect(json).not.toContain("kusturmak");
    expect(json).not.toContain("Diyetisyenim izin verdi");
  });
});
