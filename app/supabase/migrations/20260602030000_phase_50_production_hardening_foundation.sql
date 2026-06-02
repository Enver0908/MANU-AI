-- Phase 50 foundation: distributed rate limiting and transactional commit RPCs.
-- App integration is intentionally left to the next phase.

create table if not exists rate_limit_buckets (
  tenant_id uuid not null references tenants(id) on delete cascade,
  scope text not null,
  key_hash text not null,
  window_start timestamptz not null,
  reset_at timestamptz not null,
  count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, scope, key_hash),
  constraint rate_limit_buckets_scope_check check (
    scope in ('simulator', 'channel_inbound', 'manual_reply', 'draft_review', 'internal_copilot')
  ),
  constraint rate_limit_buckets_key_hash_check check (length(key_hash) >= 32),
  constraint rate_limit_buckets_count_check check (count >= 0)
);

create index if not exists rate_limit_buckets_reset_idx
  on rate_limit_buckets (reset_at);

alter table rate_limit_buckets enable row level security;

alter table messages
  drop constraint if exists messages_generated_by_ai_decision_fk;

alter table messages
  add constraint messages_generated_by_ai_decision_fk
  foreign key (generated_by_ai_decision_id)
  references ai_decisions(id)
  deferrable initially deferred;

drop policy if exists "service role only rate limit buckets" on rate_limit_buckets;

