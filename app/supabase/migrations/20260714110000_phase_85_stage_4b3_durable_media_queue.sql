-- Phase 85 Stage 4B-3 remediation R2: durable queue foundation, object deletion saga, and V2 service RPCs.

create table if not exists media_object_operations (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  media_asset_id uuid,
  object_key text not null,
  operation_kind text not null default 'delete_object',
  status text not null default 'pending',
  retry_count integer not null default 0,
  next_attempt_at timestamptz,
  lease_owner text,
  lease_token uuid,
  lease_expires_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_object_operations_kind_check check (
    operation_kind in ('delete_object', 'orphan_quarantine')
  ),
  constraint media_object_operations_status_check check (
    status in ('pending', 'leased', 'completed', 'failed')
  ),
  constraint media_object_operations_retry_count_check check (retry_count >= 0 and retry_count <= 3)
);

create index if not exists media_object_operations_queue_idx
  on media_object_operations (tenant_id, status, next_attempt_at, lease_expires_at, created_at);

alter table media_object_operations
  drop constraint if exists media_object_operations_asset_tenant_fk;

alter table media_object_operations
  add constraint media_object_operations_asset_tenant_fk
  foreign key (tenant_id, media_asset_id) references media_assets (tenant_id, id);

alter table media_object_operations enable row level security;

drop policy if exists "p85 stage4b3 media object operations deny direct access" on media_object_operations;
create policy "p85 stage4b3 media object operations deny direct access"
on media_object_operations for all
using (false)
with check (false);

revoke all on table media_object_operations from public, anon, authenticated;
grant all on table media_object_operations to service_role;

