-- Phase 85 Stage 4B-3 remediation R8: prepare-delete-finalize lifecycle saga, DSAR, orphan queue, evidence redaction.

alter table media_assets
  drop constraint if exists media_assets_status_check;

alter table media_assets
  add constraint media_assets_status_check check (
    status in (
      'admitted',
      'download_pending',
      'sanitized',
      'analysis_pending',
      'analysis_ready',
      'failed',
      'deletion_pending',
      'expired',
      'revoked'
    )
  );

alter table clients
  add column if not exists media_legal_hold boolean not null default false;

alter table media_assets
  add column if not exists deletion_terminal_intent text;

alter table media_assets
  drop constraint if exists media_assets_deletion_terminal_intent_check;

alter table media_assets
  add constraint media_assets_deletion_terminal_intent_check check (
    deletion_terminal_intent is null
    or deletion_terminal_intent in ('expired', 'revoked')
  );

create table if not exists media_pending_object_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  media_asset_id uuid not null,
  object_key text not null,
  object_kind text not null default 'full',
  terminal_intent text not null default 'expired',
  created_at timestamptz not null default now(),
  constraint media_pending_object_keys_kind_check check (object_kind in ('full', 'thumbnail')),
  constraint media_pending_object_keys_intent_check check (terminal_intent in ('expired', 'revoked')),
  constraint media_pending_object_keys_asset_tenant_fk
    foreign key (tenant_id, media_asset_id) references media_assets (tenant_id, id) on delete cascade
);

create unique index if not exists media_pending_object_keys_asset_key_idx
  on media_pending_object_keys (tenant_id, media_asset_id, object_key);

create index if not exists media_pending_object_keys_tenant_asset_idx
  on media_pending_object_keys (tenant_id, media_asset_id);

alter table media_pending_object_keys enable row level security;

drop policy if exists "p85 stage4b3 media pending object keys deny direct access" on media_pending_object_keys;
create policy "p85 stage4b3 media pending object keys deny direct access"
on media_pending_object_keys for all
using (false)
with check (false);

revoke all on table media_pending_object_keys from public, anon, authenticated;
grant all on table media_pending_object_keys to service_role;

create unique index if not exists media_object_operations_active_dedupe_idx
  on media_object_operations (tenant_id, media_asset_id, object_key)
  where status in ('pending', 'leased');

create or replace function p85_stage_4b3_enqueue_media_object_operation_v2(
  p_tenant_id uuid,
  p_media_asset_id uuid,
  p_object_key text,
  p_operation_kind text default 'delete_object',
  p_failure_code text default null
)
returns media_object_operations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row media_object_operations%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  insert into media_object_operations (
    id, tenant_id, media_asset_id, object_key, operation_kind, status, failure_code, created_at, updated_at
  ) values (
    gen_random_uuid(),
    p_tenant_id,
    p_media_asset_id,
    p_object_key,
    coalesce(nullif(p_operation_kind, ''), 'delete_object'),
    'pending',
    p_failure_code,
    now(),
    now()
  )
  on conflict do nothing
  returning * into v_row;

  if not found then
    select *
      into v_row
    from media_object_operations
    where tenant_id = p_tenant_id
      and media_asset_id = p_media_asset_id
      and object_key = p_object_key
      and status in ('pending', 'leased')
    limit 1;
  end if;

  return v_row;
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
  v_enqueued integer := 0;
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

  v_full_key := nullif(trim(v_asset.sanitized_full_object_key), '');
  v_thumb_key := nullif(trim(v_asset.thumbnail_object_key), '');

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

  update media_assets
  set status = 'deletion_pending',
      deletion_terminal_intent = v_intent,
      sanitized_full_object_key = null,
      thumbnail_object_key = null,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and id = p_asset_id;

  update visual_analysis_records
  set retrieval_eligible = false,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and media_asset_id = p_asset_id
    and retrieval_eligible = true;

  update messages
  set retrieval_eligibility = case
        when v_intent = 'revoked' then 'excluded_revoked'
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
    if v_full_key is null and v_thumb_key is null then
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

create or replace function p85_stage_4b3_prepare_client_media_dsar_v2(
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

  update inbound_message_bundles
  set status = 'superseded',
      lease_owner = null,
      lease_expires_at = null,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and client_id = p_client_id
    and status in ('open', 'ready', 'processing');

  for v_asset in
    select *
    from media_assets
    where tenant_id = p_tenant_id
      and client_id = p_client_id
      and deleted_at is null
      and status not in ('expired', 'revoked', 'deletion_pending')
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
    'correctionsUpdated', v_redacted.corrections_updated
  );
