import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AppAuthError } from "./auth-context";
import {
  assertShellSessionActivity,
  extractShellSessionRpcCode,
  isShellSessionInactivityLocked,
  mapShellSessionRpcError,
  rejectClientSuppliedSessionIdentity,
  resolveSharedShellSessionIdleClock,
  resolveShellForegroundSessionAction,
  resolveShellSessionActivityHttpFailure,
  SHELL_SESSION_INACTIVITY_MS,
  SHELL_SESSION_INACTIVITY_SQL_INTERVAL,
  SHELL_SESSION_LOGIN_HREF,
  SHELL_SESSION_TOUCH_COOLDOWN_MS,
  shouldWriteShellSessionActivityTouch,
  touchShellSessionActivity,
} from "./phase-85-stage-5-shell-session";

describe("phase-85-stage-5-shell-session", () => {
  it("locks the inactivity window to two hours", () => {
    expect(SHELL_SESSION_INACTIVITY_MS).toBe(7_200_000);
    expect(SHELL_SESSION_INACTIVITY_SQL_INTERVAL).toBe("interval '2 hours'");
    expect(SHELL_SESSION_TOUCH_COOLDOWN_MS).toBe(60_000);
    expect(SHELL_SESSION_LOGIN_HREF).toBe("/login?next=/dashboard");
  });

  it("locks at the exact two-hour boundary with fake clocks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T00:00:00.000Z"));
    const last = Date.now();
    expect(
      isShellSessionInactivityLocked({
        lastInteractiveAt: last,
        now: last + SHELL_SESSION_INACTIVITY_MS - 1,
      }),
    ).toBe(false);
    expect(
      isShellSessionInactivityLocked({
        lastInteractiveAt: last,
        now: last + SHELL_SESSION_INACTIVITY_MS,
      }),
    ).toBe(true);
    expect(
      isShellSessionInactivityLocked({
        lastInteractiveAt: last,
        now: last + SHELL_SESSION_INACTIVITY_MS + 1,
      }),
    ).toBe(true);
    vi.useRealTimers();
  });

  it("keeps the 1-minute write cooldown and ignores hidden-tab touches", () => {
    expect(
      shouldWriteShellSessionActivityTouch({
        visibilityState: "visible",
        online: true,
        runtime: "ready",
        activityPending: true,
        nowMs: 60_000,
        lastActivitySentAtMs: 0,
      }),
    ).toBe(true);
    expect(
      shouldWriteShellSessionActivityTouch({
        visibilityState: "visible",
        online: true,
        runtime: "ready",
        activityPending: true,
        nowMs: 59_999,
        lastActivitySentAtMs: 0,
      }),
    ).toBe(false);
    expect(
      shouldWriteShellSessionActivityTouch({
        visibilityState: "hidden",
        online: true,
        runtime: "ready",
        activityPending: true,
        nowMs: 120_000,
        lastActivitySentAtMs: 0,
      }),
    ).toBe(false);
  });

  it("verifies the server before allowing a foreground activity touch", () => {
    expect(
      resolveShellForegroundSessionAction({
        visibilityState: "hidden",
        serverSession: "active",
      }),
    ).toEqual({
      verifyServer: false,
      touchActivity: false,
      lockAndRedirect: false,
      failClosed: false,
    });
    expect(
      resolveShellForegroundSessionAction({
        visibilityState: "visible",
        serverSession: "active",
      }).touchActivity,
    ).toBe(true);
    expect(
      resolveShellForegroundSessionAction({
        visibilityState: "visible",
        serverSession: "locked",
      }),
    ).toMatchObject({ touchActivity: false, lockAndRedirect: true });
    expect(
      resolveShellForegroundSessionAction({
        visibilityState: "visible",
        serverSession: "failed",
      }),
    ).toMatchObject({ touchActivity: false, failClosed: true });
  });

  it("shares one idle clock across tabs of the same auth session", () => {
    const sessionId = "00000000-0000-4000-8000-000000000321";
    expect(
      resolveSharedShellSessionIdleClock({ tabId: "tab-a", sessionId }),
    ).toBe(resolveSharedShellSessionIdleClock({ tabId: "tab-b", sessionId }));
    expect(resolveSharedShellSessionIdleClock({ tabId: "tab-a", sessionId })).toBe(sessionId);
  });

  it("fail-closes activity HTTP failures instead of keeping access open", () => {
    expect(resolveShellSessionActivityHttpFailure({ status: 401 })).toBe("lock_and_redirect");
    expect(resolveShellSessionActivityHttpFailure({ status: 403 })).toBe("entitlement_blocked");
    expect(resolveShellSessionActivityHttpFailure({ status: null, offline: true })).toBe("offline");
    expect(resolveShellSessionActivityHttpFailure({ status: 500 })).toBe("fail_closed");
    expect(resolveShellSessionActivityHttpFailure({ status: null })).toBe("fail_closed");
  });

  it("does not treat pointer movement or background timers as activity writers", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/dashboard/shell-provider.tsx"),
      "utf8",
    );
    expect(source).toContain('window.addEventListener("pointerdown"');
    expect(source).toContain('window.addEventListener("keydown"');
    expect(source).not.toContain("pointermove");
    expect(source).not.toContain("setInterval");
    expect(source).toContain("resolveShellForegroundSessionAction");
    expect(source).toContain("SHELL_SESSION_LOGIN_HREF");
  });

  it("maps session RPC failures to stable AppAuthError codes", () => {
    expect(() => mapShellSessionRpcError({ message: "session_claim_missing" })).toThrow(
      new AppAuthError(401, "session_claim_missing"),
    );
    expect(() => mapShellSessionRpcError({ message: "session_inactive" })).toThrow(
      new AppAuthError(401, "session_inactive"),
    );
    expect(() => mapShellSessionRpcError({ message: "no_tenant_membership" })).toThrow(
      new AppAuthError(403, "no_tenant_membership"),
    );
  });

  it("extracts known session RPC codes from provider messages", () => {
    expect(extractShellSessionRpcCode({ message: "ERROR: session_inactive" })).toBe("session_inactive");
    expect(extractShellSessionRpcCode({ message: "unexpected" })).toBeNull();
  });

  it("rejects client-supplied session or tenant identity fields", () => {
    expect(() =>
      rejectClientSuppliedSessionIdentity({
        session_id: "00000000-0000-4000-8000-000000000999",
      }),
    ).toThrow(new AppAuthError(400, "forbidden_client_identity_field"));
  });

  it("uses v2 record RPC and maps locked data results after the database write returns", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const supabase = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return {
          data: {
            status: args.p_mode === "touch" ? "locked" : "active",
            sessionId: "00000000-0000-4000-8000-000000000001",
            lastInteractiveAt: "2026-08-03T00:00:00.000Z",
            lockedAt: args.p_mode === "touch" ? "2026-08-03T00:15:00.000Z" : null,
            touched: args.p_mode === "touch",
          },
          error: null,
        };
      },
    };

    await expect(assertShellSessionActivity(supabase as never)).resolves.toMatchObject({
      locked: false,
      sessionId: "00000000-0000-4000-8000-000000000001",
    });
    await expect(touchShellSessionActivity(supabase as never)).rejects.toThrow(
      new AppAuthError(401, "session_inactive"),
    );
    expect(calls).toEqual([
      { name: "p85_stage_5_record_session_activity_v2", args: { p_mode: "assert" } },
      { name: "p85_stage_5_record_session_activity_v2", args: { p_mode: "touch" } },
    ]);
  });
});
