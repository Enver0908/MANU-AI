-- Phase 85 Stage 4C Faz 5: durable run queue, streaming events, and message mutation RPCs.

create table if not exists ai_chat_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_type text not null,
  run_id uuid,
  conversation_id uuid not null,
  created_by_user_id uuid not null,
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  lease_owner text,
  lease_token text,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  retry_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_chat_jobs_job_type_check check (job_type in ('generation', 'title')),
  constraint ai_chat_jobs_status_check check (
    status in ('queued', 'processing', 'completed', 'retryable_failed', 'permanently_failed', 'cancelled')
  )
);

alter table ai_chat_jobs
  add constraint ai_chat_jobs_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_jobs
  add constraint ai_chat_jobs_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references ai_chat_conversations (tenant_id, id) on delete cascade;

alter table ai_chat_jobs
  add constraint ai_chat_jobs_run_tenant_fk
  foreign key (tenant_id, run_id) references ai_chat_runs (tenant_id, id) on delete cascade;

create index if not exists ai_chat_jobs_claim_idx
  on ai_chat_jobs (status, next_attempt_at, created_at);

create or replace function p85_stage_4c_is_active_run_status(p_status text)
returns boolean
language sql
immutable
as $$
  select p_status in ('queued', 'retrieving', 'generating', 'validating', 'cancel_requested')
$$;

create or replace function p85_stage_4c_append_run_event_v1(
  p_tenant_id uuid,
  p_run_id uuid,
  p_event_type text,
  p_payload jsonb
)
returns ai_chat_run_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run ai_chat_runs%rowtype;
  v_sequence bigint;
  v_event ai_chat_run_events%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select * into v_run
  from ai_chat_runs
  where tenant_id = p_tenant_id and id = p_run_id
  for update;

  if not found then
    raise exception 'ai_chat_run_not_found';
  end if;

  select coalesce(max(sequence_number), 0) + 1
    into v_sequence
  from ai_chat_run_events
  where tenant_id = p_tenant_id and run_id = p_run_id;

  insert into ai_chat_run_events (
    tenant_id,
    run_id,
    conversation_id,
    created_by_user_id,
    sequence_number,
    event_type,
    payload,
    expires_at
  )
  values (
    p_tenant_id,
    p_run_id,
    v_run.conversation_id,
    v_run.created_by_user_id,
    v_sequence,
    p_event_type,
    coalesce(p_payload, '{}'::jsonb),
    now() + interval '24 hours'
  )
  returning * into v_event;

  return v_event;
end;
$$;

create or replace function p85_stage_4c_list_run_events_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_run_id uuid,
  p_after_sequence bigint
)
returns setof ai_chat_run_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run ai_chat_runs%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select * into v_run
  from ai_chat_runs
  where tenant_id = p_tenant_id and id = p_run_id;

  if not found or v_run.created_by_user_id <> p_user_id then
    raise exception 'ai_chat_run_not_found';
  end if;

  return query
  select *
  from ai_chat_run_events e
  where e.tenant_id = p_tenant_id
    and e.run_id = p_run_id
    and e.sequence_number > coalesce(p_after_sequence, 0)
  order by e.sequence_number asc;
end;
$$;

create or replace function p85_stage_4c_stop_run_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_run_id uuid,
  p_request_id text,
  p_body_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing ai_chat_mutation_ledger%rowtype;
  v_run ai_chat_runs%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select * into v_existing
  from ai_chat_mutation_ledger
  where tenant_id = p_tenant_id
    and request_id = p_request_id
    and created_by_user_id = p_user_id;

  if found then
    if v_existing.body_hash <> p_body_hash then
      raise exception 'ai_chat_idempotency_conflict';
    end if;
    return jsonb_build_object('status', v_existing.response_digest);
  end if;

  select * into v_run
  from ai_chat_runs
  where tenant_id = p_tenant_id and id = p_run_id and created_by_user_id = p_user_id
  for update;

  if not found then
    raise exception 'ai_chat_run_not_found';
  end if;

  if not p85_stage_4c_is_active_run_status(v_run.status) then
    insert into ai_chat_mutation_ledger (tenant_id, request_id, created_by_user_id, body_hash, response_digest)
    values (p_tenant_id, p_request_id, p_user_id, p_body_hash, v_run.status);
    return jsonb_build_object('status', v_run.status);
  end if;

  update ai_chat_runs
  set status = 'cancel_requested',
      cancel_requested_at = now(),
      updated_at = now()
  where tenant_id = p_tenant_id and id = p_run_id;

  insert into ai_chat_mutation_ledger (tenant_id, request_id, created_by_user_id, body_hash, response_digest)
  values (p_tenant_id, p_request_id, p_user_id, p_body_hash, 'cancel_requested');

  return jsonb_build_object('status', 'cancel_requested');
