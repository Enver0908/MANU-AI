-- Phase 85 Stage 4C remediation: make the local scale fixture idempotent for hard-zero rehearsal.

create or replace function p85_stage_4c_scale_fixture_cleanup_v1()
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '300s'
as $$
declare
  v_tenant_id uuid := p85_stage_4c_scale_uuid_from_seed('tenant');
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  update ai_chat_conversations
  set active_branch_id = null
  where tenant_id = v_tenant_id
    and active_branch_id is not null;

  update ai_chat_branches
  set active_leaf_version_id = null
  where tenant_id = v_tenant_id
    and active_leaf_version_id is not null;

  delete from ai_chat_run_events where tenant_id = v_tenant_id;
  delete from ai_chat_runs where tenant_id = v_tenant_id;
  delete from ai_chat_message_versions where tenant_id = v_tenant_id;
  delete from ai_chat_messages where tenant_id = v_tenant_id;
  delete from ai_chat_branches where tenant_id = v_tenant_id;
  delete from ai_chat_conversations where tenant_id = v_tenant_id;
  delete from clients where tenant_id = v_tenant_id;
  delete from dietitians where tenant_id = v_tenant_id;
  delete from tenant_memberships where tenant_id = v_tenant_id;
  delete from tenants where id = v_tenant_id;

  return jsonb_build_object('tenantId', v_tenant_id, 'cleaned', true);
end;
$$;

create or replace function p85_stage_4c_scale_uuid_from_parts(p_kind integer, p_index integer, p_subindex integer default 0)
returns uuid
language sql
immutable
set search_path = public
as $$
  select (
    '85000000-' ||
    lpad(to_hex(p_kind), 4, '0') || '-' ||
    '4' || lpad(to_hex((p_index / 4096) % 4096), 3, '0') || '-' ||
    '8' || lpad(to_hex(p_index % 4096), 3, '0') || '-' ||
    lpad(to_hex(p_subindex), 12, '0')
  )::uuid;
$$;

