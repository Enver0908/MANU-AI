import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADMIN_ALLOWLIST_EMAIL,
  buildAdminAuthCallbackUrlWithNext,
  evaluateAdminAllowlistAccess,
  isAdminHost,
  resolveAdminAppBaseUrl,
  resolveAdminEmailAllowlist,
  resolveAdminHostInternalPath,
  shouldRewriteAdminHostPath,
  summarizePhase84fAdminConsole,
} from "./phase-84f-admin-console";

describe("phase 84f admin console", () => {
  it("parses the default admin allowlist", () => {
    expect(resolveAdminEmailAllowlist({})).toEqual([DEFAULT_ADMIN_ALLOWLIST_EMAIL]);
    expect(
      resolveAdminEmailAllowlist({
        MANU_ADMIN_EMAIL_ALLOWLIST: " Admin@Example.com , ops@example.com ",
      }),
    ).toEqual(["admin@example.com", "ops@example.com"]);
  });

  it("allows only allowlisted admin emails", () => {
    expect(evaluateAdminAllowlistAccess("olkuenver@gmail.com").allowed).toBe(true);
    expect(evaluateAdminAllowlistAccess("other@example.com").blockingReasons).toContain(
      "admin_email_not_allowlisted",
    );
  });

  it("detects admin hostnames", () => {
    expect(isAdminHost("admin.siriusai.store")).toBe(true);
    expect(isAdminHost("siriusai.store")).toBe(false);
  });

  it("builds admin auth callback from the admin app url contract", () => {
    expect(
      buildAdminAuthCallbackUrlWithNext("/admin", {
        NEXT_PUBLIC_APP_URL: "https://siriusai.store",
        MANU_ADMIN_HOST: "admin.siriusai.store",
      }),
    ).toBe("https://admin.siriusai.store/auth/callback?next=%2Fadmin");
    expect(
      buildAdminAuthCallbackUrlWithNext("/admin", {
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
        MANU_ADMIN_HOST: "admin.siriusai.store",
      }),
    ).toBe("http://127.0.0.1:3000/auth/callback?next=%2Fadmin");
    expect(
      resolveAdminAppBaseUrl({
        MANU_ADMIN_APP_URL: "https://admin.example.com/",
        NEXT_PUBLIC_APP_URL: "https://siriusai.store",
      }),
    ).toBe("https://admin.example.com");
  });

  it("rewrites admin host paths to /admin", () => {
    expect(shouldRewriteAdminHostPath("/")).toBe(true);
    expect(shouldRewriteAdminHostPath("/admin")).toBe(false);
    expect(shouldRewriteAdminHostPath("/api/commercial/admin/health")).toBe(false);
    expect(shouldRewriteAdminHostPath("/auth/callback")).toBe(false);
    expect(shouldRewriteAdminHostPath("/_next/static/app.js")).toBe(false);
    expect(shouldRewriteAdminHostPath("/favicon.ico")).toBe(false);
    expect(resolveAdminHostInternalPath("/")).toBe("/admin");
    expect(resolveAdminHostInternalPath("/leads")).toBe("/admin");
    expect(JSON.stringify(summarizePhase84fAdminConsole())).toContain("/admin");
  });
});
