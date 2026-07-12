-- Phase 85 Stage 4B-2: conversation mutation idempotency + manual reply CAS guard.

create table if not exists conversation_mutation_idempotency (
  tenant_id uuid not null references tenants(id) on delete cascade,
  request_id uuid not null,
  operation text not null check (operation in ('manual_reply', 'draft_review')),
  conversation_id uuid not null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, request_id)
);

create index if not exists conversation_mutation_idempotency_conversation_idx
  on conversation_mutation_idempotency (tenant_id, conversation_id, created_at desc);

revoke all on table conversation_mutation_idempotency from public, anon, authenticated;
grant all on table conversation_mutation_idempotency to service_role;

create or replace function p85_stage_4b2_get_conversation_mutation_idempotency_v1(
  p_tenant_id uuid,
  p_request_id uuid
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select response_json
  from conversation_mutation_idempotency
  where tenant_id = p_tenant_id
    and request_id = p_request_id
  limit 1;
$$;

create or replace function p85_stage_4b2_store_conversation_mutation_idempotency_v1(
  p_tenant_id uuid,
  p_request_id uuid,
  p_operation text,
  p_conversation_id uuid,
  p_response_json jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into conversation_mutation_idempotency (
    tenant_id,
    request_id,
    operation,
    conversation_id,
    response_json
  )
  values (
    p_tenant_id,
    p_request_id,
    p_operation,
    p_conversation_id,
    p_response_json
  )
  on conflict (tenant_id, request_id) do nothing;
end;
$$;

create or replace function commit_manual_reply(p_tenant_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform p85_if_r3_assert_expected_conversation_revisions(p_tenant_id, p_payload);
  return manu_commit_state_delta('manual_reply', p_tenant_id, p_payload - 'expectedConversationRevisions');
end;
$$;

revoke all on function p85_stage_4b2_get_conversation_mutation_idempotency_v1(uuid, uuid)
  from public, anon, authenticated;
revoke all on function p85_stage_4b2_store_conversation_mutation_idempotency_v1(uuid, uuid, text, uuid, jsonb)
  from public, anon, authenticated;

grant execute on function p85_stage_4b2_get_conversation_mutation_idempotency_v1(uuid, uuid)
  to service_role;
grant execute on function p85_stage_4b2_store_conversation_mutation_idempotency_v1(uuid, uuid, text, uuid, jsonb)
  to service_role;
