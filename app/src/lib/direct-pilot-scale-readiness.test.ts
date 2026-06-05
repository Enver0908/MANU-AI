import { describe, expect, it } from "vitest";
import {
  createDirectPilotScaleFixture,
  DIRECT_PILOT_SCALE_TARGET,
  evaluateDirectPilotScaleReadiness,
  paginateDirectPilotItems,
} from "./direct-pilot-scale-readiness";
import { SUPABASE_READ_CONTRACTS } from "./supabase-read-contracts";

describe("direct pilot scale readiness", () => {
  it("builds the direct 100 dietitian x 50 client synthetic fixture", () => {
    const fixture = createDirectPilotScaleFixture();

    expect(fixture.dietitians).toHaveLength(DIRECT_PILOT_SCALE_TARGET.dietitianCount);
    expect(fixture.clients).toHaveLength(DIRECT_PILOT_SCALE_TARGET.totalClients);
    expect(fixture.dietitians.every((dietitian) => dietitian.clientIds.length === 50)).toBe(true);
    expect(fixture.clients.filter((client) => client.aiStatus === "active")).toHaveLength(1000);
  });

  it("paginates dense client lists with bounded cursors", () => {
    const fixture = createDirectPilotScaleFixture();
    const firstPage = paginateDirectPilotItems(fixture.clients, { limit: 50 });
    const secondPage = paginateDirectPilotItems(fixture.clients, { cursor: firstPage.nextCursor, limit: 50 });
    const cappedPage = paginateDirectPilotItems(fixture.clients, { limit: 500 });

    expect(firstPage.items).toHaveLength(50);
    expect(firstPage.nextCursor).toBe("synthetic-client-00050");
    expect(secondPage.items[0].id).toBe("synthetic-client-00051");
    expect(cappedPage.items).toHaveLength(DIRECT_PILOT_SCALE_TARGET.maxPageSize);
    expect(cappedPage.pageSize).toBe(DIRECT_PILOT_SCALE_TARGET.maxPageSize);
  });

  it("rejects invalid scale and pagination input", () => {
    expect(() => createDirectPilotScaleFixture({ dietitianCount: 0 })).toThrow("dietitianCount");
    expect(() => createDirectPilotScaleFixture({ clientsPerDietitian: 0 })).toThrow("clientsPerDietitian");
    expect(() => createDirectPilotScaleFixture({ activeClientPercentage: 101 })).toThrow("activeClientPercentage");
    expect(() => paginateDirectPilotItems([], { limit: 0 })).toThrow("limit");
    expect(() => paginateDirectPilotItems([{ id: "a" }], { cursor: "missing" })).toThrow("cursor");
  });

  it("requires fixture, read contract, and rehearsal evidence before marking scale ready", () => {
    const fixture = createDirectPilotScaleFixture();
    const missingRehearsal = evaluateDirectPilotScaleReadiness(fixture);
    const ready = evaluateDirectPilotScaleReadiness(fixture, {
      readContracts: SUPABASE_READ_CONTRACTS,
      loadBackpressureIdempotencyEvidence: true,
    });

    expect(missingRehearsal.ready).toBe(false);
    expect(missingRehearsal.failures).toContain("load_backpressure_idempotency_evidence_missing");
    expect(ready).toMatchObject({
      ready: true,
      dietitianCount: 100,
      totalClientCount: 5000,
      clientsPerDietitianMin: 50,
      clientsPerDietitianMax: 50,
      phase69ContractCount: 4,
    });
  });
});
