-- P85-IF-R5: restrict operational trust/quarantine inspection reads to owner/admin.

drop policy if exists "tenant scoped read channel account bindings" on channel_account_bindings;
drop policy if exists "tenant scoped read channel actor bindings" on channel_actor_bindings;
drop policy if exists "tenant scoped read channel events" on channel_events;

create policy "owner admin read channel account bindings"
on channel_account_bindings for select
using (has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[]));

create policy "owner admin read channel actor bindings"
on channel_actor_bindings for select
using (has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[]));

create policy "owner admin read channel events"
on channel_events for select
using (has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[]));

drop policy if exists "tenant scoped crud inbound quarantines" on inbound_quarantines;

create policy "owner admin read inbound quarantines"
on inbound_quarantines for select
using (has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[]));

create policy "tenant scoped insert inbound quarantines"
on inbound_quarantines for insert
with check (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));

create policy "tenant scoped update inbound quarantines"
on inbound_quarantines for update
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]))
with check (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));

create policy "tenant scoped delete inbound quarantines"
on inbound_quarantines for delete
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));
