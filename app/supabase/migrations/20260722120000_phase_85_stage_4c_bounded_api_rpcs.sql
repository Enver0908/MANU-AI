-- Phase 85 Stage 4C Faz 3: bounded API RPCs, title provenance, and client search projections.

alter table ai_chat_conversations
  add column if not exists title_source text;

update ai_chat_conversations
set title_source = 'auto'
where title_source is null;

alter table ai_chat_conversations
  alter column title_source set default 'auto';

alter table ai_chat_conversations
  alter column title_source set not null;

alter table ai_chat_conversations
  drop constraint if exists ai_chat_conversations_title_source_check;

alter table ai_chat_conversations
  add constraint ai_chat_conversations_title_source_check check (
    title_source in ('auto', 'user')
  );

create or replace function p85_stage_4c_resolve_client_access_v1(
  p_tenant_id uuid,
  p_client_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from clients c
    where c.tenant_id = p_tenant_id
      and c.id = p_client_id
      and c.lifecycle_status = 'active'
      and p85_stage_4b_actor_can_read_client(
        p_tenant_id,
        c.id,
        p_user_id,
        p_dietitian_id,
        p_role
      )
  )
$$;

create or replace function p85_stage_4c_create_conversation_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_scope_type text,
  p_client_id uuid,
  p_title text,
  p_request_id text,
  p_body_hash text
)
returns ai_chat_conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing ai_chat_mutation_ledger%rowtype;
  v_conversation ai_chat_conversations%rowtype;
  v_branch ai_chat_branches%rowtype;
  v_role text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if not p85_stage_4c_validate_creator_membership(p_tenant_id, p_user_id, p_dietitian_id) then
    raise exception 'ai_chat_creator_membership_invalid';
  end if;

  select tm.role::text
    into v_role
  from tenant_memberships tm
  where tm.tenant_id = p_tenant_id
    and tm.user_id = p_user_id
  limit 1;

  if p_scope_type = 'general' and p_client_id is not null then
    raise exception 'ai_chat_scope_client_mismatch';
  end if;

  if p_scope_type = 'client' and p_client_id is null then
    raise exception 'ai_chat_client_required';
  end if;

  if p_scope_type = 'client' and not p85_stage_4c_resolve_client_access_v1(
    p_tenant_id, p_client_id, p_user_id, p_dietitian_id, coalesce(v_role, 'dietitian')
  ) then
    raise exception 'ai_chat_not_found';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'ai_chat_title_required';
  end if;

  if char_length(p_title) > 120 then
    raise exception 'ai_chat_title_too_long';
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

    select *
      into v_conversation
    from ai_chat_conversations
    where tenant_id = p_tenant_id
      and id = (v_existing.response_digest::uuid);
    return v_conversation;
  end if;

  insert into ai_chat_conversations (
    tenant_id,
    created_by_user_id,
    created_by_dietitian_id,
    scope_type,
    client_id,
    title,
    title_source
  )
  values (
    p_tenant_id,
    p_user_id,
    p_dietitian_id,
    p_scope_type,
    p_client_id,
    p_title,
    'user'
  )
  returning * into v_conversation;

  insert into ai_chat_branches (
    tenant_id,
    conversation_id,
    created_by_user_id,
    fork_reason
  )
  values (
    p_tenant_id,
    v_conversation.id,
    p_user_id,
    'initial'
  )
  returning * into v_branch;

  update ai_chat_conversations
  set active_branch_id = v_branch.id,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = v_conversation.id
  returning * into v_conversation;

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
    v_conversation.id::text
  );

  return v_conversation;
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

create or replace function p85_stage_4c_rename_conversation_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_chat_id uuid,
  p_expected_revision bigint,
  p_title text,
  p_request_id text,
  p_body_hash text
)
returns ai_chat_conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing ai_chat_mutation_ledger%rowtype;
  v_conversation ai_chat_conversations%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'ai_chat_title_required';
  end if;

  if char_length(p_title) > 120 then
    raise exception 'ai_chat_title_too_long';
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

    select *
      into v_conversation
    from ai_chat_conversations
    where tenant_id = p_tenant_id
      and id = p_chat_id
      and created_by_user_id = p_user_id;
    return v_conversation;
  end if;

  update ai_chat_conversations c
  set title = p_title,
      title_source = 'user',
      revision = c.revision + 1,
      updated_at = now()
  where c.tenant_id = p_tenant_id
    and c.id = p_chat_id
    and c.created_by_user_id = p_user_id
    and c.revision = p_expected_revision
    and c.status = 'active'
    and (
      c.scope_type = 'general'
      or p85_stage_4c_resolve_client_access_v1(
        p_tenant_id, c.client_id, p_user_id, p_dietitian_id, p_role
      )
    )
  returning * into v_conversation;

  if not found then
  select *
    into v_conversation
  from ai_chat_conversations
  where tenant_id = p_tenant_id
    and id = p_chat_id
    and created_by_user_id = p_user_id;

    if found and v_conversation.status <> 'active' then
      raise exception 'ai_chat_conversation_locked';
    end if;

    if found and v_conversation.revision <> p_expected_revision then
      raise exception 'ai_chat_revision_conflict:%', v_conversation.revision;
    end if;

    raise exception 'ai_chat_not_found';
  end if;

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
    v_conversation.id::text
  );

  return v_conversation;
