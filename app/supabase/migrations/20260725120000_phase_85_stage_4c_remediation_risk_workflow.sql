-- Phase 85 Stage 4C remediation Faz 5: durable risk assessment, notifications, handoff, and safe draft transfer RPCs.

alter table ai_chat_run_risk_assessments
  add column if not exists assessment_fingerprint text;

create unique index if not exists ai_chat_run_risk_assessments_active_fingerprint_uidx
  on ai_chat_run_risk_assessments (tenant_id, run_id, assessment_fingerprint)
  where status = 'active' and assessment_fingerprint is not null;

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
      'ai_chat_red_review_required',
      'legacy_system',
      'legacy_handoff'
    )
  );

create or replace function p85_stage_4c_build_source_revision_digest(
  p_revision_token text,
  p_source_ref_ids jsonb
)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(
    digest(
      concat_ws(
        ':',
        coalesce(nullif(trim(p_revision_token), ''), 'none'),
        coalesce(
          (
            select string_agg(value, '|' order by value)
            from jsonb_array_elements_text(coalesce(p_source_ref_ids, '[]'::jsonb)) as value
          ),
          ''
        )
      ),
      'sha256'
    ),
    'hex'
  )
$$;

create or replace function p85_stage_4c_build_red_notification_fingerprint(
  p_client_id uuid,
  p_reasons jsonb,
  p_source_revision_digest text
)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(
    digest(
      concat_ws(
        ':',
        p_client_id::text,
        coalesce(
          (
            select string_agg(lower(trim(value)), '|' order by lower(trim(value)))
            from jsonb_array_elements_text(coalesce(p_reasons, '[]'::jsonb)) as value
          ),
          ''
        ),
        coalesce(nullif(trim(p_source_revision_digest), ''), '')
      ),
      'sha256'
    ),
    'hex'
  )
$$;

create or replace function p85_stage_4c_build_client_revision_token(
  p_tenant_id uuid,
  p_client_id uuid,
  p_conversation_revision bigint
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_context_revision bigint := 0;
begin
  select c.context_revision
    into v_context_revision
  from clients c
  where c.tenant_id = p_tenant_id
    and c.id = p_client_id;

  if not found then
    return '';
  end if;

  return format(
    'client:%s:%s:conversation:%s',
    p_client_id,
    coalesce(v_context_revision, 0),
    coalesce(p_conversation_revision, 0)
  );
end;
$$;

create or replace function p85_stage_4c_risk_assessment_to_json(
  p_row ai_chat_run_risk_assessments,
  p_safe_draft jsonb default null
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'tenant_id', p_row.tenant_id,
    'run_id', p_row.run_id,
    'conversation_id', p_row.conversation_id,
    'created_by_user_id', p_row.created_by_user_id,
    'client_id', p_row.client_id,
    'risk_level', p_row.risk_level,
    'reasons', coalesce(p_row.reasons, '[]'::jsonb),
    'source_ref_ids', coalesce(p_row.source_ref_ids, '[]'::jsonb),
    'confidence_class', p_row.confidence_class,
    'recommended_human_action', p_row.recommended_human_action,
    'hypothetical_red', p_row.hypothetical_red,
    'source_revision_digest', p_row.source_revision_digest,
    'assessment_fingerprint', p_row.assessment_fingerprint,
    'handoff_confirmation_token', p_row.handoff_confirmation_token,
    'status', p_row.status,
    'superseded_at', p_row.superseded_at,
    'created_at', p_row.created_at,
    'updated_at', p_row.updated_at,
    'safe_draft', p_safe_draft
  )
$$;

create or replace function p85_stage_4c_draft_transfer_to_json(p_row ai_chat_draft_transfers)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'tenant_id', p_row.tenant_id,
    'run_id', p_row.run_id,
    'source_conversation_id', p_row.source_conversation_id,
    'destination_conversation_id', p_row.destination_conversation_id,
    'destination_client_id', p_row.destination_client_id,
    'created_by_user_id', p_row.created_by_user_id,
    'risk_level', p_row.risk_level,
    'review_origin', p_row.review_origin,
    'transfer_mode', p_row.transfer_mode,
    'draft_body', p_row.draft_body,
    'source_ref_ids', coalesce(p_row.source_ref_ids, '[]'::jsonb),
    'status', p_row.status,
    'destination_revision', p_row.destination_revision,
    'client_context_revision', p_row.client_context_revision,
    'consumed_at', p_row.consumed_at,
    'superseded_at', p_row.superseded_at,
    'created_at', p_row.created_at,
    'updated_at', p_row.updated_at
  )
