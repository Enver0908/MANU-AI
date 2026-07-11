-- P85-IF-R6: persist lifecycle redaction and tenant channel-binding revoke evidence.

create or replace function p85_if_r6_commit_lifecycle_records(p_tenant_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
  for item in select * from jsonb_array_elements(coalesce(p_payload->'messageUpdates', '[]'::jsonb)) loop
    update messages set
      provider_account_binding_id = case when item ? 'providerAccountBindingId' then nullif(item->>'providerAccountBindingId', '')::uuid else provider_account_binding_id end,
      provider_event_id = case when item ? 'providerEventId' then nullif(item->>'providerEventId', '') else provider_event_id end,
      provider_message_id = case when item ? 'providerMessageId' then nullif(item->>'providerMessageId', '') else provider_message_id end,
      actor_binding_id = case when item ? 'actorBindingId' then nullif(item->>'actorBindingId', '')::uuid else actor_binding_id end,
      author_interface = case when item ? 'authorInterface' then nullif(item->>'authorInterface', '') else author_interface end,
      actor_resolution_basis = case when item ? 'actorResolutionBasis' then nullif(item->>'actorResolutionBasis', '') else actor_resolution_basis end,
      content_status = case when item ? 'contentStatus' then nullif(item->>'contentStatus', '') else content_status end,
      retrieval_eligibility = case when item ? 'retrievalEligibility' then nullif(item->>'retrievalEligibility', '') else retrieval_eligibility end
    where tenant_id = p_tenant_id and id = (item->>'id')::uuid;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'channelMessageRevisions', '[]'::jsonb)) loop
    update channel_message_revisions set
      channel_event_id = case when item ? 'channelEventId' then nullif(item->>'channelEventId', '')::uuid else channel_event_id end,
      provider_event_id = case when item ? 'providerEventId' then nullif(item->>'providerEventId', '') else provider_event_id end,
      prior_body_digest = case when item ? 'priorBodyDigest' then nullif(item->>'priorBodyDigest', '') else prior_body_digest end,
      current_body_digest = case when item ? 'currentBodyDigest' then nullif(item->>'currentBodyDigest', '') else current_body_digest end
    where tenant_id = p_tenant_id and id = (item->>'id')::uuid;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'humanControlSessions', '[]'::jsonb)) loop
    update human_control_sessions set
      linked_handoff_id = case when item ? 'linkedHandoffId' then nullif(item->>'linkedHandoffId', '')::uuid else linked_handoff_id end,
      linked_yellow_hold_message_id = case when item ? 'linkedYellowHoldMessageId' then nullif(item->>'linkedYellowHoldMessageId', '')::uuid else linked_yellow_hold_message_id end,
      opened_by_message_id = case when item ? 'openedByMessageId' then nullif(item->>'openedByMessageId', '')::uuid else opened_by_message_id end,
      latest_human_message_id = case when item ? 'latestHumanMessageId' then nullif(item->>'latestHumanMessageId', '')::uuid else latest_human_message_id end,
      reactivated_by_dietitian_id = case when item ? 'reactivatedByDietitianId' then nullif(item->>'reactivatedByDietitianId', '')::uuid else reactivated_by_dietitian_id end,
      reactivation_reason_code = case when item ? 'reactivationReasonCode' then nullif(item->>'reactivationReasonCode', '') else reactivation_reason_code end
    where tenant_id = p_tenant_id and id = (item->>'id')::uuid;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'riskActivityEvents', '[]'::jsonb)) loop
    update risk_activity_events set
      source_message_id = case when item ? 'sourceMessageId' then nullif(item->>'sourceMessageId', '')::uuid else source_message_id end,
      handoff_id = case when item ? 'handoffId' then nullif(item->>'handoffId', '')::uuid else handoff_id end,
      ai_decision_id = case when item ? 'aiDecisionId' then nullif(item->>'aiDecisionId', '')::uuid else ai_decision_id end,
      human_control_session_id = case when item ? 'humanControlSessionId' then nullif(item->>'humanControlSessionId', '')::uuid else human_control_session_id end,
      metadata = coalesce(item->'metadata', metadata)
    where tenant_id = p_tenant_id and id = (item->>'id')::uuid;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'contextIntakeProposalUpdates', '[]'::jsonb)) loop
    update context_intake_proposals set
      source_text = case when item ? 'sourceText' then nullif(item->>'sourceText', '') else source_text end,
      raw_source_reference = case when item ? 'rawSourceReference' then nullif(item->>'rawSourceReference', '') else raw_source_reference end,
      title = coalesce(item->>'title', title),
      summary = coalesce(item->>'summary', summary),
      details = coalesce(item->>'details', details),
      status = coalesce(item->>'status', status),
      updated_at = coalesce(nullif(item->>'updatedAt', '')::timestamptz, updated_at)
    where tenant_id = p_tenant_id and id = (item->>'id')::uuid;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'inboundQuarantineUpdates', '[]'::jsonb)) loop
    update inbound_quarantines set
      source_conversation_id = case when item ? 'sourceConversationId' then nullif(item->>'sourceConversationId', '') else source_conversation_id end,
      source_message_id = case when item ? 'sourceMessageId' then nullif(item->>'sourceMessageId', '') else source_message_id end,
      sender_channel_user_id = case when item ? 'senderChannelUserId' then nullif(item->>'senderChannelUserId', '') else sender_channel_user_id end
    where tenant_id = p_tenant_id and id = (item->>'id')::uuid;
  end loop;
