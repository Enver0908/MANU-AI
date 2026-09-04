import type { SupabaseClient } from "@supabase/supabase-js";
import { AppAuthError } from "./auth-context";
export {
  isShellSessionInactivityLocked,
  resolveSharedShellSessionIdleClock,
  resolveShellForegroundSessionAction,
  resolveShellSessionActivityHttpFailure,
  SHELL_SESSION_INACTIVITY_MS,
  SHELL_SESSION_INACTIVITY_SQL_INTERVAL,
  SHELL_SESSION_LOGIN_HREF,
  SHELL_SESSION_TOUCH_COOLDOWN_MS,
  shouldWriteShellSessionActivityTouch,
  type ShellServerSessionCheck,
} from "./phase-85-stage-5-shell-session-policy";

export const PHASE_85_STAGE_5_SHELL_SESSION_VERSION = "p85-stage-5-shell-session-v1";

export type ShellSessionActivityResult = {
  sessionId: string;
  locked: boolean;
  lastInteractiveAt: string;
  lockedAt?: string | null;
  touched?: boolean;
};

type ShellSessionActivityRpcResult = {
  status?: "active" | "locked";
  sessionId?: string;
  locked?: boolean;
  lastInteractiveAt?: string;
  lockedAt?: string | null;
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

export type ShellSessionActorRef = {
  sessionId: string;
  authUserId: string;
  tenantId: string;
  dietitianId: string;
};

async function recordShellSessionActivity(
  admin: SupabaseClient,
  actor: ShellSessionActorRef,
  mode: "assert" | "touch",
): Promise<ShellSessionActivityResult> {
  const { data, error } = await admin.rpc("p85_stage_5_record_session_activity_v3", {
    p_mode: mode,
    p_session_id: actor.sessionId,
    p_auth_user_id: actor.authUserId,
    p_tenant_id: actor.tenantId,
    p_dietitian_id: actor.dietitianId,
  });
  if (error) {
    mapShellSessionRpcError(error);
  }
  const result = toShellSessionActivityResult(data);
  return {
    ...result,
    sessionId: result.sessionId || actor.sessionId,
  };
}

export async function assertShellSessionActivity(
  admin: SupabaseClient,
  actor: ShellSessionActorRef,
): Promise<ShellSessionActivityResult> {
  return recordShellSessionActivity(admin, actor, "assert");
}

export async function touchShellSessionActivity(
  admin: SupabaseClient,
  actor: ShellSessionActorRef,
): Promise<ShellSessionActivityResult> {
  return recordShellSessionActivity(admin, actor, "touch");
}

function toShellSessionActivityResult(data: unknown): ShellSessionActivityResult {
  const row = (data ?? {}) as ShellSessionActivityRpcResult;
  const locked = row.status === "locked" || row.locked === true;
  const sessionId = String(row.sessionId ?? "");
  const lastInteractiveAt = String(row.lastInteractiveAt ?? "");
  if (locked) {
    throw new AppAuthError(401, "session_inactive");
  }
  return {
    sessionId,
    locked: false,
    lastInteractiveAt,
    lockedAt: row.lockedAt ?? null,
    touched: row.touched,
  };
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
