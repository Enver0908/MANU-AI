-- Production readiness stage 1 phase 3: real WhatsApp account, ingress, and delivery contracts.
-- This migration prepares the real WhatsApp path without enabling live traffic by itself.

alter table channel_account_bindings drop constraint if exists channel_account_bindings_operating_mode_check;
alter table channel_account_bindings add constraint channel_account_bindings_operating_mode_check
  check (operating_mode in ('mock', 'disabled', 'future_real', 'real'));

create unique index if not exists channel_account_bindings_tenant_single_active_real_whatsapp_idx
  on channel_account_bindings (tenant_id)
  where provider = 'whatsapp_cloud'
    and operating_mode = 'real'
    and lifecycle_status = 'active'
    and revoked_at is null;

create table if not exists whatsapp_connection_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  requested_by_user_id uuid not null,
  account_binding_id uuid references channel_account_bindings(id) on delete set null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_connection_attempts_status_check check (
    status in ('pending', 'completed', 'canceled', 'expired', 'failed')
  ),
  constraint whatsapp_connection_attempts_terminal_timestamp_check check (
    (status = 'completed' and consumed_at is not null)
    or (status = 'canceled' and canceled_at is not null)
    or status in ('pending', 'expired', 'failed')
  )
);

create index if not exists whatsapp_connection_attempts_tenant_status_idx
  on whatsapp_connection_attempts (tenant_id, status, created_at desc);

create table if not exists whatsapp_channel_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_binding_id uuid not null references channel_account_bindings(id) on delete cascade,
  waba_id text not null,
  business_phone_number_id text not null,
  encrypted_access_token text not null,
  encrypted_app_secret text not null,
  token_key_version text not null,
  secret_key_version text not null,
  encryption_aad text not null,
  lifecycle_status text not null default 'active',
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_channel_credentials_lifecycle_check check (lifecycle_status in ('active', 'revoked')),
  constraint whatsapp_channel_credentials_revoke_timestamp_check check (
    (lifecycle_status = 'revoked' and revoked_at is not null)
    or lifecycle_status = 'active'
  ),
  constraint whatsapp_channel_credentials_tenant_binding_unique unique (tenant_id, account_binding_id)
);

create unique index if not exists whatsapp_channel_credentials_phone_active_idx
  on whatsapp_channel_credentials (business_phone_number_id)
  where lifecycle_status = 'active' and revoked_at is null;

create table if not exists whatsapp_ingress_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_binding_id uuid not null references channel_account_bindings(id) on delete cascade,
  channel_event_id uuid references channel_events(id) on delete set null,
  event_kind text not null,
  provider_account_id text,
  provider_event_id text,
  provider_message_id text,
  from_identity text,
  to_identity text,
  counterparty_identity text,
  payload_digest text not null,
  payload_schema_version text not null,
  payload_ciphertext text not null,
  payload_iv text not null,
  payload_auth_tag text not null,
  payload_aad text not null,
  payload_key_version text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  lease_owner text,
  lease_until timestamptz,
  failure_reason text,
  provider_time timestamptz,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_ingress_jobs_status_check check (
    status in ('pending', 'leased', 'processed', 'failed', 'quarantined')
  ),
  constraint whatsapp_ingress_jobs_attempts_check check (attempts >= 0 and max_attempts between 1 and 10)
);

create unique index if not exists whatsapp_ingress_jobs_event_once_idx
  on whatsapp_ingress_jobs (tenant_id, provider_event_id)
  where provider_event_id is not null and status <> 'quarantined';

create index if not exists whatsapp_ingress_jobs_pending_idx
  on whatsapp_ingress_jobs (status, observed_at)
  where status in ('pending', 'leased');

alter table channel_deliveries
  add column if not exists real_provider_message_id text,
  add column if not exists execution_state text not null default 'accepted',
  add column if not exists retry_count integer not null default 0,
  add column if not exists next_retry_at timestamptz,
  add column if not exists provider_error_category text;

alter table channel_deliveries drop constraint if exists channel_deliveries_status_check;
alter table channel_deliveries add constraint channel_deliveries_status_check
  check (delivery_status in ('accepted', 'sent', 'delivered', 'read', 'failed', 'unknown'));

alter table channel_deliveries drop constraint if exists channel_deliveries_execution_state_check;
alter table channel_deliveries add constraint channel_deliveries_execution_state_check
  check (execution_state in ('queued', 'sending', 'accepted', 'sent', 'delivered', 'read', 'failed', 'unknown'));

alter table channel_deliveries drop constraint if exists channel_deliveries_provider_error_category_check;
alter table channel_deliveries add constraint channel_deliveries_provider_error_category_check
  check (
    provider_error_category is null
    or provider_error_category in ('definite_temporary', 'definite_permanent', 'ambiguous_network')
  );

alter table channel_deliveries drop constraint if exists channel_deliveries_retry_count_check;
alter table channel_deliveries add constraint channel_deliveries_retry_count_check
  check (retry_count >= 0 and retry_count <= 3);

create index if not exists channel_deliveries_real_provider_message_idx
  on channel_deliveries (tenant_id, real_provider_message_id)
  where real_provider_message_id is not null;

