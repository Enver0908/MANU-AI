import { describe, expect, it } from "vitest";
import { createDirectPilotScaleFixture } from "./direct-pilot-scale-readiness";
import { buildOperationalHealthSnapshot } from "./operational-health";
import {
  buildPhase77kCalibrationEvidencePackMetrics,
  evaluatePhase77kCalibrationClosure,
  evaluatePhase77kExportCoverage,
} from "./phase-77k-calibration-evidence";
import {
  assignFoodDecisionV2GoldenCaseForClientIndex,
  buildPhase77kFoodMixEvidencePackMetrics,
  evaluatePhase77kFoodMixSampleEvidence,
  runPhase77kFoodMixRehearsal,
  runPhase77kFoodMixScaleRehearsal,
} from "./phase-77k-food-mix-rehearsal";
import { createInitialState } from "./seed-data";

describe("phase 77k calibration evidence closure", () => {
  it("confirms phase74-export-v1.3 coverage", () => {
    const coverage = evaluatePhase77kExportCoverage();
    expect(coverage.exportCoveragePass).toBe(true);
    expect(coverage.exportVersion).toBe("phase74-export-v1.3");
  });

  it("passes calibration closure with golden, rehearsal sample, and export coverage", () => {
    const closure = evaluatePhase77kCalibrationClosure();
    expect(closure.status).toBe("pass");
    expect(closure.manualSourceAuthorityTrackClosed).toBe(true);
    expect(closure.whatsappAdapterNext).toBe(true);
    expect(closure.exportCoveragePass).toBe(true);
    expect(closure.inappropriateApprovalCount).toBe(0);
    expect(closure.forbiddenFoodApprovalCount).toBe(0);
  });

  it("serializes evidence-pack metrics without raw message content", () => {
    const metrics = buildPhase77kCalibrationEvidencePackMetrics();
    const json = JSON.stringify(metrics);
    expect(metrics.status).toBe("pass");
    expect(metrics.manual_source_authority_track_closed).toBe(true);
    expect(json).not.toContain("Beyaz peynir");
    expect(json).not.toContain("synthetic-client-");
  });

  it("assigns golden scenarios deterministically across the 100x50 fixture", () => {
    const fixture = createDirectPilotScaleFixture();
    const first = assignFoodDecisionV2GoldenCaseForClientIndex(0);
    const second = assignFoodDecisionV2GoldenCaseForClientIndex(14);
    expect(first.id).toBe(second.id);
    expect(fixture.clients).toHaveLength(5000);
  });

  it("passes V2 food-mix sample evidence", () => {
    const sample = evaluatePhase77kFoodMixSampleEvidence();
    expect(sample.status).toBe("pass");
    expect(sample.clientCount).toBe(5000);
    expect(sample.dietitianCount).toBe(100);
    expect(sample.inappropriateApprovalCount).toBe(0);
  });

  it("serializes food-mix evidence without raw messages", () => {
    const metrics = buildPhase77kFoodMixEvidencePackMetrics(evaluatePhase77kFoodMixSampleEvidence());
    expect(metrics.unsafe_green_count).toBe(0);
    expect(JSON.stringify(metrics)).not.toContain("Quinoa");
  });

  it(
    "runs the full 100x50 V2 scale rehearsal with zero unsafe green",
    async () => {
      const metrics = await runPhase77kFoodMixScaleRehearsal();
      expect(metrics.status).toBe("pass");
      expect(metrics.clientCount).toBe(5000);
      expect(metrics.unsafeGreenCount).toBe(0);
      expect(metrics.inappropriateApprovalCount).toBe(0);
    },
    360_000,
  );

  it(
    "runs combined V2 rehearsal with integration checks",
    async () => {
      const metrics = await runPhase77kFoodMixRehearsal();
      expect(metrics.status).toBe("pass");
      expect(metrics.duplicateIgnoredCount).toBe(1);
      expect(metrics.manualFoodRuleSaveCount).toBe(1);
    },
    360_000,
  );

  it("includes V2 calibration fields in operational health", () => {
    const snapshot = buildOperationalHealthSnapshot(createInitialState());
    expect(snapshot.foodDecisionV2CalibrationStatus).toBe("pass");
    expect(snapshot.foodMixRehearsalV2Status).toBe("pass");
    expect(snapshot.manualSourceAuthorityTrackClosed).toBe(true);
  });
});
