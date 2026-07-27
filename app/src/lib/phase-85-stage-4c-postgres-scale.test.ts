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
const fixtureReclosureMigrationSource = readFileSync(
  resolve(
    __dirname,
    "../../supabase/migrations/20260725161000_phase_85_stage_4c_remediation_scale_fixture_reclosure.sql",
  ),
  "utf8",
);
const explainReclosureMigrationSource = readFileSync(
  resolve(
    __dirname,
    "../../supabase/migrations/20260725162000_phase_85_stage_4c_remediation_scale_explain_reclosure.sql",
  ),
  "utf8",
);

describe("phase 85 stage 4c postgres scale", () => {
  it("defines scale fixture and explain RPCs in append-only migration", () => {
    expect(migrationSource).toContain("p85_stage_4c_scale_fixture_seed_v1");
    expect(migrationSource).toContain("p85_stage_4c_scale_fixture_cleanup_v1");
    expect(migrationSource).toContain("p85_stage_4c_scale_explain_profile_v1");
    expect(migrationSource).toContain("'sampleRunId'");
    expect(migrationSource).toContain("insert into ai_chat_runs");
    expect(migrationSource).toContain("insert into ai_chat_run_events");
    expect(migrationSource).toContain("ai_chat_message_versions_branch_order_idx");
    expect(migrationSource).toContain("ai_chat_attachment_derivatives_lineage_idx");
  });

  it("recloses scale fixture seeding with idempotent cleanup and unique dietitian auth users", () => {
    expect(fixtureReclosureMigrationSource).toContain("create or replace function p85_stage_4c_scale_fixture_seed_v1()");
    expect(fixtureReclosureMigrationSource).toContain("p85_stage_4c_scale_uuid_from_parts");
    expect(fixtureReclosureMigrationSource).toContain("p85_stage_4c_scale_uuid_from_parts(2, index)");
    expect(fixtureReclosureMigrationSource).not.toContain("perform p85_stage_4c_scale_fixture_cleanup_v1()");
    expect(fixtureReclosureMigrationSource).toContain("delete from dietitians where tenant_id = v_tenant_id");
    expect(fixtureReclosureMigrationSource).toContain("grant execute on function p85_stage_4c_scale_fixture_seed_v1() to service_role");
  });

  it("recloses scale explain profiles against live source, lifecycle, and client schemas", () => {
    expect(explainReclosureMigrationSource).toContain("clients_tenant_lifecycle_id_idx");
    expect(explainReclosureMigrationSource).toContain("ai_chat_deletion_jobs_tenant_claim_idx");
    expect(explainReclosureMigrationSource).toContain("s.approval_status");
    expect(explainReclosureMigrationSource).toContain("j.requested_at");
    expect(explainReclosureMigrationSource).not.toContain("s.tenant_id");
    expect(explainReclosureMigrationSource).not.toContain("j.claimed_at");
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

  it("blocks sample postgres scale rehearsal until full local Supabase measurement runs", async () => {
    const previousFullRehearsal = process.env.STAGE_4C_FULL_REHEARSAL;
    let result!: Awaited<ReturnType<typeof runStage4CPostgresScaleRehearsalSample>>;
    try {
      delete process.env.STAGE_4C_FULL_REHEARSAL;
      result = await runStage4CPostgresScaleRehearsalSample();
    } finally {
      if (previousFullRehearsal !== undefined) {
        process.env.STAGE_4C_FULL_REHEARSAL = previousFullRehearsal;
      }
    }
    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("full_postgres_rehearsal_required");
    expect(result.scaleRehearsal.latencyTargetsMet).toBe(false);
    expect(result.failures).toContain("full_postgres_rehearsal_required");
    expect(STAGE_4C_SCALE_EXPLAIN_PROFILES.length).toBe(8);
  });
});
