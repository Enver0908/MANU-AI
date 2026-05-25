create table if not exists client_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  dietitian_id uuid not null references dietitians(id) on delete cascade,
  access_level text not null default 'care_team',
  created_at timestamptz not null default now(),
  unique (tenant_id, client_id, dietitian_id),
  constraint client_assignments_access_level_check check (access_level in ('care_team', 'viewer'))
);

create index if not exists client_assignments_tenant_dietitian_idx
on client_assignments (tenant_id, dietitian_id);

alter table client_assignments enable row level security;

drop policy if exists "tenant scoped crud client assignments" on client_assignments;
create policy "tenant scoped crud client assignments"
on client_assignments for all
using (tenant_id = current_tenant_id() or is_tenant_member(tenant_id))
with check (tenant_id = current_tenant_id() or is_tenant_member(tenant_id));
