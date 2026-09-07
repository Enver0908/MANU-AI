-- Production Readiness Stage 1 Phase 2: manual bank-transfer entitlement support.

create type commercial_billing_method as enum (
  'stripe',
  'manual_transfer'
);

alter table tenant_entitlements
  add column if not exists billing_method commercial_billing_method not null default 'stripe',
  add column if not exists paid_through timestamptz,
  add column if not exists revision integer not null default 0;

alter table tenant_entitlements
  add constraint tenant_entitlements_revision_nonnegative_check
  check (revision >= 0) not valid;

alter table tenant_entitlements
  add constraint tenant_entitlements_manual_paid_through_check
  check (billing_method <> 'manual_transfer' or paid_through is not null) not valid;

create index if not exists tenant_entitlements_manual_expiry_idx
  on tenant_entitlements (paid_through, tenant_id)
  where billing_method = 'manual_transfer' and status = 'active';

create table if not exists manual_entitlement_operations (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  request_hash text not null,
  action text not null,
  commercial_invite_id uuid not null references commercial_invites(id) on delete restrict,
  tenant_id uuid not null references tenants(id) on delete restrict,
  payment_reference text not null,
  paid_through timestamptz not null,
  resulting_entitlement_status commercial_entitlement_status not null,
  resulting_revision integer not null,
  actor_summary text not null default 'commercial_admin',
  created_at timestamptz not null default now(),
  constraint manual_entitlement_action_check check (action in ('activate', 'renew')),
  constraint manual_entitlement_request_hash_check check (length(request_hash) = 64),
  constraint manual_entitlement_payment_reference_length_check check (
    length(payment_reference) between 6 and 120
  ),
  constraint manual_entitlement_revision_nonnegative_check check (resulting_revision >= 0)
);

create unique index if not exists manual_entitlement_operations_payment_reference_idx
  on manual_entitlement_operations (payment_reference);

create index if not exists manual_entitlement_operations_tenant_created_idx
  on manual_entitlement_operations (tenant_id, created_at desc);

alter table manual_entitlement_operations enable row level security;

-- Service-role only; no tenant-member or browser policies.

alter table commercial_admin_audit_events
  drop constraint commercial_admin_audit_event_type_check;

alter table commercial_admin_audit_events
  add constraint commercial_admin_audit_event_type_check check (
    event_type in (
      'invite_created',
      'invite_revoked',
      'entitlement_revoked',
      'ledger_inspected',
      'stripe_subscription_canceled',
      'lead_status_updated',
      'admin_operation_blocked',
      'manual_entitlement_activated',
      'manual_entitlement_renewed'
    )
  );

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
  if p_action not in ('activate', 'renew') then
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

  if v_invite.tenant_id is null then
    v_tenant_id := gen_random_uuid();
    v_tenant_name := coalesce(
      nullif(trim(v_invite.tenant_seed_metadata->>'tenantName'), ''),
      'MANU Tenant ' || v_invite.normalized_email
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
      'revision', v_revision
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
