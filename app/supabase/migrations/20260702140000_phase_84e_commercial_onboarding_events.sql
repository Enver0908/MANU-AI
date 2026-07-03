-- Phase 84E: post-payment customer onboarding audit events (service-role API only).

create table commercial_onboarding_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  normalized_email text not null,
  auth_user_id uuid,
  commercial_invite_id uuid references commercial_invites(id) on delete set null,
  tenant_id uuid references tenants(id) on delete set null,
  checkout_session_id text,
  payload_summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint commercial_onboarding_event_type_check check (
    event_type in ('magic_link_requested', 'claim_completed', 'claim_blocked')
  )
);

create index commercial_onboarding_events_checkout_created_idx
  on commercial_onboarding_events (checkout_session_id, created_at desc);

create index commercial_onboarding_events_email_created_idx
  on commercial_onboarding_events (normalized_email, created_at desc);

alter table commercial_onboarding_events enable row level security;
