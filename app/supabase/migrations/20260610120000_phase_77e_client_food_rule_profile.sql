-- Phase 77E: client food rule profile v2 persistence.

create table if not exists client_food_rule_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  dietitian_id uuid not null references dietitians(id) on delete cascade,
  version integer not null default 1,
  status text not null default 'published' check (status in ('draft', 'published')),
  revision integer not null default 1,
  profile_data jsonb not null default '{}'::jsonb,
  catalog_version text not null default '',
  catalog_source_sha256 text not null default '',
  catalog_record_set_sha256 text not null default '',
  migrated_from_legacy_76d boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create unique index if not exists client_food_rule_profiles_tenant_client_idx
  on client_food_rule_profiles (tenant_id, client_id);

create index if not exists client_food_rule_profiles_tenant_updated_idx
  on client_food_rule_profiles (tenant_id, updated_at desc);

alter table client_food_rule_profiles enable row level security;

drop policy if exists "tenant scoped select client food rule profiles" on client_food_rule_profiles;
create policy "tenant scoped select client food rule profiles"
on client_food_rule_profiles for select
using (is_tenant_member(tenant_id));

drop policy if exists "tenant scoped write client food rule profiles" on client_food_rule_profiles;
create policy "tenant scoped write client food rule profiles"
on client_food_rule_profiles for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));