create or replace function consume_rate_limit(
  p_tenant_id uuid,
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket rate_limit_buckets%rowtype;
  window_interval interval;
begin
  if p_scope not in ('simulator', 'channel_inbound', 'manual_reply', 'draft_review', 'internal_copilot') then
    raise exception 'rate_limit_scope_invalid';
  end if;
  if p_key_hash is null or length(p_key_hash) < 32 then
    raise exception 'rate_limit_key_hash_invalid';
  end if;
  if p_limit <= 0 or p_window_seconds <= 0 then
    raise exception 'rate_limit_config_invalid';
  end if;

  window_interval := make_interval(secs => p_window_seconds);

  insert into rate_limit_buckets as buckets (
    tenant_id,
    scope,
    key_hash,
    window_start,
    reset_at,
    count,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    p_scope,
    p_key_hash,
    p_now,
    p_now + window_interval,
    1,
    p_now,
    p_now
  )
  on conflict (tenant_id, scope, key_hash)
  do update set
    window_start = case
      when buckets.reset_at <= p_now then p_now
      else buckets.window_start
    end,
    reset_at = case
      when buckets.reset_at <= p_now then p_now + window_interval
      else buckets.reset_at
    end,
    count = case
      when buckets.reset_at <= p_now then 1
      else buckets.count + 1
    end,
    updated_at = p_now
  returning * into bucket;

  return jsonb_build_object(
    'allowed', bucket.count <= p_limit,
    'scope', bucket.scope,
    'count', bucket.count,
    'limit', p_limit,
    'resetAt', bucket.reset_at
  );
end;
$$;

create or replace function manu_text_array_from_jsonb(value jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(item), '{}')
  from jsonb_array_elements_text(coalesce(value, '[]'::jsonb)) as item
$$;

create or replace function manu_lock_expected_client_revisions(
  p_tenant_id uuid,
  p_expected_client_revisions jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  revision_record record;
  current_revision integer;
begin
  for revision_record in
    select key::uuid as client_id, value::integer as expected_revision
    from jsonb_each_text(coalesce(p_expected_client_revisions, '{}'::jsonb))
  loop
    select context_revision
      into current_revision
    from clients
    where tenant_id = p_tenant_id
      and id = revision_record.client_id
    for update;

    if current_revision is null then
      raise exception 'client_not_found';
    end if;

    if current_revision <> revision_record.expected_revision then
      raise exception 'concurrent_state_update';
    end if;
  end loop;
end;
$$;

create or replace function manu_commit_state_delta(
  p_operation text,
  p_tenant_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  affected_rows integer;
begin
  perform manu_lock_expected_client_revisions(p_tenant_id, p_payload->'expectedClientRevisions');

  for item in select * from jsonb_array_elements(coalesce(p_payload->'clients', '[]'::jsonb)) loop
    update clients set
      dietitian_id = coalesce((item->>'dietitianId')::uuid, dietitian_id),
      lifecycle_status = coalesce(item->>'lifecycleStatus', lifecycle_status),
      removed_at = case
        when item ? 'removedAt' then nullif(item->>'removedAt', '')::timestamptz
        else removed_at
      end,
      full_name = coalesce(item->>'fullName', full_name),
      primary_phone_e164 = case
        when item ? 'primaryPhoneE164' then nullif(item->>'primaryPhoneE164', '')
        else primary_phone_e164
      end,
      communication_language = coalesce(item->>'communicationLanguage', communication_language),
      selected_persona_id = coalesce(item->>'selectedPersonaId', selected_persona_id),
      ai_status = coalesce((item->>'aiStatus')::client_ai_status, ai_status),
      ai_mode = coalesce((item->>'aiMode')::client_ai_mode, ai_mode),
      ai_active_from = case
        when item ? 'aiActiveFrom' then nullif(item->>'aiActiveFrom', '')::timestamptz
        else ai_active_from
      end,
      ai_active_until = case
        when item ? 'aiActiveUntil' then nullif(item->>'aiActiveUntil', '')::timestamptz
        else ai_active_until
      end,
      channel_permission = coalesce((item->>'channelPermission')::permission_state, channel_permission),
      mandatory_safety_complete = coalesce((item->>'mandatorySafetyComplete')::boolean, mandatory_safety_complete),
      human_takeover_locked = coalesce((item->>'humanTakeoverLocked')::boolean, human_takeover_locked),
      red_risk_lock = coalesce(item->'redRiskLock', red_risk_lock),
      context_revision = coalesce((item->>'contextRevision')::integer, context_revision),
      safety_checklist = coalesce(item->'safetyChecklist', safety_checklist),
      health_profile = coalesce(item->'healthProfile', health_profile),
      diet_plan = coalesce(item->'dietPlan', diet_plan),
      allergies = case
        when item ? 'allergies' then manu_text_array_from_jsonb(item->'allergies')
        else allergies
      end,
      restricted_foods = case
        when item ? 'restrictedFoods' then manu_text_array_from_jsonb(item->'restrictedFoods')
        else restricted_foods
      end,
      clinical_risk_notes = case
        when item ? 'clinicalRiskNotes' then manu_text_array_from_jsonb(item->'clinicalRiskNotes')
        else clinical_risk_notes
      end,
      pinned_notes = case
        when item ? 'pinnedNotes' then manu_text_array_from_jsonb(item->'pinnedNotes')
        else pinned_notes
      end
    where tenant_id = p_tenant_id
      and id = (item->>'id')::uuid;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'client_not_found';
    end if;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'messages', '[]'::jsonb)) loop
    insert into messages (
      id,
      tenant_id,
      conversation_id,
      sender,
      body,
      origin,
      author_dietitian_id,
      generated_by_ai_decision_id,
      approved_by_dietitian_id,
      source_message_id,
      risk,
      status,
      created_at
    )
    values (
      (item->>'id')::uuid,
      p_tenant_id,
      (item->>'conversationId')::uuid,
      (item->>'sender')::sender_type,
      item->>'body',
      (item->>'origin')::message_origin,
      nullif(item->>'authorDietitianId', '')::uuid,
      nullif(item->>'generatedByAiDecisionId', '')::uuid,
      nullif(item->>'approvedByDietitianId', '')::uuid,
      nullif(item->>'sourceMessageId', '')::uuid,
      nullif(item->>'risk', '')::risk_level,
      coalesce(item->>'status', 'stored')::message_status,
      coalesce(nullif(item->>'createdAt', '')::timestamptz, now())
    );
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'aiDecisions', '[]'::jsonb)) loop
    insert into ai_decisions (
      id,
      tenant_id,
      conversation_id,
      client_id,
      mode,
      ai_status,
      persona_id,
      risk,
      model,
      prompt_version,
      provider_attempted,
      provider_id,
      provider_status,
      provider_error_code,
      send_status,
      context_manifest,
      provider_output_safety,
      token_budget,
      action,
      blocked_reason,
      quality_issues,
      reasons,
      created_at
    )
    values (
      (item->>'id')::uuid,
      p_tenant_id,
      (item->>'conversationId')::uuid,
      (item->>'clientId')::uuid,
      (item->>'mode')::client_ai_mode,
      (item->>'aiStatus')::client_ai_status,
      item->>'personaId',
      (item->>'risk')::risk_level,
      nullif(item->>'model', ''),
      nullif(item->>'promptVersion', ''),
      coalesce((item->>'providerAttempted')::boolean, false),
      nullif(item->>'providerId', ''),
      coalesce(item->>'providerStatus', 'not_called'),
      nullif(item->>'providerErrorCode', ''),
      coalesce(item->>'sendStatus', 'not_called'),
      item->'contextManifest',
      item->'providerOutputSafety',
      item->'tokenBudget',
      item->>'action',
      nullif(item->>'blockedReason', ''),
      manu_text_array_from_jsonb(item->'qualityIssues'),
      manu_text_array_from_jsonb(item->'reasons'),
      coalesce(nullif(item->>'createdAt', '')::timestamptz, now())
    );
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'riskAssessments', '[]'::jsonb)) loop
    insert into risk_assessments (id, tenant_id, conversation_id, message_id, level, reasons, classifier_version, created_at)
    values (
      (item->>'id')::uuid,
      p_tenant_id,
      (item->>'conversationId')::uuid,
      (item->>'messageId')::uuid,
      (item->>'level')::risk_level,
      manu_text_array_from_jsonb(item->'reasons'),
      item->>'classifierVersion',
      coalesce(nullif(item->>'createdAt', '')::timestamptz, now())
    );
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'handoffCases', '[]'::jsonb)) loop
    insert into handoff_cases (
      id,
      tenant_id,
      dietitian_id,
      client_id,
      conversation_id,
      triggering_message_id,
      risk,
      reasons,
      status,
      urgency,
      safe_acknowledgement,
      recommended_action,
      created_at,
      resolved_at
    )
    values (
      (item->>'id')::uuid,
      p_tenant_id,
      (item->>'dietitianId')::uuid,
      (item->>'clientId')::uuid,
      (item->>'conversationId')::uuid,
      nullif(item->>'triggeringMessageId', '')::uuid,
      (item->>'risk')::risk_level,
      manu_text_array_from_jsonb(item->'reasons'),
      coalesce(item->>'status', 'open')::case_status,
      coalesce(item->>'urgency', 'normal'),
      item->>'safeAcknowledgement',
      item->>'recommendedAction',
      coalesce(nullif(item->>'createdAt', '')::timestamptz, now()),
      nullif(item->>'resolvedAt', '')::timestamptz
    );
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'clientAiStatusEvents', '[]'::jsonb)) loop
    insert into client_ai_status_events (
      id,
      tenant_id,
      client_id,
      dietitian_id,
      previous_status,
      new_status,
      ai_mode,
      active_from,
      active_until,
      reason,
      created_at
    )
    values (
      (item->>'id')::uuid,
      p_tenant_id,
      (item->>'clientId')::uuid,
      (item->>'dietitianId')::uuid,
      nullif(item->>'previousStatus', '')::client_ai_status,
      (item->>'newStatus')::client_ai_status,
      nullif(item->>'aiMode', '')::client_ai_mode,
      nullif(item->>'activeFrom', '')::timestamptz,
      nullif(item->>'activeUntil', '')::timestamptz,
      item->>'reason',
      coalesce(nullif(item->>'createdAt', '')::timestamptz, now())
    );
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'notifications', '[]'::jsonb)) loop
    insert into notifications (id, tenant_id, type, entity_type, entity_id, title, body, read, acknowledged_at, created_at)
    values (
      (item->>'id')::uuid,
      p_tenant_id,
      item->>'type',
      item->>'entityType',
      item->>'entityId',
      item->>'title',
      item->>'body',
      coalesce((item->>'read')::boolean, false),
      nullif(item->>'acknowledgedAt', '')::timestamptz,
      coalesce(nullif(item->>'createdAt', '')::timestamptz, now())
    );
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'auditEvents', '[]'::jsonb)) loop
    insert into audit_events (id, tenant_id, actor_type, actor_id, event_type, entity_type, entity_id, metadata, created_at)
    values (
      (item->>'id')::uuid,
      p_tenant_id,
      coalesce(item->>'actorType', 'system'),
      nullif(item->>'actorId', ''),
      item->>'eventType',
      item->>'entityType',
      item->>'entityId',
      coalesce(item->'metadata', '{}'::jsonb),
      coalesce(nullif(item->>'createdAt', '')::timestamptz, now())
    );
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'processedEvents', '[]'::jsonb)) loop
    insert into processed_inbound_events (tenant_id, channel, provider_event_id, received_at)
    values (
      p_tenant_id,
      (item->>'channel')::client_channel,
      item->>'providerEventId',
      coalesce(nullif(item->>'receivedAt', '')::timestamptz, now())
    );
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'inboundQuarantines', '[]'::jsonb)) loop
    insert into inbound_quarantines (
      id,
      tenant_id,
      channel,
      source_conversation_type,
      source_conversation_id,
      source_message_id,
      sender_channel_user_id,
      reason,
      created_at
    )
    values (
      (item->>'id')::uuid,
      p_tenant_id,
      item->>'channel',
      item->>'sourceConversationType',
      nullif(item->>'sourceConversationId', ''),
      nullif(item->>'sourceMessageId', ''),
      nullif(item->>'senderChannelUserId', ''),
      item->>'reason',
      coalesce(nullif(item->>'createdAt', '')::timestamptz, now())
    );
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'clientContextUpdates', '[]'::jsonb)) loop
    insert into client_context_updates (
      id,
      tenant_id,
      client_id,
      dietitian_id,
      source,
      occurred_at,
      title,
      summary,
      details,
      importance,
      status,
      supersedes_update_id,
      created_at
    )
    values (
      (item->>'id')::uuid,
      p_tenant_id,
      (item->>'clientId')::uuid,
      (item->>'dietitianId')::uuid,
      item->>'source',
      (item->>'occurredAt')::timestamptz,
      item->>'title',
      item->>'summary',
      coalesce(item->>'details', ''),
      item->>'importance',
      coalesce(item->>'status', 'active'),
      nullif(item->>'supersedesUpdateId', '')::uuid,
      coalesce(nullif(item->>'createdAt', '')::timestamptz, now())
    );
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'formResponses', '[]'::jsonb)) loop
    insert into client_form_responses (
      id,
      tenant_id,
      client_id,
      schema_id,
      schema_version,
      schema_snapshot,
      language_code,
      submitted_phone_e164,
      answers,
      created_at,
      updated_at
    )
    values (
      (item->>'id')::uuid,
      p_tenant_id,
      (item->>'clientId')::uuid,
      (item->>'schemaId')::uuid,
      (item->>'schemaVersion')::integer,
      item->'schemaSnapshot',
      coalesce(nullif(item->>'languageCode', ''), 'tr'),
      nullif(item->>'submittedPhoneE164', ''),
      coalesce(item->'answers', '{}'::jsonb),
      coalesce(nullif(item->>'createdAt', '')::timestamptz, now()),
      coalesce(nullif(item->>'updatedAt', '')::timestamptz, now())
    )
    on conflict (id) do update set
      schema_version = excluded.schema_version,
      schema_snapshot = excluded.schema_snapshot,
      language_code = excluded.language_code,
      submitted_phone_e164 = excluded.submitted_phone_e164,
      answers = excluded.answers,
      updated_at = excluded.updated_at;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'messageUpdates', '[]'::jsonb)) loop
    update messages set
      body = coalesce(item->>'body', body),
      status = coalesce((item->>'status')::message_status, status),
      approved_by_dietitian_id = case
        when item ? 'approvedByDietitianId' then nullif(item->>'approvedByDietitianId', '')::uuid
        else approved_by_dietitian_id
      end,
      generated_by_ai_decision_id = case
        when item ? 'generatedByAiDecisionId' then nullif(item->>'generatedByAiDecisionId', '')::uuid
        else generated_by_ai_decision_id
      end,
      source_message_id = case
        when item ? 'sourceMessageId' then nullif(item->>'sourceMessageId', '')::uuid
        else source_message_id
      end
    where tenant_id = p_tenant_id
      and id = (item->>'id')::uuid;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'message_not_found';
    end if;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'aiDecisionUpdates', '[]'::jsonb)) loop
    update ai_decisions set
      provider_attempted = coalesce((item->>'providerAttempted')::boolean, provider_attempted),
      provider_status = coalesce(item->>'providerStatus', provider_status),
      provider_error_code = case
        when item ? 'providerErrorCode' then nullif(item->>'providerErrorCode', '')
        else provider_error_code
      end,
      send_status = coalesce(item->>'sendStatus', send_status),
      action = coalesce(item->>'action', action),
      blocked_reason = case
        when item ? 'blockedReason' then nullif(item->>'blockedReason', '')
        else blocked_reason
      end,
      quality_issues = case
        when item ? 'qualityIssues' then manu_text_array_from_jsonb(item->'qualityIssues')
        else quality_issues
      end,
      reasons = case
        when item ? 'reasons' then manu_text_array_from_jsonb(item->'reasons')
        else reasons
      end
    where tenant_id = p_tenant_id
      and id = (item->>'id')::uuid;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'ai_decision_not_found';
    end if;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'handoffUpdates', '[]'::jsonb)) loop
    update handoff_cases set
      status = coalesce((item->>'status')::case_status, status),
      resolved_at = case
        when item ? 'resolvedAt' then nullif(item->>'resolvedAt', '')::timestamptz
        else resolved_at
      end
    where tenant_id = p_tenant_id
      and id = (item->>'id')::uuid;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'handoff_not_found';
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'operation', p_operation);
end;
$$;

