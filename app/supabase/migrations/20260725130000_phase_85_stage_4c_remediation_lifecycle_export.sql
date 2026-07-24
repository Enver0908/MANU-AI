-- Phase 85 Stage 4C remediation Faz 6: lifecycle deletion, retention sweeps, DSAR export, and list/load visibility patches.

create unique index if not exists ai_chat_deletion_ledger_entity_uidx
  on ai_chat_deletion_ledger (tenant_id, entity_type, entity_id_hash);

alter table notifications
  drop constraint if exists notifications_kind_check;

alter table notifications
  add constraint notifications_kind_check check (
    kind in (
      'structured_record_update_required',
      'competing_authoritative_instructions',
      'unsupported_media_review',
      'safe_reply_unavailable',
      'delivery_failed',
      'communication_permission_closed',
      'ai_window_expired',
      'ai_paused_by_verified_human',
      'draft_invalidated',
      'human_control_integrity',
      'visual_message_review',
      'visual_correction_follow_up',
      'ai_chat_red_review_required',
      'ai_chat_deletion_failed',
      'legacy_system',
      'legacy_handoff'
    )
  );

create or replace function p85_stage_4c_hash_deletion_entity_v1(
  p_tenant_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_hmac_secret text
)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(
    hmac(
      concat_ws(':', p_tenant_id::text, p_entity_type, p_entity_id::text),
      coalesce(p_hmac_secret, ''),
      'sha256'
    ),
    'hex'
  )
$$;

create or replace function p85_stage_4c_has_active_legal_hold_v1(
  p_tenant_id uuid,
  p_client_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from ai_chat_legal_holds h
    where h.tenant_id = p_tenant_id
      and h.released_at is null
      and (
        h.scope = 'tenant'
        or (h.scope = 'client' and h.client_id is not distinct from p_client_id)
      )
  )
$$;

create or replace function p85_stage_4c_list_purge_storage_keys_v1(
  p_tenant_id uuid,
  p_conversation_id uuid,
  p_suffix_message_ids uuid[] default null
)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct keys.object_key order by keys.object_key), '{}'::text[])
  from (
    select a.object_key
    from ai_chat_attachments a
    where a.tenant_id = p_tenant_id
      and a.conversation_id = p_conversation_id
      and coalesce(a.object_key, '') <> ''
      and p_suffix_message_ids is null
      and not exists (
        select 1
        from ai_chat_attachment_record_transfers t
        where t.tenant_id = a.tenant_id
          and t.attachment_id = a.id
          and t.status = 'completed'
      )
    union
    select a.object_key
    from ai_chat_message_attachments ma
    join ai_chat_message_versions mv
      on mv.tenant_id = ma.tenant_id
     and mv.id = ma.message_version_id
    join ai_chat_attachments a
      on a.tenant_id = ma.tenant_id
     and a.id = ma.attachment_id
    where ma.tenant_id = p_tenant_id
      and ma.conversation_id = p_conversation_id
      and p_suffix_message_ids is not null
      and mv.message_id = any (p_suffix_message_ids)
      and coalesce(a.object_key, '') <> ''
      and not exists (
        select 1
        from ai_chat_attachment_record_transfers t
        where t.tenant_id = a.tenant_id
          and t.attachment_id = a.id
          and t.status = 'completed'
      )
  ) keys
$$;

create or replace function p85_stage_4c_delete_conversation_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_chat_id uuid,
  p_expected_revision bigint,
  p_request_id text,
  p_body_hash text,
  p_hmac_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing ai_chat_mutation_ledger%rowtype;
  v_conversation ai_chat_conversations%rowtype;
  v_job ai_chat_deletion_jobs%rowtype;
  v_digest_parts text[];
  v_entity_hash text;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_existing
  from ai_chat_mutation_ledger
  where tenant_id = p_tenant_id
    and request_id = p_request_id
    and created_by_user_id = p_user_id
  for update;

  if found then
    if v_existing.body_hash <> p_body_hash then
      raise exception 'ai_chat_idempotency_conflict';
    end if;
    v_digest_parts := string_to_array(v_existing.response_digest, '|');
    return jsonb_build_object(
      'chat_id', p_chat_id,
      'deletion_job_id', v_digest_parts[1]::uuid,
      'status', 'deleting',
      'conversation_revision', v_digest_parts[2]::bigint
    );
  end if;

  select *
    into v_conversation
  from ai_chat_conversations c
  where c.tenant_id = p_tenant_id
    and c.id = p_chat_id
    and c.created_by_user_id = p_user_id
    and (
      c.scope_type = 'general'
      or p85_stage_4c_resolve_client_access_v1(
        p_tenant_id, c.client_id, p_user_id, p_dietitian_id, p_role
      )
    )
  for update;

  if not found then
    raise exception 'ai_chat_not_found';
  end if;

  if v_conversation.status in ('deleting', 'deleted') then
    select *
      into v_job
    from ai_chat_deletion_jobs j
    where j.tenant_id = p_tenant_id
      and j.target_conversation_id = p_chat_id
      and j.job_kind = 'conversation_purge'
      and j.status in ('queued', 'processing')
    order by j.requested_at desc, j.created_at desc
    limit 1;

    if not found then
      raise exception 'ai_chat_not_found';
    end if;

    return jsonb_build_object(
      'chat_id', p_chat_id,
      'deletion_job_id', v_job.id,
      'status', 'deleting',
      'conversation_revision', v_conversation.revision
    );
  end if;

  if v_conversation.status <> 'active' then
    raise exception 'ai_chat_conversation_locked';
  end if;

  if v_conversation.revision <> p_expected_revision then
    raise exception 'ai_chat_revision_conflict:%', v_conversation.revision;
  end if;

  if p85_stage_4c_has_active_legal_hold_v1(p_tenant_id, v_conversation.client_id) then
    raise exception 'ai_chat_legal_hold';
  end if;

  v_entity_hash := p85_stage_4c_hash_deletion_entity_v1(
    p_tenant_id,
    'conversation',
    p_chat_id,
    p_hmac_secret
  );

  insert into ai_chat_deletion_ledger (
    tenant_id,
    entity_type,
    entity_id_hash,
    reason,
    requested_at,
    replay_status,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    'conversation',
    v_entity_hash,
    'user_delete',
    v_now,
    'pending',
    v_now,
    v_now
  )
  on conflict (tenant_id, entity_type, entity_id_hash)
  do update set
    updated_at = v_now;

  update ai_chat_runs
  set status = 'superseded',
      updated_at = v_now
  where tenant_id = p_tenant_id
    and conversation_id = p_chat_id
    and p85_stage_4c_is_active_run_status(status);

  update ai_chat_conversations
  set status = 'deleting',
      revision = revision + 1,
      updated_at = v_now
  where tenant_id = p_tenant_id
    and id = p_chat_id
  returning * into v_conversation;

  insert into ai_chat_deletion_jobs (
    tenant_id,
    job_kind,
    target_conversation_id,
    target_message_id,
    target_client_id,
    target_user_id,
    reason,
    status,
    attempt_count,
    cursor,
    requested_at,
    created_by_user_id,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    'conversation_purge',
    p_chat_id,
    null,
    v_conversation.client_id,
    p_user_id,
    'user_delete',
    'queued',
    0,
    jsonb_build_object('phase', 'storage', 'storageOffset', 0),
    v_now,
    p_user_id,
    v_now,
    v_now
  )
  returning * into v_job;

  insert into ai_chat_mutation_ledger (
    tenant_id,
    request_id,
    created_by_user_id,
    body_hash,
    response_digest
  )
  values (
    p_tenant_id,
    p_request_id,
    p_user_id,
    p_body_hash,
    concat_ws('|', v_job.id::text, v_conversation.revision::text)
  );

  return jsonb_build_object(
    'chat_id', p_chat_id,
    'deletion_job_id', v_job.id,
    'status', 'deleting',
    'conversation_revision', v_conversation.revision
  );
