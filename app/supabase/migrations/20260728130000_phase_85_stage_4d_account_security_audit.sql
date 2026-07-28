-- Phase 85 Stage 4D Faz 4: account security audit events (no credential material).

create table account_security_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete set null,
  auth_user_id uuid not null,
  dietitian_id uuid references dietitians(id) on delete set null,
  event_type text not null,
  outcome text not null,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint account_security_event_type_check check (
    event_type in (
      'password_login',
      'reauthenticate_requested',
      'password_updated',
      'password_reset_requested',
      'email_change_requested',
      'logout_local',
      'recovery_password_set'
    )
  ),
  constraint account_security_outcome_check check (
    outcome in ('success', 'failure', 'accepted')
  ),
  constraint account_security_idempotency_key_unique unique (idempotency_key)
);

create index account_security_events_tenant_created_idx
  on account_security_events (tenant_id, created_at desc);

create index account_security_events_user_created_idx
  on account_security_events (auth_user_id, created_at desc);

alter table account_security_events enable row level security;

-- No insert/select policies for anon/authenticated; service role writes after route session verification.
