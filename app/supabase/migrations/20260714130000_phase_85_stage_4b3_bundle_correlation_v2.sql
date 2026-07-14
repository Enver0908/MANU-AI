-- Phase 85 Stage 4B-3 remediation R4: bundle correlation, dietitian append/reset, and worker outcome semantics.

alter table inbound_message_bundles
  drop constraint if exists inbound_message_bundles_decided_requires_decision_id;

alter table inbound_message_bundles
  add constraint inbound_message_bundles_decided_requires_decision_id check (
    status <> 'decided' or decision_id is not null
  );

create or replace function p85_stage_4b3_append_bundle_item_v2(
  p_tenant_id uuid,
  p_payload jsonb
)
returns inbound_message_bundles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bundle_id uuid := nullif(p_payload->>'bundleId', '')::uuid;
  v_message_id uuid := nullif(p_payload->>'messageId', '')::uuid;
  v_channel_event_id uuid := nullif(p_payload->>'channelEventId', '')::uuid;
  v_media_asset_id uuid := nullif(p_payload->>'mediaAssetId', '')::uuid;
  v_item_id uuid := coalesce(nullif(p_payload->>'itemId', '')::uuid, gen_random_uuid());
  v_observed_at timestamptz := coalesce(nullif(p_payload->>'observedAt', '')::timestamptz, now());
  v_item_type text := coalesce(nullif(p_payload->>'itemType', ''), 'text');
  v_actor_type text := coalesce(nullif(p_payload->>'actorType', ''), 'client');
  v_sender_id text := nullif(p_payload->>'senderId', '');
  v_caption_text text := nullif(p_payload->>'captionText', '');
  v_reply_to_provider_message_id text := nullif(p_payload->>'replyToProviderMessageId', '');
  v_body_text text := coalesce(nullif(p_payload->>'bodyText', ''), v_caption_text, '');
  v_unicode_increment integer := coalesce(char_length(v_body_text), 0);
  v_image_increment integer := case when v_item_type in ('image', 'caption') then 1 else 0 end;
  v_bundle inbound_message_bundles%rowtype;
  v_next_item_count integer;
  v_next_image_count integer;
  v_next_unicode_count integer;
  v_overflow_code text := null;
  v_next_status text;
  v_ready_at timestamptz;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if v_bundle_id is null or v_message_id is null then
    raise exception 'bundle_append_payload_invalid';
  end if;

  if exists (
    select 1
    from inbound_message_bundle_items bi
    where bi.tenant_id = p_tenant_id
      and bi.bundle_id = v_bundle_id
      and bi.message_id = v_message_id
  ) then
    select *
      into v_bundle
    from inbound_message_bundles
    where tenant_id = p_tenant_id
      and id = v_bundle_id;
    if not found then
      raise exception 'bundle_not_found';
    end if;
    return v_bundle;
  end if;

  select *
    into v_bundle
  from inbound_message_bundles
  where tenant_id = p_tenant_id
    and id = v_bundle_id
  for update;

  if not found then
    raise exception 'bundle_not_found';
  end if;

  if v_bundle.status not in ('open', 'ready', 'processing', 'review_required') then
    raise exception 'bundle_not_appendable';
  end if;

  v_next_item_count := v_bundle.item_count + 1;
  v_next_image_count := v_bundle.image_count + v_image_increment;
  v_next_unicode_count := v_bundle.unicode_codepoint_count + v_unicode_increment;

  if v_next_item_count > 20 then
    v_overflow_code := 'bundle_message_cap_exceeded';
  elsif v_next_image_count > 4 then
    v_overflow_code := 'bundle_image_cap_exceeded';
  elsif v_next_unicode_count > 16000 then
    v_overflow_code := 'bundle_unicode_cap_exceeded';
  end if;

  v_ready_at := v_observed_at + interval '120 seconds';

  if v_overflow_code is not null then
    v_next_status := 'review_required';
  elsif v_bundle.status = 'processing' then
    v_next_status := 'open';
  elsif v_bundle.status = 'review_required' then
    v_next_status := 'review_required';
  else
    v_next_status := 'open';
  end if;

  insert into inbound_message_bundle_items (
    id, tenant_id, bundle_id, message_id, channel_event_id, media_asset_id,
    ordinal, item_type, caption_text, reply_to_provider_message_id,
    actor_type, sender_id, observed_at, created_at
  ) values (
    v_item_id,
    p_tenant_id,
    v_bundle_id,
    v_message_id,
    v_channel_event_id,
    v_media_asset_id,
    v_next_item_count,
    v_item_type,
    v_caption_text,
    v_reply_to_provider_message_id,
    v_actor_type,
    v_sender_id,
    v_observed_at,
    v_observed_at
  );

  update inbound_message_bundles
  set last_event_at = v_observed_at,
      ready_at = v_ready_at,
      item_count = v_next_item_count,
      image_count = v_next_image_count,
      unicode_codepoint_count = v_next_unicode_count,
      bundle_revision = v_bundle.bundle_revision + 1,
      status = v_next_status,
      lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      failure_code = coalesce(v_overflow_code, failure_code),
      updated_at = v_observed_at
  where tenant_id = p_tenant_id
    and id = v_bundle_id
  returning * into v_bundle;

  return v_bundle;