$$;

create or replace function p85_stage_4c_handoff_link_to_json(p_row ai_chat_handoff_links)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'tenant_id', p_row.tenant_id,
    'run_id', p_row.run_id,
    'conversation_id', p_row.conversation_id,
    'client_id', p_row.client_id,
    'created_by_user_id', p_row.created_by_user_id,
    'handoff_id', p_row.handoff_id,
    'fingerprint', p_row.fingerprint,
    'confirmation_token', p_row.confirmation_token,
    'status', p_row.status,
    'superseded_at', p_row.superseded_at,
    'created_at', p_row.created_at,
    'updated_at', p_row.updated_at
  )
$$;

create or replace function p85_stage_4c_apply_run_risk_pipeline_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_run_id uuid,
  p_revision_token text,
  p_source_revision_digest text,
  p_assessment_fingerprint text,
  p_risk_level text,
  p_reasons jsonb,
  p_source_ref_ids jsonb,
  p_confidence_class text,
  p_recommended_human_action text,
  p_hypothetical_red boolean,
  p_safe_draft jsonb,
  p_handoff_confirmation_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run ai_chat_runs%rowtype;
  v_conversation ai_chat_conversations%rowtype;
  v_existing ai_chat_run_risk_assessments%rowtype;
  v_assessment ai_chat_run_risk_assessments%rowtype;
  v_expected_revision_token text;
  v_expected_digest text;
  v_safe_draft jsonb;
  v_red_fingerprint text;
  v_dedupe_key text;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if coalesce(trim(p_assessment_fingerprint), '') = '' then
    raise exception 'ai_chat_risk_assessment_missing';
  end if;

  if p_risk_level not in ('green', 'yellow', 'red') then
    raise exception 'ai_chat_risk_level_invalid';
  end if;

  if not p85_stage_4c_validate_creator_membership(p_tenant_id, p_user_id, p_dietitian_id) then
    raise exception 'ai_chat_creator_membership_invalid';
  end if;

  select *
    into v_run
  from ai_chat_runs r
  where r.tenant_id = p_tenant_id
    and r.id = p_run_id
  for update;

  if not found then
    raise exception 'ai_chat_run_not_found';
  end if;

  if v_run.created_by_user_id <> p_user_id then
    raise exception 'ai_chat_not_found';
  end if;

  select *
    into v_conversation
  from ai_chat_conversations c
  where c.tenant_id = p_tenant_id
    and c.id = v_run.conversation_id
    and c.created_by_user_id = p_user_id
  for update;

  if not found then
    raise exception 'ai_chat_not_found';
  end if;

  if v_conversation.scope_type = 'general' then
    raise exception 'ai_chat_general_scope_risk_bridge_blocked';
  end if;

  if v_conversation.client_id is null
     or not p85_stage_4c_resolve_client_access_v1(
       p_tenant_id,
       v_conversation.client_id,
       p_user_id,
       p_dietitian_id,
       p_role
     ) then
    raise exception 'ai_chat_not_found';
  end if;

  v_expected_revision_token := p85_stage_4c_build_client_revision_token(
    p_tenant_id,
    v_conversation.client_id,
    v_conversation.revision
  );

  if coalesce(trim(p_revision_token), '') <> v_expected_revision_token then
    raise exception 'ai_chat_client_context_revision_conflict';
  end if;

  v_expected_digest := p85_stage_4c_build_source_revision_digest(p_revision_token, p_source_ref_ids);
  if coalesce(trim(p_source_revision_digest), '') <> v_expected_digest then
    raise exception 'ai_chat_client_context_revision_conflict';
  end if;

  select *
    into v_existing
  from ai_chat_run_risk_assessments a
  where a.tenant_id = p_tenant_id
    and a.run_id = p_run_id
    and a.assessment_fingerprint = p_assessment_fingerprint
    and a.status = 'active'
  limit 1;

  if found then
    select e.safe_draft
      into v_safe_draft
    from ai_chat_answer_envelopes e
    where e.tenant_id = p_tenant_id
      and e.run_id = p_run_id
    order by e.created_at desc
    limit 1;

    return p85_stage_4c_risk_assessment_to_json(v_existing, v_safe_draft);
  end if;

  if p_risk_level = 'red' then
    v_safe_draft := null;
  elsif coalesce(trim(p_safe_draft ->> 'body'), '') = '' then
    v_safe_draft := null;
  else
    v_safe_draft := jsonb_build_object(
      'body', p_safe_draft ->> 'body',
      'risk_level', coalesce(p_safe_draft ->> 'risk_level', p_risk_level),
      'source_ref_ids', coalesce(p_safe_draft -> 'source_ref_ids', p_source_ref_ids, '[]'::jsonb)
    );
  end if;

  update ai_chat_run_risk_assessments
  set status = 'superseded',
      superseded_at = v_now,
      updated_at = v_now
  where tenant_id = p_tenant_id
    and run_id = p_run_id
    and status = 'active';

  insert into ai_chat_run_risk_assessments (
    tenant_id,
    run_id,
    conversation_id,
    created_by_user_id,
    client_id,
    risk_level,
    reasons,
    source_ref_ids,
    confidence_class,
    recommended_human_action,
    hypothetical_red,
    source_revision_digest,
    assessment_fingerprint,
    handoff_confirmation_token,
    status,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    p_run_id,
    v_conversation.id,
    p_user_id,
    v_conversation.client_id,
    p_risk_level,
    coalesce(p_reasons, '[]'::jsonb),
    coalesce(p_source_ref_ids, '[]'::jsonb),
    p_confidence_class,
    p_recommended_human_action,
    coalesce(p_hypothetical_red, false),
    p_source_revision_digest,
    p_assessment_fingerprint,
    p_handoff_confirmation_token,
    'active',
    v_now,
    v_now
  )
  returning * into v_assessment;

  update ai_chat_answer_envelopes
  set safe_draft = v_safe_draft
  where tenant_id = p_tenant_id
    and run_id = p_run_id;

  if v_conversation.client_id is not null
     and p_risk_level = 'red'
     and not coalesce(p_hypothetical_red, false) then
    v_red_fingerprint := p85_stage_4c_build_red_notification_fingerprint(
      v_conversation.client_id,
      p_reasons,
      p_source_revision_digest
    );
    v_dedupe_key := format('p85-4c:red:%s:%s', p_tenant_id, v_red_fingerprint);

    insert into notifications (
      id,
      tenant_id,
      type,
      entity_type,
      entity_id,
      title,
      body,
      read,
      dedupe_key,
      target_panel,
      kind,
      priority,
      client_id,
      conversation_id,
      occurrence_count,
      last_occurred_at,
      created_at
    )
    values (
      gen_random_uuid(),
      p_tenant_id,
      'system',
      'ai_chat_run',
      p_run_id::text,
      'AI Chat red review required',
      'A client-scoped AI Chat run requires urgent dietitian review.',
      false,
      v_dedupe_key,
      'ai_chat',
      'ai_chat_red_review_required',
      'intervention_required',
      v_conversation.client_id,
      v_conversation.id,
      1,
      v_now,
      v_now
    )
    on conflict (tenant_id, dedupe_key) where dedupe_key is not null and resolved_at is null
    do update set
      occurrence_count = notifications.occurrence_count + 1,
      last_occurred_at = excluded.last_occurred_at,
      entity_id = excluded.entity_id,
      conversation_id = excluded.conversation_id,
      client_id = excluded.client_id;
  end if;

  return p85_stage_4c_risk_assessment_to_json(v_assessment, v_safe_draft);
