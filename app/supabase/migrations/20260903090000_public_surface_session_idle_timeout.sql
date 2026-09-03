-- Public surface Phase 2: replace live session idle RPCs with a 2-hour server-authoritative window.
-- Historical migrations keep the previous 15-minute window as append-only history.

create or replace function p85_stage_5_session_inactivity_window()
returns interval
language sql
immutable
parallel safe
set search_path = public
as $$
  select interval '2 hours';
$$;

create or replace function p85_stage_5_record_session_activity_v2(
  p_mode text default 'assert'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_tenant_id uuid;
  v_auth_user_id uuid;
  v_dietitian_id uuid;
  v_role text;
  v_now timestamptz := now();
  v_mode text := trim(coalesce(p_mode, 'assert'));
  v_row app_session_activity%rowtype;
  v_inactivity constant interval := p85_stage_5_session_inactivity_window();
  v_touch_cooldown constant interval := interval '1 minute';
begin
  if v_mode not in ('assert', 'touch') then
    raise exception 'invalid_session_activity_mode';
  end if;

  v_session_id := p85_stage_5_read_session_claim();
  select actor.tenant_id, actor.auth_user_id, actor.dietitian_id, actor.role
    into v_tenant_id, v_auth_user_id, v_dietitian_id, v_role
  from p85_stage_5_resolve_shell_actor(v_session_id) actor;

  select *
    into v_row
  from app_session_activity
  where session_id = v_session_id
  for update;

  if not found then
    insert into app_session_activity (
      session_id,
      tenant_id,
      auth_user_id,
      dietitian_id,
      last_interactive_at,
      created_at,
      updated_at
    ) values (
      v_session_id,
      v_tenant_id,
      v_auth_user_id,
      v_dietitian_id,
      v_now,
      v_now,
      v_now
    )
    returning * into v_row;

    perform p85_stage_5_insert_session_security_event(
      v_tenant_id,
      v_auth_user_id,
      v_dietitian_id,
      'session_started',
      v_session_id::text
    );

    return jsonb_build_object(
      'status', 'active',
      'sessionId', v_session_id,
      'locked', false,
      'lastInteractiveAt', v_row.last_interactive_at,
      'lockedAt', null,
      'touched', v_mode = 'touch'
    );
  end if;

  if v_row.tenant_id <> v_tenant_id or v_row.auth_user_id <> v_auth_user_id then
    raise exception 'session_claim_mismatch';
  end if;

  if v_row.locked_at is not null then
    return jsonb_build_object(
      'status', 'locked',
      'sessionId', v_session_id,
      'locked', true,
      'lastInteractiveAt', v_row.last_interactive_at,
      'lockedAt', v_row.locked_at,
      'touched', false
    );
  end if;

  if v_row.last_interactive_at + v_inactivity <= v_now then
    update app_session_activity
      set locked_at = v_now,
          updated_at = v_now
    where session_id = v_session_id
      and locked_at is null
    returning * into v_row;

    perform p85_stage_5_insert_session_security_event(
      v_tenant_id,
      v_auth_user_id,
      v_dietitian_id,
      'session_locked',
      v_session_id::text || ':' || floor(extract(epoch from v_now))::bigint::text
    );

    return jsonb_build_object(
      'status', 'locked',
      'sessionId', v_session_id,
      'locked', true,
      'lastInteractiveAt', v_row.last_interactive_at,
      'lockedAt', v_row.locked_at,
      'touched', false
    );
  end if;

  if v_mode = 'touch' then
    update app_session_activity
      set last_interactive_at = case
            when last_interactive_at + v_touch_cooldown <= v_now then v_now
            else last_interactive_at
          end,
          updated_at = v_now
    where session_id = v_session_id
      and locked_at is null
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'status', 'active',
    'sessionId', v_session_id,
    'locked', false,
    'lastInteractiveAt', v_row.last_interactive_at,
    'lockedAt', null,
    'touched', v_mode = 'touch' and v_row.last_interactive_at = v_now
  );
end;
$$;