end;
$$;

create or replace function p85_stage_4c_list_branches_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_chat_id uuid
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

  if not exists (
    select 1
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
  ) then
    raise exception 'ai_chat_not_found';
  end if;

  select coalesce(jsonb_agg(row_to_json(b) order by b.created_at asc), '[]'::jsonb)
    into v_result
  from ai_chat_branches b
  where b.tenant_id = p_tenant_id
    and b.conversation_id = p_chat_id
    and b.created_by_user_id = p_user_id;

  return v_result;
end;
$$;

create or replace function p85_stage_4c_activate_branch_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_chat_id uuid,
  p_branch_id uuid,
  p_expected_revision bigint,
  p_request_id text,
  p_body_hash text
)
returns ai_chat_conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing ai_chat_mutation_ledger%rowtype;
  v_conversation ai_chat_conversations%rowtype;
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

    select *
      into v_conversation
    from ai_chat_conversations
    where tenant_id = p_tenant_id
      and id = p_chat_id
      and created_by_user_id = p_user_id;
    return v_conversation;
  end if;

  if not exists (
    select 1
    from ai_chat_branches b
    where b.tenant_id = p_tenant_id
      and b.conversation_id = p_chat_id
      and b.id = p_branch_id
      and b.created_by_user_id = p_user_id
  ) then
    raise exception 'ai_chat_not_found';
  end if;

  update ai_chat_conversations c
  set active_branch_id = p_branch_id,
      revision = c.revision + 1,
      updated_at = now()
  where c.tenant_id = p_tenant_id
    and c.id = p_chat_id
    and c.created_by_user_id = p_user_id
    and c.revision = p_expected_revision
    and c.status = 'active'
    and (
      c.scope_type = 'general'
      or p85_stage_4c_resolve_client_access_v1(
        p_tenant_id, c.client_id, p_user_id, p_dietitian_id, p_role
      )
    )
  returning * into v_conversation;

  if not found then
    select *
      into v_conversation
    from ai_chat_conversations
    where tenant_id = p_tenant_id
      and id = p_chat_id
      and created_by_user_id = p_user_id;

    if found and v_conversation.revision <> p_expected_revision then
      raise exception 'ai_chat_revision_conflict:%', v_conversation.revision;
    end if;

    raise exception 'ai_chat_not_found';
  end if;

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
    v_conversation.id::text
  );

  return v_conversation;
end;
$$;

create or replace function p85_stage_4c_search_accessible_clients_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_query text default '',
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  with visible_clients as (
    select
      c.id,
      c.full_name,
      (
        select cc.channel::text
        from client_channels cc
        where cc.tenant_id = c.tenant_id
          and cc.client_id = c.id
          and cc.is_active = true
        order by cc.created_at asc
        limit 1
      ) as primary_channel
    from clients c
    where c.tenant_id = p_tenant_id
      and c.lifecycle_status = 'active'
      and p85_stage_4b_actor_can_read_client(
        p_tenant_id, c.id, p_user_id, p_dietitian_id, p_role
      )
      and (
        coalesce(p_query, '') = ''
        or c.full_name ilike '%' || replace(replace(p_query, '%', '\%'), '_', '\_') || '%' escape '\'
        or c.id::text ilike '%' || replace(replace(p_query, '%', '\%'), '_', '\_') || '%' escape '\'
      )
  ), page as (
    select *
    from visible_clients
    order by full_name asc, id asc
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'primary_channel', p.primary_channel
  ) order by p.full_name asc, p.id asc), '[]'::jsonb)
    into v_result
  from page p;

  return v_result;
end;
$$;

revoke all on function p85_stage_4c_resolve_client_access_v1(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_list_conversations_v1(uuid, uuid, uuid, text, text, text, timestamptz, uuid, integer) from public, anon, authenticated;
revoke all on function p85_stage_4c_load_conversation_v1(uuid, uuid, uuid, text, uuid, integer) from public, anon, authenticated;
revoke all on function p85_stage_4c_rename_conversation_v1(uuid, uuid, uuid, text, uuid, bigint, text, text, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_list_branches_v1(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_activate_branch_v1(uuid, uuid, uuid, text, uuid, uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_search_accessible_clients_v1(uuid, uuid, uuid, text, text, integer) from public, anon, authenticated;

grant execute on function p85_stage_4c_resolve_client_access_v1(uuid, uuid, uuid, uuid, text) to service_role;
grant execute on function p85_stage_4c_list_conversations_v1(uuid, uuid, uuid, text, text, text, timestamptz, uuid, integer) to service_role;
grant execute on function p85_stage_4c_load_conversation_v1(uuid, uuid, uuid, text, uuid, integer) to service_role;
grant execute on function p85_stage_4c_rename_conversation_v1(uuid, uuid, uuid, text, uuid, bigint, text, text, text) to service_role;
grant execute on function p85_stage_4c_list_branches_v1(uuid, uuid, uuid, text, uuid) to service_role;
grant execute on function p85_stage_4c_activate_branch_v1(uuid, uuid, uuid, text, uuid, uuid, bigint, text, text) to service_role;
grant execute on function p85_stage_4c_search_accessible_clients_v1(uuid, uuid, uuid, text, text, integer) to service_role;
