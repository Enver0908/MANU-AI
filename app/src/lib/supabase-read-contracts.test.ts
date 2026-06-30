import { describe, expect, it } from "vitest";
import { getSupabaseReadContractsByStatus, SUPABASE_READ_CONTRACTS } from "./supabase-read-contracts";

describe("Supabase broad read contracts", () => {
  it("classifies every read path with a concrete production contract", () => {
    expect(SUPABASE_READ_CONTRACTS.length).toBeGreaterThanOrEqual(16);

    const ids = new Set<string>();
    for (const contract of SUPABASE_READ_CONTRACTS) {
      expect(contract.id).toMatch(/^[a-z0-9_]+$/);
      expect(ids.has(contract.id)).toBe(false);
      ids.add(contract.id);
      expect(contract.ownerPath).toContain("app/src/");
      expect(contract.currentLoader.length).toBeGreaterThan(0);
      expect(contract.currentScope.length).toBeGreaterThan(0);
      expect(contract.productionContract.length).toBeGreaterThan(0);
      expect(contract.reason.length).toBeGreaterThan(0);
      expect(contract.nextAction.length).toBeGreaterThan(0);
    }
  });

  it("keeps already-narrowed mutation paths separate from broad read work", () => {
    const scopedMutationIds = getSupabaseReadContractsByStatus("scoped_mutation_read").map((contract) => contract.id);

    expect(scopedMutationIds).toEqual(
      expect.arrayContaining([
        "manual_reply_mutation",
        "inbound_simulation_mutation",
        "draft_review_mutation",
        "handoff_status_mutation",
        "context_update_mutation",
        "form_response_mutation",
        "client_update_proposal_mutation",
      ]),
    );
  });

  it("marks Phase 69 scale-critical reads as paginated or scoped contracts", () => {
    const phase69Ids = getSupabaseReadContractsByStatus("phase69_paginated_contract").map(
      (contract) => contract.id,
    );

    expect(phase69Ids).toEqual(
      expect.arrayContaining([]),
    );
    expect(phase69Ids).not.toContain("internal_copilot_tools");
  });

  it("upgrades dashboard_state_snapshot to Phase 79 windowed runtime", () => {
    const phase79Ids = getSupabaseReadContractsByStatus("phase79_windowed_runtime").map(
      (contract) => contract.id,
    );

    expect(phase79Ids).toEqual(
      expect.arrayContaining([
        "dashboard_state_snapshot",
        "client_create_scaffold",
        "client_ai_control_patch",
        "internal_copilot_tools",
      ]),
    );
  });

  it("records Phase 79I scoped mutation and windowed dashboard closure accurately", () => {
    const dashboard = SUPABASE_READ_CONTRACTS.find((contract) => contract.id === "dashboard_state_snapshot");
    const create = SUPABASE_READ_CONTRACTS.find((contract) => contract.id === "client_create_scaffold");
    const patch = SUPABASE_READ_CONTRACTS.find((contract) => contract.id === "client_ai_control_patch");

    expect(dashboard?.currentLoader).toBe("loadSupabaseWindowedDashboardPayload");
    expect(dashboard?.currentScope).toContain("/api/app-state?view=windowed");
    expect(create?.currentScope).not.toContain("post-mutation reload");
    expect(patch?.currentScope).not.toContain("post-mutation reload");
    expect(create?.nextAction).toContain("No broad-read action needed");
    expect(patch?.nextAction).toContain("No broad-read action needed");
  });

  it("keeps legal/admin workflows intentionally broad until external contracts are approved", () => {
    const broadIds = getSupabaseReadContractsByStatus("intentional_broad_read").map((contract) => contract.id);

    expect(broadIds).toEqual(
      expect.arrayContaining([
        "client_export_legal_bundle",
        "client_anonymization_redaction",
        "client_removal_lifecycle",
        "form_schema_admin",
        "voice_sample_workflow",
      ]),
    );
  });
});
