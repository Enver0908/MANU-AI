-- Phase 85 Stage 4C operational-table RLS reclosure.
-- These queue/lifecycle tables are service-role mediated and have no direct
-- anon or authenticated access contract.

revoke all on table public.ai_chat_jobs from public, anon, authenticated;
grant all on table public.ai_chat_jobs to service_role;
alter table public.ai_chat_jobs enable row level security;

drop policy if exists "p85 stage4c ai chat jobs deny direct access" on public.ai_chat_jobs;
create policy "p85 stage4c ai chat jobs deny direct access"
on public.ai_chat_jobs for all
using (false)
with check (false);

revoke all on table public.ai_chat_deletion_jobs from public, anon, authenticated;
grant all on table public.ai_chat_deletion_jobs to service_role;
alter table public.ai_chat_deletion_jobs enable row level security;

drop policy if exists "p85 stage4c deletion jobs deny direct access" on public.ai_chat_deletion_jobs;
create policy "p85 stage4c deletion jobs deny direct access"
on public.ai_chat_deletion_jobs for all
using (false)
with check (false);

revoke all on table public.ai_chat_deletion_ledger from public, anon, authenticated;
grant all on table public.ai_chat_deletion_ledger to service_role;
alter table public.ai_chat_deletion_ledger enable row level security;

drop policy if exists "p85 stage4c deletion ledger deny direct access" on public.ai_chat_deletion_ledger;
create policy "p85 stage4c deletion ledger deny direct access"
on public.ai_chat_deletion_ledger for all
using (false)
with check (false);

revoke all on table public.ai_chat_legal_holds from public, anon, authenticated;
grant all on table public.ai_chat_legal_holds to service_role;
alter table public.ai_chat_legal_holds enable row level security;

drop policy if exists "p85 stage4c legal holds deny direct access" on public.ai_chat_legal_holds;
create policy "p85 stage4c legal holds deny direct access"
on public.ai_chat_legal_holds for all
using (false)
with check (false);
