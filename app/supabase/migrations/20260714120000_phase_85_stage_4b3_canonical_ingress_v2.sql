-- Phase 85 Stage 4B-3 remediation R3: durable canonical ingress, sanitized media commit, and terminal admission handling.

alter table notifications
  drop constraint if exists notifications_kind_check;

alter table notifications
  add constraint notifications_kind_check check (
    kind in (
      'structured_record_update_required',
      'competing_authoritative_instructions',
      'unsupported_media_review',
      'safe_reply_unavailable',
      'delivery_failed',
      'communication_permission_closed',
      'ai_window_expired',
      'ai_paused_by_verified_human',
      'draft_invalidated',
      'human_control_integrity',
      'visual_message_review',
      'visual_correction_follow_up',
      'legacy_system',
      'legacy_handoff'
    )
  );

create or replace function p85_stage_4b3_commit_canonical_inbound_v2(
  p_tenant_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_event_id text := nullif(p_payload #>> '{channelEvent,providerEventId}', '');
  v_content_sha256 text := nullif(p_payload #>> '{mediaAsset,contentSha256}', '');
  v_bundle_action text := nullif(p_payload->>'bundleAction', '');
  v_channel_event jsonb := p_payload->'channelEvent';
  v_message jsonb := p_payload->'message';
  v_media_asset jsonb := p_payload->'mediaAsset';
  v_bundle jsonb := p_payload->'bundle';
  v_bundle_item jsonb := p_payload->'bundleItem';
  v_audit jsonb := p_payload->'auditEvent';
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if v_channel_event is null or v_message is null then
    raise exception 'canonical_inbound_payload_invalid';
  end if;

  if v_provider_event_id is not null and exists (
    select 1
    from channel_events ce
    where ce.tenant_id = p_tenant_id
      and ce.provider_event_id = v_provider_event_id
  ) then
    return jsonb_build_object('status', 'duplicate_event');
  end if;

  if v_content_sha256 is not null and exists (
    select 1
    from media_assets ma
    where ma.tenant_id = p_tenant_id
      and ma.content_sha256 = v_content_sha256
      and ma.status not in ('failed', 'revoked', 'expired')
  ) then
    return jsonb_build_object('status', 'duplicate_content_hash');
  end if;

  insert into channel_events (
    id, tenant_id, account_binding_id, event_kind, processing_status,
    provider_account_id, provider_event_id, provider_message_id,
    from_identity, to_identity, counterparty_identity, payload_digest,
    payload_schema_version, provider_time, observed_at, committed_at,
    quarantine_id, replay_of_event_id, retry_count
  ) values (
    (v_channel_event->>'id')::uuid,
    p_tenant_id,
    nullif(v_channel_event->>'accountBindingId', '')::uuid,
    v_channel_event->>'eventKind',
    v_channel_event->>'processingStatus',
    nullif(v_channel_event->>'providerAccountId', ''),
    nullif(v_channel_event->>'providerEventId', ''),
    nullif(v_channel_event->>'providerMessageId', ''),
    nullif(v_channel_event->>'fromIdentity', ''),
    nullif(v_channel_event->>'toIdentity', ''),
    nullif(v_channel_event->>'counterpartyIdentity', ''),
    v_channel_event->>'payloadDigest',
    v_channel_event->>'payloadSchemaVersion',
    nullif(v_channel_event->>'providerTime', '')::timestamptz,
    coalesce(nullif(v_channel_event->>'observedAt', '')::timestamptz, now()),
    nullif(v_channel_event->>'committedAt', '')::timestamptz,
    nullif(v_channel_event->>'quarantineId', '')::uuid,
    nullif(v_channel_event->>'replayOfEventId', '')::uuid,
    coalesce(nullif(v_channel_event->>'retryCount', '')::integer, 0)
  );

  perform p85_if_r1_upsert_messages(
    p_tenant_id,
    jsonb_build_object('messages', jsonb_build_array(v_message)),
    true
  );

  if v_media_asset is not null then
    insert into media_assets (
      id, tenant_id, client_id, conversation_id, message_id, channel_event_id,
      position, provider_media_id, provider_media_id_hash, declared_mime_type,
      detected_mime_type, width, height, byte_size, content_sha256,
      sanitized_full_object_key, thumbnail_object_key, status, retry_count,
      next_attempt_at, lease_expires_at, lease_owner, stored_at, expires_at,
      failure_code, created_at, updated_at
    ) values (
      (v_media_asset->>'id')::uuid,
      p_tenant_id,
      (v_media_asset->>'clientId')::uuid,
      (v_media_asset->>'conversationId')::uuid,
      (v_media_asset->>'messageId')::uuid,
      nullif(v_media_asset->>'channelEventId', '')::uuid,
      coalesce(nullif(v_media_asset->>'position', '')::integer, 1),
      nullif(v_media_asset->>'providerMediaId', ''),
      nullif(v_media_asset->>'providerMediaIdHash', ''),
      v_media_asset->>'declaredMimeType',
      nullif(v_media_asset->>'detectedMimeType', ''),
      nullif(v_media_asset->>'width', '')::integer,
      nullif(v_media_asset->>'height', '')::integer,
      nullif(v_media_asset->>'byteSize', '')::bigint,
      nullif(v_media_asset->>'contentSha256', ''),
      nullif(v_media_asset->>'sanitizedFullObjectKey', ''),
      nullif(v_media_asset->>'thumbnailObjectKey', ''),
      coalesce(v_media_asset->>'status', 'download_pending'),
      coalesce(nullif(v_media_asset->>'retryCount', '')::integer, 0),
      nullif(v_media_asset->>'nextAttemptAt', '')::timestamptz,
      nullif(v_media_asset->>'leaseExpiresAt', '')::timestamptz,
      nullif(v_media_asset->>'leaseOwner', ''),
      nullif(v_media_asset->>'storedAt', '')::timestamptz,
      nullif(v_media_asset->>'expiresAt', '')::timestamptz,
      nullif(v_media_asset->>'failureCode', ''),
      coalesce(nullif(v_media_asset->>'createdAt', '')::timestamptz, now()),
      coalesce(nullif(v_media_asset->>'updatedAt', '')::timestamptz, now())
    );
  end if;

  if v_bundle_action = 'open' and v_bundle is not null and v_bundle_item is not null then
    insert into inbound_message_bundles (
      id, tenant_id, client_id, conversation_id, anchor_message_id, status,
      opened_at, last_event_at, ready_at, bundle_revision, conversation_revision_at_open,
      item_count, image_count, unicode_codepoint_count, retry_count, created_at, updated_at
    ) values (
      (v_bundle->>'id')::uuid,
      p_tenant_id,
      (v_bundle->>'clientId')::uuid,
      (v_bundle->>'conversationId')::uuid,
      (v_bundle->>'anchorMessageId')::uuid,
      coalesce(v_bundle->>'status', 'open'),
      coalesce(nullif(v_bundle->>'openedAt', '')::timestamptz, now()),
      coalesce(nullif(v_bundle->>'lastEventAt', '')::timestamptz, now()),
      coalesce(nullif(v_bundle->>'readyAt', '')::timestamptz, now()),
      coalesce(nullif(v_bundle->>'bundleRevision', '')::bigint, 1),
      coalesce(nullif(v_bundle->>'conversationRevisionAtOpen', '')::bigint, 1),
      coalesce(nullif(v_bundle->>'itemCount', '')::integer, 1),
      coalesce(nullif(v_bundle->>'imageCount', '')::integer, 0),
      coalesce(nullif(v_bundle->>'unicodeCodepointCount', '')::integer, 0),
      coalesce(nullif(v_bundle->>'retryCount', '')::integer, 0),
      coalesce(nullif(v_bundle->>'createdAt', '')::timestamptz, now()),
      coalesce(nullif(v_bundle->>'updatedAt', '')::timestamptz, now())
    );

    insert into inbound_message_bundle_items (
      id, tenant_id, bundle_id, message_id, channel_event_id, media_asset_id,
      ordinal, item_type, caption_text, reply_to_provider_message_id,
      actor_type, sender_id, observed_at, created_at
    ) values (
      (v_bundle_item->>'id')::uuid,
      p_tenant_id,
      (v_bundle_item->>'bundleId')::uuid,
      (v_bundle_item->>'messageId')::uuid,
      nullif(v_bundle_item->>'channelEventId', '')::uuid,
      nullif(v_bundle_item->>'mediaAssetId', '')::uuid,
      coalesce(nullif(v_bundle_item->>'ordinal', '')::integer, 1),
      v_bundle_item->>'itemType',
      nullif(v_bundle_item->>'captionText', ''),
      nullif(v_bundle_item->>'replyToProviderMessageId', ''),
      coalesce(v_bundle_item->>'actorType', 'client'),
      nullif(v_bundle_item->>'senderId', '')::uuid,
      coalesce(nullif(v_bundle_item->>'observedAt', '')::timestamptz, now()),
      coalesce(nullif(v_bundle_item->>'createdAt', '')::timestamptz, now())
    );
  elsif v_bundle_action = 'append' and v_bundle is not null and v_bundle_item is not null then
    update inbound_message_bundles
    set last_event_at = coalesce(nullif(v_bundle->>'lastEventAt', '')::timestamptz, last_event_at),
        ready_at = coalesce(nullif(v_bundle->>'readyAt', '')::timestamptz, ready_at),
        item_count = coalesce(nullif(v_bundle->>'itemCount', '')::integer, item_count),
        image_count = coalesce(nullif(v_bundle->>'imageCount', '')::integer, image_count),
        unicode_codepoint_count = coalesce(nullif(v_bundle->>'unicodeCodepointCount', '')::integer, unicode_codepoint_count),
        bundle_revision = coalesce(nullif(v_bundle->>'bundleRevision', '')::bigint, bundle_revision),
        status = coalesce(v_bundle->>'status', status),
        updated_at = coalesce(nullif(v_bundle->>'updatedAt', '')::timestamptz, now())
    where tenant_id = p_tenant_id
      and id = (v_bundle->>'id')::uuid;

    insert into inbound_message_bundle_items (
      id, tenant_id, bundle_id, message_id, channel_event_id, media_asset_id,
      ordinal, item_type, caption_text, reply_to_provider_message_id,
      actor_type, sender_id, observed_at, created_at
    ) values (
      (v_bundle_item->>'id')::uuid,
      p_tenant_id,
      (v_bundle_item->>'bundleId')::uuid,
      (v_bundle_item->>'messageId')::uuid,
      nullif(v_bundle_item->>'channelEventId', '')::uuid,
      nullif(v_bundle_item->>'mediaAssetId', '')::uuid,
      coalesce(nullif(v_bundle_item->>'ordinal', '')::integer, 1),
      v_bundle_item->>'itemType',
      nullif(v_bundle_item->>'captionText', ''),
      nullif(v_bundle_item->>'replyToProviderMessageId', ''),
      coalesce(v_bundle_item->>'actorType', 'client'),
      nullif(v_bundle_item->>'senderId', '')::uuid,
      coalesce(nullif(v_bundle_item->>'observedAt', '')::timestamptz, now()),
      coalesce(nullif(v_bundle_item->>'createdAt', '')::timestamptz, now())
    );
  end if;

  if v_audit is not null then
    insert into audit_events (
      id, tenant_id, actor_type, actor_id, event_type, entity_type, entity_id, metadata, created_at
    ) values (
      (v_audit->>'id')::uuid,
      p_tenant_id,
      coalesce(v_audit->>'actorType', 'system'),
      coalesce(v_audit->>'actorId', 'stage4b3-canonical-ingress'),
      v_audit->>'eventType',
      v_audit->>'entityType',
      coalesce(v_audit->>'entityId', v_channel_event->>'id'),
      coalesce(v_audit->'metadata', '{}'::jsonb),
      coalesce(nullif(v_audit->>'createdAt', '')::timestamptz, now())
    ) on conflict (id) do nothing;
  end if;

  return jsonb_build_object(
    'status', 'committed',
    'channelEventId', v_channel_event->>'id',
    'messageId', v_message->>'id',
    'mediaAssetId', case when v_media_asset is null then null else v_media_asset->>'id' end,
    'bundleId', case when v_bundle is null then null else v_bundle->>'id' end
  );
end;
$$;

create or replace function p85_stage_4b3_commit_sanitized_media_v2(
  p_tenant_id uuid,
  p_asset_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_payload jsonb
)
returns media_assets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row media_assets%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  update media_assets
  set provider_media_id = null,
      detected_mime_type = coalesce(nullif(p_payload->>'detectedMimeType', ''), detected_mime_type),
      width = coalesce(nullif(p_payload->>'width', '')::integer, width),
      height = coalesce(nullif(p_payload->>'height', '')::integer, height),
      byte_size = coalesce(nullif(p_payload->>'byteSize', '')::bigint, byte_size),
      content_sha256 = coalesce(nullif(p_payload->>'contentSha256', ''), content_sha256),
      sanitized_full_object_key = coalesce(nullif(p_payload->>'sanitizedFullObjectKey', ''), sanitized_full_object_key),
      thumbnail_object_key = coalesce(nullif(p_payload->>'thumbnailObjectKey', ''), thumbnail_object_key),
      status = coalesce(nullif(p_payload->>'status', ''), 'sanitized'),
      stored_at = coalesce(nullif(p_payload->>'storedAt', '')::timestamptz, now()),
      expires_at = nullif(p_payload->>'expiresAt', '')::timestamptz,
      failure_code = null,
      lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_asset_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  returning * into v_row;

  if not found then
    raise exception 'media_asset_lease_not_found';
  end if;

  return v_row;
end;
$$;

create or replace function p85_stage_4b3_enqueue_media_object_operation_v2(
  p_tenant_id uuid,
  p_media_asset_id uuid,
  p_object_key text,
  p_operation_kind text default 'delete_object',
  p_failure_code text default null
)
returns media_object_operations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row media_object_operations%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  insert into media_object_operations (
    id, tenant_id, media_asset_id, object_key, operation_kind, status, failure_code, created_at, updated_at
  ) values (
    gen_random_uuid(),
    p_tenant_id,
    p_media_asset_id,
    p_object_key,
    coalesce(nullif(p_operation_kind, ''), 'delete_object'),
    'pending',
    p_failure_code,
    now(),
    now()
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function p85_stage_4b3_finalize_terminal_admission_failure_v2(
  p_tenant_id uuid,
  p_asset_id uuid,
  p_bundle_id uuid,
  p_failure_code text,
  p_notification jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification jsonb := coalesce(p_notification, '{}'::jsonb);
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  update media_assets
  set status = 'failed',
      failure_code = p_failure_code,
      provider_media_id = null,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_asset_id;

  update messages
  set content_status = 'content_unavailable',
      retrieval_eligibility = 'excluded_unavailable'
  where tenant_id = p_tenant_id
    and id = (select message_id from media_assets where tenant_id = p_tenant_id and id = p_asset_id);

  if p_bundle_id is not null then
    update inbound_message_bundles
    set status = 'review_required',
        failure_code = p_failure_code,
        lease_owner = null,
        lease_token = null,
        lease_expires_at = null,
        updated_at = now()
    where tenant_id = p_tenant_id
      and id = p_bundle_id;
  end if;

  if v_notification ? 'id' then
    insert into notifications (
      id, tenant_id, type, kind, priority, entity_type, entity_id, title, body,
      read, dedupe_key, client_id, conversation_id, message_id,
      occurrence_count, last_occurred_at, created_at
    ) values (
      (v_notification->>'id')::uuid,
      p_tenant_id,
      coalesce(v_notification->>'type', 'visual_message_review'),
      coalesce(v_notification->>'kind', 'visual_message_review'),
      coalesce(v_notification->>'priority', 'review_required'),
      coalesce(v_notification->>'entityType', 'inbound_message_bundle'),
      coalesce(v_notification->>'entityId', p_bundle_id::text),
      coalesce(v_notification->>'title', 'Visual message review required'),
      coalesce(v_notification->>'body', 'Media admission failed and requires dietitian review.'),
      false,
      nullif(v_notification->>'dedupeKey', ''),
      nullif(v_notification->>'clientId', '')::uuid,
      nullif(v_notification->>'conversationId', '')::uuid,
      nullif(v_notification->>'messageId', '')::uuid,
      coalesce(nullif(v_notification->>'occurrenceCount', '')::integer, 1),
      coalesce(nullif(v_notification->>'lastOccurredAt', '')::timestamptz, now()),
      coalesce(nullif(v_notification->>'createdAt', '')::timestamptz, now())
    ) on conflict (id) do nothing;
  end if;

  return jsonb_build_object('status', 'terminal_admission_failure_recorded', 'assetId', p_asset_id);
end;
$$;

revoke all on function p85_stage_4b3_commit_canonical_inbound_v2(uuid, jsonb) from public, anon, authenticated;
revoke all on function p85_stage_4b3_commit_sanitized_media_v2(uuid, uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function p85_stage_4b3_enqueue_media_object_operation_v2(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function p85_stage_4b3_finalize_terminal_admission_failure_v2(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;

grant execute on function p85_stage_4b3_commit_canonical_inbound_v2(uuid, jsonb) to service_role;
grant execute on function p85_stage_4b3_commit_sanitized_media_v2(uuid, uuid, text, uuid, jsonb) to service_role;
grant execute on function p85_stage_4b3_enqueue_media_object_operation_v2(uuid, uuid, text, text, text) to service_role;
grant execute on function p85_stage_4b3_finalize_terminal_admission_failure_v2(uuid, uuid, uuid, text, jsonb) to service_role;
