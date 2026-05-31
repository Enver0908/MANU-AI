-- Phase 28: AI security remediation.
-- Provider audit invariants, tenant-aware idempotency, and scoped RBAC/RLS helpers.

alter table ai_decisions
  add column if not exists provider_attempted boolean not null default false;

update ai_decisions
set provider_attempted = (
  provider_status in ('ok', 'failed')
  or provider_id is not null
);

update ai_decisions
set provider_status = 'failed'
where provider_attempted = true
  and provider_status not in ('ok', 'failed');

update ai_decisions
set provider_status = 'not_called',
    provider_id = null,
    model = null,
    prompt_version = null
where provider_attempted = false;

alter table ai_decisions
  drop constraint if exists ai_decisions_provider_status_check;

alter table ai_decisions
  add constraint ai_decisions_provider_status_check
  check (
    (
      provider_attempted = false
      and provider_status = 'not_called'
      and provider_id is null
    )
    or (
      provider_attempted = true
      and provider_status in ('ok', 'failed')
    )
  );

alter table client_channels
  drop constraint if exists client_channels_channel_channel_user_id_key;

drop index if exists client_channels_channel_channel_user_id_key;

create unique index if not exists client_channels_tenant_channel_user_id_unique
  on client_channels (tenant_id, channel, channel_user_id);

alter table processed_inbound_events
  drop constraint if exists processed_inbound_events_channel_provider_event_id_key;

drop index if exists processed_inbound_events_channel_provider_event_id_key;

create unique index if not exists processed_inbound_events_tenant_channel_provider_event_unique
  on processed_inbound_events (tenant_id, channel, provider_event_id);

create or replace function current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from tenant_memberships
  where user_id = auth.uid()
  order by created_at asc
  limit 1
$$;

create or replace function current_tenant_role()
returns tenant_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from tenant_memberships
  where user_id = auth.uid()
    and tenant_id = current_tenant_id()
  order by created_at asc
  limit 1
$$;

create or replace function current_tenant_role(target_tenant_id uuid)
returns tenant_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from tenant_memberships
  where user_id = auth.uid()
    and tenant_id = target_tenant_id
  order by created_at asc
  limit 1
$$;

create or replace function current_dietitian_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from dietitians
  where auth_user_id = auth.uid()
  order by created_at asc
  limit 1
$$;

create or replace function current_dietitian_id(target_tenant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from dietitians
  where auth_user_id = auth.uid()
    and tenant_id = target_tenant_id
  order by created_at asc
  limit 1
$$;

create or replace function has_tenant_role(target_tenant_id uuid, allowed_roles tenant_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from tenant_memberships
    where tenant_id = target_tenant_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  )
$$;

create or replace function can_read_client(target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when current_tenant_role(c.tenant_id) in ('owner', 'admin') then true
      when current_tenant_role(c.tenant_id) = 'dietitian' then (
        c.dietitian_id = current_dietitian_id(c.tenant_id)
        or exists (
          select 1
          from client_assignments ca
          where ca.tenant_id = c.tenant_id
            and ca.client_id = c.id
            and ca.dietitian_id = current_dietitian_id(c.tenant_id)
        )
      )
      when current_tenant_role(c.tenant_id) = 'assistant' then exists (
        select 1
        from client_assignments ca
        where ca.tenant_id = c.tenant_id
          and ca.client_id = c.id
          and ca.dietitian_id = current_dietitian_id(c.tenant_id)
      )
      else false
    end
    from clients c
    where c.id = target_client_id
  ), false)
$$;

create or replace function can_write_client(target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when current_tenant_role(c.tenant_id) in ('owner', 'admin') then true
      when current_tenant_role(c.tenant_id) = 'dietitian' then (
        c.dietitian_id = current_dietitian_id(c.tenant_id)
        or exists (
          select 1
          from client_assignments ca
          where ca.tenant_id = c.tenant_id
            and ca.client_id = c.id
            and ca.dietitian_id = current_dietitian_id(c.tenant_id)
            and ca.access_level = 'care_team'
        )
      )
      else false
    end
    from clients c
    where c.id = target_client_id
  ), false)
$$;

create or replace function can_create_client(target_tenant_id uuid, target_dietitian_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from dietitians d
    where d.id = target_dietitian_id
      and d.tenant_id = target_tenant_id
  )
  and case
      when current_tenant_role(target_tenant_id) in ('owner', 'admin') then true
      when current_tenant_role(target_tenant_id) = 'dietitian' then target_dietitian_id = current_dietitian_id(target_tenant_id)
      else false
    end
$$;

create or replace function can_read_conversation(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select can_read_client(client_id)
    from conversations
    where id = target_conversation_id
  ), false)
$$;

