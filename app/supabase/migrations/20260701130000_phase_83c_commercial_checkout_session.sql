-- Phase 83C: track in-flight checkout sessions on invites before tenant provisioning.

alter table commercial_invites
  add column if not exists checkout_session_id text,
  add column if not exists checkout_started_at timestamptz;

create index if not exists commercial_invites_checkout_session_idx
  on commercial_invites (checkout_session_id)
  where checkout_session_id is not null;
