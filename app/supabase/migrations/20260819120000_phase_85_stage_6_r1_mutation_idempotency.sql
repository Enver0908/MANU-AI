-- Phase 85 Stage 6 R1: durable bounded dashboard mutation idempotency.
-- Stores metadata-only bounded mutation receipts by tenant/request id.

create table if not exists stage_6_mutation_idempotency (
  tenant_id uuid not null references tenants(id) on delete cascade,
  request_id text not null,
  mutation_kind text not null,
  client_id uuid references clients(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'complete')),
  response_json jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (tenant_id, request_id),
  constraint stage_6_mutation_idempotency_request_id_length
    check (char_length(trim(request_id)) between 8 and 128),
  constraint stage_6_mutation_idempotency_response_shape
    check (
      (
        status = 'pending'
        and client_id is null
        and response_json is null
        and completed_at is null
      )
      or (
        status = 'complete'
        and client_id is not null
        and completed_at is not null
        and jsonb_typeof(response_json) = 'object'
        and response_json ? 'kind'
        and response_json ? 'clientId'
        and response_json ? 'payload'
        and response_json ? 'revisions'
        and not (response_json ? 'state')
      )
    )
);

create index if not exists stage_6_mutation_idempotency_client_created_idx
  on stage_6_mutation_idempotency (tenant_id, client_id, created_at desc);

alter table stage_6_mutation_idempotency enable row level security;

drop policy if exists stage_6_mutation_idempotency_no_direct_access on stage_6_mutation_idempotency;
create policy stage_6_mutation_idempotency_no_direct_access
  on stage_6_mutation_idempotency
  as restrictive
  for all
  using (false)
  with check (false);
