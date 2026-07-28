import { describe, expect, it } from "vitest";
import {
  AccountSecurityValidationError,
  buildAccountRecoveryFlowCookieValue,
  buildAccountSecurityIdempotencyKey,
  genericMagicLinkAcceptedResponse,
  mapSupabaseAuthErrorMessage,
  minimizeAccountSecurityMetadata,
  validateAccountEmail,
  validatePassword,
  validatePasswordPair,
  verifyAccountRecoveryFlowCookie,
} from "./phase-85-stage-4d-account-security";

describe("phase-85-stage-4d account security", () => {
  it("validates email and password rules", () => {
    expect(validateAccountEmail("user@example.com")).toBe("user@example.com");
    expect(validatePassword("Aa1!abcdefgh")).toBe("Aa1!abcdefgh");
    expect(validatePasswordPair("Aa1!abcdefgh", "Aa1!abcdefgh")).toBe("Aa1!abcdefgh");
  });

  it("rejects weak or mismatched passwords", () => {
    expect(() => validatePassword("short")).toThrow(AccountSecurityValidationError);
    expect(() => validatePasswordPair("Aa1!abcdefgh", "Aa1!abcdefghx")).toThrow(
      AccountSecurityValidationError,
    );
  });

  it("maps provider errors to safe codes", () => {
    expect(mapSupabaseAuthErrorMessage("Invalid login credentials")).toBe("invalid_credentials");
    expect(mapSupabaseAuthErrorMessage("Nonce has expired")).toBe("invalid_or_expired_nonce");
  });

  it("minimizes audit metadata without sensitive values", () => {
    const metadata = minimizeAccountSecurityMetadata({
      minimized: true,
      providerCode: "invalid_credentials",
      email: "secret@example.com",
      password: "Aa1!secret",
    });
    expect(metadata).toEqual({ minimized: true, providerCode: "invalid_credentials" });
    expect(JSON.stringify(metadata)).not.toContain("secret@example.com");
  });

  it("returns enumeration-safe magic-link acceptance payload", () => {
    expect(genericMagicLinkAcceptedResponse().message).toContain("account exists");
    expect(buildAccountSecurityIdempotencyKey("password_login", "user@example.com").length).toBe(64);
  });

  it("signs and expires account recovery flow cookies", () => {
    const env = { MANU_ACCOUNT_RECOVERY_COOKIE_SECRET: "test-secret" };
    const value = buildAccountRecoveryFlowCookieValue({
      authUserId: "user-1",
      nowMs: 1000,
      env,
    });

    expect(
      verifyAccountRecoveryFlowCookie({
        value,
        authUserId: "user-1",
        nowMs: 2000,
        env,
      }),
    ).toBe(true);
    expect(
      verifyAccountRecoveryFlowCookie({
        value,
        authUserId: "user-2",
        nowMs: 2000,
        env,
      }),
    ).toBe(false);
    expect(
      verifyAccountRecoveryFlowCookie({
        value,
        authUserId: "user-1",
        nowMs: 1_000_000,
        env,
      }),
    ).toBe(false);
  });
});