end;
$$;

create or replace function p85_stage_4c_get_run_risk_summary_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_run_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_run ai_chat_runs%rowtype;
  v_conversation ai_chat_conversations%rowtype;
  v_assessment ai_chat_run_risk_assessments%rowtype;
  v_safe_draft jsonb;
  v_client_context_revision integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_run
  from ai_chat_runs r
  where r.tenant_id = p_tenant_id
    and r.id = p_run_id;

  if not found or v_run.created_by_user_id <> p_user_id then
    return null;
  end if;

  select *
    into v_conversation
  from ai_chat_conversations c
  where c.tenant_id = p_tenant_id
    and c.id = v_run.conversation_id
    and c.created_by_user_id = p_user_id;

  if not found then
    return null;
  end if;

  if v_conversation.scope_type = 'client'
     and (
       v_conversation.client_id is null
       or not p85_stage_4c_resolve_client_access_v1(
         p_tenant_id,
         v_conversation.client_id,
         p_user_id,
         p_dietitian_id,
         p_role
       )
     ) then
    return null;
  end if;

  select *
    into v_assessment
  from ai_chat_run_risk_assessments a
  where a.tenant_id = p_tenant_id
    and a.run_id = p_run_id
    and a.status = 'active'
  order by a.created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  select e.safe_draft
    into v_safe_draft
  from ai_chat_answer_envelopes e
  where e.tenant_id = p_tenant_id
    and e.run_id = p_run_id
  order by e.created_at desc
  limit 1;

  v_client_context_revision := null;
  if v_conversation.client_id is not null then
    select c.context_revision
      into v_client_context_revision
    from clients c
    where c.tenant_id = p_tenant_id
      and c.id = v_conversation.client_id;
  end if;

  return jsonb_build_object(
    'run_id', p_run_id,
    'risk_level', v_assessment.risk_level,
    'reasons', coalesce(v_assessment.reasons, '[]'::jsonb),
    'confidence_class', v_assessment.confidence_class,
    'recommended_human_action', v_assessment.recommended_human_action,
    'hypothetical_red', v_assessment.hypothetical_red,
    'safe_draft', v_safe_draft,
    'handoff_confirmation_token', v_assessment.handoff_confirmation_token,
    'can_transfer_draft', v_assessment.risk_level <> 'red' and coalesce(trim(v_safe_draft ->> 'body'), '') <> '',
    'can_create_handoff', v_assessment.risk_level = 'red' and v_assessment.client_id is not null,
    'client_context_revision', v_client_context_revision
  );
