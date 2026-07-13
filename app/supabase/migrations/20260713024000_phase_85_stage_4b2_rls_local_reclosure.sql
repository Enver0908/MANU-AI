-- Phase 85 Stage 4B-2 local RLS re-closure.
-- Removes legacy broad notification policies left by the pre-Stage-4B security remediation.

drop policy if exists "notifications scoped read" on notifications;
drop policy if exists "notifications scoped write" on notifications;

alter table messages
  alter column content_status set default 'available',
  alter column retrieval_eligibility set default 'eligible';

drop policy if exists "stage4b deny direct notification updates" on notifications;
create policy "stage4b deny direct notification updates"
on notifications for update
using (is_tenant_member(tenant_id))
with check (false);

create or replace function commit_client_context_update(p_tenant_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  v_result := manu_commit_state_delta('client_context_update', p_tenant_id, p_payload - 'notifications');
  perform p85_if_r2_commit_inbound_notifications(p_tenant_id, p_payload);
  return v_result;
end;
$$;

create or replace function commit_form_response(p_tenant_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  v_result := manu_commit_state_delta('form_response', p_tenant_id, p_payload - 'notifications');
  perform p85_if_r2_commit_inbound_notifications(p_tenant_id, p_payload);
  return v_result;
end;
$$;

create or replace function p85_stage_4b_mark_notification_read_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_notification_id uuid
)
returns table (notification_id uuid, read_at timestamptz, acknowledged_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if not p85_stage_4b_actor_context_valid(p_tenant_id, p_user_id, p_dietitian_id, p_role)
     or p_role in ('assistant', 'auditor')
     or not exists (
       select 1 from p85_stage_4b_visible_notification_candidates_v2(
         p_tenant_id, p_user_id, p_dietitian_id, p_role
       ) n where n.id = p_notification_id
     ) then
    raise exception 'notification_not_found';
  end if;

  insert into notification_receipts (
    tenant_id, notification_id, dietitian_id, read_at, acknowledged_at, created_at, updated_at
  ) values (p_tenant_id, p_notification_id, p_dietitian_id, v_now, null, v_now, v_now)
  on conflict on constraint notification_receipts_pkey do update
    set read_at = coalesce(notification_receipts.read_at, excluded.read_at),
        updated_at = v_now;

  return query
  select p_notification_id, nr.read_at, nr.acknowledged_at
  from notification_receipts nr
  where nr.tenant_id = p_tenant_id
    and nr.notification_id = p_notification_id
    and nr.dietitian_id = p_dietitian_id;
end;
$$;

create or replace function p85_stage_4b_acknowledge_notification_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_notification_id uuid
)
returns table (notification_id uuid, read_at timestamptz, acknowledged_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if not p85_stage_4b_actor_context_valid(p_tenant_id, p_user_id, p_dietitian_id, p_role)
     or p_role in ('assistant', 'auditor')
     or not exists (
       select 1 from p85_stage_4b_visible_notification_candidates_v2(
         p_tenant_id, p_user_id, p_dietitian_id, p_role
       ) n where n.id = p_notification_id
     ) then
    raise exception 'notification_not_found';
  end if;

  insert into notification_receipts (
    tenant_id, notification_id, dietitian_id, read_at, acknowledged_at, created_at, updated_at
  ) values (p_tenant_id, p_notification_id, p_dietitian_id, v_now, v_now, v_now, v_now)
  on conflict on constraint notification_receipts_pkey do update
    set read_at = coalesce(notification_receipts.read_at, excluded.read_at),
        acknowledged_at = coalesce(notification_receipts.acknowledged_at, excluded.acknowledged_at),
        updated_at = v_now;

  return query
  select p_notification_id, nr.read_at, nr.acknowledged_at
  from notification_receipts nr
  where nr.tenant_id = p_tenant_id
    and nr.notification_id = p_notification_id
    and nr.dietitian_id = p_dietitian_id;
end;
$$;

create or replace function p85_stage_4b2_mark_conversation_read_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_conversation_id uuid,
  p_through_sequence bigint
)
returns table (
  conversation_id uuid,
  dietitian_id uuid,
  actor_role text,
  last_read_sequence bigint,
  read_at timestamptz,
  unread_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_max_sequence bigint;
  v_last_read_sequence bigint;
begin
  if not p85_stage_4b_actor_context_valid(p_tenant_id, p_user_id, p_dietitian_id, p_role)
     or p_role = 'auditor'
     or not p85_stage_4b2_actor_can_read_conversation(
       p_tenant_id, p_conversation_id, p_user_id, p_dietitian_id, p_role
     ) then
    raise exception 'conversation_not_found';
  end if;

  if p_through_sequence is null or p_through_sequence < 1 then
    raise exception 'conversation_read_sequence_invalid';
  end if;

  select coalesce(max(m.conversation_sequence), 0)
    into v_max_sequence
  from messages m
  where m.tenant_id = p_tenant_id
    and m.conversation_id = p_conversation_id;

  if p_through_sequence > v_max_sequence then
    raise exception 'conversation_read_sequence_invalid';
  end if;

  insert into conversation_read_receipts (
    tenant_id,
    conversation_id,
    dietitian_id,
    last_read_sequence,
    read_at,
    created_at,
    updated_at
  ) values (
    p_tenant_id,
    p_conversation_id,
    p_dietitian_id,
    p_through_sequence,
    v_now,
    v_now,
    v_now
  )
  on conflict on constraint conversation_read_receipts_pkey do update
    set last_read_sequence = greatest(conversation_read_receipts.last_read_sequence, excluded.last_read_sequence),
        read_at = case
          when excluded.last_read_sequence > conversation_read_receipts.last_read_sequence then excluded.read_at
          else conversation_read_receipts.read_at
        end,
        updated_at = v_now
  returning conversation_read_receipts.last_read_sequence into v_last_read_sequence;

  return query
  select
    p_conversation_id,
    p_dietitian_id,
    p_role,
    v_last_read_sequence,
    cr.read_at,
    p85_stage_4b2_count_conversation_unread(p_tenant_id, p_conversation_id, v_last_read_sequence)
  from conversation_read_receipts cr
  where cr.tenant_id = p_tenant_id
    and cr.conversation_id = p_conversation_id
    and cr.dietitian_id = p_dietitian_id;
end;
$$;

revoke all on function commit_client_context_update(uuid, jsonb) from public, anon, authenticated;
revoke all on function commit_form_response(uuid, jsonb) from public, anon, authenticated;
revoke execute on function p85_stage_4b_mark_notification_read_v2(uuid, uuid, uuid, text, uuid) from public;
revoke execute on function p85_stage_4b_acknowledge_notification_v2(uuid, uuid, uuid, text, uuid) from public;
revoke all on function p85_stage_4b2_mark_conversation_read_v1(uuid, uuid, uuid, text, uuid, bigint) from public, anon;

grant execute on function commit_client_context_update(uuid, jsonb) to service_role;
grant execute on function commit_form_response(uuid, jsonb) to service_role;
grant execute on function p85_stage_4b_mark_notification_read_v2(uuid, uuid, uuid, text, uuid) to authenticated, service_role;
grant execute on function p85_stage_4b_acknowledge_notification_v2(uuid, uuid, uuid, text, uuid) to authenticated, service_role;
grant execute on function p85_stage_4b2_mark_conversation_read_v1(uuid, uuid, uuid, text, uuid, bigint) to authenticated, service_role;