create or replace function p85_stage_4b3_claim_media_work_v2(
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
    and status in ('download_pending', 'sanitized', 'analysis_pending')
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

create or replace function p85_stage_4b3_release_media_work_v2(
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
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  returning * into v_row;

  if not found then
    raise exception 'media_asset_lease_not_found';
  end if;

  return v_row;
end;
$$;

create or replace function p85_stage_4b3_claim_bundle_v2(
  p_tenant_id uuid,
  p_worker_id text
)
returns setof inbound_message_bundles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed inbound_message_bundles%rowtype;
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
  from inbound_message_bundles
  where tenant_id = p_tenant_id
    and status = 'ready'
    and ready_at <= now()
    and retry_count < 3
    and (next_attempt_at is null or next_attempt_at <= now())
    and (lease_expires_at is null or lease_expires_at < now())
  order by ready_at asc, created_at asc
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update inbound_message_bundles
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

create or replace function p85_stage_4b3_release_bundle_work_v2(
  p_tenant_id uuid,
  p_bundle_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_success boolean,
  p_reopen boolean default false,
  p_failure_code text default null
)
returns inbound_message_bundles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row inbound_message_bundles%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_lease_token is null then
    raise exception 'lease_token_required';
  end if;

  update inbound_message_bundles
  set lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      status = case
        when p_success then status
        when p_reopen then 'open'
        when least(retry_count + 1, 3) >= 3 then 'failed'
        else 'ready'
      end,
      retry_count = case
        when p_success then retry_count
        else least(retry_count + 1, 3)
      end,
      next_attempt_at = case
        when p_success then null
        else now() + interval '30 seconds'
      end,
      failure_code = case when p_success then null else coalesce(p_failure_code, failure_code) end,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_bundle_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  returning * into v_row;

  if not found then
    raise exception 'bundle_lease_not_found';
  end if;

  return v_row;
end;
$$;

create or replace function p85_stage_4b3_load_bounded_media_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_conversation_id uuid,
  p_message_ids uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if not p85_stage_4b_actor_context_valid(p_tenant_id, p_user_id, p_dietitian_id, p_role)
     or p_role = 'auditor'
     or not p85_stage_4b2_actor_can_read_conversation(
       p_tenant_id, p_conversation_id, p_user_id, p_dietitian_id, p_role
     ) then
    raise exception 'conversation_not_found';
  end if;

  select jsonb_build_object(
    'media_assets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ma.id,
        'message_id', ma.message_id,
        'status', ma.status,
        'declared_mime_type', ma.declared_mime_type,
        'detected_mime_type', ma.detected_mime_type,
        'width', ma.width,
        'height', ma.height,
        'expires_at', ma.expires_at,
        'has_thumbnail', ma.thumbnail_object_key is not null
      ))
      from media_assets ma
      where ma.tenant_id = p_tenant_id
        and ma.conversation_id = p_conversation_id
        and ma.message_id = any(p_message_ids)
    ), '[]'::jsonb),
    'visual_analysis_records', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', va.id,
        'media_asset_id', va.media_asset_id,
        'message_id', va.message_id,
        'bundle_id', va.bundle_id,
        'analysis_revision', va.analysis_revision,
        'status', va.status,
        'scene_type', va.observation ->> 'sceneType',
        'retrieval_eligible', va.retrieval_eligible
      ))
      from visual_analysis_records va
      where va.tenant_id = p_tenant_id
        and va.conversation_id = p_conversation_id
        and va.message_id = any(p_message_ids)
        and va.status <> 'superseded'
        and va.retrieval_eligible = true
    ), '[]'::jsonb),
    'inbound_message_bundles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'anchor_message_id', b.anchor_message_id,
        'status', b.status
      ))
      from inbound_message_bundles b
      where b.tenant_id = p_tenant_id
        and b.conversation_id = p_conversation_id
        and b.anchor_message_id = any(p_message_ids)
    ), '[]'::jsonb),
    'visual_corrections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', vc.id,
        'analysis_id', vc.analysis_id,
        'status', vc.status,
        'created_at', vc.created_at
      ) order by vc.created_at desc)
      from visual_corrections vc
      where vc.tenant_id = p_tenant_id
        and vc.conversation_id = p_conversation_id
        and vc.analysis_id in (
          select va.id
          from visual_analysis_records va
          where va.tenant_id = p_tenant_id
            and va.conversation_id = p_conversation_id
            and va.message_id = any(p_message_ids)
        )
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function p85_stage_4b3_resolve_media_stream_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_conversation_id uuid,
  p_asset_id uuid,
  p_variant text default 'thumbnail'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_asset media_assets%rowtype;
  v_object_key text;
  v_content_type text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if not p85_stage_4b_actor_context_valid(p_tenant_id, p_user_id, p_dietitian_id, p_role)
     or p_role = 'auditor'
     or not p85_stage_4b2_actor_can_read_conversation(
       p_tenant_id, p_conversation_id, p_user_id, p_dietitian_id, p_role
     ) then
    raise exception 'conversation_not_found';
  end if;

  select *
    into v_asset
  from media_assets
  where tenant_id = p_tenant_id
    and id = p_asset_id
    and conversation_id = p_conversation_id;

  if not found then
    raise exception 'media_asset_not_found';
  end if;

  if v_asset.status in ('expired', 'revoked') or v_asset.deleted_at is not null then
    raise exception 'media_asset_unavailable';
  end if;

  if coalesce(p_variant, 'thumbnail') = 'full' then
    v_object_key := coalesce(v_asset.sanitized_full_object_key, v_asset.thumbnail_object_key);
    v_content_type := coalesce(v_asset.detected_mime_type, v_asset.declared_mime_type, 'image/jpeg');
  else
    v_object_key := coalesce(v_asset.thumbnail_object_key, v_asset.sanitized_full_object_key);
    v_content_type := 'image/jpeg';
  end if;

  if v_object_key is null or trim(v_object_key) = '' then
    raise exception 'media_asset_unavailable';
  end if;

  return jsonb_build_object(
    'object_key', v_object_key,
    'content_type', v_content_type
  );
end;
$$;

revoke all on function p85_stage_4b3_claim_media_work_v2(uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4b3_release_media_work_v2(uuid, uuid, text, uuid, boolean, text) from public, anon, authenticated;
revoke all on function p85_stage_4b3_claim_bundle_v2(uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4b3_release_bundle_work_v2(uuid, uuid, text, uuid, boolean, boolean, text) from public, anon, authenticated;
revoke all on function p85_stage_4b3_load_bounded_media_v2(uuid, uuid, uuid, text, uuid, uuid[]) from public, anon, authenticated;
revoke all on function p85_stage_4b3_resolve_media_stream_v2(uuid, uuid, uuid, text, uuid, uuid, text) from public, anon, authenticated;

grant execute on function p85_stage_4b3_claim_media_work_v2(uuid, text) to service_role;
grant execute on function p85_stage_4b3_release_media_work_v2(uuid, uuid, text, uuid, boolean, text) to service_role;
grant execute on function p85_stage_4b3_claim_bundle_v2(uuid, text) to service_role;
grant execute on function p85_stage_4b3_release_bundle_work_v2(uuid, uuid, text, uuid, boolean, boolean, text) to service_role;
grant execute on function p85_stage_4b3_load_bounded_media_v2(uuid, uuid, uuid, text, uuid, uuid[]) to service_role;
grant execute on function p85_stage_4b3_resolve_media_stream_v2(uuid, uuid, uuid, text, uuid, uuid, text) to service_role;
