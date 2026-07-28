import { afterEach, describe, expect, it } from "vitest";
import { resolveAuthRouteIpKey } from "./phase-85-stage-4d-auth-server";

function headers(values: Record<string, string>) {
  return {
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    },
  };
}

describe("phase-85-stage-4d auth server", () => {
  afterEach(() => {
    delete process.env.MANU_TRUST_PROXY_HEADERS;
  });

  it("does not trust proxy IP headers unless explicitly configured", () => {
    expect(
      resolveAuthRouteIpKey(
        { headers: headers({ "x-forwarded-for": "203.0.113.10", "x-real-ip": "203.0.113.11" }) },
        "user-1",
      ),
    ).toBe("anonymous:user-1");

    process.env.MANU_TRUST_PROXY_HEADERS = "true";
    expect(
      resolveAuthRouteIpKey(
        { headers: headers({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" }) },
        "user-1",
      ),
    ).toBe("203.0.113.10:user-1");
  });
});