create or replace function enqueue_whatsapp_real_ingress_job(
  p_account_binding_id uuid,
  p_tenant_id uuid,
  p_event_kind text,
  p_provider_account_id text,
  p_provider_event_id text,
  p_provider_message_id text,
  p_from_identity text,
  p_to_identity text,
  p_counterparty_identity text,
  p_payload_digest text,
  p_payload_ciphertext text,
  p_payload_iv text,
  p_payload_auth_tag text,
  p_payload_aad text,
  p_key_version text,
  p_payload_schema_version text,
  p_provider_time timestamptz,
  p_observed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_binding channel_account_bindings%rowtype;
  v_existing_event channel_events%rowtype;
  v_event_id uuid;
  v_job_id uuid;
begin
  select *
    into v_binding
    from channel_account_bindings
    where id = p_account_binding_id
      and tenant_id = p_tenant_id
      and provider = 'whatsapp_cloud'
      and operating_mode = 'real'
      and lifecycle_status = 'active'
      and revoked_at is null
    for update;

  if not found then
    return jsonb_build_object('status', 'ignored', 'reason', 'unknown_or_inactive_account');
  end if;

  if p_provider_event_id is not null then
    select *
      into v_existing_event
      from channel_events
      where tenant_id = p_tenant_id
        and provider_event_id = p_provider_event_id
      for update;

    if found then
      if v_existing_event.payload_digest = p_payload_digest then
        return jsonb_build_object('status', 'duplicate', 'channelEventId', v_existing_event.id);
      end if;

      insert into whatsapp_ingress_jobs (
        tenant_id, account_binding_id, event_kind, provider_account_id, provider_event_id,
        provider_message_id, from_identity, to_identity, counterparty_identity, payload_digest,
        payload_schema_version, payload_ciphertext, payload_iv, payload_auth_tag, payload_aad,
        payload_key_version, status, failure_reason, provider_time, observed_at
      )
      values (
        p_tenant_id, p_account_binding_id, 'duplicate_event', p_provider_account_id, p_provider_event_id,
        p_provider_message_id, p_from_identity, p_to_identity, p_counterparty_identity, p_payload_digest,
        p_payload_schema_version, p_payload_ciphertext, p_payload_iv, p_payload_auth_tag, p_payload_aad,
        p_key_version, 'quarantined', 'provider_event_id_reused_with_different_digest',
        p_provider_time, coalesce(p_observed_at, now())
      )
      returning id into v_job_id;

      return jsonb_build_object('status', 'quarantined', 'jobId', v_job_id, 'reason', 'digest_mismatch_replay');
    end if;
  end if;

  insert into channel_events (
    id, tenant_id, account_binding_id, event_kind, processing_status,
    provider_account_id, provider_event_id, provider_message_id,
    from_identity, to_identity, counterparty_identity,
    payload_digest, payload_schema_version, provider_time, observed_at
  )
  values (
    gen_random_uuid(), p_tenant_id, p_account_binding_id, p_event_kind, 'received',
    p_provider_account_id, p_provider_event_id, p_provider_message_id,
    p_from_identity, p_to_identity, p_counterparty_identity,
    p_payload_digest, p_payload_schema_version, p_provider_time, coalesce(p_observed_at, now())
  )
  returning id into v_event_id;

  insert into whatsapp_ingress_jobs (
    tenant_id, account_binding_id, channel_event_id, event_kind, provider_account_id,
    provider_event_id, provider_message_id, from_identity, to_identity, counterparty_identity,
    payload_digest, payload_schema_version, payload_ciphertext, payload_iv, payload_auth_tag,
    payload_aad, payload_key_version, status, provider_time, observed_at
  )
  values (
    p_tenant_id, p_account_binding_id, v_event_id, p_event_kind, p_provider_account_id,
    p_provider_event_id, p_provider_message_id, p_from_identity, p_to_identity, p_counterparty_identity,
    p_payload_digest, p_payload_schema_version, p_payload_ciphertext, p_payload_iv, p_payload_auth_tag,
    p_payload_aad, p_key_version, 'pending', p_provider_time, coalesce(p_observed_at, now())
  )
  returning id into v_job_id;

  return jsonb_build_object('status', 'queued', 'channelEventId', v_event_id, 'jobId', v_job_id);
end;
$$;

alter table whatsapp_connection_attempts enable row level security;
alter table whatsapp_channel_credentials enable row level security;
alter table whatsapp_ingress_jobs enable row level security;

revoke all on table whatsapp_connection_attempts from public, anon, authenticated;
revoke all on table whatsapp_channel_credentials from public, anon, authenticated;
revoke all on table whatsapp_ingress_jobs from public, anon, authenticated;
revoke all on function enqueue_whatsapp_real_ingress_job(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, timestamptz, timestamptz
) from public, anon, authenticated;

grant select, insert, update, delete on table whatsapp_connection_attempts to service_role;
grant select, insert, update, delete on table whatsapp_channel_credentials to service_role;
grant select, insert, update, delete on table whatsapp_ingress_jobs to service_role;
grant execute on function enqueue_whatsapp_real_ingress_job(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, timestamptz, timestamptz
) to service_role;
