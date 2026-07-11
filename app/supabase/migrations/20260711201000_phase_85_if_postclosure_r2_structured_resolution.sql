-- P85-IF post-closure audit: resolve structured-update notifications against the target panel revision.

create or replace function p85_if_postclosure_resolve_structured_update_notification(
  p_tenant_id uuid,
  p_notification_id uuid,
  p_dietitian_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_row notifications%rowtype;
  target_client_id uuid;
  current_revision integer := 0;
  selected_revision integer;
  selected_updated_at timestamptz;
  resolved_at_value timestamptz := now();
begin
  if not exists (
    select 1 from dietitians
    where id = p_dietitian_id and tenant_id = p_tenant_id
  ) then
    raise exception 'dietitian_not_found';
  end if;

  select * into notification_row
  from notifications
  where tenant_id = p_tenant_id and id = p_notification_id
  for update;

  if not found then raise exception 'notification_not_found'; end if;
  if notification_row.resolved_at is not null
    or notification_row.dedupe_key is null
    or notification_row.dedupe_key not like 'p85-if-e:structured:%'
  then
    raise exception 'structured_update_notification_not_resolvable';
  end if;
  if notification_row.baseline_revision is null then
    raise exception 'structured_update_revision_pending';
  end if;

  target_client_id := notification_row.entity_id::uuid;

  case notification_row.target_panel
    when 'menu' then
      select revision into selected_revision
      from client_menu_plans
      where tenant_id = p_tenant_id and client_id = target_client_id
      order by revision desc
      limit 1
      for update;
      current_revision := coalesce(selected_revision, 0);
    when 'active_nutrition_plan' then
      select revision into selected_revision
      from client_food_rule_profiles
      where tenant_id = p_tenant_id and client_id = target_client_id
      order by revision desc
      limit 1
      for update;
      current_revision := coalesce(selected_revision, 0);
    when 'client_form' then
      select updated_at into selected_updated_at
      from client_form_responses
      where tenant_id = p_tenant_id and client_id = target_client_id
      order by updated_at desc
      limit 1
      for update;
      current_revision := coalesce(extract(epoch from selected_updated_at)::integer, 0);
    when 'diet_plan' then
      select context_revision into current_revision
      from clients
      where tenant_id = p_tenant_id and id = target_client_id
      for update;
      if not found then raise exception 'client_not_found'; end if;
    else
      raise exception 'structured_update_target_panel_invalid';
  end case;

  if current_revision <= notification_row.baseline_revision then
    raise exception 'structured_update_revision_pending';
  end if;

  update notifications
  set acknowledged_at = coalesce(acknowledged_at, resolved_at_value),
      resolved_at = resolved_at_value,
      resolved_by_dietitian_id = p_dietitian_id
  where tenant_id = p_tenant_id and id = p_notification_id;

  return jsonb_build_object(
    'ok', true,
    'notificationId', p_notification_id,
    'targetPanel', notification_row.target_panel,
    'baselineRevision', notification_row.baseline_revision,
    'resolvedRevision', current_revision
  );
end;
$$;

revoke all on function p85_if_postclosure_resolve_structured_update_notification(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function p85_if_postclosure_resolve_structured_update_notification(uuid, uuid, uuid)
  to service_role;
