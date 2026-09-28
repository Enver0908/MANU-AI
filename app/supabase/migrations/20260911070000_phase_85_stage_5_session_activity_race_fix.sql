-- Plan 1 Phase 4 local remediation: make service-role session activity
-- recording idempotent under concurrent first-touch requests for one auth
-- session. Tenant/user mismatch, lock, and inactivity semantics remain
-- fail-closed.

create or replace function p85_stage_5_record_session_activity_v3(
  p_mode text,
  p_session_id uuid,
  p_auth_user_id uuid,
  p_tenant_id uuid,
  p_dietitian_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text := trim(coalesce(p_mode, 'assert'));
  v_now timestamptz := now();
  v_row app_session_activity%rowtype;
  v_inserted boolean := false;
  v_inactivity constant interval := p85_stage_5_session_inactivity_window();
  v_touch_cooldown constant interval := interval '1 minute';
  v_membership_role text;
begin
  if v_mode not in ('assert', 'touch') then
    raise exception 'invalid_session_activity_mode';
  end if;

  if p_session_id is null then
    raise exception 'session_claim_missing';
  end if;
  if p_auth_user_id is null or p_tenant_id is null or p_dietitian_id is null then
    raise exception 'unauthenticated';
  end if;

  select tm.role::text
    into v_membership_role
  from tenant_memberships tm
  where tm.user_id = p_auth_user_id
    and tm.tenant_id = p_tenant_id
  limit 1;

  if v_membership_role is null then
    raise exception 'no_tenant_membership';
  end if;

  if not exists (
    select 1
    from dietitians d
    where d.id = p_dietitian_id
      and d.tenant_id = p_tenant_id
      and d.auth_user_id = p_auth_user_id
  ) then
    raise exception 'no_dietitian_profile';
  end if;

  insert into app_session_activity (
    session_id,
    tenant_id,
    auth_user_id,
    dietitian_id,
    last_interactive_at,
    created_at,
    updated_at
  ) values (
    p_session_id,
    p_tenant_id,
    p_auth_user_id,
    p_dietitian_id,
    v_now,
    v_now,
    v_now
  )
  on conflict (session_id) do nothing
  returning * into v_row;

  if found then
    v_inserted := true;
  else
    select *
      into v_row
    from app_session_activity
    where session_id = p_session_id
    for update;
  end if;

  if not found then
    raise exception 'session_inactive';
  end if;

  if v_row.tenant_id <> p_tenant_id or v_row.auth_user_id <> p_auth_user_id then
    raise exception 'session_claim_mismatch';
  end if;

  if v_inserted then
    perform p85_stage_5_insert_session_security_event(
      p_tenant_id,
      p_auth_user_id,
      p_dietitian_id,
      'session_started',
      p_session_id::text
    );

    return jsonb_build_object(
      'status', 'active',
      'sessionId', p_session_id,
      'locked', false,
      'lastInteractiveAt', v_row.last_interactive_at,
      'lockedAt', null,
      'touched', v_mode = 'touch'
    );
  end if;

  if v_row.locked_at is not null then
    return jsonb_build_object(
      'status', 'locked',
      'sessionId', p_session_id,
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
    where session_id = p_session_id
      and locked_at is null
    returning * into v_row;

    perform p85_stage_5_insert_session_security_event(
      p_tenant_id,
      p_auth_user_id,
      p_dietitian_id,
      'session_locked',
      p_session_id::text || ':' || floor(extract(epoch from v_now))::bigint::text
    );

    return jsonb_build_object(
      'status', 'locked',
      'sessionId', p_session_id,
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
    where session_id = p_session_id
      and locked_at is null
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'status', 'active',
    'sessionId', p_session_id,
    'locked', false,
    'lastInteractiveAt', v_row.last_interactive_at,
    'lockedAt', null,
    'touched', v_mode = 'touch' and v_row.last_interactive_at = v_now
  );
end;
$$;

revoke all on function p85_stage_5_record_session_activity_v3(text, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function p85_stage_5_record_session_activity_v3(text, uuid, uuid, uuid, uuid)
  to service_role;
