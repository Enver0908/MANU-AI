-- Phase 85 Stage 4C remediation: allow authenticated RLS policy evaluation helpers.
-- These SECURITY DEFINER helpers are referenced inside authenticated SELECT policies.

revoke all on function p85_stage_4c_actor_owns_chat(uuid, uuid, uuid) from public, anon;
revoke all on function p85_stage_4c_actor_can_access_client_chat(uuid, uuid, uuid, uuid, text) from public, anon;
revoke all on function p85_stage_4c_actor_can_read_chat_row(uuid, uuid, uuid, uuid, text) from public, anon;

grant execute on function p85_stage_4c_actor_owns_chat(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function p85_stage_4c_actor_can_access_client_chat(uuid, uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function p85_stage_4c_actor_can_read_chat_row(uuid, uuid, uuid, uuid, text) to authenticated, service_role;
