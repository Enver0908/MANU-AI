-- Phase 85 Stage 4B-4: audio admission and transcription worker queue RPCs.

create or replace function p85_stage_4b4_claim_audio_admission_work_v1(
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
    and status in ('download_pending', 'admitted')
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
      lease_expires_at = now() + interval '120 seconds',
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = v_claimed.id
  returning * into v_claimed;

  return next v_claimed;
end;
$$;

create or replace function p85_stage_4b4_release_audio_admission_work_v1(
  p_tenant_id uuid,
  p_asset_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_success boolean,
  p_failure_code text default null
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
  set lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      retry_count = case
        when p_success then retry_count
        else least(retry_count + 1, 3)
      end,
      next_attempt_at = case
        when p_success then null
        else now() + interval '30 seconds'
      end,
      failure_code = case when p_success then null else coalesce(p_failure_code, failure_code) end,
      status = case
        when p_success then status
        when least(retry_count + 1, 3) >= 3 then 'failed'
        else status
      end,
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

create or replace function p85_stage_4b4_claim_transcription_work_v1(
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

  select *
    into v_claimed
  from audio_transcription_records
  where tenant_id = p_tenant_id
    and status = 'pending'
    and retry_count < 3
    and (next_attempt_at is null or next_attempt_at <= now())
    and (lease_expires_at is null or lease_expires_at < now())
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update audio_transcription_records
  set status = 'processing',
      lease_owner = p_worker_id,
      lease_token = v_token,
      lease_expires_at = now() + interval '120 seconds',
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = v_claimed.id
  returning * into v_claimed;

  return next v_claimed;
end;
$$;

create or replace function p85_stage_4b4_release_transcription_work_v1(
  p_tenant_id uuid,
  p_transcription_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_success boolean,
  p_terminal_status text,
  p_failure_code text default null
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

  if p_success and p_terminal_status not in ('accepted', 'rejected', 'review_required') then
    raise exception 'invalid_terminal_transcription_status';
  end if;

  update audio_transcription_records
  set lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      retry_count = case
        when p_success then retry_count
        else least(retry_count + 1, 3)
      end,
      next_attempt_at = case
        when p_success then null
        when least(retry_count + 1, 3) >= 3 then null
        else now() + interval '30 seconds'
      end,
      failure_code = case when p_success then null else coalesce(p_failure_code, failure_code) end,
      status = case
        when p_success then p_terminal_status
        when least(retry_count + 1, 3) >= 3 then 'failed'
        else 'pending'
      end,
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

revoke all on function p85_stage_4b4_claim_audio_admission_work_v1(uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4b4_release_audio_admission_work_v1(uuid, uuid, text, uuid, boolean, text) from public, anon, authenticated;
revoke all on function p85_stage_4b4_claim_transcription_work_v1(uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4b4_release_transcription_work_v1(uuid, uuid, text, uuid, boolean, text, text) from public, anon, authenticated;

grant execute on function p85_stage_4b4_claim_audio_admission_work_v1(uuid, text) to service_role;
grant execute on function p85_stage_4b4_release_audio_admission_work_v1(uuid, uuid, text, uuid, boolean, text) to service_role;
grant execute on function p85_stage_4b4_claim_transcription_work_v1(uuid, text) to service_role;
grant execute on function p85_stage_4b4_release_transcription_work_v1(uuid, uuid, text, uuid, boolean, text, text) to service_role;
