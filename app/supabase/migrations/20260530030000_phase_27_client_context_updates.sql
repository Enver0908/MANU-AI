-- Phase 27: dietitian-entered context updates from non-WhatsApp/Telegram conversations.

create table if not exists client_context_updates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  dietitian_id uuid not null references dietitians(id) on delete cascade,
  source text not null check (source in ('phone', 'zoom', 'in_person', 'other')),
  occurred_at timestamptz not null,
  title text not null,
  summary text not null,
  details text not null default '',
  importance text not null check (importance in ('routine', 'important', 'critical')),
  status text not null default 'active' check (status in ('active', 'superseded')),
  supersedes_update_id uuid references client_context_updates(id),
  created_at timestamptz not null default now()
);

create index if not exists client_context_updates_tenant_client_idx
  on client_context_updates (tenant_id, client_id, occurred_at desc);

alter table client_context_updates enable row level security;

drop policy if exists "tenant scoped select client context updates" on client_context_updates;
create policy "tenant scoped select client context updates"
on client_context_updates for select
using (is_tenant_member(tenant_id));

drop policy if exists "tenant scoped write client context updates" on client_context_updates;
create policy "tenant scoped write client context updates"
on client_context_updates for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));
