import { describe, expect, it } from "vitest";
import { AppAuthError } from "./auth-context";
import {
  assertShellSessionActivity,
  extractShellSessionRpcCode,
  mapShellSessionRpcError,
  rejectClientSuppliedSessionIdentity,
  SHELL_SESSION_INACTIVITY_MS,
  SHELL_SESSION_TOUCH_COOLDOWN_MS,
  touchShellSessionActivity,
} from "./phase-85-stage-5-shell-session";

describe("phase-85-stage-5-shell-session", () => {
  it("locks the inactivity window to 15 minutes", () => {
    expect(SHELL_SESSION_INACTIVITY_MS).toBe(900_000);
    expect(SHELL_SESSION_TOUCH_COOLDOWN_MS).toBe(60_000);
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
