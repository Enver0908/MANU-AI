-- Phase 85 Stage 4B-4 Phase 9: audio lifecycle expiry, DSAR, legal hold, and transcription evidence redaction.

create index if not exists media_assets_voice_expiry_due_idx
  on media_assets (tenant_id, expires_at)
  where deleted_at is null
    and status not in ('expired', 'revoked')
    and (media_kind = 'audio' or voice_message = true);

alter table media_pending_object_keys
  drop constraint if exists media_pending_object_keys_kind_check;

alter table media_pending_object_keys
  add constraint media_pending_object_keys_kind_check check (object_kind in ('full', 'thumbnail', 'audio'));

create or replace function p85_stage_4b3_finalize_media_asset_expiry(
  p_tenant_id uuid,
  p_asset_id uuid,
  p_now timestamptz default now()
)
returns table (
  id uuid,
  status text,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tenant_id is null or p_asset_id is null then
    raise exception 'tenant_and_asset_required';
  end if;

  return query
  update media_assets
  set status = 'expired',
      provider_media_id = null,
      sanitized_full_object_key = null,
      thumbnail_object_key = null,
      sanitized_audio_object_key = null,
      deleted_at = p_now,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and id = p_asset_id
    and deleted_at is null
    and status not in ('expired', 'revoked')
    and expires_at is not null
    and expires_at <= p_now
  returning media_assets.id, media_assets.status, media_assets.deleted_at;
end;
$$;

create or replace function p85_stage_4b3_finalize_media_asset_terminal_v2(
  p_tenant_id uuid,
  p_asset_id uuid,
  p_terminal_intent text,
  p_now timestamptz default now()
)
returns media_assets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row media_assets%rowtype;
  v_status text := case when p_terminal_intent = 'revoked' then 'revoked' else 'expired' end;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  delete from media_pending_object_keys
  where tenant_id = p_tenant_id
    and media_asset_id = p_asset_id;

  update media_assets
  set status = v_status,
      provider_media_id = null,
      sanitized_full_object_key = null,
      thumbnail_object_key = null,
      sanitized_audio_object_key = null,
      deletion_terminal_intent = null,
      deleted_at = p_now,
      failure_code = null,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and id = p_asset_id
    and status = 'deletion_pending'
  returning * into v_row;

  if not found then
    raise exception 'media_asset_not_pending_deletion';
  end if;

  return v_row;
end;
$$;

create or replace function p85_stage_4b4_redact_audio_transcription_evidence(
  p_tenant_id uuid,
  p_transcription_id uuid,
  p_preserve_transcript_text boolean default false,
  p_now timestamptz default now()
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

  update audio_transcription_records
  set observation = case
        when observation is null then null
        else jsonb_build_object(
          'schemaVersion', coalesce(observation->>'schemaVersion', 'audio-transcription-observation-v1-v0.1.0'),
          'locale', coalesce(observation->>'locale', 'tr-TR'),
          'transcriptText', case
            when p_preserve_transcript_text then coalesce(observation->>'transcriptText', '')
            else 'REDACTED_BY_PHASE74_POLICY'
          end,
          'overallConfidence', 0,
          'segments', '[]'::jsonb,
          'uncertainSpanCount', 0,
          'providerId', 'REDACTED_BY_PHASE74_POLICY',
          'providerVersion', 'REDACTED_BY_PHASE74_POLICY'
        )
      end,
      quality_decision = null,
      rejection_reasons = '{}',
      retrieval_eligible = false,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and id = p_transcription_id
  returning * into v_row;

  if not found then
    raise exception 'audio_transcription_not_found';
  end if;

  return v_row;
end;
$$;

create or replace function p85_stage_4b3_prepare_media_asset_deletion_v2(
  p_tenant_id uuid,
  p_asset_id uuid,
  p_terminal_intent text default 'expired',
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset media_assets%rowtype;
  v_client clients%rowtype;
  v_intent text := case when p_terminal_intent = 'revoked' then 'revoked' else 'expired' end;
  v_full_key text;
  v_thumb_key text;
  v_audio_key text;
  v_enqueued integer := 0;
  v_is_voice boolean := false;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_asset
  from media_assets
  where tenant_id = p_tenant_id
    and id = p_asset_id
  for update;

  if not found then
    raise exception 'media_asset_not_found';
  end if;

  if v_asset.status in ('expired', 'revoked') then
    return jsonb_build_object('status', 'already_terminal', 'assetId', p_asset_id);
  end if;

  if v_asset.status = 'deletion_pending' then
    return jsonb_build_object('status', 'already_prepared', 'assetId', p_asset_id);
  end if;

  if v_intent = 'expired' then
    if v_asset.expires_at is null or v_asset.expires_at > p_now then
      raise exception 'media_asset_not_due_for_expiry';
    end if;
  end if;

  select *
    into v_client
  from clients
  where tenant_id = p_tenant_id
    and id = v_asset.client_id;

  v_is_voice := coalesce(v_asset.media_kind, '') = 'audio' or coalesce(v_asset.voice_message, false) = true;
  v_full_key := nullif(trim(v_asset.sanitized_full_object_key), '');
  v_thumb_key := nullif(trim(v_asset.thumbnail_object_key), '');
  v_audio_key := nullif(trim(v_asset.sanitized_audio_object_key), '');

  if v_full_key is not null then
    insert into media_pending_object_keys (tenant_id, media_asset_id, object_key, object_kind, terminal_intent)
    values (p_tenant_id, p_asset_id, v_full_key, 'full', v_intent)
    on conflict do nothing;
  end if;

  if v_thumb_key is not null and v_thumb_key is distinct from v_full_key then
    insert into media_pending_object_keys (tenant_id, media_asset_id, object_key, object_kind, terminal_intent)
    values (p_tenant_id, p_asset_id, v_thumb_key, 'thumbnail', v_intent)
    on conflict do nothing;
  end if;

  if v_audio_key is not null then
    insert into media_pending_object_keys (tenant_id, media_asset_id, object_key, object_kind, terminal_intent)
    values (p_tenant_id, p_asset_id, v_audio_key, 'audio', v_intent)
    on conflict do nothing;
  end if;

  update media_assets
  set status = 'deletion_pending',
      deletion_terminal_intent = v_intent,
      sanitized_full_object_key = null,
      thumbnail_object_key = null,
      sanitized_audio_object_key = null,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and id = p_asset_id;

  update visual_analysis_records
  set retrieval_eligible = false,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and media_asset_id = p_asset_id
    and retrieval_eligible = true;

  update audio_transcription_records
  set retrieval_eligible = false,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and media_asset_id = p_asset_id
    and retrieval_eligible = true;

  perform p85_stage_4b4_redact_audio_transcription_evidence(
    p_tenant_id,
    atr.id,
    atr.status = 'accepted',
    p_now
  )
  from audio_transcription_records atr
  where atr.tenant_id = p_tenant_id
    and atr.media_asset_id = p_asset_id;

  update messages
  set retrieval_eligibility = case
        when v_intent = 'revoked' then 'excluded_revoked'
        when v_is_voice then 'excluded_voice_expired'
        else 'excluded_media_expired'
      end,
      content_status = case when v_intent = 'revoked' then 'revoked' else content_status end,
      observed_at = p_now
  where tenant_id = p_tenant_id
    and id = v_asset.message_id;

  if coalesce(v_client.media_legal_hold, false) = false then
    if v_full_key is not null then
      perform p85_stage_4b3_enqueue_media_object_operation_v2(
        p_tenant_id, p_asset_id, v_full_key, 'delete_object', null
      );
      v_enqueued := v_enqueued + 1;
    end if;
    if v_thumb_key is not null and v_thumb_key is distinct from v_full_key then
      perform p85_stage_4b3_enqueue_media_object_operation_v2(
        p_tenant_id, p_asset_id, v_thumb_key, 'delete_object', null
      );
      v_enqueued := v_enqueued + 1;
    end if;
    if v_audio_key is not null then
      perform p85_stage_4b3_enqueue_media_object_operation_v2(
        p_tenant_id, p_asset_id, v_audio_key, 'delete_object', null
      );
      v_enqueued := v_enqueued + 1;
    end if;
    if v_full_key is null and v_thumb_key is null and v_audio_key is null then
      perform p85_stage_4b3_finalize_media_asset_terminal_v2(p_tenant_id, p_asset_id, v_intent, p_now);
      return jsonb_build_object('status', 'finalized_without_objects', 'assetId', p_asset_id, 'enqueued', 0);
    end if;
  end if;

  return jsonb_build_object(
    'status', 'prepared',
    'assetId', p_asset_id,
    'terminalIntent', v_intent,
    'enqueued', v_enqueued,
    'legalHold', coalesce(v_client.media_legal_hold, false)
  );
end;
$$;

create or replace function p85_stage_4b3_redact_client_media_metadata(
  p_tenant_id uuid,
  p_client_id uuid,
  p_now timestamptz default now()
)
returns table (
  media_assets_updated integer,
  bundles_updated integer,
  analyses_updated integer,
  corrections_updated integer,
  transcriptions_updated integer,
  transcript_corrections_updated integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_media_count integer := 0;
  v_bundle_count integer := 0;
  v_analysis_count integer := 0;
  v_correction_count integer := 0;
  v_transcription_count integer := 0;
  v_transcript_correction_count integer := 0;
begin
  if p_tenant_id is null or p_client_id is null then
    raise exception 'tenant_and_client_required';
  end if;

  update inbound_message_bundles
  set status = 'superseded',
      lease_owner = null,
      lease_expires_at = null,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and client_id = p_client_id
    and status in ('open', 'ready', 'processing');
  get diagnostics v_bundle_count = row_count;

  update media_assets
  set status = 'revoked',
      provider_media_id = null,
      sanitized_full_object_key = null,
      thumbnail_object_key = null,
      sanitized_audio_object_key = null,
      deleted_at = p_now,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and client_id = p_client_id
    and deleted_at is null;
  get diagnostics v_media_count = row_count;

  update visual_analysis_records
  set observation = jsonb_build_object(
        'schemaVersion', 'visual-observation-v1',
        'sceneType', coalesce(observation->>'sceneType', 'unknown'),
        'sceneConfidence', 0,
        'overallConfidence', 0,
        'qualityFlags', '[]'::jsonb,
        'entityCandidates', '[]'::jsonb,
        'ocrBlocks', '[]'::jsonb,
        'labelIntegrity', observation->'labelIntegrity',
        'sensitivitySignals', jsonb_build_array('REDACTED_BY_PHASE74_POLICY'),
        'promptInjectionSignals', jsonb_build_array('REDACTED_BY_PHASE74_POLICY'),
        'providerId', coalesce(observation->>'providerId', 'redacted'),
        'providerVersion', coalesce(observation->>'providerVersion', 'redacted')
      ),
      failure_code = case when failure_code is null then null else 'REDACTED_BY_PHASE74_POLICY' end,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and client_id = p_client_id;
  get diagnostics v_analysis_count = row_count;

  update visual_corrections
  set explanation = 'REDACTED_BY_PHASE74_POLICY',
      corrected_ocr_text = case when corrected_ocr_text is null then null else 'REDACTED_BY_PHASE74_POLICY' end,
      corrected_entity_labels = '[]'::jsonb,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and client_id = p_client_id;
  get diagnostics v_correction_count = row_count;

  update audio_transcription_records
  set observation = case
        when status = 'accepted' and observation is not null then jsonb_build_object(
          'schemaVersion', coalesce(observation->>'schemaVersion', 'audio-transcription-observation-v1-v0.1.0'),
          'locale', coalesce(observation->>'locale', 'tr-TR'),
          'transcriptText', coalesce(observation->>'transcriptText', ''),
          'overallConfidence', 0,
          'segments', '[]'::jsonb,
          'uncertainSpanCount', 0,
          'providerId', 'REDACTED_BY_PHASE74_POLICY',
          'providerVersion', 'REDACTED_BY_PHASE74_POLICY'
        )
        when observation is not null then jsonb_build_object(
          'schemaVersion', coalesce(observation->>'schemaVersion', 'audio-transcription-observation-v1-v0.1.0'),
          'locale', coalesce(observation->>'locale', 'tr-TR'),
          'transcriptText', 'REDACTED_BY_PHASE74_POLICY',
          'overallConfidence', 0,
          'segments', '[]'::jsonb,
          'uncertainSpanCount', 0,
          'providerId', 'REDACTED_BY_PHASE74_POLICY',
          'providerVersion', 'REDACTED_BY_PHASE74_POLICY'
        )
        else null
      end,
      quality_decision = null,
      rejection_reasons = '{}',
      retrieval_eligible = false,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and client_id = p_client_id;
  get diagnostics v_transcription_count = row_count;

  update audio_transcript_corrections
  set explanation = 'REDACTED_BY_PHASE74_POLICY',
      corrected_transcript = 'REDACTED_BY_PHASE74_POLICY',
      updated_at = p_now
  where tenant_id = p_tenant_id
    and client_id = p_client_id;
  get diagnostics v_transcript_correction_count = row_count;

  return query
  select v_media_count, v_bundle_count, v_analysis_count, v_correction_count, v_transcription_count, v_transcript_correction_count;
end;
$$;

create or replace function p85_stage_4b4_process_due_audio_expiry_batch_v1(
  p_tenant_id uuid,
  p_now timestamptz default now(),
  p_limit integer default 32
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset media_assets%rowtype;
  v_prepared integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  for v_asset in
    select *
    from media_assets
    where tenant_id = p_tenant_id
      and deleted_at is null
      and status not in ('expired', 'revoked', 'deletion_pending')
      and expires_at is not null
      and expires_at <= p_now
      and (media_kind = 'audio' or voice_message = true)
    order by expires_at asc
    limit greatest(p_limit, 1)
  loop
    perform p85_stage_4b3_prepare_media_asset_deletion_v2(
      p_tenant_id, v_asset.id, 'expired', p_now
    );
    v_prepared := v_prepared + 1;
  end loop;

  return jsonb_build_object('prepared', v_prepared, 'processedAt', p_now);
end;
$$;

create or replace function p85_stage_4b4_resume_legal_hold_audio_deletions_v1(
  p_tenant_id uuid,
  p_now timestamptz default now(),
  p_limit integer default 32
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_enqueued integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  for v_row in
    select distinct mp.media_asset_id, mp.object_key
    from media_pending_object_keys mp
    join media_assets ma
      on ma.tenant_id = mp.tenant_id
     and ma.id = mp.media_asset_id
    join clients c
      on c.tenant_id = ma.tenant_id
     and c.id = ma.client_id
    where mp.tenant_id = p_tenant_id
      and ma.status = 'deletion_pending'
      and mp.object_kind = 'audio'
      and coalesce(c.media_legal_hold, false) = false
      and not exists (
        select 1
        from media_object_operations op
        where op.tenant_id = mp.tenant_id
          and op.media_asset_id = mp.media_asset_id
          and op.object_key = mp.object_key
          and op.status in ('pending', 'leased', 'completed')
      )
    limit greatest(p_limit, 1)
  loop
    perform p85_stage_4b3_enqueue_media_object_operation_v2(
      p_tenant_id, v_row.media_asset_id, v_row.object_key, 'delete_object', null
    );
    v_enqueued := v_enqueued + 1;
  end loop;

  return jsonb_build_object('enqueued', v_enqueued, 'processedAt', p_now);
end;
$$;

create or replace function p85_stage_4b4_redact_stale_audio_transcription_evidence_v1(
  p_tenant_id uuid,
  p_now timestamptz default now(),
  p_limit integer default 64
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row audio_transcription_records%rowtype;
  v_redacted integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  for v_row in
    select atr.*
    from audio_transcription_records atr
    join media_assets ma
      on ma.tenant_id = atr.tenant_id
     and ma.id = atr.media_asset_id
    where atr.tenant_id = p_tenant_id
      and ma.expires_at is not null
      and ma.expires_at <= p_now
      and atr.observation is not null
      and jsonb_array_length(coalesce(atr.observation->'segments', '[]'::jsonb)) > 0
    order by ma.expires_at asc
    limit greatest(p_limit, 1)
  loop
    perform p85_stage_4b4_redact_audio_transcription_evidence(
      p_tenant_id,
      v_row.id,
      v_row.status = 'accepted',
      p_now
    );
    v_redacted := v_redacted + 1;
  end loop;

  return jsonb_build_object('transcriptionsRedacted', v_redacted, 'processedAt', p_now);
end;
$$;

create or replace function p85_stage_4b4_prepare_client_audio_dsar_v1(
  p_tenant_id uuid,
  p_client_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset media_assets%rowtype;
  v_prepared integer := 0;
  v_redacted record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  for v_asset in
    select *
    from media_assets
    where tenant_id = p_tenant_id
      and client_id = p_client_id
      and deleted_at is null
      and status not in ('expired', 'revoked', 'deletion_pending')
      and (media_kind = 'audio' or voice_message = true)
  loop
    perform p85_stage_4b3_prepare_media_asset_deletion_v2(
      p_tenant_id, v_asset.id, 'revoked', p_now
    );
    v_prepared := v_prepared + 1;
  end loop;

  select *
    into v_redacted
  from p85_stage_4b3_redact_client_media_metadata(p_tenant_id, p_client_id, p_now)
  limit 1;

  return jsonb_build_object(
    'status', 'prepared',
    'clientId', p_client_id,
    'assetsPrepared', v_prepared,
    'mediaAssetsUpdated', v_redacted.media_assets_updated,
    'bundlesUpdated', v_redacted.bundles_updated,
    'analysesUpdated', v_redacted.analyses_updated,
    'correctionsUpdated', v_redacted.corrections_updated,
    'transcriptionsUpdated', v_redacted.transcriptions_updated,
    'transcriptCorrectionsUpdated', v_redacted.transcript_corrections_updated
  );
end;
$$;

revoke all on function p85_stage_4b4_redact_audio_transcription_evidence(uuid, uuid, boolean, timestamptz) from public, anon, authenticated;
revoke all on function p85_stage_4b4_process_due_audio_expiry_batch_v1(uuid, timestamptz, integer) from public, anon, authenticated;
revoke all on function p85_stage_4b4_resume_legal_hold_audio_deletions_v1(uuid, timestamptz, integer) from public, anon, authenticated;
revoke all on function p85_stage_4b4_redact_stale_audio_transcription_evidence_v1(uuid, timestamptz, integer) from public, anon, authenticated;
revoke all on function p85_stage_4b4_prepare_client_audio_dsar_v1(uuid, uuid, timestamptz) from public, anon, authenticated;

grant execute on function p85_stage_4b4_redact_audio_transcription_evidence(uuid, uuid, boolean, timestamptz) to service_role;
grant execute on function p85_stage_4b4_process_due_audio_expiry_batch_v1(uuid, timestamptz, integer) to service_role;
grant execute on function p85_stage_4b4_resume_legal_hold_audio_deletions_v1(uuid, timestamptz, integer) to service_role;
grant execute on function p85_stage_4b4_redact_stale_audio_transcription_evidence_v1(uuid, timestamptz, integer) to service_role;
grant execute on function p85_stage_4b4_prepare_client_audio_dsar_v1(uuid, uuid, timestamptz) to service_role;
