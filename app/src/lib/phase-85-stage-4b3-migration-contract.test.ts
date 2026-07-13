import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260713120000_phase_85_stage_4b3_media_foundation.sql"),
  "utf8",
);

const stage4B3Tables = [
  "media_assets",
  "visual_analysis_records",
  "inbound_message_bundles",
  "inbound_message_bundle_items",
  "visual_corrections",
] as const;

describe("P85 Stage 4B-3 migration contract", () => {
  it("creates every canonical media table with RLS enabled", () => {
    for (const table of stage4B3Tables) {
      expect(migration).toContain(`create table if not exists ${table}`);
      expect(migration).toContain(`alter table ${table} enable row level security`);
    }
  });

  it("creates the private media bucket and blocks direct user writes", () => {
    expect(migration).toContain("'p85-stage-4b3-media'");
    expect(migration).toContain("public = excluded.public");
    expect(migration).toContain("deny direct write");
    expect(migration).toContain("grant all on table media_assets to service_role");
  });

  it("adds worker claim RPCs with skip locked leases", () => {
    expect(migration).toContain("p85_stage_4b3_claim_media_asset_worker");
    expect(migration).toContain("p85_stage_4b3_claim_inbound_message_bundle_worker");
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("interval '60 seconds'");
  });

  it("locks one active bundle per conversation and extends channel event kinds", () => {
    expect(migration).toContain("inbound_message_bundles_one_active_per_conversation_idx");
    expect(migration).toContain("'client_message_image'");
    expect(migration).toContain("media_assets_tenant_message_idx");
  });
});

const bundleDecisionMigration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260713130000_phase_85_stage_4b3_atomic_bundle_decisions.sql"),
  "utf8",
);

describe("P85 Stage 4B-3 Phase 8 atomic bundle decision migration", () => {
  it("creates bundle decision idempotency storage and commit RPC", () => {
    expect(bundleDecisionMigration).toContain("bundle_decision_idempotency");
    expect(bundleDecisionMigration).toContain("p85_stage_4b3_commit_bundle_decision_v1");
    expect(bundleDecisionMigration).toContain("stale_bundle_revision");
    expect(bundleDecisionMigration).toContain("stale_conversation_revision");
    expect(bundleDecisionMigration).toContain("grant execute on function p85_stage_4b3_commit_bundle_decision_v1");
  });
});
