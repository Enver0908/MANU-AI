import type { SupabaseClient } from "@supabase/supabase-js";
import { AppAuthError } from "./auth-context";

export const PHASE_85_STAGE_5_SHELL_SESSION_VERSION = "p85-stage-5-shell-session-v1";
export const SHELL_SESSION_INACTIVITY_MS = 15 * 60_000;
export const SHELL_SESSION_TOUCH_COOLDOWN_MS = 60_000;

export type ShellSessionActivityResult = {
  sessionId: string;
  locked: boolean;
  lastInteractiveAt: string;
  touched?: boolean;
};

const SESSION_RPC_ERROR_CODES = [
  "session_claim_missing",
  "session_inactive",
  "session_claim_mismatch",
  "unauthenticated",
  "no_tenant_membership",
  "no_dietitian_profile",
] as const;

export function readVerifiedSessionIdFromAccessToken(accessToken: string | null | undefined) {
  if (!accessToken) {
    return null;
  }

  const parts = accessToken.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      session_id?: unknown;
    };
    return typeof payload.session_id === "string" && payload.session_id.length > 0
      ? payload.session_id
      : null;
  } catch {
    return null;
  }
}

export function mapShellSessionRpcError(error: { message?: string | null }): never {
  const message = String(error.message ?? "");
  for (const code of SESSION_RPC_ERROR_CODES) {
    if (message.includes(code)) {
      const status = code === "no_tenant_membership" || code === "no_dietitian_profile" ? 403 : 401;
      throw new AppAuthError(status, code);
    }
  }
  throw error;
}

export function extractShellSessionRpcCode(error: { message?: string | null }) {
  const message = String(error.message ?? "");
  return SESSION_RPC_ERROR_CODES.find((code) => message.includes(code)) ?? null;
}

export async function assertShellSessionActivity(
  supabase: SupabaseClient,
): Promise<ShellSessionActivityResult> {
  const { data, error } = await supabase.rpc("p85_stage_5_assert_session_activity_v1");
  if (error) {
    mapShellSessionRpcError(error);
  }
  return data as ShellSessionActivityResult;
}

export async function touchShellSessionActivity(
  supabase: SupabaseClient,
): Promise<ShellSessionActivityResult> {
  const { data, error } = await supabase.rpc("p85_stage_5_touch_session_activity_v1");
  if (error) {
    mapShellSessionRpcError(error);
  }
  return data as ShellSessionActivityResult;
}

export function rejectClientSuppliedSessionIdentity(body: Record<string, unknown> | null | undefined) {
  if (!body) return;
  const forbiddenKeys = [
    "sessionId",
    "session_id",
    "authUserId",
    "auth_user_id",
    "userId",
    "user_id",
    "tenantId",
    "tenant_id",
    "dietitianId",
    "dietitian_id",
    "clientTimestamp",
    "client_timestamp",
    "serverTime",
    "server_time",
  ];
  for (const key of forbiddenKeys) {
    if (key in body) {
      throw new AppAuthError(400, "forbidden_client_identity_field");
    }
  }
}
