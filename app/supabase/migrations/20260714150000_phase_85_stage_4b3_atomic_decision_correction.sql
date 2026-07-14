-- Phase 85 Stage 4B-3 remediation R6: atomic bundle decision and visual correction orchestration.

create table if not exists visual_correction_idempotency (
  tenant_id uuid not null references tenants(id) on delete cascade,
  idempotency_key text not null,
  correction_id uuid not null,
  analysis_id uuid not null,
  conversation_revision bigint not null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, idempotency_key),
  constraint visual_correction_idempotency_revision_check check (conversation_revision >= 1)
);

alter table visual_correction_idempotency enable row level security;

drop policy if exists "p85 stage4b3 visual correction idempotency deny direct access" on visual_correction_idempotency;
create policy "p85 stage4b3 visual correction idempotency deny direct access"
on visual_correction_idempotency for all
using (false)
with check (false);

revoke all on table visual_correction_idempotency from public, anon, authenticated;
grant all on table visual_correction_idempotency to service_role;

create or replace function p85_stage_4b3_validate_bundle_decision_outcome_v2(p_outcome jsonb)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  v_action text := coalesce(p_outcome->>'action', '');
  v_risk text := coalesce(p_outcome->>'risk', '');
  v_sent_count integer := 0;
  v_draft_count integer := 0;
  v_handoff_count integer := 0;
begin
  if coalesce(p_outcome->>'version', '') <> 'p85-stage-4b3-bundle-decision-outcome-v2' then
    raise exception 'bundle_decision_outcome_version_invalid';
  end if;

  if v_action not in ('sent', 'draft_for_approval', 'handoff', 'no_ai') then
    raise exception 'bundle_decision_action_invalid';
  end if;

  if v_risk not in ('green', 'yellow', 'red') then
    raise exception 'bundle_decision_risk_invalid';
  end if;

  select count(*)::integer
    into v_sent_count
  from jsonb_array_elements(coalesce(p_outcome->'messages', '[]'::jsonb)) item
  where item->>'origin' = 'ai_generated'
    and item->>'status' = 'sent';

  select count(*)::integer
    into v_draft_count
  from jsonb_array_elements(coalesce(p_outcome->'messages', '[]'::jsonb)) item
  where item->>'origin' = 'ai_generated'
    and item->>'status' = 'draft';

  v_handoff_count := coalesce(jsonb_array_length(p_outcome->'handoffCases'), 0);

  if v_action = 'sent' then
    if v_risk <> 'green' then
      raise exception 'green_send_requires_green_risk';
    end if;
    if v_sent_count <> 1 or v_draft_count > 0 or v_handoff_count > 0 then
      raise exception 'outcome_sent_combination_invalid';
    end if;
  elsif v_action = 'draft_for_approval' then
    if v_sent_count > 0 or v_draft_count <> 1 then
      raise exception 'outcome_draft_combination_invalid';
    end if;
  elsif v_action = 'handoff' then
    if v_sent_count > 0 then
      raise exception 'non_green_boundary_response_forbidden';
    end if;
  else
    if v_sent_count > 0 then
      raise exception 'non_green_boundary_response_forbidden';
    end if;
  end if;

  if v_risk in ('yellow', 'red') and v_sent_count > 0 then
    raise exception 'non_green_boundary_response_forbidden';
  end if;
end;
$$;

