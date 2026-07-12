-- Phase 85 Stage 4B-2 Phase 4: actor-aware bounded messaging projection RPCs for read APIs.

create or replace function p85_stage_4b2_load_list_projection_source_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text
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
  if not p85_stage_4b_actor_context_valid(p_tenant_id, p_user_id, p_dietitian_id, p_role)
     or p_role = 'auditor' then
    raise exception 'conversation_read_forbidden';
  end if;

  select jsonb_build_object(
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tenant_id', ca.tenant_id,
        'client_id', ca.client_id,
        'dietitian_id', ca.dietitian_id,
        'access_level', ca.access_level
      ))
      from client_assignments ca
      where ca.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'tenant_id', c.tenant_id,
        'dietitian_id', c.dietitian_id,
        'lifecycle_status', c.lifecycle_status,
        'full_name', c.full_name,
        'ai_status', c.ai_status,
        'human_takeover_locked', c.human_takeover_locked,
        'red_risk_lock', c.red_risk_lock,
        'yellow_risk_hold', c.yellow_risk_hold
      ))
      from clients c
      where c.tenant_id = p_tenant_id
        and c.lifecycle_status = 'active'
        and p85_stage_4b_actor_can_read_client(
          p_tenant_id, c.id, p_user_id, p_dietitian_id, p_role
        )
    ), '[]'::jsonb),
    'conversations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cv.id,
        'tenant_id', cv.tenant_id,
        'dietitian_id', cv.dietitian_id,
        'client_id', cv.client_id,
        'channel', cv.channel,
        'revision', cv.revision
      ))
      from conversations cv
      join clients c
        on c.tenant_id = cv.tenant_id
       and c.id = cv.client_id
      where cv.tenant_id = p_tenant_id
        and c.lifecycle_status = 'active'
        and p85_stage_4b_actor_can_read_client(
          p_tenant_id, c.id, p_user_id, p_dietitian_id, p_role
        )
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'tenant_id', m.tenant_id,
        'conversation_id', m.conversation_id,
        'sender', m.sender,
        'body', m.body,
        'origin', m.origin,
        'source_message_id', m.source_message_id,
        'conversation_sequence', m.conversation_sequence,
        'content_status', m.content_status,
        'status', m.status,
        'created_at', m.created_at
      ))
      from messages m
      join conversations cv
        on cv.tenant_id = m.tenant_id
       and cv.id = m.conversation_id
      join clients c
        on c.tenant_id = cv.tenant_id
       and c.id = cv.client_id
      where m.tenant_id = p_tenant_id
        and c.lifecycle_status = 'active'
        and p85_stage_4b_actor_can_read_client(
          p_tenant_id, c.id, p_user_id, p_dietitian_id, p_role
        )
    ), '[]'::jsonb),
    'receipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tenant_id', cr.tenant_id,
        'conversation_id', cr.conversation_id,
        'dietitian_id', cr.dietitian_id,
        'actor_role', p_role,
        'last_read_sequence', cr.last_read_sequence,
        'read_at', cr.read_at,
        'created_at', cr.created_at,
        'updated_at', cr.updated_at
      ))
      from conversation_read_receipts cr
      join conversations cv
        on cv.tenant_id = cr.tenant_id
       and cv.id = cr.conversation_id
      join clients c
        on c.tenant_id = cv.tenant_id
       and c.id = cv.client_id
      where cr.tenant_id = p_tenant_id
        and cr.dietitian_id = p_dietitian_id
        and c.lifecycle_status = 'active'
        and p85_stage_4b_actor_can_read_client(
          p_tenant_id, c.id, p_user_id, p_dietitian_id, p_role
        )
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function p85_stage_4b2_load_detail_projection_source_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_conversation_id uuid
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
  if not p85_stage_4b_actor_context_valid(p_tenant_id, p_user_id, p_dietitian_id, p_role)
     or p_role = 'auditor' then
    raise exception 'conversation_read_forbidden';
  end if;

  if not p85_stage_4b2_actor_can_read_conversation(
    p_tenant_id, p_conversation_id, p_user_id, p_dietitian_id, p_role
  ) then
    raise exception 'conversation_not_found';
  end if;

  select jsonb_build_object(
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tenant_id', ca.tenant_id,
        'client_id', ca.client_id,
        'dietitian_id', ca.dietitian_id,
        'access_level', ca.access_level
      ))
      from client_assignments ca
      where ca.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'tenant_id', c.tenant_id,
        'dietitian_id', c.dietitian_id,
        'lifecycle_status', c.lifecycle_status,
        'full_name', c.full_name,
        'ai_status', c.ai_status,
        'human_takeover_locked', c.human_takeover_locked,
        'red_risk_lock', c.red_risk_lock,
        'yellow_risk_hold', c.yellow_risk_hold
      ))
      from clients c
      join conversations cv
        on cv.tenant_id = c.tenant_id
       and cv.client_id = c.id
      where cv.tenant_id = p_tenant_id
        and cv.id = p_conversation_id
        and c.lifecycle_status = 'active'
    ), '[]'::jsonb),
    'conversations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cv.id,
        'tenant_id', cv.tenant_id,
        'dietitian_id', cv.dietitian_id,
        'client_id', cv.client_id,
        'channel', cv.channel,
        'revision', cv.revision
      ))
      from conversations cv
      where cv.tenant_id = p_tenant_id
        and cv.id = p_conversation_id
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'tenant_id', m.tenant_id,
        'conversation_id', m.conversation_id,
        'sender', m.sender,
        'body', m.body,
        'origin', m.origin,
        'source_message_id', m.source_message_id,
        'conversation_sequence', m.conversation_sequence,
        'content_status', m.content_status,
        'status', m.status,
        'created_at', m.created_at
      ))
      from messages m
      where m.tenant_id = p_tenant_id
        and m.conversation_id = p_conversation_id
    ), '[]'::jsonb),
    'receipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tenant_id', cr.tenant_id,
        'conversation_id', cr.conversation_id,
        'dietitian_id', cr.dietitian_id,
        'actor_role', p_role,
        'last_read_sequence', cr.last_read_sequence,
        'read_at', cr.read_at,
        'created_at', cr.created_at,
        'updated_at', cr.updated_at
      ))
      from conversation_read_receipts cr
      where cr.tenant_id = p_tenant_id
        and cr.conversation_id = p_conversation_id
        and cr.dietitian_id = p_dietitian_id
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function p85_stage_4b2_load_list_projection_source_v1(uuid, uuid, uuid, text) from public;
revoke all on function p85_stage_4b2_load_detail_projection_source_v1(uuid, uuid, uuid, text, uuid) from public;

grant execute on function p85_stage_4b2_load_list_projection_source_v1(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function p85_stage_4b2_load_detail_projection_source_v1(uuid, uuid, uuid, text, uuid) to authenticated, service_role;
