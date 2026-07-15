-- Phase 85 Stage 4B-4 post-closure remediation R1:
-- domain contracts, transcription lineage columns, correction lineage, and DB invariants.

alter table audio_transcription_records
  add column if not exists origin text,
  add column if not exists transcript_text text,
  add column if not exists detected_locale text,
  add column if not exists overall_confidence numeric,
  add column if not exists minimum_segment_confidence numeric,
  add column if not exists uncertain_span_count integer,
  add column if not exists segment_count integer,
  add column if not exists speaker_state text,
  add column if not exists supersedes_transcription_id uuid,
  add column if not exists superseded_by_transcription_id uuid;

alter table audio_transcript_corrections
  add column if not exists source_transcription_id uuid,
  add column if not exists corrected_transcription_id uuid,
  add column if not exists target_message_id uuid,
  add column if not exists superseded_decision_id uuid,
  add column if not exists rerun_decision_id uuid;

update audio_transcription_records
set
  transcript_text = coalesce(transcript_text, observation->>'transcriptText'),
  detected_locale = coalesce(detected_locale, observation->>'locale'),
  overall_confidence = coalesce(
    overall_confidence,
    (
      select min((segment->>'confidence')::numeric)
      from jsonb_array_elements(coalesce(observation->'segments', '[]'::jsonb)) segment
      where segment ? 'confidence'
    ),
    nullif(observation->>'overallConfidence', '')::numeric
  ),
  minimum_segment_confidence = coalesce(
    minimum_segment_confidence,
    (
      select min((segment->>'confidence')::numeric)
      from jsonb_array_elements(coalesce(observation->'segments', '[]'::jsonb)) segment
      where segment ? 'confidence'
    )
  ),
  uncertain_span_count = coalesce(
    uncertain_span_count,
    (
      select count(*)::integer
      from jsonb_array_elements(coalesce(observation->'segments', '[]'::jsonb)) segment
      where coalesce((segment->>'uncertain')::boolean, false)
    ),
    coalesce(nullif(observation->>'uncertainSpanCount', '')::integer, 0)
  ),
  segment_count = coalesce(
    segment_count,
    jsonb_array_length(coalesce(observation->'segments', '[]'::jsonb))
  ),
  speaker_state = coalesce(
    speaker_state,
    nullif(observation->>'speakerState', ''),
    case when observation is not null then 'single_speaker' else null end
  ),
  origin = coalesce(
    origin,
    case
      when observation is null then null
      when observation->>'providerId' = 'dietitian-correction' then 'dietitian_correction'
      else 'mock_provider'
    end
  )
where observation is not null;

update audio_transcription_records source
set superseded_by_transcription_id = corrected.id
from audio_transcription_records corrected
where source.tenant_id = corrected.tenant_id
  and source.media_asset_id = corrected.media_asset_id
  and corrected.transcription_revision = source.transcription_revision + 1
  and source.status = 'superseded'
  and corrected.status = 'accepted'
  and source.superseded_by_transcription_id is null;

update audio_transcription_records corrected
set supersedes_transcription_id = source.id
from audio_transcription_records source
where source.tenant_id = corrected.tenant_id
  and source.media_asset_id = corrected.media_asset_id
  and corrected.transcription_revision = source.transcription_revision + 1
  and source.status = 'superseded'
  and corrected.status = 'accepted'
  and corrected.supersedes_transcription_id is null;

update audio_transcript_corrections c
set
  source_transcription_id = coalesce(c.source_transcription_id, c.transcription_id),
  target_message_id = coalesce(
    c.target_message_id,
    (
      select src.message_id
      from audio_transcription_records src
      where src.tenant_id = c.tenant_id
        and src.id = c.transcription_id
    )
  ),
  corrected_transcription_id = coalesce(
    c.corrected_transcription_id,
    (
      select next_rec.id
      from audio_transcription_records src
      join audio_transcription_records next_rec
        on next_rec.tenant_id = src.tenant_id
       and next_rec.media_asset_id = src.media_asset_id
       and next_rec.transcription_revision = src.transcription_revision + 1
      where src.tenant_id = c.tenant_id
        and src.id = c.transcription_id
    )
  ),
  superseded_decision_id = coalesce(
    c.superseded_decision_id,
    (
      select b.decision_id
      from audio_transcription_records src
      left join inbound_message_bundles b
        on b.tenant_id = src.tenant_id
       and b.id = src.bundle_id
      where src.tenant_id = c.tenant_id
        and src.id = c.transcription_id
    )
  );

