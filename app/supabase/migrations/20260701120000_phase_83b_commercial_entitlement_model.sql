-- Phase 83B: invite allowlist, tenant entitlement, billing mapping, event ledger, mobile install audit.

create type commercial_entitlement_status as enum (
  'invited',
  'checkout_started',
  'active',
  'past_due',
  'canceled',
  'revoked'
);

create type commercial_invite_status as enum (
  'active',
  'revoked',
  'consumed'
);

create table commercial_invites (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null,
  invite_token_hash text not null,
  status commercial_invite_status not null default 'active',
  tenant_seed_metadata jsonb not null default '{}',
  tenant_id uuid references tenants(id) on delete set null,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_invites_email_check check (normalized_email = lower(trim(normalized_email))),
  constraint commercial_invites_token_hash_check check (length(invite_token_hash) = 64)
);

create unique index commercial_invites_active_email_idx
  on commercial_invites (normalized_email)
  where status = 'active';

create index commercial_invites_token_hash_idx
  on commercial_invites (invite_token_hash);

create table tenant_entitlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references tenants(id) on delete cascade,
  commercial_invite_id uuid references commercial_invites(id) on delete set null,
  status commercial_entitlement_status not null default 'invited',
  stripe_customer_id text,
  stripe_subscription_id text,
  checkout_session_id text,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenant_entitlements_status_idx
  on tenant_entitlements (status, updated_at desc);

create table billing_customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references tenants(id) on delete cascade,
  commercial_invite_id uuid references commercial_invites(id) on delete set null,
  normalized_email text not null,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_customers_email_check check (normalized_email = lower(trim(normalized_email))),
  constraint billing_customers_stripe_customer_unique unique (stripe_customer_id)
);

create table billing_event_ledger (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  tenant_id uuid references tenants(id) on delete set null,
  idempotency_key text not null unique,
  payload_summary jsonb not null default '{}',
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index billing_event_ledger_tenant_processed_idx
  on billing_event_ledger (tenant_id, processed_at desc);

create table mobile_install_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  dietitian_id uuid references dietitians(id) on delete set null,
  auth_user_id uuid,
  event_type text not null,
  user_agent_summary text not null default '',
  created_at timestamptz not null default now(),
  constraint mobile_install_audit_event_type_check check (
    event_type in (
      'install_prompt_shown',
      'install_accepted',
      'install_dismissed',
      'ios_instructions_viewed',
      'offline_banner_shown',
      'stale_session_detected'
    )
  )
);

create index mobile_install_audit_events_tenant_created_idx
  on mobile_install_audit_events (tenant_id, created_at desc);

alter table commercial_invites enable row level security;
alter table tenant_entitlements enable row level security;
alter table billing_customers enable row level security;
alter table billing_event_ledger enable row level security;
alter table mobile_install_audit_events enable row level security;

create policy "tenant members read own entitlement"
on tenant_entitlements for select
using (is_tenant_member(tenant_id));

create policy "tenant owners read billing customer"
on billing_customers for select
using (has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[]));

create policy "tenant members read mobile install audit"
on mobile_install_audit_events for select
using (is_tenant_member(tenant_id));

create policy "tenant members insert own mobile install audit"
on mobile_install_audit_events for insert
with check (
  is_tenant_member(tenant_id)
  and auth.uid() = auth_user_id
);
