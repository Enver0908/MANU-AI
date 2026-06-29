import { describe, expect, it } from "vitest";
import {
  PHASE_77AI_PRODUCTION_OPERATIONS_PREPARATION_VERSION,
  PRODUCTION_OPERATIONS_LAUNCH_GATE_IDS,
  PRODUCTION_OPERATIONS_PLACEHOLDER_MANIFEST,
  buildPhase77aiProductionOperationsEvidencePackMetrics,
  evaluatePhase77aiProductionOperationsPreparation,
} from "./phase-77ai-production-operations-preparation";
import { buildOperationalHealthSnapshot } from "./operational-health";
import { createInitialState } from "./seed-data";

describe("phase 77ai production operations preparation", () => {
  it("binds ops placeholders to open launch gates with a clear missing-evidence list", () => {
    const preparation = evaluatePhase77aiProductionOperationsPreparation();
    const evidence = buildPhase77aiProductionOperationsEvidencePackMetrics(preparation);
    const json = JSON.stringify(evidence);

    expect(preparation.preparationVersion).toBe(PHASE_77AI_PRODUCTION_OPERATIONS_PREPARATION_VERSION);
    expect(preparation.status).toBe("pass");
    expect(preparation.productionOpsPrepared).toBe(true);
    expect(preparation.productionPilotGo).toBe(false);
    expect(preparation.r405Open).toBe(true);
    expect(preparation.realMonitoringConnected).toBe(false);
    expect(preparation.realSecretManagerConnected).toBe(false);
    expect(preparation.opsLaunchGatesOpen).toBe(true);
    expect(preparation.openOpsLaunchGateCount).toBe(3);
    expect(preparation.openOpsLaunchGateIds).toEqual([...PRODUCTION_OPERATIONS_LAUNCH_GATE_IDS]);
    expect(preparation.placeholderCandidateCount).toBe(PRODUCTION_OPERATIONS_PLACEHOLDER_MANIFEST.length);
    expect(preparation.internalMockControlCount).toBeGreaterThanOrEqual(5);
    expect(preparation.missingEvidenceCount).toBe(9);
    expect(preparation.missingEvidenceByGate.incident_response_runbook).toEqual([
      "incident response runbook",
      "breach escalation owner list",
      "client deletion and export operating procedure",
    ]);
    expect(preparation.missingEvidenceByGate.backup_restore_test).toEqual([
      "backup expiry policy",
      "restore drill result",
      "restore owner and cadence",
    ]);
    expect(preparation.missingEvidenceByGate.secret_rotation_plan).toEqual([
      "secret inventory",
      "rotation cadence",
      "emergency revocation procedure",
    ]);
    expect(evidence.production_ops_prepared).toBe(true);
    expect(evidence.ops_launch_gates_open).toBe(true);
    expect(evidence.missing_evidence_count).toBe(9);
    expect(json).not.toContain("+9055");
    expect(json).not.toContain("service_role");
  });

  it("records aggregate ops preparation fields on operational health when metrics are supplied", () => {
    const preparation = evaluatePhase77aiProductionOperationsPreparation();
    const snapshot = buildOperationalHealthSnapshot(createInitialState(), {
      productionOpsPreparation: preparation,
    });

    expect(snapshot.productionOpsPreparationStatus).toBe("pass");
    expect(snapshot.productionOpsPreparationVersion).toBe(preparation.preparationVersion);
    expect(snapshot.productionOpsOpenGateCount).toBe(3);
    expect(snapshot.productionOpsMissingEvidenceCount).toBe(9);
    expect(snapshot.productionOpsLaunchGatesOpen).toBe(true);
  });
});
