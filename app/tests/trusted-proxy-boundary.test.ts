import { afterEach, describe, expect, it } from "vitest";
import { isLocalDemoLoginAllowed, resolveRequestHostname } from "@/lib/demo-fixture-access";
import {
  resolveTrustedClientIp,
  resolveTrustedHost,
  TRUSTED_PROXY_SENTINEL_HEADER,
  TRUSTED_PROXY_SENTINEL_VALUE,
} from "@/lib/trusted-proxy";

describe("trusted proxy boundary", () => {
  afterEach(() => {
    delete process.env.MANU_TRUST_PROXY_HEADERS;
  });

  it("ignores forwarded host and IP when proxy header trust is disabled", () => {
    const headers = new Headers({
      host: "app.example:443",
      "x-forwarded-host": "localhost:3000",
      "x-forwarded-for": "127.0.0.1",
      "x-real-ip": "10.0.0.1",
      [TRUSTED_PROXY_SENTINEL_HEADER]: TRUSTED_PROXY_SENTINEL_VALUE,
    });
    expect(resolveTrustedHost(headers, "app.example:443")).toEqual({
      trusted: false,
      host: "app.example",
      clientIp: "anonymous",
      source: "direct",
    });
    expect(resolveTrustedClientIp(headers)).toEqual({
      trusted: false,
      host: "",
      clientIp: "anonymous",
      source: "direct",
    });
    expect(resolveRequestHostname(headers)).toBe("app.example");
    expect(
      isLocalDemoLoginAllowed(
        { NODE_ENV: "development", MANU_ALLOW_PUBLIC_DEMO_LOGIN: "true" },
        resolveRequestHostname(headers),
      ),
    ).toBe(false);
  });

  it("uses forwarded values only when proxy header trust and the sentinel are both present", () => {
    process.env.MANU_TRUST_PROXY_HEADERS = "true";
    const headers = new Headers({
      host: "app.example:443",
      "x-forwarded-host": "localhost:3000",
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      "x-real-ip": "10.0.0.1",
      [TRUSTED_PROXY_SENTINEL_HEADER]: TRUSTED_PROXY_SENTINEL_VALUE,
    });
    expect(resolveTrustedHost(headers, "app.example:443")).toEqual({
      trusted: true,
      host: "localhost",
      clientIp: "203.0.113.10",
      source: "trusted-proxy",
    });
    expect(resolveTrustedClientIp(headers)).toEqual({
      trusted: true,
      host: "",
      clientIp: "203.0.113.10",
      source: "trusted-proxy",
    });
  });

  it("rejects spoofed forwarded host without the Nginx sentinel", () => {
    process.env.MANU_TRUST_PROXY_HEADERS = "true";
    const headers = new Headers({
      host: "sandbox.manu.ai",
      "x-forwarded-host": "localhost",
      "x-forwarded-for": "127.0.0.1",
      "x-real-ip": "10.0.0.1",
    });
    const hostDecision = resolveTrustedHost(headers, "sandbox.manu.ai");
    expect(hostDecision.trusted).toBe(false);
    expect(hostDecision.host).toBe("sandbox.manu.ai");
    expect(isLocalDemoLoginAllowed({ NODE_ENV: "development", MANU_ALLOW_PUBLIC_DEMO_LOGIN: "true" }, hostDecision.host)).toBe(
      false,
    );
  });
});
