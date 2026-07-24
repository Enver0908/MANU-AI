-- Phase 85 Stage 4C remediation Faz 3: explicit bounded context-tool branches and fail-closed envelopes.

create or replace function p85_stage_4c_wrap_context_tool_result(
  p_rows jsonb,
  p_tool_name text,
  p_status text default null,
  p_error_code text default null,
  p_failure_code text default null
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_status text;
  v_row_count integer := coalesce(jsonb_array_length(p_rows), 0);
begin
  if p_status is not null then
    v_status := p_status;
  elsif p_error_code is not null then
    v_status := 'failed';
  elsif v_row_count = 0 then
    v_status := 'empty';
  else
    v_status := 'ok';
  end if;

  return jsonb_build_object(
    'status', v_status,
    'ok', v_status = 'ok',
    'rows', coalesce(p_rows, '[]'::jsonb),
    'error_code', p_error_code,
    'failure_code', p_failure_code,
    'category_failed', v_status = 'failed',
    'category_critical', p_tool_name = 'load_client_risk_timeline'
  );
end;
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
  v_limit integer := greatest(1, least(coalesce((p_args->>'limit')::integer, 5), 20));
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

  if p_tool_name <> 'search_approved_sources' and p_client_id is null then
    return p85_stage_4c_wrap_context_tool_result(
      '[]'::jsonb,
      p_tool_name,
      'failed',
      'context_tool_client_required',
      'client_required'
    );
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

  elsif p_tool_name = 'load_client_active_form' then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_rows
    from (
      select
        format('form:%s:%s', cfr.id, cfr.schema_version) as source_id,
        cfr.client_id,
        'client_record'::text as source_type,
        'client_form_responses.active'::text as locator,
        left(
          coalesce(
            nullif(cfs.title || ': ', ''),
            ''
          ) || coalesce(cfr.answers::text, ''),
          1200
        ) as excerpt,
        null::text as content_hash,
        cfr.updated_at::date as source_date,
        cfr.updated_at,
        cfr.updated_at as occurred_at,
        'current'::text as lifecycle_status,
        true as retrieval_eligible,
        3 as authority_weight
      from client_form_responses cfr
      join client_form_schemas cfs
        on cfs.id = cfr.schema_id
       and cfs.tenant_id = cfr.tenant_id
      where cfr.tenant_id = p_tenant_id
        and cfr.client_id = p_client_id
        and cfs.status = 'published'
      order by cfr.updated_at desc
      limit 10
    ) t;

  elsif p_tool_name = 'load_client_food_rule_profile' then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_rows
    from (
      select
        format('food:%s:%s', fp.id, fp.revision) as source_id,
        fp.client_id,
        'client_record'::text as source_type,
        'client_food_rule_profiles'::text as locator,
        left(
          coalesce(
            nullif(fp.notes, ''),
            nullif(fp.profile_data::text, ''),
            ''
          ),
          1200
        ) as excerpt,
        nullif(fp.catalog_record_set_sha256, '') as content_hash,
        coalesce(fp.published_at, fp.updated_at)::date as source_date,
        fp.updated_at,
        coalesce(fp.published_at, fp.updated_at) as occurred_at,
        case when fp.status = 'draft' then 'draft' else 'current' end as lifecycle_status,
        (fp.status = 'published') as retrieval_eligible,
        3 as authority_weight
      from client_food_rule_profiles fp
      where fp.tenant_id = p_tenant_id
        and fp.client_id = p_client_id
        and fp.status = 'published'
      order by fp.updated_at desc
      limit 5
    ) t;

  elsif p_tool_name = 'load_client_menu_plans' then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_rows
    from (
      select
        format('menu:%s:%s', mp.id, mp.revision) as source_id,
        mp.client_id,
        'client_record'::text as source_type,
        'client_menu_plans.active'::text as locator,
        left(
          coalesce(
            nullif(mp.title, ''),
            nullif(mp.plan_data::text, ''),
            ''
          ),
          1200
        ) as excerpt,
        nullif(mp.catalog_record_set_sha256, '') as content_hash,
        coalesce(mp.effective_date, mp.updated_at::date) as source_date,
        mp.updated_at,
        coalesce(mp.activated_at, mp.updated_at) as occurred_at,
        case when mp.status = 'archived' then 'superseded' else 'current' end as lifecycle_status,
        (mp.status = 'active') as retrieval_eligible,
        3 as authority_weight
      from client_menu_plans mp
      where mp.tenant_id = p_tenant_id
        and mp.client_id = p_client_id
        and mp.status = 'active'
      order by coalesce(mp.activated_at, mp.updated_at) desc
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
        ccu.created_at as updated_at,
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

  elsif p_tool_name = 'load_client_recent_messages' then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_rows
    from (
      select
        m.id::text as source_id,
        cv.client_id,
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
      join conversations cv
        on cv.id = m.conversation_id
       and cv.tenant_id = m.tenant_id
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
        coalesce(atr.updated_at, atr.created_at)::date as source_date,
        atr.updated_at,
        coalesce(atr.updated_at, atr.created_at) as occurred_at,
        'current'::text as lifecycle_status,
        (
          atr.status = 'accepted'
          and coalesce(atr.retrieval_eligible, false) = true
        ) as retrieval_eligible,
        2 as authority_weight
      from audio_transcription_records atr
      where atr.tenant_id = p_tenant_id
        and atr.client_id = p_client_id
        and atr.status = 'accepted'
        and coalesce(atr.retrieval_eligible, false) = true
      order by coalesce(atr.updated_at, atr.created_at) desc nulls last
      limit 20
    ) t;

  elsif p_tool_name = 'load_client_risk_timeline' then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_rows
    from (
      select *
      from (
        select
          format('risk:assessment:%s', ra.id) as source_id,
          cv.client_id,
          'client_record'::text as source_type,
          'risk_assessments'::text as locator,
          left(
            format(
              'Risk %s: %s',
              ra.level::text,
              array_to_string(ra.reasons, '; ')
            ),
            1200
          ) as excerpt,
          null::text as content_hash,
          ra.created_at::date as source_date,
          ra.created_at as updated_at,
          ra.created_at as occurred_at,
          'current'::text as lifecycle_status,
          true as retrieval_eligible,
          3 as authority_weight
        from risk_assessments ra
        join conversations cv
          on cv.id = ra.conversation_id
         and cv.tenant_id = ra.tenant_id
        where ra.tenant_id = p_tenant_id
          and cv.client_id = p_client_id

        union all

        select
          format('risk:event:%s', rae.id) as source_id,
          rae.client_id,
          'client_record'::text as source_type,
          'risk_activity_events'::text as locator,
          left(
            format(
              'Risk event %s%s',
              rae.event_type,
              case
                when coalesce(rae.metadata, '{}'::jsonb) = '{}'::jsonb then ''
                else ': ' || left(rae.metadata::text, 800)
              end
            ),
            1200
          ) as excerpt,
          null::text as content_hash,
          rae.created_at::date as source_date,
          rae.created_at as updated_at,
          rae.created_at as occurred_at,
          'current'::text as lifecycle_status,
          true as retrieval_eligible,
          3 as authority_weight
        from risk_activity_events rae
        where rae.tenant_id = p_tenant_id
          and rae.client_id = p_client_id
      ) timeline
      order by occurred_at desc nulls last
      limit 50
    ) t;

  elsif p_tool_name = 'load_client_handoffs' then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_rows
    from (
      select
        format('handoff:%s', h.id) as source_id,
        h.client_id,
        'client_record'::text as source_type,
        'handoff_cases'::text as locator,
        left(
          coalesce(
            nullif(h.recommended_action, ''),
            nullif(h.safe_acknowledgement, ''),
            array_to_string(h.reasons, '; '),
            ''
          ),
          1200
        ) as excerpt,
        null::text as content_hash,
        h.created_at::date as source_date,
        h.created_at as updated_at,
        h.created_at as occurred_at,
        case
          when h.status in ('resolved', 'dismissed') then 'superseded'
          else 'current'
        end as lifecycle_status,
        (h.status in ('open', 'assigned')) as retrieval_eligible,
        3 as authority_weight
      from handoff_cases h
      where h.tenant_id = p_tenant_id
        and h.client_id = p_client_id
      order by h.created_at desc
      limit 30
    ) t;

  elsif p_tool_name = 'load_client_ai_decisions' then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_rows
    from (
      select
        format('decision:%s', d.id) as source_id,
        d.client_id,
        'client_record'::text as source_type,
        'ai_decisions'::text as locator,
        left(
          coalesce(
            nullif(d.blocked_reason, ''),
            format('%s / %s', d.action, d.send_status),
            array_to_string(d.reasons, '; '),
            ''
          ),
          1200
        ) as excerpt,
        null::text as content_hash,
        d.created_at::date as source_date,
        d.created_at as updated_at,
        d.created_at as occurred_at,
        'current'::text as lifecycle_status,
        true as retrieval_eligible,
        2 as authority_weight
      from ai_decisions d
      where d.tenant_id = p_tenant_id
        and d.client_id = p_client_id
      order by d.created_at desc
      limit 50
    ) t;

  elsif p_tool_name = 'load_client_record_assets' then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_rows
    from (
      select *
      from (
        select
          format('asset:%s', ma.id) as source_id,
          ma.client_id,
          'client_record'::text as source_type,
          'media_assets'::text as locator,
          left(
            trim(
              coalesce(ma.media_kind, 'image') || ' ' ||
              coalesce(ma.declared_mime_type, '') || ' ' ||
              coalesce(ma.detected_mime_type, '')
            ),
            1200
          ) as excerpt,
          nullif(ma.content_sha256, '') as content_hash,
          coalesce(ma.stored_at, ma.created_at)::date as source_date,
          ma.updated_at,
          coalesce(ma.stored_at, ma.created_at) as occurred_at,
          case
            when ma.status in ('expired', 'revoked', 'deletion_pending') then 'superseded'
            else 'current'
          end as lifecycle_status,
          (
            ma.deleted_at is null
            and ma.status in ('sanitized', 'analysis_ready')
            and (ma.expires_at is null or ma.expires_at > now())
          ) as retrieval_eligible,
          2 as authority_weight
        from media_assets ma
        where ma.tenant_id = p_tenant_id
          and ma.client_id = p_client_id
          and ma.deleted_at is null

        union all

        select
          format('asset:visual:%s', va.id) as source_id,
          va.client_id,
          'client_record'::text as source_type,
          'media_assets.visual'::text as locator,
          left(coalesce(va.observation::text, ''), 1200) as excerpt,
          null::text as content_hash,
          va.created_at::date as source_date,
          va.updated_at,
          va.created_at as occurred_at,
          case when va.status = 'superseded' then 'superseded' else 'current' end as lifecycle_status,
          (va.status = 'ready') as retrieval_eligible,
          2 as authority_weight
        from visual_analysis_records va
        where va.tenant_id = p_tenant_id
          and va.client_id = p_client_id
          and va.status <> 'superseded'
      ) assets
      order by occurred_at desc nulls last
      limit 40
    ) t;

  elsif p_tool_name = 'search_approved_sources' then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    into v_rows
    from (
      select
        source_ref_id::text as source_id,
        null::uuid as client_id,
        source_type,
        locator,
        excerpt,
        content_hash,
        nullif(source_date, '')::date as source_date,
        now() as updated_at,
        now() as occurred_at,
        'current'::text as lifecycle_status,
        true as retrieval_eligible,
        2 as authority_weight
      from p85_stage_4c_search_approved_sources_v1(v_query, v_limit)
    ) t;

  else
    raise exception 'context_tool_branch_missing';
  end if;

  return p85_stage_4c_wrap_context_tool_result(v_rows, p_tool_name);

exception
  when others then
    return p85_stage_4c_wrap_context_tool_result(
      '[]'::jsonb,
      p_tool_name,
      'failed',
      'context_tool_failed',
      SQLSTATE
    );
end;
$$;

revoke all on function p85_stage_4c_wrap_context_tool_result(jsonb, text, text, text, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_execute_context_tool_v1(uuid, uuid, text, jsonb) from public, anon, authenticated;

grant execute on function p85_stage_4c_wrap_context_tool_result(jsonb, text, text, text, text) to service_role;
grant execute on function p85_stage_4c_execute_context_tool_v1(uuid, uuid, text, jsonb) to service_role;
