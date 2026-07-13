-- Phase 85 Stage 4B-3 Phase 8: atomic bundle decision commit idempotency and RPC.

create table if not exists bundle_decision_idempotency (
  tenant_id uuid not null references tenants(id) on delete cascade,
  idempotency_key text not null,
  bundle_id uuid not null,
  bundle_revision bigint not null,
  decision_id uuid not null,
  conversation_revision bigint not null,
  response_json jsonb,
  created_at timestamptz not null default now(),
  primary key (tenant_id, idempotency_key),
  constraint bundle_decision_idempotency_revision_check check (bundle_revision >= 1)
);

create unique index if not exists bundle_decision_idempotency_bundle_revision_idx
  on bundle_decision_idempotency (tenant_id, bundle_id, bundle_revision);

alter table bundle_decision_idempotency enable row level security;

drop policy if exists "p85 stage4b3 bundle decision idempotency deny direct access" on bundle_decision_idempotency;
create policy "p85 stage4b3 bundle decision idempotency deny direct access"
on bundle_decision_idempotency for all
using (false)
with check (false);

revoke all on table bundle_decision_idempotency from public, anon, authenticated;
grant all on table bundle_decision_idempotency to service_role;

create or replace function p85_stage_4b3_commit_bundle_decision_v1(
  p_tenant_id uuid,
  p_bundle_id uuid,
  p_expected_bundle_revision bigint,
  p_expected_conversation_revision bigint,
  p_idempotency_key text,
  p_decision_id uuid
)
returns inbound_message_bundles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bundle inbound_message_bundles%rowtype;
  v_conversation_revision bigint;
  v_cached bundle_decision_idempotency%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'idempotency_key_required';
  end if;

  select *
    into v_cached
  from bundle_decision_idempotency
  where tenant_id = p_tenant_id
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_cached.decision_id <> p_decision_id then
      raise exception 'idempotency_key_conflict';
    end if;
    select *
      into v_bundle
    from inbound_message_bundles
    where tenant_id = p_tenant_id
      and id = p_bundle_id;
    return v_bundle;
  end if;

  select *
    into v_bundle
  from inbound_message_bundles
  where tenant_id = p_tenant_id
    and id = p_bundle_id
  for update;

  if not found then
    raise exception 'bundle_not_found';
  end if;

  if v_bundle.bundle_revision <> p_expected_bundle_revision then
    raise exception 'stale_bundle_revision';
  end if;

  select coalesce(c.revision, 1)
    into v_conversation_revision
  from conversations c
  where c.tenant_id = p_tenant_id
    and c.id = v_bundle.conversation_id;

  if v_conversation_revision <> p_expected_conversation_revision then
    raise exception 'stale_conversation_revision';
  end if;

  if v_bundle.decision_id is not null and v_bundle.decision_id <> p_decision_id then
    raise exception 'bundle_decision_already_committed';
  end if;

  if v_bundle.status not in ('processing', 'ready') then
    raise exception 'bundle_not_processable';
  end if;

  update inbound_message_bundles
  set status = 'completed',
      decision_id = p_decision_id,
      lease_expires_at = null,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_bundle_id
  returning *
  into v_bundle;

  insert into bundle_decision_idempotency (
    tenant_id,
    idempotency_key,
    bundle_id,
    bundle_revision,
    decision_id,
    conversation_revision
  ) values (
    p_tenant_id,
    p_idempotency_key,
    p_bundle_id,
    p_expected_bundle_revision,
    p_decision_id,
    p_expected_conversation_revision
  );

  return v_bundle;
end;
$$;

revoke all on function p85_stage_4b3_commit_bundle_decision_v1(uuid, uuid, bigint, bigint, text, uuid)
  from public, anon, authenticated;
grant execute on function p85_stage_4b3_commit_bundle_decision_v1(uuid, uuid, bigint, bigint, text, uuid)
  to service_role;
