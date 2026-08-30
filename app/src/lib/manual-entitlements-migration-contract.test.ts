import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260830180000_production_readiness_stage_1_phase_2_manual_entitlements.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("manual entitlement migration contract", () => {
  it("keeps manual bank-transfer operations service-role only and idempotent", () => {
    expect(migrationSource).toContain("create table if not exists manual_entitlement_operations");
    expect(migrationSource).toContain("request_id text not null unique");
    expect(migrationSource).toContain("manual_entitlement_operations_payment_reference_idx");
    expect(migrationSource).toContain("alter table manual_entitlement_operations enable row level security");
    expect(migrationSource).toContain("create or replace function public.apply_manual_entitlement_operation");
    expect(migrationSource).toContain("revoke all on function public.apply_manual_entitlement_operation");
    expect(migrationSource).toContain("from public, anon, authenticated");
    expect(migrationSource).toContain("to service_role");
  });

  it("extends entitlement records with manual expiry and revision controls", () => {
    expect(migrationSource).toContain("add column if not exists billing_method");
    expect(migrationSource).toContain("add column if not exists paid_through");
    expect(migrationSource).toContain("add column if not exists revision");
    expect(migrationSource).toContain("tenant_entitlements_manual_paid_through_check");
    expect(migrationSource).toContain("entitlement_revision_conflict");
  });
});
