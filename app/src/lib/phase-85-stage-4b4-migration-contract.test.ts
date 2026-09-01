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

const canonicalIngressV3Migration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260714190000_phase_85_stage_4b4_canonical_ingress_v3.sql"),
  "utf8",
);

const audioLifecycleSignatureTransitionMigrationName =
  "20260714195000_phase_85_stage_4b4_audio_lifecycle_signature_transition.sql";
const audioLifecycleMigrationName =
  "20260714200000_phase_85_stage_4b4_audio_lifecycle_bounded_reads.sql";

const audioLifecycleSignatureTransitionMigration = readFileSync(
  resolve(__dirname, `../../supabase/migrations/${audioLifecycleSignatureTransitionMigrationName}`),
  "utf8",
);

const transcriptCorrectionMigration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260714210000_phase_85_stage_4b4_atomic_transcription_correction.sql"),
  "utf8",
);

const boundedAudioReadsMigration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260714220000_phase_85_stage_4b4_bounded_audio_reads.sql"),
  "utf8",
);

const audioLifecycleMigration = readFileSync(
  resolve(__dirname, `../../supabase/migrations/${audioLifecycleMigrationName}`),
  "utf8",
);

const remediationContractsMigration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260715100000_phase_85_stage_4b4_remediation_contracts.sql"),
  "utf8",
);

const durablePipelineMigration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260715110000_phase_85_stage_4b4_durable_pipeline.sql"),
  "utf8",
);

const failClosedQualityMigration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260715120000_phase_85_stage_4b4_fail_closed_quality_gate.sql"),
  "utf8",
);

const transcriptBridgePipelineMigration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260715130000_phase_85_stage_4b4_transcript_bridge_pipeline.sql"),
  "utf8",
);

const correctionLineageMigration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260715140000_phase_85_stage_4b4_correction_lineage.sql"),
  "utf8",
);

const boundedReadsV2Migration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260715150000_phase_85_stage_4b4_bounded_reads_v2.sql"),
  "utf8",
);

const lifecycleWorkersMigration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260715160000_phase_85_stage_4b4_lifecycle_workers.sql"),
  "utf8",
);

const stage4B4Tables = [
  "audio_transcription_records",
  "audio_transcript_corrections",
  "audio_transcript_correction_idempotency",
] as const;

function normalizeSqlNewlines(sql: string) {
  return sql.replace(/\r\n/g, "\n");
}

describe("P85 Stage 4B-4 remediation R1 contracts migration", () => {
  it("adds transcription lineage columns, constraints, and validation RPCs", () => {
    expect(remediationContractsMigration).toContain("add column if not exists origin text");
    expect(remediationContractsMigration).toContain("add column if not exists speaker_state text");
    expect(remediationContractsMigration).toContain("add column if not exists supersedes_transcription_id uuid");
    expect(remediationContractsMigration).toContain("audio_transcription_records_origin_check");
    expect(remediationContractsMigration).toContain("audio_transcription_records_speaker_state_check");
    expect(remediationContractsMigration).toContain("audio_transcription_records_tenant_message_revision_idx");
    expect(remediationContractsMigration).toContain("media_assets_transcription_tenant_fk");
    expect(remediationContractsMigration).toContain("p85_stage_4b4_validate_transcription_supersession_lineage_v1");
    expect(remediationContractsMigration).toContain("p85_stage_4b4_validate_transcript_correction_lineage_v1");
    expect(remediationContractsMigration).toContain("source_transcription_id");
    expect(remediationContractsMigration).toContain("corrected_transcription_id");
    expect(remediationContractsMigration).toContain("target_message_id");
    expect(remediationContractsMigration).toContain("transcription_supersession_cycle_detected");
    expect(remediationContractsMigration).toContain("correction_lineage_scope_mismatch");
  });
});

describe("P85 Stage 4B-4 remediation R3 durable pipeline migration", () => {
  it("creates lease-safe admission/transcription RPCs and bridge job queue", () => {
    expect(durablePipelineMigration).toContain("audio_transcript_bridge_jobs");
    expect(durablePipelineMigration).toContain("p85_stage_4b4_claim_audio_admission_work_v2");
    expect(durablePipelineMigration).toContain("p85_stage_4b4_complete_audio_admission_v2");
    expect(durablePipelineMigration).toContain("p85_stage_4b4_fail_audio_admission_v2");
    expect(durablePipelineMigration).toContain("p85_stage_4b4_claim_transcription_work_v2");
    expect(durablePipelineMigration).toContain("p85_stage_4b4_renew_transcription_lease_v2");
    expect(durablePipelineMigration).toContain("p85_stage_4b4_complete_transcription_v2");
    expect(durablePipelineMigration).toContain("interval '60 seconds'");
    expect(durablePipelineMigration).toContain("interval '1 second'");
    expect(durablePipelineMigration).toContain("interval '5 seconds'");
    expect(durablePipelineMigration).toContain("for update skip locked");
    expect(durablePipelineMigration).toContain(
      "grant execute on function p85_stage_4b4_complete_transcription_v2",
    );
  });
});

