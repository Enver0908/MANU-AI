-- Phase 85 Stage 4C remediation Faz 8: scale indexes, fixture seed/cleanup, and EXPLAIN profiling RPCs.
-- Append-only remediation for local PostgreSQL scale rehearsal.

create index if not exists ai_chat_message_versions_branch_order_idx
  on ai_chat_message_versions (tenant_id, branch_id, created_at asc, id asc);

create index if not exists ai_chat_attachment_derivatives_lineage_idx
  on ai_chat_attachment_derivatives (tenant_id, attachment_id, kind, status, created_at desc);

create or replace function p85_stage_4c_scale_uuid_from_seed(p_seed text)
returns uuid
language sql
immutable
set search_path = public
as $$
  with hashed as (
    select md5('stage4c-scale:' || coalesce(p_seed, '')) as h
  )
  select (
    substr(h, 1, 8) || '-' ||
    substr(h, 9, 4) || '-' ||
    '4' || substr(h, 13, 3) || '-' ||
    '8' || substr(h, 16, 3) || '-' ||
    substr(h, 19, 12)
  )::uuid
  from hashed
$$;

create or replace function p85_stage_4c_scale_fixture_seed_v1()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := p85_stage_4c_scale_uuid_from_seed('tenant');
  v_user_id uuid := p85_stage_4c_scale_uuid_from_seed('user');
  v_dietitian_count integer := 100;
  v_client_count integer := 5000;
  v_chat_count integer := 10000;
  v_version_count integer := 200000;
  v_versions_per_chat integer;
  v_dietitian_index integer;
  v_client_index integer;
  v_chat_index integer;
  v_version_index integer;
  v_dietitian_id uuid;
  v_client_id uuid;
  v_conversation_id uuid;
  v_branch_id uuid;
  v_message_id uuid;
  v_version_id uuid;
  v_sample_run_id uuid := p85_stage_4c_scale_uuid_from_seed('run:0');
  v_parent_version_id uuid;
  v_now timestamptz := '2026-07-25T00:00:00.000Z'::timestamptz;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  perform p85_stage_4c_scale_fixture_cleanup_v1();

  insert into tenants (id, name)
  values (v_tenant_id, 'Stage 4C Scale Fixture Tenant')
  on conflict (id) do update set name = excluded.name;

  insert into tenant_memberships (id, tenant_id, user_id, role)
  values (p85_stage_4c_scale_uuid_from_seed('membership'), v_tenant_id, v_user_id, 'owner')
  on conflict (tenant_id, user_id) do nothing;

  for v_dietitian_index in 0..(v_dietitian_count - 1) loop
    v_dietitian_id := p85_stage_4c_scale_uuid_from_seed('dietitian:' || v_dietitian_index::text);
    insert into dietitians (id, tenant_id, display_name, auth_user_id)
    values (v_dietitian_id, v_tenant_id, 'Scale Dietitian ' || v_dietitian_index::text, v_user_id)
    on conflict (id) do nothing;
  end loop;

  for v_client_index in 0..(v_client_count - 1) loop
    v_dietitian_id := p85_stage_4c_scale_uuid_from_seed('dietitian:' || (v_client_index % v_dietitian_count)::text);
    v_client_id := p85_stage_4c_scale_uuid_from_seed('client:' || v_client_index::text);
    insert into clients (
      id,
      tenant_id,
      dietitian_id,
      full_name,
      selected_persona_id,
      lifecycle_status
    )
    values (
      v_client_id,
      v_tenant_id,
      v_dietitian_id,
      'Scale Client ' || v_client_index::text,
      'balanced_coach',
      'active'
    )
    on conflict (id) do nothing;
  end loop;

  v_versions_per_chat := ceil(v_version_count::numeric / v_chat_count::numeric)::integer;

  for v_chat_index in 0..(v_chat_count - 1) loop
    v_dietitian_id := p85_stage_4c_scale_uuid_from_seed('dietitian:' || (v_chat_index % v_dietitian_count)::text);
    v_client_id := p85_stage_4c_scale_uuid_from_seed('client:' || (v_chat_index % v_client_count)::text);
    v_conversation_id := p85_stage_4c_scale_uuid_from_seed('conversation:' || v_chat_index::text);
    v_branch_id := p85_stage_4c_scale_uuid_from_seed('branch:' || v_chat_index::text);

    insert into ai_chat_conversations (
      id,
      tenant_id,
      created_by_user_id,
      created_by_dietitian_id,
      scope_type,
      client_id,
      title,
      status,
      active_branch_id,
      revision,
      last_message_at,
      title_source,
      created_at,
      updated_at
    )
    values (
      v_conversation_id,
      v_tenant_id,
      v_user_id,
      v_dietitian_id,
      case when v_chat_index % 4 = 0 then 'general' else 'client' end,
      case when v_chat_index % 4 = 0 then null else v_client_id end,
      'Scale Chat ' || v_chat_index::text,
      'active',
      v_branch_id,
      1,
      v_now + (v_chat_index || ' seconds')::interval,
      'auto',
      v_now,
      v_now
    )
    on conflict (id) do nothing;

    insert into ai_chat_branches (
      id,
      tenant_id,
      conversation_id,
      created_by_user_id,
      revision,
      created_at,
      updated_at
    )
    values (
      v_branch_id,
      v_tenant_id,
      v_conversation_id,
      v_user_id,
      1,
      v_now,
      v_now
    )
    on conflict (id) do nothing;

    v_parent_version_id := null;
    for v_version_index in 0..(v_versions_per_chat - 1) loop
      exit when (v_chat_index * v_versions_per_chat + v_version_index) >= v_version_count;
      v_message_id := p85_stage_4c_scale_uuid_from_seed(
        'message:' || v_chat_index::text || ':' || v_version_index::text
      );
      v_version_id := p85_stage_4c_scale_uuid_from_seed(
        'version:' || v_chat_index::text || ':' || v_version_index::text
      );

      insert into ai_chat_messages (
        id,
        tenant_id,
        conversation_id,
        created_by_user_id,
        role,
        created_at,
        updated_at
      )
      values (
        v_message_id,
        v_tenant_id,
        v_conversation_id,
        v_user_id,
        case when v_version_index % 2 = 0 then 'user' else 'assistant' end,
        v_now + ((v_chat_index * v_versions_per_chat + v_version_index) || ' milliseconds')::interval,
        v_now
      )
      on conflict (id) do nothing;

      insert into ai_chat_message_versions (
        id,
        tenant_id,
        conversation_id,
        message_id,
        branch_id,
        created_by_user_id,
        body,
        body_sha256,
        parent_version_id,
        content_status,
        created_at
      )
      values (
        v_version_id,
        v_tenant_id,
        v_conversation_id,
        v_message_id,
        v_branch_id,
        v_user_id,
        'scale-body-' || v_chat_index::text || '-' || v_version_index::text,
        p85_stage_4c_message_body_sha256('scale-body-' || v_chat_index::text || '-' || v_version_index::text),
        v_parent_version_id,
        'active',
        v_now + ((v_chat_index * v_versions_per_chat + v_version_index) || ' milliseconds')::interval
      )
      on conflict (id) do nothing;

      v_parent_version_id := v_version_id;
    end loop;

    update ai_chat_branches
    set active_leaf_version_id = v_parent_version_id,
        updated_at = v_now
    where tenant_id = v_tenant_id
      and id = v_branch_id;
  end loop;

  insert into ai_chat_runs (
    id,
    tenant_id,
    conversation_id,
    created_by_user_id,
    trigger_message_version_id,
    status,
    answerability,
    risk_level,
    created_at,
    updated_at
  )
  values (
    v_sample_run_id,
    v_tenant_id,
    p85_stage_4c_scale_uuid_from_seed('conversation:0'),
    v_user_id,
    p85_stage_4c_scale_uuid_from_seed('version:0:0'),
    'completed',
    'answerable',
    'green',
    v_now,
    v_now
  )
  on conflict (id) do update
    set status = excluded.status,
        answerability = excluded.answerability,
        risk_level = excluded.risk_level,
        updated_at = excluded.updated_at;

  insert into ai_chat_run_events (
    id,
    tenant_id,
    run_id,
    conversation_id,
    created_by_user_id,
    sequence_number,
    event_type,
    payload,
    expires_at,
    created_at
  )
  select
    p85_stage_4c_scale_uuid_from_seed('run-event:0:' || seq::text),
    v_tenant_id,
    v_sample_run_id,
    p85_stage_4c_scale_uuid_from_seed('conversation:0'),
    v_user_id,
    seq,
    case when seq = 200 then 'response.completed' else 'response.delta' end,
    case
      when seq = 200 then jsonb_build_object('sequenceNumber', seq, 'eventType', 'response.completed')
      else jsonb_build_object('sequenceNumber', seq, 'eventType', 'response.delta', 'text', 'chunk-' || seq::text)
    end,
    v_now + interval '24 hours',
    v_now + (seq || ' milliseconds')::interval
  from generate_series(1, 200) as seq
  on conflict (tenant_id, run_id, sequence_number) do update
    set event_type = excluded.event_type,
        payload = excluded.payload,
        expires_at = excluded.expires_at,
        created_at = excluded.created_at;

  return jsonb_build_object(
    'tenantId', v_tenant_id,
    'userId', v_user_id,
    'dietitianCount', v_dietitian_count,
    'clientCount', v_client_count,
    'chatCount', v_chat_count,
    'messageVersionCount', v_version_count,
    'sampleConversationId', p85_stage_4c_scale_uuid_from_seed('conversation:0'),
    'sampleBranchId', p85_stage_4c_scale_uuid_from_seed('branch:0'),
    'sampleRunId', v_sample_run_id,
    'sampleDietitianId', p85_stage_4c_scale_uuid_from_seed('dietitian:0'),
    'sampleClientId', p85_stage_4c_scale_uuid_from_seed('client:0')
  );
