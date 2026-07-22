-- Phase 85 Stage 4C Faz 2: AI Chat RLS helpers, immutable triggers, policies, and admin metadata view.

create or replace function p85_stage_4c_validate_creator_membership(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from tenant_memberships tm
    join dietitians d
      on d.tenant_id = tm.tenant_id
     and d.id = p_dietitian_id
     and d.auth_user_id = tm.user_id
    where tm.tenant_id = p_tenant_id
      and tm.user_id = p_user_id
  )
$$;

create or replace function p85_stage_4c_actor_owns_chat(
  p_tenant_id uuid,
  p_chat_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from ai_chat_conversations c
    where c.tenant_id = p_tenant_id
      and c.id = p_chat_id
      and c.created_by_user_id = p_user_id
  )
$$;

create or replace function p85_stage_4c_actor_can_access_client_chat(
  p_tenant_id uuid,
  p_chat_id uuid,
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
      when c.scope_type = 'general' then true
      when c.scope_type = 'client' and c.client_id is not null then
        p85_stage_4b_actor_can_read_client(
          p_tenant_id,
          c.client_id,
          p_user_id,
          p_dietitian_id,
          p_role
        )
      else false
    end
    from ai_chat_conversations c
    where c.tenant_id = p_tenant_id
      and c.id = p_chat_id
      and c.created_by_user_id = p_user_id
  ), false)
$$;

