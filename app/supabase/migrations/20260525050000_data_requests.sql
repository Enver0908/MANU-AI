create table if not exists data_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  request_type text not null,
  status text not null,
  requested_by_dietitian_id uuid references dietitians(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint data_requests_request_type_check check (request_type in ('export', 'anonymization', 'deletion')),
  constraint data_requests_status_check check (status in ('requested', 'review_required', 'completed', 'rejected'))
);

create index if not exists data_requests_tenant_client_idx
on data_requests (tenant_id, client_id, created_at desc);

alter table data_requests enable row level security;

drop policy if exists "tenant scoped crud data requests" on data_requests;
create policy "tenant scoped crud data requests"
on data_requests for all
using (tenant_id = current_tenant_id() or is_tenant_member(tenant_id))
with check (tenant_id = current_tenant_id() or is_tenant_member(tenant_id));
