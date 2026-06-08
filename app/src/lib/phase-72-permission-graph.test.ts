import { describe, expect, it } from "vitest";
import {
  PHASE_72_CLINICAL_ESCALATION_ROUTING_MAP,
  PHASE_72_FORBIDDEN_ACTION_MAP,
  PHASE_72_MIXED_INTENT_FAIL_CLOSED_POLICY,
  buildPhase72PermissionGraphBundle,
  buildPhase72PermissionGraphLaunchGateEvidence,
  evaluatePhase72PermissionGraphReadiness,
  evaluatePhase72PermissionRouting,
  evaluatePhase72PromptFieldAccess,
  isPhase72ActiveProductionRoutingAllowed,
} from "./phase-72-permission-graph";

describe("phase 72 regulation permission graph", () => {
  it("builds the supplied interpretation pack as draft artifacts with source references", () => {
    const bundle = buildPhase72PermissionGraphBundle();
    const readiness = evaluatePhase72PermissionGraphReadiness(bundle);

    expect(readiness.status).toBe("pass");
    expect(bundle.approvalStatus).toBe("draft");
    expect(bundle.forbiddenActionMap.length).toBeGreaterThanOrEqual(10);
    expect(bundle.draftOnlyActionMap.length).toBeGreaterThanOrEqual(10);
    expect(bundle.allowedPlanAnswerabilityMap.length).toBeGreaterThanOrEqual(8);
    expect(bundle.allowedGeneralEducationMap.length).toBeGreaterThanOrEqual(6);
    expect(bundle.sensitiveNeverPromptFieldMap.length).toBeGreaterThanOrEqual(15);
    expect(bundle.productCovenantForbiddenPhraseMap.length).toBeGreaterThanOrEqual(5);
    expect(bundle.mixedIntentFailClosedPolicy.id).toBe("mixed-intent-fail-closed");
    expect(PHASE_72_FORBIDDEN_ACTION_MAP.every((entry) => entry.sourceRefs.length > 0)).toBe(true);
    expect(PHASE_72_CLINICAL_ESCALATION_ROUTING_MAP.find((entry) => entry.id === "medication_insulin")).toMatchObject({
      routingBand: "handoff_no_send",
      approvalStatus: "draft",
    });
  });

  it("blocks sensitive never-prompt fields and allows prompt-safe plan fields", () => {
    expect(evaluatePhase72PromptFieldAccess("medication_details")).toMatchObject({
      promptAllowed: false,
      routingBand: "handoff_no_send",
    });
    expect(evaluatePhase72PromptFieldAccess("active_diet_plan_summary")).toMatchObject({
      promptAllowed: true,
      routingBand: "green",
    });
    expect(evaluatePhase72PromptFieldAccess("unknown_custom_field")).toMatchObject({
      promptAllowed: false,
      routingBand: "handoff_no_send",
    });
  });

  it("routes green plan lookup only when plan source and privacy gates are satisfied", () => {
    const routing = evaluatePhase72PermissionRouting({
      intentIds: ["plan_lookup"],
      activePlanAvailable: true,
      privacyGate: {
        channelPermissionReady: true,
        legalPrivacyApproval: true,
        providerVendorApproval: true,
        whatsappPolicyApproval: true,
      },
    });

    expect(routing.finalRoutingBand).toBe("green");
    expect(routing.mixedIntentFailClosed).toBe(false);
    expect(routing.activeProductionRoutingAllowed).toBe(false);
  });

  it("fails closed on mixed green and clinical-risk intents", () => {
    const routing = evaluatePhase72PermissionRouting({
      intentIds: ["plan_lookup", "medication_insulin"],
      activePlanAvailable: true,
      privacyGate: {
        channelPermissionReady: true,
        legalPrivacyApproval: true,
        providerVendorApproval: true,
        whatsappPolicyApproval: true,
      },
    });

    expect(routing.mixedIntentFailClosed).toBe(true);
    expect(routing.finalRoutingBand).toBe("handoff_no_send");
    expect(routing.blockingReasons).toContain(PHASE_72_MIXED_INTENT_FAIL_CLOSED_POLICY.rule);
  });

  it("elevates diabetes glucose to handoff when numeric or acute risk is present", () => {
    const routing = evaluatePhase72PermissionRouting({
      intentIds: ["diabetes_glucose"],
      clinicalContext: { numericGlucoseRisk: true },
    });

    expect(routing.finalRoutingBand).toBe("handoff_no_send");
  });

  it("quarantines unknown identity and blocks active production routing without approved gates", () => {
    const routing = evaluatePhase72PermissionRouting({
      intentIds: ["unknown_identity"],
      privacyGate: { unknownIdentity: true },
    });

    expect(routing.finalRoutingBand).toBe("quarantine");
    expect(routing.triggeredPrivacyGates).toContain("unknown_identity");
    expect(isPhase72ActiveProductionRoutingAllowed()).toBe(false);
    expect(
      isPhase72ActiveProductionRoutingAllowed([
        { gateId: "legal_privacy_review", approvalStatus: "approved" },
        { gateId: "clinical_taxonomy_approval", approvalStatus: "approved" },
      ]),
    ).toBe(false);
  });

  it("includes structured food-rule routing artifacts", () => {
    const bundle = buildPhase72PermissionGraphBundle();
    const routing = evaluatePhase72PermissionRouting({
      intentIds: ["allowed_substitution"],
      activePlanAvailable: true,
      privacyGate: {
        channelPermissionReady: true,
        legalPrivacyApproval: true,
        providerVendorApproval: true,
        whatsappPolicyApproval: true,
      },
      foodRuleDecision: {
        decision: "forbidden_food_rejection",
        reasons: ["food_rule_forbidden_match"],
        queryType: "permission",
      },
    });

    expect(bundle.foodRuleRoutingMap.length).toBeGreaterThanOrEqual(8);
    expect(routing.blockingReasons.some((reason) => reason.startsWith("food_rule_intents:"))).toBe(true);
    expect(routing.finalRoutingBand).toBe("green");
  });

  it("records draft launch-gate evidence for legal and clinical review", () => {
    const evidence = buildPhase72PermissionGraphLaunchGateEvidence();

    expect(evidence).toHaveLength(2);
    expect(evidence.every((record) => record.approvalStatus === "draft")).toBe(true);
    expect(evidence[0]?.coveredEvidence).toContain("official PDF corpus handling decision");
    expect(evidence[1]?.coveredEvidence).toContain("green/yellow/red permission graph");
  });
});
