import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260725120000_phase_85_stage_4c_remediation_risk_workflow.sql"),
  "utf8",
);

describe("Stage 4C risk workflow migration", () => {
  it("defines durable risk pipeline RPCs", () => {
    expect(migrationSource).toContain("p85_stage_4c_apply_run_risk_pipeline_v1");
    expect(migrationSource).toContain("p85_stage_4c_get_run_risk_summary_v1");
    expect(migrationSource).toContain("p85_stage_4c_list_run_draft_destinations_v1");
    expect(migrationSource).toContain("p85_stage_4c_transfer_run_draft_v1");
    expect(migrationSource).toContain("p85_stage_4c_create_run_handoff_v1");
    expect(migrationSource).toContain("p85_stage_4c_get_pending_composer_draft_transfer_v1");
    expect(migrationSource).toContain("p85_stage_4c_consume_composer_draft_transfer_v1");
  });

  it("adds assessment fingerprint idempotency and ai chat red notification kind", () => {
    expect(migrationSource).toContain("assessment_fingerprint");
    expect(migrationSource).toContain("ai_chat_red_review_required");
    expect(migrationSource).toContain("p85-4c:red:");
  });

  it("enforces service-role-only execution", () => {
    expect(migrationSource).toContain("service_role_required");
    expect(migrationSource).toContain("revoke all on function p85_stage_4c_apply_run_risk_pipeline_v1");
    expect(migrationSource).toContain("grant execute on function p85_stage_4c_apply_run_risk_pipeline_v1");
  });
});
