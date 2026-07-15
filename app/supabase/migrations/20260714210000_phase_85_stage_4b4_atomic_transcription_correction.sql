create or replace function p85_stage_4b4_commit_transcript_correction_v2(
  p_tenant_id uuid,
  p_idempotency_key text,
  p_outcome jsonb,
  p_response_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cached audio_transcript_correction_idempotency%rowtype;
  v_transcription audio_transcription_records%rowtype;
  v_conversation_revision bigint;
  v_bundle inbound_message_bundles%rowtype;
  v_item record;
  v_result_action text := coalesce(p_outcome->>'resultAction', '');
  v_transcription_id uuid := nullif(p_outcome->>'transcriptionId', '')::uuid;
  v_correction_id uuid := nullif(p_outcome->>'correctionId', '')::uuid;
  v_expected_conversation_revision bigint := coalesce(nullif(p_outcome->>'expectedConversationRevision', '')::bigint, 0);
  v_expected_transcription_revision bigint := coalesce(nullif(p_outcome->>'expectedTranscriptionRevision', '')::bigint, 0);
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'idempotency_key_required';
  end if;

  if coalesce(p_outcome->>'version', '') <> 'p85-stage-4b4-transcript-correction-outcome-v1' then
    raise exception 'transcript_correction_outcome_version_invalid';
  end if;

  if v_result_action not in ('supersede_rerun', 'invalidate_pending', 'manual_follow_up', 'closed_without_send') then
    raise exception 'transcript_correction_result_action_invalid';
  end if;

  select *
    into v_cached
  from audio_transcript_correction_idempotency
  where tenant_id = p_tenant_id
    and dedupe_key = p_idempotency_key
  for update;

  if found then
    if v_cached.correction_id <> v_correction_id then
      raise exception 'idempotency_key_conflict';
    end if;
    return coalesce(v_cached.response_json, p_response_json);
  end if;

  select *
    into v_transcription
  from audio_transcription_records
  where tenant_id = p_tenant_id
    and id = v_transcription_id
  for update;

  if not found then
    raise exception 'transcription_not_found';
  end if;

  if v_transcription.transcription_revision <> v_expected_transcription_revision then
    raise exception 'stale_transcription_revision';
  end if;

  if v_transcription.status <> 'accepted' then
    raise exception 'transcription_not_correctable';
  end if;

  select coalesce(c.revision, 1)
    into v_conversation_revision
  from conversations c
  where c.tenant_id = p_tenant_id
    and c.id = v_transcription.conversation_id
  for update;

  if v_conversation_revision <> v_expected_conversation_revision then
    raise exception 'stale_conversation_revision';
  end if;

  if v_transcription.bundle_id is not null then
    select *
      into v_bundle
    from inbound_message_bundles
    where tenant_id = p_tenant_id
      and id = v_transcription.bundle_id
    for update;
  end if;

  if v_result_action = 'manual_follow_up' then
    if coalesce(jsonb_array_length(p_outcome->'outboundMessages'), 0) > 0 then
      raise exception 'sent_correction_auto_message_forbidden';
    end if;
  end if;

  update audio_transcription_records
  set status = 'superseded',
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = v_transcription_id;

  if p_outcome ? 'correctedTranscription' then
    insert into audio_transcription_records (
      id, tenant_id, client_id, conversation_id, message_id, media_asset_id, bundle_id,
      transcription_revision, status, locale, observation, quality_decision, rejection_reasons,
      source_modality, provider_mode, retrieval_eligible, evidence_expires_at,
      created_at, updated_at
    )
    select
      (p_outcome #>> '{correctedTranscription,id}')::uuid,
      p_tenant_id,
      (p_outcome #>> '{correctedTranscription,clientId}')::uuid,
      (p_outcome #>> '{correctedTranscription,conversationId}')::uuid,
      (p_outcome #>> '{correctedTranscription,messageId}')::uuid,
      (p_outcome #>> '{correctedTranscription,mediaAssetId}')::uuid,
      nullif(p_outcome #>> '{correctedTranscription,bundleId}', '')::uuid,
      coalesce(nullif(p_outcome #>> '{correctedTranscription,transcriptionRevision}', '')::bigint, v_expected_transcription_revision + 1),
      coalesce(p_outcome #>> '{correctedTranscription,status}', 'accepted'),
      p_outcome #>> '{correctedTranscription,locale}',
      p_outcome #> '{correctedTranscription,observation}',
      p_outcome #> '{correctedTranscription,qualityDecision}',
      coalesce(
        (select array_agg(value::text)
         from jsonb_array_elements_text(coalesce(p_outcome #> '{correctedTranscription,rejectionReasons}', '[]'::jsonb)) value),
        '{}'::text[]
      ),
      'voice_transcript',
      'mock',
      coalesce((p_outcome #>> '{correctedTranscription,retrievalEligible}')::boolean, true),
      nullif(p_outcome #>> '{correctedTranscription,evidenceExpiresAt}', '')::timestamptz,
      coalesce(nullif(p_outcome #>> '{correctedTranscription,createdAt}', '')::timestamptz, now()),
      coalesce(nullif(p_outcome #>> '{correctedTranscription,updatedAt}', '')::timestamptz, now())
    on conflict (id) do nothing;
  end if;

  if p_outcome ? 'messageUpdate' then
    perform p85_if_r1_upsert_messages(
      p_tenant_id,
      jsonb_build_object(
        'messages',
        jsonb_build_array(
          jsonb_build_object(
            'id', p_outcome #>> '{messageUpdate,messageId}',
            'body', p_outcome #>> '{messageUpdate,body}',
            'content_status', coalesce(p_outcome #>> '{messageUpdate,contentStatus}', 'available'),
            'retrieval_eligibility', coalesce(p_outcome #>> '{messageUpdate,retrievalEligibility}', 'eligible')
          )
        )
      ),
      false
    );
  end if;

  if nullif(p_outcome->>'mediaAssetTranscriptionId', '') is not null then
    update media_assets
    set transcription_id = nullif(p_outcome->>'mediaAssetTranscriptionId', '')::uuid,
        updated_at = now()
    where tenant_id = p_tenant_id
      and id = v_transcription.media_asset_id;
  end if;

  if nullif(p_outcome->>'bundleItemTranscriptionId', '') is not null then
    update inbound_message_bundle_items
    set transcription_id = nullif(p_outcome->>'bundleItemTranscriptionId', '')::uuid
    where tenant_id = p_tenant_id
      and transcription_id = v_transcription_id;
  end if;

  if p_outcome ? 'correction' then
    insert into audio_transcript_corrections (
      id, tenant_id, client_id, conversation_id, transcription_id, dietitian_id,
      status, reason_code, explanation, corrected_transcript,
      conversation_revision_at_submit, transcription_revision_at_submit,
      result_action, created_at, updated_at
    ) values (
      v_correction_id,
      p_tenant_id,
      (p_outcome #>> '{correction,clientId}')::uuid,
      (p_outcome #>> '{correction,conversationId}')::uuid,
      v_transcription_id,
      (p_outcome #>> '{correction,dietitianId}')::uuid,
      coalesce(p_outcome #>> '{correction,status}', 'submitted'),
      p_outcome #>> '{correction,reasonCode}',
      p_outcome #>> '{correction,explanation}',
      p_outcome #>> '{correction,correctedTranscript}',
      v_expected_conversation_revision,
      v_expected_transcription_revision,
      v_result_action,
      coalesce(nullif(p_outcome #>> '{correction,createdAt}', '')::timestamptz, now()),
      coalesce(nullif(p_outcome #>> '{correction,updatedAt}', '')::timestamptz, now())
    ) on conflict (id) do nothing;
  end if;

  if jsonb_array_length(coalesce(p_outcome->'draftInvalidations', '[]'::jsonb)) > 0 then
    perform p85_if_r1_upsert_messages(
      p_tenant_id,
      jsonb_build_object('messages', p_outcome->'draftInvalidations'),
      false
    );
  end if;

  if p_outcome ? 'bundleUpdate' and v_bundle.id is not null then
    update inbound_message_bundles
    set status = coalesce(p_outcome #>> '{bundleUpdate,status}', status),
        decision_id = nullif(p_outcome #>> '{bundleUpdate,decisionId}', '')::uuid,
        bundle_revision = coalesce(nullif(p_outcome #>> '{bundleUpdate,bundleRevision}', '')::bigint, bundle_revision),
        lease_owner = null,
        lease_token = null,
        lease_expires_at = null,
        updated_at = now()
    where tenant_id = p_tenant_id
      and id = v_bundle.id;
  end if;

  if p_outcome ? 'clientUpdate' then
    update clients
    set ai_status = coalesce(nullif(p_outcome #>> '{clientUpdate,aiStatus}', '')::client_ai_status, ai_status),
        ai_mode = coalesce(nullif(p_outcome #>> '{clientUpdate,aiMode}', '')::client_ai_mode, ai_mode),
        human_takeover_locked = coalesce((p_outcome #>> '{clientUpdate,humanTakeoverLocked}')::boolean, human_takeover_locked),
        context_revision = coalesce(nullif(p_outcome #>> '{clientUpdate,contextRevision}', '')::bigint, context_revision),
        updated_at = now()
    where tenant_id = p_tenant_id
      and id = (p_outcome #>> '{correction,clientId}')::uuid;
  end if;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_outcome->'notifications', '[]'::jsonb)) as value
  loop
    insert into notifications (
      id, tenant_id, type, kind, priority, entity_type, entity_id, title, body,
      read, dedupe_key, client_id, conversation_id, message_id,
      occurrence_count, last_occurred_at, created_at
    ) values (
      (v_item.value->>'id')::uuid,
      p_tenant_id,
      coalesce(v_item.value->>'type', 'system'),
      coalesce(v_item.value->>'kind', 'voice_transcript_correction_follow_up'),
      coalesce(v_item.value->>'priority', 'review_required'),
      v_item.value->>'entityType',
      v_item.value->>'entityId',
      v_item.value->>'title',
      v_item.value->>'body',
      false,
      nullif(v_item.value->>'dedupeKey', ''),
      nullif(v_item.value->>'clientId', '')::uuid,
      nullif(v_item.value->>'conversationId', '')::uuid,
      nullif(v_item.value->>'messageId', '')::uuid,
      coalesce(nullif(v_item.value->>'occurrenceCount', '')::integer, 1),
      coalesce(nullif(v_item.value->>'lastOccurredAt', '')::timestamptz, now()),
      coalesce(nullif(v_item.value->>'createdAt', '')::timestamptz, now())
    ) on conflict (tenant_id, dedupe_key) where dedupe_key is not null and resolved_at is null do update set
      occurrence_count = notifications.occurrence_count + 1,
      last_occurred_at = excluded.last_occurred_at,
      title = excluded.title,
      body = excluded.body;
  end loop;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_outcome->'auditEvents', '[]'::jsonb)) as value
  loop
    insert into audit_events (
      id, tenant_id, event_type, entity_type, entity_id, metadata, created_at
    ) values (
      (v_item.value->>'id')::uuid,
      p_tenant_id,
      v_item.value->>'eventType',
      v_item.value->>'entityType',
      v_item.value->>'entityId',
      coalesce(v_item.value->'metadata', '{}'::jsonb),
      coalesce(nullif(v_item.value->>'createdAt', '')::timestamptz, now())
    ) on conflict (id) do nothing;
  end loop;

  insert into audio_transcript_correction_idempotency (
    tenant_id,
    dedupe_key,
    correction_id,
    conversation_revision,
    response_json
  ) values (
    p_tenant_id,
    p_idempotency_key,
    v_correction_id,
    v_expected_conversation_revision,
    p_response_json
  );

  return p_response_json;
end;
$$;

revoke all on function p85_stage_4b4_commit_transcript_correction_v2(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function p85_stage_4b4_commit_transcript_correction_v2(uuid, text, jsonb, jsonb) to service_role;
