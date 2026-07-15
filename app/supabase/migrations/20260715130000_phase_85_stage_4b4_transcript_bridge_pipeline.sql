-- Phase 85 Stage 4B-4 post-closure remediation R5:
-- durable transcript bridge worker RPCs and bundle voice deadline promotion.

alter table audio_transcript_bridge_jobs
  add column if not exists lease_owner text,
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists retry_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz;

alter table audio_transcript_bridge_jobs
  drop constraint if exists audio_transcript_bridge_jobs_retry_count_check;

alter table audio_transcript_bridge_jobs
  add constraint audio_transcript_bridge_jobs_retry_count_check check (
    retry_count >= 0 and retry_count <= 3
  );

create or replace function p85_stage_4b4_claim_transcript_bridge_work_v2(
  p_tenant_id uuid,
  p_worker_id text
)
returns setof audio_transcript_bridge_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed audio_transcript_bridge_jobs%rowtype;
  v_token uuid := gen_random_uuid();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if coalesce(trim(p_worker_id), '') = '' then
    raise exception 'worker_id_required';
  end if;

  select job.*
    into v_claimed
  from audio_transcript_bridge_jobs job
  join audio_transcription_records atr
    on atr.tenant_id = job.tenant_id
   and atr.id = job.transcription_id
   and atr.transcription_revision = job.transcription_revision
  where job.tenant_id = p_tenant_id
    and job.status = 'pending'
    and atr.status = 'accepted'
    and job.retry_count < 3
    and (job.next_attempt_at is null or job.next_attempt_at <= now())
    and (job.lease_expires_at is null or job.lease_expires_at < now())
  order by job.created_at asc
  for update of job skip locked
  limit 1;

  if not found then
    return;
  end if;

  update audio_transcript_bridge_jobs
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

