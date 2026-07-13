-- Phase 85 Stage 4B-2 security advisory RLS hardening.
-- Closes local Supabase advisory for RLS-disabled internal/reference tables
-- without adding direct anon/authenticated access policies.

revoke all on table public.conversation_mutation_idempotency from public, anon, authenticated;
grant all on table public.conversation_mutation_idempotency to service_role;
alter table public.conversation_mutation_idempotency enable row level security;

revoke all on table public.personas from public, anon, authenticated;
grant all on table public.personas to service_role;
alter table public.personas enable row level security;
