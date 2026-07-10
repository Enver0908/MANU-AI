-- Phase 85 Interstage Foundation P85-IF-D: allow external_human_active human-control reason.

alter table human_control_sessions drop constraint if exists human_control_sessions_reason_check;

alter table human_control_sessions add constraint human_control_sessions_reason_check check (
  reason in (
    'yellow_risk_hold',
    'red_risk_lock',
    'manual_takeover',
    'channel_trust_gap',
    'external_human_active'
  )
);
