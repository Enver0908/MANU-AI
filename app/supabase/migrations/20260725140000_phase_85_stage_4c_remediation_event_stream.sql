-- Phase 85 Stage 4C remediation Faz 7: Realtime publication for run events and bounded catch-up RPC.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ai_chat_run_events'
  ) then
    alter publication supabase_realtime add table public.ai_chat_run_events;
  end if;
end
$$;

create or replace function p85_stage_4c_catch_up_run_events_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_run_id uuid,
  p_after_sequence bigint,
  p_limit int default 200
)
returns setof ai_chat_run_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run ai_chat_runs%rowtype;
  v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 500);
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select * into v_run
  from ai_chat_runs
  where tenant_id = p_tenant_id and id = p_run_id;

  if not found or v_run.created_by_user_id <> p_user_id then
    raise exception 'ai_chat_run_not_found';
  end if;

  return query
  select *
  from ai_chat_run_events e
  where e.tenant_id = p_tenant_id
    and e.run_id = p_run_id
    and e.sequence_number > coalesce(p_after_sequence, 0)
  order by e.sequence_number asc
  limit v_limit;
end;
$$;

revoke all on function p85_stage_4c_catch_up_run_events_v1(uuid, uuid, uuid, text, uuid, bigint, int) from public, anon, authenticated;

grant execute on function p85_stage_4c_catch_up_run_events_v1(uuid, uuid, uuid, text, uuid, bigint, int) to service_role;
