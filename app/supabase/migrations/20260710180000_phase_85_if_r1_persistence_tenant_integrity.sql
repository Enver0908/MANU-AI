-- P85-IF-R1: atomically persist mock-channel transcript state and enforce tenant-scoped references.

create or replace function p85_if_r1_upsert_messages(
  p_tenant_id uuid,
  p_payload jsonb,
  p_generated_by_ai boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
  for item in select * from jsonb_array_elements(coalesce(p_payload->'messages', '[]'::jsonb)) loop
    if (nullif(item->>'generatedByAiDecisionId', '') is not null) is distinct from p_generated_by_ai then
      continue;
    end if;

    insert into messages (
      id, tenant_id, conversation_id, sender, body, origin,
      author_dietitian_id, generated_by_ai_decision_id, approved_by_dietitian_id, source_message_id,
      risk, status, provider_account_binding_id, provider_event_id, provider_message_id,
      actor_type, actor_binding_id, author_interface, actor_resolution_basis,
      provider_sent_at, observed_at, persisted_at, conversation_sequence,
      content_status, retrieval_eligibility, created_at
    ) values (
      (item->>'id')::uuid, p_tenant_id, (item->>'conversationId')::uuid,
      (item->>'sender')::sender_type, item->>'body', (item->>'origin')::message_origin,
      nullif(item->>'authorDietitianId', '')::uuid,
      nullif(item->>'generatedByAiDecisionId', '')::uuid,
      nullif(item->>'approvedByDietitianId', '')::uuid,
      nullif(item->>'sourceMessageId', '')::uuid,
      nullif(item->>'risk', '')::risk_level,
      coalesce(item->>'status', 'stored')::message_status,
      nullif(item->>'providerAccountBindingId', '')::uuid,
      nullif(item->>'providerEventId', ''),
      nullif(item->>'providerMessageId', ''),
      nullif(item->>'actorType', ''),
      nullif(item->>'actorBindingId', '')::uuid,
      nullif(item->>'authorInterface', ''),
      nullif(item->>'actorResolutionBasis', ''),
      nullif(item->>'providerSentAt', '')::timestamptz,
      nullif(item->>'observedAt', '')::timestamptz,
      coalesce(nullif(item->>'persistedAt', '')::timestamptz, now()),
      nullif(item->>'conversationSequence', '')::bigint,
      coalesce(nullif(item->>'contentStatus', ''), 'available'),
      coalesce(nullif(item->>'retrievalEligibility', ''), 'eligible'),
      coalesce(nullif(item->>'createdAt', '')::timestamptz, now())
    ) on conflict (id) do update set
      body = excluded.body,
      origin = excluded.origin,
      author_dietitian_id = excluded.author_dietitian_id,
      generated_by_ai_decision_id = excluded.generated_by_ai_decision_id,
      approved_by_dietitian_id = excluded.approved_by_dietitian_id,
      source_message_id = excluded.source_message_id,
      risk = excluded.risk,
      status = excluded.status,
      provider_account_binding_id = excluded.provider_account_binding_id,
      provider_event_id = excluded.provider_event_id,
      provider_message_id = excluded.provider_message_id,
      actor_type = excluded.actor_type,
      actor_binding_id = excluded.actor_binding_id,
      author_interface = excluded.author_interface,
      actor_resolution_basis = excluded.actor_resolution_basis,
      provider_sent_at = excluded.provider_sent_at,
      observed_at = excluded.observed_at,
      persisted_at = excluded.persisted_at,
      conversation_sequence = excluded.conversation_sequence,
      content_status = excluded.content_status,
      retrieval_eligibility = excluded.retrieval_eligibility;
  end loop;
end;
$$;

create or replace function p85_if_r1_commit_inbound_records(p_tenant_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  affected_rows integer;
begin
  for item in select * from jsonb_array_elements(coalesce(p_payload->'channelEvents', '[]'::jsonb)) loop
    insert into channel_events (
      id, tenant_id, account_binding_id, event_kind, processing_status,
      provider_account_id, provider_event_id, provider_message_id,
      from_identity, to_identity, counterparty_identity, payload_digest,
      payload_schema_version, provider_time, observed_at, committed_at,
      quarantine_id, replay_of_event_id, retry_count
    ) values (
      (item->>'id')::uuid, p_tenant_id, nullif(item->>'accountBindingId', '')::uuid,
      item->>'eventKind', item->>'processingStatus',
      nullif(item->>'providerAccountId', ''), nullif(item->>'providerEventId', ''),
      nullif(item->>'providerMessageId', ''), nullif(item->>'fromIdentity', ''),
      nullif(item->>'toIdentity', ''), nullif(item->>'counterpartyIdentity', ''),
      item->>'payloadDigest', item->>'payloadSchemaVersion',
      nullif(item->>'providerTime', '')::timestamptz,
      coalesce(nullif(item->>'observedAt', '')::timestamptz, now()),
      nullif(item->>'committedAt', '')::timestamptz,
      nullif(item->>'quarantineId', '')::uuid, nullif(item->>'replayOfEventId', '')::uuid,
      coalesce(nullif(item->>'retryCount', '')::integer, 0)
    ) on conflict (id) do update set
      account_binding_id = excluded.account_binding_id,
      event_kind = excluded.event_kind,
      processing_status = excluded.processing_status,
      provider_account_id = excluded.provider_account_id,
      provider_event_id = excluded.provider_event_id,
      provider_message_id = excluded.provider_message_id,
      from_identity = excluded.from_identity,
      to_identity = excluded.to_identity,
      counterparty_identity = excluded.counterparty_identity,
      payload_digest = excluded.payload_digest,
      payload_schema_version = excluded.payload_schema_version,
      provider_time = excluded.provider_time,
      observed_at = excluded.observed_at,
      committed_at = excluded.committed_at,
      quarantine_id = excluded.quarantine_id,
      replay_of_event_id = excluded.replay_of_event_id,
      retry_count = excluded.retry_count;
  end loop;

  perform p85_if_r1_upsert_messages(p_tenant_id, p_payload, true);

  for item in select * from jsonb_array_elements(coalesce(p_payload->'messageUpdates', '[]'::jsonb)) loop
    update messages set
      body = coalesce(item->>'body', body),
      status = coalesce((item->>'status')::message_status, status),
      approved_by_dietitian_id = case when item ? 'approvedByDietitianId' then nullif(item->>'approvedByDietitianId', '')::uuid else approved_by_dietitian_id end,
      generated_by_ai_decision_id = case when item ? 'generatedByAiDecisionId' then nullif(item->>'generatedByAiDecisionId', '')::uuid else generated_by_ai_decision_id end,
      source_message_id = case when item ? 'sourceMessageId' then nullif(item->>'sourceMessageId', '')::uuid else source_message_id end,
      provider_account_binding_id = case when item ? 'providerAccountBindingId' then nullif(item->>'providerAccountBindingId', '')::uuid else provider_account_binding_id end,
      provider_event_id = case when item ? 'providerEventId' then nullif(item->>'providerEventId', '') else provider_event_id end,
      provider_message_id = case when item ? 'providerMessageId' then nullif(item->>'providerMessageId', '') else provider_message_id end,
      actor_type = case when item ? 'actorType' then nullif(item->>'actorType', '') else actor_type end,
      actor_binding_id = case when item ? 'actorBindingId' then nullif(item->>'actorBindingId', '')::uuid else actor_binding_id end,
      author_interface = case when item ? 'authorInterface' then nullif(item->>'authorInterface', '') else author_interface end,
      actor_resolution_basis = case when item ? 'actorResolutionBasis' then nullif(item->>'actorResolutionBasis', '') else actor_resolution_basis end,
      provider_sent_at = case when item ? 'providerSentAt' then nullif(item->>'providerSentAt', '')::timestamptz else provider_sent_at end,
      observed_at = case when item ? 'observedAt' then nullif(item->>'observedAt', '')::timestamptz else observed_at end,
      persisted_at = case when item ? 'persistedAt' then nullif(item->>'persistedAt', '')::timestamptz else persisted_at end,
      conversation_sequence = case when item ? 'conversationSequence' then nullif(item->>'conversationSequence', '')::bigint else conversation_sequence end,
      content_status = case when item ? 'contentStatus' then nullif(item->>'contentStatus', '') else content_status end,
      retrieval_eligibility = case when item ? 'retrievalEligibility' then nullif(item->>'retrievalEligibility', '') else retrieval_eligibility end
    where tenant_id = p_tenant_id and id = (item->>'id')::uuid;
    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then raise exception 'message_not_found'; end if;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'channelMessageRevisions', '[]'::jsonb)) loop
    insert into channel_message_revisions (
      id, tenant_id, message_id, channel_event_id, provider_event_id,
      revision_action, prior_content_status, current_content_status,
      prior_body_digest, current_body_digest, revision_sequence, provider_time, observed_at
    ) values (
      (item->>'id')::uuid, p_tenant_id, nullif(item->>'messageId', '')::uuid,
      nullif(item->>'channelEventId', '')::uuid, nullif(item->>'providerEventId', ''),
      item->>'revisionAction', nullif(item->>'priorContentStatus', ''), item->>'currentContentStatus',
      nullif(item->>'priorBodyDigest', ''), nullif(item->>'currentBodyDigest', ''),
      (item->>'revisionSequence')::integer, nullif(item->>'providerTime', '')::timestamptz,
      coalesce(nullif(item->>'observedAt', '')::timestamptz, now())
    ) on conflict (id) do update set
      message_id = excluded.message_id,
      channel_event_id = excluded.channel_event_id,
      provider_event_id = excluded.provider_event_id,
      revision_action = excluded.revision_action,
      prior_content_status = excluded.prior_content_status,
      current_content_status = excluded.current_content_status,
      prior_body_digest = excluded.prior_body_digest,
      current_body_digest = excluded.current_body_digest,
      revision_sequence = excluded.revision_sequence,
      provider_time = excluded.provider_time,
      observed_at = excluded.observed_at;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'humanControlSessions', '[]'::jsonb)) loop
    insert into human_control_sessions (
      id, tenant_id, client_id, conversation_id, reason, status, previous_ai_status, previous_ai_mode,
      linked_handoff_id, linked_yellow_hold_message_id, opened_by_message_id, latest_human_message_id,
      human_response_observed_count, opened_at, resolved_at, reactivated_by_dietitian_id,
      reactivation_reason_code, restored_ai_mode
    ) values (
      (item->>'id')::uuid, p_tenant_id, (item->>'clientId')::uuid, (item->>'conversationId')::uuid,
      item->>'reason', item->>'status', item->>'previousAiStatus', item->>'previousAiMode',
      nullif(item->>'linkedHandoffId', '')::uuid, nullif(item->>'linkedYellowHoldMessageId', '')::uuid,
      nullif(item->>'openedByMessageId', '')::uuid, nullif(item->>'latestHumanMessageId', '')::uuid,
      coalesce(nullif(item->>'humanResponseObservedCount', '')::integer, 0),
      coalesce(nullif(item->>'openedAt', '')::timestamptz, now()), nullif(item->>'resolvedAt', '')::timestamptz,
      nullif(item->>'reactivatedByDietitianId', '')::uuid, nullif(item->>'reactivationReasonCode', ''),
      nullif(item->>'restoredAiMode', '')
    ) on conflict (id) do update set
      status = excluded.status,
      linked_handoff_id = excluded.linked_handoff_id,
      linked_yellow_hold_message_id = excluded.linked_yellow_hold_message_id,
      opened_by_message_id = excluded.opened_by_message_id,
      latest_human_message_id = excluded.latest_human_message_id,
      human_response_observed_count = excluded.human_response_observed_count,
      resolved_at = excluded.resolved_at,
      reactivated_by_dietitian_id = excluded.reactivated_by_dietitian_id,
      reactivation_reason_code = excluded.reactivation_reason_code,
      restored_ai_mode = excluded.restored_ai_mode;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'riskActivityEvents', '[]'::jsonb)) loop
    insert into risk_activity_events (
      id, tenant_id, client_id, conversation_id, human_control_session_id, event_type,
      source_message_id, handoff_id, ai_decision_id, metadata, created_at
    ) values (
      (item->>'id')::uuid, p_tenant_id, (item->>'clientId')::uuid, (item->>'conversationId')::uuid,
      nullif(item->>'humanControlSessionId', '')::uuid, item->>'eventType',
      nullif(item->>'sourceMessageId', '')::uuid, nullif(item->>'handoffId', '')::uuid,
      nullif(item->>'aiDecisionId', '')::uuid, coalesce(item->'metadata', '{}'::jsonb),
      coalesce(nullif(item->>'createdAt', '')::timestamptz, now())
    ) on conflict (id) do update set metadata = excluded.metadata;
  end loop;

