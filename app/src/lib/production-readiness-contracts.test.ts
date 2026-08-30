import { describe, expect, it } from "vitest";
import { PRODUCTION_PILOT_LAUNCH_GATES, resolveProductionPilotLaunchGatesForScope } from "./launch-gates";
import {
  PRODUCTION_READINESS_ERROR_CATEGORIES,
  PRODUCTION_READINESS_OPERATIONS,
  TURKEY_FIRST_DIRECT_LAUNCH_SCOPE,
  evaluateProductionReadinessBoundary,
  resolveProductionReadinessEnvironmentProfile,
  summarizeProductionReadinessStage1Phase1,
} from "./production-readiness-contracts";

const TURKEY_FIRST_GATE_IDS = resolveProductionPilotLaunchGatesForScope({
  channels: { whatsapp: true, telegram: false },
}).map((gate) => gate.id);

describe("production readiness stage 1 phase 1 contracts", () => {
  it("resolves runtime profiles from explicit app and hosted sandbox environment", () => {
    expect(resolveProductionReadinessEnvironmentProfile({ NODE_ENV: "development" })).toBe("local");
    expect(resolveProductionReadinessEnvironmentProfile({ NODE_ENV: "production" })).toBe("production");
    expect(resolveProductionReadinessEnvironmentProfile({ MANU_APP_ENV: "production" })).toBe("production");
    expect(resolveProductionReadinessEnvironmentProfile({ MANU_HOSTED_SANDBOX_ACTIVE: "true" })).toBe(
      "hosted_sandbox",
    );
  });

  it("documents the exact first production launch scope", () => {
    expect(TURKEY_FIRST_DIRECT_LAUNCH_SCOPE).toMatchObject({
      geography: "TR",
      targetDietitianCount: 100,
      targetClientCount: 5000,
      paymentRail: "manual_bank_transfer",
      physicalIphoneValidation: "WAIVED_NOT_EXECUTED",
      channels: { whatsapp: true, telegram: false },
    });
  });

  it("blocks real egress by default with stable error categories", () => {
    const decision = evaluateProductionReadinessBoundary({
      env: {},
      provider: "whatsapp",
      operation: "whatsapp_send",
    });

    expect(decision.realEgressAllowed).toBe(false);
    expect(decision.errorCategory).toBe("not_configured");
    expect(decision.blockingReasons).toContain("real whatsapp egress flag is not enabled");
    expect(decision.blockingReasons).toContain("approved launch gates must come from server authority");
    expect(decision.openGateIds).toEqual(TURKEY_FIRST_GATE_IDS);
  });

  it("does not let client-supplied approved gate ids authorize real egress", () => {
    const decision = evaluateProductionReadinessBoundary({
      env: { MANU_APP_ENV: "production", MANU_ALLOW_REAL_WHATSAPP: "true" },
      provider: "whatsapp",
      operation: "whatsapp_receive",
      approvedGateIds: TURKEY_FIRST_GATE_IDS,
      approvedGateIdsSource: "client_supplied",
      launchAuthorizationApproved: true,
      tenantEntitlementActive: true,
      tenantPermissionGranted: true,
      contextAuthority: "server",
    });

    expect(decision.realEgressAllowed).toBe(false);
    expect(decision.errorCategory).toBe("not_authorized");
    expect(decision.blockingReasons).toContain("approved launch gates must come from server authority");
  });

  it("blocks production egress when demo or fixture flags are enabled", () => {
    const decision = evaluateProductionReadinessBoundary({
      env: {
        MANU_APP_ENV: "production",
        MANU_ALLOW_REAL_GEMINI: "true",
        MANU_DEV_FALLBACK_STORE: "true",
        AI_CHAT_DETERMINISTIC_MODE: "true",
      },
      provider: "gemini",
      operation: "ai_text_generate",
      approvedGateIds: TURKEY_FIRST_GATE_IDS,
      approvedGateIdsSource: "server_authority",
      launchAuthorizationApproved: true,
      tenantEntitlementActive: true,
      tenantPermissionGranted: true,
      contextAuthority: "server",
    });

    expect(decision.realEgressAllowed).toBe(false);
    expect(decision.blockingReasons).toContain(
      "production fixture/demo flags are enabled: MANU_DEV_FALLBACK_STORE, AI_CHAT_DETERMINISTIC_MODE",
    );
  });

  it("keeps Telegram outside the Turkey-first launch scope even when every default gate id is supplied", () => {
    const decision = evaluateProductionReadinessBoundary({
      env: { MANU_APP_ENV: "production", MANU_ALLOW_REAL_TELEGRAM: "true" },
      provider: "telegram",
      operation: "whatsapp_send",
      approvedGateIds: PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id),
      approvedGateIdsSource: "server_authority",
      launchAuthorizationApproved: true,
      tenantEntitlementActive: true,
      tenantPermissionGranted: true,
      contextAuthority: "server",
    });

    expect(decision.realEgressAllowed).toBe(false);
    expect(decision.blockingReasons).toContain("telegram is outside the Turkey-first launch scope");
  });

  it("allows a real WhatsApp operation only when every production boundary is server-approved", () => {
    const decision = evaluateProductionReadinessBoundary({
      env: { MANU_APP_ENV: "production", MANU_ALLOW_REAL_WHATSAPP: "true" },
      provider: "whatsapp",
      operation: "whatsapp_connect",
      approvedGateIds: TURKEY_FIRST_GATE_IDS,
      approvedGateIdsSource: "server_authority",
      launchAuthorizationApproved: true,
      tenantEntitlementActive: true,
      tenantPermissionGranted: true,
      contextAuthority: "server",
    });

    expect(decision.realEgressAllowed).toBe(true);
    expect(decision.errorCategory).toBeNull();
    expect(decision.blockingReasons).toEqual([]);
  });

  it("summarizes the contract without claiming production GO", () => {
    const summary = summarizeProductionReadinessStage1Phase1();

    expect(summary.productionPilotGo).toBe(false);
    expect(summary.operations).toEqual([...PRODUCTION_READINESS_OPERATIONS]);
    expect(summary.errorCategories).toEqual([...PRODUCTION_READINESS_ERROR_CATEGORIES]);
    expect(JSON.stringify(summary)).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|sk-[A-Za-z0-9]+/);
  });
});
