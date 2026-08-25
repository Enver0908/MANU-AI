import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import {
  HOSTED_SANDBOX_CONTENT_SECURITY_POLICY,
  HOSTED_SANDBOX_SECURITY_HEADER_NAMES,
  applyHostedSandboxSecurityHeaders,
} from "./hosted-sandbox-security-headers";

describe("hosted-sandbox security headers", () => {
  it("applies the hosted sandbox header bundle", () => {
    const response = applyHostedSandboxSecurityHeaders(NextResponse.next());
    for (const name of HOSTED_SANDBOX_SECURITY_HEADER_NAMES) {
      expect(response.headers.get(name)).toBeTruthy();
    }
    expect(response.headers.get("Content-Security-Policy")).toBe(HOSTED_SANDBOX_CONTENT_SECURITY_POLICY);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });
});
