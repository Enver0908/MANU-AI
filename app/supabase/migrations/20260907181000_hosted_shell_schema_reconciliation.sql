-- Reconcile the hosted schema after the public-surface session migration was
-- skipped while the application release advanced to the Faz 8 service-role RPC.
-- The full idle-timeout migration is applied first by migration ordering; this
-- final guard restores the intended least-privilege grants idempotently.

revoke all on function p85_stage_5_session_inactivity_window() from public, anon, authenticated;

revoke all on function p85_stage_5_record_session_activity_v3(text, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function p85_stage_5_record_session_activity_v3(text, uuid, uuid, uuid, uuid)
  to service_role;

revoke all on function p85_stage_5_record_session_activity_v2(text)
  from public, anon, authenticated;
grant execute on function p85_stage_5_record_session_activity_v2(text)
  to service_role;

revoke all on function p85_stage_5_assert_session_activity_v1()
  from public, anon, authenticated;
grant execute on function p85_stage_5_assert_session_activity_v1()
  to service_role;

revoke all on function p85_stage_5_touch_session_activity_v1()
  from public, anon, authenticated;
grant execute on function p85_stage_5_touch_session_activity_v1()
  to service_role;
