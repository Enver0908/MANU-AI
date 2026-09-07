import type { TenantRole } from "./types";

export type AppCapability =
  | "read_app_state"
  | "reset_app_state"
  | "create_client"
  | "update_client"
  | "simulate_inbound"
  | "manual_reply"
  | "draft_review"
  | "handoff_update"
  | "notification_update"
  | "export_client"
  | "anonymize_client"
  | "release_takeover"
  | "internal_copilot_chat"
  | "dietitian_ai_chat"
  | "read_operational_foundation"
  | "revoke_tenant_channel_bindings"
  | "update_own_profile";

export function hasCapability(role: TenantRole, capability: AppCapability) {
  if (capability === "read_operational_foundation" || capability === "revoke_tenant_channel_bindings") {
    return role === "owner" || role === "admin";
  }

  if (capability === "dietitian_ai_chat") {
    return role === "owner" || role === "admin" || role === "dietitian";
  }

  if (capability === "update_own_profile") {
    return role === "owner" || role === "admin" || role === "dietitian";
  }

  if (role === "owner" || role === "admin" || role === "dietitian") {
    return true;
  }

  if (role === "assistant" || role === "auditor") {
    return capability === "read_app_state";
  }

  return false;
}
