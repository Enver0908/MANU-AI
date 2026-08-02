-- Phase 85 Stage 5 Faz 3: bounded shell bootstrap/search RPCs and shell rate-limit scopes.

alter table rate_limit_buckets
  drop constraint if exists rate_limit_buckets_scope_check;

alter table rate_limit_buckets
  add constraint rate_limit_buckets_scope_check check (
    scope in (
      'simulator',
      'channel_inbound',
      'manual_reply',
      'draft_review',
      'internal_copilot',
      'dietitian_ai_chat',
      'commercial_mobile_install_audit',
      'shell_bootstrap',
      'shell_preferences',
      'shell_session_activity',
      'shell_client_search'
    )
  );

create or replace function consume_rate_limit(
  p_tenant_id uuid,
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket rate_limit_buckets%rowtype;
  window_interval interval;
begin
  if p_scope not in (
    'simulator',
    'channel_inbound',
    'manual_reply',
    'draft_review',
    'internal_copilot',
    'dietitian_ai_chat',
    'commercial_mobile_install_audit',
    'shell_bootstrap',
    'shell_preferences',
    'shell_session_activity',
    'shell_client_search'
  ) then
    raise exception 'rate_limit_scope_invalid';
  end if;
  if p_key_hash is null or length(p_key_hash) < 32 then
    raise exception 'rate_limit_key_hash_invalid';
  end if;
  if p_limit <= 0 or p_window_seconds <= 0 then
    raise exception 'rate_limit_config_invalid';
  end if;

  window_interval := make_interval(secs => p_window_seconds);

  insert into rate_limit_buckets as buckets (
    tenant_id,
    scope,
    key_hash,
    count,
    reset_at
  ) values (
    p_tenant_id,
    p_scope,
    p_key_hash,
    1,
    p_now + window_interval
  )
  on conflict (tenant_id, scope, key_hash) do update
    set count = case
          when buckets.reset_at <= p_now then 1
          else buckets.count + 1
        end,
        reset_at = case
          when buckets.reset_at <= p_now then p_now + window_interval
          else buckets.reset_at
        end
  returning * into bucket;

  return jsonb_build_object(
    'allowed', bucket.count <= p_limit,
    'count', bucket.count,
    'limit', p_limit,
    'resetAt', bucket.reset_at,
    'scope', bucket.scope
  );
end;
$$;

create or replace function p85_stage_5_project_shell_active_client_v1(
  p_tenant_id uuid,
  p_client_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_client clients%rowtype;
  v_handoff_state text := 'none';
begin
  if p_client_id is null then
    return null;
  end if;

  if not p85_stage_4b_actor_can_read_client(
    p_tenant_id,
    p_client_id,
    p_user_id,
    p_dietitian_id,
    p_role
  ) then
    return null;
  end if;

  select *
    into v_client
  from clients c
  where c.tenant_id = p_tenant_id
    and c.id = p_client_id
    and c.lifecycle_status = 'active'
  limit 1;

  if not found then
    return null;
  end if;

  select h.status::text
    into v_handoff_state
  from handoff_cases h
  where h.tenant_id = p_tenant_id
    and h.client_id = p_client_id
    and h.status in ('open', 'assigned')
  order by h.created_at desc
  limit 1;

  if not found then
    v_handoff_state := 'none';
  end if;

  return jsonb_build_object(
    'id', v_client.id,
    'fullName', v_client.full_name,
    'riskLevel', case
      when coalesce(v_client.red_risk_lock->>'status', 'none') = 'locked' then 'red'
      when coalesce(v_client.yellow_risk_hold->>'status', 'none') = 'active' then 'yellow'
      else 'green'
    end,
    'handoffState', v_handoff_state,
    'channelReadiness', v_client.channel_permission::text,
    'aiMode', v_client.ai_mode::text
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
  v_inactivity constant interval := interval '15 minutes';
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

create or replace function p85_stage_5_search_shell_clients_v1(
  p_query text default null,
  p_client_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  full_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_tenant_id uuid;
  v_auth_user_id uuid;
  v_dietitian_id uuid;
  v_role text;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_query text := nullif(trim(coalesce(p_query, '')), '');
begin
  perform p85_stage_5_assert_session_activity_v1();

  v_session_id := p85_stage_5_read_session_claim();
  select actor.tenant_id, actor.auth_user_id, actor.dietitian_id, actor.role
    into v_tenant_id, v_auth_user_id, v_dietitian_id, v_role
  from p85_stage_5_resolve_shell_actor(v_session_id) actor;

  if v_query is not null and (char_length(v_query) < 2 or char_length(v_query) > 80) then
    raise exception 'invalid_search_query';
  end if;

  if v_query is null and p_client_id is null then
    return query
    select
      c.id,
      c.full_name
    from clients c
    left join lateral (
      select max(m.created_at) as last_message_at
      from conversations cv
      join messages m
        on m.tenant_id = cv.tenant_id
       and m.conversation_id = cv.id
      where cv.tenant_id = c.tenant_id
        and cv.client_id = c.id
    ) activity on true
    where c.tenant_id = v_tenant_id
      and c.lifecycle_status = 'active'
      and p85_stage_4b_actor_can_read_client(
        v_tenant_id,
        c.id,
        v_auth_user_id,
        v_dietitian_id,
        v_role
      )
    order by coalesce(activity.last_message_at, c.created_at) desc, c.created_at desc, c.id desc
    limit v_limit;
    return;
  end if;

  return query
  select
    c.id,
    c.full_name
  from clients c
  where c.tenant_id = v_tenant_id
    and c.lifecycle_status = 'active'
    and p85_stage_4b_actor_can_read_client(
      v_tenant_id,
      c.id,
      v_auth_user_id,
      v_dietitian_id,
      v_role
    )
    and (
      (p_client_id is not null and c.id = p_client_id)
      or (
        v_query is not null
        and c.full_name ilike '%' || replace(replace(v_query, '%', '\%'), '_', '\_') || '%' escape '\'
      )
    )
  order by c.full_name asc, c.id asc
  limit v_limit;
end;
$$;

revoke all on function p85_stage_5_project_shell_active_client_v1(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_5_load_shell_bootstrap_v1(uuid) from public, anon;
grant execute on function p85_stage_5_load_shell_bootstrap_v1(uuid) to authenticated, service_role;
revoke all on function p85_stage_5_search_shell_clients_v1(text, uuid, integer) from public, anon;
grant execute on function p85_stage_5_search_shell_clients_v1(text, uuid, integer) to authenticated, service_role;
