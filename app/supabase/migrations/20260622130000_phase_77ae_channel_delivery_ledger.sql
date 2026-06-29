-- Phase 77AE: outbound channel delivery ledger and mock send failure RPC coverage.

create table if not exists channel_deliveries (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  message_id uuid not null references messages(id) on delete cascade,
  channel text not null,
  direction text not null,
  mock_provider_message_id text not null,
  delivery_status text not null,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint channel_deliveries_channel_check check (channel in ('whatsapp', 'telegram')),
  constraint channel_deliveries_direction_check check (direction in ('outbound')),
  constraint channel_deliveries_status_check check (delivery_status in ('sent', 'delivered', 'failed'))
);

create index if not exists channel_deliveries_tenant_client_created_idx
  on channel_deliveries (tenant_id, client_id, created_at desc);

create index if not exists channel_deliveries_tenant_message_idx
  on channel_deliveries (tenant_id, message_id);

alter table channel_deliveries enable row level security;

drop policy if exists "tenant scoped crud channel deliveries" on channel_deliveries;

create policy "tenant scoped crud channel deliveries"
on channel_deliveries for all
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]))
with check (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));

create table if not exists channel_adapter_rollback_controls (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  global_channel_automation_disabled boolean not null default false,
  tenant_channel_automation_disabled boolean not null default false,
  disabled_dietitian_ids uuid[] not null default '{}',
  disabled_client_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table channel_adapter_rollback_controls enable row level security;

drop policy if exists "tenant scoped read channel adapter rollback controls" on channel_adapter_rollback_controls;
drop policy if exists "tenant scoped write channel adapter rollback controls" on channel_adapter_rollback_controls;

create policy "tenant scoped read channel adapter rollback controls"
on channel_adapter_rollback_controls for select
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));