create or replace function commit_inbound_simulation(p_tenant_id uuid, p_payload jsonb)
returns jsonb language sql security definer set search_path = public
as $$ select manu_commit_state_delta('inbound_simulation', p_tenant_id, p_payload) $$;

create or replace function commit_manual_reply(p_tenant_id uuid, p_payload jsonb)
returns jsonb language sql security definer set search_path = public
as $$ select manu_commit_state_delta('manual_reply', p_tenant_id, p_payload) $$;

create or replace function commit_draft_review(p_tenant_id uuid, p_payload jsonb)
returns jsonb language sql security definer set search_path = public
as $$ select manu_commit_state_delta('draft_review', p_tenant_id, p_payload) $$;

create or replace function commit_handoff_status(p_tenant_id uuid, p_payload jsonb)
returns jsonb language sql security definer set search_path = public
as $$ select manu_commit_state_delta('handoff_status', p_tenant_id, p_payload) $$;

create or replace function commit_client_context_update(p_tenant_id uuid, p_payload jsonb)
returns jsonb language sql security definer set search_path = public
as $$ select manu_commit_state_delta('client_context_update', p_tenant_id, p_payload) $$;

create or replace function commit_form_response(p_tenant_id uuid, p_payload jsonb)
returns jsonb language sql security definer set search_path = public
as $$ select manu_commit_state_delta('form_response', p_tenant_id, p_payload) $$;

