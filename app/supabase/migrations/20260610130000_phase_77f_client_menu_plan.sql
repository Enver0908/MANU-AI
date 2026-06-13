-- Phase 77F: client menu plan v1 persistence.

create table if not exists client_menu_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  dietitian_id uuid not null references dietitians(id) on delete cascade,
  template_type text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  version integer not null default 1,
  revision integer not null default 1,
  title text not null default '',
  effective_date date,
  plan_data jsonb not null default '{}'::jsonb,
  catalog_version text not null default '',
  catalog_source_sha256 text not null default '',
  catalog_record_set_sha256 text not null default '',
  migrated_from_legacy_diet_plan boolean not null default false,
  export_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz
);

create index if not exists client_menu_plans_tenant_client_idx
  on client_menu_plans (tenant_id, client_id, updated_at desc);

create index if not exists client_menu_plans_tenant_status_idx
  on client_menu_plans (tenant_id, status, updated_at desc);

alter table client_menu_plans enable row level security;

drop policy if exists "tenant scoped select client menu plans" on client_menu_plans;
create policy "tenant scoped select client menu plans"
on client_menu_plans for select
using (is_tenant_member(tenant_id));

drop policy if exists "tenant scoped write client menu plans" on client_menu_plans;
create policy "tenant scoped write client menu plans"
on client_menu_plans for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));
