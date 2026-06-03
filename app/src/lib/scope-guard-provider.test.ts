import { describe, expect, it } from "vitest";
import { isRealScopeGuardProviderAllowed } from "./scope-guard-provider";

describe("scope guard provider gate", () => {
  it("blocks real provider when clinical taxonomy gate is open", () => {
    expect(isRealScopeGuardProviderAllowed([])).toBe(false);
  });

  it("blocks real provider even when gates approved without env flag", () => {
    expect(
      isRealScopeGuardProviderAllowed([
        "legal_privacy_review",
        "clinical_taxonomy_approval",
        "provider_vendor_review",
        "channel_policy_review",
        "incident_response_runbook",
        "backup_restore_test",
        "secret_rotation_plan",
        "dependency_audit_clearance",
      ]),
    ).toBe(false);
  });
});
