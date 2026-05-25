alter table messages
  add column if not exists status text not null default 'stored'
  check (status in ('stored', 'sent', 'draft', 'handoff', 'blocked'));

alter table ai_decisions
  add column if not exists reasons text[] not null default '{}';

alter table clients
  add column if not exists safety_checklist jsonb not null default '{}';

create unique index if not exists dietitians_auth_user_id_unique
on dietitians (auth_user_id)
where auth_user_id is not null;

drop policy if exists "tenant members can read tenants" on tenants;
drop policy if exists "tenant members can read memberships" on tenant_memberships;
drop policy if exists "tenant scoped select dietitians" on dietitians;
drop policy if exists "tenant scoped select voice profiles" on dietitian_voice_profiles;
drop policy if exists "tenant scoped crud clients" on clients;
drop policy if exists "tenant scoped crud client channels" on client_channels;
drop policy if exists "tenant scoped crud conversations" on conversations;
drop policy if exists "tenant scoped crud messages" on messages;
drop policy if exists "tenant scoped crud activation events" on client_ai_status_events;
drop policy if exists "tenant scoped crud memories" on conversation_memories;
drop policy if exists "tenant scoped crud risk assessments" on risk_assessments;
drop policy if exists "tenant scoped crud handoff cases" on handoff_cases;
drop policy if exists "tenant scoped crud ai decisions" on ai_decisions;
drop policy if exists "tenant scoped insert audit events" on audit_events;
drop policy if exists "tenant scoped read audit events" on audit_events;
drop policy if exists "tenant scoped crud processed events" on processed_inbound_events;

create policy "tenant members can read tenants"
on tenants for select
using (is_tenant_member(id));

create policy "tenant members can read memberships"
on tenant_memberships for select
using (is_tenant_member(tenant_id));

create policy "tenant scoped select dietitians"
on dietitians for select
using (is_tenant_member(tenant_id));

create policy "tenant scoped select voice profiles"
on dietitian_voice_profiles for select
using (is_tenant_member(tenant_id));

create policy "tenant scoped crud clients"
on clients for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));

create policy "tenant scoped crud client channels"
on client_channels for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));

create policy "tenant scoped crud conversations"
on conversations for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));

create policy "tenant scoped crud messages"
on messages for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));

create policy "tenant scoped crud handoff cases"
on handoff_cases for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));

create policy "tenant scoped crud ai decisions"
on ai_decisions for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));

create policy "tenant scoped insert audit events"
on audit_events for insert
with check (is_tenant_member(tenant_id));

create policy "tenant scoped read audit events"
on audit_events for select
using (is_tenant_member(tenant_id));

create policy "tenant scoped crud processed events"
on processed_inbound_events for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));
