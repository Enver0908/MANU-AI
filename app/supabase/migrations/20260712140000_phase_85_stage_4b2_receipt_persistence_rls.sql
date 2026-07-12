-- Phase 85 Stage 4B-2 Phase 2: conversation read receipts, sequence backfill, and RLS.

-- Deterministic backfill for legacy null conversation_sequence rows.
with conversation_max as (
  select tenant_id, conversation_id, coalesce(max(conversation_sequence), 0) as max_seq
  from messages
  group by tenant_id, conversation_id
),
null_messages as (
  select
    m.id,
    m.tenant_id,
    m.conversation_id,
    row_number() over (
      partition by m.tenant_id, m.conversation_id
      order by
        coalesce(m.observed_at, m.persisted_at, m.created_at),
        m.created_at,
        m.id
    ) as offset_seq
  from messages m
  where m.conversation_sequence is null
)
update messages m
set conversation_sequence = cm.max_seq + nm.offset_seq
from null_messages nm
join conversation_max cm
  on cm.tenant_id = nm.tenant_id
 and cm.conversation_id = nm.conversation_id
where m.id = nm.id;

create table if not exists conversation_read_receipts (
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null,
  dietitian_id uuid not null,
  last_read_sequence bigint not null default 0,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, conversation_id, dietitian_id),
  constraint conversation_read_receipts_last_read_sequence_check check (last_read_sequence >= 0),
  constraint conversation_read_receipts_tenant_conversation_fk
    foreign key (tenant_id, conversation_id) references conversations (tenant_id, id) on delete cascade,
  constraint conversation_read_receipts_tenant_dietitian_fk
    foreign key (tenant_id, dietitian_id) references dietitians (tenant_id, id) on delete cascade
);

create index if not exists conversation_read_receipts_tenant_dietitian_idx
  on conversation_read_receipts (tenant_id, dietitian_id, updated_at desc);

create index if not exists conversation_read_receipts_tenant_conversation_idx
  on conversation_read_receipts (tenant_id, conversation_id, dietitian_id);

alter table conversation_read_receipts enable row level security;

create or replace function p85_stage_4b2_actor_can_read_conversation(
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
    select p85_stage_4b_actor_can_read_client(
      p_tenant_id,
      c.client_id,
      p_user_id,
      p_dietitian_id,
      p_role
    )
    from conversations c
    where c.tenant_id = p_tenant_id
      and c.id = p_conversation_id
  ), false)
$$;

create or replace function p85_stage_4b2_count_conversation_unread(
  p_tenant_id uuid,
  p_conversation_id uuid,
  p_last_read_sequence bigint
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from messages m
  where m.tenant_id = p_tenant_id
    and m.conversation_id = p_conversation_id
    and m.origin = 'client_inbound'
    and m.conversation_sequence is not null
    and m.conversation_sequence > coalesce(p_last_read_sequence, 0)
    and m.content_status not in ('revoked', 'redacted')
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
  v_effective_sequence bigint;
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
  on conflict (tenant_id, conversation_id, dietitian_id) do update
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

create or replace function p85_stage_4b2_delete_conversation_receipts_for_removed_clients(
  p_tenant_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
  for item in select * from jsonb_array_elements(coalesce(p_payload->'clients', '[]'::jsonb)) loop
    if coalesce(item->>'lifecycleStatus', '') = 'removed_anonymized' then
      delete from conversation_read_receipts cr
      using conversations c
      where c.tenant_id = p_tenant_id
        and c.client_id = (item->>'id')::uuid
        and cr.tenant_id = c.tenant_id
        and cr.conversation_id = c.id;
    end if;
  end loop;
end;
$$;

create or replace function commit_client_removal_lifecycle(p_tenant_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform manu_commit_state_delta(
    'client_removal_lifecycle',
    p_tenant_id,
    p_payload
      - 'channelMessageRevisions'
      - 'humanControlSessions'
      - 'riskActivityEvents'
      - 'contextIntakeProposalUpdates'
      - 'inboundQuarantineUpdates'
      - 'channelAccountBindingUpdates'
      - 'channelActorBindingUpdates'
  );
  perform p85_if_r6_commit_lifecycle_records(p_tenant_id, p_payload);
  perform p85_stage_4b2_delete_conversation_receipts_for_removed_clients(p_tenant_id, p_payload);
  return jsonb_build_object('ok', true, 'operation', 'client_removal_lifecycle');
end;
$$;

drop policy if exists "stage4b2 read conversation receipts" on conversation_read_receipts;

create policy "stage4b2 read conversation receipts"
on conversation_read_receipts for select
using (
  is_tenant_member(tenant_id)
  and current_tenant_role(tenant_id) <> 'auditor'
  and (
    current_tenant_role(tenant_id) in ('owner', 'admin')
    or dietitian_id = current_dietitian_id(tenant_id)
  )
  and exists (
    select 1
    from conversations c
    where c.tenant_id = conversation_read_receipts.tenant_id
      and c.id = conversation_read_receipts.conversation_id
      and can_read_client(c.client_id)
  )
);

revoke all on function p85_stage_4b2_actor_can_read_conversation(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4b2_count_conversation_unread(uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function p85_stage_4b2_mark_conversation_read_v1(uuid, uuid, uuid, text, uuid, bigint) from public;
revoke all on function p85_stage_4b2_delete_conversation_receipts_for_removed_clients(uuid, jsonb) from public, anon, authenticated;

grant execute on function p85_stage_4b2_mark_conversation_read_v1(uuid, uuid, uuid, text, uuid, bigint) to authenticated, service_role;