create or replace function p85_stage_4c_actor_can_read_chat_row(
  p_tenant_id uuid,
  p_chat_id uuid,
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
  select p85_stage_4c_actor_owns_chat(p_tenant_id, p_chat_id, p_user_id)
     and p85_stage_4c_actor_can_access_client_chat(
       p_tenant_id,
       p_chat_id,
       p_user_id,
       p_dietitian_id,
       p_role
     )
$$;

create or replace function p85_stage_4c_prevent_immutable_conversation_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tenant_id is distinct from old.tenant_id
     or new.created_by_user_id is distinct from old.created_by_user_id
     or new.created_by_dietitian_id is distinct from old.created_by_dietitian_id
     or new.scope_type is distinct from old.scope_type
     or new.client_id is distinct from old.client_id then
    raise exception 'ai_chat_immutable_scope';
  end if;
  return new;
end;
$$;

create or replace function p85_stage_4c_prevent_message_version_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'ai_chat_message_version_immutable';
end;
$$;

create or replace function p85_stage_4c_validate_conversation_creator()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not p85_stage_4c_validate_creator_membership(
    new.tenant_id,
    new.created_by_user_id,
    new.created_by_dietitian_id
  ) then
    raise exception 'ai_chat_creator_membership_invalid';
  end if;
  return new;
end;
$$;

create or replace function p85_stage_4c_validate_general_scope_source_ref()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_scope_type text;
begin
  if new.client_id is null then
    return new;
  end if;

  select c.scope_type
    into v_scope_type
  from ai_chat_conversations c
  where c.tenant_id = new.tenant_id
    and c.id = new.conversation_id;

  if v_scope_type = 'general' then
    raise exception 'ai_chat_general_scope_client_source_forbidden';
  end if;

  return new;
end;
$$;

drop trigger if exists ai_chat_conversations_validate_creator on ai_chat_conversations;
create trigger ai_chat_conversations_validate_creator
before insert on ai_chat_conversations
for each row execute function p85_stage_4c_validate_conversation_creator();

drop trigger if exists ai_chat_conversations_prevent_immutable_update on ai_chat_conversations;
create trigger ai_chat_conversations_prevent_immutable_update
before update on ai_chat_conversations
for each row execute function p85_stage_4c_prevent_immutable_conversation_update();

drop trigger if exists ai_chat_message_versions_prevent_update on ai_chat_message_versions;
create trigger ai_chat_message_versions_prevent_update
before update on ai_chat_message_versions
for each row execute function p85_stage_4c_prevent_message_version_update();

drop trigger if exists ai_chat_source_refs_validate_general_scope on ai_chat_source_refs;
create trigger ai_chat_source_refs_validate_general_scope
before insert or update on ai_chat_source_refs
for each row execute function p85_stage_4c_validate_general_scope_source_ref();

create or replace view ai_chat_conversation_admin_metadata
with (security_invoker = true)
as
select
  c.id,
  c.tenant_id,
  c.created_by_user_id,
  c.created_by_dietitian_id,
  c.scope_type,
  c.client_id,
  c.status,
  c.revision,
  c.last_message_at,
  c.created_at,
  c.updated_at
from ai_chat_conversations c;

alter table ai_chat_conversations enable row level security;
alter table ai_chat_branches enable row level security;
alter table ai_chat_messages enable row level security;
alter table ai_chat_message_versions enable row level security;
alter table ai_chat_runs enable row level security;
alter table ai_chat_run_events enable row level security;
alter table ai_chat_tool_calls enable row level security;
alter table ai_chat_context_snapshots enable row level security;
alter table ai_chat_source_refs enable row level security;
alter table ai_chat_memory_summaries enable row level security;
alter table ai_chat_provider_egress_manifests enable row level security;
alter table ai_chat_mutation_ledger enable row level security;
alter table ai_chat_events enable row level security;

drop policy if exists "p85 stage4c conversations creator read" on ai_chat_conversations;
create policy "p85 stage4c conversations creator read"
on ai_chat_conversations for select
using (
  created_by_user_id = auth.uid()
  and p85_stage_4c_actor_can_access_client_chat(
    tenant_id,
    id,
    auth.uid(),
    (
      select d.id
      from dietitians d
      where d.tenant_id = ai_chat_conversations.tenant_id
        and d.auth_user_id = auth.uid()
      limit 1
    ),
    (
      select tm.role::text
      from tenant_memberships tm
      where tm.tenant_id = ai_chat_conversations.tenant_id
        and tm.user_id = auth.uid()
      limit 1
    )
  )
);

drop policy if exists "p85 stage4c conversations deny direct mutation" on ai_chat_conversations;
create policy "p85 stage4c conversations deny direct mutation"
on ai_chat_conversations for all
using (false)
with check (false);

drop policy if exists "p85 stage4c branches creator read" on ai_chat_branches;
create policy "p85 stage4c branches creator read"
on ai_chat_branches for select
using (
  created_by_user_id = auth.uid()
  and p85_stage_4c_actor_can_read_chat_row(
    tenant_id,
    conversation_id,
    auth.uid(),
    (
      select d.id
      from dietitians d
      where d.tenant_id = ai_chat_branches.tenant_id
        and d.auth_user_id = auth.uid()
      limit 1
    ),
    (
      select tm.role::text
      from tenant_memberships tm
      where tm.tenant_id = ai_chat_branches.tenant_id
        and tm.user_id = auth.uid()
      limit 1
    )
  )
);

drop policy if exists "p85 stage4c branches deny direct mutation" on ai_chat_branches;
create policy "p85 stage4c branches deny direct mutation"
on ai_chat_branches for all
using (false)
with check (false);

drop policy if exists "p85 stage4c messages creator read" on ai_chat_messages;
create policy "p85 stage4c messages creator read"
on ai_chat_messages for select
using (
  created_by_user_id = auth.uid()
  and p85_stage_4c_actor_can_read_chat_row(
    tenant_id,
    conversation_id,
    auth.uid(),
    (
      select d.id
      from dietitians d
      where d.tenant_id = ai_chat_messages.tenant_id
        and d.auth_user_id = auth.uid()
      limit 1
    ),
    (
      select tm.role::text
      from tenant_memberships tm
      where tm.tenant_id = ai_chat_messages.tenant_id
        and tm.user_id = auth.uid()
      limit 1
    )
  )
);

drop policy if exists "p85 stage4c messages deny direct mutation" on ai_chat_messages;
create policy "p85 stage4c messages deny direct mutation"
on ai_chat_messages for all
using (false)
with check (false);

drop policy if exists "p85 stage4c message versions creator read" on ai_chat_message_versions;
create policy "p85 stage4c message versions creator read"
on ai_chat_message_versions for select
using (
  created_by_user_id = auth.uid()
  and p85_stage_4c_actor_can_read_chat_row(
    tenant_id,
    conversation_id,
    auth.uid(),
    (
      select d.id
      from dietitians d
      where d.tenant_id = ai_chat_message_versions.tenant_id
        and d.auth_user_id = auth.uid()
      limit 1
    ),
    (
      select tm.role::text
      from tenant_memberships tm
      where tm.tenant_id = ai_chat_message_versions.tenant_id
        and tm.user_id = auth.uid()
      limit 1
    )
  )
);

drop policy if exists "p85 stage4c message versions deny direct mutation" on ai_chat_message_versions;
create policy "p85 stage4c message versions deny direct mutation"
on ai_chat_message_versions for all
using (false)
with check (false);

drop policy if exists "p85 stage4c runs creator read" on ai_chat_runs;
create policy "p85 stage4c runs creator read"
on ai_chat_runs for select
using (
  created_by_user_id = auth.uid()
  and p85_stage_4c_actor_can_read_chat_row(
    tenant_id,
    conversation_id,
    auth.uid(),
    (
      select d.id
      from dietitians d
      where d.tenant_id = ai_chat_runs.tenant_id
        and d.auth_user_id = auth.uid()
      limit 1
    ),
    (
      select tm.role::text
      from tenant_memberships tm
      where tm.tenant_id = ai_chat_runs.tenant_id
        and tm.user_id = auth.uid()
      limit 1
    )
  )
);

drop policy if exists "p85 stage4c runs deny direct mutation" on ai_chat_runs;
create policy "p85 stage4c runs deny direct mutation"
on ai_chat_runs for all
using (false)
with check (false);

drop policy if exists "p85 stage4c run events creator read" on ai_chat_run_events;
create policy "p85 stage4c run events creator read"
on ai_chat_run_events for select
using (
  created_by_user_id = auth.uid()
  and p85_stage_4c_actor_can_read_chat_row(
    tenant_id,
    conversation_id,
    auth.uid(),
    (
      select d.id
      from dietitians d
      where d.tenant_id = ai_chat_run_events.tenant_id
        and d.auth_user_id = auth.uid()
      limit 1
    ),
    (
      select tm.role::text
      from tenant_memberships tm
      where tm.tenant_id = ai_chat_run_events.tenant_id
        and tm.user_id = auth.uid()
      limit 1
    )
  )
);

drop policy if exists "p85 stage4c run events deny direct mutation" on ai_chat_run_events;
create policy "p85 stage4c run events deny direct mutation"
on ai_chat_run_events for all
using (false)
with check (false);

drop policy if exists "p85 stage4c tool calls creator read" on ai_chat_tool_calls;
create policy "p85 stage4c tool calls creator read"
on ai_chat_tool_calls for select
using (
  created_by_user_id = auth.uid()
  and p85_stage_4c_actor_can_read_chat_row(
    tenant_id,
    conversation_id,
    auth.uid(),
    (
      select d.id
      from dietitians d
      where d.tenant_id = ai_chat_tool_calls.tenant_id
        and d.auth_user_id = auth.uid()
      limit 1
    ),
    (
      select tm.role::text
      from tenant_memberships tm
      where tm.tenant_id = ai_chat_tool_calls.tenant_id
        and tm.user_id = auth.uid()
      limit 1
    )
  )
);

drop policy if exists "p85 stage4c tool calls deny direct mutation" on ai_chat_tool_calls;
create policy "p85 stage4c tool calls deny direct mutation"
on ai_chat_tool_calls for all
using (false)
with check (false);

drop policy if exists "p85 stage4c context snapshots creator read" on ai_chat_context_snapshots;
create policy "p85 stage4c context snapshots creator read"
on ai_chat_context_snapshots for select
using (
  created_by_user_id = auth.uid()
  and p85_stage_4c_actor_can_read_chat_row(
    tenant_id,
    conversation_id,
    auth.uid(),
    (
      select d.id
      from dietitians d
      where d.tenant_id = ai_chat_context_snapshots.tenant_id
        and d.auth_user_id = auth.uid()
      limit 1
    ),
    (
      select tm.role::text
      from tenant_memberships tm
      where tm.tenant_id = ai_chat_context_snapshots.tenant_id
        and tm.user_id = auth.uid()
      limit 1
    )
  )
);

drop policy if exists "p85 stage4c context snapshots deny direct mutation" on ai_chat_context_snapshots;
create policy "p85 stage4c context snapshots deny direct mutation"
on ai_chat_context_snapshots for all
using (false)
with check (false);

drop policy if exists "p85 stage4c source refs creator read" on ai_chat_source_refs;
create policy "p85 stage4c source refs creator read"
on ai_chat_source_refs for select
using (
  created_by_user_id = auth.uid()
  and p85_stage_4c_actor_can_read_chat_row(
    tenant_id,
    conversation_id,
    auth.uid(),
    (
      select d.id
      from dietitians d
      where d.tenant_id = ai_chat_source_refs.tenant_id
        and d.auth_user_id = auth.uid()
      limit 1
    ),
    (
      select tm.role::text
      from tenant_memberships tm
      where tm.tenant_id = ai_chat_source_refs.tenant_id
        and tm.user_id = auth.uid()
      limit 1
    )
  )
);

drop policy if exists "p85 stage4c source refs deny direct mutation" on ai_chat_source_refs;
create policy "p85 stage4c source refs deny direct mutation"
on ai_chat_source_refs for all
using (false)
with check (false);

drop policy if exists "p85 stage4c memory summaries creator read" on ai_chat_memory_summaries;
create policy "p85 stage4c memory summaries creator read"
on ai_chat_memory_summaries for select
using (
  created_by_user_id = auth.uid()
  and p85_stage_4c_actor_can_read_chat_row(
    tenant_id,
    conversation_id,
    auth.uid(),
    (
      select d.id
      from dietitians d
      where d.tenant_id = ai_chat_memory_summaries.tenant_id
        and d.auth_user_id = auth.uid()
      limit 1
    ),
    (
      select tm.role::text
      from tenant_memberships tm
      where tm.tenant_id = ai_chat_memory_summaries.tenant_id
        and tm.user_id = auth.uid()
      limit 1
    )
  )
);

drop policy if exists "p85 stage4c memory summaries deny direct mutation" on ai_chat_memory_summaries;
create policy "p85 stage4c memory summaries deny direct mutation"
on ai_chat_memory_summaries for all
using (false)
with check (false);

drop policy if exists "p85 stage4c provider egress deny direct access" on ai_chat_provider_egress_manifests;
create policy "p85 stage4c provider egress deny direct access"
on ai_chat_provider_egress_manifests for all
using (false)
with check (false);

drop policy if exists "p85 stage4c mutation ledger deny direct access" on ai_chat_mutation_ledger;
create policy "p85 stage4c mutation ledger deny direct access"
on ai_chat_mutation_ledger for all
using (false)
with check (false);

drop policy if exists "p85 stage4c events deny direct access" on ai_chat_events;
create policy "p85 stage4c events deny direct access"
on ai_chat_events for all
using (false)
with check (false);

revoke all on table ai_chat_conversations from public, anon;
revoke all on table ai_chat_branches from public, anon;
revoke all on table ai_chat_messages from public, anon;
revoke all on table ai_chat_message_versions from public, anon;
revoke all on table ai_chat_runs from public, anon;
revoke all on table ai_chat_run_events from public, anon;
revoke all on table ai_chat_tool_calls from public, anon;
revoke all on table ai_chat_context_snapshots from public, anon;
revoke all on table ai_chat_source_refs from public, anon;
revoke all on table ai_chat_memory_summaries from public, anon;
revoke all on table ai_chat_provider_egress_manifests from public, anon;
revoke all on table ai_chat_mutation_ledger from public, anon;
revoke all on table ai_chat_events from public, anon;

revoke insert, update, delete on table ai_chat_conversations from authenticated;
revoke insert, update, delete on table ai_chat_branches from authenticated;
revoke insert, update, delete on table ai_chat_messages from authenticated;
revoke insert, update, delete on table ai_chat_message_versions from authenticated;
revoke insert, update, delete on table ai_chat_runs from authenticated;
revoke insert, update, delete on table ai_chat_run_events from authenticated;
revoke insert, update, delete on table ai_chat_tool_calls from authenticated;
revoke insert, update, delete on table ai_chat_context_snapshots from authenticated;
revoke insert, update, delete on table ai_chat_source_refs from authenticated;
revoke insert, update, delete on table ai_chat_memory_summaries from authenticated;
revoke insert, update, delete on table ai_chat_provider_egress_manifests from authenticated;
revoke insert, update, delete on table ai_chat_mutation_ledger from authenticated;
revoke insert, update, delete on table ai_chat_events from authenticated;

grant select on table ai_chat_conversations to authenticated;
grant select on table ai_chat_branches to authenticated;
grant select on table ai_chat_messages to authenticated;
grant select on table ai_chat_message_versions to authenticated;
grant select on table ai_chat_runs to authenticated;
grant select on table ai_chat_run_events to authenticated;
grant select on table ai_chat_tool_calls to authenticated;
grant select on table ai_chat_context_snapshots to authenticated;
grant select on table ai_chat_source_refs to authenticated;
grant select on table ai_chat_memory_summaries to authenticated;

grant all on table ai_chat_conversations to service_role;
grant all on table ai_chat_branches to service_role;
grant all on table ai_chat_messages to service_role;
grant all on table ai_chat_message_versions to service_role;
grant all on table ai_chat_runs to service_role;
grant all on table ai_chat_run_events to service_role;
grant all on table ai_chat_tool_calls to service_role;
grant all on table ai_chat_context_snapshots to service_role;
grant all on table ai_chat_source_refs to service_role;
grant all on table ai_chat_memory_summaries to service_role;
grant all on table ai_chat_provider_egress_manifests to service_role;
grant all on table ai_chat_mutation_ledger to service_role;
grant all on table ai_chat_events to service_role;

grant select on ai_chat_conversation_admin_metadata to authenticated, service_role;

revoke all on function p85_stage_4c_validate_creator_membership(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_actor_owns_chat(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_actor_can_access_client_chat(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_actor_can_read_chat_row(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;

grant execute on function p85_stage_4c_validate_creator_membership(uuid, uuid, uuid) to service_role;
grant execute on function p85_stage_4c_actor_owns_chat(uuid, uuid, uuid) to service_role;
grant execute on function p85_stage_4c_actor_can_access_client_chat(uuid, uuid, uuid, uuid, text) to service_role;
grant execute on function p85_stage_4c_actor_can_read_chat_row(uuid, uuid, uuid, uuid, text) to service_role;

create or replace function p85_stage_4c_create_conversation_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_scope_type text,
  p_client_id uuid,
  p_title text,
  p_request_id text,
  p_body_hash text
)
returns ai_chat_conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing ai_chat_mutation_ledger%rowtype;
  v_conversation ai_chat_conversations%rowtype;
  v_branch ai_chat_branches%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if not p85_stage_4c_validate_creator_membership(p_tenant_id, p_user_id, p_dietitian_id) then
    raise exception 'ai_chat_creator_membership_invalid';
  end if;

  if p_scope_type = 'general' and p_client_id is not null then
    raise exception 'ai_chat_scope_client_mismatch';
  end if;

  if p_scope_type = 'client' and p_client_id is null then
    raise exception 'ai_chat_client_required';
  end if;

  select *
    into v_existing
  from ai_chat_mutation_ledger
  where tenant_id = p_tenant_id
    and request_id = p_request_id
    and created_by_user_id = p_user_id
  for update;

  if found then
    if v_existing.body_hash <> p_body_hash then
      raise exception 'ai_chat_idempotency_conflict';
    end if;

    select *
      into v_conversation
    from ai_chat_conversations
    where tenant_id = p_tenant_id
      and id = (v_existing.response_digest::uuid);
    return v_conversation;
  end if;

  insert into ai_chat_conversations (
    tenant_id,
    created_by_user_id,
    created_by_dietitian_id,
    scope_type,
    client_id,
    title
  )
  values (
    p_tenant_id,
    p_user_id,
    p_dietitian_id,
    p_scope_type,
    p_client_id,
    p_title
  )
  returning * into v_conversation;

  insert into ai_chat_branches (
    tenant_id,
    conversation_id,
    created_by_user_id,
    fork_reason
  )
  values (
    p_tenant_id,
    v_conversation.id,
    p_user_id,
    'initial'
  )
  returning * into v_branch;

  update ai_chat_conversations
  set active_branch_id = v_branch.id,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = v_conversation.id
  returning * into v_conversation;

  insert into ai_chat_mutation_ledger (
    tenant_id,
    request_id,
    created_by_user_id,
    body_hash,
    response_digest
  )
  values (
    p_tenant_id,
    p_request_id,
    p_user_id,
    p_body_hash,
    v_conversation.id::text
  );

  return v_conversation;
end;
$$;

revoke all on function p85_stage_4c_create_conversation_v1(uuid, uuid, uuid, text, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function p85_stage_4c_create_conversation_v1(uuid, uuid, uuid, text, uuid, text, text, text)
  to service_role;
