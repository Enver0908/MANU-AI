import { afterEach, describe, expect, it } from "vitest";
import { addPerformanceServerTiming } from "./performance-diagnostic";

const originalDiagnosticFlag = process.env.AIYA_PERF_DIAGNOSTIC;

afterEach(() => {
  if (originalDiagnosticFlag === undefined) {
    delete process.env.AIYA_PERF_DIAGNOSTIC;
  } else {
    process.env.AIYA_PERF_DIAGNOSTIC = originalDiagnosticFlag;
  }
});

describe("performance diagnostic server timing", () => {
  it("does not add timing headers when the diagnostic flag is disabled", () => {
    delete process.env.AIYA_PERF_DIAGNOSTIC;
    const response = new Response("ok");

    addPerformanceServerTiming(response, { auth: 1, store: 2 });

    expect(response.headers.get("Server-Timing")).toBeNull();
  });

  it("adds only finite non-negative timing values when enabled", () => {
    process.env.AIYA_PERF_DIAGNOSTIC = "1";
    const response = new Response("ok");

    addPerformanceServerTiming(response, { auth: 1.234, store: -4, json: Number.NaN });

    expect(response.headers.get("Server-Timing")).toBe("auth;dur=1.23, store;dur=0.00");
  });
});
