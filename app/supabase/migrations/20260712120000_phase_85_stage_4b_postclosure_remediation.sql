-- Phase 85 Stage 4B post-closure remediation.
-- Keeps the original Stage 4B migration append-only while adding actor-aware,
-- bounded RPCs for the server-side service-role store path.

create table if not exists dietitian_form_schemas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  dietitian_id uuid not null,
  title text not null,
  language_code text not null default 'tr',
  version integer not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  fields jsonb not null default '[]'::jsonb,
  registry_version text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint dietitian_form_schemas_tenant_dietitian_fk
    foreign key (tenant_id, dietitian_id)
    references dietitians (tenant_id, id)
    on delete cascade,
  unique (tenant_id, id),
  unique (tenant_id, dietitian_id, version)
);

create table if not exists dietitian_form_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  dietitian_id uuid not null,
  schema_id uuid not null,
  schema_version integer not null,
  schema_snapshot jsonb not null,
  language_code text not null default 'tr',
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, dietitian_id, schema_id),
  constraint dietitian_form_responses_tenant_schema_fk
    foreign key (tenant_id, schema_id)
    references dietitian_form_schemas (tenant_id, id)
    on delete restrict,
  constraint dietitian_form_responses_tenant_dietitian_fk
    foreign key (tenant_id, dietitian_id)
    references dietitians (tenant_id, id)
    on delete cascade
);

create index if not exists dietitian_form_responses_tenant_dietitian_updated_idx
  on dietitian_form_responses (tenant_id, dietitian_id, updated_at desc);

alter table dietitian_form_schemas enable row level security;
alter table dietitian_form_responses enable row level security;

drop policy if exists "stage4b read dietitian form schemas" on dietitian_form_schemas;
create policy "stage4b read dietitian form schemas"
on dietitian_form_schemas for select
using (
  is_tenant_member(tenant_id)
  and (
    current_tenant_role(tenant_id) in ('owner', 'admin')
    or dietitian_id = current_dietitian_id(tenant_id)
  )
);

drop policy if exists "stage4b write dietitian form schemas" on dietitian_form_schemas;
create policy "stage4b write dietitian form schemas"
on dietitian_form_schemas for all
using (
  current_tenant_role(tenant_id) in ('owner', 'admin')
  or (
    current_tenant_role(tenant_id) = 'dietitian'
    and dietitian_id = current_dietitian_id(tenant_id)
  )
)
with check (
  current_tenant_role(tenant_id) in ('owner', 'admin')
  or (
    current_tenant_role(tenant_id) = 'dietitian'
    and dietitian_id = current_dietitian_id(tenant_id)
  )
);

drop policy if exists "stage4b read dietitian form responses" on dietitian_form_responses;
create policy "stage4b read dietitian form responses"
on dietitian_form_responses for select
using (
  is_tenant_member(tenant_id)
  and (
    current_tenant_role(tenant_id) in ('owner', 'admin')
    or dietitian_id = current_dietitian_id(tenant_id)
  )
);

drop policy if exists "stage4b write dietitian form responses" on dietitian_form_responses;
create policy "stage4b write dietitian form responses"
on dietitian_form_responses for all
using (
  current_tenant_role(tenant_id) in ('owner', 'admin')
  or (
    current_tenant_role(tenant_id) = 'dietitian'
    and dietitian_id = current_dietitian_id(tenant_id)
  )
)
with check (
  current_tenant_role(tenant_id) in ('owner', 'admin')
  or (
    current_tenant_role(tenant_id) = 'dietitian'
    and dietitian_id = current_dietitian_id(tenant_id)
  )
);