create or replace function p85_stage_4b4_complete_transcript_bridge_v2(
  p_tenant_id uuid,
  p_bridge_job_id uuid,
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
  v_job audio_transcript_bridge_jobs%rowtype;
  v_transcription audio_transcription_records%rowtype;
  v_message messages%rowtype;
  v_bundle inbound_message_bundles%rowtype;
  v_placeholder text := coalesce(nullif(p_payload->>'placeholderBody', ''), '[client voice message]');
  v_transcript_text text := nullif(p_payload->>'transcriptText', '');
  v_unicode_increment integer := coalesce(nullif(p_payload->>'unicodeIncrement', '')::integer, 0);
  v_body_updated boolean := false;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_lease_token is null or v_transcript_text is null then
    raise exception 'transcript_bridge_payload_invalid';
  end if;

  update audio_transcript_bridge_jobs
  set lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      status = 'completed',
      failure_code = null,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_bridge_job_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  returning * into v_job;

  if not found then
    raise exception 'transcript_bridge_lease_not_found';
  end if;

  select *
    into v_transcription
  from audio_transcription_records
  where tenant_id = p_tenant_id
    and id = v_job.transcription_id
    and transcription_revision = v_job.transcription_revision
    and status = 'accepted';

  if not found then
    raise exception 'transcript_bridge_transcription_not_accepted';
  end if;

  select *
    into v_message
  from messages
  where tenant_id = p_tenant_id
    and id = v_job.message_id
  for update;

  if not found then
    raise exception 'transcript_bridge_message_not_found';
  end if;

  if trim(coalesce(v_message.body, '')) = trim(v_placeholder) then
    update messages
    set body = v_transcript_text,
        content_status = 'available',
        retrieval_eligibility = 'eligible'
    where tenant_id = p_tenant_id
      and id = v_job.message_id;
    v_body_updated := true;
  end if;

  update inbound_message_bundle_items
  set transcription_id = v_job.transcription_id
  where tenant_id = p_tenant_id
    and bundle_id = v_job.bundle_id
    and message_id = v_job.message_id
    and item_type = 'voice';

  if v_job.bundle_id is not null and v_unicode_increment > 0 then
    select *
      into v_bundle
    from inbound_message_bundles
    where tenant_id = p_tenant_id
      and id = v_job.bundle_id
    for update;

    if found then
      update inbound_message_bundles
      set unicode_codepoint_count = unicode_codepoint_count + v_unicode_increment,
          status = case
            when audio_count > 4
              or audio_duration_ms > 600000
              or unicode_codepoint_count + v_unicode_increment > 4096
              then 'review_required'
            else status
          end,
          failure_code = case
            when audio_count > 4 then 'bundle_audio_cap_exceeded'
            when audio_duration_ms > 600000 then 'bundle_audio_duration_cap_exceeded'
            when unicode_codepoint_count + v_unicode_increment > 4096 then 'bundle_unicode_cap_exceeded'
            else failure_code
          end,
          updated_at = now()
      where tenant_id = p_tenant_id
        and id = v_job.bundle_id;
    end if;
  end if;

  return jsonb_build_object(
    'status', 'completed',
    'bridgeJobId', v_job.id,
    'bodyUpdated', v_body_updated,
    'transcriptionId', v_job.transcription_id
  );
end;
$$;

create or replace function p85_stage_4b4_fail_transcript_bridge_work_v2(
  p_tenant_id uuid,
  p_bridge_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_failure_code text default 'bridge_failed'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job audio_transcript_bridge_jobs%rowtype;
  v_next_retry integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_job
  from audio_transcript_bridge_jobs
  where tenant_id = p_tenant_id
    and id = p_bridge_job_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  for update;

  if not found then
    raise exception 'transcript_bridge_lease_not_found';
  end if;

  v_next_retry := least(v_job.retry_count + 1, 3);

  if v_next_retry >= 3 then
    update audio_transcript_bridge_jobs
    set status = 'failed',
        failure_code = coalesce(p_failure_code, failure_code),
        lease_owner = null,
        lease_token = null,
        lease_expires_at = null,
        updated_at = now()
    where tenant_id = p_tenant_id
      and id = p_bridge_job_id;

    if v_job.bundle_id is not null then
      update inbound_message_bundles
      set status = 'review_required',
          failure_code = coalesce(p_failure_code, failure_code),
          updated_at = now()
      where tenant_id = p_tenant_id
        and id = v_job.bundle_id
        and status in ('open', 'ready', 'processing');
    end if;

    return jsonb_build_object('status', 'terminal_failure', 'bridgeJobId', p_bridge_job_id);
  end if;

  update audio_transcript_bridge_jobs
  set status = 'pending',
      retry_count = v_next_retry,
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
    and id = p_bridge_job_id;

  return jsonb_build_object('status', 'retry_scheduled', 'bridgeJobId', p_bridge_job_id);
end;
$$;

create or replace function p85_stage_4b4_promote_voice_bundle_deadlines_v2(
  p_tenant_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promoted integer := 0;
  v_timed_out integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  with voice_deadlines as (
    select
      b.id as bundle_id,
      min(bi.observed_at) + interval '120 seconds' as transcription_deadline
    from inbound_message_bundles b
    join inbound_message_bundle_items bi
      on bi.tenant_id = b.tenant_id
     and bi.bundle_id = b.id
     and bi.item_type = 'voice'
    where b.tenant_id = p_tenant_id
      and b.status = 'open'
    group by b.id
  ),
  timed_out as (
    update inbound_message_bundles b
    set status = 'review_required',
        failure_code = 'transcription_timeout',
        updated_at = p_now
    from voice_deadlines vd
    where b.tenant_id = p_tenant_id
      and b.id = vd.bundle_id
      and p_now >= vd.transcription_deadline
      and exists (
        select 1
        from inbound_message_bundle_items bi
        where bi.tenant_id = b.tenant_id
          and bi.bundle_id = b.id
          and bi.item_type = 'voice'
      )
      and exists (
        select 1
        from inbound_message_bundle_items bi
        left join audio_transcription_records atr
          on atr.tenant_id = bi.tenant_id
         and atr.id = bi.transcription_id
        left join media_assets ma
          on ma.tenant_id = bi.tenant_id
         and ma.id = bi.media_asset_id
        left join audio_transcription_records atr_asset
          on atr_asset.tenant_id = ma.tenant_id
         and atr_asset.media_asset_id = ma.id
         and atr_asset.status = 'accepted'
        where bi.tenant_id = b.tenant_id
          and bi.bundle_id = b.id
          and bi.item_type = 'voice'
          and coalesce(atr.status, atr_asset.status, 'pending') in ('pending', 'processing')
      )
    returning b.id
  )
  select count(*)::integer into v_timed_out from timed_out;

  with promoted as (
    update inbound_message_bundles b
    set status = 'ready',
        updated_at = p_now
    where b.tenant_id = p_tenant_id
      and b.status = 'open'
      and b.ready_at <= p_now
      and b.audio_count <= 4
      and b.audio_duration_ms <= 600000
      and not exists (
        select 1
        from inbound_message_bundle_items bi
        left join audio_transcription_records atr
          on atr.tenant_id = bi.tenant_id
         and atr.id = bi.transcription_id
        left join media_assets ma
          on ma.tenant_id = bi.tenant_id
         and ma.id = bi.media_asset_id
        left join audio_transcription_records atr_asset
          on atr_asset.tenant_id = ma.tenant_id
         and atr_asset.media_asset_id = ma.id
        left join messages m
          on m.tenant_id = bi.tenant_id
         and m.id = bi.message_id
        where bi.tenant_id = b.tenant_id
          and bi.bundle_id = b.id
          and bi.item_type = 'voice'
          and (
            coalesce(atr.status, atr_asset.status, 'pending') in ('pending', 'processing')
            or coalesce(atr.status, atr_asset.status) = 'review_required'
            or coalesce(atr.status, atr_asset.status) = 'failed'
            or ma.status in ('failed', 'download_pending')
            or (coalesce(atr.status, atr_asset.status) = 'accepted' and trim(coalesce(m.body, '')) = '[client voice message]')
          )
      )
    returning b.id
  )
  select count(*)::integer into v_promoted from promoted;

  return jsonb_build_object(
    'promoted', v_promoted,
    'transcriptionTimeouts', v_timed_out
  );
end;
$$;

revoke all on function p85_stage_4b4_claim_transcript_bridge_work_v2(uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4b4_complete_transcript_bridge_v2(uuid, uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function p85_stage_4b4_fail_transcript_bridge_work_v2(uuid, uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4b4_promote_voice_bundle_deadlines_v2(uuid, timestamptz) from public, anon, authenticated;

grant execute on function p85_stage_4b4_claim_transcript_bridge_work_v2(uuid, text) to service_role;
grant execute on function p85_stage_4b4_complete_transcript_bridge_v2(uuid, uuid, text, uuid, jsonb) to service_role;
grant execute on function p85_stage_4b4_fail_transcript_bridge_work_v2(uuid, uuid, text, uuid, text) to service_role;
grant execute on function p85_stage_4b4_promote_voice_bundle_deadlines_v2(uuid, timestamptz) to service_role;
