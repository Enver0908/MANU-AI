-- Phase 85 Stage 4C Faz 7: approved source registry, answer envelopes, and source API support.

create table if not exists ai_chat_approved_sources (
  id uuid primary key default gen_random_uuid(),
  external_source_id text not null,
  title text not null,
  publisher text not null,
  source_url text not null,
  publication_date text,
  version_label text not null,
  jurisdiction text not null default 'Turkiye',
  approval_status text not null default 'approved',
  effective_at timestamptz not null default now(),
  retired_at timestamptz,
  review_due_at timestamptz,
  source_hash text not null,
  created_at timestamptz not null default now(),
  constraint ai_chat_approved_sources_status_check check (
    approval_status in ('approved', 'review_required', 'retired')
  )
);

create unique index if not exists ai_chat_approved_sources_external_hash_uidx
  on ai_chat_approved_sources (external_source_id, source_hash);

create index if not exists ai_chat_approved_sources_status_idx
  on ai_chat_approved_sources (approval_status, retired_at, review_due_at);

create table if not exists ai_chat_approved_source_chunks (
  id uuid primary key default gen_random_uuid(),
  approved_source_id uuid not null references ai_chat_approved_sources(id) on delete cascade,
  page integer,
  section text,
  locator text not null,
  excerpt text not null,
  content_hash text not null,
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(section, '') || ' ' || coalesce(excerpt, ''))
  ) stored,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_approved_source_chunks_source_idx
  on ai_chat_approved_source_chunks (approved_source_id, locator);

create index if not exists ai_chat_approved_source_chunks_search_idx
  on ai_chat_approved_source_chunks using gin (search_vector);

create table if not exists ai_chat_answer_envelopes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  run_id uuid not null,
  conversation_id uuid not null,
  created_by_user_id uuid not null,
  direct_answer text,
  answerability text not null,
  risk_level text,
  claims jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_chat_answer_envelopes_answerability_check check (
    answerability in ('answerable', 'partial', 'insufficient', 'conflicting', 'not_authorized')
  )
);

alter table ai_chat_answer_envelopes
  add constraint ai_chat_answer_envelopes_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_answer_envelopes
  add constraint ai_chat_answer_envelopes_run_tenant_fk
  foreign key (tenant_id, run_id) references ai_chat_runs (tenant_id, id) on delete cascade;

create index if not exists ai_chat_answer_envelopes_run_idx
  on ai_chat_answer_envelopes (tenant_id, run_id);

