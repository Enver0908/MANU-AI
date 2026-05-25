create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  type text not null check (type in ('handoff_urgent', 'handoff_standard', 'system')),
  entity_type text not null,
  entity_id text not null,
  title text not null,
  body text not null,
  read boolean not null default false,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_tenant_read_created_idx
on notifications (tenant_id, read, created_at desc);

create index if not exists notifications_tenant_entity_idx
on notifications (tenant_id, entity_type, entity_id);

alter table notifications enable row level security;

drop policy if exists "tenant scoped crud notifications" on notifications;

create policy "tenant scoped crud notifications"
on notifications for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));
