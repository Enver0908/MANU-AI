-- Phase 85 Stage 4B-4 remediation R8: dedicated audio lifecycle worker RPCs.

create or replace function p85_stage_4b4_is_audio_lifecycle_object_key(p_object_key text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_object_key, '') like '%/voice.wav';
$$;

create or replace function p85_stage_4b4_claim_audio_lifecycle_work_v1(
  p_tenant_id uuid,
  p_worker_id text
)
returns setof media_object_operations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed media_object_operations%rowtype;
  v_token uuid := gen_random_uuid();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if coalesce(trim(p_worker_id), '') = '' then
    raise exception 'worker_id_required';
  end if;

  select op.*
    into v_claimed
  from media_object_operations op
  where op.tenant_id = p_tenant_id
    and op.status = 'pending'
    and op.retry_count < 3
    and (op.next_attempt_at is null or op.next_attempt_at <= now())
    and (op.lease_expires_at is null or op.lease_expires_at < now())
    and p85_stage_4b4_is_audio_lifecycle_object_key(op.object_key)
  order by op.created_at asc
  for update of op skip locked
  limit 1;

  if not found then
    return;
  end if;

  update media_object_operations
  set status = 'leased',
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

create or replace function p85_stage_4b4_release_audio_lifecycle_work_v1(
  p_tenant_id uuid,
  p_operation_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_success boolean,
  p_failure_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op media_object_operations%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_op
  from media_object_operations
  where tenant_id = p_tenant_id
    and id = p_operation_id;

  if not found then
    raise exception 'media_object_operation_not_found';
  end if;

  if not p85_stage_4b4_is_audio_lifecycle_object_key(v_op.object_key) then
    raise exception 'audio_lifecycle_operation_required';
  end if;

  return p85_stage_4b3_release_media_object_operation_v2(
    p_tenant_id,
    p_operation_id,
    p_worker_id,
    p_lease_token,
    p_success,
    p_failure_code
  );
end;
$$;

create or replace function p85_stage_4b4_complete_audio_lifecycle_work_v1(
  p_tenant_id uuid,
  p_operation_id uuid,
  p_worker_id text,
  p_lease_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  return p85_stage_4b4_release_audio_lifecycle_work_v1(
    p_tenant_id,
    p_operation_id,
    p_worker_id,
    p_lease_token,
    true,
    null
  );
end;
$$;

create or replace function p85_stage_4b4_enqueue_audio_orphan_cleanup_v1(
  p_tenant_id uuid,
  p_object_key text
)
returns media_object_operations
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if not p85_stage_4b4_is_audio_lifecycle_object_key(p_object_key) then
    raise exception 'audio_lifecycle_object_key_required';
  end if;

  return p85_stage_4b3_enqueue_media_object_operation_v2(
    p_tenant_id,
    null,
    p_object_key,
    'orphan_quarantine',
    null
  );
end;
$$;

create or replace function p85_stage_4b4_fail_audio_row_without_object_v1(
  p_tenant_id uuid,
  p_asset_id uuid,
  p_object_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset media_assets%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  update media_assets
  set failure_code = 'row_without_object',
      updated_at = p_now
  where tenant_id = p_tenant_id
    and id = p_asset_id
    and (media_kind = 'audio' or voice_message = true)
  returning * into v_asset;

  if not found then
    raise exception 'audio_media_asset_not_found';
  end if;

  return jsonb_build_object(
    'assetId', v_asset.id,
    'objectKey', p_object_key,
    'failureCode', 'row_without_object',
    'processedAt', p_now
  );
end;
$$;

revoke all on function p85_stage_4b4_claim_audio_lifecycle_work_v1(uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4b4_release_audio_lifecycle_work_v1(uuid, uuid, text, uuid, boolean, text) from public, anon, authenticated;
revoke all on function p85_stage_4b4_complete_audio_lifecycle_work_v1(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4b4_enqueue_audio_orphan_cleanup_v1(uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4b4_fail_audio_row_without_object_v1(uuid, uuid, text, timestamptz) from public, anon, authenticated;

grant execute on function p85_stage_4b4_claim_audio_lifecycle_work_v1(uuid, text) to service_role;
grant execute on function p85_stage_4b4_release_audio_lifecycle_work_v1(uuid, uuid, text, uuid, boolean, text) to service_role;
grant execute on function p85_stage_4b4_complete_audio_lifecycle_work_v1(uuid, uuid, text, uuid) to service_role;
grant execute on function p85_stage_4b4_enqueue_audio_orphan_cleanup_v1(uuid, text) to service_role;
grant execute on function p85_stage_4b4_fail_audio_row_without_object_v1(uuid, uuid, text, timestamptz) to service_role;
