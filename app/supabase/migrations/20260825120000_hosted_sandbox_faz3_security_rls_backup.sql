-- Hosted Sandbox Faz 3: RLS helper hardening and function EXECUTE grant closure.
-- Inventory target: SECURITY DEFINER helpers used by authenticated RLS policies.

create or replace function public.dietitian_belongs_to_tenant(target_dietitian_id uuid, target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.dietitians d
    where d.id = target_dietitian_id
      and d.tenant_id = target_tenant_id
      and exists (
        select 1
        from public.tenant_memberships tm
        where tm.tenant_id = target_tenant_id
          and tm.user_id = auth.uid()
      )
  )
$$;

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'current_tenant_id',
        'current_tenant_role',
        'current_dietitian_id',
        'has_tenant_role',
        'can_read_client',
        'can_write_client',
        'can_create_client',
        'can_read_conversation',
        'can_write_conversation',
        'can_access_internal_copilot',
        'dietitian_belongs_to_tenant'
      )
  loop
    execute format('revoke all on function %s from public', fn.signature);
    execute format('revoke all on function %s from anon', fn.signature);
    execute format('grant execute on function %s to authenticated, service_role', fn.signature);
  end loop;
end $$;

comment on function public.dietitian_belongs_to_tenant(uuid, uuid) is
  'Hosted Sandbox Faz 3: requires auth.uid() tenant membership before affirming dietitian tenancy.';
