import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260710120000_phase_85_if_b_trust_root_provenance.sql"),
  "utf8",
);

const p85IfBTables = [
  "channel_account_bindings",
  "channel_actor_bindings",
  "channel_events",
  "channel_message_revisions",
  "human_control_sessions",
  "risk_activity_events",
  "context_intake_proposals",
] as const;

describe("P85-IF-B migration contract", () => {
  it("creates every canonical table with RLS enabled", () => {
    for (const table of p85IfBTables) {
      expect(migration).toContain(`create table if not exists ${table}`);
      expect(migration).toContain(`alter table ${table} enable row level security`);
    }
  });

  it("adds RBAC policies for every new tenant-scoped table", () => {
    for (const table of p85IfBTables) {
      expect(migration).toContain(`on ${table}`);
      expect(migration).toContain("has_tenant_role(tenant_id");
    }

    expect(migration).toContain("tenant scoped write channel account bindings");
    expect(migration).toContain("array['owner', 'admin']::tenant_role[]");
    expect(migration).toContain("tenant scoped write context intake proposals");
  });

  it("extends messages with provenance, revision, and retrieval constraints", () => {
    expect(migration).toContain("add column if not exists provider_account_binding_id");
    expect(migration).toContain("add column if not exists actor_resolution_basis");
    expect(migration).toContain("add column if not exists retrieval_eligibility");
    expect(migration).toContain("messages_tenant_provider_account_message_idx");
    expect(migration).toContain("messages_dietitian_manual_provenance_check");
    expect(migration).toContain("messages_ai_generated_decision_check");
  });
});