end;
$$;

create or replace function p85_stage_4c_delete_message_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_message_id uuid,
  p_expected_revision bigint,
  p_request_id text,
  p_body_hash text,
  p_hmac_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing ai_chat_mutation_ledger%rowtype;
  v_conversation ai_chat_conversations%rowtype;
  v_message ai_chat_messages%rowtype;
  v_current_version ai_chat_message_versions%rowtype;
  v_job ai_chat_deletion_jobs%rowtype;
  v_digest_parts text[];
  v_entity_hash text;
  v_suffix_message_ids uuid[] := '{}'::uuid[];
  v_target_depth integer;
  v_parent_version ai_chat_message_versions%rowtype;
  v_parent_branch ai_chat_branches%rowtype;
  v_root_branch ai_chat_branches%rowtype;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_existing
  from ai_chat_mutation_ledger
  where tenant_id = p_tenant_id
    and request_id = p_request_id
    and created_by_user_id = p_user_id
  for update;

  if found then
    if v_existing.body_hash <> p_body_hash then
      raise exception 'ai_chat_idempotency_conflict';
    end if;
    v_digest_parts := string_to_array(v_existing.response_digest, '|');
    return jsonb_build_object(
      'message_id', p_message_id,
      'deletion_job_id', v_digest_parts[1]::uuid,
      'conversation_id', v_digest_parts[2]::uuid,
      'conversation_revision', v_digest_parts[3]::bigint
    );
  end if;

  select m.*
    into v_message
  from ai_chat_messages m
  where m.tenant_id = p_tenant_id
    and m.id = p_message_id
    and m.created_by_user_id = p_user_id;

  if not found then
    raise exception 'ai_chat_message_not_found';
  end if;

  if v_message.role <> 'user' then
    raise exception 'ai_chat_assistant_delete_forbidden';
  end if;

  select c.*
    into v_conversation
  from ai_chat_conversations c
  where c.tenant_id = p_tenant_id
    and c.id = v_message.conversation_id
    and c.created_by_user_id = p_user_id
    and (
      c.scope_type = 'general'
      or p85_stage_4c_resolve_client_access_v1(
        p_tenant_id, c.client_id, p_user_id, p_dietitian_id, p_role
      )
    )
  for update;

  if not found or v_conversation.status in ('deleting', 'deleted') then
    raise exception 'ai_chat_not_found';
  end if;

  if v_conversation.status <> 'active' then
    raise exception 'ai_chat_conversation_locked';
  end if;

  if v_conversation.revision <> p_expected_revision then
    raise exception 'ai_chat_revision_conflict:%', v_conversation.revision;
  end if;

  with recursive chain as (
    select mv.id, mv.message_id, mv.parent_version_id, m.role, 1 as depth
    from ai_chat_branches b
    join ai_chat_message_versions mv
      on mv.tenant_id = b.tenant_id
     and mv.id = b.active_leaf_version_id
    join ai_chat_messages m
      on m.tenant_id = mv.tenant_id
     and m.id = mv.message_id
    where b.tenant_id = p_tenant_id
      and b.id = v_conversation.active_branch_id
    union all
    select parent.id, parent.message_id, parent.parent_version_id, parent_message.role, chain.depth + 1
    from chain
    join ai_chat_message_versions parent
      on parent.tenant_id = p_tenant_id
     and parent.id = chain.parent_version_id
    join ai_chat_messages parent_message
      on parent_message.tenant_id = parent.tenant_id
     and parent_message.id = parent.message_id
  )
  select
    id,
    tenant_id,
    conversation_id,
    message_id,
    branch_id,
    created_by_user_id,
    body,
    body_sha256,
    parent_version_id,
    supersedes_version_id,
    run_id,
    content_status,
    created_at
    into v_current_version
  from chain
  where role = 'user'
  order by depth asc
  limit 1;

  if not found or v_current_version.message_id <> p_message_id then
    raise exception 'ai_chat_message_not_latest_user';
  end if;

  select *
    into v_job
  from ai_chat_deletion_jobs j
  where j.tenant_id = p_tenant_id
    and j.target_message_id = p_message_id
    and j.status in ('queued', 'processing')
  limit 1;

  if found then
    return jsonb_build_object(
      'message_id', p_message_id,
      'deletion_job_id', v_job.id,
      'conversation_id', v_conversation.id,
      'conversation_revision', v_conversation.revision
    );
  end if;

  if p85_stage_4c_has_active_legal_hold_v1(p_tenant_id, v_conversation.client_id) then
    raise exception 'ai_chat_legal_hold';
  end if;

  with recursive chain as (
    select mv.message_id, 1 as depth
    from ai_chat_branches b
    join ai_chat_message_versions mv
      on mv.tenant_id = b.tenant_id
     and mv.id = b.active_leaf_version_id
    where b.tenant_id = p_tenant_id
      and b.id = v_conversation.active_branch_id
    union all
    select parent.message_id, chain.depth + 1
    from chain
    join ai_chat_message_versions current_version
      on current_version.tenant_id = p_tenant_id
     and current_version.message_id = chain.message_id
    join ai_chat_message_versions parent
      on parent.tenant_id = p_tenant_id
     and parent.id = current_version.parent_version_id
  )
  select depth
    into v_target_depth
  from chain
  where message_id = p_message_id
  limit 1;

  select coalesce(array_agg(distinct chain.message_id order by chain.message_id), '{}'::uuid[])
    into v_suffix_message_ids
  from (
    with recursive chain as (
      select mv.message_id, 1 as depth
      from ai_chat_branches b
      join ai_chat_message_versions mv
        on mv.tenant_id = b.tenant_id
       and mv.id = b.active_leaf_version_id
      where b.tenant_id = p_tenant_id
        and b.id = v_conversation.active_branch_id
      union all
      select parent.message_id, chain.depth + 1
      from chain
      join ai_chat_message_versions current_version
        on current_version.tenant_id = p_tenant_id
       and current_version.message_id = chain.message_id
      join ai_chat_message_versions parent
        on parent.tenant_id = p_tenant_id
       and parent.id = current_version.parent_version_id
    )
    select message_id
    from chain
    where depth <= v_target_depth
  ) chain;

  v_entity_hash := p85_stage_4c_hash_deletion_entity_v1(
    p_tenant_id,
    'message',
    p_message_id,
    p_hmac_secret
  );

  insert into ai_chat_deletion_ledger (
    tenant_id,
    entity_type,
    entity_id_hash,
    reason,
    requested_at,
    replay_status,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    'message',
    v_entity_hash,
    'user_delete',
    v_now,
    'pending',
    v_now,
    v_now
  )
  on conflict (tenant_id, entity_type, entity_id_hash)
  do update set
    updated_at = v_now;

  update ai_chat_runs
  set status = 'superseded',
      updated_at = v_now
  where tenant_id = p_tenant_id
    and conversation_id = v_conversation.id
    and p85_stage_4c_is_active_run_status(status);

  update ai_chat_messages
  set deleted_at = v_now,
      updated_at = v_now
  where tenant_id = p_tenant_id
    and id = any (v_suffix_message_ids);

  update ai_chat_message_versions
  set content_status = 'deleting',
      body = ''
  where tenant_id = p_tenant_id
    and message_id = any (v_suffix_message_ids);

  update ai_chat_branches b
  set status = 'deleted',
      updated_at = v_now
  where b.tenant_id = p_tenant_id
    and b.conversation_id = v_conversation.id
    and exists (
      with recursive chain as (
        select mv.message_id, 1 as depth
        from ai_chat_branches branch
        join ai_chat_message_versions mv
          on mv.tenant_id = branch.tenant_id
         and mv.id = branch.active_leaf_version_id
        where branch.tenant_id = b.tenant_id
          and branch.id = b.id
        union all
        select parent.message_id, chain.depth + 1
        from chain
        join ai_chat_message_versions current_version
          on current_version.tenant_id = b.tenant_id
         and current_version.message_id = chain.message_id
        join ai_chat_message_versions parent
          on parent.tenant_id = b.tenant_id
         and parent.id = current_version.parent_version_id
      )
      select 1
      from chain
      where chain.message_id = p_message_id
    );

  select *
    into v_parent_version
  from ai_chat_message_versions
  where tenant_id = p_tenant_id
    and id = v_current_version.parent_version_id;

  if not found then
    select *
      into v_root_branch
    from ai_chat_branches
    where tenant_id = p_tenant_id
      and conversation_id = v_conversation.id
      and parent_branch_id is null
    limit 1;

    if found then
      update ai_chat_branches
      set active_leaf_version_id = null,
          status = 'active',
          updated_at = v_now
      where tenant_id = p_tenant_id
        and id = v_root_branch.id;

      update ai_chat_conversations
      set active_branch_id = v_root_branch.id,
          revision = revision + 1,
          updated_at = v_now
      where tenant_id = p_tenant_id
        and id = v_conversation.id
      returning * into v_conversation;
    end if;
  else
    select *
      into v_parent_branch
    from ai_chat_branches
    where tenant_id = p_tenant_id
      and id = v_parent_version.branch_id;

    if found then
      update ai_chat_branches
      set active_leaf_version_id = v_parent_version.id,
          status = 'active',
          updated_at = v_now
      where tenant_id = p_tenant_id
        and id = v_parent_branch.id;

      update ai_chat_conversations
      set active_branch_id = v_parent_branch.id,
          revision = revision + 1,
          updated_at = v_now
      where tenant_id = p_tenant_id
        and id = v_conversation.id
      returning * into v_conversation;
    end if;
  end if;

  insert into ai_chat_deletion_jobs (
    tenant_id,
    job_kind,
    target_conversation_id,
    target_message_id,
    target_client_id,
    target_user_id,
    reason,
    status,
    attempt_count,
    cursor,
    requested_at,
    created_by_user_id,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    'message_purge',
    v_conversation.id,
    p_message_id,
    v_conversation.client_id,
    p_user_id,
    'user_delete',
    'queued',
    0,
    jsonb_build_object(
      'phase', 'storage',
      'storageOffset', 0,
      'suffixMessageIds', to_jsonb(v_suffix_message_ids)
    ),
    v_now,
    p_user_id,
    v_now,
    v_now
  )
  returning * into v_job;

  insert into ai_chat_mutation_ledger (
    tenant_id,
    request_id,
    created_by_user_id,
    body_hash,
    response_digest
  )
  values (
    p_tenant_id,
    p_request_id,
    p_user_id,
    p_body_hash,
    concat_ws('|', v_job.id::text, v_conversation.id::text, v_conversation.revision::text)
  );

  return jsonb_build_object(
    'message_id', p_message_id,
    'deletion_job_id', v_job.id,
    'conversation_id', v_conversation.id,
    'conversation_revision', v_conversation.revision
  );
