-- Phase 85 Stage 5 Faz 2: server session activity and shell preferences foundation.

create table app_session_activity (
  session_id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  auth_user_id uuid not null,
  dietitian_id uuid not null references dietitians(id) on delete cascade,
  last_interactive_at timestamptz not null default now(),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index app_session_activity_tenant_user_idx
  on app_session_activity (tenant_id, auth_user_id, updated_at desc);

create table app_user_shell_preferences (
  tenant_id uuid not null references tenants(id) on delete cascade,
  auth_user_id uuid not null,
  dietitian_id uuid not null references dietitians(id) on delete cascade,
  active_client_id uuid,
  last_destination_id text,
  destination_state jsonb not null default '{}'::jsonb,
  revision integer not null default 0,
  last_request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, auth_user_id),
  constraint app_user_shell_preferences_destination_state_object
    check (jsonb_typeof(destination_state) = 'object'),
  constraint app_user_shell_preferences_last_destination_len
    check (last_destination_id is null or (char_length(last_destination_id) between 1 and 80)),
  constraint app_user_shell_preferences_active_client_fk
    foreign key (tenant_id, active_client_id) references clients (tenant_id, id)
);

create index app_user_shell_preferences_dietitian_idx
  on app_user_shell_preferences (tenant_id, dietitian_id);

alter table app_session_activity enable row level security;
alter table app_user_shell_preferences enable row level security;

revoke all on table app_session_activity from public, anon, authenticated;
revoke all on table app_user_shell_preferences from public, anon, authenticated;

alter table account_security_events drop constraint account_security_event_type_check;

alter table account_security_events add constraint account_security_event_type_check check (
  event_type in (
    'password_login',
    'reauthenticate_requested',
    'password_updated',
    'password_reset_requested',
    'email_change_requested',
    'logout_local',
    'recovery_password_set',
    'session_locked',
    'session_started'
  )
);

