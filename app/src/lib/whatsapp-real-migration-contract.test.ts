import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260830190000_production_readiness_stage_1_phase_3_whatsapp_real_contracts.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("real WhatsApp migration contract", () => {
  it("adds real account binding mode without enabling more than one active real WhatsApp number per tenant", () => {
    expect(migrationSource).toContain("operating_mode in ('mock', 'disabled', 'future_real', 'real')");
    expect(migrationSource).toContain("channel_account_bindings_tenant_single_active_real_whatsapp_idx");
    expect(migrationSource).toContain("provider = 'whatsapp_cloud'");
    expect(migrationSource).toContain("operating_mode = 'real'");
  });

  it("keeps connection attempts, credentials, and ingress jobs service-role only", () => {
    for (const table of ["whatsapp_connection_attempts", "whatsapp_channel_credentials", "whatsapp_ingress_jobs"]) {
      expect(migrationSource).toContain(`create table if not exists ${table}`);
      expect(migrationSource).toContain(`alter table ${table} enable row level security`);
      expect(migrationSource).toContain(`revoke all on table ${table} from public, anon, authenticated`);
      expect(migrationSource).toContain(`to service_role`);
    }
  });

  it("requires durable encrypted ingress before webhook success", () => {
    expect(migrationSource).toContain("create or replace function enqueue_whatsapp_real_ingress_job");
    expect(migrationSource).toContain("payload_ciphertext text not null");
    expect(migrationSource).toContain("payload_aad text not null");
    expect(migrationSource).toContain("payload_key_version text not null");
    expect(migrationSource).toContain("provider_event_id_reused_with_different_digest");
    expect(migrationSource).toContain("return jsonb_build_object('status', 'queued'");
  });

  it("separates real provider delivery identity from the existing mock identity", () => {
    expect(migrationSource).toContain("add column if not exists real_provider_message_id");
    expect(migrationSource).toContain("add column if not exists execution_state");
    expect(migrationSource).toContain("provider_error_category in ('definite_temporary', 'definite_permanent', 'ambiguous_network')");
    expect(migrationSource).toContain("retry_count >= 0 and retry_count <= 3");
  });
});
