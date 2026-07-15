import { describe, expect, it } from "vitest";
import { parseHttpByteRangeHeader, sliceBufferForRange } from "./phase-85-stage-4b4-media-range";

describe("phase-85-stage-4b4-media-range", () => {
  it("parses full, partial, and unsatisfied byte ranges", () => {
    expect(parseHttpByteRangeHeader(null, 100)).toEqual({ kind: "full" });
    expect(parseHttpByteRangeHeader("bytes=0-9", 100)).toEqual({ kind: "partial", start: 0, end: 9 });
    expect(parseHttpByteRangeHeader("bytes=90-", 100)).toEqual({ kind: "partial", start: 90, end: 99 });
    expect(parseHttpByteRangeHeader("bytes=-10", 100)).toEqual({ kind: "partial", start: 90, end: 99 });
    expect(parseHttpByteRangeHeader("bytes=0-200", 100)).toEqual({ kind: "partial", start: 0, end: 99 });
    expect(parseHttpByteRangeHeader("bytes=150-200", 100)).toEqual({ kind: "unsatisfied" });
    expect(parseHttpByteRangeHeader("invalid", 100)).toEqual({ kind: "unsatisfied" });
  });

  it("slices buffers for partial ranges", () => {
    const body = Buffer.from("0123456789");
    const chunk = sliceBufferForRange(body, { kind: "partial", start: 2, end: 5 });
    expect(chunk.toString()).toBe("2345");
  });
});