end;
$$;

create or replace function p85_stage_4c_claim_deletion_job_v1(
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job ai_chat_deletion_jobs%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_job
  from ai_chat_deletion_jobs j
  where j.status in ('queued', 'failed')
    and (p_tenant_id is null or j.tenant_id = p_tenant_id)
  order by j.requested_at asc, j.created_at asc
  limit 1
  for update skip locked;

  if not found then
    return null;
  end if;

  update ai_chat_deletion_jobs
  set status = 'processing',
      attempt_count = attempt_count + 1,
      updated_at = now()
  where id = v_job.id
  returning * into v_job;

  return to_jsonb(v_job);
end;
$$;

create or replace function p85_stage_4c_process_deletion_job_step_v1(
  p_job_id uuid,
  p_hmac_secret text,
  p_db_batch_size int default 500,
  p_storage_batch_size int default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job ai_chat_deletion_jobs%rowtype;
  v_conversation ai_chat_conversations%rowtype;
  v_phase text;
  v_storage_offset integer;
  v_db_stage text;
  v_db_offset integer;
  v_storage_keys text[];
  v_storage_batch text[];
  v_suffix_message_ids uuid[];
  v_deleted_count integer := 0;
  v_completed boolean := false;
  v_now timestamptz := now();
  v_bucket text := 'p85-stage-4c-ai-chat';
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_job
  from ai_chat_deletion_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'ai_chat_deletion_job_not_found';
  end if;

  if v_job.status not in ('processing', 'queued') then
    return jsonb_build_object(
      'processed', false,
      'completed', v_job.status = 'completed',
      'storage_bucket', v_bucket,
      'storage_keys', '[]'::jsonb,
      'job_id', v_job.id,
      'job_status', v_job.status
    );
  end if;

  if v_job.status = 'queued' then
    update ai_chat_deletion_jobs
    set status = 'processing',
        attempt_count = attempt_count + 1,
        updated_at = v_now
    where id = v_job.id
    returning * into v_job;
  end if;

  if v_job.job_kind in ('client_chats_purge', 'account_chats_purge') then
    if v_job.job_kind = 'client_chats_purge' then
      if p85_stage_4c_has_active_legal_hold_v1(v_job.tenant_id, v_job.target_client_id) then
        update ai_chat_deletion_jobs
        set status = 'blocked_legal_hold',
            updated_at = v_now
        where id = v_job.id
        returning * into v_job;

        return jsonb_build_object(
          'processed', true,
          'completed', false,
          'storage_bucket', v_bucket,
          'storage_keys', '[]'::jsonb,
          'job_id', v_job.id,
          'job_status', v_job.status
        );
      end if;

      for v_conversation in
        select c.*
        from ai_chat_conversations c
        where c.tenant_id = v_job.tenant_id
          and c.scope_type = 'client'
          and c.client_id = v_job.target_client_id
          and c.status <> 'deleted'
      loop
        if v_conversation.status <> 'deleting' then
          update ai_chat_conversations
          set status = 'deleting',
              updated_at = v_now
          where tenant_id = v_job.tenant_id
            and id = v_conversation.id;
        end if;

        if not exists (
          select 1
          from ai_chat_deletion_jobs j
          where j.tenant_id = v_job.tenant_id
            and j.target_conversation_id = v_conversation.id
            and j.job_kind = 'conversation_purge'
            and j.status in ('queued', 'processing')
        ) then
          insert into ai_chat_deletion_jobs (
            tenant_id,
            job_kind,
            target_conversation_id,
            target_message_id,
            target_client_id,
            target_user_id,
            reason,
            status,
            attempt_count,
            cursor,
            requested_at,
            created_by_user_id,
            created_at,
            updated_at
          )
          values (
            v_job.tenant_id,
            'conversation_purge',
            v_conversation.id,
            null,
            v_job.target_client_id,
            v_job.created_by_user_id,
            v_job.reason,
            'queued',
            0,
            jsonb_build_object('phase', 'storage', 'storageOffset', 0),
            v_now,
            v_job.created_by_user_id,
            v_now,
            v_now
          );
        end if;
      end loop;
    else
      for v_conversation in
        select c.*
        from ai_chat_conversations c
        where c.tenant_id = v_job.tenant_id
          and c.created_by_user_id = v_job.target_user_id
          and c.status <> 'deleted'
      loop
        if v_conversation.status <> 'deleting' then
          update ai_chat_conversations
          set status = 'deleting',
              updated_at = v_now
          where tenant_id = v_job.tenant_id
            and id = v_conversation.id;
        end if;

        if not exists (
          select 1
          from ai_chat_deletion_jobs j
          where j.tenant_id = v_job.tenant_id
            and j.target_conversation_id = v_conversation.id
            and j.job_kind = 'conversation_purge'
            and j.status in ('queued', 'processing')
        ) then
          insert into ai_chat_deletion_jobs (
            tenant_id,
            job_kind,
            target_conversation_id,
            target_message_id,
            target_client_id,
            target_user_id,
            reason,
            status,
            attempt_count,
            cursor,
            requested_at,
            created_by_user_id,
            created_at,
            updated_at
          )
          values (
            v_job.tenant_id,
            'conversation_purge',
            v_conversation.id,
            null,
            v_conversation.client_id,
            v_job.target_user_id,
            v_job.reason,
            'queued',
            0,
            jsonb_build_object('phase', 'storage', 'storageOffset', 0),
            v_now,
            v_job.created_by_user_id,
            v_now,
            v_now
          );
        end if;
      end loop;
    end if;

    update ai_chat_deletion_jobs
    set status = 'completed',
        completed_at = v_now,
        updated_at = v_now
    where id = v_job.id
    returning * into v_job;

    return jsonb_build_object(
      'processed', true,
      'completed', true,
      'storage_bucket', v_bucket,
      'storage_keys', '[]'::jsonb,
      'job_id', v_job.id,
      'job_status', v_job.status
    );
  end if;

  if v_job.job_kind = 'conversation_purge' then
    select *
      into v_conversation
    from ai_chat_conversations
    where tenant_id = v_job.tenant_id
      and id = v_job.target_conversation_id;

    if found and p85_stage_4c_has_active_legal_hold_v1(v_job.tenant_id, v_conversation.client_id) then
      update ai_chat_deletion_jobs
      set status = 'blocked_legal_hold',
          updated_at = v_now
      where id = v_job.id
      returning * into v_job;

      return jsonb_build_object(
        'processed', true,
        'completed', false,
        'storage_bucket', v_bucket,
        'storage_keys', '[]'::jsonb,
        'job_id', v_job.id,
        'job_status', v_job.status
      );
    end if;
  end if;

  v_phase := coalesce(v_job.cursor ->> 'phase', 'storage');
  v_storage_offset := coalesce((v_job.cursor ->> 'storageOffset')::integer, 0);
  v_db_stage := coalesce(v_job.cursor ->> 'dbStage', 'run_events');
  v_db_offset := coalesce((v_job.cursor ->> 'dbOffset')::integer, 0);
  v_suffix_message_ids := coalesce(
    array(
      select jsonb_array_elements_text(coalesce(v_job.cursor -> 'suffixMessageIds', '[]'::jsonb))::uuid
    ),
    '{}'::uuid[]
  );

  if v_phase = 'storage' then
    if v_job.job_kind = 'message_purge' then
      v_storage_keys := p85_stage_4c_list_purge_storage_keys_v1(
        v_job.tenant_id,
        v_job.target_conversation_id,
        v_suffix_message_ids
      );
    else
      v_storage_keys := p85_stage_4c_list_purge_storage_keys_v1(
        v_job.tenant_id,
        v_job.target_conversation_id,
        null
      );
    end if;

    v_storage_batch := coalesce(v_storage_keys[v_storage_offset + 1 : v_storage_offset + greatest(coalesce(p_storage_batch_size, 100), 1)], '{}'::text[]);

    if coalesce(array_length(v_storage_batch, 1), 0) > 0 then
      update ai_chat_deletion_jobs
      set cursor = jsonb_set(
            jsonb_set(coalesce(cursor, '{}'::jsonb), '{phase}', '"storage"'::jsonb, true),
            '{storageOffset}',
            to_jsonb(v_storage_offset + coalesce(array_length(v_storage_batch, 1), 0)),
            true
          ),
          status = 'queued',
          updated_at = v_now
      where id = v_job.id
      returning * into v_job;

      return jsonb_build_object(
        'processed', true,
        'completed', false,
        'storage_bucket', v_bucket,
        'storage_keys', to_jsonb(v_storage_batch),
        'job_id', v_job.id,
        'job_status', v_job.status
      );
    end if;

    v_phase := 'db';
    v_db_stage := 'run_events';
    v_db_offset := 0;
  end if;

  if v_job.job_kind = 'message_purge' then
    if v_db_stage = 'run_events' then
      with target_runs as (
        select r.id
        from ai_chat_runs r
        join ai_chat_message_versions mv
          on mv.tenant_id = r.tenant_id
         and mv.id = r.trigger_message_version_id
        where r.tenant_id = v_job.tenant_id
          and mv.message_id = any (v_suffix_message_ids)
      )
      delete from ai_chat_run_events e
      where e.tenant_id = v_job.tenant_id
        and e.id in (
          select e2.id
          from ai_chat_run_events e2
          join target_runs tr on tr.id = e2.run_id
          order by e2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'context_snapshots';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'context_snapshots' then
      with target_runs as (
        select r.id
        from ai_chat_runs r
        join ai_chat_message_versions mv
          on mv.tenant_id = r.tenant_id
         and mv.id = r.trigger_message_version_id
        where r.tenant_id = v_job.tenant_id
          and mv.message_id = any (v_suffix_message_ids)
      )
      delete from ai_chat_context_snapshots s
      where s.tenant_id = v_job.tenant_id
        and s.id in (
          select s2.id
          from ai_chat_context_snapshots s2
          join target_runs tr on tr.id = s2.run_id
          order by s2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'source_refs';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'source_refs' then
      with target_runs as (
        select r.id
        from ai_chat_runs r
        join ai_chat_message_versions mv
          on mv.tenant_id = r.tenant_id
         and mv.id = r.trigger_message_version_id
        where r.tenant_id = v_job.tenant_id
          and mv.message_id = any (v_suffix_message_ids)
      )
      delete from ai_chat_source_refs sr
      where sr.tenant_id = v_job.tenant_id
        and sr.id in (
          select sr2.id
          from ai_chat_source_refs sr2
          join target_runs tr on tr.id = sr2.run_id
          order by sr2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'answer_envelopes';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'answer_envelopes' then
      with target_runs as (
        select r.id
        from ai_chat_runs r
        join ai_chat_message_versions mv
          on mv.tenant_id = r.tenant_id
         and mv.id = r.trigger_message_version_id
        where r.tenant_id = v_job.tenant_id
          and mv.message_id = any (v_suffix_message_ids)
      )
      delete from ai_chat_answer_envelopes ae
      where ae.tenant_id = v_job.tenant_id
        and ae.run_id in (
          select tr.id
          from target_runs tr
          order by tr.id asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'runs';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'runs' then
      delete from ai_chat_runs r
      where r.tenant_id = v_job.tenant_id
        and r.id in (
          select r2.id
          from ai_chat_runs r2
          join ai_chat_message_versions mv
            on mv.tenant_id = r2.tenant_id
           and mv.id = r2.trigger_message_version_id
          where r2.tenant_id = v_job.tenant_id
            and mv.message_id = any (v_suffix_message_ids)
          order by r2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'message_attachments';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'message_attachments' then
      delete from ai_chat_message_attachments ma
      where ma.tenant_id = v_job.tenant_id
        and ma.id in (
          select ma2.id
          from ai_chat_message_attachments ma2
          join ai_chat_message_versions mv
            on mv.tenant_id = ma2.tenant_id
           and mv.id = ma2.message_version_id
          where ma2.tenant_id = v_job.tenant_id
            and mv.message_id = any (v_suffix_message_ids)
          order by ma2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'attachments';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'attachments' then
      delete from ai_chat_attachment_derivatives d
      where d.tenant_id = v_job.tenant_id
        and d.attachment_id in (
          select a.id
          from ai_chat_attachments a
          join ai_chat_message_attachments ma
            on ma.tenant_id = a.tenant_id
           and ma.attachment_id = a.id
          join ai_chat_message_versions mv
            on mv.tenant_id = ma.tenant_id
           and mv.id = ma.message_version_id
          where a.tenant_id = v_job.tenant_id
            and mv.message_id = any (v_suffix_message_ids)
            and not exists (
              select 1
              from ai_chat_attachment_record_transfers t
              where t.tenant_id = a.tenant_id
                and t.attachment_id = a.id
                and t.status = 'completed'
            )
          order by a.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        delete from ai_chat_attachments a
        where a.tenant_id = v_job.tenant_id
          and a.id in (
            select a2.id
            from ai_chat_attachments a2
            join ai_chat_message_attachments ma
              on ma.tenant_id = a2.tenant_id
             and ma.attachment_id = a2.id
            join ai_chat_message_versions mv
              on mv.tenant_id = ma.tenant_id
             and mv.id = ma.message_version_id
            where a2.tenant_id = v_job.tenant_id
              and mv.message_id = any (v_suffix_message_ids)
              and not exists (
                select 1
                from ai_chat_attachment_record_transfers t
                where t.tenant_id = a2.tenant_id
                  and t.attachment_id = a2.id
                  and t.status = 'completed'
              )
            order by a2.created_at asc
            offset v_db_offset
            limit greatest(coalesce(p_db_batch_size, 500), 1)
          );
        get diagnostics v_deleted_count = row_count;
        if v_deleted_count = 0 then
          v_db_stage := 'message_versions';
          v_db_offset := 0;
        else
          v_db_offset := v_db_offset + v_deleted_count;
        end if;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'message_versions' then
      delete from ai_chat_message_versions mv
      where mv.tenant_id = v_job.tenant_id
        and mv.id in (
          select mv2.id
          from ai_chat_message_versions mv2
          where mv2.tenant_id = v_job.tenant_id
            and mv2.message_id = any (v_suffix_message_ids)
          order by mv2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'messages';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'messages' then
      delete from ai_chat_messages m
      where m.tenant_id = v_job.tenant_id
        and m.id in (
          select m2.id
          from ai_chat_messages m2
          where m2.tenant_id = v_job.tenant_id
            and m2.id = any (v_suffix_message_ids)
          order by m2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_completed := true;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;
  elsif v_job.job_kind = 'conversation_purge' then
    if v_db_stage = 'run_events' then
      delete from ai_chat_run_events e
      where e.tenant_id = v_job.tenant_id
        and e.conversation_id = v_job.target_conversation_id
        and e.id in (
          select e2.id
          from ai_chat_run_events e2
          where e2.tenant_id = v_job.tenant_id
            and e2.conversation_id = v_job.target_conversation_id
          order by e2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'context_snapshots';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'context_snapshots' then
      delete from ai_chat_context_snapshots s
      where s.tenant_id = v_job.tenant_id
        and s.conversation_id = v_job.target_conversation_id
        and s.id in (
          select s2.id
          from ai_chat_context_snapshots s2
          where s2.tenant_id = v_job.tenant_id
            and s2.conversation_id = v_job.target_conversation_id
          order by s2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'source_refs';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'source_refs' then
      delete from ai_chat_source_refs sr
      where sr.tenant_id = v_job.tenant_id
        and sr.conversation_id = v_job.target_conversation_id
        and sr.id in (
          select sr2.id
          from ai_chat_source_refs sr2
          where sr2.tenant_id = v_job.tenant_id
            and sr2.conversation_id = v_job.target_conversation_id
          order by sr2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'answer_envelopes';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'answer_envelopes' then
      delete from ai_chat_answer_envelopes ae
      where ae.tenant_id = v_job.tenant_id
        and ae.conversation_id = v_job.target_conversation_id
        and ae.run_id in (
          select r.id
          from ai_chat_runs r
          where r.tenant_id = v_job.tenant_id
            and r.conversation_id = v_job.target_conversation_id
          order by r.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'tool_calls';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'tool_calls' then
      delete from ai_chat_tool_calls tc
      where tc.tenant_id = v_job.tenant_id
        and tc.conversation_id = v_job.target_conversation_id
        and tc.id in (
          select tc2.id
          from ai_chat_tool_calls tc2
          where tc2.tenant_id = v_job.tenant_id
            and tc2.conversation_id = v_job.target_conversation_id
          order by tc2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'risk_assessments';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'risk_assessments' then
      delete from ai_chat_run_risk_assessments ra
      where ra.tenant_id = v_job.tenant_id
        and ra.conversation_id = v_job.target_conversation_id
        and ra.id in (
          select ra2.id
          from ai_chat_run_risk_assessments ra2
          where ra2.tenant_id = v_job.tenant_id
            and ra2.conversation_id = v_job.target_conversation_id
          order by ra2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'draft_transfers';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'draft_transfers' then
      delete from ai_chat_draft_transfers dt
      where dt.tenant_id = v_job.tenant_id
        and (
          dt.source_conversation_id = v_job.target_conversation_id
          or dt.destination_conversation_id = v_job.target_conversation_id
        )
        and dt.id in (
          select dt2.id
          from ai_chat_draft_transfers dt2
          where dt2.tenant_id = v_job.tenant_id
            and (
              dt2.source_conversation_id = v_job.target_conversation_id
              or dt2.destination_conversation_id = v_job.target_conversation_id
            )
          order by dt2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'handoff_links';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'handoff_links' then
      delete from ai_chat_handoff_links hl
      where hl.tenant_id = v_job.tenant_id
        and hl.conversation_id = v_job.target_conversation_id
        and hl.id in (
          select hl2.id
          from ai_chat_handoff_links hl2
          where hl2.tenant_id = v_job.tenant_id
            and hl2.conversation_id = v_job.target_conversation_id
          order by hl2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'provider_manifests';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'provider_manifests' then
      delete from ai_chat_provider_egress_manifests pm
      where pm.tenant_id = v_job.tenant_id
        and pm.conversation_id = v_job.target_conversation_id
        and pm.id in (
          select pm2.id
          from ai_chat_provider_egress_manifests pm2
          where pm2.tenant_id = v_job.tenant_id
            and pm2.conversation_id = v_job.target_conversation_id
          order by pm2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'runs';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'runs' then
      delete from ai_chat_runs r
      where r.tenant_id = v_job.tenant_id
        and r.conversation_id = v_job.target_conversation_id
        and r.id in (
          select r2.id
          from ai_chat_runs r2
          where r2.tenant_id = v_job.tenant_id
            and r2.conversation_id = v_job.target_conversation_id
          order by r2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'message_attachments';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'message_attachments' then
      delete from ai_chat_message_attachments ma
      where ma.tenant_id = v_job.tenant_id
        and ma.conversation_id = v_job.target_conversation_id
        and ma.id in (
          select ma2.id
          from ai_chat_message_attachments ma2
          where ma2.tenant_id = v_job.tenant_id
            and ma2.conversation_id = v_job.target_conversation_id
          order by ma2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'attachments';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'attachments' then
      delete from ai_chat_attachment_derivatives d
      where d.tenant_id = v_job.tenant_id
        and d.attachment_id in (
          select a.id
          from ai_chat_attachments a
          where a.tenant_id = v_job.tenant_id
            and a.conversation_id = v_job.target_conversation_id
            and not exists (
              select 1
              from ai_chat_attachment_record_transfers t
              where t.tenant_id = a.tenant_id
                and t.attachment_id = a.id
                and t.status = 'completed'
            )
          order by a.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        delete from ai_chat_attachments a
        where a.tenant_id = v_job.tenant_id
          and a.conversation_id = v_job.target_conversation_id
          and a.id in (
            select a2.id
            from ai_chat_attachments a2
            where a2.tenant_id = v_job.tenant_id
              and a2.conversation_id = v_job.target_conversation_id
              and not exists (
                select 1
                from ai_chat_attachment_record_transfers t
                where t.tenant_id = a2.tenant_id
                  and t.attachment_id = a2.id
                  and t.status = 'completed'
              )
            order by a2.created_at asc
            offset v_db_offset
            limit greatest(coalesce(p_db_batch_size, 500), 1)
          );
        get diagnostics v_deleted_count = row_count;
        if v_deleted_count = 0 then
          v_db_stage := 'message_versions';
          v_db_offset := 0;
        else
          v_db_offset := v_db_offset + v_deleted_count;
        end if;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'message_versions' then
      delete from ai_chat_message_versions mv
      where mv.tenant_id = v_job.tenant_id
        and mv.conversation_id = v_job.target_conversation_id
        and mv.id in (
          select mv2.id
          from ai_chat_message_versions mv2
          where mv2.tenant_id = v_job.tenant_id
            and mv2.conversation_id = v_job.target_conversation_id
          order by mv2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'messages';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'messages' then
      delete from ai_chat_messages m
      where m.tenant_id = v_job.tenant_id
        and m.conversation_id = v_job.target_conversation_id
        and m.id in (
          select m2.id
          from ai_chat_messages m2
          where m2.tenant_id = v_job.tenant_id
            and m2.conversation_id = v_job.target_conversation_id
          order by m2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'branches';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'branches' then
      delete from ai_chat_branches b
      where b.tenant_id = v_job.tenant_id
        and b.conversation_id = v_job.target_conversation_id
        and b.id in (
          select b2.id
          from ai_chat_branches b2
          where b2.tenant_id = v_job.tenant_id
            and b2.conversation_id = v_job.target_conversation_id
          order by b2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'memory_summaries';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'memory_summaries' then
      delete from ai_chat_memory_summaries ms
      where ms.tenant_id = v_job.tenant_id
        and ms.conversation_id = v_job.target_conversation_id
        and ms.id in (
          select ms2.id
          from ai_chat_memory_summaries ms2
          where ms2.tenant_id = v_job.tenant_id
            and ms2.conversation_id = v_job.target_conversation_id
          order by ms2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'jobs';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'jobs' then
      delete from ai_chat_jobs j
      where j.tenant_id = v_job.tenant_id
        and j.conversation_id = v_job.target_conversation_id
        and j.id in (
          select j2.id
          from ai_chat_jobs j2
          where j2.tenant_id = v_job.tenant_id
            and j2.conversation_id = v_job.target_conversation_id
          order by j2.created_at asc
          offset v_db_offset
          limit greatest(coalesce(p_db_batch_size, 500), 1)
        );
      get diagnostics v_deleted_count = row_count;
      if v_deleted_count = 0 then
        v_db_stage := 'conversation';
        v_db_offset := 0;
      else
        v_db_offset := v_db_offset + v_deleted_count;
      end if;
    end if;

    if v_db_stage = 'conversation' then
      delete from ai_chat_conversations c
      where c.tenant_id = v_job.tenant_id
        and c.id = v_job.target_conversation_id;
      get diagnostics v_deleted_count = row_count;
      v_completed := v_deleted_count > 0;
    end if;
  end if;

  update ai_chat_deletion_jobs
  set cursor = jsonb_build_object(
        'phase', 'db',
        'dbStage', v_db_stage,
        'dbOffset', v_db_offset,
        'suffixMessageIds', coalesce(v_job.cursor -> 'suffixMessageIds', '[]'::jsonb)
      ),
      status = case when v_completed then 'processing' else 'queued' end,
      updated_at = v_now
  where id = v_job.id
  returning * into v_job;

  return jsonb_build_object(
    'processed', true,
    'completed', v_completed,
    'storage_bucket', v_bucket,
    'storage_keys', '[]'::jsonb,
    'job_id', v_job.id,
    'job_status', v_job.status
  );
end;
$$;

create or replace function p85_stage_4c_fail_deletion_job_v1(
  p_job_id uuid,
  p_error_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job ai_chat_deletion_jobs%rowtype;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  update ai_chat_deletion_jobs
  set status = case when attempt_count >= 3 then 'failed' else 'queued' end,
      cursor = coalesce(cursor, '{}'::jsonb) || jsonb_build_object('lastError', p_error_message),
      updated_at = v_now
  where id = p_job_id
  returning * into v_job;

  if not found then
    raise exception 'ai_chat_deletion_job_not_found';
  end if;

  if v_job.status = 'failed' then
    insert into notifications (
      id,
      tenant_id,
      type,
      entity_type,
      entity_id,
      title,
      body,
      read,
      dedupe_key,
      target_panel,
      kind,
      priority,
      client_id,
      conversation_id,
      occurrence_count,
      last_occurred_at,
      created_at
    )
    values (
      gen_random_uuid(),
      v_job.tenant_id,
      'system',
      'ai_chat_deletion_job',
      v_job.id::text,
      'AI Chat deletion failed',
      coalesce(nullif(trim(p_error_message), ''), 'Deletion job exceeded retry budget; daily sweeper will retry.'),
      false,
      format('p85-4c:deletion-failed:%s:%s', v_job.tenant_id, v_job.id),
      'ai_chat',
      'ai_chat_deletion_failed',
      'intervention_required',
      v_job.target_client_id,
      v_job.target_conversation_id,
      1,
      v_now,
      v_now
    )
    on conflict (tenant_id, dedupe_key) where dedupe_key is not null and resolved_at is null
    do update set
      occurrence_count = notifications.occurrence_count + 1,
      last_occurred_at = excluded.last_occurred_at,
      body = excluded.body;
  end if;

  return to_jsonb(v_job);
end;
$$;

create or replace function p85_stage_4c_complete_deletion_job_v1(
  p_job_id uuid,
  p_hmac_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job ai_chat_deletion_jobs%rowtype;
  v_entity_type text;
  v_entity_id uuid;
  v_entity_hash text;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_job
  from ai_chat_deletion_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'ai_chat_deletion_job_not_found';
  end if;

  if v_job.job_kind = 'message_purge' then
    v_entity_type := 'message';
    v_entity_id := v_job.target_message_id;
  elsif v_job.job_kind = 'conversation_purge' then
    v_entity_type := 'conversation';
    v_entity_id := v_job.target_conversation_id;
  else
    update ai_chat_deletion_jobs
    set status = 'completed',
        completed_at = v_now,
        updated_at = v_now
    where id = p_job_id
    returning * into v_job;
    return to_jsonb(v_job);
  end if;

  if v_entity_id is null then
    raise exception 'ai_chat_deletion_job_not_found';
  end if;

  v_entity_hash := p85_stage_4c_hash_deletion_entity_v1(
    v_job.tenant_id,
    v_entity_type,
    v_entity_id,
    p_hmac_secret
  );

  update ai_chat_deletion_jobs
  set status = 'completed',
      completed_at = v_now,
      updated_at = v_now
  where id = p_job_id
  returning * into v_job;

  update ai_chat_deletion_ledger
  set replay_status = 'applied',
      completed_at = v_now,
      updated_at = v_now
  where tenant_id = v_job.tenant_id
    and entity_type = v_entity_type
    and entity_id_hash = v_entity_hash;

  return to_jsonb(v_job);
end;
$$;

create or replace function p85_stage_4c_enqueue_client_scoped_deletions_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_client_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid := gen_random_uuid();
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_reason not in ('client_anonymization', 'client_removal') then
    raise exception 'ai_chat_deletion_job_not_found';
  end if;

  if not exists (
    select 1
    from clients c
    where c.tenant_id = p_tenant_id
      and c.id = p_client_id
  ) then
    raise exception 'ai_chat_not_found';
  end if;

  insert into ai_chat_deletion_jobs (
    id,
    tenant_id,
    job_kind,
    target_conversation_id,
    target_message_id,
    target_client_id,
    target_user_id,
    reason,
    status,
    attempt_count,
    cursor,
    requested_at,
    created_by_user_id,
    created_at,
    updated_at
  )
  values (
    v_job_id,
    p_tenant_id,
    'client_chats_purge',
    null,
    null,
    p_client_id,
    null,
    p_reason,
    'queued',
    0,
    '{}'::jsonb,
    v_now,
    p_user_id,
    v_now,
    v_now
  );

  return v_job_id;
end;
$$;

create or replace function p85_stage_4c_enqueue_account_scoped_deletions_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid := gen_random_uuid();
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_reason <> 'account_membership_removed' then
    raise exception 'ai_chat_deletion_job_not_found';
  end if;

  insert into ai_chat_deletion_jobs (
    id,
    tenant_id,
    job_kind,
    target_conversation_id,
    target_message_id,
    target_client_id,
    target_user_id,
    reason,
    status,
    attempt_count,
    cursor,
    requested_at,
    created_by_user_id,
    created_at,
    updated_at
  )
  values (
    v_job_id,
    p_tenant_id,
    'account_chats_purge',
    null,
    null,
    null,
    p_user_id,
    p_reason,
    'queued',
    0,
    '{}'::jsonb,
    v_now,
    p_user_id,
    v_now,
    v_now
  );

  return v_job_id;
end;
$$;

create or replace function p85_stage_4c_run_lifecycle_retention_sweep_v1(
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_orphan_cutoff timestamptz := v_now - interval '24 hours';
  v_expired_events integer := 0;
  v_orphan_attachments integer := 0;
  v_requeued_jobs integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  delete from ai_chat_run_events e
  where (p_tenant_id is null or e.tenant_id = p_tenant_id)
    and e.expires_at < v_now;
  get diagnostics v_expired_events = row_count;

  update ai_chat_attachments a
  set status = 'deleted',
      upload_token = null,
      updated_at = v_now
  where (p_tenant_id is null or a.tenant_id = p_tenant_id)
    and a.status in ('upload_pending', 'uploaded')
    and (
      (a.upload_expires_at is not null and a.upload_expires_at < v_orphan_cutoff)
      or a.created_at < v_orphan_cutoff
    )
    and not exists (
      select 1
      from ai_chat_conversations c
      where c.tenant_id = a.tenant_id
        and c.id = a.conversation_id
        and p85_stage_4c_has_active_legal_hold_v1(c.tenant_id, c.client_id)
    );
  get diagnostics v_orphan_attachments = row_count;

  update ai_chat_attachments a
  set status = 'deleted',
      updated_at = v_now
  where (p_tenant_id is null or a.tenant_id = p_tenant_id)
    and a.status in ('rejected', 'quarantined')
    and a.updated_at < v_orphan_cutoff
    and not exists (
      select 1
      from ai_chat_conversations c
      where c.tenant_id = a.tenant_id
        and c.id = a.conversation_id
        and p85_stage_4c_has_active_legal_hold_v1(c.tenant_id, c.client_id)
    );
  get diagnostics v_orphan_attachments = v_orphan_attachments + row_count;

  update ai_chat_deletion_jobs j
  set status = 'queued',
      updated_at = v_now
  where j.status = 'failed'
    and (p_tenant_id is null or j.tenant_id = p_tenant_id);
  get diagnostics v_requeued_jobs = row_count;

  return jsonb_build_object(
    'expired_run_events', v_expired_events,
    'orphan_attachments_marked_deleted', v_orphan_attachments,
    'requeued_failed_jobs', v_requeued_jobs
  );
end;
$$;

create or replace function p85_stage_4c_build_client_scoped_export_v1(
  p_tenant_id uuid,
  p_client_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_hmac_secret text
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

  if p_tenant_id is null or p_client_id is null then
    raise exception 'ai_chat_client_required';
  end if;

  if not exists (
    select 1
    from clients c
    where c.tenant_id = p_tenant_id
      and c.id = p_client_id
  ) then
    raise exception 'ai_chat_not_found';
  end if;

  if not p85_stage_4c_resolve_client_access_v1(
    p_tenant_id,
    p_client_id,
    p_user_id,
    p_dietitian_id,
    p_role
  ) then
    raise exception 'ai_chat_not_found';
  end if;

  select jsonb_build_object(
    'conversations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'title', c.title,
        'scopeType', c.scope_type,
        'clientId', c.client_id,
        'lastMessageAt', c.last_message_at,
        'createdAt', c.created_at
      ) order by coalesce(c.last_message_at, c.created_at) desc, c.id desc)
      from ai_chat_conversations c
      where c.tenant_id = p_tenant_id
        and c.scope_type = 'client'
        and c.client_id = p_client_id
        and c.status = 'active'
        and c.created_by_user_id = p_user_id
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'conversationId', m.conversation_id,
        'role', m.role,
        'body', coalesce(active_version.body, ''),
        'createdAt', m.created_at
      ) order by m.created_at asc)
      from ai_chat_conversations c
      join ai_chat_messages m
        on m.tenant_id = c.tenant_id
       and m.conversation_id = c.id
      left join lateral (
        select mv.body
        from ai_chat_message_versions mv
        where mv.tenant_id = m.tenant_id
          and mv.message_id = m.id
          and mv.branch_id = c.active_branch_id
          and mv.content_status = 'active'
        order by mv.created_at desc
        limit 1
      ) active_version on true
      where c.tenant_id = p_tenant_id
        and c.scope_type = 'client'
        and c.client_id = p_client_id
        and c.status = 'active'
        and c.created_by_user_id = p_user_id
        and m.deleted_at is null
        and m.role in ('user', 'assistant')
    ), '[]'::jsonb),
    'sourceManifest', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sourceRefId', sr.id,
        'sourceType', sr.source_type,
        'locator', sr.locator,
        'sourceDate', sr.source_date
      ) order by sr.created_at asc)
      from ai_chat_conversations c
      join ai_chat_source_refs sr
        on sr.tenant_id = c.tenant_id
       and sr.conversation_id = c.id
      where c.tenant_id = p_tenant_id
        and c.scope_type = 'client'
        and c.client_id = p_client_id
        and c.status = 'active'
        and c.created_by_user_id = p_user_id
    ), '[]'::jsonb),
    'clientRecordAssets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cra.id,
        'category', cra.category,
        'title', cra.title,
        'sourceChatIdHash', case
          when cra.source_attachment_id is null then null
          else p85_stage_4c_hash_deletion_entity_v1(
            p_tenant_id,
            'attachment',
            cra.source_attachment_id,
            p_hmac_secret
          )
        end,
        'createdAt', cra.created_at
      ) order by cra.created_at asc)
      from client_record_assets cra
      where cra.tenant_id = p_tenant_id
        and cra.client_id = p_client_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function p85_stage_4c_list_conversations_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_scope_filter text default 'all',
  p_query text default '',
  p_cursor_last_message_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if coalesce(p_scope_filter, 'all') not in ('all', 'general', 'client') then
    raise exception 'ai_chat_cursor_invalid';
  end if;

  with visible as (
    select
      c.id,
      c.tenant_id,
      c.created_by_user_id,
      c.created_by_dietitian_id,
      c.scope_type,
      c.client_id,
      c.title,
      c.title_source,
      c.status,
      c.active_branch_id,
      c.revision,
      c.last_message_at,
      c.created_at,
      c.updated_at,
      cl.full_name as client_full_name,
      left(coalesce(preview.body, ''), 120) as preview
    from ai_chat_conversations c
    left join clients cl
      on cl.tenant_id = c.tenant_id
     and cl.id = c.client_id
    left join lateral (
      select mv.body
      from ai_chat_branches b
      left join ai_chat_message_versions mv
        on mv.tenant_id = b.tenant_id
       and mv.id = b.active_leaf_version_id
      where b.tenant_id = c.tenant_id
        and b.id = c.active_branch_id
      limit 1
    ) preview on true
    where c.tenant_id = p_tenant_id
      and c.created_by_user_id = p_user_id
      and c.status not in ('deleting', 'deleted')
      and (
        c.scope_type = 'general'
        or p85_stage_4c_resolve_client_access_v1(
          p_tenant_id, c.client_id, p_user_id, p_dietitian_id, p_role
        )
      )
      and (
        coalesce(p_scope_filter, 'all') = 'all'
        or c.scope_type = p_scope_filter
      )
      and (
        coalesce(p_query, '') = ''
        or c.title ilike '%' || replace(replace(p_query, '%', '\%'), '_', '\_') || '%' escape '\'
        or cl.full_name ilike '%' || replace(replace(p_query, '%', '\%'), '_', '\_') || '%' escape '\'
      )
  ), filtered as (
    select *
    from visible v
    where (
      p_cursor_last_message_at is null
      or (coalesce(v.last_message_at, v.created_at, '-infinity'::timestamptz), v.id)
        < (coalesce(p_cursor_last_message_at, 'infinity'::timestamptz), coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    )
  ), page as (
    select *
    from filtered
    order by coalesce(last_message_at, created_at) desc, id desc
    limit v_limit
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'tenant_id', p.tenant_id,
        'created_by_user_id', p.created_by_user_id,
        'created_by_dietitian_id', p.created_by_dietitian_id,
        'scope_type', p.scope_type,
        'client_id', p.client_id,
        'title', p.title,
        'title_source', p.title_source,
        'status', p.status,
        'active_branch_id', p.active_branch_id,
        'revision', p.revision,
        'last_message_at', p.last_message_at,
        'created_at', p.created_at,
        'updated_at', p.updated_at,
        'client_full_name', p.client_full_name,
        'preview', nullif(p.preview, '')
      ) order by coalesce(p.last_message_at, p.created_at) desc, p.id desc)
      from page p
    ), '[]'::jsonb),
    'next_cursor', (
      select case
        when count(*) = v_limit then jsonb_build_object(
          'last_message_at', (select coalesce(last_message_at, created_at) from page order by coalesce(last_message_at, created_at) desc, id desc limit 1),
          'id', (select id from page order by coalesce(last_message_at, created_at) desc, id desc limit 1)
        )
        else null
      end
      from page
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function p85_stage_4c_load_conversation_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_chat_id uuid,
  p_message_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_message_limit, 50), 1), 100);
  v_conversation ai_chat_conversations%rowtype;
  v_result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_conversation
  from ai_chat_conversations c
  where c.tenant_id = p_tenant_id
    and c.id = p_chat_id
    and c.created_by_user_id = p_user_id
    and (
      c.scope_type = 'general'
      or p85_stage_4c_resolve_client_access_v1(
        p_tenant_id, c.client_id, p_user_id, p_dietitian_id, p_role
      )
    );

  if not found then
    raise exception 'ai_chat_not_found';
  end if;

  if v_conversation.status in ('deleting', 'deleted') then
    raise exception 'ai_chat_not_found';
  end if;

  select jsonb_build_object(
    'conversation', row_to_json(v_conversation),
    'branches', coalesce((
      select jsonb_agg(row_to_json(b) order by b.created_at asc)
      from ai_chat_branches b
      where b.tenant_id = p_tenant_id
        and b.conversation_id = p_chat_id
        and b.created_by_user_id = p_user_id
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'tenant_id', m.tenant_id,
        'conversation_id', m.conversation_id,
        'created_by_user_id', m.created_by_user_id,
        'role', m.role,
        'author_user_id', m.author_user_id,
        'deleted_at', m.deleted_at,
        'created_at', m.created_at,
        'updated_at', m.updated_at,
        'versions', coalesce((
          select jsonb_agg(row_to_json(mv) order by mv.created_at asc)
          from ai_chat_message_versions mv
          where mv.tenant_id = m.tenant_id
            and mv.message_id = m.id
            and mv.branch_id = v_conversation.active_branch_id
        ), '[]'::jsonb)
      ) order by m.created_at asc)
      from ai_chat_messages m
      where m.tenant_id = p_tenant_id
        and m.conversation_id = p_chat_id
        and m.created_by_user_id = p_user_id
      limit v_limit
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function p85_stage_4c_hash_deletion_entity_v1(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_has_active_legal_hold_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_list_purge_storage_keys_v1(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function p85_stage_4c_delete_conversation_v1(uuid, uuid, uuid, text, uuid, bigint, text, text, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_delete_message_v1(uuid, uuid, uuid, text, uuid, bigint, text, text, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_claim_deletion_job_v1(uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_process_deletion_job_step_v1(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function p85_stage_4c_fail_deletion_job_v1(uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_complete_deletion_job_v1(uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_enqueue_client_scoped_deletions_v1(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_enqueue_account_scoped_deletions_v1(uuid, uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_run_lifecycle_retention_sweep_v1(uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_build_client_scoped_export_v1(uuid, uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_list_conversations_v1(uuid, uuid, uuid, text, text, text, timestamptz, uuid, integer) from public, anon, authenticated;
revoke all on function p85_stage_4c_load_conversation_v1(uuid, uuid, uuid, text, uuid, integer) from public, anon, authenticated;

grant execute on function p85_stage_4c_hash_deletion_entity_v1(uuid, text, uuid, text) to service_role;
grant execute on function p85_stage_4c_has_active_legal_hold_v1(uuid, uuid) to service_role;
grant execute on function p85_stage_4c_list_purge_storage_keys_v1(uuid, uuid, uuid[]) to service_role;
grant execute on function p85_stage_4c_delete_conversation_v1(uuid, uuid, uuid, text, uuid, bigint, text, text, text) to service_role;
grant execute on function p85_stage_4c_delete_message_v1(uuid, uuid, uuid, text, uuid, bigint, text, text, text) to service_role;
grant execute on function p85_stage_4c_claim_deletion_job_v1(uuid) to service_role;
grant execute on function p85_stage_4c_process_deletion_job_step_v1(uuid, text, integer, integer) to service_role;
grant execute on function p85_stage_4c_fail_deletion_job_v1(uuid, text) to service_role;
grant execute on function p85_stage_4c_complete_deletion_job_v1(uuid, text) to service_role;
grant execute on function p85_stage_4c_enqueue_client_scoped_deletions_v1(uuid, uuid, uuid, text) to service_role;
grant execute on function p85_stage_4c_enqueue_account_scoped_deletions_v1(uuid, uuid, text) to service_role;
grant execute on function p85_stage_4c_run_lifecycle_retention_sweep_v1(uuid) to service_role;
grant execute on function p85_stage_4c_build_client_scoped_export_v1(uuid, uuid, uuid, uuid, text, text) to service_role;
grant execute on function p85_stage_4c_list_conversations_v1(uuid, uuid, uuid, text, text, text, timestamptz, uuid, integer) to service_role;
grant execute on function p85_stage_4c_load_conversation_v1(uuid, uuid, uuid, text, uuid, integer) to service_role;