create or replace function can_write_conversation(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select can_write_client(client_id)
    from conversations
    where id = target_conversation_id
  ), false)
$$;

create or replace function can_access_internal_copilot(target_tenant_id uuid, target_dietitian_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when current_tenant_role(target_tenant_id) in ('owner', 'admin') then true
    when current_tenant_role(target_tenant_id) = 'dietitian' then target_dietitian_id = current_dietitian_id(target_tenant_id)
    else false
  end
$$;

create or replace function dietitian_belongs_to_tenant(target_dietitian_id uuid, target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from dietitians d
    where d.id = target_dietitian_id
      and d.tenant_id = target_tenant_id
  )
$$;

drop policy if exists "tenant scoped crud clients" on clients;
drop policy if exists "tenant scoped crud client channels" on client_channels;
drop policy if exists "tenant scoped crud conversations" on conversations;
drop policy if exists "tenant scoped crud messages" on messages;
drop policy if exists "tenant scoped crud activation events" on client_ai_status_events;
drop policy if exists "tenant scoped crud memories" on conversation_memories;
drop policy if exists "tenant scoped crud risk assessments" on risk_assessments;
drop policy if exists "tenant scoped crud handoff cases" on handoff_cases;
drop policy if exists "tenant scoped crud ai decisions" on ai_decisions;
drop policy if exists "tenant scoped crud processed events" on processed_inbound_events;
drop policy if exists "tenant scoped crud notifications" on notifications;
drop policy if exists "tenant scoped crud client assignments" on client_assignments;
drop policy if exists "tenant scoped crud data requests" on data_requests;
drop policy if exists "tenant scoped select voice samples" on dietitian_voice_samples;
drop policy if exists "tenant scoped write voice samples" on dietitian_voice_samples;
drop policy if exists "tenant scoped select form schemas" on client_form_schemas;
drop policy if exists "tenant scoped write form schemas" on client_form_schemas;
drop policy if exists "tenant scoped select form responses" on client_form_responses;
drop policy if exists "tenant scoped write form responses" on client_form_responses;
drop policy if exists "tenant scoped select internal copilot messages" on internal_copilot_messages;
drop policy if exists "tenant scoped write internal copilot messages" on internal_copilot_messages;
drop policy if exists "tenant scoped select internal copilot tool calls" on internal_copilot_tool_calls;
drop policy if exists "tenant scoped write internal copilot tool calls" on internal_copilot_tool_calls;
drop policy if exists "tenant scoped select client context updates" on client_context_updates;
drop policy if exists "tenant scoped write client context updates" on client_context_updates;

create policy "clients scoped read"
on clients for select
using (can_read_client(id));

create policy "clients scoped insert"
on clients for insert
with check (can_create_client(tenant_id, dietitian_id));

create policy "clients scoped update"
on clients for update
using (can_write_client(id))
with check (can_write_client(id));

create policy "clients scoped delete"
on clients for delete
using (can_write_client(id));

create policy "client channels scoped read"
on client_channels for select
using (can_read_client(client_id));

create policy "client channels scoped insert"
on client_channels for insert
with check (can_write_client(client_id));

create policy "client channels scoped update"
on client_channels for update
using (can_write_client(client_id))
with check (can_write_client(client_id));

create policy "client channels scoped delete"
on client_channels for delete
using (can_write_client(client_id));

create policy "conversations scoped read"
on conversations for select
using (can_read_client(client_id));

create policy "conversations scoped insert"
on conversations for insert
with check (can_write_client(client_id));

create policy "conversations scoped update"
on conversations for update
using (can_write_client(client_id))
with check (can_write_client(client_id));

create policy "conversations scoped delete"
on conversations for delete
using (can_write_client(client_id));

create policy "messages scoped read"
on messages for select
using (can_read_conversation(conversation_id));

create policy "messages scoped insert"
on messages for insert
with check (can_write_conversation(conversation_id));

create policy "messages scoped update"
on messages for update
using (can_write_conversation(conversation_id))
with check (can_write_conversation(conversation_id));

create policy "messages scoped delete"
on messages for delete
using (can_write_conversation(conversation_id));

create policy "activation events scoped read"
on client_ai_status_events for select
using (can_read_client(client_id));

create policy "activation events scoped insert"
on client_ai_status_events for insert
with check (can_write_client(client_id));

create policy "activation events scoped update"
on client_ai_status_events for update
using (can_write_client(client_id))
with check (can_write_client(client_id));

create policy "activation events scoped delete"
on client_ai_status_events for delete
using (can_write_client(client_id));

create policy "memories scoped read"
on conversation_memories for select
using (can_read_client(client_id));

create policy "memories scoped insert"
on conversation_memories for insert
with check (can_write_client(client_id));

create policy "memories scoped update"
on conversation_memories for update
using (can_write_client(client_id))
with check (can_write_client(client_id));

create policy "memories scoped delete"
on conversation_memories for delete
using (can_write_client(client_id));

create policy "risk assessments scoped read"
on risk_assessments for select
using (can_read_conversation(conversation_id));

create policy "risk assessments scoped insert"
on risk_assessments for insert
with check (can_write_conversation(conversation_id));

create policy "risk assessments scoped update"
on risk_assessments for update
using (can_write_conversation(conversation_id))
with check (can_write_conversation(conversation_id));

create policy "risk assessments scoped delete"
on risk_assessments for delete
using (can_write_conversation(conversation_id));

create policy "handoff cases scoped read"
on handoff_cases for select
using (can_read_client(client_id));

create policy "handoff cases scoped insert"
on handoff_cases for insert
with check (can_write_client(client_id));

create policy "handoff cases scoped update"
on handoff_cases for update
using (can_write_client(client_id))
with check (can_write_client(client_id));

create policy "handoff cases scoped delete"
on handoff_cases for delete
using (can_write_client(client_id));

create policy "ai decisions scoped read"
on ai_decisions for select
using (can_read_client(client_id));

create policy "ai decisions scoped insert"
on ai_decisions for insert
with check (can_write_client(client_id));

create policy "ai decisions scoped update"
on ai_decisions for update
using (can_write_client(client_id))
with check (can_write_client(client_id));

create policy "ai decisions scoped delete"
on ai_decisions for delete
using (can_write_client(client_id));

create policy "processed events scoped read"
on processed_inbound_events for select
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));