end;
$$;

create or replace function p85_stage_4b3_claim_bundle_v2(
  p_tenant_id uuid,
  p_worker_id text
)
returns setof inbound_message_bundles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed inbound_message_bundles%rowtype;
  v_token uuid := gen_random_uuid();
  v_conversation_revision bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if coalesce(trim(p_worker_id), '') = '' then
    raise exception 'worker_id_required';
  end if;

  select *
    into v_claimed
  from inbound_message_bundles
  where tenant_id = p_tenant_id
    and status = 'ready'
    and ready_at <= now()
    and retry_count < 3
    and (next_attempt_at is null or next_attempt_at <= now())
    and (lease_expires_at is null or lease_expires_at < now())
  order by ready_at asc, created_at asc
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  select coalesce(c.revision, 1)
    into v_conversation_revision
  from conversations c
  where c.tenant_id = p_tenant_id
    and c.id = v_claimed.conversation_id;

  if v_conversation_revision <> v_claimed.conversation_revision_at_open then
    update inbound_message_bundles
    set status = 'open',
        ready_at = now() + interval '120 seconds',
        last_event_at = now(),
        bundle_revision = v_claimed.bundle_revision + 1,
        conversation_revision_at_open = v_conversation_revision,
        lease_owner = null,
        lease_token = null,
        lease_expires_at = null,
        updated_at = now()
    where tenant_id = p_tenant_id
      and id = v_claimed.id;
    return;
  end if;

  update inbound_message_bundles
  set status = 'processing',
      lease_owner = p_worker_id,
      lease_token = v_token,
      lease_expires_at = now() + interval '60 seconds',
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = v_claimed.id
  returning * into v_claimed;

  return next v_claimed;
end;
$$;

drop function if exists p85_stage_4b3_release_bundle_work_v2(uuid, uuid, text, uuid, boolean, boolean, text);

create or replace function p85_stage_4b3_release_bundle_work_v2(
  p_tenant_id uuid,
  p_bundle_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_outcome text,
  p_failure_code text default null
)
returns inbound_message_bundles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row inbound_message_bundles%rowtype;
  v_next_retry integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_lease_token is null then
    raise exception 'lease_token_required';
  end if;

  if p_outcome not in (
    'success',
    'review_required',
    'retryable_failure',
    'terminal_failure',
    'human_handled'
  ) then
    raise exception 'bundle_work_outcome_invalid';
  end if;

  select *
    into v_row
  from inbound_message_bundles
  where tenant_id = p_tenant_id
    and id = p_bundle_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  for update;

  if not found then
    raise exception 'bundle_lease_not_found';
  end if;

  if p_outcome = 'success' then
    if v_row.status = 'decided' then
      update inbound_message_bundles
      set lease_owner = null,
          lease_token = null,
          lease_expires_at = null,
          updated_at = now()
      where tenant_id = p_tenant_id
        and id = p_bundle_id
      returning * into v_row;
      return v_row;
    end if;
    raise exception 'bundle_success_requires_decided';
  end if;

  v_next_retry := least(v_row.retry_count + 1, 3);

  update inbound_message_bundles
  set lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      status = case p_outcome
        when 'human_handled' then 'cancelled'
        when 'review_required' then 'review_required'
        when 'terminal_failure' then 'failed'
        when 'retryable_failure' then case when v_next_retry >= 3 then 'failed' else 'ready' end
        else v_row.status
      end,
      retry_count = case
        when p_outcome = 'retryable_failure' then v_next_retry
        else retry_count
      end,
      next_attempt_at = case
        when p_outcome = 'retryable_failure' and v_next_retry < 3 then now() + interval '30 seconds'
        else null
      end,
      failure_code = case
        when p_outcome = 'human_handled' then coalesce(p_failure_code, 'human_handled')
        when p_outcome in ('review_required', 'retryable_failure', 'terminal_failure')
          then coalesce(p_failure_code, failure_code)
        else failure_code
      end,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_bundle_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function p85_stage_4b2_commit_conversation_mutation_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_request_id uuid,
  p_operation text,
  p_action text,
  p_conversation_id uuid,
  p_message_id uuid,
  p_payload jsonb,
  p_response_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cached_response jsonb;
  v_existing_operation text;
  v_existing_conversation_id uuid;
  v_client_id uuid;
  v_red_lock_status text;
