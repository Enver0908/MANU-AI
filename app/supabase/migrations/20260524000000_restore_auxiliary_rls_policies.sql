drop policy if exists "tenant scoped crud activation events" on client_ai_status_events;
drop policy if exists "tenant scoped crud memories" on conversation_memories;
drop policy if exists "tenant scoped crud risk assessments" on risk_assessments;

create policy "tenant scoped crud activation events"
on client_ai_status_events for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));

create policy "tenant scoped crud memories"
on conversation_memories for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));

create policy "tenant scoped crud risk assessments"
on risk_assessments for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));