alter table audio_transcription_records
  drop constraint if exists audio_transcription_records_origin_check;

alter table audio_transcription_records
  add constraint audio_transcription_records_origin_check check (
    origin is null or origin in ('mock_provider', 'dietitian_correction')
  );

alter table audio_transcription_records
  drop constraint if exists audio_transcription_records_speaker_state_check;

alter table audio_transcription_records
  add constraint audio_transcription_records_speaker_state_check check (
    speaker_state is null or speaker_state in ('single_speaker', 'multiple_speakers', 'unknown')
  );

alter table audio_transcription_records
  drop constraint if exists audio_transcription_records_confidence_range_check;

alter table audio_transcription_records
  add constraint audio_transcription_records_confidence_range_check check (
    (overall_confidence is null or (overall_confidence >= 0 and overall_confidence <= 1))
    and (minimum_segment_confidence is null or (minimum_segment_confidence >= 0 and minimum_segment_confidence <= 1))
  );

alter table audio_transcription_records
  drop constraint if exists audio_transcription_records_segment_count_check;

alter table audio_transcription_records
  add constraint audio_transcription_records_segment_count_check check (
    segment_count is null or (segment_count >= 1 and segment_count <= 128)
  );

alter table audio_transcription_records
  drop constraint if exists audio_transcription_records_uncertain_span_count_check;

alter table audio_transcription_records
  add constraint audio_transcription_records_uncertain_span_count_check check (
    uncertain_span_count is null or uncertain_span_count >= 0
  );

alter table audio_transcription_records
  drop constraint if exists audio_transcription_records_detected_locale_check;

alter table audio_transcription_records
  add constraint audio_transcription_records_detected_locale_check check (
    detected_locale is null or detected_locale in ('tr-TR', 'en-US', 'de-DE', 'fr-FR', 'es-ES', 'pt-PT', 'cs-CZ')
  );

alter table audio_transcription_records
  drop constraint if exists audio_transcription_records_supersession_self_check;

alter table audio_transcription_records
  add constraint audio_transcription_records_supersession_self_check check (
    supersedes_transcription_id is null or supersedes_transcription_id <> id
  );

alter table audio_transcription_records
  drop constraint if exists audio_transcription_records_superseded_by_self_check;

alter table audio_transcription_records
  add constraint audio_transcription_records_superseded_by_self_check check (
    superseded_by_transcription_id is null or superseded_by_transcription_id <> id
  );

alter table audio_transcription_records
  drop constraint if exists audio_transcription_records_dietitian_correction_confidence_check;

alter table audio_transcription_records
  add constraint audio_transcription_records_dietitian_correction_confidence_check check (
    origin <> 'dietitian_correction'
    or (overall_confidence is null and minimum_segment_confidence is null)
  );

alter table audio_transcription_records
  drop constraint if exists audio_transcription_records_terminal_metrics_check;

alter table audio_transcription_records
  add constraint audio_transcription_records_terminal_metrics_check check (
    status in ('pending', 'processing', 'failed')
    or observation is null
    or (
      transcript_text is not null
      and detected_locale is not null
      and segment_count is not null
      and uncertain_span_count is not null
      and speaker_state is not null
      and origin is not null
    )
  );

create unique index if not exists audio_transcription_records_tenant_message_revision_idx
  on audio_transcription_records (tenant_id, message_id, transcription_revision);

alter table audio_transcription_records
  drop constraint if exists audio_transcription_records_supersedes_tenant_fk;

alter table audio_transcription_records
  add constraint audio_transcription_records_supersedes_tenant_fk
  foreign key (tenant_id, supersedes_transcription_id)
  references audio_transcription_records (tenant_id, id)
  deferrable initially deferred;

