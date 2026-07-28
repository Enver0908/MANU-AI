-- Phase 85 Stage 4D Faz 3: self-scoped dietitian profile preferences (display_name, ui_language).

create or replace function p85_stage4d_update_own_profile(
  p_display_name text default null,
  p_ui_language text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_dietitian_id uuid;
  v_current dietitians%rowtype;
  v_display_name text;
  v_ui_language text;
  v_changed_fields text[] := '{}';
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  if p_display_name is null and p_ui_language is null then
    raise exception 'profile_patch_empty';
  end if;

  select tenant_id
    into v_tenant_id
  from tenant_memberships
  where user_id = v_user_id
  order by created_at asc
  limit 1;

  if v_tenant_id is null then
    raise exception 'no_tenant_membership';
  end if;

  select id
    into v_dietitian_id
  from dietitians
  where tenant_id = v_tenant_id
    and auth_user_id = v_user_id
  limit 1;

  if v_dietitian_id is null then
    raise exception 'no_dietitian_profile';
  end if;

  if not exists (
    select 1
    from tenant_entitlements te
    where te.tenant_id = v_tenant_id
      and te.status = 'active'
  ) then
    raise exception 'inactive_subscription';
  end if;

  select *
    into v_current
  from dietitians
  where id = v_dietitian_id
    and tenant_id = v_tenant_id
    and auth_user_id = v_user_id
  for update;

  if not found then
    raise exception 'no_dietitian_profile';
  end if;

  if p_display_name is not null then
    v_display_name := trim(p_display_name);
    if length(v_display_name) < 2 or length(v_display_name) > 80 then
      raise exception 'invalid_display_name';
    end if;
    if v_display_name ~ '[[:cntrl:]]' then
      raise exception 'invalid_display_name';
    end if;
    if v_display_name <> v_current.display_name then
      v_changed_fields := array_append(v_changed_fields, 'displayName');
    end if;
  else
    v_display_name := v_current.display_name;
  end if;

  if p_ui_language is not null then
    v_ui_language := trim(p_ui_language);
    if v_ui_language not in ('tr', 'en', 'de', 'fr', 'es', 'pt', 'cs') then
      raise exception 'invalid_ui_language';
    end if;
    if v_ui_language <> v_current.ui_language then
      v_changed_fields := array_append(v_changed_fields, 'uiLanguage');
    end if;
  else
    v_ui_language := v_current.ui_language;
  end if;

  if cardinality(v_changed_fields) > 0 then
    update dietitians
      set display_name = v_display_name,
          ui_language = v_ui_language
    where id = v_dietitian_id
      and tenant_id = v_tenant_id
      and auth_user_id = v_user_id;

    insert into audit_events (
      tenant_id,
      actor_type,
      actor_id,
      event_type,
      entity_type,
      entity_id,
      metadata,
      created_at
    ) values (
      v_tenant_id,
      'dietitian',
      v_dietitian_id::text,
      'stage_4d_own_profile_updated',
      'dietitian',
      v_dietitian_id::text,
      jsonb_build_object(
        'changedFields', to_jsonb(v_changed_fields),
        'minimized', true
      ),
      v_now
    );
  end if;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'displayName', v_display_name,
      'uiLanguage', v_ui_language
    ),
    'changedFields', to_jsonb(v_changed_fields)
  );
end;
$$;

revoke all on function p85_stage4d_update_own_profile(text, text) from public;
grant execute on function p85_stage4d_update_own_profile(text, text) to authenticated, service_role;
