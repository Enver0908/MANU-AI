import { describe, expect, it } from "vitest";
import {
  evaluatePhase72PermissionRouting,
  PHASE_72_MIXED_INTENT_FAIL_CLOSED_POLICY,
} from "./phase-72-permission-graph";
import {
  applyPermissionGraphToRiskDecision,
  PHASE_76L_PERMISSION_GRAPH_BRIDGE_VERSION,
} from "./phase-76l-permission-graph-runtime";
import { createInitialState } from "./seed-data";

describe("phase 76l permission graph runtime bridge", () => {
  it("audits food-rule permission routing in shadow mode without changing risk level", () => {
    const state = createInitialState();
    const client = state.clients.find((item) => item.id === "client-mert")!;
    const result = applyPermissionGraphToRiskDecision({
      state,
      client,
      message: "Findik yiyebilir miyim?",
      baseDecision: {
        level: "green",
        reasons: ["food_rule_allowed_match"],
        foodRuleDecision: {
          decision: "allowed_food_confirmation",
          reasons: ["food_rule_allowed_match"],
          queryType: "permission",
        },
      },
    });

    expect(result.decision.level).toBe("green");
    expect(result.decision.permissionGraph.mode).toBe("shadow");
    expect(result.decision.permissionGraph.foodRuleIntentIds).toContain("allowed_food_confirmation");
    expect(result.evaluationRecord.bridgeVersion).toBe(PHASE_76L_PERMISSION_GRAPH_BRIDGE_VERSION);
    expect(result.evaluationRecord.status).toBe("evaluated");
  });

  it("fails closed on mixed food-rule green and clinical-risk intents", () => {
    const routing = evaluatePhase72PermissionRouting({
      intentIds: ["allowed_substitution", "medication_insulin"],
      activePlanAvailable: true,
      privacyGate: {
        channelPermissionReady: true,
        legalPrivacyApproval: true,
        providerVendorApproval: true,
        whatsappPolicyApproval: true,
      },
      foodRuleDecision: {
        decision: "allowed_food_confirmation",
        reasons: ["food_rule_allowed_match"],
        queryType: "permission",
      },
    });

    expect(routing.mixedIntentFailClosed).toBe(true);
    expect(routing.finalRoutingBand).toBe("handoff_no_send");
    expect(routing.blockingReasons).toContain(PHASE_72_MIXED_INTENT_FAIL_CLOSED_POLICY.rule);
  });

  it("does not enforce routing without MANU_ALLOW_PHASE_72_ACTIVE_ROUTING", () => {
    const previous = process.env.MANU_ALLOW_PHASE_72_ACTIVE_ROUTING;
    process.env.MANU_ALLOW_PHASE_72_ACTIVE_ROUTING = "true";
    const state = createInitialState();
    const client = state.clients.find((item) => item.id === "client-mert")!;
    const result = applyPermissionGraphToRiskDecision({
      state,
      client,
      message: "Insulin dozumu artirayim mi, findik yiyebilir miyim?",
      baseDecision: {
        level: "green",
        reasons: [],
        foodRuleDecision: {
          decision: "allowed_food_confirmation",
          reasons: ["food_rule_allowed_match"],
          queryType: "permission",
        },
      },
      launchGateEvidence: [],
    });
    process.env.MANU_ALLOW_PHASE_72_ACTIVE_ROUTING = previous;

    expect(result.decision.permissionGraph.activeProductionRoutingAllowed).toBe(false);
    expect(result.decision.level).toBe("green");
  });
});
