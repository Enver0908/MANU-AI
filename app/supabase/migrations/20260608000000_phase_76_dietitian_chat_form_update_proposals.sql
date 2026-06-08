-- Phase 76A: dietitian chat generated client form/context update proposals.

create table if not exists client_update_proposals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  dietitian_id uuid not null references dietitians(id) on delete cascade,
  source_text text not null,
  proposed_patches jsonb not null default '[]'::jsonb,
  safety_flags text[] not null default '{}',
  status text not null check (status in ('pending', 'applied', 'rejected', 'needs_clarification', 'unsupported')),
  expected_context_revision integer not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists client_update_proposals_tenant_client_idx
  on client_update_proposals (tenant_id, client_id, created_at desc);

alter table client_update_proposals enable row level security;

drop policy if exists "tenant scoped select client update proposals" on client_update_proposals;
create policy "tenant scoped select client update proposals"
on client_update_proposals for select
using (is_tenant_member(tenant_id));

drop policy if exists "tenant scoped write client update proposals" on client_update_proposals;
create policy "tenant scoped write client update proposals"
on client_update_proposals for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));
