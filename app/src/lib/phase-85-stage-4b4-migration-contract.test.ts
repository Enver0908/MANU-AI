import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const foundationMigration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260714170000_phase_85_stage_4b4_audio_foundation.sql"),
  "utf8",
);

const queueMigration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260714180000_phase_85_stage_4b4_audio_queue.sql"),
  "utf8",
);

const stage4B4Tables = [
  "audio_transcription_records",
  "audio_transcript_corrections",
  "audio_transcript_correction_idempotency",
] as const;

describe("P85 Stage 4B-4 Phase 2 audio foundation migration", () => {
  it("creates every canonical audio table with deny-all RLS enabled", () => {
    for (const table of stage4B4Tables) {
      expect(foundationMigration).toContain(`create table if not exists ${table}`);
      expect(foundationMigration).toContain(`alter table ${table} enable row level security`);
      expect(foundationMigration).toContain(`revoke all on table ${table} from public, anon, authenticated`);
      expect(foundationMigration).toContain(`grant all on table ${table} to service_role`);
    }
  });

  it("creates the private WAV bucket and extends media/bundle schema for voice", () => {
    expect(foundationMigration).toContain("'p85-stage-4b4-audio'");
    expect(foundationMigration).toContain("array['audio/wav']");
    expect(foundationMigration).toContain("media_kind in ('image', 'audio')");
    expect(foundationMigration).toContain("audio_count <= 4");
    expect(foundationMigration).toContain("audio_duration_ms <= 600000");
    expect(foundationMigration).toContain("item_type in ('text', 'image', 'caption', 'voice')");
    expect(foundationMigration).toContain("'client_message_audio'");
    expect(foundationMigration).toContain("sample_rate_hz = 16000");
    expect(foundationMigration).toContain("audio_channels = 1");
  });

  it("locks tenant-composite foreign keys for audio transcription rows", () => {
    expect(foundationMigration).toContain("audio_transcription_records_tenant_id_id_key");
    expect(foundationMigration).toContain("audio_transcription_records_asset_tenant_fk");
    expect(foundationMigration).toContain("inbound_message_bundle_items_transcription_tenant_fk");
  });
});

describe("P85 Stage 4B-4 Phase 2 audio queue migration", () => {
  it("creates audio admission and transcription worker RPCs with lease tokens", () => {
    expect(queueMigration).toContain("p85_stage_4b4_claim_audio_admission_work_v1");
    expect(queueMigration).toContain("p85_stage_4b4_release_audio_admission_work_v1");
    expect(queueMigration).toContain("p85_stage_4b4_claim_transcription_work_v1");
    expect(queueMigration).toContain("p85_stage_4b4_release_transcription_work_v1");
    expect(queueMigration).toContain("for update skip locked");
    expect(queueMigration).toContain("interval '120 seconds'");
    expect(queueMigration).toContain("lease_token");
    expect(queueMigration).toContain("grant execute on function p85_stage_4b4_claim_audio_admission_work_v1");
    expect(queueMigration).toContain("grant execute on function p85_stage_4b4_release_transcription_work_v1");
  });

  it("restricts worker RPC execution to service_role", () => {
    expect(queueMigration).toContain("service_role_required");
    expect(queueMigration).toContain(
      "revoke all on function p85_stage_4b4_claim_transcription_work_v1(uuid, text) from public, anon, authenticated",
    );
  });
});
