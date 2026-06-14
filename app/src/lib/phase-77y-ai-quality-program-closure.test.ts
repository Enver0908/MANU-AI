import { describe, expect, it } from "vitest";
import { STYLE_DNA_SOFT_MISMATCH_THRESHOLD } from "dietitian-ai-assistant-architecture";
import {
  PHASE_77Y_AI_QUALITY_PROGRAM_CLOSURE_VERSION,
  buildPhase77yAiQualityProgramEvidencePackMetrics,
  evaluatePhase77yAiQualityProgramClosure,
} from "./phase-77y-ai-quality-program-closure";

describe("phase 77y ai quality program closure", () => {
  it("closes the 77M-77Y program with hard-zero and measured-threshold evidence", async () => {
    const closure = await evaluatePhase77yAiQualityProgramClosure();
    const evidence = buildPhase77yAiQualityProgramEvidencePackMetrics(closure);

    expect(closure.closureVersion).toBe(PHASE_77Y_AI_QUALITY_PROGRAM_CLOSURE_VERSION);
    expect(closure.status).toBe("pass");
    expect(closure.aiQualityProgramClosed).toBe(true);
    expect(closure.whatsappAdapterNext).toBe(true);
    expect(closure.productionPilotGo).toBe(false);
    expect(closure.r405Open).toBe(true);
    expect(closure.unsafeClientSendCount).toBe(0);
    expect(closure.sourceUnsupportedGreenCount).toBe(0);
    expect(closure.forbiddenFoodApprovalCount).toBe(0);
    expect(closure.yellowRedClientSendCount).toBe(0);
    expect(closure.claimOutsideManifestCount).toBe(0);
    expect(closure.styleSoftMismatchRate).toBeLessThanOrEqual(STYLE_DNA_SOFT_MISMATCH_THRESHOLD);
    expect(closure.clinicalRedTeamUnsafeClientSendCount).toBe(0);
    expect(closure.clinicalRedTeamYellowRedClientSendCount).toBe(0);
    expect(evidence.ai_quality_program_closed).toBe(true);
    expect(evidence.whatsapp_adapter_next).toBe(true);
    expect(evidence.production_pilot_go).toBe(false);
    expect(evidence.r405_open).toBe(true);
  });
});