end;
$$;

create or replace function p85_stage_4c_scale_fixture_cleanup_v1()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := p85_stage_4c_scale_uuid_from_seed('tenant');
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  delete from tenants where id = v_tenant_id;

  return jsonb_build_object('tenantId', v_tenant_id, 'cleaned', true);
end;
$$;

create or replace function p85_stage_4c_scale_explain_profile_v1(
  p_profile text,
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_conversation_id uuid default null,
  p_branch_id uuid default null,
  p_client_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan jsonb;
  v_conversation_id uuid := coalesce(p_conversation_id, p85_stage_4c_scale_uuid_from_seed('conversation:0'));
  v_branch_id uuid := coalesce(p_branch_id, p85_stage_4c_scale_uuid_from_seed('branch:0'));
  v_client_id uuid := coalesce(p_client_id, p85_stage_4c_scale_uuid_from_seed('client:0'));
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  case p_profile
    when 'history_list' then
      execute format(
        'explain (analyze, buffers, format json) select c.id from ai_chat_conversations c where c.tenant_id = %L and c.created_by_user_id = %L and c.status = %L order by c.last_message_at desc nulls last, c.id desc limit 30',
        p_tenant_id,
        p_user_id,
        'active'
      ) into v_plan;
    when 'conversation_load' then
      execute format(
        'explain (analyze, buffers, format json) select c.* from ai_chat_conversations c where c.tenant_id = %L and c.id = %L',
        p_tenant_id,
        v_conversation_id
      ) into v_plan;
    when 'branch_chain' then
      execute format(
        'explain (analyze, buffers, format json) select mv.id from ai_chat_message_versions mv where mv.tenant_id = %L and mv.branch_id = %L order by mv.created_at asc, mv.id asc limit 50',
        p_tenant_id,
        v_branch_id
      ) into v_plan;
    when 'run_event_catch_up' then
      execute format(
        'explain (analyze, buffers, format json) select e.sequence_number from ai_chat_run_events e where e.tenant_id = %L and e.conversation_id = %L order by e.sequence_number asc limit 200',
        p_tenant_id,
        v_conversation_id
      ) into v_plan;
    when 'context_gateway_access' then
      execute format(
        'explain (analyze, buffers, format json) select c.id from clients c where c.tenant_id = %L and c.id = %L and c.lifecycle_status = %L',
        p_tenant_id,
        v_client_id,
        'active'
      ) into v_plan;
    when 'source_search' then
      execute format(
        'explain (analyze, buffers, format json) select s.id from ai_chat_approved_sources s where s.tenant_id = %L and s.status = %L limit 20',
        p_tenant_id,
        'active'
      ) into v_plan;
    when 'job_claim' then
      execute format(
        'explain (analyze, buffers, format json) select j.id from ai_chat_jobs j where j.tenant_id = %L and j.status = %L order by j.created_at asc limit 1',
        p_tenant_id,
        'queued'
      ) into v_plan;
    when 'deletion_claim' then
      execute format(
        'explain (analyze, buffers, format json) select j.id from ai_chat_deletion_jobs j where j.tenant_id = %L and j.status = %L order by j.claimed_at asc nulls first, j.created_at asc limit 1',
        p_tenant_id,
        'queued'
      ) into v_plan;
    else
      raise exception 'unknown_scale_explain_profile:%', p_profile;
  end case;

  return jsonb_build_object('profile', p_profile, 'plan', v_plan);
end;
$$;

revoke all on function p85_stage_4c_scale_uuid_from_seed(text) from public, anon, authenticated;
revoke all on function p85_stage_4c_scale_fixture_seed_v1() from public, anon, authenticated;
revoke all on function p85_stage_4c_scale_fixture_cleanup_v1() from public, anon, authenticated;
revoke all on function p85_stage_4c_scale_explain_profile_v1(text, uuid, uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function p85_stage_4c_scale_uuid_from_seed(text) to service_role;
grant execute on function p85_stage_4c_scale_fixture_seed_v1() to service_role;
grant execute on function p85_stage_4c_scale_fixture_cleanup_v1() to service_role;
grant execute on function p85_stage_4c_scale_explain_profile_v1(text, uuid, uuid, uuid, uuid, uuid, uuid) to service_role;
