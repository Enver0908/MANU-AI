-- Stage 4B-2 remediation R3: server-authorized mutation boundary.
-- Idempotency reservation, authorization, revision checks, domain writes, and
-- bounded response persistence execute in one transaction.

create or replace function p85_stage_4b2_actor_can_mutate_conversation(
  p_tenant_id uuid,
  p_conversation_id uuid,
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
  select coalesce((
    select case
      when p_role in ('owner', 'admin') then true
      when p_role = 'dietitian' then (
        c.dietitian_id = p_dietitian_id
        or exists (
          select 1
          from client_assignments ca
          where ca.tenant_id = p_tenant_id
            and ca.client_id = c.client_id
            and ca.dietitian_id = p_dietitian_id
            and ca.access_level = 'care_team'
        )
      )
      else false
    end
    from conversations c
    join clients cl
      on cl.tenant_id = c.tenant_id
     and cl.id = c.client_id
    where c.tenant_id = p_tenant_id
      and c.id = p_conversation_id
      and cl.lifecycle_status = 'active'
      and p85_stage_4b_actor_context_valid(
        p_tenant_id, p_user_id, p_dietitian_id, p_role
      )
  ), false)
$$;

create or replace function p85_stage_4b2_assert_mutation_payload_scope(
  p_tenant_id uuid,
  p_conversation_id uuid,
  p_client_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(p_payload->'expectedConversationRevisions') <> 'object'
     or jsonb_object_length(p_payload->'expectedConversationRevisions') <> 1
     or not (p_payload->'expectedConversationRevisions' ? p_conversation_id::text) then
    raise exception 'mutation_scope_violation';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_payload->'conversationUpdates', '[]'::jsonb)) item
    where item->>'id' <> p_conversation_id::text
  ) then
    raise exception 'mutation_scope_violation';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_payload->'clients', '[]'::jsonb)) item
    where item->>'id' <> p_client_id::text
  ) then
    raise exception 'mutation_scope_violation';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_payload->'messages', '[]'::jsonb)) item
    where item->>'conversationId' <> p_conversation_id::text
  ) then
    raise exception 'mutation_scope_violation';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_payload->'messageUpdates', '[]'::jsonb)) item
    where not exists (
      select 1
      from messages m
      where m.tenant_id = p_tenant_id
        and m.id = (item->>'id')::uuid
        and m.conversation_id = p_conversation_id
    )
  ) then
    raise exception 'mutation_scope_violation';
  end if;
end;
$$;

create or replace function p85_stage_4b2_commit_conversation_mutation_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_request_id uuid,
  p_operation text,
  p_action text,
  p_conversation_id uuid,
  p_message_id uuid,
  p_payload jsonb,
  p_response_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cached_response jsonb;
  v_existing_operation text;
  v_existing_conversation_id uuid;
  v_client_id uuid;
  v_red_lock_status text;
begin
  if p_operation not in ('manual_reply', 'draft_review') then
    raise exception 'mutation_operation_invalid';
  end if;
  if p_operation = 'manual_reply' and p_action <> 'manual_reply' then
    raise exception 'mutation_operation_invalid';
  end if;
  if p_operation = 'draft_review'
     and p_action not in ('approve', 'edit_send', 'dismiss', 'review_send_manual') then
    raise exception 'mutation_operation_invalid';
  end if;
  if p_request_id is null or p_response_json is null then
    raise exception 'mutation_request_invalid';
  end if;
  if p_operation = 'draft_review' and p_message_id is null then
    raise exception 'message_not_found';
  end if;

  -- Reserve and lock the request before any domain read or write. A failed
  -- transaction rolls this reservation back; a concurrent retry waits here
  -- and then receives the committed response.
  insert into conversation_mutation_idempotency (
    tenant_id,
    request_id,
    operation,
    conversation_id,
    response_json
  ) values (
    p_tenant_id,
    p_request_id,
    p_operation,
    p_conversation_id,
    jsonb_build_object('__pending', true)
  )
  on conflict (tenant_id, request_id) do nothing;

  select operation, conversation_id, response_json
    into v_existing_operation, v_existing_conversation_id, v_cached_response
  from conversation_mutation_idempotency
  where tenant_id = p_tenant_id
    and request_id = p_request_id
  for update;

  if v_existing_operation <> p_operation
     or v_existing_conversation_id <> p_conversation_id then
    raise exception 'idempotency_key_conflict';
  end if;
  if not (v_cached_response ? '__pending') then
    return v_cached_response;
  end if;

  -- Lock client first, matching the existing atomic AI activation lock order;
  -- the conversation revision helper locks the conversation second.
  select c.client_id, cl.red_risk_lock->>'status'
    into v_client_id, v_red_lock_status
  from conversations c
  join clients cl
    on cl.tenant_id = c.tenant_id
   and cl.id = c.client_id
  where c.tenant_id = p_tenant_id
    and c.id = p_conversation_id
    and cl.lifecycle_status = 'active'
  for update of cl;

  if not found then
    raise exception 'conversation_not_found';
  end if;
  if not p85_stage_4b2_actor_can_mutate_conversation(
    p_tenant_id, p_conversation_id, p_user_id, p_dietitian_id, p_role
  ) then
    raise exception 'conversation_mutation_forbidden';
  end if;
  perform p85_stage_4b2_assert_mutation_payload_scope(
    p_tenant_id, p_conversation_id, v_client_id, p_payload
  );

  if p_operation = 'draft_review' and p_action = 'review_send_manual'
     and coalesce(v_red_lock_status, 'none') = 'locked' then
    raise exception 'red_lock_superseded';
  end if;
  if p_operation = 'draft_review' then
    perform 1
    from messages m
    where m.tenant_id = p_tenant_id
      and m.id = p_message_id
      and m.conversation_id = p_conversation_id
    for update;
    if not found then
      raise exception 'message_not_found';
    end if;
  end if;

  if p_operation = 'manual_reply' then
    perform commit_manual_reply(p_tenant_id, p_payload);
  else
    perform commit_draft_review(p_tenant_id, p_payload);
  end if;

  update conversation_mutation_idempotency
  set response_json = p_response_json
  where tenant_id = p_tenant_id
    and request_id = p_request_id;

  return p_response_json;
end;
$$;

revoke all on function p85_stage_4b2_actor_can_mutate_conversation(uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function p85_stage_4b2_assert_mutation_payload_scope(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function p85_stage_4b2_commit_conversation_mutation_v2(uuid, uuid, uuid, text, uuid, text, text, uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;

grant execute on function p85_stage_4b2_commit_conversation_mutation_v2(uuid, uuid, uuid, text, uuid, text, text, uuid, uuid, jsonb, jsonb)
  to service_role;
