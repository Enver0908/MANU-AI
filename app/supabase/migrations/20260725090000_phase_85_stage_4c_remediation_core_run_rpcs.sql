-- Phase 85 Stage 4C remediation Faz 2: core chat/run RPC closure with concurrency indexes.
-- Append-only remediation for send/edit/regenerate/commit/finalize/title/branch-chain.

create unique index if not exists ai_chat_runs_active_conversation_uidx
  on ai_chat_runs (tenant_id, conversation_id)
  where p85_stage_4c_is_active_run_status(status);

create index if not exists ai_chat_runs_active_user_status_idx
  on ai_chat_runs (tenant_id, created_by_user_id, status)
  where p85_stage_4c_is_active_run_status(status);

create or replace function p85_stage_4c_message_body_sha256(p_body text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(digest(coalesce(p_body, ''), 'sha256'), 'hex')
$$;

create or replace function p85_stage_4c_assert_user_run_budget(
  p_tenant_id uuid,
  p_user_id uuid,
  p_max_active integer default 3
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_count integer;
begin
  select count(*)
    into v_active_count
  from ai_chat_runs r
  where r.tenant_id = p_tenant_id
    and r.created_by_user_id = p_user_id
    and p85_stage_4c_is_active_run_status(r.status);

  if v_active_count >= coalesce(p_max_active, 3) then
    raise exception 'ai_chat_user_run_limit';
  end if;
end;
$$;

create or replace function p85_stage_4c_append_accepted_event(
  p_tenant_id uuid,
  p_run_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform p85_stage_4c_append_run_event_v1(
    p_tenant_id,
    p_run_id,
    'run.accepted',
    jsonb_build_object('runId', p_run_id, 'status', 'queued')
  );
end;
$$;

create or replace function p85_stage_4c_send_message_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_chat_id uuid,
  p_expected_revision bigint,
  p_body text,
  p_branch_id uuid,
  p_request_id text,
  p_body_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing ai_chat_mutation_ledger%rowtype;
  v_conversation ai_chat_conversations%rowtype;
  v_branch ai_chat_branches%rowtype;
  v_message ai_chat_messages%rowtype;
  v_version ai_chat_message_versions%rowtype;
  v_run ai_chat_runs%rowtype;
  v_digest_parts text[];
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if coalesce(trim(p_body), '') = '' then
    raise exception 'ai_chat_message_body_required';
  end if;
  if char_length(p_body) > 12000 then
    raise exception 'ai_chat_message_body_too_long';
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
      'run_id', v_digest_parts[1]::uuid,
      'message_id', v_digest_parts[2]::uuid,
      'message_version_id', v_digest_parts[3]::uuid,
      'conversation_revision', v_digest_parts[4]::bigint
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
  if v_conversation.status <> 'active' then
    raise exception 'ai_chat_conversation_locked';
  end if;
  if v_conversation.revision <> p_expected_revision then
    raise exception 'ai_chat_revision_conflict:%', v_conversation.revision;
  end if;

  select *
    into v_branch
  from ai_chat_branches b
  where b.tenant_id = p_tenant_id
    and b.conversation_id = p_chat_id
    and b.id = coalesce(p_branch_id, v_conversation.active_branch_id)
    and b.created_by_user_id = p_user_id
    and coalesce(b.status, 'active') = 'active'
  for update;

  if not found then
    raise exception 'ai_chat_not_found';
  end if;

  if exists (
    select 1
    from ai_chat_runs r
    where r.tenant_id = p_tenant_id
      and r.conversation_id = p_chat_id
      and p85_stage_4c_is_active_run_status(r.status)
  ) then
    raise exception 'ai_chat_active_run_conflict';
  end if;

  perform p85_stage_4c_assert_user_run_budget(p_tenant_id, p_user_id, 3);

  insert into ai_chat_messages (
    tenant_id,
    conversation_id,
    created_by_user_id,
    role,
    author_user_id,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    p_chat_id,
    p_user_id,
    'user',
    p_user_id,
    v_now,
    v_now
  )
  returning * into v_message;

  insert into ai_chat_message_versions (
    tenant_id,
    conversation_id,
    message_id,
    branch_id,
    created_by_user_id,
    body,
    body_sha256,
    parent_version_id,
    created_at
  )
  values (
    p_tenant_id,
    p_chat_id,
    v_message.id,
    v_branch.id,
    p_user_id,
    p_body,
    p85_stage_4c_message_body_sha256(p_body),
    v_branch.active_leaf_version_id,
    v_now
  )
  returning * into v_version;

  update ai_chat_branches
  set active_leaf_version_id = v_version.id,
      revision = revision + 1,
      updated_at = v_now
  where tenant_id = p_tenant_id
    and id = v_branch.id;

  insert into ai_chat_runs (
    tenant_id,
    conversation_id,
    created_by_user_id,
    trigger_message_version_id,
    status,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    p_chat_id,
    p_user_id,
    v_version.id,
    'queued',
    v_now,
    v_now
  )
  returning * into v_run;

  insert into ai_chat_jobs (
    tenant_id,
    job_type,
    run_id,
    conversation_id,
    created_by_user_id,
    status,
    payload,
    next_attempt_at,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    'generation',
    v_run.id,
    p_chat_id,
    p_user_id,
    'queued',
    jsonb_build_object('runId', v_run.id, 'messageVersionId', v_version.id),
    v_now,
    v_now,
    v_now
  );

  perform p85_stage_4c_append_accepted_event(p_tenant_id, v_run.id);

  update ai_chat_conversations
  set active_branch_id = v_branch.id,
      revision = revision + 1,
      last_message_at = v_now,
      updated_at = v_now
  where tenant_id = p_tenant_id
    and id = p_chat_id
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
    concat_ws('|', v_run.id::text, v_message.id::text, v_version.id::text, v_conversation.revision::text)
  );

  return jsonb_build_object(
    'run_id', v_run.id,
    'message_id', v_message.id,
    'message_version_id', v_version.id,
    'conversation_revision', v_conversation.revision
  );
end;
$$;

create or replace function p85_stage_4c_get_branch_chain_v1(
  p_tenant_id uuid,
  p_branch_id uuid
)
returns table (
  message_id uuid,
  role text,
  body text,
  version_id uuid,
  depth integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  return query
  with recursive chain as (
    select
      mv.id,
      mv.message_id,
      mv.parent_version_id,
      mv.body,
      1 as depth
    from ai_chat_branches b
    join ai_chat_message_versions mv
      on mv.tenant_id = b.tenant_id
     and mv.id = b.active_leaf_version_id
    where b.tenant_id = p_tenant_id
      and b.id = p_branch_id
      and coalesce(b.status, 'active') = 'active'
    union all
    select
      parent.id,
      parent.message_id,
      parent.parent_version_id,
      parent.body,
      chain.depth + 1
    from chain
    join ai_chat_message_versions parent
      on parent.tenant_id = p_tenant_id
     and parent.id = chain.parent_version_id
  )
  select
    c.message_id,
    m.role,
    c.body,
    c.id as version_id,
    c.depth
  from chain c
  join ai_chat_messages m
    on m.tenant_id = p_tenant_id
   and m.id = c.message_id
  where c.body is not null
    and m.deleted_at is null
  order by c.depth desc;
end;
$$;

create or replace function p85_stage_4c_edit_message_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_message_id uuid,
  p_expected_revision bigint,
  p_body text,
  p_request_id text,
  p_body_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing ai_chat_mutation_ledger%rowtype;
  v_conversation ai_chat_conversations%rowtype;
  v_current_version ai_chat_message_versions%rowtype;
  v_branch ai_chat_branches%rowtype;
  v_message ai_chat_messages%rowtype;
  v_new_version ai_chat_message_versions%rowtype;
  v_run ai_chat_runs%rowtype;
  v_digest_parts text[];
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if coalesce(trim(p_body), '') = '' then
    raise exception 'ai_chat_message_body_required';
  end if;
  if char_length(p_body) > 12000 then
    raise exception 'ai_chat_message_body_too_long';
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
      'run_id', v_digest_parts[1]::uuid,
      'branch_id', v_digest_parts[2]::uuid,
      'message_id', v_digest_parts[3]::uuid,
      'message_version_id', v_digest_parts[4]::uuid,
      'conversation_revision', v_digest_parts[5]::bigint
    );
  end if;

  select c.*
    into v_conversation
  from ai_chat_messages m
  join ai_chat_conversations c
    on c.tenant_id = m.tenant_id
   and c.id = m.conversation_id
  where m.tenant_id = p_tenant_id
    and m.id = p_message_id
    and m.created_by_user_id = p_user_id
    and m.role = 'user'
    and c.created_by_user_id = p_user_id
    and (
      c.scope_type = 'general'
      or p85_stage_4c_resolve_client_access_v1(
        p_tenant_id, c.client_id, p_user_id, p_dietitian_id, p_role
      )
    )
  for update of c;

  if not found then
    raise exception 'ai_chat_message_not_found';
  end if;
  if v_conversation.status <> 'active' then
    raise exception 'ai_chat_conversation_locked';
  end if;
  if v_conversation.revision <> p_expected_revision then
    raise exception 'ai_chat_revision_conflict:%', v_conversation.revision;
  end if;

  with recursive chain as (
    select mv.*, m.role, 1 as depth
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
    select parent.*, parent_message.role, chain.depth + 1
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

  update ai_chat_runs
  set status = 'superseded',
      updated_at = v_now
  where tenant_id = p_tenant_id
    and conversation_id = v_conversation.id
    and p85_stage_4c_is_active_run_status(status);

  insert into ai_chat_branches (
    tenant_id,
    conversation_id,
    created_by_user_id,
    parent_branch_id,
    forked_from_message_version_id,
    fork_reason,
    status,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    v_conversation.id,
    p_user_id,
    v_conversation.active_branch_id,
    v_current_version.parent_version_id,
    'edit',
    'active',
    v_now,
    v_now
  )
  returning * into v_branch;

  insert into ai_chat_messages (
    tenant_id,
    conversation_id,
    created_by_user_id,
    role,
    author_user_id,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    v_conversation.id,
    p_user_id,
    'user',
    p_user_id,
    v_now,
    v_now
  )
  returning * into v_message;

  insert into ai_chat_message_versions (
    tenant_id,
    conversation_id,
    message_id,
    branch_id,
    created_by_user_id,
    body,
    body_sha256,
    parent_version_id,
    supersedes_version_id,
    created_at
  )
  values (
    p_tenant_id,
    v_conversation.id,
    v_message.id,
    v_branch.id,
    p_user_id,
    p_body,
    p85_stage_4c_message_body_sha256(p_body),
    v_current_version.parent_version_id,
    v_current_version.id,
    v_now
  )
  returning * into v_new_version;

  update ai_chat_branches
  set active_leaf_version_id = v_new_version.id,
      revision = revision + 1,
      updated_at = v_now
  where tenant_id = p_tenant_id
    and id = v_branch.id;

  insert into ai_chat_runs (
    tenant_id,
    conversation_id,
    created_by_user_id,
    trigger_message_version_id,
    status,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    v_conversation.id,
    p_user_id,
    v_new_version.id,
    'queued',
    v_now,
    v_now
  )
  returning * into v_run;

  insert into ai_chat_jobs (
    tenant_id,
    job_type,
    run_id,
    conversation_id,
    created_by_user_id,
    status,
    payload,
    next_attempt_at,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    'generation',
    v_run.id,
    v_conversation.id,
    p_user_id,
    'queued',
    jsonb_build_object('runId', v_run.id, 'messageVersionId', v_new_version.id),
    v_now,
    v_now,
    v_now
  );

  perform p85_stage_4c_append_accepted_event(p_tenant_id, v_run.id);

  update ai_chat_conversations
  set active_branch_id = v_branch.id,
      revision = revision + 1,
      last_message_at = v_now,
      updated_at = v_now
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
    concat_ws('|', v_run.id::text, v_branch.id::text, v_message.id::text, v_new_version.id::text, v_conversation.revision::text)
  );

  return jsonb_build_object(
    'run_id', v_run.id,
    'branch_id', v_branch.id,
    'message_id', v_message.id,
    'message_version_id', v_new_version.id,
    'conversation_revision', v_conversation.revision
  );
end;
$$;

create or replace function p85_stage_4c_regenerate_message_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_message_id uuid,
  p_expected_revision bigint,
  p_request_id text,
  p_body_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing ai_chat_mutation_ledger%rowtype;
  v_conversation ai_chat_conversations%rowtype;
  v_assistant_version ai_chat_message_versions%rowtype;
  v_branch ai_chat_branches%rowtype;
  v_run ai_chat_runs%rowtype;
  v_digest_parts text[];
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
      'run_id', v_digest_parts[1]::uuid,
      'branch_id', v_digest_parts[2]::uuid,
      'conversation_revision', v_digest_parts[3]::bigint
    );
  end if;

  select c.*
    into v_conversation
  from ai_chat_messages m
  join ai_chat_conversations c
    on c.tenant_id = m.tenant_id
   and c.id = m.conversation_id
  where m.tenant_id = p_tenant_id
    and m.id = p_message_id
    and m.created_by_user_id = p_user_id
    and m.role = 'assistant'
    and c.created_by_user_id = p_user_id
    and (
      c.scope_type = 'general'
      or p85_stage_4c_resolve_client_access_v1(
        p_tenant_id, c.client_id, p_user_id, p_dietitian_id, p_role
      )
    )
  for update of c;

  if not found or v_conversation.status <> 'active' then
    raise exception 'ai_chat_regenerate_not_latest_assistant';
  end if;
  if v_conversation.revision <> p_expected_revision then
    raise exception 'ai_chat_revision_conflict:%', v_conversation.revision;
  end if;

  with recursive chain as (
    select mv.*, m.role, 1 as depth
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
    select parent.*, parent_message.role, chain.depth + 1
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
    into v_assistant_version
  from chain
  where depth = 1
    and role = 'assistant'
    and message_id = p_message_id
  limit 1;

  if not found or v_assistant_version.parent_version_id is null then
    raise exception 'ai_chat_regenerate_not_latest_assistant';
  end if;

  update ai_chat_runs
  set status = 'superseded',
      updated_at = v_now
  where tenant_id = p_tenant_id
    and conversation_id = v_conversation.id
    and p85_stage_4c_is_active_run_status(status);

  insert into ai_chat_branches (
    tenant_id,
    conversation_id,
    created_by_user_id,
    parent_branch_id,
    forked_from_message_version_id,
    active_leaf_version_id,
    fork_reason,
    status,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    v_conversation.id,
    p_user_id,
    v_conversation.active_branch_id,
    v_assistant_version.parent_version_id,
    v_assistant_version.parent_version_id,
    'regenerate',
    'active',
    v_now,
    v_now
  )
  returning * into v_branch;

  insert into ai_chat_runs (
    tenant_id,
    conversation_id,
    created_by_user_id,
    trigger_message_version_id,
    status,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    v_conversation.id,
    p_user_id,
    v_assistant_version.parent_version_id,
    'queued',
    v_now,
    v_now
  )
  returning * into v_run;

  insert into ai_chat_jobs (
    tenant_id,
    job_type,
    run_id,
    conversation_id,
    created_by_user_id,
    status,
    payload,
    next_attempt_at,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    'generation',
    v_run.id,
    v_conversation.id,
    p_user_id,
    'queued',
    jsonb_build_object('runId', v_run.id, 'messageVersionId', v_assistant_version.parent_version_id),
    v_now,
    v_now,
    v_now
  );

  perform p85_stage_4c_append_accepted_event(p_tenant_id, v_run.id);

  update ai_chat_conversations
  set active_branch_id = v_branch.id,
      revision = revision + 1,
      updated_at = v_now
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
    concat_ws('|', v_run.id::text, v_branch.id::text, v_conversation.revision::text)
  );

  return jsonb_build_object(
    'run_id', v_run.id,
    'branch_id', v_branch.id,
    'conversation_revision', v_conversation.revision
  );
end;
$$;

create or replace function p85_stage_4c_commit_assistant_message_v1(
  p_tenant_id uuid,
  p_run_id uuid,
  p_body text,
  p_answerability text,
  p_risk_level text,
  p_completion_state text default 'complete'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run ai_chat_runs%rowtype;
  v_trigger ai_chat_message_versions%rowtype;
  v_message ai_chat_messages%rowtype;
  v_version ai_chat_message_versions%rowtype;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if coalesce(trim(p_body), '') = '' then
    return;
  end if;
  if p_answerability is not null and p_answerability not in ('answerable', 'partial', 'insufficient', 'conflicting', 'not_authorized') then
    raise exception 'ai_chat_answerability_invalid';
  end if;
  if p_risk_level is not null and p_risk_level not in ('green', 'yellow', 'red') then
    raise exception 'ai_chat_risk_level_invalid';
  end if;

  select *
    into v_run
  from ai_chat_runs
  where tenant_id = p_tenant_id
    and id = p_run_id
  for update;

  if not found then
    raise exception 'ai_chat_run_not_found';
  end if;

  if exists (
    select 1
    from ai_chat_message_versions mv
    where mv.tenant_id = p_tenant_id
      and mv.run_id = p_run_id
  ) then
    return;
  end if;

  select *
    into v_trigger
  from ai_chat_message_versions
  where tenant_id = p_tenant_id
    and id = v_run.trigger_message_version_id;

  if not found then
    raise exception 'ai_chat_message_not_found';
  end if;

  insert into ai_chat_messages (
    tenant_id,
    conversation_id,
    created_by_user_id,
    role,
    author_user_id,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    v_run.conversation_id,
    v_run.created_by_user_id,
    'assistant',
    null,
    v_now,
    v_now
  )
  returning * into v_message;

  insert into ai_chat_message_versions (
    tenant_id,
    conversation_id,
    message_id,
    branch_id,
    created_by_user_id,
    body,
    body_sha256,
    parent_version_id,
    run_id,
    content_status,
    created_at
  )
  values (
    p_tenant_id,
    v_run.conversation_id,
    v_message.id,
    v_trigger.branch_id,
    v_run.created_by_user_id,
    p_body,
    p85_stage_4c_message_body_sha256(p_body),
    v_run.trigger_message_version_id,
    p_run_id,
    'active',
    v_now
  )
  returning * into v_version;

  update ai_chat_branches
  set active_leaf_version_id = v_version.id,
      revision = revision + 1,
      updated_at = v_now
  where tenant_id = p_tenant_id
    and id = v_trigger.branch_id;

  update ai_chat_source_refs
  set message_version_id = v_version.id
  where tenant_id = p_tenant_id
    and run_id = p_run_id
    and message_version_id is null;

  update ai_chat_runs
  set answerability = coalesce(p_answerability, answerability),
      risk_level = coalesce(p_risk_level, risk_level),
      safety_outcome = coalesce(p_completion_state, safety_outcome),
      updated_at = v_now
  where tenant_id = p_tenant_id
    and id = p_run_id;

  update ai_chat_conversations
  set last_message_at = v_now,
      updated_at = v_now
  where tenant_id = p_tenant_id
    and id = v_run.conversation_id;
end;
$$;

create or replace function p85_stage_4c_finalize_run_v1(
  p_tenant_id uuid,
  p_run_id uuid,
  p_status text,
  p_answerability text default null,
  p_risk_level text default null,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run ai_chat_runs%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_status not in ('queued', 'retrieving', 'generating', 'validating', 'cancel_requested', 'completed', 'stopped', 'failed', 'superseded') then
    raise exception 'ai_chat_run_status_invalid';
  end if;
  if p_answerability is not null and p_answerability not in ('answerable', 'partial', 'insufficient', 'conflicting', 'not_authorized') then
    raise exception 'ai_chat_answerability_invalid';
  end if;
  if p_risk_level is not null and p_risk_level not in ('green', 'yellow', 'red') then
    raise exception 'ai_chat_risk_level_invalid';
  end if;

  select *
    into v_run
  from ai_chat_runs
  where tenant_id = p_tenant_id
    and id = p_run_id
  for update;

  if not found then
    raise exception 'ai_chat_run_not_found';
  end if;

  if v_run.status in ('completed', 'stopped', 'failed', 'superseded') then
    raise exception 'ai_chat_run_already_terminal';
  end if;

  update ai_chat_runs
  set status = p_status,
      answerability = coalesce(p_answerability, answerability),
      risk_level = coalesce(p_risk_level, risk_level),
      error_code = coalesce(p_error_code, error_code),
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_run_id;
end;
$$;

create or replace function p85_stage_4c_enqueue_title_job_v1(
  p_tenant_id uuid,
  p_conversation_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation ai_chat_conversations%rowtype;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_conversation
  from ai_chat_conversations
  where tenant_id = p_tenant_id
    and id = p_conversation_id
    and created_by_user_id = p_user_id;

  if not found or v_conversation.title_source = 'user' then
    return;
  end if;

  insert into ai_chat_jobs (
    tenant_id,
    job_type,
    run_id,
    conversation_id,
    created_by_user_id,
    status,
    payload,
    next_attempt_at,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    'title',
    null,
    p_conversation_id,
    p_user_id,
    'queued',
    '{}'::jsonb,
    v_now,
    v_now,
    v_now
  );
end;
$$;

create or replace function p85_stage_4c_apply_auto_title_v1(
  p_tenant_id uuid,
  p_conversation_id uuid,
  p_max_length integer default 60
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation ai_chat_conversations%rowtype;
  v_first_user_body text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_conversation
  from ai_chat_conversations
  where tenant_id = p_tenant_id
    and id = p_conversation_id
  for update;

  if not found or v_conversation.title_source = 'user' or v_conversation.active_branch_id is null then
    return;
  end if;

  select chain.body
    into v_first_user_body
  from p85_stage_4c_get_branch_chain_v1(p_tenant_id, v_conversation.active_branch_id) chain
  where chain.role = 'user'
  order by chain.depth desc
  limit 1;

  if coalesce(trim(v_first_user_body), '') = '' then
    return;
  end if;

  update ai_chat_conversations
  set title = left(v_first_user_body, least(greatest(coalesce(p_max_length, 60), 1), 120)),
      title_source = 'auto',
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_conversation_id;
end;
$$;

revoke all on function p85_stage_4c_message_body_sha256(text) from public, anon, authenticated;
revoke all on function p85_stage_4c_assert_user_run_budget(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function p85_stage_4c_append_accepted_event(uuid, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_send_message_v1(uuid, uuid, uuid, text, uuid, bigint, text, uuid, text, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_get_branch_chain_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_edit_message_v1(uuid, uuid, uuid, text, uuid, bigint, text, text, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_regenerate_message_v1(uuid, uuid, uuid, text, uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_commit_assistant_message_v1(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_finalize_run_v1(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_enqueue_title_job_v1(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_apply_auto_title_v1(uuid, uuid, integer) from public, anon, authenticated;

grant execute on function p85_stage_4c_message_body_sha256(text) to service_role;
grant execute on function p85_stage_4c_assert_user_run_budget(uuid, uuid, integer) to service_role;
grant execute on function p85_stage_4c_append_accepted_event(uuid, uuid) to service_role;
grant execute on function p85_stage_4c_send_message_v1(uuid, uuid, uuid, text, uuid, bigint, text, uuid, text, text) to service_role;
grant execute on function p85_stage_4c_get_branch_chain_v1(uuid, uuid) to service_role;
grant execute on function p85_stage_4c_edit_message_v1(uuid, uuid, uuid, text, uuid, bigint, text, text, text) to service_role;
grant execute on function p85_stage_4c_regenerate_message_v1(uuid, uuid, uuid, text, uuid, bigint, text, text) to service_role;
grant execute on function p85_stage_4c_commit_assistant_message_v1(uuid, uuid, text, text, text, text) to service_role;
grant execute on function p85_stage_4c_finalize_run_v1(uuid, uuid, text, text, text, text) to service_role;
grant execute on function p85_stage_4c_enqueue_title_job_v1(uuid, uuid, uuid) to service_role;
grant execute on function p85_stage_4c_apply_auto_title_v1(uuid, uuid, integer) to service_role;