create policy "processed events scoped write"
on processed_inbound_events for all
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]))
with check (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));

create policy "notifications scoped read"
on notifications for select
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian', 'assistant']::tenant_role[]));

create policy "notifications scoped write"
on notifications for all
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]))
with check (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));

create policy "client assignments scoped read"
on client_assignments for select
using (
  has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[])
  or dietitian_id = current_dietitian_id(tenant_id)
  or can_read_client(client_id)
);

create policy "client assignments scoped write"
on client_assignments for all
using (
  has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[])
  or (
    has_tenant_role(tenant_id, array['dietitian']::tenant_role[])
    and can_write_client(client_id)
  )
)
with check (
  (
    has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[])
    or (
      has_tenant_role(tenant_id, array['dietitian']::tenant_role[])
      and can_write_client(client_id)
    )
  )
  and dietitian_belongs_to_tenant(dietitian_id, tenant_id)
);

create policy "data requests scoped read"
on data_requests for select
using (can_read_client(client_id));

create policy "data requests scoped write"
on data_requests for all
using (can_write_client(client_id))
with check (can_write_client(client_id));

create policy "voice samples scoped read"
on dietitian_voice_samples for select
using (
  has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[])
  or (
    has_tenant_role(tenant_id, array['dietitian']::tenant_role[])
    and dietitian_id = current_dietitian_id(tenant_id)
  )
);

create policy "voice samples scoped write"
on dietitian_voice_samples for all
using (
  has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[])
  or (
    has_tenant_role(tenant_id, array['dietitian']::tenant_role[])
    and dietitian_id = current_dietitian_id(tenant_id)
  )
)
with check (
  has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[])
  or (
    has_tenant_role(tenant_id, array['dietitian']::tenant_role[])
    and dietitian_id = current_dietitian_id(tenant_id)
  )
);

create policy "form schemas scoped read"
on client_form_schemas for select
using (is_tenant_member(tenant_id));

create policy "form schemas scoped write"
on client_form_schemas for all
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]))
with check (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));

create policy "form responses scoped read"
on client_form_responses for select
using (can_read_client(client_id));

create policy "form responses scoped write"
on client_form_responses for all
using (can_write_client(client_id))
with check (can_write_client(client_id));

create policy "internal copilot messages scoped read"
on internal_copilot_messages for select
using (can_access_internal_copilot(tenant_id, dietitian_id));

create policy "internal copilot messages scoped write"
on internal_copilot_messages for all
using (can_access_internal_copilot(tenant_id, dietitian_id))
with check (can_access_internal_copilot(tenant_id, dietitian_id));

create policy "internal copilot tool calls scoped read"
on internal_copilot_tool_calls for select
using (can_access_internal_copilot(tenant_id, dietitian_id));

create policy "internal copilot tool calls scoped write"
on internal_copilot_tool_calls for all
using (can_access_internal_copilot(tenant_id, dietitian_id))
with check (can_access_internal_copilot(tenant_id, dietitian_id));

create policy "client context updates scoped read"
on client_context_updates for select
using (can_read_client(client_id));

create policy "client context updates scoped write"
on client_context_updates for all
using (can_write_client(client_id))
with check (can_write_client(client_id));
