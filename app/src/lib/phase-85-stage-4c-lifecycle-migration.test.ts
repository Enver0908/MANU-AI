import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260725130000_phase_85_stage_4c_remediation_lifecycle_export.sql"),
  "utf8",
);

describe("Stage 4C lifecycle migration", () => {
  it("defines durable lifecycle and DSAR RPCs", () => {
    expect(migrationSource).toContain("p85_stage_4c_delete_conversation_v1");
    expect(migrationSource).toContain("p85_stage_4c_delete_message_v1");
    expect(migrationSource).toContain("p85_stage_4c_claim_deletion_job_v1");
    expect(migrationSource).toContain("p85_stage_4c_process_deletion_job_step_v1");
    expect(migrationSource).toContain("p85_stage_4c_complete_deletion_job_v1");
    expect(migrationSource).toContain("p85_stage_4c_fail_deletion_job_v1");
    expect(migrationSource).toContain("p85_stage_4c_enqueue_client_scoped_deletions_v1");
    expect(migrationSource).toContain("p85_stage_4c_enqueue_account_scoped_deletions_v1");
    expect(migrationSource).toContain("p85_stage_4c_run_lifecycle_retention_sweep_v1");
    expect(migrationSource).toContain("p85_stage_4c_build_client_scoped_export_v1");
  });

  it("preserves copied client record assets and hides deleting conversations", () => {
    expect(migrationSource).toContain("ai_chat_attachment_record_transfers");
    expect(migrationSource).toContain("ai_chat_deletion_failed");
    expect(migrationSource).toContain("and c.status not in ('deleting', 'deleted')");
    expect(migrationSource).toContain("ai_chat_deletion_ledger_entity_uidx");
  });

  it("enforces service-role-only execution", () => {
    expect(migrationSource).toContain("service_role_required");
    expect(migrationSource).toContain("revoke all on function p85_stage_4c_delete_conversation_v1");
    expect(migrationSource).toContain("grant execute on function p85_stage_4c_build_client_scoped_export_v1");
  });
});
