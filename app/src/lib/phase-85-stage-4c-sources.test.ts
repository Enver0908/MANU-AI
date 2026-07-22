import { describe, expect, it } from "vitest";
import {
  buildApprovedSourceImportManifest,
  createInMemoryApprovedSourceStateFromManifest,
  importApprovedSourcesIdempotent,
  isApprovedSourceRetrievalEligible,
  searchInMemoryApprovedSources,
} from "./phase-85-stage-4c-sources";

describe("phase-85 stage 4c sources", () => {
  it("builds import manifest from Phase 71 corpus", () => {
    const manifest = buildApprovedSourceImportManifest();
    expect(manifest.length).toBeGreaterThan(10);
    expect(manifest[0]?.chunks.length).toBeGreaterThan(0);
    expect(manifest[0]?.sourceHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("imports idempotently without replacing existing hash", () => {
    const initial = { sources: [], chunks: [] };
    const first = importApprovedSourcesIdempotent(initial);
    const second = importApprovedSourcesIdempotent(first.state);
    expect(first.inserted).toBeGreaterThan(0);
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBeGreaterThan(0);
  });

  it("excludes retired and overdue approved sources from retrieval", () => {
    const state = createInMemoryApprovedSourceStateFromManifest();
    const source = state.sources[0]!;
    source.approvalStatus = "retired";
    source.retiredAt = new Date().toISOString();
    expect(isApprovedSourceRetrievalEligible(source)).toBe(false);
    expect(searchInMemoryApprovedSources(state, "fiber", 5)).toEqual([]);
  });
});