create or replace function p85_stage_5_assert_session_activity_v1()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_tenant_id uuid;
  v_auth_user_id uuid;
  v_dietitian_id uuid;
  v_role text;
  v_now timestamptz := now();
  v_row app_session_activity%rowtype;
  v_inactivity constant interval := p85_stage_5_session_inactivity_window();
begin
  v_session_id := p85_stage_5_read_session_claim();
  select actor.tenant_id, actor.auth_user_id, actor.dietitian_id, actor.role
    into v_tenant_id, v_auth_user_id, v_dietitian_id, v_role
  from p85_stage_5_resolve_shell_actor(v_session_id) actor;

  select *
    into v_row
  from app_session_activity
  where session_id = v_session_id
  for update;

  if not found then
    insert into app_session_activity (
      session_id,
      tenant_id,
      auth_user_id,
      dietitian_id,
      last_interactive_at,
      created_at,
      updated_at
    ) values (
      v_session_id,
      v_tenant_id,
      v_auth_user_id,
      v_dietitian_id,
      v_now,
      v_now,
      v_now
    )
    returning * into v_row;

    perform p85_stage_5_insert_session_security_event(
      v_tenant_id,
      v_auth_user_id,
      v_dietitian_id,
      'session_started',
      v_session_id::text
    );

    return jsonb_build_object(
      'sessionId', v_session_id,
      'locked', false,
      'lastInteractiveAt', v_row.last_interactive_at
    );
  end if;

  if v_row.tenant_id <> v_tenant_id or v_row.auth_user_id <> v_auth_user_id then
    raise exception 'session_claim_mismatch';
  end if;

  if v_row.locked_at is not null then
    raise exception 'session_inactive';
  end if;

  if v_row.last_interactive_at + v_inactivity <= v_now then
    update app_session_activity
      set locked_at = v_now,
          updated_at = v_now
    where session_id = v_session_id
      and locked_at is null;

    perform p85_stage_5_insert_session_security_event(
      v_tenant_id,
      v_auth_user_id,
      v_dietitian_id,
      'session_locked',
      v_session_id::text || ':' || floor(extract(epoch from v_now))::bigint::text
    );

    raise exception 'session_inactive';
  end if;

  return jsonb_build_object(
    'sessionId', v_session_id,
    'locked', false,
    'lastInteractiveAt', v_row.last_interactive_at
  );
end;
$$;

create or replace function p85_stage_5_touch_session_activity_v1()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_tenant_id uuid;
  v_auth_user_id uuid;
  v_dietitian_id uuid;
  v_role text;
  v_now timestamptz := now();
  v_row app_session_activity%rowtype;
  v_inactivity constant interval := p85_stage_5_session_inactivity_window();
  v_touch_cooldown constant interval := interval '1 minute';
begin
  v_session_id := p85_stage_5_read_session_claim();
  select actor.tenant_id, actor.auth_user_id, actor.dietitian_id, actor.role
    into v_tenant_id, v_auth_user_id, v_dietitian_id, v_role
  from p85_stage_5_resolve_shell_actor(v_session_id) actor;

  select *
    into v_row
  from app_session_activity
  where session_id = v_session_id
  for update;

  if not found then
    insert into app_session_activity (
      session_id,
      tenant_id,
      auth_user_id,
      dietitian_id,
      last_interactive_at,
      created_at,
      updated_at
    ) values (
      v_session_id,
      v_tenant_id,
      v_auth_user_id,
      v_dietitian_id,
      v_now,
      v_now,
      v_now
    )
    returning * into v_row;

    perform p85_stage_5_insert_session_security_event(
      v_tenant_id,
      v_auth_user_id,
      v_dietitian_id,
      'session_started',
      v_session_id::text
    );

    return jsonb_build_object(
      'sessionId', v_session_id,
      'locked', false,
      'lastInteractiveAt', v_row.last_interactive_at,
      'touched', true
    );
  end if;

  if v_row.tenant_id <> v_tenant_id or v_row.auth_user_id <> v_auth_user_id then
    raise exception 'session_claim_mismatch';
  end if;

  if v_row.locked_at is not null then
    raise exception 'session_inactive';
  end if;

  if v_row.last_interactive_at + v_inactivity <= v_now then
    update app_session_activity
      set locked_at = v_now,
          updated_at = v_now
    where session_id = v_session_id
      and locked_at is null;

    perform p85_stage_5_insert_session_security_event(
      v_tenant_id,
      v_auth_user_id,
      v_dietitian_id,
      'session_locked',
      v_session_id::text || ':' || floor(extract(epoch from v_now))::bigint::text
    );

    raise exception 'session_inactive';
  end if;

  update app_session_activity
    set last_interactive_at = case
          when last_interactive_at + v_touch_cooldown <= v_now then v_now
          else last_interactive_at
        end,
        updated_at = v_now
  where session_id = v_session_id
    and locked_at is null
  returning * into v_row;

  return jsonb_build_object(
    'sessionId', v_session_id,
    'locked', false,
    'lastInteractiveAt', v_row.last_interactive_at,
    'touched', v_row.last_interactive_at = v_now
  );
