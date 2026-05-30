-- Phase 24-25: dietitian voice samples and dynamic client form infrastructure.

alter table dietitian_voice_profiles
  add column if not exists status text not null default 'default',
  add column if not exists profile_version integer not null default 1,
  add column if not exists sample_count integer not null default 0,
  add column if not exists source_sample_ids uuid[] not null default '{}',
  add column if not exists generated_at timestamptz;

create table if not exists dietitian_voice_samples (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  dietitian_id uuid not null references dietitians(id) on delete cascade,
  body text not null,
  body_hash text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (tenant_id, dietitian_id, body_hash)
);

create table if not exists client_form_schemas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  version integer not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  fields jsonb not null default '[]',
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (tenant_id, version)
);

create table if not exists client_form_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  schema_id uuid not null references client_form_schemas(id) on delete restrict,
  schema_version integer not null,
  schema_snapshot jsonb not null,
  answers jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, client_id, schema_id)
);

create index if not exists dietitian_voice_samples_tenant_dietitian_idx
  on dietitian_voice_samples (tenant_id, dietitian_id, created_at desc);

create index if not exists client_form_responses_tenant_client_idx
  on client_form_responses (tenant_id, client_id, updated_at desc);

alter table dietitian_voice_samples enable row level security;
alter table client_form_schemas enable row level security;
alter table client_form_responses enable row level security;

drop policy if exists "tenant scoped select voice samples" on dietitian_voice_samples;
create policy "tenant scoped select voice samples"
on dietitian_voice_samples for select
using (is_tenant_member(tenant_id));

drop policy if exists "tenant scoped write voice samples" on dietitian_voice_samples;
create policy "tenant scoped write voice samples"
on dietitian_voice_samples for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));

drop policy if exists "tenant scoped select form schemas" on client_form_schemas;
create policy "tenant scoped select form schemas"
on client_form_schemas for select
using (is_tenant_member(tenant_id));

drop policy if exists "tenant scoped write form schemas" on client_form_schemas;
create policy "tenant scoped write form schemas"
on client_form_schemas for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));

drop policy if exists "tenant scoped select form responses" on client_form_responses;
create policy "tenant scoped select form responses"
on client_form_responses for select
using (is_tenant_member(tenant_id));

drop policy if exists "tenant scoped write form responses" on client_form_responses;
create policy "tenant scoped write form responses"
on client_form_responses for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));
