-- Public surface Phase 5: append-only visible tenant display fallback.
-- Replaces only the user-visible default tenant name. Historical migrations stay unchanged.

create or replace function public.apply_manual_entitlement_operation(
  p_action text,
  p_invite_id uuid,
  p_payment_reference text,
  p_paid_through timestamptz,
  p_request_id text,
  p_request_hash text,
  p_expected_revision integer default null,
  p_actor_summary text default 'commercial_admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_existing_operation manual_entitlement_operations%rowtype;
  v_invite commercial_invites%rowtype;
  v_tenant_id uuid;
  v_tenant_name text;
  v_entitlement tenant_entitlements%rowtype;
  v_revision integer;
  v_event_type text;
begin
  if p_action not in ('activate', 'renew', 'reactivate') then
    raise exception 'manual_entitlement_action_invalid';
  end if;
  if p_payment_reference is null or length(trim(p_payment_reference)) not between 6 and 120 then
    raise exception 'payment_reference_invalid';
  end if;
  if p_request_id is null or length(trim(p_request_id)) not between 8 and 120 then
    raise exception 'request_id_invalid';
  end if;
  if p_request_hash is null or length(p_request_hash) <> 64 then
    raise exception 'request_hash_invalid';
  end if;
  if p_paid_through is null or p_paid_through <= v_now then
    raise exception 'paid_through_must_be_future';
  end if;

  select *
    into v_existing_operation
    from manual_entitlement_operations
    where request_id = p_request_id
    for update;

  if found then
    if v_existing_operation.request_hash <> p_request_hash then
      raise exception 'manual_entitlement_request_conflict';
    end if;

    return jsonb_build_object(
      'applied', false,
      'idempotent', true,
      'tenantId', v_existing_operation.tenant_id,
      'inviteId', v_existing_operation.commercial_invite_id,
      'entitlementStatus', v_existing_operation.resulting_entitlement_status,
      'paidThrough', v_existing_operation.paid_through,
      'revision', v_existing_operation.resulting_revision
    );
  end if;

  select *
    into v_invite
    from commercial_invites
    where id = p_invite_id
    for update;

  if not found then
    raise exception 'invite_not_found';
  end if;
  if v_invite.status = 'revoked' then
    raise exception 'invite_revoked';
  end if;

  if p_action = 'reactivate' then
    if v_invite.tenant_id is null then
      raise exception 'tenant_not_provisioned';
    end if;
    v_tenant_id := v_invite.tenant_id;
  elsif v_invite.tenant_id is null then
    v_tenant_id := gen_random_uuid();
    v_tenant_name := coalesce(
      nullif(trim(v_invite.tenant_seed_metadata->>'tenantName'), ''),
      'AIya Workspace'
    );

    insert into tenants (id, name, created_at)
    values (v_tenant_id, v_tenant_name, v_now);

    update commercial_invites
      set tenant_id = v_tenant_id,
          updated_at = v_now
      where id = v_invite.id;
  else
    v_tenant_id := v_invite.tenant_id;
  end if;

  select *
    into v_entitlement
    from tenant_entitlements
    where tenant_id = v_tenant_id
    for update;

  if p_expected_revision is not null and coalesce(v_entitlement.revision, 0) <> p_expected_revision then
    raise exception 'entitlement_revision_conflict';
  end if;

  if p_action = 'activate' then
    if v_invite.status not in ('active', 'consumed') then
      raise exception 'invite_status_invalid_for_manual_activation:%', v_invite.status;
    end if;
    if v_entitlement.id is not null and v_entitlement.status not in ('invited', 'checkout_started') then
      raise exception 'entitlement_status_invalid_for_manual_activation:%', v_entitlement.status;
    end if;
  end if;

  if p_action = 'renew' then
    if v_entitlement.id is null or v_entitlement.status not in ('active', 'past_due') then
      raise exception 'entitlement_status_invalid_for_manual_renewal:%', coalesce(v_entitlement.status::text, 'missing');
    end if;
    if v_entitlement.paid_through is not null and p_paid_through <= v_entitlement.paid_through then
      raise exception 'paid_through_must_advance';
    end if;
  end if;

  if p_action = 'reactivate' then
    if v_entitlement.id is null or v_entitlement.status <> 'revoked' then
      raise exception 'entitlement_status_invalid_for_manual_reactivation:%', coalesce(v_entitlement.status::text, 'missing');
    end if;
  end if;

  if v_entitlement.id is null then
    v_revision := 0;
    insert into tenant_entitlements (
      tenant_id,
      commercial_invite_id,
      status,
      billing_method,
      paid_through,
      revision,
      status_changed_at,
      created_at,
      updated_at
    )
    values (
      v_tenant_id,
      v_invite.id,
      'active',
      'manual_transfer',
      p_paid_through,
      v_revision,
      v_now,
      v_now,
      v_now
    );
  else
    v_revision := v_entitlement.revision + 1;
    update tenant_entitlements
      set commercial_invite_id = v_invite.id,
          status = 'active',
          billing_method = 'manual_transfer',
          paid_through = p_paid_through,
          revision = v_revision,
          status_changed_at = v_now,
          updated_at = v_now
      where id = v_entitlement.id;
  end if;

  if p_action = 'activate' and v_invite.status <> 'consumed' then
    update commercial_invites
      set status = 'consumed',
          tenant_id = v_tenant_id,
          updated_at = v_now
      where id = v_invite.id;
  end if;

  insert into manual_entitlement_operations (
    request_id,
    request_hash,
    action,
    commercial_invite_id,
    tenant_id,
    payment_reference,
    paid_through,
    resulting_entitlement_status,
    resulting_revision,
    actor_summary,
    created_at
  )
  values (
    p_request_id,
    p_request_hash,
    p_action,
    v_invite.id,
    v_tenant_id,
    trim(p_payment_reference),
    p_paid_through,
    'active',
    v_revision,
    coalesce(nullif(trim(p_actor_summary), ''), 'commercial_admin'),
    v_now
  );

  v_event_type := case
    when p_action = 'activate' then 'manual_entitlement_activated'
    when p_action = 'reactivate' then 'manual_entitlement_reactivated'
    else 'manual_entitlement_renewed'
  end;

  insert into commercial_admin_audit_events (
    event_type,
    actor_summary,
    target_invite_id,
    target_tenant_id,
    payload_summary,
    created_at
  )
  values (
    v_event_type,
    coalesce(nullif(trim(p_actor_summary), ''), 'commercial_admin'),
    v_invite.id,
    v_tenant_id,
    jsonb_build_object(
      'requestId', p_request_id,
      'paymentReference', trim(p_payment_reference),
      'paidThrough', p_paid_through,
      'previousEntitlementStatus', v_entitlement.status,
      'previousPaidThrough', v_entitlement.paid_through,
      'revision', v_revision,
      'copiedClientData', false
    ),
    v_now
  );

  return jsonb_build_object(
    'applied', true,
    'idempotent', false,
    'tenantId', v_tenant_id,
    'inviteId', v_invite.id,
    'entitlementStatus', 'active',
    'paidThrough', p_paid_through,
    'revision', v_revision
  );
end;
$$;

revoke all on function public.apply_manual_entitlement_operation(
  text,
  uuid,
  text,
  timestamptz,
  text,
  text,
  integer,
  text
) from public, anon, authenticated;

grant execute on function public.apply_manual_entitlement_operation(
  text,
  uuid,
  text,
  timestamptz,
  text,
  text,
  integer,
  text
) to service_role;
