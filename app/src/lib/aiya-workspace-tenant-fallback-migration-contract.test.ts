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

const fallbackSource = readFileSync(
  fileURLToPath(
    new URL("../../supabase/migrations/20260904120000_aiya_workspace_tenant_fallback.sql", import.meta.url),
  ),
  "utf8",
);

describe("aiya workspace tenant fallback migration contract", () => {
  it("leaves historical MANU Tenant records in earlier migrations", () => {
    expect(historicalSource).toContain("'MANU Tenant ' || v_invite.normalized_email");
    expect(reactivationSource).toContain("'MANU Tenant ' || v_invite.normalized_email");
  });

  it("append-only replaces the visible tenant fallback without changing the RPC signature", () => {
    expect(fallbackSource).toContain("create or replace function public.apply_manual_entitlement_operation");
    expect(fallbackSource).toContain("p_expected_revision integer default null");
    expect(fallbackSource).toContain("'AIya Workspace'");
    expect(fallbackSource).not.toContain("MANU Tenant");
    expect(fallbackSource).toContain("revoke all on function public.apply_manual_entitlement_operation");
    expect(fallbackSource).toContain("from public, anon, authenticated");
    expect(fallbackSource).toContain("to service_role");
    expect(fallbackSource).toContain("if p_action = 'reactivate' then");
    expect(fallbackSource).toContain("copiedClientData");
  });
});
