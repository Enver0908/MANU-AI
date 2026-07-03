-- Phase 83F: commercial admin audit trail for invite and entitlement operations.

create table commercial_admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_summary text not null default 'commercial_admin',
  target_invite_id uuid references commercial_invites(id) on delete set null,
  target_tenant_id uuid references tenants(id) on delete set null,
  payload_summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint commercial_admin_audit_event_type_check check (
    event_type in (
      'invite_created',
      'invite_revoked',
      'entitlement_revoked',
      'ledger_inspected'
    )
  )
);

create index commercial_admin_audit_events_created_idx
  on commercial_admin_audit_events (created_at desc);

create index commercial_admin_audit_events_invite_idx
  on commercial_admin_audit_events (target_invite_id, created_at desc)
  where target_invite_id is not null;

create index commercial_admin_audit_events_tenant_idx
  on commercial_admin_audit_events (target_tenant_id, created_at desc)
  where target_tenant_id is not null;

alter table commercial_admin_audit_events enable row level security;

-- Service-role only; no tenant-member policies.