end;
$$;

create or replace function p85_stage_4b3_process_due_media_expiry_batch_v2(
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

create or replace function p85_stage_4b3_resume_legal_hold_media_deletions_v2(
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

create or replace function p85_stage_4b3_claim_media_object_operation_v2(
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

  select *
    into v_claimed
  from media_object_operations
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

create or replace function p85_stage_4b3_release_media_object_operation_v2(
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
  v_asset media_assets%rowtype;
  v_pending_count integer;
  v_active_count integer;
  v_next_retry integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_lease_token is null then
    raise exception 'lease_token_required';
  end if;

  select *
    into v_op
  from media_object_operations
  where tenant_id = p_tenant_id
    and id = p_operation_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  for update;

  if not found then
    raise exception 'media_object_operation_lease_not_found';
  end if;

  v_next_retry := least(v_op.retry_count + 1, 3);

  update media_object_operations
  set lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      retry_count = case when p_success then retry_count else v_next_retry end,
      next_attempt_at = case
        when p_success then null
        when v_next_retry >= 3 then null
        else now() + interval '30 seconds'
      end,
      failure_code = case when p_success then null else coalesce(p_failure_code, 'object_delete_failed') end,
      status = case
        when p_success then 'completed'
        when v_next_retry >= 3 then 'failed'
        else 'pending'
      end,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_operation_id
  returning * into v_op;

  if p_success then
    delete from media_pending_object_keys
    where tenant_id = p_tenant_id
      and media_asset_id = v_op.media_asset_id
      and object_key = v_op.object_key;
  elsif v_op.status = 'failed' and v_op.media_asset_id is not null then
    update media_assets
    set failure_code = coalesce(p_failure_code, 'object_delete_failed'),
        updated_at = now()
    where tenant_id = p_tenant_id
      and id = v_op.media_asset_id;
  end if;

  if v_op.media_asset_id is null then
    return jsonb_build_object('status', v_op.status, 'operationId', v_op.id);
  end if;

  select count(*)
    into v_pending_count
  from media_pending_object_keys
  where tenant_id = p_tenant_id
    and media_asset_id = v_op.media_asset_id;

  select count(*)
    into v_active_count
  from media_object_operations
  where tenant_id = p_tenant_id
    and media_asset_id = v_op.media_asset_id
    and status in ('pending', 'leased');

  if v_pending_count = 0 and v_active_count = 0 then
    select *
      into v_asset
    from media_assets
    where tenant_id = p_tenant_id
      and id = v_op.media_asset_id;

    if v_asset.status = 'deletion_pending' then
      perform p85_stage_4b3_finalize_media_asset_terminal_v2(
        p_tenant_id,
        v_op.media_asset_id,
        coalesce(v_asset.deletion_terminal_intent, 'expired'),
        now()
      );
    end if;
  end if;

  return jsonb_build_object(
    'status', v_op.status,
    'operationId', v_op.id,
    'assetId', v_op.media_asset_id,
    'pendingKeys', v_pending_count,
    'activeOperations', v_active_count
  );
end;
$$;

create or replace function p85_stage_4b3_redact_stale_visual_evidence_v2(
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
  v_redacted integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  with candidates as (
    select va.id
    from visual_analysis_records va
    join media_assets ma
      on ma.tenant_id = va.tenant_id
     and ma.id = va.media_asset_id
    where va.tenant_id = p_tenant_id
      and va.created_at <= p_now - interval '24 months'
      and (
        jsonb_array_length(coalesce(va.observation->'ocrBlocks', '[]'::jsonb)) > 0
        or jsonb_array_length(coalesce(va.observation->'entityCandidates', '[]'::jsonb)) > 0
        or exists (
          select 1
          from visual_corrections vc
          where vc.tenant_id = va.tenant_id
            and vc.analysis_id = va.id
            and (
              coalesce(vc.explanation, '') <> 'REDACTED_BY_PHASE74_POLICY'
              or coalesce(vc.corrected_ocr_text, '') not in ('', 'REDACTED_BY_PHASE74_POLICY')
            )
        )
      )
    order by va.created_at asc
    limit greatest(p_limit, 1)
  ),
  updated_analyses as (
    update visual_analysis_records va
    set observation = jsonb_build_object(
          'schemaVersion', 'visual-observation-v1',
          'sceneType', coalesce(va.observation->>'sceneType', 'unknown'),
          'sceneConfidence', 0,
          'overallConfidence', 0,
          'qualityFlags', '[]'::jsonb,
          'entityCandidates', '[]'::jsonb,
          'ocrBlocks', '[]'::jsonb,
          'labelIntegrity', va.observation->'labelIntegrity',
          'sensitivitySignals', jsonb_build_array('REDACTED_BY_PHASE74_POLICY'),
          'promptInjectionSignals', jsonb_build_array('REDACTED_BY_PHASE74_POLICY'),
          'providerId', coalesce(va.observation->>'providerId', 'redacted'),
          'providerVersion', coalesce(va.observation->>'providerVersion', 'redacted')
        ),
        retrieval_eligible = false,
        failure_code = case when va.failure_code is null then null else 'REDACTED_BY_PHASE74_POLICY' end,
        updated_at = p_now
    from candidates c
    where va.tenant_id = p_tenant_id
      and va.id = c.id
    returning va.id
  )
  select count(*) into v_redacted from updated_analyses;

  update visual_corrections vc
  set explanation = 'REDACTED_BY_PHASE74_POLICY',
      corrected_ocr_text = case when corrected_ocr_text is null then null else 'REDACTED_BY_PHASE74_POLICY' end,
      corrected_entity_labels = '[]'::jsonb,
      updated_at = p_now
  where vc.tenant_id = p_tenant_id
    and vc.analysis_id in (
      select va.id
      from visual_analysis_records va
      where va.tenant_id = p_tenant_id
        and va.created_at <= p_now - interval '24 months'
        and va.observation->'ocrBlocks' = '[]'::jsonb
        and va.observation->'entityCandidates' = '[]'::jsonb
    )
    and (
      coalesce(vc.explanation, '') <> 'REDACTED_BY_PHASE74_POLICY'
      or coalesce(vc.corrected_ocr_text, '') not in ('', 'REDACTED_BY_PHASE74_POLICY')
      or jsonb_array_length(coalesce(vc.corrected_entity_labels, '[]'::jsonb)) > 0
    );

  return jsonb_build_object('analysesRedacted', v_redacted, 'processedAt', p_now);
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

  if v_asset.status in ('expired', 'revoked', 'deletion_pending') or v_asset.deleted_at is not null then
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
        and ma.status not in ('deletion_pending')
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
            and va.retrieval_eligible = true
        )
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function p85_stage_4b3_finalize_media_asset_terminal_v2(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function p85_stage_4b3_prepare_media_asset_deletion_v2(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function p85_stage_4b3_prepare_client_media_dsar_v2(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function p85_stage_4b3_process_due_media_expiry_batch_v2(uuid, timestamptz, integer) from public, anon, authenticated;
revoke all on function p85_stage_4b3_resume_legal_hold_media_deletions_v2(uuid, timestamptz, integer) from public, anon, authenticated;
revoke all on function p85_stage_4b3_claim_media_object_operation_v2(uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4b3_release_media_object_operation_v2(uuid, uuid, text, uuid, boolean, text) from public, anon, authenticated;
revoke all on function p85_stage_4b3_redact_stale_visual_evidence_v2(uuid, timestamptz, integer) from public, anon, authenticated;

grant execute on function p85_stage_4b3_finalize_media_asset_terminal_v2(uuid, uuid, text, timestamptz) to service_role;
grant execute on function p85_stage_4b3_prepare_media_asset_deletion_v2(uuid, uuid, text, timestamptz) to service_role;
grant execute on function p85_stage_4b3_prepare_client_media_dsar_v2(uuid, uuid, timestamptz) to service_role;
grant execute on function p85_stage_4b3_process_due_media_expiry_batch_v2(uuid, timestamptz, integer) to service_role;
grant execute on function p85_stage_4b3_resume_legal_hold_media_deletions_v2(uuid, timestamptz, integer) to service_role;
grant execute on function p85_stage_4b3_claim_media_object_operation_v2(uuid, text) to service_role;
grant execute on function p85_stage_4b3_release_media_object_operation_v2(uuid, uuid, text, uuid, boolean, text) to service_role;
grant execute on function p85_stage_4b3_redact_stale_visual_evidence_v2(uuid, timestamptz, integer) to service_role;
