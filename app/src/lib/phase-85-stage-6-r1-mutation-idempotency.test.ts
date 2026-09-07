import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260819120000_phase_85_stage_6_r1_mutation_idempotency.sql"),
  "utf8",
);

describe("phase-85-stage-6-r1 mutation idempotency migration", () => {
  it("creates a tenant/request-scoped durable ledger", () => {
    expect(migrationSource).toContain("create table if not exists stage_6_mutation_idempotency");
    expect(migrationSource).toContain("primary key (tenant_id, request_id)");
    expect(migrationSource).toContain("mutation_kind text not null");
    expect(migrationSource).toContain("status text not null default 'pending'");
    expect(migrationSource).toContain("check (status in ('pending', 'complete'))");
  });

  it("allows pending reservation and complete bounded response shapes only", () => {
    expect(migrationSource).toContain("status = 'pending'");
    expect(migrationSource).toContain("client_id is null");
    expect(migrationSource).toContain("response_json is null");
    expect(migrationSource).toContain("status = 'complete'");
    expect(migrationSource).toContain("response_json ? 'kind'");
    expect(migrationSource).toContain("response_json ? 'clientId'");
    expect(migrationSource).toContain("response_json ? 'payload'");
    expect(migrationSource).toContain("response_json ? 'revisions'");
    expect(migrationSource).toContain("not (response_json ? 'state')");
  });

  it("keeps direct table access closed under RLS", () => {
    expect(migrationSource).toContain("alter table stage_6_mutation_idempotency enable row level security");
    expect(migrationSource).toContain("stage_6_mutation_idempotency_no_direct_access");
    expect(migrationSource).toContain("using (false)");
    expect(migrationSource).toContain("with check (false)");
  });
});