create or replace function p85_stage_4c_import_approved_source_v1(
  p_external_source_id text,
  p_title text,
  p_publisher text,
  p_source_url text,
  p_publication_date text,
  p_version_label text,
  p_jurisdiction text,
  p_approval_status text,
  p_source_hash text,
  p_review_due_at timestamptz,
  p_chunks jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_source_id uuid;
  v_chunk jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select s.id
  into v_existing
  from ai_chat_approved_sources s
  where s.external_source_id = p_external_source_id
    and s.source_hash = p_source_hash
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into ai_chat_approved_sources (
    external_source_id,
    title,
    publisher,
    source_url,
    publication_date,
    version_label,
    jurisdiction,
    approval_status,
    review_due_at,
    source_hash
  ) values (
    p_external_source_id,
    p_title,
    p_publisher,
    p_source_url,
    p_publication_date,
    p_version_label,
    coalesce(p_jurisdiction, 'Turkiye'),
    coalesce(p_approval_status, 'approved'),
    p_review_due_at,
    p_source_hash
  )
  returning id into v_source_id;

  for v_chunk in select * from jsonb_array_elements(coalesce(p_chunks, '[]'::jsonb))
  loop
    insert into ai_chat_approved_source_chunks (
      approved_source_id,
      page,
      section,
      locator,
      excerpt,
      content_hash
    ) values (
      v_source_id,
      nullif(v_chunk->>'page', '')::integer,
      nullif(v_chunk->>'section', ''),
      coalesce(v_chunk->>'locator', 'unknown'),
      coalesce(v_chunk->>'excerpt', ''),
      coalesce(v_chunk->>'content_hash', '')
    );
  end loop;

  return v_source_id;
end;
$$;

create or replace function p85_stage_4c_search_approved_sources_v1(
  p_query text,
  p_limit integer default 5
)
returns table (
  source_ref_id uuid,
  source_type text,
  canonical_entity_id uuid,
  locator text,
  excerpt text,
  title text,
  publisher text,
  source_url text,
  source_date text,
  content_hash text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as source_ref_id,
    'approved_clinical_source'::text as source_type,
    s.id as canonical_entity_id,
    c.locator,
    left(c.excerpt, 1200) as excerpt,
    s.title,
    s.publisher,
    s.source_url,
    s.publication_date as source_date,
    c.content_hash
  from ai_chat_approved_source_chunks c
  join ai_chat_approved_sources s on s.id = c.approved_source_id
  where s.approval_status = 'approved'
    and s.retired_at is null
    and (s.review_due_at is null or s.review_due_at >= now())
    and (
      coalesce(p_query, '') = ''
      or c.search_vector @@ plainto_tsquery('simple', left(coalesce(p_query, ''), 120))
    )
  order by ts_rank(c.search_vector, plainto_tsquery('simple', left(coalesce(p_query, ''), 120))) desc nulls last
  limit greatest(1, least(coalesce(p_limit, 5), 20));
$$;

create or replace function p85_stage_4c_persist_run_source_refs_v1(
  p_tenant_id uuid,
  p_run_id uuid,
  p_conversation_id uuid,
  p_created_by_user_id uuid,
  p_client_id uuid,
  p_source_refs jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  for v_ref in select * from jsonb_array_elements(coalesce(p_source_refs, '[]'::jsonb))
  loop
    insert into ai_chat_source_refs (
      id,
      tenant_id,
      run_id,
      conversation_id,
      created_by_user_id,
      source_type,
      canonical_entity_id,
      locator,
      source_date,
      content_hash,
      claim_id,
      client_id
    ) values (
      coalesce(nullif(v_ref->>'sourceRefId', '')::uuid, gen_random_uuid()),
      p_tenant_id,
      p_run_id,
      p_conversation_id,
      p_created_by_user_id,
      coalesce(v_ref->>'sourceType', 'client_record'),
      coalesce(v_ref->>'canonicalEntityId', 'unknown'),
      nullif(v_ref->>'locator', ''),
      nullif(v_ref->>'sourceDate', '')::date,
      nullif(v_ref->>'contentHash', ''),
      nullif(v_ref->>'claimId', '')::uuid,
      p_client_id
    )
    on conflict (tenant_id, id) do nothing;
  end loop;
end;
$$;

create or replace function p85_stage_4c_save_answer_envelope_v1(
  p_tenant_id uuid,
  p_run_id uuid,
  p_conversation_id uuid,
  p_created_by_user_id uuid,
  p_direct_answer text,
  p_answerability text,
  p_risk_level text,
  p_claims jsonb
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

  insert into ai_chat_answer_envelopes (
    tenant_id,
    run_id,
    conversation_id,
    created_by_user_id,
    direct_answer,
    answerability,
    risk_level,
    claims
  ) values (
    p_tenant_id,
    p_run_id,
    p_conversation_id,
    p_created_by_user_id,
    p_direct_answer,
    p_answerability,
    p_risk_level,
    coalesce(p_claims, '[]'::jsonb)
  );
end;
$$;

create or replace function p85_stage_4c_list_run_sources_v1(
  p_tenant_id uuid,
  p_run_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_run ai_chat_runs%rowtype;
  v_envelope ai_chat_answer_envelopes%rowtype;
  v_sources jsonb := '[]'::jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
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
  into v_envelope
  from ai_chat_answer_envelopes e
  where e.tenant_id = p_tenant_id
    and e.run_id = p_run_id
  order by e.created_at desc
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'sourceRefId', sr.id,
    'sourceType', sr.source_type,
    'title', coalesce(s.title, sr.canonical_entity_id),
    'publisher', s.publisher,
    'sourceUrl', s.source_url,
    'locator', sr.locator,
    'sourceDate', sr.source_date,
    'excerpt', left(coalesce(c.excerpt, ''), 1200),
    'dateLabel', case when sr.source_date is null then 'date_unknown' else null end
  )), '[]'::jsonb)
  into v_sources
  from ai_chat_source_refs sr
  left join ai_chat_approved_source_chunks c
    on sr.source_type = 'approved_clinical_source'
   and c.id::text = sr.canonical_entity_id
  left join ai_chat_approved_sources s
    on s.id = c.approved_source_id
  where sr.tenant_id = p_tenant_id
    and sr.run_id = p_run_id;

  return jsonb_build_object(
    'runId', p_run_id,
    'claims', coalesce(v_envelope.claims, '[]'::jsonb),
    'sources', v_sources
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

alter table ai_chat_approved_sources enable row level security;
alter table ai_chat_approved_source_chunks enable row level security;
alter table ai_chat_answer_envelopes enable row level security;

drop policy if exists "p85 stage4c approved sources read authenticated" on ai_chat_approved_sources;
create policy "p85 stage4c approved sources read authenticated"
on ai_chat_approved_sources for select
to authenticated
using (approval_status = 'approved' and retired_at is null);

drop policy if exists "p85 stage4c approved sources deny mutation" on ai_chat_approved_sources;
create policy "p85 stage4c approved sources deny mutation"
on ai_chat_approved_sources for all
to authenticated
using (false)
with check (false);

drop policy if exists "p85 stage4c approved source chunks read authenticated" on ai_chat_approved_source_chunks;
create policy "p85 stage4c approved source chunks read authenticated"
on ai_chat_approved_source_chunks for select
to authenticated
using (
  exists (
    select 1
    from ai_chat_approved_sources s
    where s.id = ai_chat_approved_source_chunks.approved_source_id
      and s.approval_status = 'approved'
      and s.retired_at is null
  )
);

drop policy if exists "p85 stage4c approved source chunks deny mutation" on ai_chat_approved_source_chunks;
create policy "p85 stage4c approved source chunks deny mutation"
on ai_chat_approved_source_chunks for all
to authenticated
using (false)
with check (false);

drop policy if exists "p85 stage4c answer envelopes creator read" on ai_chat_answer_envelopes;
create policy "p85 stage4c answer envelopes creator read"
on ai_chat_answer_envelopes for select
to authenticated
using (created_by_user_id = auth.uid());

drop policy if exists "p85 stage4c answer envelopes deny mutation" on ai_chat_answer_envelopes;
create policy "p85 stage4c answer envelopes deny mutation"
on ai_chat_answer_envelopes for all
to authenticated
using (false)
with check (false);

revoke all on table ai_chat_approved_sources from public, anon;
revoke all on table ai_chat_approved_source_chunks from public, anon;
revoke all on table ai_chat_answer_envelopes from public, anon;
grant select on table ai_chat_approved_sources to authenticated;
grant select on table ai_chat_approved_source_chunks to authenticated;
grant select on table ai_chat_answer_envelopes to authenticated;
grant all on table ai_chat_approved_sources to service_role;
grant all on table ai_chat_approved_source_chunks to service_role;
grant all on table ai_chat_answer_envelopes to service_role;

revoke all on function p85_stage_4c_persist_run_source_refs_v1(uuid, uuid, uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function p85_stage_4c_import_approved_source_v1(text, text, text, text, text, text, text, text, text, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function p85_stage_4c_search_approved_sources_v1(text, integer) from public, anon, authenticated;
revoke all on function p85_stage_4c_save_answer_envelope_v1(uuid, uuid, uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function p85_stage_4c_list_run_sources_v1(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function p85_stage_4c_persist_run_source_refs_v1(uuid, uuid, uuid, uuid, uuid, jsonb) to service_role;
grant execute on function p85_stage_4c_import_approved_source_v1(text, text, text, text, text, text, text, text, text, timestamptz, jsonb) to service_role;
grant execute on function p85_stage_4c_search_approved_sources_v1(text, integer) to service_role;
grant execute on function p85_stage_4c_save_answer_envelope_v1(uuid, uuid, uuid, uuid, text, text, text, jsonb) to service_role;
grant execute on function p85_stage_4c_list_run_sources_v1(uuid, uuid, uuid) to service_role;