create or replace function p85_stage_4b3_commit_bundle_decision_v2(
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
  v_cached bundle_decision_idempotency%rowtype;
  v_bundle inbound_message_bundles%rowtype;
  v_conversation_revision bigint;
  v_client clients%rowtype;
  v_bundle_id uuid := nullif(p_outcome->>'bundleId', '')::uuid;
  v_decision_id uuid := nullif(p_outcome->>'decisionId', '')::uuid;
  v_expected_bundle_revision bigint := coalesce(nullif(p_outcome->>'expectedBundleRevision', '')::bigint, 0);
  v_expected_conversation_revision bigint := coalesce(nullif(p_outcome->>'expectedConversationRevision', '')::bigint, 0);
  v_dietitian_item_count integer := 0;
  v_item record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'idempotency_key_required';
  end if;

  if p_outcome is null or p_response_json is null then
    raise exception 'bundle_decision_payload_invalid';
  end if;

  perform p85_stage_4b3_validate_bundle_decision_outcome_v2(p_outcome);

  select *
    into v_cached
  from bundle_decision_idempotency
  where tenant_id = p_tenant_id
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_cached.decision_id <> v_decision_id then
      raise exception 'idempotency_key_conflict';
    end if;
    return coalesce(v_cached.response_json, p_response_json);
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

  if v_bundle.bundle_revision <> v_expected_bundle_revision then
    raise exception 'stale_bundle_revision';
  end if;

  select coalesce(c.revision, 1)
    into v_conversation_revision
  from conversations c
  where c.tenant_id = p_tenant_id
    and c.id = v_bundle.conversation_id
  for update;

  if v_conversation_revision <> v_expected_conversation_revision then
    raise exception 'stale_conversation_revision';
  end if;

  select *
    into v_client
  from clients
  where tenant_id = p_tenant_id
    and id = v_bundle.client_id
  for update;

  if v_bundle.decision_id is not null and v_bundle.decision_id <> v_decision_id then
    raise exception 'bundle_decision_already_committed';
  end if;

  if v_bundle.status not in ('processing', 'ready') then
    raise exception 'bundle_not_processable';
  end if;

  select count(*)::integer
    into v_dietitian_item_count
  from inbound_message_bundle_items bi
  where bi.tenant_id = p_tenant_id
    and bi.bundle_id = v_bundle.id
    and bi.actor_type = 'dietitian';

  if v_dietitian_item_count > 0 then
    raise exception 'bundle_human_handled';
  end if;

  if p_outcome ? 'aiDecision' then
    insert into ai_decisions (
      id, tenant_id, conversation_id, client_id, mode, ai_status, persona_id,
      risk, model, action, blocked_reason, quality_issues, reasons,
      provider_status, provider_attempted, provider_id, provider_error_code,
      send_status, prompt_version, context_manifest, created_at
    )
    select
      (p_outcome #>> '{aiDecision,id}')::uuid,
      p_tenant_id,
      (p_outcome #>> '{aiDecision,conversationId}')::uuid,
      (p_outcome #>> '{aiDecision,clientId}')::uuid,
      (p_outcome #>> '{aiDecision,mode}')::client_ai_mode,
      (p_outcome #>> '{aiDecision,aiStatus}')::client_ai_status,
      p_outcome #>> '{aiDecision,personaId}',
      (p_outcome #>> '{aiDecision,risk}')::risk_level,
      nullif(p_outcome #>> '{aiDecision,model}', ''),
      p_outcome #>> '{aiDecision,action}',
      nullif(p_outcome #>> '{aiDecision,blockedReason}', ''),
      coalesce(
        (select array_agg(value::text)
         from jsonb_array_elements_text(coalesce(p_outcome #> '{aiDecision,qualityIssues}', '[]'::jsonb)) value),
        '{}'::text[]
      ),
      coalesce(
        (select array_agg(value::text)
         from jsonb_array_elements_text(coalesce(p_outcome #> '{aiDecision,reasons}', '[]'::jsonb)) value),
        '{}'::text[]
      ),
      coalesce(p_outcome #>> '{aiDecision,providerStatus}', 'not_called'),
      coalesce((p_outcome #>> '{aiDecision,providerAttempted}')::boolean, false),
      nullif(p_outcome #>> '{aiDecision,providerId}', ''),
      nullif(p_outcome #>> '{aiDecision,providerErrorCode}', ''),
      coalesce(p_outcome #>> '{aiDecision,sendStatus}', 'not_sent'),
      nullif(p_outcome #>> '{aiDecision,promptVersion}', ''),
      coalesce(p_outcome #> '{aiDecision,contextManifest}', '{}'::jsonb),
      coalesce(nullif(p_outcome #>> '{aiDecision,createdAt}', '')::timestamptz, now())
    on conflict (id) do nothing;
  end if;

  if jsonb_array_length(coalesce(p_outcome->'messages', '[]'::jsonb)) > 0 then
    perform p85_if_r1_upsert_messages(
      p_tenant_id,
      jsonb_build_object('messages', p_outcome->'messages'),
      false
    );
  end if;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_outcome->'handoffCases', '[]'::jsonb)) as value
  loop
    insert into handoff_cases (
      id, tenant_id, dietitian_id, client_id, conversation_id, triggering_message_id,
      risk, reasons, status, urgency, safe_acknowledgement, recommended_action, created_at
    ) values (
      (v_item.value->>'id')::uuid,
      p_tenant_id,
      (v_item.value->>'dietitianId')::uuid,
      (v_item.value->>'clientId')::uuid,
      (v_item.value->>'conversationId')::uuid,
      nullif(v_item.value->>'triggeringMessageId', '')::uuid,
      (v_item.value->>'risk')::risk_level,
      coalesce(
        (select array_agg(entry::text)
         from jsonb_array_elements_text(coalesce(v_item.value->'reasons', '[]'::jsonb)) entry),
        '{}'::text[]
      ),
      coalesce(v_item.value->>'status', 'open'),
      coalesce(v_item.value->>'urgency', 'normal'),
      coalesce(v_item.value->>'safeAcknowledgement', ''),
      coalesce(v_item.value->>'recommendedAction', ''),
      coalesce(nullif(v_item.value->>'createdAt', '')::timestamptz, now())
    ) on conflict (id) do nothing;
  end loop;

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
      coalesce(v_item.value->>'kind', 'legacy_system'),
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

  if p_outcome ? 'clientUpdate' then
    update clients
    set ai_status = coalesce(nullif(p_outcome #>> '{clientUpdate,aiStatus}', '')::client_ai_status, ai_status),
        ai_mode = coalesce(nullif(p_outcome #>> '{clientUpdate,aiMode}', '')::client_ai_mode, ai_mode),
        human_takeover_locked = coalesce((p_outcome #>> '{clientUpdate,humanTakeoverLocked}')::boolean, human_takeover_locked),
        context_revision = coalesce(nullif(p_outcome #>> '{clientUpdate,contextRevision}', '')::bigint, context_revision),
        updated_at = now()
    where tenant_id = p_tenant_id
      and id = v_bundle.client_id;
  end if;

  if p_outcome ? 'conversationRevision' then
    update conversations
    set revision = greatest(coalesce(revision, 1), coalesce(nullif(p_outcome->>'conversationRevision', '')::bigint, coalesce(revision, 1))),
        updated_at = now()
    where tenant_id = p_tenant_id
      and id = v_bundle.conversation_id;
  end if;

  update inbound_message_bundles
  set status = 'decided',
      decision_id = v_decision_id,
      lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = v_bundle_id;

  insert into bundle_decision_idempotency (
    tenant_id,
    idempotency_key,
    bundle_id,
    bundle_revision,
    decision_id,
    conversation_revision,
    response_json
  ) values (
    p_tenant_id,
    p_idempotency_key,
    v_bundle_id,
    v_expected_bundle_revision,
    v_decision_id,
    v_expected_conversation_revision,
    p_response_json
  );

  return p_response_json;
end;
$$;

create or replace function p85_stage_4b3_commit_visual_correction_v2(
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
  v_cached visual_correction_idempotency%rowtype;
  v_analysis visual_analysis_records%rowtype;
  v_conversation_revision bigint;
  v_bundle inbound_message_bundles%rowtype;
  v_item record;
  v_result_action text := coalesce(p_outcome->>'resultAction', '');
  v_analysis_id uuid := nullif(p_outcome->>'analysisId', '')::uuid;
  v_correction_id uuid := nullif(p_outcome->>'correctionId', '')::uuid;
  v_expected_conversation_revision bigint := coalesce(nullif(p_outcome->>'expectedConversationRevision', '')::bigint, 0);
  v_expected_analysis_revision bigint := coalesce(nullif(p_outcome->>'expectedAnalysisRevision', '')::bigint, 0);
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'idempotency_key_required';
  end if;

  if coalesce(p_outcome->>'version', '') <> 'p85-stage-4b3-visual-correction-outcome-v2' then
    raise exception 'visual_correction_outcome_version_invalid';
  end if;

  if v_result_action not in ('supersede_rerun', 'invalidate_pending', 'manual_follow_up', 'closed_without_send') then
    raise exception 'visual_correction_result_action_invalid';
  end if;

  select *
    into v_cached
  from visual_correction_idempotency
  where tenant_id = p_tenant_id
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_cached.correction_id <> v_correction_id then
      raise exception 'idempotency_key_conflict';
    end if;
    return coalesce(v_cached.response_json, p_response_json);
  end if;

  select *
    into v_analysis
  from visual_analysis_records
  where tenant_id = p_tenant_id
    and id = v_analysis_id
  for update;

  if not found then
    raise exception 'analysis_not_found';
  end if;

  if v_analysis.analysis_revision <> v_expected_analysis_revision then
    raise exception 'stale_analysis_revision';
  end if;

  select coalesce(c.revision, 1)
    into v_conversation_revision
  from conversations c
  where c.tenant_id = p_tenant_id
    and c.id = v_analysis.conversation_id
  for update;

  if v_conversation_revision <> v_expected_conversation_revision then
    raise exception 'stale_conversation_revision';
  end if;

  if v_analysis.bundle_id is not null then
    select *
      into v_bundle
    from inbound_message_bundles
    where tenant_id = p_tenant_id
      and id = v_analysis.bundle_id
    for update;
  end if;

  if v_result_action = 'manual_follow_up' then
    if coalesce(jsonb_array_length(p_outcome->'outboundMessages'), 0) > 0 then
      raise exception 'sent_correction_auto_message_forbidden';
    end if;
  end if;

  update visual_analysis_records
  set status = 'superseded',
      superseded_by_analysis_id = nullif(p_outcome->>'correctedAnalysisId', '')::uuid,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = v_analysis_id;

  if p_outcome ? 'correctedAnalysis' then
    insert into visual_analysis_records (
      id, tenant_id, client_id, conversation_id, media_asset_id, message_id, bundle_id,
      analysis_revision, status, observation, superseded_by_analysis_id, failure_code,
      created_at, updated_at
    )
    select
      (p_outcome #>> '{correctedAnalysis,id}')::uuid,
      p_tenant_id,
      (p_outcome #>> '{correctedAnalysis,clientId}')::uuid,
      (p_outcome #>> '{correctedAnalysis,conversationId}')::uuid,
      (p_outcome #>> '{correctedAnalysis,mediaAssetId}')::uuid,
      (p_outcome #>> '{correctedAnalysis,messageId}')::uuid,
      nullif(p_outcome #>> '{correctedAnalysis,bundleId}', '')::uuid,
      coalesce(nullif(p_outcome #>> '{correctedAnalysis,analysisRevision}', '')::integer, v_expected_analysis_revision + 1),
      coalesce(p_outcome #>> '{correctedAnalysis,status}', 'ready'),
      p_outcome #> '{correctedAnalysis,observation}',
      null,
      nullif(p_outcome #>> '{correctedAnalysis,failureCode}', ''),
      coalesce(nullif(p_outcome #>> '{correctedAnalysis,createdAt}', '')::timestamptz, now()),
      coalesce(nullif(p_outcome #>> '{correctedAnalysis,updatedAt}', '')::timestamptz, now())
    on conflict (id) do nothing;
  end if;

  if p_outcome ? 'correction' then
    insert into visual_corrections (
      id, tenant_id, client_id, conversation_id, analysis_id, dietitian_id,
      status, reason_code, explanation, corrected_scene_type, corrected_ocr_text,
      corrected_entity_labels, conversation_revision_at_submit, analysis_revision_at_submit,
      result_action, created_at, updated_at
    ) values (
      v_correction_id,
      p_tenant_id,
      (p_outcome #>> '{correction,clientId}')::uuid,
      (p_outcome #>> '{correction,conversationId}')::uuid,
      v_analysis_id,
      (p_outcome #>> '{correction,dietitianId}')::uuid,
      coalesce(p_outcome #>> '{correction,status}', 'submitted'),
      p_outcome #>> '{correction,reasonCode}',
      p_outcome #>> '{correction,explanation}',
      nullif(p_outcome #>> '{correction,correctedSceneType}', ''),
      nullif(p_outcome #>> '{correction,correctedOcrText}', ''),
      coalesce(
        (select array_agg(value::text)
         from jsonb_array_elements_text(coalesce(p_outcome #> '{correction,correctedEntityLabels}', '[]'::jsonb)) value),
        '{}'::text[]
      ),
      v_expected_conversation_revision,
      v_expected_analysis_revision,
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
      coalesce(v_item.value->>'kind', 'visual_correction_follow_up'),
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

  insert into visual_correction_idempotency (
    tenant_id,
    idempotency_key,
    correction_id,
    analysis_id,
    conversation_revision,
    response_json
  ) values (
    p_tenant_id,
    p_idempotency_key,
    v_correction_id,
    v_analysis_id,
    v_expected_conversation_revision,
    p_response_json
  );

  return p_response_json;
end;
$$;

revoke all on function p85_stage_4b3_validate_bundle_decision_outcome_v2(jsonb) from public, anon, authenticated;
revoke all on function p85_stage_4b3_commit_bundle_decision_v2(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function p85_stage_4b3_commit_visual_correction_v2(uuid, text, jsonb, jsonb) from public, anon, authenticated;

grant execute on function p85_stage_4b3_validate_bundle_decision_outcome_v2(jsonb) to service_role;
grant execute on function p85_stage_4b3_commit_bundle_decision_v2(uuid, text, jsonb, jsonb) to service_role;
grant execute on function p85_stage_4b3_commit_visual_correction_v2(uuid, text, jsonb, jsonb) to service_role;
