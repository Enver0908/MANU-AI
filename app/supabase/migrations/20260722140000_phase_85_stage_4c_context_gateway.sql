-- Phase 85 Stage 4C Faz 6: bounded client context gateway RPCs.

create or replace function p85_stage_4c_forbidden_context_tool_args(p_args jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(p_args ?| array[
    'tenant_id', 'tenantId', 'client_id', 'clientId', 'dietitian_id', 'dietitianId'
  ], false);
$$;

create or replace function p85_stage_4c_get_context_gateway_access_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_scope_type text,
  p_client_id uuid,
  p_conversation_revision integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_authorized boolean := false;
  v_revision_token text := '';
  v_checked_at timestamptz := now();
  v_context_revision bigint := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_scope_type = 'general' then
    v_authorized := true;
    v_revision_token := format('conversation:%s', coalesce(p_conversation_revision, 0));
    return jsonb_build_object(
      'authorized', v_authorized,
      'client_id', null,
      'revision_token', v_revision_token,
      'checked_at', v_checked_at
    );
  end if;

  if p_client_id is null then
    return jsonb_build_object(
      'authorized', false,
      'client_id', null,
      'revision_token', '',
      'checked_at', v_checked_at
    );
  end if;

  v_authorized := p85_stage_4c_resolve_client_access_v1(
    p_tenant_id,
    p_client_id,
    p_user_id,
    p_dietitian_id,
    p_role
  );

  if v_authorized then
    select c.context_revision
    into v_context_revision
    from clients c
    where c.tenant_id = p_tenant_id
      and c.id = p_client_id;

    v_revision_token := format(
      'client:%s:%s:conversation:%s',
      p_client_id,
      coalesce(v_context_revision, 0),
      coalesce(p_conversation_revision, 0)
    );
  end if;

  return jsonb_build_object(
    'authorized', v_authorized,
    'client_id', p_client_id,
    'revision_token', v_revision_token,
    'checked_at', v_checked_at
  );
end;
$$;

create or replace function p85_stage_4c_list_context_gateway_clients_v1(
  p_tenant_id uuid
)
returns table (
  id uuid,
  full_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.full_name
  from clients c
  where c.tenant_id = p_tenant_id
    and c.lifecycle_status = 'active'
  order by c.full_name asc
  limit 50;
$$;

create or replace function p85_stage_4c_execute_context_tool_v1(
  p_tenant_id uuid,
  p_client_id uuid,
  p_tool_name text,
  p_args jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_query text := left(trim(coalesce(p_args->>'query', '')), 120);
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p85_stage_4c_forbidden_context_tool_args(coalesce(p_args, '{}'::jsonb)) then
    raise exception 'forbidden_tool_arg';
  end if;

  if p_tool_name not in (
    'load_client_profile',
    'load_client_active_form',
    'load_client_food_rule_profile',
    'load_client_menu_plans',
    'load_client_context_updates',
    'load_client_recent_messages',
    'search_client_messages',
    'load_client_accepted_transcripts',
    'load_client_risk_timeline',
    'load_client_handoffs',
    'load_client_ai_decisions',
    'load_client_record_assets',
    'search_approved_sources'
  ) then
    raise exception 'context_tool_not_allowed';
  end if;

  if p_tool_name = 'load_client_profile' then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_rows
    from (
      select
        format('profile:%s', c.id) as source_id,
        c.id as client_id,
        'client_record'::text as source_type,
        'clients.profile'::text as locator,
        left(coalesce(c.full_name, ''), 1200) as excerpt,
        null::text as content_hash,
        null::date as source_date,
        c.updated_at,
        c.updated_at as occurred_at,
        'current'::text as lifecycle_status,
        true as retrieval_eligible,
        3 as authority_weight
      from clients c
      where c.tenant_id = p_tenant_id
        and c.id = p_client_id
        and c.lifecycle_status = 'active'
      limit 1
    ) t;
  elsif p_tool_name = 'load_client_recent_messages' then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_rows
    from (
      select
        m.id::text as source_id,
        m.client_id,
        'client_record'::text as source_type,
        'messages.recent'::text as locator,
        left(coalesce(m.body, ''), 1200) as excerpt,
        null::text as content_hash,
        m.provider_sent_at::date as source_date,
        m.updated_at,
        coalesce(m.provider_sent_at, m.created_at) as occurred_at,
        'current'::text as lifecycle_status,
        (coalesce(m.retrieval_eligibility, 'eligible') = 'eligible') as retrieval_eligible,
        2 as authority_weight
      from messages m
      join conversations cv on cv.id = m.conversation_id and cv.tenant_id = m.tenant_id
      where m.tenant_id = p_tenant_id
        and cv.client_id = p_client_id
        and coalesce(m.retrieval_eligibility, 'eligible') = 'eligible'
        and coalesce(m.content_status, 'available') in ('available', 'edited')
        and coalesce(m.status, 'stored') not in ('draft', 'blocked')
        and m.origin <> 'imported_unknown'
      order by coalesce(m.provider_sent_at, m.created_at) desc
      limit 30
    ) t;
  elsif p_tool_name = 'search_client_messages' then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_rows
    from (
      select
        s.id::text as source_id,
        p_client_id as client_id,
        'client_record'::text as source_type,
        'messages.search'::text as locator,
        left(coalesce(s.body, ''), 1200) as excerpt,
        null::text as content_hash,
        s.provider_sent_at::date as source_date,
        s.created_at as updated_at,
        coalesce(s.provider_sent_at, s.created_at) as occurred_at,
        'current'::text as lifecycle_status,
        true as retrieval_eligible,
        2 as authority_weight
      from search_conversation_messages(
        p_tenant_id,
        (
          select cv.id
          from conversations cv
          where cv.tenant_id = p_tenant_id
            and cv.client_id = p_client_id
          order by cv.updated_at desc
          limit 1
        ),
        v_query,
        20
      ) s
      limit 20
    ) t;
  elsif p_tool_name = 'load_client_context_updates' then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_rows
    from (
      select
        ccu.id::text as source_id,
        ccu.client_id,
        'client_record'::text as source_type,
        'client_context_updates'::text as locator,
        left(coalesce(ccu.summary, ccu.title, ''), 1200) as excerpt,
        null::text as content_hash,
        ccu.occurred_at::date as source_date,
        ccu.updated_at,
        coalesce(ccu.occurred_at, ccu.created_at) as occurred_at,
        case when ccu.status = 'superseded' then 'superseded' else 'current' end as lifecycle_status,
        (coalesce(ccu.status, 'active') = 'active') as retrieval_eligible,
        2 as authority_weight
      from client_context_updates ccu
      where ccu.tenant_id = p_tenant_id
        and ccu.client_id = p_client_id
        and coalesce(ccu.status, 'active') = 'active'
      order by coalesce(ccu.occurred_at, ccu.created_at) desc
      limit 50
    ) t;
  elsif p_tool_name = 'load_client_accepted_transcripts' then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_rows
    from (
      select
        atr.id::text as source_id,
        atr.client_id,
        'client_record'::text as source_type,
        'audio_transcription_records.accepted'::text as locator,
        left(coalesce(atr.transcript_text, ''), 1200) as excerpt,
        null::text as content_hash,
        atr.accepted_at::date as source_date,
        atr.updated_at,
        atr.accepted_at as occurred_at,
        'current'::text as lifecycle_status,
        (atr.status = 'accepted') as retrieval_eligible,
        2 as authority_weight
      from audio_transcription_records atr
      where atr.tenant_id = p_tenant_id
        and atr.client_id = p_client_id
        and atr.status = 'accepted'
      order by atr.accepted_at desc nulls last
      limit 20
    ) t;
  else
    v_rows := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'ok', true,
    'rows', v_rows,
    'category_failed', false,
    'category_critical', p_tool_name = 'load_client_risk_timeline'
  );
end;
$$;

create or replace function p85_stage_4c_save_context_snapshot_v1(
  p_tenant_id uuid,
  p_run_id uuid,
  p_conversation_id uuid,
  p_created_by_user_id uuid,
  p_source_identity_refs jsonb,
  p_freshness_metadata jsonb,
  p_evidence_excerpts jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  insert into ai_chat_context_snapshots (
    tenant_id,
    run_id,
    conversation_id,
    created_by_user_id,
    source_identity_refs,
    freshness_metadata,
    evidence_excerpts
  ) values (
    p_tenant_id,
    p_run_id,
    p_conversation_id,
    p_created_by_user_id,
    coalesce(p_source_identity_refs, '[]'::jsonb),
    coalesce(p_freshness_metadata, '{}'::jsonb),
    coalesce(p_evidence_excerpts, '[]'::jsonb)
  );
end;
$$;

revoke all on function p85_stage_4c_forbidden_context_tool_args(jsonb) from public, anon, authenticated;
revoke all on function p85_stage_4c_get_context_gateway_access_v1(uuid, uuid, uuid, text, text, uuid, integer) from public, anon, authenticated;
revoke all on function p85_stage_4c_list_context_gateway_clients_v1(uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_execute_context_tool_v1(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function p85_stage_4c_save_context_snapshot_v1(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;

grant execute on function p85_stage_4c_get_context_gateway_access_v1(uuid, uuid, uuid, text, text, uuid, integer) to service_role;
grant execute on function p85_stage_4c_list_context_gateway_clients_v1(uuid) to service_role;
grant execute on function p85_stage_4c_execute_context_tool_v1(uuid, uuid, text, jsonb) to service_role;
grant execute on function p85_stage_4c_save_context_snapshot_v1(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb) to service_role;
