-- Phase 85 Stage 4B Phase 2: notification persistence, receipts, and RLS.

alter table notifications
  add column if not exists kind text,
  add column if not exists priority text,
  add column if not exists client_id uuid,
  add column if not exists conversation_id uuid,
  add column if not exists message_id uuid,
  add column if not exists handoff_id uuid,
  add column if not exists occurrence_count integer default 1,
  add column if not exists last_occurred_at timestamptz;

update notifications n
set
  kind = case
    when n.dedupe_key like 'p85-if-e:structured:%' then 'structured_record_update_required'
    when n.type in ('handoff_urgent', 'handoff_standard') or n.entity_type = 'handoff_case' then 'legacy_handoff'
    else 'legacy_system'
  end,
  priority = case
    when n.dedupe_key like 'p85-if-e:structured:%' then 'review_required'
    when n.type in ('handoff_urgent', 'handoff_standard') or n.entity_type = 'handoff_case' then 'review_required'
    else 'review_required'
  end,
  client_id = coalesce(
    n.client_id,
    case
      when n.entity_type = 'client' and n.entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then n.entity_id::uuid
      else null
    end,
    h.client_id,
    c.client_id
  ),
  conversation_id = coalesce(
    n.conversation_id,
    h.conversation_id,
    m.conversation_id
  ),
  message_id = coalesce(n.message_id, n.source_message_id, h.triggering_message_id),
  handoff_id = coalesce(
    n.handoff_id,
    case
      when n.entity_type = 'handoff_case' and n.entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then n.entity_id::uuid
      else null
    end,
    h.id
  ),
  occurrence_count = coalesce(n.occurrence_count, 1),
  last_occurred_at = coalesce(n.last_occurred_at, n.created_at, now())
from notifications base
left join handoff_cases h
  on h.tenant_id = base.tenant_id
 and (
   (base.entity_type = 'handoff_case' and h.id::text = base.entity_id)
   or h.id = base.handoff_id
 )
left join messages m
  on m.tenant_id = base.tenant_id
 and m.id = coalesce(base.message_id, base.source_message_id)
left join conversations c
  on c.tenant_id = base.tenant_id
 and c.id = coalesce(base.conversation_id, m.conversation_id, h.conversation_id)
where n.id = base.id;

alter table notifications
  alter column kind set not null,
  alter column priority set not null,
  alter column occurrence_count set not null,
  alter column last_occurred_at set not null;

alter table notifications
  drop constraint if exists notifications_kind_check,
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
      'legacy_system',
      'legacy_handoff'
    )
  );

alter table notifications
  drop constraint if exists notifications_priority_check,
  add constraint notifications_priority_check check (
    priority in ('intervention_required', 'review_required', 'info')
  );

alter table notifications
  drop constraint if exists notifications_tenant_client_fk,
  add constraint notifications_tenant_client_fk
    foreign key (tenant_id, client_id) references clients (tenant_id, id),
  drop constraint if exists notifications_tenant_conversation_fk,
  add constraint notifications_tenant_conversation_fk
    foreign key (tenant_id, conversation_id) references conversations (tenant_id, id),
  drop constraint if exists notifications_tenant_message_fk,
  add constraint notifications_tenant_message_fk
    foreign key (tenant_id, message_id) references messages (tenant_id, id),
  drop constraint if exists notifications_tenant_handoff_fk,
  add constraint notifications_tenant_handoff_fk
    foreign key (tenant_id, handoff_id) references handoff_cases (tenant_id, id);

create index if not exists notifications_tenant_client_last_occurred_idx
  on notifications (tenant_id, client_id, last_occurred_at desc);

create index if not exists notifications_tenant_kind_last_occurred_idx
  on notifications (tenant_id, kind, last_occurred_at desc);

create table if not exists notification_receipts (
  tenant_id uuid not null references tenants(id) on delete cascade,
  notification_id uuid not null,
  dietitian_id uuid not null,
  read_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, notification_id, dietitian_id),
  constraint notification_receipts_tenant_notification_fk
    foreign key (tenant_id, notification_id) references notifications (tenant_id, id) on delete cascade,
  constraint notification_receipts_tenant_dietitian_fk
    foreign key (tenant_id, dietitian_id) references dietitians (tenant_id, id) on delete cascade
);

create index if not exists notification_receipts_tenant_dietitian_read_idx
  on notification_receipts (tenant_id, dietitian_id, read_at);

alter table notification_receipts enable row level security;

create or replace function p85_stage_4b_can_read_notification(p_tenant_id uuid, p_notification_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when current_tenant_role(p_tenant_id) in ('owner', 'admin') then true
      when current_tenant_role(p_tenant_id) = 'auditor' then false
      when n.client_id is null then false
      else can_read_client(n.client_id)
    end
    from notifications n
    where n.tenant_id = p_tenant_id
      and n.id = p_notification_id
  ), false)