create or replace function p85_stage_5_insert_session_security_event(
  p_tenant_id uuid,
  p_auth_user_id uuid,
  p_dietitian_id uuid,
  p_event_type text,
  p_idempotency_suffix text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into account_security_events (
    tenant_id,
    auth_user_id,
    dietitian_id,
    event_type,
    outcome,
    idempotency_key,
    metadata
  ) values (
    p_tenant_id,
    p_auth_user_id,
    p_dietitian_id,
    p_event_type,
    'success',
    encode(sha256((p_event_type || ':' || p_auth_user_id::text || ':' || p_idempotency_suffix)::bytea), 'hex'),
    jsonb_build_object('minimized', true)
  )
  on conflict (idempotency_key) do nothing;
end;
$$;

create or replace function p85_stage_5_read_session_claim()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_claim text := nullif(auth.jwt() ->> 'session_id', '');
begin
  if v_claim is null then
    raise exception 'session_claim_missing';
  end if;

  begin
    return v_claim::uuid;
  exception
    when invalid_text_representation then
      raise exception 'session_claim_missing';
  end;
end;
$$;

create or replace function p85_stage_5_resolve_shell_actor(p_session_id uuid)
returns table (
  tenant_id uuid,
  auth_user_id uuid,
  dietitian_id uuid,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_dietitian_id uuid;
  v_role text;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  if p_session_id is null then
    raise exception 'session_claim_missing';
  end if;

  select tm.tenant_id, tm.role::text
    into v_tenant_id, v_role
  from tenant_memberships tm
  where tm.user_id = v_user_id
  order by tm.created_at asc
  limit 1;

  if v_tenant_id is null then
    raise exception 'no_tenant_membership';
  end if;

  select d.id
    into v_dietitian_id
  from dietitians d
  where d.tenant_id = v_tenant_id
    and d.auth_user_id = v_user_id
  limit 1;

  if v_dietitian_id is null then
    raise exception 'no_dietitian_profile';
  end if;

  return query
  select v_tenant_id, v_user_id, v_dietitian_id, v_role;
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
  v_inactivity constant interval := interval '15 minutes';
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
  v_inactivity constant interval := interval '15 minutes';
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

create or replace function p85_stage_5_update_shell_preferences_v1(
  p_expected_revision integer,
  p_request_id text,
  p_active_client_id uuid default null,
  p_last_destination_id text default null,
  p_destination_state jsonb default null,
  p_clear_active_client boolean default false
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
  v_request_id text;
  v_row app_user_shell_preferences%rowtype;
  v_next_revision integer;
  v_destination_state jsonb;
  v_last_destination_id text;
  v_active_client_id uuid;
begin
  perform p85_stage_5_assert_session_activity_v1();

  v_session_id := p85_stage_5_read_session_claim();
  select actor.tenant_id, actor.auth_user_id, actor.dietitian_id, actor.role
    into v_tenant_id, v_auth_user_id, v_dietitian_id, v_role
  from p85_stage_5_resolve_shell_actor(v_session_id) actor;

  v_request_id := trim(coalesce(p_request_id, ''));
  if char_length(v_request_id) < 8 or char_length(v_request_id) > 128 then
    raise exception 'invalid_request_id';
  end if;

  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'invalid_expected_revision';
  end if;

  if p_last_destination_id is not null then
    v_last_destination_id := trim(p_last_destination_id);
    if char_length(v_last_destination_id) = 0 or char_length(v_last_destination_id) > 80 then
      raise exception 'invalid_last_destination_id';
    end if;
  end if;

  v_destination_state := coalesce(p_destination_state, '{}'::jsonb);
  if jsonb_typeof(v_destination_state) <> 'object' then
    raise exception 'invalid_destination_state';
  end if;

  if p_clear_active_client then
    v_active_client_id := null;
  elsif p_active_client_id is not null then
    if not p85_stage_4b_actor_can_read_client(
      v_tenant_id,
      p_active_client_id,
      v_auth_user_id,
      v_dietitian_id,
      v_role
    ) then
      raise exception 'client_context_unavailable';
    end if;

    if not exists (
      select 1
      from clients c
      where c.tenant_id = v_tenant_id
        and c.id = p_active_client_id
        and c.lifecycle_status = 'active'
    ) then
      raise exception 'client_context_unavailable';
    end if;

    v_active_client_id := p_active_client_id;
  else
    v_active_client_id := null;
  end if;

  select *
    into v_row
  from app_user_shell_preferences
  where tenant_id = v_tenant_id
    and auth_user_id = v_auth_user_id
  for update;

  if not found then
    if p_expected_revision <> 0 then
      raise exception 'preferences_revision_conflict';
    end if;

    insert into app_user_shell_preferences (
      tenant_id,
      auth_user_id,
      dietitian_id,
      active_client_id,
      last_destination_id,
      destination_state,
      revision,
      last_request_id,
      created_at,
      updated_at
    ) values (
      v_tenant_id,
      v_auth_user_id,
      v_dietitian_id,
      v_active_client_id,
      v_last_destination_id,
      case when p_destination_state is null then '{}'::jsonb else v_destination_state end,
      1,
      v_request_id,
      v_now,
      v_now
    )
    returning * into v_row;

    return jsonb_build_object(
      'revision', v_row.revision,
      'activeClientId', v_row.active_client_id,
      'lastDestinationId', v_row.last_destination_id,
      'destinationState', v_row.destination_state,
      'requestId', v_row.last_request_id
    );
  end if;

  if v_row.last_request_id = v_request_id then
    return jsonb_build_object(
      'revision', v_row.revision,
      'activeClientId', v_row.active_client_id,
      'lastDestinationId', v_row.last_destination_id,
      'destinationState', v_row.destination_state,
      'requestId', v_row.last_request_id,
      'idempotentReplay', true
    );
  end if;

  if v_row.revision <> p_expected_revision then
    raise exception 'preferences_revision_conflict';
  end if;

  v_next_revision := v_row.revision + 1;

  update app_user_shell_preferences
    set active_client_id = case
          when p_clear_active_client or p_active_client_id is not null then v_active_client_id
          else active_client_id
        end,
        last_destination_id = coalesce(v_last_destination_id, last_destination_id),
        destination_state = case
          when p_destination_state is null then destination_state
          else v_destination_state
        end,
        revision = v_next_revision,
        last_request_id = v_request_id,
        updated_at = v_now
  where tenant_id = v_tenant_id
    and auth_user_id = v_auth_user_id
  returning * into v_row;

  return jsonb_build_object(
    'revision', v_row.revision,
    'activeClientId', v_row.active_client_id,
    'lastDestinationId', v_row.last_destination_id,
    'destinationState', v_row.destination_state,
    'requestId', v_row.last_request_id
  );
end;
$$;

revoke all on function p85_stage_5_insert_session_security_event(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function p85_stage_5_insert_session_security_event(uuid, uuid, uuid, text, text) to service_role;

revoke all on function p85_stage_5_read_session_claim() from public, anon, authenticated;
revoke all on function p85_stage_5_resolve_shell_actor(uuid) from public, anon, authenticated;

revoke all on function p85_stage_5_assert_session_activity_v1() from public, anon;
grant execute on function p85_stage_5_assert_session_activity_v1() to authenticated, service_role;

revoke all on function p85_stage_5_touch_session_activity_v1() from public, anon;
grant execute on function p85_stage_5_touch_session_activity_v1() to authenticated, service_role;

revoke all on function p85_stage_5_update_shell_preferences_v1(integer, text, uuid, text, jsonb, boolean) from public, anon;
grant execute on function p85_stage_5_update_shell_preferences_v1(integer, text, uuid, text, jsonb, boolean) to authenticated, service_role;
