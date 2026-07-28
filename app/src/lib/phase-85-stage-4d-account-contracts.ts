import type { TenantRole } from "./types";

export const PHASE_85_STAGE_4D_ACCOUNT_CONTRACTS_VERSION = "p85-stage-4d-account-contracts-v1";

export type AccountWorkspaceReadModel = {
  name: string;
  settingsRevision: number;
  role: TenantRole | "member";
  membershipActive: boolean;
};

export type AccountWorkspacePatchInput = {
  name: string;
  expectedSettingsRevision: number;
};

export type AccountMemberReadModel = {
  displayName: string;
  role: TenantRole;
  membershipActive: boolean;
  joinedAt: string;
};

export class AccountContractValidationError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = "AccountContractValidationError";
    this.code = code;
  }
}

const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;

export function validateWorkspaceName(value: unknown): string {
  if (typeof value !== "string") {
    throw new AccountContractValidationError("invalid_workspace_name");
  }
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 80 || CONTROL_CHAR_PATTERN.test(trimmed)) {
    throw new AccountContractValidationError("invalid_workspace_name");
  }
  return trimmed;
}

export function validateExpectedSettingsRevision(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER
  ) {
    throw new AccountContractValidationError("invalid_expected_settings_revision");
  }
  return value;
}

export function parseAccountWorkspacePatchBody(body: Record<string, unknown>): AccountWorkspacePatchInput {
  const allowedKeys = new Set(["name", "expectedSettingsRevision"]);
  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      throw new AccountContractValidationError("unknown_field");
    }
  }

  return {
    name: validateWorkspaceName(body.name),
    expectedSettingsRevision: validateExpectedSettingsRevision(body.expectedSettingsRevision),
  };
}

export function canManageAccountSettings(role: TenantRole | string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function mapAccountWorkspaceRpcError(message: string | undefined): string {
  const normalized = String(message || "").toLowerCase();
  if (normalized.includes("unauthenticated")) return "unauthenticated";
  if (normalized.includes("no_tenant_membership")) return "no_tenant_membership";
  if (normalized.includes("rbac_forbidden_manage_account_settings")) return "rbac_forbidden_manage_account_settings";
  if (normalized.includes("invalid_workspace_name")) return "invalid_workspace_name";
  if (normalized.includes("invalid_expected_settings_revision")) return "invalid_expected_settings_revision";
  if (normalized.includes("settings_revision_conflict")) return "settings_revision_conflict";
  return "account_workspace_update_failed";
}