end;
$$;

create or replace function p85_stage_4c_list_run_draft_destinations_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_run_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_run ai_chat_runs%rowtype;
  v_conversation ai_chat_conversations%rowtype;
  v_assessment ai_chat_run_risk_assessments%rowtype;
  v_items jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_run
  from ai_chat_runs r
  where r.tenant_id = p_tenant_id
    and r.id = p_run_id;

  if not found or v_run.created_by_user_id <> p_user_id then
    raise exception 'ai_chat_run_not_found';
  end if;

  select *
    into v_conversation
  from ai_chat_conversations c
  where c.tenant_id = p_tenant_id
    and c.id = v_run.conversation_id
    and c.created_by_user_id = p_user_id;

  if not found then
    raise exception 'ai_chat_not_found';
  end if;

  if v_conversation.scope_type = 'general' then
    raise exception 'ai_chat_general_scope_risk_bridge_blocked';
  end if;

  select *
    into v_assessment
  from ai_chat_run_risk_assessments a
  where a.tenant_id = p_tenant_id
    and a.run_id = p_run_id
    and a.status = 'active'
  order by a.created_at desc
  limit 1;

  if not found then
    raise exception 'ai_chat_risk_assessment_missing';
  end if;

  if v_assessment.client_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'conversation_id', ranked.id,
        'client_id', ranked.client_id,
        'channel', ranked.channel::text,
        'revision', ranked.revision
      )
      order by ranked.revision desc, ranked.created_at desc
    ),
    '[]'::jsonb
  )
    into v_items
  from (
    select c.id, c.client_id, c.channel, c.revision, c.created_at
    from conversations c
    where c.tenant_id = p_tenant_id
      and c.client_id = v_assessment.client_id
      and p85_stage_4b_actor_can_read_client(
        p_tenant_id,
        c.client_id,
        p_user_id,
        p_dietitian_id,
        p_role
      )
    order by c.revision desc, c.created_at desc
    limit 20
  ) ranked;

  return coalesce(v_items, '[]'::jsonb);
end;
$$;

