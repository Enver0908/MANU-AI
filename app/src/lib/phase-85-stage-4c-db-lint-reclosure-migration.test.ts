import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(__dirname, "../../supabase/migrations");
const migrationName = "20260725160000_phase_85_stage_4c_remediation_db_lint_reclosure.sql";
const migrationSource = readFileSync(resolve(migrationsDir, migrationName), "utf8");

describe("Stage 4C DB lint reclosure migration", () => {
  it("runs after the RLS helper grant remediation", () => {
    const migrationNames = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();

    expect(migrationNames.indexOf(migrationName)).toBeGreaterThan(
      migrationNames.indexOf("20260725155000_phase_85_stage_4c_remediation_rls_helper_grants.sql"),
    );
  });

  it("backfills compatibility columns and functions without widening Stage 4C user mutation grants", () => {
    expect(migrationSource).toContain("alter table clients");
    expect(migrationSource).toContain("add column if not exists updated_at");
    expect(migrationSource).toContain("alter table conversations");
    expect(migrationSource).toContain("alter table messages");
    expect(migrationSource).toContain("alter table ai_decisions");
    expect(migrationSource).toContain("create or replace function jsonb_object_length(p_value jsonb)");
    expect(migrationSource).toContain("create cast (text as case_status) with inout as implicit");
    expect(migrationSource).not.toContain("to authenticated, service_role;\ngrant execute on function p85_stage_4c_delete_message_v1");
  });

  it("uses text-array redaction and qualified media asset expiry predicates", () => {
    expect(migrationSource).toContain("corrected_entity_labels = '{}'::text[]");
    expect(migrationSource).toContain("coalesce(array_length(vc.corrected_entity_labels, 1), 0) > 0");
    expect(migrationSource).toContain("where media_assets.tenant_id = p_tenant_id");
    expect(migrationSource).toContain("and media_assets.id = p_asset_id");
  });

  it("rebuilds the Stage 4C delete-message chain with full version columns", () => {
    expect(migrationSource).toContain("mv.tenant_id");
    expect(migrationSource).toContain("parent.conversation_id");
    expect(migrationSource).toContain("parent.created_by_user_id");
    expect(migrationSource).toContain("into v_current_version");
  });
});