create or replace function p85_stage_4c_scale_fixture_seed_v1()
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '300s'
as $$
declare
  v_tenant_id uuid := p85_stage_4c_scale_uuid_from_seed('tenant');
  v_user_id uuid := p85_stage_4c_scale_uuid_from_parts(2, 0);
  v_dietitian_count integer := 100;
  v_client_count integer := 5000;
  v_chat_count integer := 10000;
  v_version_count integer := 200000;
  v_versions_per_chat integer := 20;
  v_sample_run_id uuid := p85_stage_4c_scale_uuid_from_seed('run:0');
  v_now timestamptz := '2026-07-25T00:00:00.000Z'::timestamptz;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  insert into tenants (id, name)
  values (v_tenant_id, 'Stage 4C Scale Fixture Tenant')
  on conflict (id) do update set name = excluded.name;

  insert into tenant_memberships (id, tenant_id, user_id, role)
  values (p85_stage_4c_scale_uuid_from_seed('membership'), v_tenant_id, v_user_id, 'owner')
  on conflict (tenant_id, user_id) do nothing;

  insert into tenant_memberships (id, tenant_id, user_id, role)
  select
    p85_stage_4c_scale_uuid_from_parts(1, index),
    v_tenant_id,
    p85_stage_4c_scale_uuid_from_parts(2, index),
    (case when index = 0 then 'owner' else 'dietitian' end)::tenant_role
  from generate_series(0, v_dietitian_count - 1) as index
  on conflict (tenant_id, user_id) do nothing;

  insert into dietitians (id, tenant_id, display_name, auth_user_id)
  select
    p85_stage_4c_scale_uuid_from_parts(3, index),
    v_tenant_id,
    'Scale Dietitian ' || index::text,
    p85_stage_4c_scale_uuid_from_parts(2, index)
  from generate_series(0, v_dietitian_count - 1) as index
  on conflict (id) do update
    set display_name = excluded.display_name,
        auth_user_id = excluded.auth_user_id;

  insert into clients (
    id,
    tenant_id,
    dietitian_id,
    full_name,
    selected_persona_id,
    lifecycle_status
  )
  select
    p85_stage_4c_scale_uuid_from_parts(4, index),
    v_tenant_id,
    p85_stage_4c_scale_uuid_from_parts(3, index % v_dietitian_count),
    'Scale Client ' || index::text,
    'balanced_coach',
    'active'
  from generate_series(0, v_client_count - 1) as index
  on conflict (id) do nothing;

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
  select
    p85_stage_4c_scale_uuid_from_parts(5, index),
    v_tenant_id,
    p85_stage_4c_scale_uuid_from_parts(2, index % v_dietitian_count),
    p85_stage_4c_scale_uuid_from_parts(3, index % v_dietitian_count),
    case when index % 4 = 0 then 'general' else 'client' end,
    case when index % 4 = 0 then null else p85_stage_4c_scale_uuid_from_parts(4, index % v_client_count) end,
    'Scale Chat ' || index::text,
    'active',
    null,
    1,
    v_now + (index || ' seconds')::interval,
    'auto',
    v_now,
    v_now
  from generate_series(0, v_chat_count - 1) as index
  on conflict (id) do nothing;

  insert into ai_chat_branches (
    id,
    tenant_id,
    conversation_id,
    created_by_user_id,
    revision,
    created_at,
    updated_at,
    active_leaf_version_id
  )
  select
    p85_stage_4c_scale_uuid_from_parts(6, index),
    v_tenant_id,
    p85_stage_4c_scale_uuid_from_parts(5, index),
    p85_stage_4c_scale_uuid_from_parts(2, index % v_dietitian_count),
    1,
    v_now,
    v_now,
    null
  from generate_series(0, v_chat_count - 1) as index
  on conflict (id) do update
    set active_leaf_version_id = excluded.active_leaf_version_id,
        updated_at = excluded.updated_at;

  insert into ai_chat_messages (
    id,
    tenant_id,
    conversation_id,
    created_by_user_id,
    role,
    created_at,
    updated_at
  )
  select
    p85_stage_4c_scale_uuid_from_parts(7, chat_index, version_index),
    v_tenant_id,
    p85_stage_4c_scale_uuid_from_parts(5, chat_index),
    p85_stage_4c_scale_uuid_from_parts(2, chat_index % v_dietitian_count),
    case when version_index % 2 = 0 then 'user' else 'assistant' end,
    v_now + ((chat_index * v_versions_per_chat + version_index) || ' milliseconds')::interval,
    v_now
  from generate_series(0, v_chat_count - 1) as chat_index
  cross join generate_series(0, v_versions_per_chat - 1) as version_index
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
  select
    p85_stage_4c_scale_uuid_from_parts(8, chat_index, version_index),
    v_tenant_id,
    p85_stage_4c_scale_uuid_from_parts(5, chat_index),
    p85_stage_4c_scale_uuid_from_parts(7, chat_index, version_index),
    p85_stage_4c_scale_uuid_from_parts(6, chat_index),
    p85_stage_4c_scale_uuid_from_parts(2, chat_index % v_dietitian_count),
    'scale-body-' || chat_index::text || '-' || version_index::text,
    p85_stage_4c_message_body_sha256('scale-body-' || chat_index::text || '-' || version_index::text),
    case
      when version_index = 0 then null
      else p85_stage_4c_scale_uuid_from_parts(8, chat_index, version_index - 1)
    end,
    'active',
    v_now + ((chat_index * v_versions_per_chat + version_index) || ' milliseconds')::interval
  from generate_series(0, v_chat_count - 1) as chat_index
  cross join generate_series(0, v_versions_per_chat - 1) as version_index
  on conflict (id) do nothing;

  update ai_chat_conversations conversation
  set active_branch_id = p85_stage_4c_scale_uuid_from_parts(6, index),
      updated_at = v_now
  from generate_series(0, v_chat_count - 1) as index
  where conversation.tenant_id = v_tenant_id
    and conversation.id = p85_stage_4c_scale_uuid_from_parts(5, index);

  update ai_chat_branches branch
  set active_leaf_version_id = p85_stage_4c_scale_uuid_from_parts(8, index, v_versions_per_chat - 1),
      updated_at = v_now
  from generate_series(0, v_chat_count - 1) as index
  where branch.tenant_id = v_tenant_id
    and branch.id = p85_stage_4c_scale_uuid_from_parts(6, index);

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
    p85_stage_4c_scale_uuid_from_parts(5, 0),
    v_user_id,
    p85_stage_4c_scale_uuid_from_parts(8, 0, 0),
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
    p85_stage_4c_scale_uuid_from_parts(5, 0),
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
    'sampleConversationId', p85_stage_4c_scale_uuid_from_parts(5, 0),
    'sampleBranchId', p85_stage_4c_scale_uuid_from_parts(6, 0),
    'sampleRunId', v_sample_run_id,
    'sampleDietitianId', p85_stage_4c_scale_uuid_from_parts(3, 0),
    'sampleClientId', p85_stage_4c_scale_uuid_from_parts(4, 0)
  );
end;
$$;

revoke all on function p85_stage_4c_scale_uuid_from_parts(integer, integer, integer) from public, anon, authenticated;
revoke all on function p85_stage_4c_scale_fixture_seed_v1() from public, anon, authenticated;
revoke all on function p85_stage_4c_scale_fixture_cleanup_v1() from public, anon, authenticated;
grant execute on function p85_stage_4c_scale_uuid_from_parts(integer, integer, integer) to service_role;
grant execute on function p85_stage_4c_scale_fixture_seed_v1() to service_role;
grant execute on function p85_stage_4c_scale_fixture_cleanup_v1() to service_role;