create or replace function p85_stage_4c_transfer_run_draft_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_run_id uuid,
  p_source_conversation_id uuid,
  p_destination_conversation_id uuid,
  p_destination_revision integer,
  p_client_context_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment ai_chat_run_risk_assessments%rowtype;
  v_source ai_chat_conversations%rowtype;
  v_destination conversations%rowtype;
  v_client clients%rowtype;
  v_safe_draft jsonb;
  v_transfer ai_chat_draft_transfers%rowtype;
  v_transfer_mode text;
  v_draft_message_id uuid := gen_random_uuid();
  v_decision_id uuid := gen_random_uuid();
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if not p85_stage_4c_validate_creator_membership(p_tenant_id, p_user_id, p_dietitian_id) then
    raise exception 'ai_chat_creator_membership_invalid';
  end if;

  select *
    into v_source
  from ai_chat_conversations c
  where c.tenant_id = p_tenant_id
    and c.id = p_source_conversation_id
    and c.created_by_user_id = p_user_id;

  if not found then
    raise exception 'ai_chat_not_found';
  end if;

  if v_source.scope_type = 'general' then
    raise exception 'ai_chat_general_scope_risk_bridge_blocked';
  end if;

  if not exists (
    select 1
    from ai_chat_runs r
    where r.tenant_id = p_tenant_id
      and r.id = p_run_id
      and r.created_by_user_id = p_user_id
  ) then
    raise exception 'ai_chat_run_not_found';
  end if;

  select *
    into v_assessment
  from ai_chat_run_risk_assessments a
  where a.tenant_id = p_tenant_id
    and a.run_id = p_run_id
    and a.status = 'active'
  order by a.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'ai_chat_risk_assessment_missing';
  end if;

  if v_assessment.risk_level = 'red' then
    raise exception 'ai_chat_red_draft_blocked';
  end if;

  if v_assessment.risk_level not in ('green', 'yellow') then
    raise exception 'ai_chat_risk_assessment_missing';
  end if;

  select e.safe_draft
    into v_safe_draft
  from ai_chat_answer_envelopes e
  where e.tenant_id = p_tenant_id
    and e.run_id = p_run_id
  order by e.created_at desc
  limit 1;

  if coalesce(trim(v_safe_draft ->> 'body'), '') = '' then
    raise exception 'ai_chat_safe_draft_missing';
  end if;

  select *
    into v_destination
  from conversations c
  where c.tenant_id = p_tenant_id
    and c.id = p_destination_conversation_id
  for update;

  if not found
     or v_destination.client_id is distinct from v_assessment.client_id
     or not p85_stage_4b_actor_can_read_client(
       p_tenant_id,
       v_destination.client_id,
       p_user_id,
       p_dietitian_id,
       p_role
     ) then
    raise exception 'ai_chat_destination_client_mismatch';
  end if;

  if v_destination.revision <> p_destination_revision then
    raise exception 'ai_chat_destination_revision_conflict';
  end if;

  select *
    into v_client
  from clients cl
  where cl.tenant_id = p_tenant_id
    and cl.id = v_destination.client_id
  for update;

  if not found or v_client.context_revision <> p_client_context_revision then
    raise exception 'ai_chat_client_context_revision_conflict';
  end if;

  v_transfer_mode := case
    when v_assessment.risk_level = 'yellow' then 'yellow_review'
    else 'composer_pending'
  end;

  update ai_chat_draft_transfers
  set status = 'superseded',
      superseded_at = v_now,
      updated_at = v_now
  where tenant_id = p_tenant_id
    and destination_conversation_id = p_destination_conversation_id
    and status = 'pending';

  insert into ai_chat_draft_transfers (
    tenant_id,
    run_id,
    source_conversation_id,
    destination_conversation_id,
    destination_client_id,
    created_by_user_id,
    risk_level,
    review_origin,
    transfer_mode,
    draft_body,
    source_ref_ids,
    status,
    destination_revision,
    client_context_revision,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    p_run_id,
    p_source_conversation_id,
    p_destination_conversation_id,
    v_destination.client_id,
    p_user_id,
    v_assessment.risk_level,
    'ai_chat',
    v_transfer_mode,
    v_safe_draft ->> 'body',
    coalesce(v_assessment.source_ref_ids, '[]'::jsonb),
    'pending',
    v_destination.revision,
    v_client.context_revision,
    v_now,
    v_now
  )
  returning * into v_transfer;

  if v_transfer_mode = 'yellow_review' then
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
      action,
      blocked_reason,
      quality_issues,
      reasons,
      provider_status,
      send_status,
      created_at
    )
    values (
      v_decision_id,
      p_tenant_id,
      v_destination.id,
      v_client.id,
      v_client.ai_mode,
      v_client.ai_status,
      coalesce(v_client.selected_persona_id, 'balanced_coach'),
      'yellow',
      null,
      'draft_for_approval',
      null,
      '{}'::text[],
      array['ai_chat_yellow_transfer']::text[],
      'not_called',
      'draft_created',
      v_now
    );

    insert into messages (
      id,
      tenant_id,
      conversation_id,
      sender,
      body,
      origin,
      generated_by_ai_decision_id,
      risk,
      status,
      content_status,
      created_at
    )
    values (
      v_draft_message_id,
      p_tenant_id,
      v_destination.id,
      'assistant',
      v_safe_draft ->> 'body',
      'ai_generated',
      v_decision_id,
      'yellow',
      'draft',
      'available',
      v_now
    );

    update clients
    set ai_status = 'passive',
        ai_mode = 'paused',
        yellow_risk_hold = jsonb_build_object(
          'status', 'active',
          'startedAt', to_jsonb(v_now),
          'firstMessageId', v_draft_message_id::text,
          'latestMessageId', v_draft_message_id::text,
          'activeDraftMessageId', v_draft_message_id::text,
          'activeDecisionId', v_decision_id::text,
          'messageIds', jsonb_build_array(v_draft_message_id::text),
          'reasons', jsonb_build_array('ai_chat_yellow_transfer'),
          'previousAiStatus', v_client.ai_status::text,
          'previousAiMode', v_client.ai_mode::text,
          'blockedByRedHandoffId', null
        )
    where tenant_id = p_tenant_id
      and id = v_client.id;
  end if;

  return p85_stage_4c_draft_transfer_to_json(v_transfer);
