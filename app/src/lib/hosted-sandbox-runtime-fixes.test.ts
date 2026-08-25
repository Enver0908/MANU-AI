import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  apiErrorBody,
  MAGIC_LINK_RETRY_AFTER_SECONDS,
  rateLimitErrorResponse,
} from "./app-errors";
import { MAGIC_LINK_RATE_LIMIT } from "./phase-84d-customer-auth";

const proxySource = readFileSync(fileURLToPath(new URL("../proxy.ts", import.meta.url)), "utf8");
const navigationSource = readFileSync(
  fileURLToPath(new URL("../components/dashboard/dashboard-navigation.tsx", import.meta.url)),
  "utf8",
);
const useManuStateSource = readFileSync(fileURLToPath(new URL("./use-manu-state.ts", import.meta.url)), "utf8");

describe("hosted sandbox runtime fixes", () => {
  it("binds API errors to requestId with no-store headers", async () => {
    const body = apiErrorBody("app_state_load_failed", "req-123");
    expect(body).toEqual({ error: "app_state_load_failed", requestId: "req-123" });

    const response = rateLimitErrorResponse("req-429");
    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Retry-After")).toBe(String(MAGIC_LINK_RETRY_AFTER_SECONDS));
    const payload = await response.json();
    expect(payload).toEqual({ error: "rate_limit_exceeded", requestId: "req-429" });
  });

  it("aligns magic-link app limit to one request per minute", () => {
    expect(MAGIC_LINK_RATE_LIMIT.limit).toBe(1);
    expect(MAGIC_LINK_RATE_LIMIT.windowMs).toBe(60_000);
    expect(MAGIC_LINK_RETRY_AFTER_SECONDS).toBe(60);
  });

  it("preserves supabase cookie mutations on admin-host rewrite", () => {
    expect(proxySource).toContain("isAdminHost(hostname) && shouldRewriteAdminHostPath(pathname)");
    expect(proxySource).toContain("response.cookies.set(name, value, options)");
    expect(proxySource).toContain("await supabase.auth.getUser()");
  });

  it("uses real link semantics for shell navigation", () => {
    expect(navigationSource).toContain("<Link");
    expect(navigationSource).toContain("requestHrefNavigation(item.href)");
  });

  it("does not fall back to demo seed when hosted store hydration fails", () => {
    expect(useManuStateSource).toContain("usesHostedStore");
    expect(useManuStateSource).toContain("setHydrateError");
    expect(useManuStateSource).not.toMatch(
      /\.catch\(\(\) => setState\(createInitialState\(\)\)\)/,
    );
  });
});
