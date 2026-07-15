-- Phase 85 Stage 4B-4 post-closure remediation R3:
-- durable admission/transcription worker pipeline with lease-safe terminal RPC commits.

create table if not exists audio_transcript_bridge_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  transcription_id uuid not null,
  transcription_revision bigint not null,
  conversation_id uuid not null,
  media_asset_id uuid not null,
  message_id uuid not null,
  bundle_id uuid,
  idempotency_key text not null,
  status text not null default 'pending',
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audio_transcript_bridge_jobs_status_check check (
    status in ('pending', 'processing', 'completed', 'failed')
  ),
  constraint audio_transcript_bridge_jobs_revision_check check (transcription_revision >= 1)
);

create unique index if not exists audio_transcript_bridge_jobs_tenant_idempotency_idx
  on audio_transcript_bridge_jobs (tenant_id, idempotency_key);

create unique index if not exists audio_transcript_bridge_jobs_tenant_transcription_revision_idx
  on audio_transcript_bridge_jobs (tenant_id, transcription_id, transcription_revision);

create index if not exists audio_transcript_bridge_jobs_worker_claim_idx
  on audio_transcript_bridge_jobs (tenant_id, status, created_at);

alter table audio_transcript_bridge_jobs
  add constraint audio_transcript_bridge_jobs_transcription_tenant_fk
  foreign key (tenant_id, transcription_id)
  references audio_transcription_records (tenant_id, id);

alter table audio_transcript_bridge_jobs enable row level security;

drop policy if exists "p85 stage4b4 audio transcript bridge jobs deny direct access" on audio_transcript_bridge_jobs;
create policy "p85 stage4b4 audio transcript bridge jobs deny direct access"
on audio_transcript_bridge_jobs for all
using (false)
with check (false);

revoke all on table audio_transcript_bridge_jobs from public, anon, authenticated;
grant all on table audio_transcript_bridge_jobs to service_role;

create or replace function p85_stage_4b4_claim_audio_admission_work_v2(
  p_tenant_id uuid,
  p_worker_id text
)
returns setof media_assets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed media_assets%rowtype;
  v_token uuid := gen_random_uuid();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if coalesce(trim(p_worker_id), '') = '' then
    raise exception 'worker_id_required';
  end if;

  select *
    into v_claimed
  from media_assets
  where tenant_id = p_tenant_id
    and media_kind = 'audio'
    and status = 'download_pending'
    and retry_count < 3
    and (next_attempt_at is null or next_attempt_at <= now())
    and (lease_expires_at is null or lease_expires_at < now())
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update media_assets
  set lease_owner = p_worker_id,
      lease_token = v_token,
      lease_expires_at = now() + interval '60 seconds',
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = v_claimed.id
  returning * into v_claimed;

  return next v_claimed;
end;
$$;

create or replace function p85_stage_4b4_renew_audio_admission_lease_v2(
  p_tenant_id uuid,
  p_asset_id uuid,
  p_worker_id text,
  p_lease_token uuid
)
returns media_assets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row media_assets%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_lease_token is null then
    raise exception 'lease_token_required';
  end if;

  update media_assets
  set lease_expires_at = now() + interval '60 seconds',
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_asset_id
    and media_kind = 'audio'
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  returning * into v_row;

  if not found then
    raise exception 'audio_admission_lease_not_found';
  end if;

  return v_row;
end;
$$;

