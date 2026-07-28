-- Phase 85 Stage 4D remediation phase 1: profile and tenant/account foundation.

alter table tenants
  add column if not exists settings_revision integer not null default 0;

create or replace function p85_stage4d_update_own_profile_v2(
  p_display_name text default null,
  p_ui_language text default null,
  p_timezone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_role tenant_role;
  v_dietitian_id uuid;
  v_current dietitians%rowtype;
  v_display_name text;
  v_ui_language text;
  v_timezone text;
  v_changed_fields text[] := '{}';
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  if p_display_name is null and p_ui_language is null and p_timezone is null then
    raise exception 'profile_patch_empty';
  end if;

  select tm.tenant_id, tm.role
    into v_tenant_id, v_role
  from tenant_memberships tm
  where tm.user_id = v_user_id
  order by tm.created_at asc
  limit 1;

  if v_tenant_id is null then
    raise exception 'no_tenant_membership';
  end if;

  if v_role not in ('owner', 'admin', 'dietitian') then
    raise exception 'rbac_forbidden_update_own_profile';
  end if;

  select *
    into v_current
  from dietitians
  where tenant_id = v_tenant_id
    and auth_user_id = v_user_id
  limit 1
  for update;

  if not found then
    raise exception 'no_dietitian_profile';
  end if;

  v_dietitian_id := v_current.id;

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

  if p_timezone is not null then
    v_timezone := trim(p_timezone);
    if not exists (select 1 from pg_timezone_names where name = v_timezone) then
      raise exception 'invalid_timezone';
    end if;
    if v_timezone <> v_current.timezone then
      v_changed_fields := array_append(v_changed_fields, 'timezone');
    end if;
  else
    v_timezone := v_current.timezone;
  end if;

  if cardinality(v_changed_fields) > 0 then
    update dietitians
      set display_name = v_display_name,
          ui_language = v_ui_language,
          timezone = v_timezone
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
        'minimized', true,
        'contractVersion', 'p85-stage-4d-own-profile-v2'
      ),
      v_now
    );
  end if;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'displayName', v_display_name,
      'uiLanguage', v_ui_language,
      'timezone', v_timezone
    ),
    'changedFields', to_jsonb(v_changed_fields)
  );
end;
$$;

revoke all on function p85_stage4d_update_own_profile_v2(text, text, text) from public, anon;
grant execute on function p85_stage4d_update_own_profile_v2(text, text, text) to authenticated, service_role;

create or replace function p85_stage4d_update_account_workspace(
  p_name text,
  p_expected_settings_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_role tenant_role;
  v_current_name text;
  v_current_revision integer;
  v_name text;
  v_next_revision integer;
  v_dietitian_id uuid;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  if p_expected_settings_revision is null or p_expected_settings_revision < 0 then
    raise exception 'invalid_expected_settings_revision';
  end if;

  select tm.tenant_id, tm.role
    into v_tenant_id, v_role
  from tenant_memberships tm
  where tm.user_id = v_user_id
  order by tm.created_at asc
  limit 1;

  if v_tenant_id is null then
    raise exception 'no_tenant_membership';
  end if;

  if v_role not in ('owner', 'admin') then
    raise exception 'rbac_forbidden_manage_account_settings';
  end if;

  v_name := trim(coalesce(p_name, ''));
  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'invalid_workspace_name';
  end if;
  if v_name ~ '[[:cntrl:]]' then
    raise exception 'invalid_workspace_name';
  end if;

  select name, settings_revision
    into v_current_name, v_current_revision
  from tenants
  where id = v_tenant_id
  for update;

  if not found then
    raise exception 'no_tenant_membership';
  end if;

  if v_current_revision <> p_expected_settings_revision then
    raise exception 'settings_revision_conflict';
  end if;

  if v_name <> v_current_name then
    v_next_revision := v_current_revision + 1;
    update tenants
      set name = v_name,
          settings_revision = v_next_revision
    where id = v_tenant_id;

    select id
      into v_dietitian_id
    from dietitians
    where tenant_id = v_tenant_id
      and auth_user_id = v_user_id
    limit 1;

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
      coalesce(v_dietitian_id::text, v_user_id::text),
      'stage_4d_account_workspace_updated',
      'tenant',
      v_tenant_id::text,
      jsonb_build_object(
        'changedFields', jsonb_build_array('name'),
        'previousRevision', v_current_revision,
        'nextRevision', v_next_revision,
        'minimized', true
      ),
      now()
    );
  else
    v_next_revision := v_current_revision;
  end if;

  return jsonb_build_object(
    'name', v_name,
    'settingsRevision', v_next_revision,
    'role', v_role,
    'membershipActive', true
  );
end;
$$;

revoke all on function p85_stage4d_update_account_workspace(text, integer) from public, anon;
grant execute on function p85_stage4d_update_account_workspace(text, integer) to authenticated, service_role;

create or replace function p85_stage4d_read_account_members()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_role tenant_role;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select tm.tenant_id, tm.role
    into v_tenant_id, v_role
  from tenant_memberships tm
  where tm.user_id = v_user_id
  order by tm.created_at asc
  limit 1;

  if v_tenant_id is null then
    raise exception 'no_tenant_membership';
  end if;

  if v_role not in ('owner', 'admin') then
    raise exception 'rbac_forbidden_read_account_members';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'displayName', coalesce(d.display_name, 'Team member'),
          'role', tm.role,
          'membershipActive', true,
          'joinedAt', tm.created_at
        )
        order by tm.created_at asc
      )
      from tenant_memberships tm
      left join dietitians d
        on d.tenant_id = tm.tenant_id
       and d.auth_user_id = tm.user_id
      where tm.tenant_id = v_tenant_id
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function p85_stage4d_read_account_members() from public, anon;
grant execute on function p85_stage4d_read_account_members() to authenticated, service_role;

