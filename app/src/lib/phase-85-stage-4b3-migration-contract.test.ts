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

const boundedMediaMigration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260713140000_phase_85_stage_4b3_bounded_media_reads.sql"),
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

describe("P85 Stage 4B-3 Phase 9 bounded media reads migration", () => {
  it("creates bounded metadata and stream resolution RPCs without object keys", () => {
    expect(boundedMediaMigration).toContain("p85_stage_4b3_load_bounded_media_metadata_v1");
    expect(boundedMediaMigration).toContain("p85_stage_4b3_resolve_media_stream_v1");
    expect(boundedMediaMigration).toContain("'has_thumbnail', ma.thumbnail_object_key is not null");
    expect(boundedMediaMigration).not.toContain("'thumbnail_object_key', ma.thumbnail_object_key");
    expect(boundedMediaMigration).not.toContain("'sanitized_full_object_key'");
    expect(boundedMediaMigration).toContain("grant execute on function p85_stage_4b3_load_bounded_media_metadata_v1");
    expect(boundedMediaMigration).toContain("grant execute on function p85_stage_4b3_resolve_media_stream_v1");
  });
});

const lifecycleMigration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260713150000_phase_85_stage_4b3_media_lifecycle.sql"),
  "utf8",
);

describe("P85 Stage 4B-3 Phase 11 media lifecycle migration", () => {
  it("creates expiry indexes and service-role lifecycle RPCs", () => {
    expect(lifecycleMigration).toContain("media_assets_expiry_due_idx");
    expect(lifecycleMigration).toContain("p85_stage_4b3_finalize_media_asset_expiry");
    expect(lifecycleMigration).toContain("p85_stage_4b3_redact_client_media_metadata");
    expect(lifecycleMigration).toContain("grant execute on function p85_stage_4b3_finalize_media_asset_expiry");
    expect(lifecycleMigration).toContain("grant execute on function p85_stage_4b3_redact_client_media_metadata");
  });
});

const remediationContractMigration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260714100000_phase_85_stage_4b3_remediation_contract_rls.sql"),
  "utf8",
);

const durableQueueMigration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260714110000_phase_85_stage_4b3_durable_media_queue.sql"),
  "utf8",
);

describe("P85 Stage 4B-3 remediation R2 contract/RLS migration", () => {
  it("migrates bundle statuses to V2 and removes authenticated direct reads", () => {
    expect(remediationContractMigration).toContain("status = 'decided'");
    expect(remediationContractMigration).toContain("legacy_completed_without_decision");
    expect(remediationContractMigration).toContain("actor_type");
    expect(remediationContractMigration).toContain("retrieval_eligible");
    expect(remediationContractMigration).toContain("revoke select on table media_assets from authenticated");
    expect(remediationContractMigration).toContain("deny direct access");
    expect(remediationContractMigration).toContain("revoke execute on function p85_stage_4b3_load_bounded_media_metadata_v1");
  });
});

describe("P85 Stage 4B-3 remediation R2 durable queue migration", () => {
  it("creates object deletion saga queue and V2 lease-token worker RPCs", () => {
    expect(durableQueueMigration).toContain("media_object_operations");
    expect(durableQueueMigration).toContain("p85_stage_4b3_claim_media_work_v2");
    expect(durableQueueMigration).toContain("p85_stage_4b3_claim_bundle_v2");
    expect(durableQueueMigration).toContain("lease_token");
    expect(durableQueueMigration).toContain("for update skip locked");
    expect(durableQueueMigration).toContain("p85_stage_4b3_load_bounded_media_v2");
    expect(durableQueueMigration).not.toContain("'observation', va.observation");
    expect(durableQueueMigration).toContain("grant execute on function p85_stage_4b3_load_bounded_media_v2");
  });
});
