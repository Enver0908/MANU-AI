import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/20260825120000_hosted_sandbox_faz3_security_rls_backup.sql", import.meta.url)),
  "utf8",
);
const cleanupRpcMigrationSource = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/20260826120000_hosted_sandbox_demo_cleanup_rpc.sql", import.meta.url)),
  "utf8",
);
const defaultPrivilegesMigrationSource = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/20260826130000_rls_default_privileges_hardening.sql", import.meta.url)),
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

  it("adds a transactional hosted sandbox cleanup RPC guarded to service_role", () => {
    expect(cleanupRpcMigrationSource).toContain("create or replace function public.cleanup_hosted_sandbox_demo_tenant");
    expect(cleanupRpcMigrationSource).toContain("security definer");
    expect(cleanupRpcMigrationSource).toContain("jsonb_array_elements(p_expected_inventory) with ordinality");
    expect(cleanupRpcMigrationSource).toContain("tenant_scoped_table_missing_from_cleanup_inventory");
    expect(cleanupRpcMigrationSource).toContain("delete from public.tenants where id = p_tenant_id");
    expect(cleanupRpcMigrationSource).toContain("cleanup_incomplete");
    expect(cleanupRpcMigrationSource).toContain(
      "grant execute on function public.cleanup_hosted_sandbox_demo_tenant(uuid, jsonb, boolean) to service_role",
    );
    expect(cleanupRpcMigrationSource).toContain(
      "revoke all on function public.cleanup_hosted_sandbox_demo_tenant(uuid, jsonb, boolean) from authenticated",
    );
  });

  it("hardens default function EXECUTE privileges and current SECURITY DEFINER grants", () => {
    expect(defaultPrivilegesMigrationSource).toContain(
      "alter default privileges for role postgres in schema public revoke execute on functions from public",
    );
    expect(defaultPrivilegesMigrationSource).toContain(
      "alter default privileges for role postgres in schema public revoke execute on functions from anon",
    );
    expect(defaultPrivilegesMigrationSource).toContain("and p.prosecdef");
    expect(defaultPrivilegesMigrationSource).toContain("revoke execute on function %s from public");
    expect(defaultPrivilegesMigrationSource).toContain("revoke execute on function %s from anon");
    expect(defaultPrivilegesMigrationSource).toContain("grant execute on function %s to authenticated, service_role");
  });
});