create policy "tenant scoped write channel adapter rollback controls"
on channel_adapter_rollback_controls for all
using (has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[]))
with check (has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[]));

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
      yellow_risk_hold = coalesce(item->'yellowRiskHold', yellow_risk_hold),
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


  for item in select * from jsonb_array_elements(coalesce(p_payload->'channelDeliveries', '[]'::jsonb)) loop
    insert into channel_deliveries (
      id,
      tenant_id,
      client_id,
      conversation_id,
      message_id,
      channel,
      direction,
      mock_provider_message_id,
      delivery_status,
      failure_code,
      created_at,
      updated_at
    )
    values (
      (item->>'id')::uuid,
      p_tenant_id,
      (item->>'clientId')::uuid,
      (item->>'conversationId')::uuid,
      (item->>'messageId')::uuid,
      item->>'channel',
      item->>'direction',
      item->>'mockProviderMessageId',
      item->>'deliveryStatus',
      nullif(item->>'failureCode', ''),
      coalesce(nullif(item->>'createdAt', '')::timestamptz, now()),
      coalesce(nullif(item->>'updatedAt', '')::timestamptz, now())
    );
  end loop;

  if p_payload ? 'channelAdapterRollbackControls'
    and p_payload->'channelAdapterRollbackControls' <> 'null'::jsonb then
    item := p_payload->'channelAdapterRollbackControls';

    insert into channel_adapter_rollback_controls (
      tenant_id,
      global_channel_automation_disabled,
      tenant_channel_automation_disabled,
      disabled_dietitian_ids,
      disabled_client_ids,
      updated_at
    )
    values (
      p_tenant_id,
      coalesce((item->>'globalChannelAutomationDisabled')::boolean, false),
      coalesce((item->>'tenantChannelAutomationDisabled')::boolean, false),
      coalesce(
        ARRAY(select value::uuid from jsonb_array_elements_text(coalesce(item->'disabledDietitianIds', '[]'::jsonb)) as value),
        '{}'
      ),
      coalesce(
        ARRAY(select value::uuid from jsonb_array_elements_text(coalesce(item->'disabledClientIds', '[]'::jsonb)) as value),
        '{}'
      ),
      now()
    )
    on conflict (tenant_id) do update set
      global_channel_automation_disabled = excluded.global_channel_automation_disabled,
      tenant_channel_automation_disabled = excluded.tenant_channel_automation_disabled,
      disabled_dietitian_ids = excluded.disabled_dietitian_ids,
      disabled_client_ids = excluded.disabled_client_ids,
      updated_at = excluded.updated_at;
  end if;

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
      model = case
        when item ? 'model' then nullif(item->>'model', '')
        else model
      end,
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
      end,
      reasons = case
        when item ? 'reasons' then manu_text_array_from_jsonb(item->'reasons')
        else reasons
      end,
      safe_acknowledgement = coalesce(item->>'safeAcknowledgement', safe_acknowledgement),
      recommended_action = coalesce(item->>'recommendedAction', recommended_action)
    where tenant_id = p_tenant_id
      and id = (item->>'id')::uuid;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'handoff_not_found';
    end if;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'clientContextUpdateUpdates', '[]'::jsonb)) loop
    update client_context_updates set
      title = coalesce(item->>'title', title),
      summary = coalesce(item->>'summary', summary),
      details = coalesce(item->>'details', details),
      status = coalesce(item->>'status', status)
    where tenant_id = p_tenant_id
      and id = (item->>'id')::uuid;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'client_context_update_not_found';
    end if;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'notificationUpdates', '[]'::jsonb)) loop
    update notifications set
      title = coalesce(item->>'title', title),
      body = coalesce(item->>'body', body),
      read = coalesce((item->>'read')::boolean, read),
      acknowledged_at = case
        when item ? 'acknowledgedAt' then nullif(item->>'acknowledgedAt', '')::timestamptz
        else acknowledged_at
      end
    where tenant_id = p_tenant_id
      and id = (item->>'id')::uuid;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'notification_not_found';
    end if;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'clientUpdateProposals', '[]'::jsonb)) loop
    insert into client_update_proposals (
      id,
      tenant_id,
      client_id,
      dietitian_id,
      source_text,
      proposed_patches,
      safety_flags,
      status,
      expected_context_revision,
      created_at,
      resolved_at
    )
    values (
      (item->>'id')::uuid,
      p_tenant_id,
      (item->>'clientId')::uuid,
      (item->>'dietitianId')::uuid,
      item->>'sourceText',
      coalesce(item->'proposedPatches', '[]'::jsonb),
      manu_text_array_from_jsonb(item->'safetyFlags'),
      item->>'status',
      (item->>'expectedContextRevision')::integer,
      coalesce(nullif(item->>'createdAt', '')::timestamptz, now()),
      nullif(item->>'resolvedAt', '')::timestamptz
    )
    on conflict (id) do update set
      source_text = excluded.source_text,
      proposed_patches = excluded.proposed_patches,
      safety_flags = excluded.safety_flags,
      status = excluded.status,
      expected_context_revision = excluded.expected_context_revision,
      resolved_at = excluded.resolved_at;
  end loop;

  return jsonb_build_object('ok', true, 'operation', p_operation);
end;
$$;

create or replace function commit_client_update_proposal(p_tenant_id uuid, p_payload jsonb)
returns jsonb language sql security definer set search_path = public
as $$ select manu_commit_state_delta('client_update_proposal', p_tenant_id, p_payload) $$;

create or replace function commit_channel_adapter_rollback(p_tenant_id uuid, p_payload jsonb)
returns jsonb language sql security definer set search_path = public
as $$ select manu_commit_state_delta('channel_adapter_rollback', p_tenant_id, p_payload) $$;

revoke all on function commit_client_update_proposal(uuid, jsonb) from public, anon, authenticated;
grant execute on function commit_client_update_proposal(uuid, jsonb) to service_role;

revoke all on function commit_channel_adapter_rollback(uuid, jsonb) from public, anon, authenticated;
grant execute on function commit_channel_adapter_rollback(uuid, jsonb) to service_role;
