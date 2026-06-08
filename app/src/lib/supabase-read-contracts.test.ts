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
      expect.arrayContaining([
        "dashboard_state_snapshot",
        "internal_copilot_tools",
        "client_create_scaffold",
        "client_ai_control_patch",
      ]),
    );
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
