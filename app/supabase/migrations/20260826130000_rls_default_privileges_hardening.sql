-- Hosted Sandbox technical debt closure: RLS helper EXECUTE defaults and SECURITY DEFINER public closure.

alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format('revoke execute on function %s from public', fn.signature);
    execute format('revoke execute on function %s from anon', fn.signature);
  end loop;
end $$;

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
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
    execute format('grant execute on function %s to authenticated, service_role', fn.signature);
  end loop;
end $$;