end;
$$;

create or replace function commit_inbound_simulation(p_tenant_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform p85_if_r1_upsert_messages(p_tenant_id, p_payload, false);
  perform manu_commit_state_delta(
    'inbound_simulation',
    p_tenant_id,
    p_payload - 'messages' - 'messageUpdates' - 'channelEvents' - 'channelMessageRevisions' - 'humanControlSessions' - 'riskActivityEvents' - 'conversationUpdates'
  );
  perform p85_if_f_commit_conversation_revisions(p_tenant_id, p_payload);
  perform p85_if_r1_commit_inbound_records(p_tenant_id, p_payload);
  return jsonb_build_object('ok', true, 'operation', 'inbound_simulation');
end;
$$;

do $$
declare
  invalid_reference boolean;
begin
  select exists (
    select 1 from channel_events event
    left join channel_account_bindings binding on binding.id = event.account_binding_id and binding.tenant_id = event.tenant_id
    where event.account_binding_id is not null and binding.id is null
  ) into invalid_reference;
  if invalid_reference then raise exception 'p85_if_r1_cross_tenant_channel_event_reference'; end if;

  select exists (
    select 1 from human_control_sessions session
    join clients client on client.id = session.client_id
    join conversations conversation on conversation.id = session.conversation_id
    where client.tenant_id <> session.tenant_id or conversation.tenant_id <> session.tenant_id
  ) into invalid_reference;
  if invalid_reference then raise exception 'p85_if_r1_cross_tenant_human_control_reference'; end if;

  select exists (
    select 1 from risk_activity_events event
    join clients client on client.id = event.client_id
    join conversations conversation on conversation.id = event.conversation_id
    where client.tenant_id <> event.tenant_id or conversation.tenant_id <> event.tenant_id
  ) into invalid_reference;
  if invalid_reference then raise exception 'p85_if_r1_cross_tenant_risk_activity_reference'; end if;

  select exists (
    select 1 from context_intake_proposals proposal
    left join clients client on client.id = proposal.client_id
    left join dietitians dietitian on dietitian.id = proposal.dietitian_id
    where client.tenant_id <> proposal.tenant_id
      or (proposal.dietitian_id is not null and dietitian.tenant_id <> proposal.tenant_id)
  ) into invalid_reference;
  if invalid_reference then raise exception 'p85_if_r1_cross_tenant_context_intake_reference'; end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_clients_tenant_id_id_key') then
    alter table clients add constraint p85_if_r1_clients_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_conversations_tenant_id_id_key') then
    alter table conversations add constraint p85_if_r1_conversations_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_messages_tenant_id_id_key') then
    alter table messages add constraint p85_if_r1_messages_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_dietitians_tenant_id_id_key') then
    alter table dietitians add constraint p85_if_r1_dietitians_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_handoffs_tenant_id_id_key') then
    alter table handoff_cases add constraint p85_if_r1_handoffs_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_decisions_tenant_id_id_key') then
    alter table ai_decisions add constraint p85_if_r1_decisions_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_context_updates_tenant_id_id_key') then
    alter table client_context_updates add constraint p85_if_r1_context_updates_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_quarantines_tenant_id_id_key') then
    alter table inbound_quarantines add constraint p85_if_r1_quarantines_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_accounts_tenant_id_id_key') then
    alter table channel_account_bindings add constraint p85_if_r1_accounts_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_actors_tenant_id_id_key') then
    alter table channel_actor_bindings add constraint p85_if_r1_actors_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_events_tenant_id_id_key') then
    alter table channel_events add constraint p85_if_r1_events_tenant_id_id_key unique (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_sessions_tenant_id_id_key') then
    alter table human_control_sessions add constraint p85_if_r1_sessions_tenant_id_id_key unique (tenant_id, id);
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_event_account_tenant_fk') then
    alter table channel_events add constraint p85_if_r1_event_account_tenant_fk foreign key (tenant_id, account_binding_id) references channel_account_bindings (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_event_quarantine_tenant_fk') then
    alter table channel_events add constraint p85_if_r1_event_quarantine_tenant_fk foreign key (tenant_id, quarantine_id) references inbound_quarantines (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_event_replay_tenant_fk') then
    alter table channel_events add constraint p85_if_r1_event_replay_tenant_fk foreign key (tenant_id, replay_of_event_id) references channel_events (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_revision_message_tenant_fk') then
    alter table channel_message_revisions add constraint p85_if_r1_revision_message_tenant_fk foreign key (tenant_id, message_id) references messages (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_revision_event_tenant_fk') then
    alter table channel_message_revisions add constraint p85_if_r1_revision_event_tenant_fk foreign key (tenant_id, channel_event_id) references channel_events (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_session_client_tenant_fk') then
    alter table human_control_sessions add constraint p85_if_r1_session_client_tenant_fk foreign key (tenant_id, client_id) references clients (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_session_conversation_tenant_fk') then
    alter table human_control_sessions add constraint p85_if_r1_session_conversation_tenant_fk foreign key (tenant_id, conversation_id) references conversations (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_session_handoff_tenant_fk') then
    alter table human_control_sessions add constraint p85_if_r1_session_handoff_tenant_fk foreign key (tenant_id, linked_handoff_id) references handoff_cases (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_session_opened_message_tenant_fk') then
    alter table human_control_sessions add constraint p85_if_r1_session_opened_message_tenant_fk foreign key (tenant_id, opened_by_message_id) references messages (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_session_latest_message_tenant_fk') then
    alter table human_control_sessions add constraint p85_if_r1_session_latest_message_tenant_fk foreign key (tenant_id, latest_human_message_id) references messages (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_session_reactivator_tenant_fk') then
    alter table human_control_sessions add constraint p85_if_r1_session_reactivator_tenant_fk foreign key (tenant_id, reactivated_by_dietitian_id) references dietitians (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_risk_client_tenant_fk') then
    alter table risk_activity_events add constraint p85_if_r1_risk_client_tenant_fk foreign key (tenant_id, client_id) references clients (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_risk_conversation_tenant_fk') then
    alter table risk_activity_events add constraint p85_if_r1_risk_conversation_tenant_fk foreign key (tenant_id, conversation_id) references conversations (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_risk_session_tenant_fk') then
    alter table risk_activity_events add constraint p85_if_r1_risk_session_tenant_fk foreign key (tenant_id, human_control_session_id) references human_control_sessions (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_risk_message_tenant_fk') then
    alter table risk_activity_events add constraint p85_if_r1_risk_message_tenant_fk foreign key (tenant_id, source_message_id) references messages (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_risk_handoff_tenant_fk') then
    alter table risk_activity_events add constraint p85_if_r1_risk_handoff_tenant_fk foreign key (tenant_id, handoff_id) references handoff_cases (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_risk_decision_tenant_fk') then
    alter table risk_activity_events add constraint p85_if_r1_risk_decision_tenant_fk foreign key (tenant_id, ai_decision_id) references ai_decisions (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_intake_client_tenant_fk') then
    alter table context_intake_proposals add constraint p85_if_r1_intake_client_tenant_fk foreign key (tenant_id, client_id) references clients (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_intake_dietitian_tenant_fk') then
    alter table context_intake_proposals add constraint p85_if_r1_intake_dietitian_tenant_fk foreign key (tenant_id, dietitian_id) references dietitians (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_r1_intake_update_tenant_fk') then
    alter table context_intake_proposals add constraint p85_if_r1_intake_update_tenant_fk foreign key (tenant_id, applied_context_update_id) references client_context_updates (tenant_id, id);
  end if;
end;
$$;
