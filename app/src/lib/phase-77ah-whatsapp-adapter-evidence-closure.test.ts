import { describe, expect, it } from "vitest";
import {
  PHASE_77AH_WHATSAPP_ADAPTER_EVIDENCE_CLOSURE_VERSION,
  WHATSAPP_ADAPTER_TRACK_PHASE_MANIFEST,
  buildPhase77ahWhatsappAdapterEvidencePackMetrics,
  evaluatePhase77ahWhatsappAdapterEvidenceClosure,
} from "./phase-77ah-whatsapp-adapter-evidence-closure";

describe("phase 77ah whatsapp adapter evidence closure", () => {
  it("closes the 77AA-77AG adapter track with hard-zero channel replay evidence", async () => {
    const closure = await evaluatePhase77ahWhatsappAdapterEvidenceClosure();
    const evidence = buildPhase77ahWhatsappAdapterEvidencePackMetrics(closure);
    const json = JSON.stringify(evidence);

    expect(closure.closureVersion).toBe(PHASE_77AH_WHATSAPP_ADAPTER_EVIDENCE_CLOSURE_VERSION);
    expect(closure.status).toBe("pass");
    expect(closure.whatsappAdapterTrackClosed).toBe(true);
    expect(closure.productionOperationsNext).toBe(true);
    expect(closure.productionPilotGo).toBe(false);
    expect(closure.r405Open).toBe(true);
    expect(closure.channelPolicyGateOpen).toBe(true);
    expect(closure.openLaunchGateCount).toBe(8);
    expect(closure.realWhatsAppConnected).toBe(false);
    expect(closure.realGeminiConnected).toBe(false);
    expect(closure.duplicateClientSendCount).toBe(0);
    expect(closure.unknownIdentityProviderCallCount).toBe(0);
    expect(closure.yellowRedClientSendCount).toBe(0);
    expect(closure.unsafeGreenCount).toBe(0);
    expect(closure.hardZeroFailures).toEqual([]);
    expect(closure.completedTrackPhaseCount).toBe(WHATSAPP_ADAPTER_TRACK_PHASE_MANIFEST.length);
    expect(evidence.whatsapp_adapter_track_closed).toBe(true);
    expect(evidence.production_pilot_go).toBe(false);
    expect(evidence.r405_open).toBe(true);
    expect(evidence.channel_policy_gate_open).toBe(true);
    expect(json).not.toContain("+9055");
    expect(json).not.toContain("Findik yerine badem");
  });
});
