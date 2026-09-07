import { describe, expect, it } from "vitest";
import {
  AccountContractValidationError,
  canManageAccountSettings,
  mapAccountWorkspaceRpcError,
  parseAccountWorkspacePatchBody,
  validateExpectedSettingsRevision,
  validateWorkspaceName,
} from "./phase-85-stage-4d-account-contracts";

describe("phase-85-stage-4d account contracts", () => {
  it("validates workspace name and expected revision for CAS mutations", () => {
    expect(validateWorkspaceName("  MANU Clinic  ")).toBe("MANU Clinic");
    expect(validateExpectedSettingsRevision(2)).toBe(2);
    expect(parseAccountWorkspacePatchBody({ name: "MANU Clinic", expectedSettingsRevision: 4 })).toEqual({
      name: "MANU Clinic",
      expectedSettingsRevision: 4,
    });
  });

  it("rejects unsafe workspace patch payloads", () => {
    expect(() => parseAccountWorkspacePatchBody({ tenantId: "x", name: "Clinic", expectedSettingsRevision: 1 })).toThrow(
      AccountContractValidationError,
    );
    expect(() => validateWorkspaceName("a")).toThrow(AccountContractValidationError);
    expect(() => validateWorkspaceName("Clinic\u0000Name")).toThrow(AccountContractValidationError);
    expect(() => validateExpectedSettingsRevision(-1)).toThrow(AccountContractValidationError);
    expect(() => validateExpectedSettingsRevision(1.5)).toThrow(AccountContractValidationError);
  });

  it("limits account setting management to owner and admin", () => {
    expect(canManageAccountSettings("owner")).toBe(true);
    expect(canManageAccountSettings("admin")).toBe(true);
    expect(canManageAccountSettings("dietitian")).toBe(false);
    expect(canManageAccountSettings("assistant")).toBe(false);
    expect(canManageAccountSettings("auditor")).toBe(false);
  });

  it("maps RPC errors to safe client codes", () => {
    expect(mapAccountWorkspaceRpcError("settings_revision_conflict")).toBe("settings_revision_conflict");
    expect(mapAccountWorkspaceRpcError("rbac_forbidden_manage_account_settings")).toBe(
      "rbac_forbidden_manage_account_settings",
    );
  });
});