$$;

create or replace function p85_stage_4b_list_notifications_v1(
  p_tenant_id uuid,
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  id uuid,
  tenant_id uuid,
  kind text,
  priority text,
  client_id uuid,
  conversation_id uuid,
  message_id uuid,
  handoff_id uuid,
  occurrence_count integer,
  last_occurred_at timestamptz,
  resolved_at timestamptz,
  read_at timestamptz,
  acknowledged_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    n.id,
    n.tenant_id,
    n.kind,
    n.priority,
    n.client_id,
    n.conversation_id,
    n.message_id,
    n.handoff_id,
    n.occurrence_count,
    n.last_occurred_at,
    n.resolved_at,
    nr.read_at,
    nr.acknowledged_at
  from notifications n
  left join notification_receipts nr
    on nr.tenant_id = n.tenant_id
   and nr.notification_id = n.id
   and nr.dietitian_id = current_dietitian_id(p_tenant_id)
  where n.tenant_id = p_tenant_id
    and is_tenant_member(p_tenant_id)
    and p85_stage_4b_can_read_notification(p_tenant_id, n.id)
  order by
    case n.priority
      when 'intervention_required' then 0
      when 'review_required' then 1
      else 2
    end,
    n.last_occurred_at desc,
    n.id asc
  limit greatest(1, least(coalesce(p_limit, 30), 100))
  offset greatest(coalesce(p_offset, 0), 0)
$$;

create or replace function p85_stage_4b_list_alerts_v1(p_tenant_id uuid)
returns table (
  client_id uuid,
  conversation_id uuid,
  severity text,
  started_at timestamptz,
  handoff_id uuid,
  first_message_id text,
  source_message_id uuid,
  active_draft_message_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as client_id,
    conv.id as conversation_id,
    case
      when coalesce(c.red_risk_lock->>'status', 'none') = 'locked' then 'red'
      else 'yellow'
    end as severity,
    case
      when coalesce(c.red_risk_lock->>'status', 'none') = 'locked'
        then nullif(c.red_risk_lock->>'lockedAt', '')::timestamptz
      else nullif(c.yellow_risk_hold->>'startedAt', '')::timestamptz
    end as started_at,
    case
      when coalesce(c.red_risk_lock->>'status', 'none') = 'locked'
        then nullif(c.red_risk_lock->>'handoffId', '')::uuid
      else null
    end as handoff_id,
    c.yellow_risk_hold->>'firstMessageId' as first_message_id,
    null::uuid as source_message_id,
    nullif(c.yellow_risk_hold->>'activeDraftMessageId', '')::uuid as active_draft_message_id
  from clients c
  left join conversations conv
    on conv.tenant_id = c.tenant_id
   and conv.client_id = c.id
  where c.tenant_id = p_tenant_id
    and c.lifecycle_status = 'active'
    and is_tenant_member(p_tenant_id)
    and current_tenant_role(p_tenant_id) <> 'auditor'
    and can_read_client(c.id)
    and (
      coalesce(c.red_risk_lock->>'status', 'none') = 'locked'
      or (
        coalesce(c.yellow_risk_hold->>'status', 'none') = 'active'
        and coalesce(c.red_risk_lock->>'status', 'none') <> 'locked'
      )
    )
  order by
    case when coalesce(c.red_risk_lock->>'status', 'none') = 'locked' then 0 else 1 end,
    case
      when coalesce(c.red_risk_lock->>'status', 'none') = 'locked'
        then nullif(c.red_risk_lock->>'lockedAt', '')::timestamptz
      else nullif(c.yellow_risk_hold->>'startedAt', '')::timestamptz
    end desc,
    c.id asc
$$;

create or replace function p85_stage_4b_mark_notification_read_v1(
  p_tenant_id uuid,
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dietitian_id uuid;
begin
  if not is_tenant_member(p_tenant_id) then
    raise exception 'notification_not_found';
  end if;

  if current_tenant_role(p_tenant_id) in ('assistant', 'auditor') then
    raise exception 'notification_receipt_mutation_forbidden';
  end if;

  v_dietitian_id := current_dietitian_id(p_tenant_id);
  if v_dietitian_id is null then
    raise exception 'notification_not_found';
  end if;

  if not p85_stage_4b_can_read_notification(p_tenant_id, p_notification_id) then
    raise exception 'notification_not_found';
  end if;

  insert into notification_receipts (
    tenant_id, notification_id, dietitian_id, read_at, acknowledged_at, created_at, updated_at
  ) values (
    p_tenant_id, p_notification_id, v_dietitian_id, now(), null, now(), now()
  )
  on conflict (tenant_id, notification_id, dietitian_id) do update
    set read_at = coalesce(notification_receipts.read_at, excluded.read_at),
        updated_at = now();
end;
$$;

create or replace function p85_stage_4b_acknowledge_notification_v1(
  p_tenant_id uuid,
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dietitian_id uuid;
begin
  if not is_tenant_member(p_tenant_id) then
    raise exception 'notification_not_found';
  end if;

  if current_tenant_role(p_tenant_id) in ('assistant', 'auditor') then
    raise exception 'notification_receipt_mutation_forbidden';
  end if;

  v_dietitian_id := current_dietitian_id(p_tenant_id);
  if v_dietitian_id is null then
    raise exception 'notification_not_found';
  end if;

  if not p85_stage_4b_can_read_notification(p_tenant_id, p_notification_id) then
    raise exception 'notification_not_found';
  end if;

  insert into notification_receipts (
    tenant_id, notification_id, dietitian_id, read_at, acknowledged_at, created_at, updated_at
  ) values (
    p_tenant_id, p_notification_id, v_dietitian_id, now(), now(), now(), now()
  )
  on conflict (tenant_id, notification_id, dietitian_id) do update
    set read_at = coalesce(notification_receipts.read_at, excluded.read_at),
        acknowledged_at = coalesce(notification_receipts.acknowledged_at, excluded.acknowledged_at),
        updated_at = now();
end;
$$;

create or replace function p85_stage_4b_mark_all_notifications_read_v1(p_tenant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dietitian_id uuid;
  v_count integer := 0;
  v_notification_id uuid;
begin
  if not is_tenant_member(p_tenant_id) then
    raise exception 'notification_receipt_mutation_forbidden';
  end if;

  if current_tenant_role(p_tenant_id) in ('assistant', 'auditor') then
    raise exception 'notification_receipt_mutation_forbidden';
  end if;

  v_dietitian_id := current_dietitian_id(p_tenant_id);
  if v_dietitian_id is null then
    return 0;
  end if;

  for v_notification_id in
    select n.id
    from notifications n
    left join notification_receipts nr
      on nr.tenant_id = n.tenant_id
     and nr.notification_id = n.id
     and nr.dietitian_id = v_dietitian_id
    where n.tenant_id = p_tenant_id
      and p85_stage_4b_can_read_notification(p_tenant_id, n.id)
      and nr.read_at is null
  loop
    perform p85_stage_4b_mark_notification_read_v1(p_tenant_id, v_notification_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

drop policy if exists "tenant scoped crud notifications" on notifications;

create policy "stage4b read notifications"
on notifications for select
using (
  is_tenant_member(tenant_id)
  and p85_stage_4b_can_read_notification(tenant_id, id)
);

drop policy if exists "stage4b read notification receipts" on notification_receipts;
drop policy if exists "stage4b insert own notification receipts" on notification_receipts;
drop policy if exists "stage4b update own notification receipts" on notification_receipts;

create policy "stage4b read notification receipts"
on notification_receipts for select
using (
  is_tenant_member(tenant_id)
  and (
    current_tenant_role(tenant_id) in ('owner', 'admin')
    or dietitian_id = current_dietitian_id(tenant_id)
  )
);

create or replace function p85_if_r2_commit_inbound_notifications(p_tenant_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_kind text;
  v_priority text;
begin
  for item in select * from jsonb_array_elements(coalesce(p_payload->'notifications', '[]'::jsonb)) loop
    v_kind := coalesce(
      nullif(item->>'kind', ''),
      case
        when nullif(item->>'dedupeKey', '') like 'p85-if-e:structured:%' then 'structured_record_update_required'
        when item->>'type' in ('handoff_urgent', 'handoff_standard') or item->>'entityType' = 'handoff_case' then 'legacy_handoff'
        else 'legacy_system'
      end
    );
    v_priority := coalesce(
      nullif(item->>'priority', ''),
      case v_kind
        when 'structured_record_update_required' then 'review_required'
        when 'ai_window_expired' then 'info'
        else 'review_required'
      end
    );

    if nullif(item->>'dedupeKey', '') is null then
      insert into notifications (
        id, tenant_id, type, entity_type, entity_id, title, body, read, acknowledged_at,
        dedupe_key, source_message_id, target_panel, baseline_revision,
        resolved_at, resolved_by_dietitian_id, created_at,
        kind, priority, client_id, conversation_id, message_id, handoff_id,
        occurrence_count, last_occurred_at
      ) values (
        (item->>'id')::uuid, p_tenant_id, item->>'type', item->>'entityType', item->>'entityId',
        item->>'title', item->>'body', coalesce((item->>'read')::boolean, false),
        nullif(item->>'acknowledgedAt', '')::timestamptz, nullif(item->>'dedupeKey', ''),
        nullif(item->>'sourceMessageId', '')::uuid, nullif(item->>'targetPanel', ''),
        nullif(item->>'baselineRevision', '')::integer, nullif(item->>'resolvedAt', '')::timestamptz,
        nullif(item->>'resolvedByDietitianId', '')::uuid,
        coalesce(nullif(item->>'createdAt', '')::timestamptz, now()),
        v_kind, v_priority,
        nullif(item->>'clientId', '')::uuid,
        nullif(item->>'conversationId', '')::uuid,
        nullif(item->>'messageId', '')::uuid,
        nullif(item->>'handoffId', '')::uuid,
        coalesce(nullif(item->>'occurrenceCount', '')::integer, 1),
        coalesce(nullif(item->>'lastOccurredAt', '')::timestamptz, nullif(item->>'createdAt', '')::timestamptz, now())
      ) on conflict (id) do update set
        read = excluded.read,
        acknowledged_at = excluded.acknowledged_at,
        source_message_id = excluded.source_message_id,
        target_panel = excluded.target_panel,
        baseline_revision = excluded.baseline_revision,
        resolved_at = excluded.resolved_at,
        resolved_by_dietitian_id = excluded.resolved_by_dietitian_id,
        kind = excluded.kind,
        priority = excluded.priority,
        client_id = excluded.client_id,
        conversation_id = excluded.conversation_id,
        message_id = excluded.message_id,
        handoff_id = excluded.handoff_id,
        occurrence_count = excluded.occurrence_count,
        last_occurred_at = excluded.last_occurred_at;
    else
      insert into notifications (
        id, tenant_id, type, entity_type, entity_id, title, body, read, acknowledged_at,
        dedupe_key, source_message_id, target_panel, baseline_revision,
        resolved_at, resolved_by_dietitian_id, created_at,
        kind, priority, client_id, conversation_id, message_id, handoff_id,
        occurrence_count, last_occurred_at
      ) values (
        (item->>'id')::uuid, p_tenant_id, item->>'type', item->>'entityType', item->>'entityId',
        item->>'title', item->>'body', coalesce((item->>'read')::boolean, false),
        nullif(item->>'acknowledgedAt', '')::timestamptz, nullif(item->>'dedupeKey', ''),
        nullif(item->>'sourceMessageId', '')::uuid, nullif(item->>'targetPanel', ''),
        nullif(item->>'baselineRevision', '')::integer, nullif(item->>'resolvedAt', '')::timestamptz,
        nullif(item->>'resolvedByDietitianId', '')::uuid,
        coalesce(nullif(item->>'createdAt', '')::timestamptz, now()),
        v_kind, v_priority,
        nullif(item->>'clientId', '')::uuid,
        nullif(item->>'conversationId', '')::uuid,
        nullif(item->>'messageId', '')::uuid,
        nullif(item->>'handoffId', '')::uuid,
        coalesce(nullif(item->>'occurrenceCount', '')::integer, 1),
        coalesce(nullif(item->>'lastOccurredAt', '')::timestamptz, nullif(item->>'createdAt', '')::timestamptz, now())
      ) on conflict (tenant_id, dedupe_key) where dedupe_key is not null and resolved_at is null do update set
        read = excluded.read,
        acknowledged_at = excluded.acknowledged_at,
        source_message_id = excluded.source_message_id,
        target_panel = excluded.target_panel,
        baseline_revision = excluded.baseline_revision,
        resolved_at = excluded.resolved_at,
        resolved_by_dietitian_id = excluded.resolved_by_dietitian_id,
        kind = excluded.kind,
        priority = excluded.priority,
        client_id = excluded.client_id,
        conversation_id = excluded.conversation_id,
        message_id = excluded.message_id,
        handoff_id = excluded.handoff_id,
        occurrence_count = notifications.occurrence_count + 1,
        last_occurred_at = excluded.last_occurred_at;
    end if;
  end loop;
end;
$$;

grant execute on function p85_stage_4b_list_notifications_v1(uuid, integer, integer) to authenticated;
grant execute on function p85_stage_4b_list_alerts_v1(uuid) to authenticated;
grant execute on function p85_stage_4b_mark_notification_read_v1(uuid, uuid) to authenticated;
grant execute on function p85_stage_4b_acknowledge_notification_v1(uuid, uuid) to authenticated;
grant execute on function p85_stage_4b_mark_all_notifications_read_v1(uuid) to authenticated;