create or replace function commit_red_risk_reactivation(p_tenant_id uuid, p_payload jsonb)
returns jsonb language sql security definer set search_path = public
as $$ select manu_commit_state_delta('red_risk_reactivation', p_tenant_id, p_payload) $$;

create or replace function commit_client_removal_lifecycle(p_tenant_id uuid, p_payload jsonb)
returns jsonb language sql security definer set search_path = public
as $$ select manu_commit_state_delta('client_removal_lifecycle', p_tenant_id, p_payload) $$;

revoke all on function consume_rate_limit(uuid, text, text, integer, integer, timestamptz) from public, anon, authenticated;
revoke all on function manu_text_array_from_jsonb(jsonb) from public, anon, authenticated;
revoke all on function manu_lock_expected_client_revisions(uuid, jsonb) from public, anon, authenticated;
revoke all on function manu_commit_state_delta(text, uuid, jsonb) from public, anon, authenticated;
revoke all on function commit_inbound_simulation(uuid, jsonb) from public, anon, authenticated;
revoke all on function commit_manual_reply(uuid, jsonb) from public, anon, authenticated;
revoke all on function commit_draft_review(uuid, jsonb) from public, anon, authenticated;
revoke all on function commit_handoff_status(uuid, jsonb) from public, anon, authenticated;
revoke all on function commit_client_context_update(uuid, jsonb) from public, anon, authenticated;
revoke all on function commit_form_response(uuid, jsonb) from public, anon, authenticated;
revoke all on function commit_red_risk_reactivation(uuid, jsonb) from public, anon, authenticated;
revoke all on function commit_client_removal_lifecycle(uuid, jsonb) from public, anon, authenticated;

grant execute on function consume_rate_limit(uuid, text, text, integer, integer, timestamptz) to service_role;
grant execute on function manu_commit_state_delta(text, uuid, jsonb) to service_role;
grant execute on function commit_inbound_simulation(uuid, jsonb) to service_role;
grant execute on function commit_manual_reply(uuid, jsonb) to service_role;
grant execute on function commit_draft_review(uuid, jsonb) to service_role;
grant execute on function commit_handoff_status(uuid, jsonb) to service_role;
grant execute on function commit_client_context_update(uuid, jsonb) to service_role;
grant execute on function commit_form_response(uuid, jsonb) to service_role;
grant execute on function commit_red_risk_reactivation(uuid, jsonb) to service_role;
grant execute on function commit_client_removal_lifecycle(uuid, jsonb) to service_role;
