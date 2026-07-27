import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(__dirname, "../../supabase/migrations");
const migrationName = "20260725155000_phase_85_stage_4c_remediation_rls_helper_grants.sql";
const migrationSource = readFileSync(resolve(migrationsDir, migrationName), "utf8");

describe("Stage 4C RLS helper grant remediation migration", () => {
  it("runs after Stage 4C remediation scale indexes", () => {
    const migrationNames = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();

    expect(migrationNames.indexOf(migrationName)).toBeGreaterThan(
      migrationNames.indexOf("20260725150000_phase_85_stage_4c_remediation_scale_indexes.sql"),
    );
  });

  it("grants authenticated execute only for RLS policy evaluation helpers", () => {
    expect(migrationSource).toContain(
      "grant execute on function p85_stage_4c_actor_owns_chat(uuid, uuid, uuid) to authenticated, service_role;",
    );
    expect(migrationSource).toContain(
      "grant execute on function p85_stage_4c_actor_can_access_client_chat(uuid, uuid, uuid, uuid, text) to authenticated, service_role;",
    );
    expect(migrationSource).toContain(
      "grant execute on function p85_stage_4c_actor_can_read_chat_row(uuid, uuid, uuid, uuid, text) to authenticated, service_role;",
    );
    expect(migrationSource).not.toContain(
      "grant execute on function p85_stage_4c_validate_creator_membership(uuid, uuid, uuid) to authenticated",
    );
  });
});
