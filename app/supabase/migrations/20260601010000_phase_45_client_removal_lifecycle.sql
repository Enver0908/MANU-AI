alter table clients
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists removed_at timestamptz null;

alter table clients
  drop constraint if exists clients_lifecycle_status_check;

alter table clients
  add constraint clients_lifecycle_status_check
  check (lifecycle_status in ('active', 'removed_anonymized'));

update clients
set lifecycle_status = 'active'
where lifecycle_status is null;

create index if not exists clients_tenant_lifecycle_status_idx
  on clients (tenant_id, lifecycle_status);