create or replace function p85_stage_4b4_complete_audio_admission_v2(
  p_tenant_id uuid,
  p_asset_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset media_assets%rowtype;
  v_transcription_id uuid := (p_payload->>'transcriptionId')::uuid;
  v_bundle_id uuid;
  v_locale text := coalesce(nullif(p_payload->>'locale', ''), 'tr-TR');
  v_stored_at timestamptz := coalesce(nullif(p_payload->>'storedAt', '')::timestamptz, now());
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_lease_token is null or v_transcription_id is null then
    raise exception 'audio_admission_payload_invalid';
  end if;

  update media_assets
  set provider_media_id = null,
      detected_mime_type = coalesce(nullif(p_payload->>'detectedMimeType', ''), 'audio/wav'),
      duration_ms = nullif(p_payload->>'durationMs', '')::integer,
      audio_codec = nullif(p_payload->>'audioCodec', ''),
      audio_channels = coalesce(nullif(p_payload->>'audioChannels', '')::integer, 1),
      sample_rate_hz = coalesce(nullif(p_payload->>'sampleRateHz', '')::integer, 16000),
      byte_size = nullif(p_payload->>'byteSize', '')::bigint,
      content_sha256 = nullif(p_payload->>'contentSha256', ''),
      sanitized_audio_object_key = nullif(p_payload->>'sanitizedAudioObjectKey', ''),
      status = 'analysis_pending',
      stored_at = v_stored_at,
      expires_at = nullif(p_payload->>'expiresAt', '')::timestamptz,
      failure_code = null,
      lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_asset_id
    and media_kind = 'audio'
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  returning * into v_asset;

  if not found then
    raise exception 'audio_admission_lease_not_found';
  end if;

  select bundle_id
    into v_bundle_id
  from inbound_message_bundle_items
  where tenant_id = p_tenant_id
    and media_asset_id = p_asset_id
  order by created_at desc
  limit 1;

  insert into audio_transcription_records (
    id,
    tenant_id,
    client_id,
    conversation_id,
    message_id,
    media_asset_id,
    bundle_id,
    transcription_revision,
    status,
    locale,
    observation,
    quality_decision,
    rejection_reasons,
    source_modality,
    provider_mode,
    retrieval_eligible,
    evidence_expires_at,
    retry_count,
    created_at,
    updated_at
  ) values (
    v_transcription_id,
    p_tenant_id,
    v_asset.client_id,
    v_asset.conversation_id,
    v_asset.message_id,
    v_asset.id,
    coalesce(nullif(p_payload->>'bundleId', '')::uuid, v_bundle_id),
    1,
    'pending',
    v_locale,
    null,
    null,
    '{}',
    'voice_transcript',
    'mock',
    false,
    v_asset.expires_at,
    0,
    v_stored_at,
    v_stored_at
  )
  on conflict (tenant_id, media_asset_id, transcription_revision) do nothing;

  select id
    into v_transcription_id
  from audio_transcription_records
  where tenant_id = p_tenant_id
    and media_asset_id = v_asset.id
    and transcription_revision = 1;

  update media_assets
  set transcription_id = v_transcription_id,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = v_asset.id;

  return jsonb_build_object(
    'status', 'completed',
    'assetId', v_asset.id,
    'transcriptionId', v_transcription_id,
    'sanitizedAudioObjectKey', v_asset.sanitized_audio_object_key
  );
end;
$$;

create or replace function p85_stage_4b4_fail_audio_admission_v2(
  p_tenant_id uuid,
  p_asset_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_failure_code text,
  p_terminal_class text default 'transient'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset media_assets%rowtype;
  v_bundle_id uuid;
  v_next_retry integer;
  v_terminal boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_lease_token is null then
    raise exception 'lease_token_required';
  end if;

  select *
    into v_asset
  from media_assets
  where tenant_id = p_tenant_id
    and id = p_asset_id
    and media_kind = 'audio'
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  for update;

  if not found then
    raise exception 'audio_admission_lease_not_found';
  end if;

  select bundle_id
    into v_bundle_id
  from inbound_message_bundle_items
  where tenant_id = p_tenant_id
    and media_asset_id = p_asset_id
  order by created_at desc
  limit 1;

  v_terminal := p_terminal_class = 'security';

  if not v_terminal then
    v_next_retry := least(v_asset.retry_count + 1, 3);
    v_terminal := v_next_retry >= 3;
  end if;

  if v_terminal then
    update media_assets
    set status = 'failed',
        failure_code = coalesce(p_failure_code, failure_code),
        provider_media_id = null,
        lease_owner = null,
        lease_token = null,
        lease_expires_at = null,
        next_attempt_at = null,
        updated_at = now()
    where tenant_id = p_tenant_id
      and id = p_asset_id;

    update messages
    set content_status = 'content_unavailable',
        retrieval_eligibility = 'excluded_unavailable'
    where tenant_id = p_tenant_id
      and id = v_asset.message_id;

    if v_bundle_id is not null then
      update inbound_message_bundles
      set status = 'review_required',
          failure_code = coalesce(p_failure_code, failure_code),
          lease_owner = null,
          lease_token = null,
          lease_expires_at = null,
          updated_at = now()
      where tenant_id = p_tenant_id
        and id = v_bundle_id;
    end if;

    return jsonb_build_object(
      'status', 'terminal_failure',
      'terminalClass', coalesce(p_terminal_class, 'transient'),
      'assetId', p_asset_id
    );
  end if;

  update media_assets
  set retry_count = least(retry_count + 1, 3),
      next_attempt_at = case
        when retry_count = 0 then now() + interval '1 second'
        else now() + interval '5 seconds'
      end,
      failure_code = coalesce(p_failure_code, failure_code),
      lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_asset_id;

  return jsonb_build_object(
    'status', 'retry_scheduled',
    'assetId', p_asset_id,
    'retryCount', least(v_asset.retry_count + 1, 3)
  );
end;
$$;

create or replace function p85_stage_4b4_claim_transcription_work_v2(
  p_tenant_id uuid,
  p_worker_id text
)
returns setof audio_transcription_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed audio_transcription_records%rowtype;
  v_token uuid := gen_random_uuid();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if coalesce(trim(p_worker_id), '') = '' then
    raise exception 'worker_id_required';
  end if;

  select atr.*
    into v_claimed
  from audio_transcription_records atr
  join media_assets ma
    on ma.tenant_id = atr.tenant_id
   and ma.id = atr.media_asset_id
  where atr.tenant_id = p_tenant_id
    and atr.status = 'pending'
    and ma.status = 'analysis_pending'
    and atr.retry_count < 3
    and (atr.next_attempt_at is null or atr.next_attempt_at <= now())
    and (atr.lease_expires_at is null or atr.lease_expires_at < now())
  order by atr.created_at asc
  for update of atr skip locked
  limit 1;

  if not found then
    return;
  end if;

  update audio_transcription_records
  set status = 'processing',
      lease_owner = p_worker_id,
      lease_token = v_token,
      lease_expires_at = now() + interval '60 seconds',
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = v_claimed.id
  returning * into v_claimed;

  return next v_claimed;
end;
$$;

create or replace function p85_stage_4b4_renew_transcription_lease_v2(
  p_tenant_id uuid,
  p_transcription_id uuid,
  p_worker_id text,
  p_lease_token uuid
)
returns audio_transcription_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row audio_transcription_records%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_lease_token is null then
    raise exception 'lease_token_required';
  end if;

  update audio_transcription_records
  set lease_expires_at = now() + interval '60 seconds',
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_transcription_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  returning * into v_row;

  if not found then
    raise exception 'transcription_lease_not_found';
  end if;

  return v_row;
end;
$$;

create or replace function p85_stage_4b4_complete_transcription_v2(
  p_tenant_id uuid,
  p_transcription_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row audio_transcription_records%rowtype;
  v_asset media_assets%rowtype;
  v_terminal_status text := coalesce(nullif(p_payload->>'terminalStatus', ''), 'review_required');
  v_bridge_key text := nullif(p_payload->>'bridgeIdempotencyKey', '');
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_lease_token is null then
    raise exception 'lease_token_required';
  end if;

  if v_terminal_status not in ('accepted', 'review_required', 'failed') then
    raise exception 'invalid_terminal_transcription_status';
  end if;

  update audio_transcription_records
  set observation = coalesce(p_payload->'observation', observation),
      quality_decision = coalesce(p_payload->'qualityDecision', quality_decision),
      rejection_reasons = coalesce(
        array(select jsonb_array_elements_text(coalesce(p_payload->'rejectionReasons', '[]'::jsonb))),
        rejection_reasons
      ),
      status = v_terminal_status,
      retrieval_eligible = coalesce((p_payload->>'retrievalEligible')::boolean, retrieval_eligible),
      transcript_text = nullif(p_payload->>'transcriptText', ''),
      detected_locale = nullif(p_payload->>'detectedLocale', ''),
      overall_confidence = nullif(p_payload->>'overallConfidence', '')::numeric,
      minimum_segment_confidence = nullif(p_payload->>'minimumSegmentConfidence', '')::numeric,
      uncertain_span_count = nullif(p_payload->>'uncertainSpanCount', '')::integer,
      segment_count = nullif(p_payload->>'segmentCount', '')::integer,
      speaker_state = nullif(p_payload->>'speakerState', ''),
      origin = coalesce(nullif(p_payload->>'origin', ''), origin, 'mock_provider'),
      failure_code = nullif(p_payload->>'failureCode', ''),
      lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_transcription_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  returning * into v_row;

  if not found then
    raise exception 'transcription_lease_not_found';
  end if;

  update media_assets
  set status = coalesce(nullif(p_payload->>'mediaAssetStatus', ''), status),
      failure_code = nullif(p_payload->>'mediaFailureCode', ''),
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = v_row.media_asset_id
  returning * into v_asset;

  if v_terminal_status = 'failed' then
    update messages
    set content_status = 'content_unavailable',
        retrieval_eligibility = 'excluded_unavailable'
    where tenant_id = p_tenant_id
      and id = v_row.message_id;
  end if;

  if v_terminal_status = 'accepted' and v_bridge_key is not null then
    insert into audio_transcript_bridge_jobs (
      tenant_id,
      transcription_id,
      transcription_revision,
      conversation_id,
      media_asset_id,
      message_id,
      bundle_id,
      idempotency_key,
      status
    ) values (
      p_tenant_id,
      v_row.id,
      v_row.transcription_revision,
      v_row.conversation_id,
      v_row.media_asset_id,
      v_row.message_id,
      v_row.bundle_id,
      v_bridge_key,
      'pending'
    )
    on conflict (tenant_id, idempotency_key) do nothing;
  end if;

  return jsonb_build_object(
    'status', 'completed',
    'transcriptionId', v_row.id,
    'terminalStatus', v_terminal_status,
    'bridgeEnqueued', v_terminal_status = 'accepted' and v_bridge_key is not null
  );
end;
$$;

create or replace function p85_stage_4b4_fail_transcription_work_v2(
  p_tenant_id uuid,
  p_transcription_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_failure_code text,
  p_terminal_class text default 'transient'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row audio_transcription_records%rowtype;
  v_next_retry integer;
  v_terminal boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_lease_token is null then
    raise exception 'lease_token_required';
  end if;

  select *
    into v_row
  from audio_transcription_records
  where tenant_id = p_tenant_id
    and id = p_transcription_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  for update;

  if not found then
    raise exception 'transcription_lease_not_found';
  end if;

  v_terminal := p_terminal_class = 'security';

  if not v_terminal then
    v_next_retry := least(v_row.retry_count + 1, 3);
    v_terminal := v_next_retry >= 3;
  end if;

  if v_terminal then
    update audio_transcription_records
    set status = case
          when p_terminal_class = 'security' then 'review_required'
          else 'failed'
        end,
        failure_code = coalesce(p_failure_code, failure_code),
        rejection_reasons = case
          when p_terminal_class = 'security' then array[coalesce(p_failure_code, 'malformed_observation')]
          else rejection_reasons
        end,
        lease_owner = null,
        lease_token = null,
        lease_expires_at = null,
        next_attempt_at = null,
        updated_at = now()
    where tenant_id = p_tenant_id
      and id = p_transcription_id;

    if p_terminal_class <> 'security' then
      update media_assets
      set status = 'failed',
          failure_code = coalesce(p_failure_code, failure_code),
          updated_at = now()
      where tenant_id = p_tenant_id
        and id = v_row.media_asset_id;

      update messages
      set content_status = 'content_unavailable',
          retrieval_eligibility = 'excluded_unavailable'
      where tenant_id = p_tenant_id
        and id = v_row.message_id;
    end if;

    return jsonb_build_object('status', 'terminal_failure', 'transcriptionId', p_transcription_id);
  end if;

  update audio_transcription_records
  set status = 'pending',
      retry_count = least(retry_count + 1, 3),
      next_attempt_at = case
        when retry_count = 0 then now() + interval '1 second'
        else now() + interval '5 seconds'
      end,
      failure_code = coalesce(p_failure_code, failure_code),
      lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_transcription_id;

  return jsonb_build_object(
    'status', 'retry_scheduled',
    'transcriptionId', p_transcription_id,
    'retryCount', least(v_row.retry_count + 1, 3)
  );
end;
$$;

revoke all on function p85_stage_4b4_claim_audio_admission_work_v2(uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4b4_renew_audio_admission_lease_v2(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4b4_complete_audio_admission_v2(uuid, uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function p85_stage_4b4_fail_audio_admission_v2(uuid, uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function p85_stage_4b4_claim_transcription_work_v2(uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4b4_renew_transcription_lease_v2(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4b4_complete_transcription_v2(uuid, uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function p85_stage_4b4_fail_transcription_work_v2(uuid, uuid, text, uuid, text, text) from public, anon, authenticated;

grant execute on function p85_stage_4b4_claim_audio_admission_work_v2(uuid, text) to service_role;
grant execute on function p85_stage_4b4_renew_audio_admission_lease_v2(uuid, uuid, text, uuid) to service_role;
grant execute on function p85_stage_4b4_complete_audio_admission_v2(uuid, uuid, text, uuid, jsonb) to service_role;
grant execute on function p85_stage_4b4_fail_audio_admission_v2(uuid, uuid, text, uuid, text, text) to service_role;
grant execute on function p85_stage_4b4_claim_transcription_work_v2(uuid, text) to service_role;
grant execute on function p85_stage_4b4_renew_transcription_lease_v2(uuid, uuid, text, uuid) to service_role;
grant execute on function p85_stage_4b4_complete_transcription_v2(uuid, uuid, text, uuid, jsonb) to service_role;
grant execute on function p85_stage_4b4_fail_transcription_work_v2(uuid, uuid, text, uuid, text, text) to service_role;
