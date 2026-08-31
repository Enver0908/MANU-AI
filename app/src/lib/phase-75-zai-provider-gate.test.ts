import { afterEach, describe, expect, it } from "vitest";
import {
  PHASE_75_FORBIDDEN_PROVIDER_SURFACES,
  PHASE_75_GREEN_MODEL_ID,
  PHASE_75_REQUIRED_GATE_EVIDENCE,
  PHASE_75_YELLOW_MODEL_ID,
  buildPhase75ZaiProviderLaunchGateEvidence,
  evaluatePhase75ZaiProviderRouting,
  evaluatePhase75PromptContextFieldEligibility,
  evaluatePhase75ProviderPackReadiness,
  isPhase75HealthEligibilitySatisfied,
  isPhase75RealZaiEgressAllowed,
} from "./phase-75-zai-provider-gate";

const approvedGates = [
  {
    gateId: "legal_privacy_review",
    artifactTitle: "Legal memo",
    artifactRef: "legal-v1",
    approvalStatus: "approved" as const,
    coveredEvidence: ["legal basis matrix"],
    sanitizedReference: true,
  },
  {
    gateId: "provider_vendor_review",
    artifactTitle: "Provider memo",
    artifactRef: "provider-v1",
    approvalStatus: "approved" as const,
    coveredEvidence: ["provider requirements"],
    sanitizedReference: true,
  },
];

describe("phase 75 Z.ai GLM-5.3-Flash provider gate", () => {
  afterEach(() => {
    delete process.env.MANU_ALLOW_REAL_ZAI;
  });

  it("captures forbidden surfaces, gate evidence, and draft launch-gate artifacts", () => {
    const readiness = evaluatePhase75ProviderPackReadiness();
    const evidence = buildPhase75ZaiProviderLaunchGateEvidence();

    expect(readiness.status).toBe("pass");
    expect(PHASE_75_FORBIDDEN_PROVIDER_SURFACES.length).toBeGreaterThanOrEqual(10);
    expect(PHASE_75_REQUIRED_GATE_EVIDENCE.length).toBeGreaterThanOrEqual(14);
    expect(evidence.every((record) => record.approvalStatus === "draft")).toBe(true);
    expect(evidence.map((record) => record.gateId).sort()).toEqual([
      "legal_privacy_review",
      "provider_vendor_review",
    ]);
  });

  it("blocks forbidden prompt fields and allows allowlisted fields only", () => {
    expect(evaluatePhase75PromptContextFieldEligibility("whatsapp_phone_e164").providerInputAllowed).toBe(
      false,
    );
    expect(evaluatePhase75PromptContextFieldEligibility("allergies").providerInputAllowed).toBe(true);
    expect(evaluatePhase75PromptContextFieldEligibility("response_plan").providerInputAllowed).toBe(true);
    expect(evaluatePhase75PromptContextFieldEligibility("claim_manifest").providerInputAllowed).toBe(true);
    expect(evaluatePhase75PromptContextFieldEligibility("style_dna").providerInputAllowed).toBe(true);
    expect(evaluatePhase75PromptContextFieldEligibility("unknown_field").providerInputAllowed).toBe(false);
  });

  it("never routes red risk to a provider", () => {
    const evaluation = evaluatePhase75ZaiProviderRouting({
      riskLevel: "red",
      clientAiMode: "autopilot",
      clientAiActive: true,
      sourceBacked: true,
      sensitiveIntentBlocked: false,
      passiveOrManual: false,
      unknownIdentity: false,
      groupMessage: false,
      optOut: false,
      removedClient: false,
    });

    expect(evaluation.routingBand).toBe("no_provider");
    expect(evaluation.modelId).toBeNull();
    expect(evaluation.providerAttemptAllowed).toBe(false);
    expect(evaluation.blockingReasons).toContain("red risk blocks provider");
  });

  it("routes yellow to internal draft only without client send", () => {
    const evaluation = evaluatePhase75ZaiProviderRouting({
      riskLevel: "yellow",
      clientAiMode: "autopilot",
      clientAiActive: true,
      sourceBacked: false,
      sensitiveIntentBlocked: false,
      passiveOrManual: false,
      unknownIdentity: false,
      groupMessage: false,
      optOut: false,
      removedClient: false,
    });

    expect(evaluation.routingBand).toBe("yellow_internal_draft");
    expect(evaluation.modelId).toBe(PHASE_75_YELLOW_MODEL_ID);
    expect(evaluation.providerAttemptAllowed).toBe(true);
    expect(evaluation.clientFacingSendAllowed).toBe(false);
    expect(evaluation.blockingReasons).toContain("yellow provider is internal draft/handoff only");
  });

  it("blocks green provider attempts without source-backed answerability", () => {
    const evaluation = evaluatePhase75ZaiProviderRouting({
      riskLevel: "green",
      clientAiMode: "autopilot",
      clientAiActive: true,
      sourceBacked: false,
      sensitiveIntentBlocked: false,
      passiveOrManual: false,
      unknownIdentity: false,
      groupMessage: false,
      optOut: false,
      removedClient: false,
    });

    expect(evaluation.routingBand).toBe("no_provider");
    expect(evaluation.providerAttemptAllowed).toBe(false);
    expect(evaluation.blockingReasons).toContain("green requires source-backed answerability");
  });

  it("routes qualified green autopilot to flash send candidate", () => {
    const evaluation = evaluatePhase75ZaiProviderRouting({
      riskLevel: "green",
      clientAiMode: "autopilot",
      clientAiActive: true,
      sourceBacked: true,
      sensitiveIntentBlocked: false,
      passiveOrManual: false,
      unknownIdentity: false,
      groupMessage: false,
      optOut: false,
      removedClient: false,
    });

    expect(evaluation.routingBand).toBe("green_autopilot_send_candidate");
    expect(evaluation.modelId).toBe(PHASE_75_GREEN_MODEL_ID);
    expect(evaluation.providerAttemptAllowed).toBe(true);
    expect(evaluation.clientFacingSendAllowed).toBe(true);
  });

  it("keeps real Z.ai egress blocked without env flag and approved gates", () => {
    expect(isPhase75RealZaiEgressAllowed()).toBe(false);
    expect(isPhase75HealthEligibilitySatisfied(approvedGates)).toBe(true);

    process.env.MANU_ALLOW_REAL_ZAI = "true";
    expect(isPhase75RealZaiEgressAllowed(approvedGates)).toBe(true);
    expect(isPhase75RealZaiEgressAllowed()).toBe(false);
  });
});