end;
$$;

create or replace function p85_stage_4c_claim_ai_chat_job_v1(
  p_worker_id text,
  p_lease_ms integer
)
returns table (
  id uuid,
  tenant_id uuid,
  job_type text,
  run_id uuid,
  conversation_id uuid,
  created_by_user_id uuid,
  status text,
  payload jsonb,
  lease_owner text,
  lease_token text,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  retry_count integer,
  next_attempt_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job ai_chat_jobs%rowtype;
  v_token text := gen_random_uuid()::text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select * into v_job
  from ai_chat_jobs j
  where j.status in ('queued', 'retryable_failed')
     or (j.status = 'processing' and j.lease_expires_at <= now())
  order by j.created_at asc
  limit 1
  for update skip locked;

  if not found then
    return;
  end if;

  update ai_chat_jobs
  set status = 'processing',
      lease_owner = p_worker_id,
      lease_token = v_token,
      lease_expires_at = now() + make_interval(secs => p_lease_ms / 1000.0),
      heartbeat_at = now(),
      updated_at = now()
  where ai_chat_jobs.id = v_job.id
  returning * into v_job;

  return query select
    v_job.id,
    v_job.tenant_id,
    v_job.job_type,
    v_job.run_id,
    v_job.conversation_id,
    v_job.created_by_user_id,
    v_job.status,
    v_job.payload,
    v_job.lease_owner,
    v_job.lease_token,
    v_job.lease_expires_at,
    v_job.heartbeat_at,
    v_job.retry_count,
    v_job.next_attempt_at,
    v_job.created_at,
    v_job.updated_at;
end;
$$;

create or replace function p85_stage_4c_complete_ai_chat_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  update ai_chat_jobs
  set status = 'completed',
      lease_owner = null,
      lease_token = null,
      updated_at = now()
  where id = p_job_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token;
end;
$$;

create or replace function p85_stage_4c_fail_ai_chat_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  update ai_chat_jobs
  set retry_count = retry_count + 1,
      status = case when retry_count + 1 >= 3 then 'permanently_failed' else 'retryable_failed' end,
      payload = payload || jsonb_build_object('lastError', p_error_code),
      lease_owner = null,
      lease_token = null,
      updated_at = now()
  where id = p_job_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token;
end;
$$;

create or replace function p85_stage_4c_renew_ai_chat_job_lease_v1(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_lease_ms integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  update ai_chat_jobs
  set lease_expires_at = now() + make_interval(secs => p_lease_ms / 1000.0),
      heartbeat_at = now(),
      updated_at = now()
  where id = p_job_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token;
end;
$$;

-- send/edit/regenerate/commit/finalize RPCs are implemented in follow-up slices;
-- Faz 5 local closure uses deterministic in-memory store for integration tests.

revoke all on function p85_stage_4c_append_run_event_v1(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function p85_stage_4c_list_run_events_v1(uuid, uuid, uuid, text, uuid, bigint) from public, anon, authenticated;
revoke all on function p85_stage_4c_stop_run_v1(uuid, uuid, uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_claim_ai_chat_job_v1(text, integer) from public, anon, authenticated;
revoke all on function p85_stage_4c_complete_ai_chat_job_v1(uuid, text, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_fail_ai_chat_job_v1(uuid, text, text, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_renew_ai_chat_job_lease_v1(uuid, text, text, integer) from public, anon, authenticated;

grant execute on function p85_stage_4c_append_run_event_v1(uuid, uuid, text, jsonb) to service_role;
grant execute on function p85_stage_4c_list_run_events_v1(uuid, uuid, uuid, text, uuid, bigint) to service_role;
grant execute on function p85_stage_4c_stop_run_v1(uuid, uuid, uuid, text, uuid, text, text) to service_role;
grant execute on function p85_stage_4c_claim_ai_chat_job_v1(text, integer) to service_role;
grant execute on function p85_stage_4c_complete_ai_chat_job_v1(uuid, text, text) to service_role;
grant execute on function p85_stage_4c_fail_ai_chat_job_v1(uuid, text, text, text) to service_role;
grant execute on function p85_stage_4c_renew_ai_chat_job_lease_v1(uuid, text, text, integer) to service_role;
