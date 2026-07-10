-- P85-IF-R3: service-role-only atomic AI activation with revision and risk-state guards.

create or replace function p85_if_r3_assert_expected_conversation_revisions(
  p_tenant_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  current_revision bigint;
begin
  for item in
    select key::uuid as conversation_id, value::bigint as expected_revision
    from jsonb_each_text(coalesce(p_payload->'expectedConversationRevisions', '{}'::jsonb))
  loop
    select revision
    into current_revision
    from conversations
    where tenant_id = p_tenant_id and id = item.conversation_id
    for update;

    if not found then
      raise exception 'conversation_not_found';
    end if;

    if current_revision <> item.expected_revision then
      raise exception 'reactivation_conflict_conversation_revision';
    end if;
  end loop;
end;
$$;

create or replace function p85_if_r3_activate_client_ai(
  p_tenant_id uuid,
  p_client_id uuid,
  p_dietitian_id uuid,
  p_requested_ai_mode text,
  p_expected_conversation_revision bigint,
  p_expected_client_context_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  client_row clients%rowtype;
  conversation_row conversations%rowtype;
  active_session_ids uuid[];
  handoff_id uuid;
  restored_mode text;
  now_value timestamptz := now();
begin
  if p_expected_conversation_revision is null then
    raise exception 'expected_conversation_revision_required';
  end if;
  if p_expected_client_context_revision is null then
    raise exception 'expected_client_context_revision_required';
  end if;

  select *
  into client_row
  from clients
  where tenant_id = p_tenant_id and id = p_client_id
  for update;

  if not found then
    raise exception 'client_not_found';
  end if;

  if client_row.context_revision <> p_expected_client_context_revision then
    raise exception 'reactivation_conflict_client_context_revision';
  end if;

  select *
  into conversation_row
  from conversations
  where tenant_id = p_tenant_id and client_id = p_client_id and status = 'active'
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'conversation_not_found';
  end if;

  if conversation_row.revision <> p_expected_conversation_revision then
    raise exception 'reactivation_conflict_conversation_revision';
  end if;

  select coalesce(array_agg(id order by opened_at), '{}'::uuid[])
  into active_session_ids
  from (
    select id, opened_at
    from human_control_sessions
    where tenant_id = p_tenant_id and client_id = p_client_id and status = 'active'
    for update
  ) locked_sessions;

  perform 1
  from handoff_cases
  where tenant_id = p_tenant_id
    and client_id = p_client_id
    and status in ('open', 'assigned')
  for update;

  if coalesce(client_row.red_risk_lock->>'status', 'none') = 'locked' then
    handoff_id := nullif(client_row.red_risk_lock->>'handoffId', '')::uuid;
    if handoff_id is null then
      raise exception 'red_risk_lock_not_active_for_handoff';
    end if;
  end if;

  restored_mode := case
    when p_requested_ai_mode = 'autopilot'
      and client_row.mandatory_safety_complete = true
      and coalesce((client_row.safety_checklist->>'goalReviewed')::boolean, false) = true
      and coalesce((client_row.safety_checklist->>'dietPlanReviewed')::boolean, false) = true
      and coalesce((client_row.safety_checklist->>'allergiesReviewed')::boolean, false) = true
      and coalesce((client_row.safety_checklist->>'restrictedFoodsReviewed')::boolean, false) = true
      and coalesce((client_row.safety_checklist->>'riskFlagsReviewed')::boolean, false) = true
      and coalesce((client_row.safety_checklist->>'channelPermissionVerified')::boolean, false) = true
      and coalesce((client_row.safety_checklist->>'adultStatusConfirmed')::boolean, false) = true
      then 'autopilot'
    else 'copilot'
  end;

  update clients
  set
    ai_status = 'active',
    ai_mode = restored_mode::client_ai_mode,
    human_takeover_locked = false,
    yellow_risk_hold = '{"status":"none"}'::jsonb,
    red_risk_lock = case
      when coalesce(red_risk_lock->>'status', 'none') = 'locked'
        then jsonb_build_object(
          'status', 'reactivated',
          'handoffId', red_risk_lock->>'handoffId',
          'reactivatedAt', now_value,
          'reactivationReason', 'direct_dietitian_reactivation_v1'
        )
      else red_risk_lock
    end,
    context_revision = context_revision + 1
  where tenant_id = p_tenant_id and id = p_client_id;

  update conversations
  set revision = revision + 1
  where tenant_id = p_tenant_id and id = conversation_row.id;

  if handoff_id is not null then
    update handoff_cases
    set status = 'resolved', resolved_at = coalesce(resolved_at, now_value)
    where tenant_id = p_tenant_id and id = handoff_id;
  end if;

  update handoff_cases
  set status = 'resolved', resolved_at = coalesce(resolved_at, now_value)
  where tenant_id = p_tenant_id
    and client_id = p_client_id
    and status in ('open', 'assigned')
    and (
      handoff_id is null
      or id = handoff_id
      or coalesce(client_row.yellow_risk_hold->>'status', 'none') = 'active'
    );

  update human_control_sessions
  set
    status = case when coalesce(client_row.red_risk_lock->>'status', 'none') = 'locked'
      or coalesce(client_row.yellow_risk_hold->>'status', 'none') = 'active'
      then 'resolved'
      else 'reactivated'
    end,
    resolved_at = now_value,
    reactivated_by_dietitian_id = p_dietitian_id,
    reactivation_reason_code = 'direct_dietitian_reactivation_v1',
    restored_ai_mode = restored_mode
  where tenant_id = p_tenant_id
    and client_id = p_client_id
    and status = 'active';

  insert into risk_activity_events (
    id, tenant_id, client_id, conversation_id, human_control_session_id,
    event_type, source_message_id, handoff_id, ai_decision_id, metadata, created_at
  )
  select
    gen_random_uuid(), p_tenant_id, p_client_id, conversation_row.id, session.id,
    'risk_resolved', session.latest_human_message_id, session.linked_handoff_id, null,
    jsonb_build_object('reasonCode', 'direct_dietitian_reactivation_v1'), now_value
  from human_control_sessions session
  where session.tenant_id = p_tenant_id
    and session.id = any(active_session_ids)
    and (
      coalesce(client_row.red_risk_lock->>'status', 'none') = 'locked'
      or coalesce(client_row.yellow_risk_hold->>'status', 'none') = 'active'
    );

  insert into risk_activity_events (
    id, tenant_id, client_id, conversation_id, human_control_session_id,
    event_type, source_message_id, handoff_id, ai_decision_id, metadata, created_at
  )
  select
    gen_random_uuid(), p_tenant_id, p_client_id, conversation_row.id, session.id,
    'ai_reactivated', session.latest_human_message_id, session.linked_handoff_id, null,
    jsonb_build_object(
      'reasonCode', 'direct_dietitian_reactivation_v1',
      'clinicalResolution',
      coalesce(client_row.red_risk_lock->>'status', 'none') = 'locked'
        or coalesce(client_row.yellow_risk_hold->>'status', 'none') = 'active'
    ),
    now_value
  from human_control_sessions session
  where session.tenant_id = p_tenant_id
    and session.id = any(active_session_ids);

  insert into client_ai_status_events (
    tenant_id, client_id, dietitian_id, previous_status, new_status, ai_mode,
    active_from, active_until, reason, created_at
  ) values (
    p_tenant_id, p_client_id, p_dietitian_id, client_row.ai_status, 'active',
    restored_mode::client_ai_mode, null, null, 'controlled_ai_activation_completed', now_value
  );

  insert into audit_events (
    id, tenant_id, actor_type, actor_id, event_type, entity_type, entity_id, metadata, created_at
  ) values (
    gen_random_uuid(), p_tenant_id, 'system', p_dietitian_id::text,
    'controlled_ai_activation_completed', 'client', p_client_id::text,
    jsonb_build_object(
      'reasonCode', 'direct_dietitian_reactivation_v1',
      'resolutionKind',
      case
        when coalesce(client_row.red_risk_lock->>'status', 'none') = 'locked' then 'red_lock_resolved'
        when coalesce(client_row.yellow_risk_hold->>'status', 'none') = 'active' then 'yellow_hold_resolved'
        when array_length(active_session_ids, 1) is not null then 'manual_resume'
        else 'simple_activation'
      end,
      'aiMode', restored_mode,
      'handoffId', handoff_id
    ),
    now_value
  );

  return jsonb_build_object(
    'ok', true,
    'operation', 'p85_if_r3_activate_client_ai',
    'clientId', p_client_id,
    'conversationId', conversation_row.id,
    'aiMode', restored_mode,
    'conversationRevision', p_expected_conversation_revision + 1,
    'clientContextRevision', p_expected_client_context_revision + 1
  );
end;
$$;

revoke all on function p85_if_r3_activate_client_ai(uuid, uuid, uuid, text, bigint, integer)
  from public, anon, authenticated;
grant execute on function p85_if_r3_activate_client_ai(uuid, uuid, uuid, text, bigint, integer)
  to service_role;

create or replace function commit_inbound_simulation(p_tenant_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform p85_if_r3_assert_expected_conversation_revisions(p_tenant_id, p_payload);
  perform p85_if_r1_upsert_messages(p_tenant_id, p_payload, false);
  perform manu_commit_state_delta(
    'inbound_simulation',
    p_tenant_id,
    p_payload
      - 'messages'
      - 'messageUpdates'
      - 'channelEvents'
      - 'channelMessageRevisions'
      - 'humanControlSessions'
      - 'riskActivityEvents'
      - 'notifications'
      - 'conversationUpdates'
      - 'expectedConversationRevisions'
  );
  perform p85_if_f_commit_conversation_revisions(p_tenant_id, p_payload);
  perform p85_if_r1_commit_inbound_records(p_tenant_id, p_payload);
  perform p85_if_r2_commit_inbound_notifications(p_tenant_id, p_payload);
  return jsonb_build_object('ok', true, 'operation', 'inbound_simulation');
end;
$$;

create or replace function commit_draft_review(p_tenant_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform p85_if_r3_assert_expected_conversation_revisions(p_tenant_id, p_payload);
  return manu_commit_state_delta('draft_review', p_tenant_id, p_payload - 'expectedConversationRevisions');
end;
$$;

revoke all on function p85_if_r3_assert_expected_conversation_revisions(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function p85_if_r3_assert_expected_conversation_revisions(uuid, jsonb)
  to service_role;