end;
$$;

create or replace function commit_client_removal_lifecycle(p_tenant_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform manu_commit_state_delta(
    'client_removal_lifecycle',
    p_tenant_id,
    p_payload
      - 'channelMessageRevisions'
      - 'humanControlSessions'
      - 'riskActivityEvents'
      - 'contextIntakeProposalUpdates'
      - 'inboundQuarantineUpdates'
      - 'channelAccountBindingUpdates'
      - 'channelActorBindingUpdates'
  );
  perform p85_if_r6_commit_lifecycle_records(p_tenant_id, p_payload);
  return jsonb_build_object('ok', true, 'operation', 'client_removal_lifecycle');
end;
$$;

create or replace function p85_if_r6_revoke_tenant_channel_bindings(p_tenant_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  actor_item jsonb;
  rollback_item jsonb;
  account_count integer;
  actor_count integer;
begin
  perform 1 from tenants where id = p_tenant_id for update;
  perform 1 from channel_account_bindings where tenant_id = p_tenant_id for update;
  perform 1 from channel_actor_bindings where tenant_id = p_tenant_id for update;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'channelAccountBindingUpdates', '[]'::jsonb)) loop
    update channel_account_bindings set
      lifecycle_status = coalesce(item->>'lifecycleStatus', lifecycle_status),
      revoked_at = case when item ? 'revokedAt' then nullif(item->>'revokedAt', '')::timestamptz else revoked_at end,
      revoked_by_dietitian_id = case when item ? 'revokedByDietitianId' then nullif(item->>'revokedByDietitianId', '')::uuid else revoked_by_dietitian_id end,
      updated_at = coalesce(nullif(item->>'updatedAt', '')::timestamptz, updated_at)
    where tenant_id = p_tenant_id and id = (item->>'id')::uuid;
  end loop;

  for actor_item in select * from jsonb_array_elements(coalesce(p_payload->'channelActorBindingUpdates', '[]'::jsonb)) loop
    update channel_actor_bindings set
      valid_to = case when actor_item ? 'validTo' then nullif(actor_item->>'validTo', '')::timestamptz else valid_to end,
      revoked_at = case when actor_item ? 'revokedAt' then nullif(actor_item->>'revokedAt', '')::timestamptz else revoked_at end,
      revoked_by_dietitian_id = case when actor_item ? 'revokedByDietitianId' then nullif(actor_item->>'revokedByDietitianId', '')::uuid else revoked_by_dietitian_id end
    where tenant_id = p_tenant_id and id = (actor_item->>'id')::uuid;
  end loop;

  rollback_item := p_payload->'channelAdapterRollbackControls';
  if rollback_item is not null then
    insert into channel_adapter_rollback_controls (
      tenant_id, global_channel_automation_disabled, tenant_channel_automation_disabled,
      disabled_dietitian_ids, disabled_client_ids, updated_at
    ) values (
      p_tenant_id,
      coalesce((rollback_item->>'globalChannelAutomationDisabled')::boolean, false),
      true,
      coalesce(array(select jsonb_array_elements_text(rollback_item->'disabledDietitianIds')::uuid), '{}'),
      coalesce(array(select jsonb_array_elements_text(rollback_item->'disabledClientIds')::uuid), '{}'),
      now()
    ) on conflict (tenant_id) do update set
      tenant_channel_automation_disabled = true,
      global_channel_automation_disabled = excluded.global_channel_automation_disabled,
      disabled_dietitian_ids = excluded.disabled_dietitian_ids,
      disabled_client_ids = excluded.disabled_client_ids,
      updated_at = now();
  end if;

  perform manu_commit_state_delta(
    'tenant_channel_bindings_revoke',
    p_tenant_id,
    p_payload - 'channelAccountBindingUpdates' - 'channelActorBindingUpdates' - 'channelAdapterRollbackControls'
  );

  select count(*) into account_count from channel_account_bindings
  where tenant_id = p_tenant_id and lifecycle_status = 'revoked';
  select count(*) into actor_count from channel_actor_bindings
  where tenant_id = p_tenant_id and revoked_at is not null;

  return jsonb_build_object(
    'ok', true,
    'operation', 'p85_if_r6_revoke_tenant_channel_bindings',
    'revokedAccountBindingCount', account_count,
    'revokedActorBindingCount', actor_count,
    'tenantChannelAutomationDisabled', true
  );
end;
$$;

revoke all on function p85_if_r6_commit_lifecycle_records(uuid, jsonb) from public, anon, authenticated;
revoke all on function commit_client_removal_lifecycle(uuid, jsonb) from public, anon, authenticated;
revoke all on function p85_if_r6_revoke_tenant_channel_bindings(uuid, jsonb) from public, anon, authenticated;

grant execute on function commit_client_removal_lifecycle(uuid, jsonb) to service_role;
grant execute on function p85_if_r6_revoke_tenant_channel_bindings(uuid, jsonb) to service_role;