create or replace function p85_stage_4b_actor_context_valid(
  p_tenant_id uuid,
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
  select
    p_role in ('owner', 'admin', 'dietitian', 'assistant', 'auditor')
    and exists (
      select 1
      from tenant_memberships tm
      join dietitians d
        on d.tenant_id = tm.tenant_id
       and d.auth_user_id = tm.user_id
       and d.id = p_dietitian_id
      where tm.tenant_id = p_tenant_id
        and tm.role::text = p_role
        and tm.user_id = case
          when auth.role() = 'service_role' then p_user_id
          else auth.uid()
        end
    )
$$;

create or replace function p85_stage_4b_actor_can_read_client(
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
  select coalesce((
    select case
      when p_role in ('owner', 'admin') then true
      when p_role = 'auditor' then false
      when p_role = 'dietitian' then (
        c.dietitian_id = p_dietitian_id
        or exists (
          select 1
          from client_assignments ca
          where ca.tenant_id = p_tenant_id
            and ca.client_id = c.id
            and ca.dietitian_id = p_dietitian_id
        )
      )
      when p_role = 'assistant' then exists (
        select 1
        from client_assignments ca
        where ca.tenant_id = p_tenant_id
          and ca.client_id = c.id
          and ca.dietitian_id = p_dietitian_id
      )
      else false
    end
    from clients c
    where c.tenant_id = p_tenant_id
      and c.id = p_client_id
      and p85_stage_4b_actor_context_valid(p_tenant_id, p_user_id, p_dietitian_id, p_role)
  ), false)
$$;

create or replace function p85_stage_4b_visible_alert_candidates_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text
)
returns table (
  alert_id text,
  client_id uuid,
  conversation_id uuid,
  client_full_name text,
  severity text,
  started_at timestamptz,
  handoff_id uuid,
  source_message_id uuid,
  active_draft_message_id uuid,
  first_message_id text,
  reason_codes text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with visible_clients as (
    select
      c.id,
      c.tenant_id,
      c.full_name,
      c.created_at,
      c.red_risk_lock,
      c.yellow_risk_hold,
      conv.id as conversation_id
    from clients c
    left join lateral (
      select conversation.id
      from conversations conversation
      where conversation.tenant_id = c.tenant_id
        and conversation.client_id = c.id
        and conversation.status = 'active'
      order by conversation.created_at desc, conversation.id asc
      limit 1
    ) conv on true
    where c.tenant_id = p_tenant_id
      and c.lifecycle_status = 'active'
      and p85_stage_4b_actor_can_read_client(
        p_tenant_id, c.id, p_user_id, p_dietitian_id, p_role
      )
      and (
        c.red_risk_lock->>'status' = 'locked'
        or (
          c.yellow_risk_hold->>'status' = 'active'
          and c.red_risk_lock->>'status' <> 'locked'
        )
      )
  ),
  linked as (
    select
      vc.*,
      h.id as linked_handoff_id,
      h.client_id as linked_handoff_client_id,
      h.conversation_id as linked_handoff_conversation_id,
      h.triggering_message_id as linked_triggering_message_id,
      case
        when vc.red_risk_lock->>'status' = 'locked'
          then case
            when vc.red_risk_lock->>'lockedAt' ~* '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
              then (vc.red_risk_lock->>'lockedAt')::timestamptz
            else vc.created_at
          end
        else case
          when vc.yellow_risk_hold->>'startedAt' ~* '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
            then (vc.yellow_risk_hold->>'startedAt')::timestamptz
          else vc.created_at
        end
      end as candidate_started_at,
      case
        when vc.red_risk_lock->>'status' = 'locked' then 'red'
        else 'yellow'
      end as candidate_severity,
      case
        when vc.red_risk_lock->>'status' = 'locked'
          and h.id is not null
          and h.client_id = vc.id
          then 'red:' || h.id::text
        when vc.red_risk_lock->>'status' = 'locked'
          then 'red:unlinked:' || vc.id::text || ':' || replace(
            coalesce(nullif(vc.red_risk_lock->>'lockedAt', ''), vc.created_at::text),
            ':',
            ''
          )
        else 'yellow:' || vc.id::text || ':' || coalesce(
          nullif(vc.yellow_risk_hold->>'firstMessageId', ''),
          vc.id::text
        )
      end as candidate_alert_id
    from visible_clients vc
    left join handoff_cases h
      on h.tenant_id = vc.tenant_id
     and h.id = case
       when (vc.red_risk_lock->>'handoffId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         then (vc.red_risk_lock->>'handoffId')::uuid
       else null
     end
  ),
  joined as (
    select
      l.*,
      case
        when l.candidate_severity = 'red'
          and l.linked_handoff_id is not null
          and l.linked_handoff_client_id = l.id
          then l.linked_handoff_id
        else null
      end as safe_handoff_id,
      case
        when l.candidate_severity = 'red'
          and l.linked_handoff_id is not null
          and l.linked_handoff_client_id = l.id
          and l.linked_handoff_conversation_id = l.conversation_id
          then l.linked_handoff_conversation_id
        else l.conversation_id
      end as safe_conversation_id,
      case
        when l.candidate_severity = 'red'
          then l.linked_triggering_message_id
        else case
          when (l.yellow_risk_hold->>'latestMessageId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then (l.yellow_risk_hold->>'latestMessageId')::uuid
          when (l.yellow_risk_hold->>'firstMessageId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then (l.yellow_risk_hold->>'firstMessageId')::uuid
          else null
        end
      end as candidate_source_message_id,
      case
        when (l.yellow_risk_hold->>'activeDraftMessageId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (l.yellow_risk_hold->>'activeDraftMessageId')::uuid
        else null
      end as candidate_draft_id
    from linked l
  )
  select
    j.candidate_alert_id,
    j.id,
    j.safe_conversation_id,
    j.full_name,
    j.candidate_severity,
    j.candidate_started_at,
    j.safe_handoff_id,
    case
      when m.id is not null and m.conversation_id = j.safe_conversation_id then m.id
      else null
    end,
    case
      when j.candidate_severity = 'yellow'
        and draft.id is not null
        and draft.conversation_id = j.safe_conversation_id
        and draft.status = 'draft'
        then draft.id
      else null
    end,
    j.yellow_risk_hold->>'firstMessageId',
    case
      when j.candidate_severity = 'red'
        then array(select jsonb_array_elements_text(coalesce(j.red_risk_lock->'reasons', '[]'::jsonb)))
      else array(select jsonb_array_elements_text(coalesce(j.yellow_risk_hold->'reasons', '[]'::jsonb)))
    end
  from joined j
  left join messages m
    on m.tenant_id = j.tenant_id
   and m.id = j.candidate_source_message_id
   and m.conversation_id = j.safe_conversation_id
  left join messages draft
    on draft.tenant_id = j.tenant_id
   and draft.id = j.candidate_draft_id
   and draft.conversation_id = j.safe_conversation_id
$$;

create or replace function p85_stage_4b_list_alerts_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_severity text default null,
  p_query text default null,
  p_cursor_severity_rank integer default null,
  p_cursor_started_at timestamptz default null,
  p_cursor_id text default null,
  p_limit integer default 30
)
returns table (
  alert_id text,
  client_id uuid,
  conversation_id uuid,
  client_full_name text,
  severity text,
  started_at timestamptz,
  handoff_id uuid,
  source_message_id uuid,
  active_draft_message_id uuid,
  first_message_id text,
  reason_codes text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select a.*
    from p85_stage_4b_visible_alert_candidates_v2(
      p_tenant_id, p_user_id, p_dietitian_id, p_role
    ) a
    where (p_severity is null or p_severity = 'all' or a.severity = p_severity)
      and (p_query is null or p_query = '' or a.client_full_name ilike '%' || p_query || '%')
      and (
        p_cursor_id is null
        or (
          case when a.severity = 'red' then 0 else 1 end > coalesce(p_cursor_severity_rank, -1)
          or (
            case when a.severity = 'red' then 0 else 1 end = p_cursor_severity_rank
            and a.started_at < p_cursor_started_at
          )
          or (
            case when a.severity = 'red' then 0 else 1 end = p_cursor_severity_rank
            and a.started_at = p_cursor_started_at
            and a.alert_id > p_cursor_id
          )
        )
      )
  )
  select
    f.alert_id,
    f.client_id,
    f.conversation_id,
    f.client_full_name,
    f.severity,
    f.started_at,
    f.handoff_id,
    f.source_message_id,
    f.active_draft_message_id,
    f.first_message_id,
    f.reason_codes
  from filtered f
  order by case when f.severity = 'red' then 0 else 1 end, f.started_at desc, f.alert_id asc
  limit greatest(1, least(coalesce(p_limit, 30), 101))
$$;

create or replace function p85_stage_4b_count_alerts_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_severity text default null,
  p_query text default null
)
returns table (filtered_total bigint, all_count bigint, red_count bigint, yellow_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where p_severity is null or p_severity = 'all' or a.severity = p_severity),
    count(*),
    count(*) filter (where a.severity = 'red'),
    count(*) filter (where a.severity = 'yellow')
  from p85_stage_4b_visible_alert_candidates_v2(
    p_tenant_id, p_user_id, p_dietitian_id, p_role
  ) a
  where p_query is null or p_query = '' or a.client_full_name ilike '%' || p_query || '%'
$$;

create or replace function p85_stage_4b_notification_category_v2(p_kind text)
returns text
language sql
immutable
as $$
  select case
    when p_kind in ('structured_record_update_required', 'competing_authoritative_instructions') then 'records'
    when p_kind in ('unsupported_media_review', 'safe_reply_unavailable', 'draft_invalidated') then 'conversation_review'
    when p_kind in ('delivery_failed', 'communication_permission_closed') then 'channel_delivery'
    else 'ai_control'
  end
$$;

create or replace function p85_stage_4b_visible_notification_candidates_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text
)
returns table (
  id uuid,
  kind text,
  priority text,
  category text,
  client_id uuid,
  conversation_id uuid,
  message_id uuid,
  handoff_id uuid,
  client_full_name text,
  occurrence_count integer,
  last_occurred_at timestamptz,
  resolved_at timestamptz,
  read_at timestamptz,
  acknowledged_at timestamptz,
  lifecycle_state text,
  priority_rank integer,
  history_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    n.id,
    n.kind,
    n.priority,
    p85_stage_4b_notification_category_v2(n.kind),
    n.client_id,
    case when conv.id is not null then conv.id else null end,
    case when msg.id is not null then msg.id else null end,
    n.handoff_id,
    c.full_name,
    n.occurrence_count,
    n.last_occurred_at,
    n.resolved_at,
    nr.read_at,
    nr.acknowledged_at,
    case
      when n.priority = 'info' and nr.read_at is not null then 'history'
      when n.resolved_at is not null then 'history'
      else 'active'
    end,
    case n.priority
      when 'intervention_required' then 0
      when 'review_required' then 1
      else 2
    end,
    coalesce(n.resolved_at, nr.read_at, n.last_occurred_at)
  from notifications n
  left join clients c
    on c.tenant_id = n.tenant_id
   and c.id = n.client_id
  left join conversations conv
    on conv.tenant_id = n.tenant_id
   and conv.id = n.conversation_id
   and conv.client_id = n.client_id
  left join messages msg
    on msg.tenant_id = n.tenant_id
   and msg.id = n.message_id
   and msg.conversation_id = conv.id
  left join notification_receipts nr
    on nr.tenant_id = n.tenant_id
   and nr.notification_id = n.id
   and nr.dietitian_id = p_dietitian_id
  where n.tenant_id = p_tenant_id
    and n.kind <> 'legacy_handoff'
    and p85_stage_4b_actor_context_valid(p_tenant_id, p_user_id, p_dietitian_id, p_role)
    and (
      (n.client_id is null and p_role in ('owner', 'admin'))
      or p85_stage_4b_actor_can_read_client(
        p_tenant_id, n.client_id, p_user_id, p_dietitian_id, p_role
      )
    )
    and (n.client_id is null or c.lifecycle_status = 'active')
$$;

create or replace function p85_stage_4b_get_notification_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_notification_id uuid
)
returns table (
  id uuid,
  kind text,
  priority text,
  category text,
  client_id uuid,
  conversation_id uuid,
  message_id uuid,
  handoff_id uuid,
  client_full_name text,
  occurrence_count integer,
  last_occurred_at timestamptz,
  resolved_at timestamptz,
  read_at timestamptz,
  acknowledged_at timestamptz,
  lifecycle_state text,
  priority_rank integer,
  history_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select n.*
  from p85_stage_4b_visible_notification_candidates_v2(
    p_tenant_id, p_user_id, p_dietitian_id, p_role
  ) n
  where n.id = p_notification_id
$$;

create or replace function p85_stage_4b_list_notifications_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_status text default 'active',
  p_priority text default null,
  p_category text default null,
  p_query text default null,
  p_kind_filter text[] default null,
  p_cursor_mode text default null,
  p_cursor_priority_rank integer default null,
  p_cursor_last_occurred_at timestamptz default null,
  p_cursor_history_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 30
)
returns table (
  id uuid,
  kind text,
  priority text,
  category text,
  client_id uuid,
  conversation_id uuid,
  message_id uuid,
  handoff_id uuid,
  client_full_name text,
  occurrence_count integer,
  last_occurred_at timestamptz,
  resolved_at timestamptz,
  read_at timestamptz,
  acknowledged_at timestamptz,
  lifecycle_state text,
  priority_rank integer,
  history_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select n.*
    from p85_stage_4b_visible_notification_candidates_v2(
      p_tenant_id, p_user_id, p_dietitian_id, p_role
    ) n
    where (p_priority is null or n.priority = p_priority)
      and (p_category is null or n.category = p_category)
      and (
        p_query is null
        or p_query = ''
        or n.client_full_name ilike '%' || p_query || '%'
        or n.kind = any(coalesce(p_kind_filter, '{}'::text[]))
      )
      and (
        (p_status = 'active' and n.lifecycle_state = 'active')
        or (p_status = 'unread' and n.read_at is null)
        or (p_status = 'history' and n.lifecycle_state = 'history')
      )
      and (
        p_cursor_id is null
        or (
          p_status <> 'history'
          and (
            n.priority_rank > coalesce(p_cursor_priority_rank, -1)
            or (n.priority_rank = p_cursor_priority_rank and n.last_occurred_at < p_cursor_last_occurred_at)
            or (n.priority_rank = p_cursor_priority_rank and n.last_occurred_at = p_cursor_last_occurred_at and n.id > p_cursor_id)
          )
        )
        or (
          p_status = 'history'
          and (
            n.history_at < p_cursor_history_at
            or (n.history_at = p_cursor_history_at and n.id > p_cursor_id)
          )
        )
      )
  )
  select
    f.id,
    f.kind,
    f.priority,
    f.category,
    f.client_id,
    f.conversation_id,
    f.message_id,
    f.handoff_id,
    f.client_full_name,
    f.occurrence_count,
    f.last_occurred_at,
    f.resolved_at,
    f.read_at,
    f.acknowledged_at,
    f.lifecycle_state,
    f.priority_rank,
    f.history_at
  from filtered f
  order by
    case when p_status = 'history' then 0 else f.priority_rank end,
    case when p_status = 'history' then f.history_at else f.last_occurred_at end desc,
    f.id asc
  limit greatest(1, least(coalesce(p_limit, 30), 101))
$$;

create or replace function p85_stage_4b_count_notifications_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_status text default 'active',
  p_priority text default null,
  p_category text default null,
  p_query text default null,
  p_kind_filter text[] default null
)
returns table (active_count bigint, unread_count bigint, history_count bigint, intervention_required_count bigint, filtered_total bigint)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select n.*
    from p85_stage_4b_visible_notification_candidates_v2(
      p_tenant_id, p_user_id, p_dietitian_id, p_role
    ) n
    where (p_priority is null or n.priority = p_priority)
      and (p_category is null or n.category = p_category)
      and (
        p_query is null
        or p_query = ''
        or n.client_full_name ilike '%' || p_query || '%'
        or n.kind = any(coalesce(p_kind_filter, '{}'::text[]))
      )
  )
  select
    count(*) filter (where n.lifecycle_state = 'active'),
    count(*) filter (where n.read_at is null),
    count(*) filter (where n.lifecycle_state = 'history'),
    count(*) filter (where n.priority = 'intervention_required' and n.lifecycle_state = 'active'),
    count(*) filter (where
      (p_status = 'active' and n.lifecycle_state = 'active')
      or (p_status = 'unread' and n.read_at is null)
      or (p_status = 'history' and n.lifecycle_state = 'history')
    )
  from visible n
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
  on conflict (tenant_id, notification_id, dietitian_id) do update
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
  on conflict (tenant_id, notification_id, dietitian_id) do update
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

create or replace function p85_stage_4b_mark_all_notifications_read_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_count integer := 0;
begin
  if not p85_stage_4b_actor_context_valid(p_tenant_id, p_user_id, p_dietitian_id, p_role)
     or p_role in ('assistant', 'auditor') then
    raise exception 'notification_receipt_mutation_forbidden';
  end if;

  with unread as (
    select n.id
    from p85_stage_4b_visible_notification_candidates_v2(
      p_tenant_id, p_user_id, p_dietitian_id, p_role
    ) n
    where n.read_at is null
  ), inserted as (
    insert into notification_receipts (
      tenant_id, notification_id, dietitian_id, read_at, acknowledged_at, created_at, updated_at
    )
    select p_tenant_id, unread.id, p_dietitian_id, v_now, null, v_now, v_now
    from unread
    on conflict (tenant_id, notification_id, dietitian_id) do update
      set read_at = coalesce(notification_receipts.read_at, excluded.read_at), updated_at = v_now
    returning notification_id
  )
  select count(*) into v_count from inserted;

  return v_count;
end;
$$;

create or replace function p85_stage_4b_complete_unsupported_media_review_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_notification_id uuid
)
returns table (notification_id uuid, resolved_at timestamptz, read_at timestamptz, acknowledged_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification notifications%rowtype;
  v_receipt notification_receipts%rowtype;
  v_now timestamptz := now();
begin
  if not p85_stage_4b_actor_context_valid(p_tenant_id, p_user_id, p_dietitian_id, p_role)
     or p_role in ('assistant', 'auditor') then
    raise exception 'notification_receipt_mutation_forbidden';
  end if;

  select n.* into v_notification
  from notifications n
  where n.tenant_id = p_tenant_id
    and n.id = p_notification_id
  for update;

  if not found or v_notification.kind <> 'unsupported_media_review' or v_notification.resolved_at is not null then
    raise exception 'unsupported_media_review_not_completable';
  end if;

  if not exists (
    select 1 from p85_stage_4b_visible_notification_candidates_v2(
      p_tenant_id, p_user_id, p_dietitian_id, p_role
    ) n where n.id = p_notification_id
  ) then
    raise exception 'notification_not_found';
  end if;

  select nr.* into v_receipt
  from notification_receipts nr
  where nr.tenant_id = p_tenant_id
    and nr.notification_id = p_notification_id
    and nr.dietitian_id = p_dietitian_id
  for update;

  if not found or v_receipt.read_at is null or v_receipt.acknowledged_at is null then
    raise exception 'unsupported_media_review_requires_acknowledged_receipt';
  end if;

  update notifications
  set resolved_at = v_now,
      resolved_by_dietitian_id = p_dietitian_id
  where tenant_id = p_tenant_id
    and id = p_notification_id;

  insert into audit_events (
    tenant_id, actor_type, actor_id, event_type, entity_type, entity_id, metadata, created_at
  ) values (
    p_tenant_id,
    'dietitian',
    p_dietitian_id::text,
    'unsupported_media_review_completed',
    'notification',
    p_notification_id::text,
    jsonb_build_object('notificationKind', 'unsupported_media_review'),
    v_now
  );

  return query
  select n.id, n.resolved_at, nr.read_at, nr.acknowledged_at
  from notifications n
  join notification_receipts nr
    on nr.tenant_id = n.tenant_id
   and nr.notification_id = n.id
   and nr.dietitian_id = p_dietitian_id
  where n.tenant_id = p_tenant_id
    and n.id = p_notification_id;
end;
$$;

revoke execute on function p85_stage_4b_actor_context_valid(uuid, uuid, uuid, text) from public;
revoke execute on function p85_stage_4b_actor_can_read_client(uuid, uuid, uuid, uuid, text) from public;
revoke execute on function p85_stage_4b_visible_alert_candidates_v2(uuid, uuid, uuid, text) from public;
revoke execute on function p85_stage_4b_list_alerts_v2(uuid, uuid, uuid, text, text, text, integer, timestamptz, text, integer) from public;
revoke execute on function p85_stage_4b_count_alerts_v2(uuid, uuid, uuid, text, text, text) from public;
revoke execute on function p85_stage_4b_visible_notification_candidates_v2(uuid, uuid, uuid, text) from public;
revoke execute on function p85_stage_4b_get_notification_v2(uuid, uuid, uuid, text, uuid) from public;
revoke execute on function p85_stage_4b_list_notifications_v2(uuid, uuid, uuid, text, text, text, text, text, text[], text, integer, timestamptz, timestamptz, uuid, integer) from public;
revoke execute on function p85_stage_4b_count_notifications_v2(uuid, uuid, uuid, text, text, text, text, text, text[]) from public;
revoke execute on function p85_stage_4b_mark_notification_read_v2(uuid, uuid, uuid, text, uuid) from public;
revoke execute on function p85_stage_4b_acknowledge_notification_v2(uuid, uuid, uuid, text, uuid) from public;
revoke execute on function p85_stage_4b_mark_all_notifications_read_v2(uuid, uuid, uuid, text) from public;
revoke execute on function p85_stage_4b_complete_unsupported_media_review_v2(uuid, uuid, uuid, text, uuid) from public;

grant execute on function p85_stage_4b_visible_alert_candidates_v2(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function p85_stage_4b_list_alerts_v2(uuid, uuid, uuid, text, text, text, integer, timestamptz, text, integer) to authenticated, service_role;
grant execute on function p85_stage_4b_count_alerts_v2(uuid, uuid, uuid, text, text, text) to authenticated, service_role;
grant execute on function p85_stage_4b_visible_notification_candidates_v2(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function p85_stage_4b_get_notification_v2(uuid, uuid, uuid, text, uuid) to authenticated, service_role;
grant execute on function p85_stage_4b_list_notifications_v2(uuid, uuid, uuid, text, text, text, text, text, text[], text, integer, timestamptz, timestamptz, uuid, integer) to authenticated, service_role;
grant execute on function p85_stage_4b_count_notifications_v2(uuid, uuid, uuid, text, text, text, text, text, text[]) to authenticated, service_role;
grant execute on function p85_stage_4b_mark_notification_read_v2(uuid, uuid, uuid, text, uuid) to authenticated, service_role;
grant execute on function p85_stage_4b_acknowledge_notification_v2(uuid, uuid, uuid, text, uuid) to authenticated, service_role;
grant execute on function p85_stage_4b_mark_all_notifications_read_v2(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function p85_stage_4b_complete_unsupported_media_review_v2(uuid, uuid, uuid, text, uuid) to authenticated, service_role;