alter table audio_transcription_records
  drop constraint if exists audio_transcription_records_superseded_by_tenant_fk;

alter table audio_transcription_records
  add constraint audio_transcription_records_superseded_by_tenant_fk
  foreign key (tenant_id, superseded_by_transcription_id)
  references audio_transcription_records (tenant_id, id)
  deferrable initially deferred;

alter table audio_transcript_corrections
  drop constraint if exists audio_transcript_corrections_source_transcription_tenant_fk;

alter table audio_transcript_corrections
  add constraint audio_transcript_corrections_source_transcription_tenant_fk
  foreign key (tenant_id, source_transcription_id)
  references audio_transcription_records (tenant_id, id);

alter table audio_transcript_corrections
  drop constraint if exists audio_transcript_corrections_corrected_transcription_tenant_fk;

alter table audio_transcript_corrections
  add constraint audio_transcript_corrections_corrected_transcription_tenant_fk
  foreign key (tenant_id, corrected_transcription_id)
  references audio_transcription_records (tenant_id, id);

alter table audio_transcript_corrections
  drop constraint if exists audio_transcript_corrections_target_message_tenant_fk;

alter table audio_transcript_corrections
  add constraint audio_transcript_corrections_target_message_tenant_fk
  foreign key (tenant_id, target_message_id)
  references messages (tenant_id, id);

alter table media_assets
  drop constraint if exists media_assets_transcription_tenant_fk;

alter table media_assets
  add constraint media_assets_transcription_tenant_fk
  foreign key (tenant_id, transcription_id)
  references audio_transcription_records (tenant_id, id)
  not valid;

