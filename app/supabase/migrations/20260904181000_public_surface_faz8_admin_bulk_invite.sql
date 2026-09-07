-- Faz 8: bounded customer projection and atomic invite/provision for commercial admin.
-- Service-role only. Authenticated/anon cannot execute.

create or replace function commercial_admin_list_customers_v1(
  p_email_filter text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_filter text := nullif(lower(trim(coalesce(p_email_filter, ''))), '');
begin
  return coalesce((
    with invite_emails as (
      select ci.normalized_email
      from commercial_invites ci
      where v_filter is null or ci.normalized_email like '%' || v_filter || '%'
      order by ci.created_at desc
      limit v_limit
    ),
    billing_emails as (
      select bc.normalized_email
      from billing_customers bc
      where v_filter is not null
        and bc.normalized_email like '%' || v_filter || '%'
      limit v_limit
    ),
    emails as (
      select normalized_email
      from invite_emails
      union
      select normalized_email
      from billing_emails
    ),
    ranked_invites as (
      select
        ci.id,
        ci.normalized_email,
        ci.status,
        ci.tenant_id,
        ci.tenant_seed_metadata,
        ci.created_at,
        ci.updated_at,
        t.name as tenant_name,
        row_number() over (
          partition by ci.normalized_email
          order by ci.created_at desc, ci.id desc
        ) as invite_rank
      from commercial_invites ci
      left join tenants t on t.id = ci.tenant_id
      where ci.normalized_email in (select normalized_email from emails)
    ),
    tenant_ids as (
      select distinct tenant_id
      from (
        select ci.tenant_id
        from commercial_invites ci
        where ci.normalized_email in (select normalized_email from emails)
          and ci.tenant_id is not null
        union
        select bc.tenant_id
        from billing_customers bc
        where bc.normalized_email in (select normalized_email from emails)
          and bc.tenant_id is not null
      ) tenants_union
    ),
    ranked_entitlements as (
      select
        te.tenant_id,
        te.status,
        te.billing_method,
        te.paid_through,
        te.revision,
        te.commercial_invite_id,
        ci.normalized_email,
        row_number() over (
          partition by ci.normalized_email
          order by te.updated_at desc, te.tenant_id desc
        ) as entitlement_rank
      from tenant_entitlements te
      join commercial_invites ci
        on ci.tenant_id = te.tenant_id
       and ci.normalized_email in (select normalized_email from emails)
      where te.tenant_id in (select tenant_id from tenant_ids)
      union
      select
        te.tenant_id,
        te.status,
        te.billing_method,
        te.paid_through,
        te.revision,
        te.commercial_invite_id,
        bc.normalized_email,
        row_number() over (
          partition by bc.normalized_email
          order by te.updated_at desc, te.tenant_id desc
        ) as entitlement_rank
      from tenant_entitlements te
      join billing_customers bc
        on bc.tenant_id = te.tenant_id
       and bc.normalized_email in (select normalized_email from emails)
      where te.tenant_id in (select tenant_id from tenant_ids)
    ),
    email_tenants as (
      select e.normalized_email, array_agg(distinct tid.tenant_id) filter (where tid.tenant_id is not null) as tenant_ids
      from emails e
      left join (
        select ci.normalized_email, ci.tenant_id
        from commercial_invites ci
        union
        select bc.normalized_email, bc.tenant_id
        from billing_customers bc
      ) tid on tid.normalized_email = e.normalized_email
      group by e.normalized_email
    )
    select jsonb_agg(item order by item->>'normalizedEmail')
    from (
      select jsonb_build_object(
        'normalizedEmail', e.normalized_email,
        'tenantIds', coalesce(et.tenant_ids, '{}'::uuid[]),
        'latestInvite', case when ri.id is null then null else jsonb_build_object(
          'id', ri.id,
          'status', ri.status,
          'tenantId', ri.tenant_id,
          'tenantName', ri.tenant_name,
          'tenantSeedMetadata', coalesce(ri.tenant_seed_metadata, '{}'::jsonb),
          'createdAt', ri.created_at,
          'updatedAt', ri.updated_at
        ) end,
        'latestEntitlement', case when re.tenant_id is null then null else jsonb_build_object(
          'tenantId', re.tenant_id,
          'status', re.status,
          'billingMethod', re.billing_method,
          'paidThrough', re.paid_through,
          'revision', re.revision,
          'inviteId', re.commercial_invite_id
        ) end,
        'hasOwnerMembership', exists (
          select 1
          from tenant_memberships tm
          where tm.role = 'owner'
            and tm.tenant_id = any (coalesce(et.tenant_ids, '{}'::uuid[]))
        )
      ) as item
      from emails e
      left join email_tenants et on et.normalized_email = e.normalized_email
      left join ranked_invites ri on ri.normalized_email = e.normalized_email and ri.invite_rank = 1
      left join (
        select distinct on (normalized_email)
          normalized_email, tenant_id, status, billing_method, paid_through, revision, commercial_invite_id
        from ranked_entitlements
        order by normalized_email, entitlement_rank
      ) re on re.normalized_email = e.normalized_email
    ) projected
  ), '[]'::jsonb);
end;
$$;

create or replace function commercial_admin_invite_customer_v1(
  p_normalized_email text,
  p_tenant_name text default null,
  p_paid_through timestamptz default null,
  p_expires_at timestamptz default null,
  p_actor_summary text default 'commercial_admin',
  p_auth_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_email text := lower(trim(coalesce(p_normalized_email, '')));
  v_auth_user_id uuid := p_auth_user_id;
  v_tenant_ids uuid[];
  v_tenant_id uuid;
  v_open_invite commercial_invites%rowtype;
  v_latest_invite commercial_invites%rowtype;
  v_entitlement tenant_entitlements%rowtype;
  v_has_owner boolean := false;
  v_invite_id uuid;
  v_created boolean := false;
  v_can_create boolean := false;
  v_should_resend boolean := false;
  v_should_resume boolean := false;
  v_blocking text := null;
  v_request_id text;
  v_request_hash text;
  v_hash_src text;
  v_payment_reference text;
  v_activate jsonb;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'email_invalid';
  end if;
  if p_paid_through is null or p_paid_through <= v_now then
    raise exception 'paid_through_must_be_future';
  end if;

  perform pg_advisory_xact_lock(88140831, hashtext('invite:' || v_email));

  if v_auth_user_id is null then
    select u.id
      into v_auth_user_id
    from auth.users u
    where lower(u.email) = v_email
    limit 1;
  end if;

  select array_agg(distinct tenant_id) filter (where tenant_id is not null)
    into v_tenant_ids
  from (
    select tenant_id from commercial_invites where normalized_email = v_email
    union
    select tenant_id from billing_customers where normalized_email = v_email
  ) tenants_for_email;

  if coalesce(array_length(v_tenant_ids, 1), 0) > 1 then
    return jsonb_build_object(
      'status', 'blocked',
      'created', false,
      'resent', false,
      'inviteId', null,
      'email', v_email,
      'paidThrough', p_paid_through,
      'blockingReason', 'ambiguous_tenant_match'
    );
  end if;

  v_tenant_id := case when coalesce(array_length(v_tenant_ids, 1), 0) = 1 then v_tenant_ids[1] else null end;

  select *
    into v_open_invite
  from commercial_invites
  where normalized_email = v_email
    and status = 'active'
  order by created_at desc
  limit 1;

  select *
    into v_latest_invite
  from commercial_invites
  where normalized_email = v_email
  order by created_at desc
  limit 1;

  if v_tenant_id is not null then
    select *
      into v_entitlement
    from tenant_entitlements
    where tenant_id = v_tenant_id
    order by updated_at desc
    limit 1;

    select exists (
      select 1 from tenant_memberships tm
      where tm.tenant_id = v_tenant_id
        and tm.role = 'owner'
    ) into v_has_owner;
  end if;

  if v_tenant_id is not null or v_auth_user_id is not null or v_open_invite.id is not null or v_latest_invite.id is not null then
    if v_entitlement.status = 'revoked' then
      v_blocking := 'existing_customer_use_reactivate';
    elsif v_entitlement.status = 'past_due' then
      v_blocking := 'existing_customer_use_renew';
    elsif v_tenant_id is not null and v_has_owner and v_entitlement.status = 'active' then
      v_blocking := 'existing_account';
    elsif v_auth_user_id is not null and v_latest_invite.id is null and v_tenant_id is null then
      v_blocking := 'existing_auth_user';
    elsif v_open_invite.id is not null
      or (
        (v_latest_invite.id is not null or v_tenant_id is not null)
        and coalesce(v_entitlement.status::text, '') <> 'revoked'
        and v_has_owner is not true
        and (v_entitlement.status is null or v_entitlement.status in ('invited', 'checkout_started', 'active'))
      )
    then
      v_blocking := 'open_invite_exists';
      v_should_resend := true;
      v_should_resume := v_latest_invite.id is not null and v_tenant_id is null;
    else
      v_blocking := 'duplicate_customer_match';
    end if;
  else
    v_can_create := true;
  end if;

  if not v_can_create and not v_should_resend and not v_should_resume then
    return jsonb_build_object(
      'status', 'blocked',
      'created', false,
      'resent', false,
      'inviteId', coalesce(v_open_invite.id, v_latest_invite.id),
      'email', v_email,
      'paidThrough', p_paid_through,
      'blockingReason', v_blocking
    );
  end if;

  if v_can_create then
    v_invite_id := gen_random_uuid();
    insert into commercial_invites (
      id,
      normalized_email,
      invite_token_hash,
      status,
      tenant_seed_metadata,
      tenant_id,
      expires_at,
      created_at,
      updated_at
    ) values (
      v_invite_id,
      v_email,
      encode(sha256(convert_to(v_invite_id::text || ':' || v_now::text, 'UTF8')), 'hex'),
      'active',
      jsonb_strip_nulls(jsonb_build_object('tenantName', nullif(trim(coalesce(p_tenant_name, '')), ''))),
      null,
      p_expires_at,
      v_now,
      v_now
    );
    v_created := true;

    insert into commercial_admin_audit_events (
      event_type,
      actor_summary,
      target_invite_id,
      payload_summary,
      created_at
    ) values (
      'invite_created',
      coalesce(nullif(trim(p_actor_summary), ''), 'commercial_admin'),
      v_invite_id,
      jsonb_build_object(
        'normalizedEmail', v_email,
        'expiresAt', p_expires_at,
        'tenantSeedMetadata', jsonb_strip_nulls(jsonb_build_object('tenantName', nullif(trim(coalesce(p_tenant_name, '')), '')))
      ),
      v_now
    );
  else
    v_invite_id := coalesce(v_open_invite.id, v_latest_invite.id);
  end if;

  if v_can_create or v_should_resume then
    v_payment_reference := 'admin-setup-' || v_invite_id::text;
    v_request_id := 'admin-setup-req-' || v_invite_id::text;
    v_hash_src := json_build_object(
      'action', 'activate',
      'inviteId', v_invite_id,
      'paymentReference', v_payment_reference,
      'paidThrough', p_paid_through,
      'requestId', v_request_id,
      'expectedRevision', null
    )::text;
    v_request_hash := encode(sha256(convert_to(v_hash_src, 'UTF8')), 'hex');
    v_activate := apply_manual_entitlement_operation(
      'activate',
      v_invite_id,
      v_payment_reference,
      p_paid_through,
      v_request_id,
      v_request_hash,
      null,
      coalesce(nullif(trim(p_actor_summary), ''), 'commercial_admin')
    );
  end if;

  return jsonb_build_object(
    'status', case when v_created then 'created' else 'resent' end,
    'created', v_created,
    'resent', not v_created,
    'inviteId', v_invite_id,
    'email', v_email,
    'paidThrough', p_paid_through,
    'activation', v_activate
  );
end;
$$;

revoke all on function commercial_admin_list_customers_v1(text, integer) from public, anon, authenticated;
grant execute on function commercial_admin_list_customers_v1(text, integer) to service_role;

revoke all on function commercial_admin_invite_customer_v1(text, text, timestamptz, timestamptz, text, uuid) from public, anon, authenticated;
grant execute on function commercial_admin_invite_customer_v1(text, text, timestamptz, timestamptz, text, uuid) to service_role;
