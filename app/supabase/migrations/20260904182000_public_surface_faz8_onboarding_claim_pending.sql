-- Faz 8: persist password-ready / claim-pending onboarding recovery without secrets.

alter table commercial_onboarding_events
  drop constraint if exists commercial_onboarding_event_type_check;

alter table commercial_onboarding_events
  add constraint commercial_onboarding_event_type_check check (
    event_type in (
      'magic_link_requested',
      'claim_completed',
      'claim_blocked',
      'claim_pending'
    )
  );

create index if not exists commercial_onboarding_events_user_invite_created_idx
  on commercial_onboarding_events (auth_user_id, commercial_invite_id, created_at desc);