end;
$$;

create or replace function p85_stage_4c_create_run_handoff_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_run_id uuid,
  p_conversation_id uuid,
  p_client_id uuid,
  p_confirmation_token text,
  p_expected_client_context_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment ai_chat_run_risk_assessments%rowtype;
  v_run ai_chat_runs%rowtype;
  v_client clients%rowtype;
  v_messaging_conversation_id uuid;
  v_existing_link ai_chat_handoff_links%rowtype;
  v_handoff_id uuid := gen_random_uuid();
  v_link ai_chat_handoff_links%rowtype;
  v_handoff handoff_cases%rowtype;
  v_fingerprint text;
  v_session_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_reasons text[];
  v_previous_ai_status text;
  v_previous_ai_mode text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if not p85_stage_4c_validate_creator_membership(p_tenant_id, p_user_id, p_dietitian_id) then
    raise exception 'ai_chat_creator_membership_invalid';
  end if;

  select *
    into v_run
  from ai_chat_runs r
  where r.tenant_id = p_tenant_id
    and r.id = p_run_id
    and r.created_by_user_id = p_user_id;

  if not found then
    raise exception 'ai_chat_run_not_found';
  end if;

  select *
    into v_assessment
  from ai_chat_run_risk_assessments a
  where a.tenant_id = p_tenant_id
    and a.run_id = p_run_id
    and a.status = 'active'
    and a.risk_level = 'red'
  order by a.created_at desc
  limit 1
  for update;

  if not found
     or coalesce(v_assessment.handoff_confirmation_token, '') <> coalesce(p_confirmation_token, '') then
    raise exception 'ai_chat_handoff_confirmation_invalid';
  end if;

  if v_assessment.client_id is distinct from p_client_id
     or v_assessment.conversation_id is distinct from p_conversation_id then
    raise exception 'ai_chat_handoff_confirmation_invalid';
  end if;

  select *
    into v_client
  from clients c
  where c.tenant_id = p_tenant_id
    and c.id = p_client_id
  for update;

  if not found or v_client.context_revision <> p_expected_client_context_revision then
    raise exception 'ai_chat_client_context_revision_conflict';
  end if;

  v_previous_ai_status := v_client.ai_status::text;
  v_previous_ai_mode := v_client.ai_mode::text;

  if not p85_stage_4c_resolve_client_access_v1(
    p_tenant_id,
    p_client_id,
    p_user_id,
    p_dietitian_id,
    p_role
  ) then
    raise exception 'ai_chat_not_found';
  end if;

  select c.id
    into v_messaging_conversation_id
  from conversations c
  where c.tenant_id = p_tenant_id
    and c.client_id = p_client_id
    and p85_stage_4b_actor_can_read_client(
      p_tenant_id,
      c.client_id,
      p_user_id,
      p_dietitian_id,
      p_role
    )
  order by c.revision desc, c.created_at desc
  limit 1;

  if v_messaging_conversation_id is null then
    raise exception 'ai_chat_destination_conversation_missing';
  end if;

  v_fingerprint := p85_stage_4c_build_red_notification_fingerprint(
    p_client_id,
    v_assessment.reasons,
    v_assessment.source_revision_digest
  );

  select *
    into v_existing_link
  from ai_chat_handoff_links l
  where l.tenant_id = p_tenant_id
    and l.confirmation_token = p_confirmation_token
    and l.status = 'active'
  limit 1;

  if found then
    if v_existing_link.fingerprint <> v_fingerprint
       or v_existing_link.run_id <> p_run_id
       or v_existing_link.client_id <> p_client_id
       or v_existing_link.conversation_id <> p_conversation_id then
      raise exception 'ai_chat_idempotency_conflict';
    end if;

    select *
      into v_handoff
    from handoff_cases h
    where h.tenant_id = p_tenant_id
      and h.id = v_existing_link.handoff_id;

    if not found then
      raise exception 'ai_chat_handoff_missing';
    end if;

    return jsonb_build_object(
      'handoff_id', v_handoff.id,
      'link', p85_stage_4c_handoff_link_to_json(v_existing_link),
      'client_context_revision', v_client.context_revision
    );
  end if;

  select *
    into v_existing_link
  from ai_chat_handoff_links l
  where l.tenant_id = p_tenant_id
      and l.fingerprint = v_fingerprint
      and l.status = 'active'
  limit 1;

  if found then
    return jsonb_build_object(
      'handoff_id', v_existing_link.handoff_id,
      'link', p85_stage_4c_handoff_link_to_json(v_existing_link),
      'client_context_revision', v_client.context_revision
    );
  end if;

  select coalesce(array_agg(value order by value), '{}'::text[])
    into v_reasons
  from jsonb_array_elements_text(coalesce(v_assessment.reasons, '[]'::jsonb)) as value;

  insert into handoff_cases (
    id,
    tenant_id,
    dietitian_id,
    client_id,
    conversation_id,
    triggering_message_id,
    source_ai_chat_run_id,
    risk,
    reasons,
    status,
    urgency,
    safe_acknowledgement,
    recommended_action,
    created_at
  )
  values (
    v_handoff_id,
    p_tenant_id,
    p_dietitian_id,
    p_client_id,
    v_messaging_conversation_id,
    null,
    p_run_id,
    'red',
    v_reasons,
    'open',
    'urgent',
    'Internal urgent handoff queued from AI Chat.',
    v_assessment.recommended_human_action,
    v_now
  )
  returning * into v_handoff;

  insert into ai_chat_handoff_links (
    tenant_id,
    run_id,
    conversation_id,
    client_id,
    created_by_user_id,
    handoff_id,
    fingerprint,
    confirmation_token,
    status,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    p_run_id,
    p_conversation_id,
    p_client_id,
    p_user_id,
    v_handoff_id,
    v_fingerprint,
    p_confirmation_token,
    'active',
    v_now,
    v_now
  )
  returning * into v_link;

  update clients
  set ai_status = 'passive',
      ai_mode = 'manual',
      human_takeover_locked = true,
      red_risk_lock = jsonb_build_object(
        'status', 'locked',
        'handoffId', v_handoff_id::text,
        'lockedAt', to_jsonb(v_now),
        'reasons', to_jsonb(v_reasons),
        'previousAiStatus', v_previous_ai_status,
        'previousAiMode', v_previous_ai_mode
      ),
      context_revision = v_client.context_revision + 1
  where tenant_id = p_tenant_id
    and id = p_client_id
  returning * into v_client;

  insert into human_control_sessions (
    id,
    tenant_id,
    client_id,
    conversation_id,
    reason,
    status,
    previous_ai_status,
    previous_ai_mode,
    linked_handoff_id,
    opened_at
  )
  values (
    v_session_id,
    p_tenant_id,
    p_client_id,
    v_messaging_conversation_id,
    'red_risk_lock',
    'active',
    v_previous_ai_status,
    v_previous_ai_mode,
    v_handoff_id,
    v_now
  );

  return jsonb_build_object(
    'handoff_id', v_handoff.id,
    'link', p85_stage_4c_handoff_link_to_json(v_link),
    'client_context_revision', v_client.context_revision
  );
