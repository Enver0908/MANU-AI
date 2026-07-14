-- Phase 85 Stage 4B-4: audio foundation tables, private WAV bucket, schema extensions, and RLS.
-- Foundation-only: no webhook ingress, transcription worker, or UI is enabled by this migration.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'p85-stage-4b4-audio',
  'p85-stage-4b4-audio',
  false,
  10485760,
  array['audio/wav']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table media_assets
  add column if not exists media_kind text,
  add column if not exists voice_message boolean,
  add column if not exists duration_ms integer,
  add column if not exists audio_codec text,
  add column if not exists audio_channels integer,
  add column if not exists sample_rate_hz integer,
  add column if not exists sanitized_audio_object_key text,
  add column if not exists transcription_id uuid;

update media_assets
set media_kind = 'image'
where media_kind is null;

alter table media_assets
  alter column media_kind set default 'image';

alter table media_assets
  drop constraint if exists media_assets_media_kind_check;

alter table media_assets
  add constraint media_assets_media_kind_check check (
    media_kind in ('image', 'audio')
  );

alter table media_assets
  drop constraint if exists media_assets_audio_duration_check;

alter table media_assets
  add constraint media_assets_audio_duration_check check (
    duration_ms is null or (duration_ms >= 0 and duration_ms <= 300000)
  );

alter table media_assets
  drop constraint if exists media_assets_audio_channels_check;

alter table media_assets
  add constraint media_assets_audio_channels_check check (
    audio_channels is null or audio_channels = 1
  );

alter table media_assets
  drop constraint if exists media_assets_sample_rate_check;

alter table media_assets
  add constraint media_assets_sample_rate_check check (
    sample_rate_hz is null or sample_rate_hz = 16000
  );

alter table inbound_message_bundles
  add column if not exists audio_count integer,
  add column if not exists audio_duration_ms integer;

update inbound_message_bundles
set audio_count = 0
where audio_count is null;

update inbound_message_bundles
set audio_duration_ms = 0
where audio_duration_ms is null;

alter table inbound_message_bundles
  alter column audio_count set default 0,
  alter column audio_duration_ms set default 0;

alter table inbound_message_bundles
  alter column audio_count set not null,
  alter column audio_duration_ms set not null;

alter table inbound_message_bundles
  drop constraint if exists inbound_message_bundles_counts_check;

alter table inbound_message_bundles
  add constraint inbound_message_bundles_counts_check check (
    item_count >= 0
    and image_count >= 0
    and audio_count >= 0
    and audio_duration_ms >= 0
    and unicode_codepoint_count >= 0
    and audio_count <= 4
    and audio_duration_ms <= 600000
  );

alter table inbound_message_bundle_items
  add column if not exists transcription_id uuid;

alter table inbound_message_bundle_items
  drop constraint if exists inbound_message_bundle_items_item_type_check;

alter table inbound_message_bundle_items
  add constraint inbound_message_bundle_items_item_type_check check (
    item_type in ('text', 'image', 'caption', 'voice')
  );

create table if not exists audio_transcription_records (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null,
  conversation_id uuid not null,
  message_id uuid not null,
  media_asset_id uuid not null,
  bundle_id uuid,
  transcription_revision bigint not null default 1,
  status text not null default 'pending',
  locale text not null,
  observation jsonb,
  quality_decision jsonb,
  rejection_reasons text[] not null default '{}',
  source_modality text not null default 'voice_transcript',
  provider_mode text not null default 'mock',
  retrieval_eligible boolean not null default false,
  evidence_expires_at timestamptz,
  retry_count integer not null default 0,
  next_attempt_at timestamptz,
  lease_owner text,
  lease_token uuid,
  lease_expires_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audio_transcription_records_status_check check (
    status in (
      'pending',
      'processing',
      'accepted',
      'rejected',
      'failed',
      'superseded',
      'review_required'
    )
  ),
  constraint audio_transcription_records_locale_check check (
    locale in ('tr-TR', 'en-US', 'de-DE', 'fr-FR', 'es-ES', 'pt-PT', 'cs-CZ')
  ),
  constraint audio_transcription_records_revision_check check (transcription_revision >= 1),
  constraint audio_transcription_records_retry_count_check check (retry_count >= 0 and retry_count <= 3),
  constraint audio_transcription_records_source_modality_check check (source_modality = 'voice_transcript'),
  constraint audio_transcription_records_provider_mode_check check (provider_mode = 'mock')
);

create unique index if not exists audio_transcription_records_tenant_asset_revision_idx
  on audio_transcription_records (tenant_id, media_asset_id, transcription_revision);

create index if not exists audio_transcription_records_worker_claim_idx
  on audio_transcription_records (tenant_id, status, next_attempt_at, lease_expires_at, created_at);

alter table audio_transcription_records
  add constraint audio_transcription_records_tenant_id_id_key unique (tenant_id, id);

