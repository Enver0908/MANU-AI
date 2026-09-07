import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const historicalSource = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260830180000_production_readiness_stage_1_phase_2_manual_entitlements.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

const reactivationSource = readFileSync(
  fileURLToPath(
    new URL("../../supabase/migrations/20260903100000_commercial_entitlement_reactivation.sql", import.meta.url),
  ),
  "utf8",
);

describe("commercial entitlement reactivation migration contract", () => {
  it("keeps the historical activate/renew migration unchanged", () => {
    expect(historicalSource).toContain("check (action in ('activate', 'renew'))");
    expect(historicalSource).not.toContain("reactivate");
  });

  it("append-only adds atomic reactivate without changing the RPC signature", () => {
    expect(reactivationSource).toContain("check (action in ('activate', 'renew', 'reactivate'))");
    expect(reactivationSource).toContain("manual_entitlement_reactivated");
    expect(reactivationSource).toContain("password_recovery_requested");
    expect(reactivationSource).toContain("entitlement_status_invalid_for_manual_reactivation");
    expect(reactivationSource).toContain("copiedClientData");
    expect(reactivationSource).toContain("false");
    expect(reactivationSource).toContain("create or replace function public.apply_manual_entitlement_operation");
    expect(reactivationSource).toContain("p_expected_revision integer default null");
    expect(reactivationSource).toContain("revoke all on function public.apply_manual_entitlement_operation");
    expect(reactivationSource).toContain("from public, anon, authenticated");
    expect(reactivationSource).toContain("to service_role");
    expect(reactivationSource).toContain("if p_action = 'reactivate' then");
    expect(reactivationSource).toContain("entitlement_revision_conflict");
    expect(reactivationSource).toContain("manual_entitlement_request_conflict");
  });
});