end;
$$;

create or replace function p85_stage_4c_get_pending_composer_draft_transfer_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_destination_conversation_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_transfer ai_chat_draft_transfers%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_transfer
  from ai_chat_draft_transfers t
  where t.tenant_id = p_tenant_id
    and t.destination_conversation_id = p_destination_conversation_id
    and t.created_by_user_id = p_user_id
    and t.status = 'pending'
    and t.transfer_mode = 'composer_pending'
  order by t.created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return p85_stage_4c_draft_transfer_to_json(v_transfer);
end;
$$;

create or replace function p85_stage_4c_consume_composer_draft_transfer_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_transfer_id uuid,
  p_destination_conversation_id uuid,
  p_destination_client_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer ai_chat_draft_transfers%rowtype;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_transfer
  from ai_chat_draft_transfers t
  where t.tenant_id = p_tenant_id
    and t.id = p_transfer_id
  for update;

  if not found
     or v_transfer.status <> 'pending'
     or v_transfer.transfer_mode <> 'composer_pending'
     or v_transfer.created_by_user_id <> p_user_id then
    raise exception 'ai_chat_draft_transfer_unavailable';
  end if;

  if v_transfer.destination_conversation_id <> p_destination_conversation_id
     or v_transfer.destination_client_id <> p_destination_client_id then
    raise exception 'ai_chat_destination_client_mismatch';
  end if;

  update ai_chat_draft_transfers
  set status = 'consumed',
      consumed_at = v_now,
      updated_at = v_now
  where tenant_id = p_tenant_id
    and id = p_transfer_id
  returning * into v_transfer;

  return p85_stage_4c_draft_transfer_to_json(v_transfer);
