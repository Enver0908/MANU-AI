export const SHELL_SESSION_INACTIVITY_MS = 7_200_000;
export const SHELL_SESSION_TOUCH_COOLDOWN_MS = 60_000;
export const SHELL_SESSION_INACTIVITY_SQL_INTERVAL = "interval '2 hours'";
export const SHELL_SESSION_LOGIN_HREF = "/login?next=/dashboard";

export type ShellServerSessionCheck = "active" | "locked" | "failed";

export function isShellSessionInactivityLocked(input: {
  lastInteractiveAt: string | number | Date;
  now?: string | number | Date;
}): boolean {
  const last = new Date(input.lastInteractiveAt).getTime();
  const now = new Date(input.now ?? Date.now()).getTime();
  if (!Number.isFinite(last) || !Number.isFinite(now)) {
    return true;
  }
  return last + SHELL_SESSION_INACTIVITY_MS <= now;
}

export function shouldWriteShellSessionActivityTouch(input: {
  visibilityState: "visible" | "hidden" | string;
  online: boolean;
  runtime: string;
  activityPending: boolean;
  nowMs: number;
  lastActivitySentAtMs: number;
  cooldownMs?: number;
}): boolean {
  if (input.visibilityState !== "visible") return false;
  if (!input.online) return false;
  if (input.runtime === "offline" || input.runtime === "session_locked") return false;
  if (!input.activityPending) return false;
  const cooldown = input.cooldownMs ?? SHELL_SESSION_TOUCH_COOLDOWN_MS;
  return input.nowMs - input.lastActivitySentAtMs >= cooldown;
}

export function resolveShellForegroundSessionAction(input: {
  visibilityState: "visible" | "hidden" | string;
  serverSession: ShellServerSessionCheck;
}): {
  verifyServer: boolean;
  touchActivity: boolean;
  lockAndRedirect: boolean;
  failClosed: boolean;
} {
  if (input.visibilityState !== "visible") {
    return {
      verifyServer: false,
      touchActivity: false,
      lockAndRedirect: false,
      failClosed: false,
    };
  }
  if (input.serverSession === "locked") {
    return {
      verifyServer: true,
      touchActivity: false,
      lockAndRedirect: true,
      failClosed: false,
    };
  }
  if (input.serverSession === "failed") {
    return {
      verifyServer: true,
      touchActivity: false,
      lockAndRedirect: false,
      failClosed: true,
    };
  }
  return {
    verifyServer: true,
    touchActivity: true,
    lockAndRedirect: false,
    failClosed: false,
  };
}

export function resolveSharedShellSessionIdleClock(input: {
  tabId: string;
  sessionId: string;
}) {
  return input.sessionId;
}

export function resolveShellSessionActivityHttpFailure(input: {
  status: number | null;
  offline?: boolean;
}): "lock_and_redirect" | "entitlement_blocked" | "offline" | "fail_closed" {
  if (input.offline) return "offline";
  if (input.status === 401) return "lock_and_redirect";
  if (input.status === 403) return "entitlement_blocked";
  return "fail_closed";
}