create or replace function p85_stage_4b4_validate_transcription_supersession_lineage_v1(
  p_tenant_id uuid,
  p_record_id uuid,
  p_supersedes_transcription_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle uuid;
begin
  if p_supersedes_transcription_id is null then
    return;
  end if;

  if p_record_id = p_supersedes_transcription_id then
    raise exception 'transcription_supersession_self_reference';
  end if;

  with recursive lineage as (
    select id, supersedes_transcription_id, 1 as depth
    from audio_transcription_records
    where tenant_id = p_tenant_id
      and id = p_supersedes_transcription_id
    union all
    select next_rec.id, next_rec.supersedes_transcription_id, lineage.depth + 1
    from audio_transcription_records next_rec
    join lineage on next_rec.tenant_id = p_tenant_id
      and next_rec.id = lineage.supersedes_transcription_id
    where lineage.depth < 32
  )
  select id
    into v_cycle
  from lineage
  where id = p_record_id
  limit 1;

  if found then
    raise exception 'transcription_supersession_cycle_detected';
  end if;
end;
$$;

create or replace function p85_stage_4b4_validate_transcript_correction_lineage_v1(
  p_tenant_id uuid,
  p_source_transcription_id uuid,
  p_corrected_transcription_id uuid,
  p_target_message_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source audio_transcription_records%rowtype;
  v_corrected audio_transcription_records%rowtype;
begin
  select *
    into v_source
  from audio_transcription_records
  where tenant_id = p_tenant_id
    and id = p_source_transcription_id;

  if not found then
    raise exception 'correction_source_transcription_not_found';
  end if;

  if v_source.message_id <> p_target_message_id then
    raise exception 'correction_target_message_mismatch';
  end if;

  if p_corrected_transcription_id is null then
    return;
  end if;

  select *
    into v_corrected
  from audio_transcription_records
  where tenant_id = p_tenant_id
    and id = p_corrected_transcription_id;

  if not found then
    raise exception 'correction_corrected_transcription_not_found';
  end if;

  if v_corrected.tenant_id <> v_source.tenant_id
    or v_corrected.conversation_id <> v_source.conversation_id
    or v_corrected.message_id <> v_source.message_id then
    raise exception 'correction_lineage_scope_mismatch';
  end if;

  if v_corrected.transcription_revision <> v_source.transcription_revision + 1 then
    raise exception 'correction_revision_lineage_invalid';
  end if;

  if v_corrected.supersedes_transcription_id is not null
    and v_corrected.supersedes_transcription_id <> v_source.id then
    raise exception 'correction_supersedes_mismatch';
  end if;
end;
$$;

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
  v_corrected_transcription_id uuid := nullif(p_outcome->>'correctedTranscriptionId', '')::uuid;
  v_target_message_id uuid;
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

  v_target_message_id := v_transcription.message_id;

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
      superseded_by_transcription_id = coalesce(v_corrected_transcription_id, superseded_by_transcription_id),
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = v_transcription_id;

  if p_outcome ? 'correctedTranscription' then
    perform p85_stage_4b4_validate_transcription_supersession_lineage_v1(
      p_tenant_id,
      (p_outcome #>> '{correctedTranscription,id}')::uuid,
      v_transcription_id
    );

    insert into audio_transcription_records (
      id, tenant_id, client_id, conversation_id, message_id, media_asset_id, bundle_id,
      transcription_revision, status, locale, observation, quality_decision, rejection_reasons,
      source_modality, provider_mode, retrieval_eligible, evidence_expires_at,
      origin, transcript_text, detected_locale, overall_confidence, minimum_segment_confidence,
      uncertain_span_count, segment_count, speaker_state,
      supersedes_transcription_id, superseded_by_transcription_id,
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
      coalesce(p_outcome #>> '{correctedTranscription,origin}', 'dietitian_correction'),
      p_outcome #>> '{correctedTranscription,transcriptText}',
      p_outcome #>> '{correctedTranscription,detectedLocale}',
      nullif(p_outcome #>> '{correctedTranscription,overallConfidence}', '')::numeric,
      nullif(p_outcome #>> '{correctedTranscription,minimumSegmentConfidence}', '')::numeric,
      nullif(p_outcome #>> '{correctedTranscription,uncertainSpanCount}', '')::integer,
      nullif(p_outcome #>> '{correctedTranscription,segmentCount}', '')::integer,
      coalesce(p_outcome #>> '{correctedTranscription,speakerState}', 'single_speaker'),
      v_transcription_id,
      null,
      coalesce(nullif(p_outcome #>> '{correctedTranscription,createdAt}', '')::timestamptz, now()),
      coalesce(nullif(p_outcome #>> '{correctedTranscription,updatedAt}', '')::timestamptz, now())
    on conflict (id) do nothing;

    perform p85_stage_4b4_validate_transcript_correction_lineage_v1(
      p_tenant_id,
      v_transcription_id,
      (p_outcome #>> '{correctedTranscription,id}')::uuid,
      v_target_message_id
    );
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
      result_action, source_transcription_id, corrected_transcription_id,
      target_message_id, superseded_decision_id, rerun_decision_id,
      created_at, updated_at
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
      coalesce(nullif(p_outcome #>> '{correction,sourceTranscriptionId}', '')::uuid, v_transcription_id),
      coalesce(nullif(p_outcome #>> '{correction,correctedTranscriptionId}', '')::uuid, v_corrected_transcription_id),
      coalesce(nullif(p_outcome #>> '{correction,targetMessageId}', '')::uuid, v_target_message_id),
      nullif(p_outcome #>> '{correction,supersededDecisionId}', '')::uuid,
      nullif(p_outcome #>> '{correction,rerunDecisionId}', '')::uuid,
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

revoke all on function p85_stage_4b4_validate_transcription_supersession_lineage_v1(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4b4_validate_transcript_correction_lineage_v1(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4b4_commit_transcript_correction_v2(uuid, text, jsonb, jsonb) from public, anon, authenticated;

grant execute on function p85_stage_4b4_validate_transcription_supersession_lineage_v1(uuid, uuid, uuid) to service_role;
grant execute on function p85_stage_4b4_validate_transcript_correction_lineage_v1(uuid, uuid, uuid, uuid) to service_role;
grant execute on function p85_stage_4b4_commit_transcript_correction_v2(uuid, text, jsonb, jsonb) to service_role;