end;
$$;

revoke all on function p85_stage_4c_build_source_revision_digest(text, jsonb) from public, anon, authenticated;
revoke all on function p85_stage_4c_build_red_notification_fingerprint(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_build_client_revision_token(uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function p85_stage_4c_risk_assessment_to_json(ai_chat_run_risk_assessments, jsonb) from public, anon, authenticated;
revoke all on function p85_stage_4c_draft_transfer_to_json(ai_chat_draft_transfers) from public, anon, authenticated;
revoke all on function p85_stage_4c_handoff_link_to_json(ai_chat_handoff_links) from public, anon, authenticated;
revoke all on function p85_stage_4c_apply_run_risk_pipeline_v1(uuid, uuid, uuid, text, uuid, text, text, text, text, jsonb, jsonb, text, text, boolean, jsonb, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_get_run_risk_summary_v1(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_list_run_draft_destinations_v1(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_transfer_run_draft_v1(uuid, uuid, uuid, text, uuid, uuid, uuid, integer, integer) from public, anon, authenticated;
revoke all on function p85_stage_4c_create_run_handoff_v1(uuid, uuid, uuid, text, uuid, uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function p85_stage_4c_get_pending_composer_draft_transfer_v1(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_consume_composer_draft_transfer_v1(uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function p85_stage_4c_build_source_revision_digest(text, jsonb) to service_role;
grant execute on function p85_stage_4c_build_red_notification_fingerprint(uuid, jsonb, text) to service_role;
grant execute on function p85_stage_4c_build_client_revision_token(uuid, uuid, bigint) to service_role;
grant execute on function p85_stage_4c_risk_assessment_to_json(ai_chat_run_risk_assessments, jsonb) to service_role;
grant execute on function p85_stage_4c_draft_transfer_to_json(ai_chat_draft_transfers) to service_role;
grant execute on function p85_stage_4c_handoff_link_to_json(ai_chat_handoff_links) to service_role;
grant execute on function p85_stage_4c_apply_run_risk_pipeline_v1(uuid, uuid, uuid, text, uuid, text, text, text, text, jsonb, jsonb, text, text, boolean, jsonb, text) to service_role;
grant execute on function p85_stage_4c_get_run_risk_summary_v1(uuid, uuid, uuid, text, uuid) to service_role;
grant execute on function p85_stage_4c_list_run_draft_destinations_v1(uuid, uuid, uuid, text, uuid) to service_role;
grant execute on function p85_stage_4c_transfer_run_draft_v1(uuid, uuid, uuid, text, uuid, uuid, uuid, integer, integer) to service_role;
grant execute on function p85_stage_4c_create_run_handoff_v1(uuid, uuid, uuid, text, uuid, uuid, uuid, text, integer) to service_role;
grant execute on function p85_stage_4c_get_pending_composer_draft_transfer_v1(uuid, uuid, uuid) to service_role;
grant execute on function p85_stage_4c_consume_composer_draft_transfer_v1(uuid, uuid, uuid, uuid, uuid) to service_role;
