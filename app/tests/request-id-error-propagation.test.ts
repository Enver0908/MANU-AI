import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AppRequestError } from "@/lib/app-errors";

function parseApiErrorPayload(body: unknown): {
  code?: string;
  field?: string;
  revision?: number;
  requestId?: string;
} {
  if (!body || typeof body !== "object") {
    return {};
  }
  const record = body as Record<string, unknown>;
  const requestId = typeof record.requestId === "string" ? record.requestId.trim() : "";
  return {
    code: typeof record.error === "string" ? record.error : undefined,
    field: typeof record.field === "string" ? record.field : undefined,
    revision: typeof record.revision === "number" ? record.revision : undefined,
    requestId: requestId.length > 0 ? requestId : undefined,
  };
}

describe("request id error propagation", () => {
  it("preserves requestId on AppRequestError and hydration fields", () => {
    const parsed = parseApiErrorPayload({
      error: "app_state_load_failed",
      requestId: "req-hosted-123",
      field: "clientId",
      revision: 4,
    });
    const error = new AppRequestError(409, parsed.code ?? "unknown", parsed.field, parsed.revision, parsed.requestId);
    expect(error.status).toBe(409);
    expect(error.code).toBe("app_state_load_failed");
    expect(error.requestId).toBe("req-hosted-123");
    expect(error.field).toBe("clientId");
    expect(error.revision).toBe(4);
    expect(error.message).toBe("app_state_load_failed");
  });

  it("leaves requestId undefined when the API body omits it", () => {
    const parsed = parseApiErrorPayload({ error: "network_failed" });
    const error = new AppRequestError(500, parsed.code ?? "unknown", parsed.field, parsed.revision, parsed.requestId);
    expect(error.requestId).toBeUndefined();
  });

  it("wires use-manu-state to parse requestId into AppRequestError and hydrateRequestId", () => {
    const source = readFileSync(fileURLToPath(new URL("../src/lib/use-manu-state.ts", import.meta.url)), "utf8");
    expect(source).toContain("parseApiErrorPayload");
    expect(source).toContain("hydrateFromError");
    expect(source).toContain("setHydrateRequestId(error.requestId ?? null)");
    expect(source).toContain("throw new AppRequestError(response.status, code, field, revision, requestId)");
  });
});