begin
  if p_operation not in ('manual_reply', 'draft_review') then
    raise exception 'mutation_operation_invalid';
  end if;
  if p_operation = 'manual_reply' and p_action <> 'manual_reply' then
    raise exception 'mutation_operation_invalid';
  end if;
  if p_operation = 'draft_review'
     and p_action not in ('approve', 'edit_send', 'dismiss', 'review_send_manual') then
    raise exception 'mutation_operation_invalid';
  end if;
  if p_request_id is null or p_response_json is null then
    raise exception 'mutation_request_invalid';
  end if;
  if p_operation = 'draft_review' and p_message_id is null then
    raise exception 'message_not_found';
  end if;

  insert into conversation_mutation_idempotency (
    tenant_id,
    request_id,
    operation,
    conversation_id,
    response_json
  ) values (
    p_tenant_id,
    p_request_id,
    p_operation,
    p_conversation_id,
    jsonb_build_object('__pending', true)
  )
  on conflict (tenant_id, request_id) do nothing;

  select operation, conversation_id, response_json
    into v_existing_operation, v_existing_conversation_id, v_cached_response
  from conversation_mutation_idempotency
  where tenant_id = p_tenant_id
    and request_id = p_request_id
  for update;

  if v_existing_operation <> p_operation
     or v_existing_conversation_id <> p_conversation_id then
    raise exception 'idempotency_key_conflict';
  end if;
  if not (v_cached_response ? '__pending') then
    return v_cached_response;
  end if;

  select c.client_id, cl.red_risk_lock->>'status'
    into v_client_id, v_red_lock_status
  from conversations c
  join clients cl
    on cl.tenant_id = c.tenant_id
   and cl.id = c.client_id
  where c.tenant_id = p_tenant_id
    and c.id = p_conversation_id
    and cl.lifecycle_status = 'active'
  for update of cl;

  if not found then
    raise exception 'conversation_not_found';
  end if;
  if not p85_stage_4b2_actor_can_mutate_conversation(
    p_tenant_id, p_conversation_id, p_user_id, p_dietitian_id, p_role
  ) then
    raise exception 'conversation_mutation_forbidden';
  end if;
  perform p85_stage_4b2_assert_mutation_payload_scope(
    p_tenant_id, p_conversation_id, v_client_id, p_payload
  );

  if p_operation = 'draft_review' and p_action = 'review_send_manual'
     and coalesce(v_red_lock_status, 'none') = 'locked' then
    raise exception 'red_lock_superseded';
  end if;
  if p_operation = 'draft_review' then
    perform 1
    from messages m
    where m.tenant_id = p_tenant_id
      and m.id = p_message_id
      and m.conversation_id = p_conversation_id
    for update;
    if not found then
      raise exception 'message_not_found';
    end if;
  end if;

  if p_operation = 'manual_reply' then
    perform commit_manual_reply(p_tenant_id, p_payload);
    if p_payload ? 'bundleAppend' then
      perform p85_stage_4b3_append_bundle_item_v2(p_tenant_id, p_payload->'bundleAppend');
    end if;
  else
    perform commit_draft_review(p_tenant_id, p_payload);
  end if;

  update conversation_mutation_idempotency
  set response_json = p_response_json
  where tenant_id = p_tenant_id
    and request_id = p_request_id;

  return p_response_json;
end;
$$;

revoke all on function p85_stage_4b3_append_bundle_item_v2(uuid, jsonb) from public, anon, authenticated;
revoke all on function p85_stage_4b3_release_bundle_work_v2(uuid, uuid, text, uuid, text, text) from public, anon, authenticated;

grant execute on function p85_stage_4b3_append_bundle_item_v2(uuid, jsonb) to service_role;
grant execute on function p85_stage_4b3_release_bundle_work_v2(uuid, uuid, text, uuid, text, text) to service_role;
