-- Hosted Sandbox technical debt closure: transactional demo tenant cleanup.

create or replace function public.cleanup_hosted_sandbox_demo_tenant(
  p_tenant_id uuid,
  p_expected_inventory jsonb,
  p_apply boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target record;
  row_count bigint;
  total_rows bigint := 0;
  post_total_rows bigint := 0;
  inventory jsonb := '[]'::jsonb;
  post_inventory jsonb := '[]'::jsonb;
  missing_inventory jsonb;
  unexpected_inventory jsonb;
begin
  if p_tenant_id is distinct from '00000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'cleanup_tenant_refused';
  end if;

  if jsonb_typeof(p_expected_inventory) is distinct from 'array' then
    raise exception 'cleanup_inventory_invalid';
  end if;

  create temporary table expected_cleanup_inventory (
    table_name name not null,
    column_name name not null,
    ordinal integer not null
  ) on commit drop;

  insert into expected_cleanup_inventory (table_name, column_name, ordinal)
  select (item.entry ->> 'table')::name, (item.entry ->> 'column')::name, item.ordinal::integer
  from jsonb_array_elements(p_expected_inventory) with ordinality as item(entry, ordinal);

  if exists (
    select 1
    from expected_cleanup_inventory
    group by table_name, column_name
    having count(*) > 1
  ) then
    raise exception 'cleanup_inventory_duplicate';
  end if;

  create temporary table actual_cleanup_inventory on commit drop as
  select c.relname::name as table_name, a.attname::name as column_name
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_attribute a on a.attrelid = c.oid
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and a.attnum > 0
    and not a.attisdropped
    and (
      (a.attname = 'tenant_id' and a.atttypid = 'uuid'::regtype)
      or (c.relname = 'tenants' and a.attname = 'id' and a.atttypid = 'uuid'::regtype)
    );

  select coalesce(jsonb_agg(jsonb_build_object('table', e.table_name::text, 'column', e.column_name::text)), '[]'::jsonb)
  into missing_inventory
  from expected_cleanup_inventory e
  where not exists (
    select 1
    from actual_cleanup_inventory a
    where a.table_name = e.table_name
      and a.column_name = e.column_name
  );

  if jsonb_array_length(missing_inventory) > 0 then
    raise exception 'cleanup_inventory_missing_live_column:%', missing_inventory;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('table', a.table_name::text, 'column', a.column_name::text)), '[]'::jsonb)
  into unexpected_inventory
  from actual_cleanup_inventory a
  where not exists (
    select 1
    from expected_cleanup_inventory e
    where e.table_name = a.table_name
      and e.column_name = a.column_name
  );

  if jsonb_array_length(unexpected_inventory) > 0 then
    raise exception 'tenant_scoped_table_missing_from_cleanup_inventory:%', unexpected_inventory;
  end if;

  for target in
    select table_name, column_name
    from expected_cleanup_inventory
    order by ordinal
  loop
    execute format('select count(*) from public.%I where %I = $1', target.table_name, target.column_name)
    into row_count
    using p_tenant_id;

    total_rows := total_rows + row_count;
    inventory := inventory || jsonb_build_array(
      jsonb_build_object(
        'table', target.table_name::text,
        'column', target.column_name::text,
        'count', row_count
      )
    );
  end loop;

  if not p_apply then
    return jsonb_build_object(
      'mode', 'dry-run',
      'tenantId', p_tenant_id,
      'inventory', inventory,
      'totalRows', total_rows,
      'deleted', false
    );
  end if;

  delete from public.tenants where id = p_tenant_id;

  for target in
    select table_name, column_name
    from expected_cleanup_inventory
    order by ordinal
  loop
    execute format('select count(*) from public.%I where %I = $1', target.table_name, target.column_name)
    into row_count
    using p_tenant_id;

    post_total_rows := post_total_rows + row_count;
    post_inventory := post_inventory || jsonb_build_array(
      jsonb_build_object(
        'table', target.table_name::text,
        'column', target.column_name::text,
        'count', row_count
      )
    );
  end loop;

  if post_total_rows <> 0 then
    raise exception 'cleanup_incomplete:%', post_inventory;
  end if;

  return jsonb_build_object(
    'mode', 'apply',
    'tenantId', p_tenant_id,
    'inventory', inventory,
    'totalRows', total_rows,
    'deleted', true,
    'postInventory', post_inventory,
    'postTotalRows', post_total_rows
  );
end;
$$;

revoke all on function public.cleanup_hosted_sandbox_demo_tenant(uuid, jsonb, boolean) from public;
revoke all on function public.cleanup_hosted_sandbox_demo_tenant(uuid, jsonb, boolean) from anon;
revoke all on function public.cleanup_hosted_sandbox_demo_tenant(uuid, jsonb, boolean) from authenticated;
grant execute on function public.cleanup_hosted_sandbox_demo_tenant(uuid, jsonb, boolean) to service_role;

comment on function public.cleanup_hosted_sandbox_demo_tenant(uuid, jsonb, boolean) is
  'Hosted Sandbox technical debt closure: validates tenant cleanup inventory against pg_catalog and deletes demo tenant rows transactionally.';
