create extension if not exists pg_trgm;

create index if not exists clients_stage5_shell_tenant_lifecycle_idx
  on clients (tenant_id, lifecycle_status, created_at desc, id desc);

create index if not exists clients_stage5_shell_full_name_trgm_idx
  on clients using gin (lower(full_name) gin_trgm_ops);

create index if not exists conversations_stage5_shell_tenant_client_created_idx
  on conversations (tenant_id, client_id, created_at desc, id desc);

create index if not exists messages_stage5_shell_unread_idx
  on messages (tenant_id, conversation_id, conversation_sequence, created_at desc)
  where origin = 'client_inbound'
    and conversation_sequence is not null
    and content_status not in ('revoked', 'redacted');

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
  v_inactivity constant interval := interval '15 minutes';
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

create or replace function p85_stage_5_require_active_session_v2()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity jsonb;
begin
  v_activity := p85_stage_5_record_session_activity_v2('assert');
  if v_activity ->> 'status' <> 'active' then
    raise exception 'session_inactive';
  end if;
end;
$$;

create or replace function p85_stage_5_update_shell_preferences_v2(
  p_expected_revision integer,
  p_request_id text,
  p_active_client_id uuid default null,
  p_last_destination_id text default null,
  p_destination_state jsonb default null,
  p_clear_active_client boolean default false,
  p_clear_last_destination boolean default false
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
  perform p85_stage_5_require_active_session_v2();

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

  if p_clear_last_destination and p_last_destination_id is not null then
    raise exception 'invalid_last_destination_id';
  end if;

  if p_last_destination_id is not null then
    v_last_destination_id := trim(p_last_destination_id);
    if char_length(v_last_destination_id) = 0 or char_length(v_last_destination_id) > 80 then
      raise exception 'invalid_last_destination_id';
    end if;
  end if;

  v_destination_state := coalesce(p_destination_state, '{}'::jsonb);
  if jsonb_typeof(v_destination_state) <> 'object' or v_destination_state <> '{}'::jsonb then
    raise exception 'invalid_destination_state';
  end if;

  if p_clear_active_client and p_active_client_id is not null then
    raise exception 'client_context_unavailable';
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
      '{}'::jsonb,
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
      'destinationState', '{}'::jsonb,
      'requestId', v_row.last_request_id
    );
  end if;

  if v_row.last_request_id = v_request_id then
    return jsonb_build_object(
      'revision', v_row.revision,
      'activeClientId', v_row.active_client_id,
      'lastDestinationId', v_row.last_destination_id,
      'destinationState', '{}'::jsonb,
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
        last_destination_id = case
          when p_clear_last_destination then null
          when p_last_destination_id is not null then v_last_destination_id
          else last_destination_id
        end,
        destination_state = case
          when p_destination_state is null then destination_state
          else '{}'::jsonb
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
    'destinationState', '{}'::jsonb,
    'requestId', v_row.last_request_id
  );
end;
$$;

revoke all on function p85_stage_5_assert_session_activity_v1() from public, anon, authenticated;
revoke all on function p85_stage_5_touch_session_activity_v1() from public, anon, authenticated;
revoke all on function p85_stage_5_update_shell_preferences_v1(integer, text, uuid, text, jsonb, boolean) from public, anon, authenticated;

revoke all on function p85_stage_5_record_session_activity_v2(text) from public, anon;
grant execute on function p85_stage_5_record_session_activity_v2(text) to authenticated, service_role;

revoke all on function p85_stage_5_require_active_session_v2() from public, anon, authenticated;
grant execute on function p85_stage_5_require_active_session_v2() to service_role;

revoke all on function p85_stage_5_update_shell_preferences_v2(integer, text, uuid, text, jsonb, boolean, boolean) from public, anon;
grant execute on function p85_stage_5_update_shell_preferences_v2(integer, text, uuid, text, jsonb, boolean, boolean) to authenticated, service_role;