describe("P85 Stage 4B-4 remediation R8 lifecycle workers migration", () => {
  it("creates dedicated audio lifecycle claim, release, complete, and orphan RPCs", () => {
    expect(lifecycleWorkersMigration).toContain("p85_stage_4b4_claim_audio_lifecycle_work_v1");
    expect(lifecycleWorkersMigration).toContain("p85_stage_4b4_release_audio_lifecycle_work_v1");
    expect(lifecycleWorkersMigration).toContain("p85_stage_4b4_complete_audio_lifecycle_work_v1");
    expect(lifecycleWorkersMigration).toContain("p85_stage_4b4_enqueue_audio_orphan_cleanup_v1");
    expect(lifecycleWorkersMigration).toContain("p85_stage_4b4_fail_audio_row_without_object_v1");
    expect(lifecycleWorkersMigration).toContain("p85_stage_4b4_is_audio_lifecycle_object_key");
    expect(lifecycleWorkersMigration).toContain("audio_lifecycle_operation_required");
    expect(lifecycleWorkersMigration).toContain(
      "grant execute on function p85_stage_4b4_claim_audio_lifecycle_work_v1",
    );
  });
});

describe("P85 Stage 4B-4 remediation R7 bounded reads v2 migration", () => {
  it("creates bounded voice read v2 RPC and extends media stream metadata", () => {
    expect(boundedReadsV2Migration).toContain("p85_stage_4b4_load_bounded_voice_v2");
    expect(boundedReadsV2Migration).toContain("transcript_text");
    expect(boundedReadsV2Migration).toContain("latest_correction_id");
    expect(boundedReadsV2Migration).toContain("target_message_id");
    expect(boundedReadsV2Migration).toContain("corrected_transcription_id");
    expect(boundedReadsV2Migration).toContain("transcript_status");
    expect(boundedReadsV2Migration).toContain("byte_size");
    expect(boundedReadsV2Migration).toContain("etag");
    expect(boundedReadsV2Migration).toContain("p85_stage_4b2_actor_can_read_conversation");
    expect(boundedReadsV2Migration).toContain(
      "grant execute on function p85_stage_4b4_load_bounded_voice_v2",
    );
  });
});

describe("P85 Stage 4B-4 remediation R6 correction lineage migration", () => {
  it("hardens dietitian correction lineage, scope validation, and decision supersession", () => {
    expect(correctionLineageMigration).toContain(
      "audio_transcription_records_dietitian_correction_confidence_check",
    );
    expect(correctionLineageMigration).toContain("p85_stage_4b4_assert_transcript_correction_scope_v1");
    expect(correctionLineageMigration).toContain("p85_stage_4b4_supersede_transcript_correction_decision_v1");
    expect(correctionLineageMigration).toContain("transcript_correction_target_message_mismatch");
    expect(correctionLineageMigration).toContain("p85-stage-4b4-transcript-correction-outcome-v2");
    expect(correctionLineageMigration).toContain("rerun_decision_id");
    expect(correctionLineageMigration).toContain(
      "grant execute on function p85_stage_4b4_commit_transcript_correction_v2",
    );
  });
});

describe("P85 Stage 4B-4 remediation R5 transcript bridge pipeline migration", () => {
  it("creates bridge worker RPCs, lease columns, and voice bundle deadline promotion", () => {
    expect(transcriptBridgePipelineMigration).toContain("p85_stage_4b4_claim_transcript_bridge_work_v2");
    expect(transcriptBridgePipelineMigration).toContain("p85_stage_4b4_complete_transcript_bridge_v2");
    expect(transcriptBridgePipelineMigration).toContain("p85_stage_4b4_fail_transcript_bridge_work_v2");
    expect(transcriptBridgePipelineMigration).toContain("p85_stage_4b4_promote_voice_bundle_deadlines_v2");
    expect(transcriptBridgePipelineMigration).toContain("interval '120 seconds'");
    expect(transcriptBridgePipelineMigration).toContain("transcription_timeout");
    expect(transcriptBridgePipelineMigration).toContain("for update of job skip locked");
    expect(transcriptBridgePipelineMigration).toContain(
      "grant execute on function p85_stage_4b4_complete_transcript_bridge_v2",
    );
  });
});

describe("P85 Stage 4B-4 remediation R4 fail-closed quality migration", () => {
  it("routes exhausted transcription failures to review_required with quality rejection reasons", () => {
    expect(failClosedQualityMigration).toContain("drop function if exists p85_stage_4b4_fail_transcription_work_v2");
    expect(failClosedQualityMigration).toContain("p_rejection_reasons text[]");
    expect(failClosedQualityMigration).toContain("set status = 'review_required'");
    expect(failClosedQualityMigration).toContain("array['retry_limit_exceeded']");
    expect(failClosedQualityMigration).toContain("array['provider_disabled']");
    expect(failClosedQualityMigration).toContain(
      "grant execute on function p85_stage_4b4_fail_transcription_work_v2",
    );
  });
});

