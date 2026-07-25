import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateStage4CExplainPlan,
  runStage4CPostgresScaleRehearsalSample,
  STAGE_4C_SCALE_EXPLAIN_PROFILES,
} from "./phase-85-stage-4c-postgres-scale";

const migrationSource = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260725150000_phase_85_stage_4c_remediation_scale_indexes.sql"),
  "utf8",
);

describe("phase 85 stage 4c postgres scale", () => {
  it("defines scale fixture and explain RPCs in append-only migration", () => {
    expect(migrationSource).toContain("p85_stage_4c_scale_fixture_seed_v1");
    expect(migrationSource).toContain("p85_stage_4c_scale_fixture_cleanup_v1");
    expect(migrationSource).toContain("p85_stage_4c_scale_explain_profile_v1");
    expect(migrationSource).toContain("ai_chat_message_versions_branch_order_idx");
    expect(migrationSource).toContain("ai_chat_attachment_derivatives_lineage_idx");
  });

  it("evaluates explain plans for tenant-leading index usage", () => {
    const result = evaluateStage4CExplainPlan("history_list", [
      {
        Plan: {
          "Node Type": "Index Scan",
          "Index Name": "ai_chat_conversations_history_idx",
          Filter: "(tenant_id = '...'::uuid)",
        },
      },
    ]);
    expect(result.failures).toEqual([]);
    expect(result.usesLeadingTenantIndex).toBe(true);
  });

  it("runs sample postgres scale rehearsal without requiring local Supabase", async () => {
    const result = await runStage4CPostgresScaleRehearsalSample();
    expect(result.status).toBe("pass");
    expect(STAGE_4C_SCALE_EXPLAIN_PROFILES.length).toBe(8);
  });
});