create table if not exists audio_transcript_corrections (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null,
  conversation_id uuid not null,
  transcription_id uuid not null,
  dietitian_id uuid not null,
  status text not null default 'submitted',
  reason_code text not null,
  explanation text not null,
  corrected_transcript text not null,
  conversation_revision_at_submit bigint not null,
  transcription_revision_at_submit bigint not null,
  result_action text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audio_transcript_corrections_status_check check (
    status in ('submitted', 'applied_to_pending', 'manual_follow_up_required', 'closed')
  ),
  constraint audio_transcript_corrections_reason_code_check check (
    reason_code in (
      'wrong_word',
      'wrong_number',
      'wrong_medication',
      'wrong_language_fragment',
      'incomplete_transcript',
      'other_clinical_mismatch'
    )
  ),
  constraint audio_transcript_corrections_result_action_check check (
    result_action in ('supersede_rerun', 'invalidate_pending', 'manual_follow_up', 'closed_without_send')
  )
);

create index if not exists audio_transcript_corrections_tenant_transcription_idx
  on audio_transcript_corrections (tenant_id, transcription_id, created_at desc);

create table if not exists audio_transcript_correction_idempotency (
  tenant_id uuid not null references tenants(id) on delete cascade,
  dedupe_key text not null,
  correction_id uuid not null,
  conversation_revision bigint not null,
  response_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (tenant_id, dedupe_key),
  constraint audio_transcript_correction_idempotency_revision_check check (conversation_revision >= 1)
);

alter table inbound_message_bundle_items
  add constraint inbound_message_bundle_items_transcription_tenant_fk
  foreign key (tenant_id, transcription_id) references audio_transcription_records (tenant_id, id);

alter table audio_transcription_records
  add constraint audio_transcription_records_client_tenant_fk
  foreign key (tenant_id, client_id) references clients (tenant_id, id);

alter table audio_transcription_records
  add constraint audio_transcription_records_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references conversations (tenant_id, id);

alter table audio_transcription_records
  add constraint audio_transcription_records_message_tenant_fk
  foreign key (tenant_id, message_id) references messages (tenant_id, id);

alter table audio_transcription_records
  add constraint audio_transcription_records_asset_tenant_fk
  foreign key (tenant_id, media_asset_id) references media_assets (tenant_id, id);

alter table audio_transcription_records
  add constraint audio_transcription_records_bundle_tenant_fk
  foreign key (tenant_id, bundle_id) references inbound_message_bundles (tenant_id, id);

alter table audio_transcript_corrections
  add constraint audio_transcript_corrections_client_tenant_fk
  foreign key (tenant_id, client_id) references clients (tenant_id, id);

alter table audio_transcript_corrections
  add constraint audio_transcript_corrections_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references conversations (tenant_id, id);

alter table audio_transcript_corrections
  add constraint audio_transcript_corrections_transcription_tenant_fk
  foreign key (tenant_id, transcription_id) references audio_transcription_records (tenant_id, id);

alter table audio_transcript_corrections
  add constraint audio_transcript_corrections_dietitian_tenant_fk
  foreign key (tenant_id, dietitian_id) references dietitians (tenant_id, id);

alter table channel_events drop constraint if exists channel_events_event_kind_check;
alter table channel_events add constraint channel_events_event_kind_check check (
  event_kind in (
    'client_message_text',
    'client_message_image',
    'client_message_audio',
    'client_message_media_unsupported',
    'business_human_echo_text',
    'business_human_echo_media_unsupported',
    'outbound_status',
    'history_client_message',
    'history_business_human_message',
    'message_edit',
    'message_revoke',
    'message_revision_unknown_target',
    'malformed_event',
    'duplicate_event',
    'duplicate_message',
    'unknown_account',
    'unknown_client',
    'ambiguous_client',
    'cross_tenant_collision',
    'unsupported_event'
  )
);

alter table audio_transcription_records enable row level security;
alter table audio_transcript_corrections enable row level security;
alter table audio_transcript_correction_idempotency enable row level security;

drop policy if exists "p85 stage4b4 audio transcription deny direct access" on audio_transcription_records;
create policy "p85 stage4b4 audio transcription deny direct access"
on audio_transcription_records for all
using (false)
with check (false);

drop policy if exists "p85 stage4b4 audio transcript corrections deny direct access" on audio_transcript_corrections;
create policy "p85 stage4b4 audio transcript corrections deny direct access"
on audio_transcript_corrections for all
using (false)
with check (false);

drop policy if exists "p85 stage4b4 audio transcript correction idempotency deny direct access" on audio_transcript_correction_idempotency;
create policy "p85 stage4b4 audio transcript correction idempotency deny direct access"
on audio_transcript_correction_idempotency for all
using (false)
with check (false);

revoke all on table audio_transcription_records from public, anon, authenticated;
revoke all on table audio_transcript_corrections from public, anon, authenticated;
revoke all on table audio_transcript_correction_idempotency from public, anon, authenticated;

grant all on table audio_transcription_records to service_role;
grant all on table audio_transcript_corrections to service_role;
grant all on table audio_transcript_correction_idempotency to service_role;

drop policy if exists "p85 stage4b4 audio bucket public read" on storage.objects;
drop policy if exists "p85 stage4b4 audio bucket authenticated read" on storage.objects;
drop policy if exists "p85 stage4b4 audio bucket authenticated write" on storage.objects;
