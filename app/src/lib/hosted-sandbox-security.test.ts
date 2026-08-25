import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/20260825120000_hosted_sandbox_faz3_security_rls_backup.sql", import.meta.url)),
  "utf8",
);

describe("hosted sandbox faz 3 security migration", () => {
  it("binds dietitian_belongs_to_tenant to auth.uid membership", () => {
    expect(migrationSource).toContain("create or replace function public.dietitian_belongs_to_tenant");
    expect(migrationSource).toContain("tm.user_id = auth.uid()");
    expect(migrationSource).toContain("set search_path = public, pg_temp");
  });

  it("revokes PUBLIC and anon EXECUTE from RLS helper functions", () => {
    expect(migrationSource).toContain("revoke all on function %s from public");
    expect(migrationSource).toContain("revoke all on function %s from anon");
    expect(migrationSource).toContain("grant execute on function %s to authenticated, service_role");
    expect(migrationSource).toContain("'dietitian_belongs_to_tenant'");
    expect(migrationSource).toContain("'can_read_client'");
  });
});