describe("P85 Stage 4B-4 Phase 9 lifecycle signature transition", () => {
  it("drops the Stage 4B-3 return signature before installing the audio-aware contract", () => {
    expect(audioLifecycleSignatureTransitionMigrationName < audioLifecycleMigrationName).toBe(true);
    expect(audioLifecycleSignatureTransitionMigration).toContain(
      "drop function if exists p85_stage_4b3_redact_client_media_metadata",
    );
    expect(normalizeSqlNewlines(audioLifecycleSignatureTransitionMigration)).toContain("uuid,\n  uuid,\n  timestamptz");
    expect(audioLifecycleSignatureTransitionMigration).not.toContain("cascade");
    expect(audioLifecycleMigration).toContain("transcriptions_updated integer");
    expect(audioLifecycleMigration).toContain("transcript_corrections_updated integer");
  });
});

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

describe("P85 Stage 4B-4 Phase 3 canonical ingress V3 migration", () => {
  it("creates the V3 canonical inbound RPC with audio metadata columns", () => {
    expect(canonicalIngressV3Migration).toContain("p85_stage_4b4_commit_canonical_inbound_v3");
    expect(canonicalIngressV3Migration).toContain("media_kind");
    expect(canonicalIngressV3Migration).toContain("voice_message");
    expect(canonicalIngressV3Migration).toContain("duration_ms");
    expect(canonicalIngressV3Migration).toContain("sanitized_audio_object_key");
    expect(canonicalIngressV3Migration).toContain("audio_count");
    expect(canonicalIngressV3Migration).toContain("audio_duration_ms");
    expect(canonicalIngressV3Migration).toContain("transcription_id");
    expect(canonicalIngressV3Migration).toContain("service_role_required");
    expect(canonicalIngressV3Migration).toContain(
      "grant execute on function p85_stage_4b4_commit_canonical_inbound_v3",
    );
  });
});

describe("P85 Stage 4B-4 Phase 7 atomic transcript correction migration", () => {
  it("creates the transcript correction RPC with service_role-only execution", () => {
    expect(transcriptCorrectionMigration).toContain("p85_stage_4b4_commit_transcript_correction_v2");
    expect(transcriptCorrectionMigration).toContain("audio_transcript_correction_idempotency");
    expect(transcriptCorrectionMigration).toContain("stale_transcription_revision");
    expect(transcriptCorrectionMigration).toContain("sent_correction_auto_message_forbidden");
    expect(transcriptCorrectionMigration).toContain("service_role_required");
    expect(transcriptCorrectionMigration).toContain(
      "grant execute on function p85_stage_4b4_commit_transcript_correction_v2",
    );
  });
});

describe("P85 Stage 4B-4 Phase 8 bounded audio reads migration", () => {
  it("creates bounded voice read RPC and extends media stream for audio variant", () => {
    expect(boundedAudioReadsMigration).toContain("p85_stage_4b4_load_bounded_voice_v1");
    expect(boundedAudioReadsMigration).toContain("audio_transcription_records");
    expect(boundedAudioReadsMigration).toContain("audio_transcript_corrections");
    expect(boundedAudioReadsMigration).toContain("p85_stage_4b3_resolve_media_stream_v2");
    expect(boundedAudioReadsMigration).toContain("p85-stage-4b4-audio");
    expect(boundedAudioReadsMigration).toContain("sanitized_audio_object_key");
    expect(boundedAudioReadsMigration).toContain(
      "grant execute on function p85_stage_4b4_load_bounded_voice_v1",
    );
  });
});

describe("P85 Stage 4B-4 Phase 9 audio lifecycle migration", () => {
  it("extends media deletion saga for audio keys, DSAR, and transcription evidence redaction", () => {
    expect(audioLifecycleMigration).toContain("object_kind in ('full', 'thumbnail', 'audio')");
    expect(audioLifecycleMigration).toContain("sanitized_audio_object_key = null");
    expect(audioLifecycleMigration).toContain("p85_stage_4b4_process_due_audio_expiry_batch_v1");
    expect(audioLifecycleMigration).toContain("p85_stage_4b4_resume_legal_hold_audio_deletions_v1");
    expect(audioLifecycleMigration).toContain("p85_stage_4b4_redact_stale_audio_transcription_evidence_v1");
    expect(audioLifecycleMigration).toContain("p85_stage_4b4_prepare_client_audio_dsar_v1");
    expect(audioLifecycleMigration).toContain("excluded_voice_expired");
    expect(audioLifecycleMigration).toContain(
      "grant execute on function p85_stage_4b4_prepare_client_audio_dsar_v1",
    );
  });
});