end;
$$;

create or replace function p85_stage_5_load_shell_bootstrap_v1(
  p_active_client_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_tenant_id uuid;
  v_auth_user_id uuid;
  v_dietitian_id uuid;
  v_role text;
  v_now timestamptz := now();
  v_inactivity constant interval := p85_stage_5_session_inactivity_window();
  v_pref app_user_shell_preferences%rowtype;
  v_display_name text;
  v_ui_language text;
  v_timezone text;
  v_last_interactive_at timestamptz;
  v_warnings jsonb := '[]'::jsonb;
  v_effective_client_id uuid;
  v_active_client jsonb;
  v_alerts bigint;
  v_handoffs bigint;
  v_messages bigint;
  v_notifications bigint;
begin
  perform p85_stage_5_assert_session_activity_v1();

  v_session_id := p85_stage_5_read_session_claim();
  select actor.tenant_id, actor.auth_user_id, actor.dietitian_id, actor.role
    into v_tenant_id, v_auth_user_id, v_dietitian_id, v_role
  from p85_stage_5_resolve_shell_actor(v_session_id) actor;

  select d.display_name, d.ui_language, d.timezone
    into v_display_name, v_ui_language, v_timezone
  from dietitians d
  where d.tenant_id = v_tenant_id
    and d.id = v_dietitian_id
  limit 1;

  if v_display_name is null then
    raise exception 'shell_bootstrap_unavailable';
  end if;

  select a.last_interactive_at
    into v_last_interactive_at
  from app_session_activity a
  where a.session_id = v_session_id
  limit 1;

  if v_last_interactive_at is null then
    raise exception 'shell_bootstrap_unavailable';
  end if;

  select *
    into v_pref
  from app_user_shell_preferences
  where tenant_id = v_tenant_id
    and auth_user_id = v_auth_user_id
  for update;

  if found and v_pref.active_client_id is not null then
    if p85_stage_5_project_shell_active_client_v1(
      v_tenant_id,
      v_pref.active_client_id,
      v_auth_user_id,
      v_dietitian_id,
      v_role
    ) is null then
      update app_user_shell_preferences
        set active_client_id = null,
            revision = revision + 1,
            updated_at = v_now
      where tenant_id = v_tenant_id
        and auth_user_id = v_auth_user_id
      returning * into v_pref;
    end if;
  end if;

  v_effective_client_id := null;

  if p_active_client_id is not null then
    if p85_stage_5_project_shell_active_client_v1(
      v_tenant_id,
      p_active_client_id,
      v_auth_user_id,
      v_dietitian_id,
      v_role
    ) is not null then
      v_effective_client_id := p_active_client_id;
    else
      v_warnings := v_warnings || jsonb_build_array('client_context_unavailable');
    end if;
  elsif found and v_pref.active_client_id is not null then
    if p85_stage_5_project_shell_active_client_v1(
      v_tenant_id,
      v_pref.active_client_id,
      v_auth_user_id,
      v_dietitian_id,
      v_role
    ) is not null then
      v_effective_client_id := v_pref.active_client_id;
    end if;
  end if;

  v_active_client := p85_stage_5_project_shell_active_client_v1(
    v_tenant_id,
    v_effective_client_id,
    v_auth_user_id,
    v_dietitian_id,
    v_role
  );

  begin
    select coalesce(ac.all_count, 0)
      into v_alerts
    from p85_stage_4b_count_alerts_v2(
      v_tenant_id,
      v_auth_user_id,
      v_dietitian_id,
      v_role,
      null,
      null
    ) ac
    limit 1;
  exception
    when others then
      raise exception 'shell_bootstrap_unavailable';
  end;

  begin
    select count(*)::bigint
      into v_handoffs
    from handoff_cases h
    join clients c
      on c.tenant_id = h.tenant_id
     and c.id = h.client_id
    where h.tenant_id = v_tenant_id
      and h.status in ('open', 'assigned')
      and c.lifecycle_status = 'active'
      and p85_stage_4b_actor_can_read_client(
        v_tenant_id,
        c.id,
        v_auth_user_id,
        v_dietitian_id,
        v_role
      );
  exception
    when others then
      raise exception 'shell_bootstrap_unavailable';
  end;

  begin
    if v_role = 'auditor' then
      v_messages := 0;
    else
      select coalesce(sum(unread.unread_count), 0)::bigint
        into v_messages
      from conversations cv
      join clients c
        on c.tenant_id = cv.tenant_id
       and c.id = cv.client_id
      left join lateral (
        select count(*)::bigint as unread_count
        from messages m
        left join conversation_read_receipts cr
          on cr.tenant_id = m.tenant_id
         and cr.conversation_id = m.conversation_id
         and cr.dietitian_id = v_dietitian_id
        where m.tenant_id = cv.tenant_id
          and m.conversation_id = cv.id
          and m.origin = 'client_inbound'
          and m.conversation_sequence is not null
          and m.conversation_sequence > coalesce(cr.last_read_sequence, 0)
          and m.content_status not in ('revoked', 'redacted')
      ) unread on true
      where cv.tenant_id = v_tenant_id
        and c.lifecycle_status = 'active'
        and p85_stage_4b_actor_can_read_client(
          v_tenant_id,
          c.id,
          v_auth_user_id,
          v_dietitian_id,
          v_role
        );
    end if;
  exception
    when others then
      raise exception 'shell_bootstrap_unavailable';
  end;

  begin
    select coalesce(nc.unread_count, 0)
      into v_notifications
    from p85_stage_4b_count_notifications_v2(
      v_tenant_id,
      v_auth_user_id,
      v_dietitian_id,
      v_role,
      'active',
      null,
      null,
      null,
      null
    ) nc
    limit 1;
  exception
    when others then
      raise exception 'shell_bootstrap_unavailable';
  end;

  return jsonb_build_object(
    'displayName', v_display_name,
    'uiLanguage', v_ui_language,
    'timezone', v_timezone,
    'role', v_role,
    'preferences', jsonb_build_object(
      'revision', coalesce(v_pref.revision, 0),
      'activeClientId', case when found then v_pref.active_client_id else null end,
      'lastDestinationId', case when found then v_pref.last_destination_id else null end,
      'destinationState', case when found then v_pref.destination_state else '{}'::jsonb end
    ),
    'warnings', v_warnings,
    'activeClient', v_active_client,
    'badgeCounts', jsonb_build_object(
      'alerts', greatest(coalesce(v_alerts, 0), 0),
      'handoffs', greatest(coalesce(v_handoffs, 0), 0),
      'messages', greatest(coalesce(v_messages, 0), 0),
      'notifications', greatest(coalesce(v_notifications, 0), 0)
    ),
    'sessionExpiresAt', (v_last_interactive_at + v_inactivity)::text
  );
end;
$$;

revoke all on function p85_stage_5_session_inactivity_window() from public, anon, authenticated;
revoke all on function p85_stage_5_assert_session_activity_v1() from public, anon, authenticated;
revoke all on function p85_stage_5_touch_session_activity_v1() from public, anon, authenticated;
revoke all on function p85_stage_5_record_session_activity_v2(text) from public, anon;
grant execute on function p85_stage_5_record_session_activity_v2(text) to authenticated, service_role;
