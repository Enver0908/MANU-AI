import { describe, expect, it } from "vitest";
import { AIYA_PUBLIC_CONTACT_EMAIL } from "./brand";
import { evaluateAdminAllowlistAccess } from "./phase-84f-admin-console";

describe("commercial admin access allowlist", () => {
  it("blocks non-allowlisted emails for session admin", () => {
    const result = evaluateAdminAllowlistAccess("other@example.com", [AIYA_PUBLIC_CONTACT_EMAIL]);
    expect(result.allowed).toBe(false);
    expect(result.blockingReasons).toContain("admin_email_not_allowlisted");
  });

  it("allows default admin email", () => {
    const result = evaluateAdminAllowlistAccess(AIYA_PUBLIC_CONTACT_EMAIL, [AIYA_PUBLIC_CONTACT_EMAIL]);
    expect(result.allowed).toBe(true);
  });
});
