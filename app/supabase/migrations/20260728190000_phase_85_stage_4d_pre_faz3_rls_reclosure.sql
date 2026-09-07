-- Phase 85 Stage 4D pre-Faz 3: close direct dietitian profile mutation gap.

revoke insert, update, delete on table dietitians from anon, authenticated;
grant select on table dietitians to authenticated, service_role;
