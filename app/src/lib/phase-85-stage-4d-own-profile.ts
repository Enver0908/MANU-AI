import { isSupportedLanguageCode, normalizeLanguageCode, type SupportedLanguageCode } from "./languages";

export const PHASE_85_STAGE_4D_OWN_PROFILE_VERSION = "p85-stage-4d-own-profile-v1";

export type OwnProfilePatchInput = {
  displayName?: string;
  uiLanguage?: SupportedLanguageCode;
};

export type OwnProfilePatchResult = {
  profile: {
    displayName: string;
    uiLanguage: SupportedLanguageCode;
  };
  changedFields: Array<"displayName" | "uiLanguage">;
};

const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;

export function validateDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    throw new OwnProfileValidationError("invalid_display_name");
  }
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    throw new OwnProfileValidationError("invalid_display_name");
  }
  if (CONTROL_CHAR_PATTERN.test(trimmed)) {
    throw new OwnProfileValidationError("invalid_display_name");
  }
  return trimmed;
}

export function validateUiLanguage(value: unknown): SupportedLanguageCode {
  if (!isSupportedLanguageCode(value)) {
    throw new OwnProfileValidationError("invalid_ui_language");
  }
  return value;
}

export class OwnProfileValidationError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = "OwnProfileValidationError";
    this.code = code;
  }
}

export function parseOwnProfilePatchBody(body: Record<string, unknown>): OwnProfilePatchInput {
  const allowedKeys = new Set(["displayName", "uiLanguage"]);
  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      throw new OwnProfileValidationError("unknown_field");
    }
  }

  const patch: OwnProfilePatchInput = {};
  if ("displayName" in body) {
    patch.displayName = validateDisplayName(body.displayName);
  }
  if ("uiLanguage" in body) {
    patch.uiLanguage = validateUiLanguage(body.uiLanguage);
  }

  if (!patch.displayName && !patch.uiLanguage) {
    throw new OwnProfileValidationError("profile_patch_empty");
  }

  return patch;
}

export function mapOwnProfileRpcResult(data: unknown): OwnProfilePatchResult {
  if (!data || typeof data !== "object") {
    throw new Error("own_profile_rpc_invalid_response");
  }
  const record = data as {
    profile?: { displayName?: unknown; uiLanguage?: unknown };
    changedFields?: unknown;
  };
  const displayName = typeof record.profile?.displayName === "string" ? record.profile.displayName : "";
  const uiLanguage = normalizeLanguageCode(record.profile?.uiLanguage);
  const changedFields = Array.isArray(record.changedFields)
    ? record.changedFields.filter(
        (field): field is "displayName" | "uiLanguage" => field === "displayName" || field === "uiLanguage",
      )
    : [];

  return {
    profile: { displayName, uiLanguage },
    changedFields,
  };
}

export function mapOwnProfileRpcError(message: string | undefined): string {
  const normalized = String(message || "").toLowerCase();
  if (normalized.includes("unauthenticated")) return "unauthenticated";
  if (normalized.includes("no_tenant_membership")) return "no_tenant_membership";
  if (normalized.includes("no_dietitian_profile")) return "no_dietitian_profile";
  if (normalized.includes("inactive_subscription")) return "inactive_subscription";
  if (normalized.includes("invalid_display_name")) return "invalid_display_name";
  if (normalized.includes("invalid_ui_language")) return "invalid_ui_language";
  if (normalized.includes("profile_patch_empty")) return "profile_patch_empty";
  return "own_profile_update_failed";
}
