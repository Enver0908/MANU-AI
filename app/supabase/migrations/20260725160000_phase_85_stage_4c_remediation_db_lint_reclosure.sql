-- Phase 85 Stage 4C remediation: local Postgres lint reclosure.
-- Append-only compatibility fixes for clean local Supabase/Postgres validation.

alter table clients
  add column if not exists updated_at timestamptz not null default now();

alter table conversations
  add column if not exists updated_at timestamptz not null default now();

alter table messages
  add column if not exists updated_at timestamptz not null default now();

alter table ai_decisions
  add column if not exists updated_at timestamptz not null default now();

create or replace function jsonb_object_length(p_value jsonb)
returns integer
language sql
immutable
strict
set search_path = public
as $$
  select count(*)::integer
  from jsonb_object_keys(p_value)
$$;

do $$
begin
  if not exists (
    select 1
    from pg_cast
    where castsource = 'text'::regtype
      and casttarget = 'case_status'::regtype
  ) then
    execute 'create cast (text as case_status) with inout as implicit';
  end if;
end;
$$;

create or replace function p85_stage_4b3_finalize_media_asset_expiry(
  p_tenant_id uuid,
  p_asset_id uuid,
  p_now timestamptz default now()
)
returns table (
  id uuid,
  status text,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tenant_id is null or p_asset_id is null then
    raise exception 'tenant_and_asset_required';
  end if;

  return query
  update media_assets
  set status = 'expired',
      provider_media_id = null,
      sanitized_full_object_key = null,
      thumbnail_object_key = null,
      sanitized_audio_object_key = null,
      deleted_at = p_now,
      updated_at = p_now
  where media_assets.tenant_id = p_tenant_id
    and media_assets.id = p_asset_id
    and media_assets.deleted_at is null
    and media_assets.status not in ('expired', 'revoked')
    and media_assets.expires_at is not null
    and media_assets.expires_at <= p_now
  returning media_assets.id, media_assets.status, media_assets.deleted_at;
end;
$$;

create or replace function p85_stage_4b3_redact_client_media_metadata(
  p_tenant_id uuid,
  p_client_id uuid,
  p_now timestamptz default now()
)
returns table (
  media_assets_updated integer,
  bundles_updated integer,
  analyses_updated integer,
  corrections_updated integer,
  transcriptions_updated integer,
  transcript_corrections_updated integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_media_count integer := 0;
  v_bundle_count integer := 0;
  v_analysis_count integer := 0;
  v_correction_count integer := 0;
  v_transcription_count integer := 0;
  v_transcript_correction_count integer := 0;
begin
  if p_tenant_id is null or p_client_id is null then
    raise exception 'tenant_and_client_required';
  end if;

  update inbound_message_bundles
  set status = 'superseded',
      lease_owner = null,
      lease_expires_at = null,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and client_id = p_client_id
    and status in ('open', 'ready', 'processing');
  get diagnostics v_bundle_count = row_count;

  update media_assets
  set status = 'revoked',
      provider_media_id = null,
      sanitized_full_object_key = null,
      thumbnail_object_key = null,
      sanitized_audio_object_key = null,
      deleted_at = p_now,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and client_id = p_client_id
    and deleted_at is null;
  get diagnostics v_media_count = row_count;

  update visual_analysis_records
  set observation = jsonb_build_object(
        'schemaVersion', 'visual-observation-v1',
        'sceneType', coalesce(observation->>'sceneType', 'unknown'),
        'sceneConfidence', 0,
        'overallConfidence', 0,
        'qualityFlags', '[]'::jsonb,
        'entityCandidates', '[]'::jsonb,
        'ocrBlocks', '[]'::jsonb,
        'labelIntegrity', observation->'labelIntegrity',
        'sensitivitySignals', jsonb_build_array('REDACTED_BY_PHASE74_POLICY'),
        'promptInjectionSignals', jsonb_build_array('REDACTED_BY_PHASE74_POLICY'),
        'providerId', coalesce(observation->>'providerId', 'redacted'),
        'providerVersion', coalesce(observation->>'providerVersion', 'redacted')
      ),
      failure_code = case when failure_code is null then null else 'REDACTED_BY_PHASE74_POLICY' end,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and client_id = p_client_id;
  get diagnostics v_analysis_count = row_count;

  update visual_corrections
  set explanation = 'REDACTED_BY_PHASE74_POLICY',
      corrected_ocr_text = case when corrected_ocr_text is null then null else 'REDACTED_BY_PHASE74_POLICY' end,
      corrected_entity_labels = '{}'::text[],
      updated_at = p_now
  where tenant_id = p_tenant_id
    and client_id = p_client_id;
  get diagnostics v_correction_count = row_count;

  update audio_transcription_records
  set observation = case
        when status = 'accepted' and observation is not null then jsonb_build_object(
          'schemaVersion', coalesce(observation->>'schemaVersion', 'audio-transcription-observation-v1-v0.1.0'),
          'locale', coalesce(observation->>'locale', 'tr-TR'),
          'transcriptText', coalesce(observation->>'transcriptText', ''),
          'overallConfidence', 0,
          'segments', '[]'::jsonb,
          'uncertainSpanCount', 0,
          'providerId', 'REDACTED_BY_PHASE74_POLICY',
          'providerVersion', 'REDACTED_BY_PHASE74_POLICY'
        )
        when observation is not null then jsonb_build_object(
          'schemaVersion', coalesce(observation->>'schemaVersion', 'audio-transcription-observation-v1-v0.1.0'),
          'locale', coalesce(observation->>'locale', 'tr-TR'),
          'transcriptText', 'REDACTED_BY_PHASE74_POLICY',
          'overallConfidence', 0,
          'segments', '[]'::jsonb,
          'uncertainSpanCount', 0,
          'providerId', 'REDACTED_BY_PHASE74_POLICY',
          'providerVersion', 'REDACTED_BY_PHASE74_POLICY'
        )
        else null
      end,
      quality_decision = null,
      rejection_reasons = '{}',
      retrieval_eligible = false,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and client_id = p_client_id;
  get diagnostics v_transcription_count = row_count;

  update audio_transcript_corrections
  set explanation = 'REDACTED_BY_PHASE74_POLICY',
      corrected_transcript = 'REDACTED_BY_PHASE74_POLICY',
      updated_at = p_now
  where tenant_id = p_tenant_id
    and client_id = p_client_id;
  get diagnostics v_transcript_correction_count = row_count;

  return query
  select v_media_count, v_bundle_count, v_analysis_count, v_correction_count, v_transcription_count, v_transcript_correction_count;
end;
$$;

create or replace function p85_stage_4b3_redact_stale_visual_evidence_v2(
  p_tenant_id uuid,
  p_now timestamptz default now(),
  p_limit integer default 64
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redacted integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  with candidates as (
    select va.id
    from visual_analysis_records va
    join media_assets ma
      on ma.tenant_id = va.tenant_id
     and ma.id = va.media_asset_id
    where va.tenant_id = p_tenant_id
      and va.created_at <= p_now - interval '24 months'
      and (
        jsonb_array_length(coalesce(va.observation->'ocrBlocks', '[]'::jsonb)) > 0
        or jsonb_array_length(coalesce(va.observation->'entityCandidates', '[]'::jsonb)) > 0
        or exists (
          select 1
          from visual_corrections vc
          where vc.tenant_id = va.tenant_id
            and vc.analysis_id = va.id
            and (
              coalesce(vc.explanation, '') <> 'REDACTED_BY_PHASE74_POLICY'
              or coalesce(vc.corrected_ocr_text, '') not in ('', 'REDACTED_BY_PHASE74_POLICY')
              or coalesce(array_length(vc.corrected_entity_labels, 1), 0) > 0
            )
        )
      )
    order by va.created_at asc
    limit greatest(p_limit, 1)
  ),
  updated_analyses as (
    update visual_analysis_records va
    set observation = jsonb_build_object(
          'schemaVersion', 'visual-observation-v1',
          'sceneType', coalesce(va.observation->>'sceneType', 'unknown'),
          'sceneConfidence', 0,
          'overallConfidence', 0,
          'qualityFlags', '[]'::jsonb,
          'entityCandidates', '[]'::jsonb,
          'ocrBlocks', '[]'::jsonb,
          'labelIntegrity', va.observation->'labelIntegrity',
          'sensitivitySignals', jsonb_build_array('REDACTED_BY_PHASE74_POLICY'),
          'promptInjectionSignals', jsonb_build_array('REDACTED_BY_PHASE74_POLICY'),
          'providerId', coalesce(va.observation->>'providerId', 'redacted'),
          'providerVersion', coalesce(va.observation->>'providerVersion', 'redacted')
        ),
        retrieval_eligible = false,
        failure_code = case when va.failure_code is null then null else 'REDACTED_BY_PHASE74_POLICY' end,
        updated_at = p_now
    from candidates c
    where va.tenant_id = p_tenant_id
      and va.id = c.id
    returning va.id
  )
  select count(*) into v_redacted from updated_analyses;

  update visual_corrections vc
  set explanation = 'REDACTED_BY_PHASE74_POLICY',
      corrected_ocr_text = case when corrected_ocr_text is null then null else 'REDACTED_BY_PHASE74_POLICY' end,
      corrected_entity_labels = '{}'::text[],
      updated_at = p_now
  where vc.tenant_id = p_tenant_id
    and vc.analysis_id in (
      select va.id
      from visual_analysis_records va
      where va.tenant_id = p_tenant_id
        and va.created_at <= p_now - interval '24 months'
        and va.observation->'ocrBlocks' = '[]'::jsonb
        and va.observation->'entityCandidates' = '[]'::jsonb
    )
    and (
      coalesce(vc.explanation, '') <> 'REDACTED_BY_PHASE74_POLICY'
      or coalesce(vc.corrected_ocr_text, '') not in ('', 'REDACTED_BY_PHASE74_POLICY')
      or coalesce(array_length(vc.corrected_entity_labels, 1), 0) > 0
    );

  return jsonb_build_object('analysesRedacted', v_redacted, 'processedAt', p_now);
end;
$$;

create or replace function p85_stage_4c_delete_message_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_message_id uuid,
  p_expected_revision bigint,
  p_request_id text,
  p_body_hash text,
  p_hmac_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing ai_chat_mutation_ledger%rowtype;
  v_conversation ai_chat_conversations%rowtype;
  v_message ai_chat_messages%rowtype;
  v_current_version ai_chat_message_versions%rowtype;
  v_job ai_chat_deletion_jobs%rowtype;
  v_digest_parts text[];
  v_entity_hash text;
  v_suffix_message_ids uuid[] := '{}'::uuid[];
  v_target_depth integer;
  v_parent_version ai_chat_message_versions%rowtype;
  v_parent_branch ai_chat_branches%rowtype;
  v_root_branch ai_chat_branches%rowtype;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_existing
  from ai_chat_mutation_ledger
  where tenant_id = p_tenant_id
    and request_id = p_request_id
    and created_by_user_id = p_user_id
  for update;

  if found then
    if v_existing.body_hash <> p_body_hash then
      raise exception 'ai_chat_idempotency_conflict';
    end if;
    v_digest_parts := string_to_array(v_existing.response_digest, '|');
    return jsonb_build_object(
      'message_id', p_message_id,
      'deletion_job_id', v_digest_parts[1]::uuid,
      'conversation_id', v_digest_parts[2]::uuid,
      'conversation_revision', v_digest_parts[3]::bigint
    );
  end if;

  select m.*
    into v_message
  from ai_chat_messages m
  where m.tenant_id = p_tenant_id
    and m.id = p_message_id
    and m.created_by_user_id = p_user_id;

  if not found then
    raise exception 'ai_chat_message_not_found';
  end if;

  if v_message.role <> 'user' then
    raise exception 'ai_chat_assistant_delete_forbidden';
  end if;

  select c.*
    into v_conversation
  from ai_chat_conversations c
  where c.tenant_id = p_tenant_id
    and c.id = v_message.conversation_id
    and c.created_by_user_id = p_user_id
    and (
      c.scope_type = 'general'
      or p85_stage_4c_resolve_client_access_v1(
        p_tenant_id, c.client_id, p_user_id, p_dietitian_id, p_role
      )
    )
  for update;

  if not found or v_conversation.status in ('deleting', 'deleted') then
    raise exception 'ai_chat_not_found';
  end if;

  if v_conversation.status <> 'active' then
    raise exception 'ai_chat_conversation_locked';
  end if;

  if v_conversation.revision <> p_expected_revision then
    raise exception 'ai_chat_revision_conflict:%', v_conversation.revision;
  end if;

  with recursive chain as (
    select
      mv.id,
      mv.tenant_id,
      mv.conversation_id,
      mv.message_id,
      mv.branch_id,
      mv.created_by_user_id,
      mv.body,
      mv.body_sha256,
      mv.parent_version_id,
      mv.supersedes_version_id,
      mv.run_id,
      mv.content_status,
      mv.created_at,
      m.role,
      1 as depth
    from ai_chat_branches b
    join ai_chat_message_versions mv
      on mv.tenant_id = b.tenant_id
     and mv.id = b.active_leaf_version_id
    join ai_chat_messages m
      on m.tenant_id = mv.tenant_id
     and m.id = mv.message_id
    where b.tenant_id = p_tenant_id
      and b.id = v_conversation.active_branch_id
    union all
    select
      parent.id,
      parent.tenant_id,
      parent.conversation_id,
      parent.message_id,
      parent.branch_id,
      parent.created_by_user_id,
      parent.body,
      parent.body_sha256,
      parent.parent_version_id,
      parent.supersedes_version_id,
      parent.run_id,
      parent.content_status,
      parent.created_at,
      parent_message.role,
      chain.depth + 1
    from chain
    join ai_chat_message_versions parent
      on parent.tenant_id = p_tenant_id
     and parent.id = chain.parent_version_id
    join ai_chat_messages parent_message
      on parent_message.tenant_id = parent.tenant_id
     and parent_message.id = parent.message_id
  )
  select
    id,
    tenant_id,
    conversation_id,
    message_id,
    branch_id,
    created_by_user_id,
    body,
    body_sha256,
    parent_version_id,
    supersedes_version_id,
    run_id,
    content_status,
    created_at
    into v_current_version
  from chain
  where role = 'user'
  order by depth asc
  limit 1;

  if not found or v_current_version.message_id <> p_message_id then
    raise exception 'ai_chat_message_not_latest_user';
  end if;

  select *
    into v_job
  from ai_chat_deletion_jobs j
  where j.tenant_id = p_tenant_id
    and j.target_message_id = p_message_id
    and j.status in ('queued', 'processing')
  limit 1;

  if found then
    return jsonb_build_object(
      'message_id', p_message_id,
      'deletion_job_id', v_job.id,
      'conversation_id', v_conversation.id,
      'conversation_revision', v_conversation.revision
    );
  end if;

  if p85_stage_4c_has_active_legal_hold_v1(p_tenant_id, v_conversation.client_id) then
    raise exception 'ai_chat_legal_hold';
  end if;

  with recursive chain as (
    select mv.message_id, 1 as depth
    from ai_chat_branches b
    join ai_chat_message_versions mv
      on mv.tenant_id = b.tenant_id
     and mv.id = b.active_leaf_version_id
    where b.tenant_id = p_tenant_id
      and b.id = v_conversation.active_branch_id
    union all
    select parent.message_id, chain.depth + 1
    from chain
    join ai_chat_message_versions current_version
      on current_version.tenant_id = p_tenant_id
     and current_version.message_id = chain.message_id
    join ai_chat_message_versions parent
      on parent.tenant_id = p_tenant_id
     and parent.id = current_version.parent_version_id
  )
  select depth
    into v_target_depth
  from chain
  where message_id = p_message_id
  limit 1;

  select coalesce(array_agg(distinct chain.message_id order by chain.message_id), '{}'::uuid[])
    into v_suffix_message_ids
  from (
    with recursive chain as (
      select mv.message_id, 1 as depth
      from ai_chat_branches b
      join ai_chat_message_versions mv
        on mv.tenant_id = b.tenant_id
       and mv.id = b.active_leaf_version_id
      where b.tenant_id = p_tenant_id
        and b.id = v_conversation.active_branch_id
      union all
      select parent.message_id, chain.depth + 1
      from chain
      join ai_chat_message_versions current_version
        on current_version.tenant_id = p_tenant_id
       and current_version.message_id = chain.message_id
      join ai_chat_message_versions parent
        on parent.tenant_id = p_tenant_id
       and parent.id = current_version.parent_version_id
    )
    select message_id
    from chain
    where depth <= v_target_depth
  ) chain;

  v_entity_hash := p85_stage_4c_hash_deletion_entity_v1(
    p_tenant_id,
    'message',
    p_message_id,
    p_hmac_secret
  );

  insert into ai_chat_deletion_ledger (
    tenant_id,
    entity_type,
    entity_id_hash,
    reason,
    requested_at,
    replay_status,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    'message',
    v_entity_hash,
    'user_delete',
    v_now,
    'pending',
    v_now,
    v_now
  )
  on conflict (tenant_id, entity_type, entity_id_hash)
  do update set
    updated_at = v_now;

  update ai_chat_runs
  set status = 'superseded',
      updated_at = v_now
  where tenant_id = p_tenant_id
    and conversation_id = v_conversation.id
    and p85_stage_4c_is_active_run_status(status);

  update ai_chat_messages
  set deleted_at = v_now,
      updated_at = v_now
  where tenant_id = p_tenant_id
    and id = any (v_suffix_message_ids);

  update ai_chat_message_versions
  set content_status = 'deleting',
      body = ''
  where tenant_id = p_tenant_id
    and message_id = any (v_suffix_message_ids);

  update ai_chat_branches b
  set status = 'deleted',
      updated_at = v_now
  where b.tenant_id = p_tenant_id
    and b.conversation_id = v_conversation.id
    and exists (
      with recursive chain as (
        select mv.message_id, 1 as depth
        from ai_chat_branches branch
        join ai_chat_message_versions mv
          on mv.tenant_id = branch.tenant_id
         and mv.id = branch.active_leaf_version_id
        where branch.tenant_id = b.tenant_id
          and branch.id = b.id
        union all
        select parent.message_id, chain.depth + 1
        from chain
        join ai_chat_message_versions current_version
          on current_version.tenant_id = b.tenant_id
         and current_version.message_id = chain.message_id
        join ai_chat_message_versions parent
          on parent.tenant_id = b.tenant_id
         and parent.id = current_version.parent_version_id
      )
      select 1
      from chain
      where chain.message_id = p_message_id
    );

  select *
    into v_parent_version
  from ai_chat_message_versions
  where tenant_id = p_tenant_id
    and id = v_current_version.parent_version_id;

  if not found then
    select *
      into v_root_branch
    from ai_chat_branches
    where tenant_id = p_tenant_id
      and conversation_id = v_conversation.id
      and parent_branch_id is null
    limit 1;

    if found then
      update ai_chat_branches
      set active_leaf_version_id = null,
          status = 'active',
          updated_at = v_now
      where tenant_id = p_tenant_id
        and id = v_root_branch.id;

      update ai_chat_conversations
      set active_branch_id = v_root_branch.id,
          revision = revision + 1,
          updated_at = v_now
      where tenant_id = p_tenant_id
        and id = v_conversation.id
      returning * into v_conversation;
    end if;
  else
    select *
      into v_parent_branch
    from ai_chat_branches
    where tenant_id = p_tenant_id
      and id = v_parent_version.branch_id;

    if found then
      update ai_chat_branches
      set active_leaf_version_id = v_parent_version.id,
          status = 'active',
          updated_at = v_now
      where tenant_id = p_tenant_id
        and id = v_parent_branch.id;

      update ai_chat_conversations
      set active_branch_id = v_parent_branch.id,
          revision = revision + 1,
          updated_at = v_now
      where tenant_id = p_tenant_id
        and id = v_conversation.id
      returning * into v_conversation;
    end if;
  end if;

  insert into ai_chat_deletion_jobs (
    tenant_id,
    job_kind,
    target_conversation_id,
    target_message_id,
    target_client_id,
    target_user_id,
    reason,
    status,
    attempt_count,
    cursor,
    requested_at,
    created_by_user_id,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    'message_purge',
    v_conversation.id,
    p_message_id,
    v_conversation.client_id,
    p_user_id,
    'user_delete',
    'queued',
    0,
    jsonb_build_object(
      'phase', 'storage',
      'storageOffset', 0,
      'suffixMessageIds', to_jsonb(v_suffix_message_ids)
    ),
    v_now,
    p_user_id,
    v_now,
    v_now
  )
  returning * into v_job;

  insert into ai_chat_mutation_ledger (
    tenant_id,
    request_id,
    created_by_user_id,
    body_hash,
    response_digest
  )
  values (
    p_tenant_id,
    p_request_id,
    p_user_id,
    p_body_hash,
    concat_ws('|', v_job.id::text, v_conversation.id::text, v_conversation.revision::text)
  );

  return jsonb_build_object(
    'message_id', p_message_id,
    'deletion_job_id', v_job.id,
    'conversation_id', v_conversation.id,
    'conversation_revision', v_conversation.revision
  );
end;
$$;

grant execute on function jsonb_object_length(jsonb) to public, anon, authenticated, service_role;
grant execute on function p85_stage_4b3_finalize_media_asset_expiry(uuid, uuid, timestamptz) to service_role;
grant execute on function p85_stage_4b3_redact_client_media_metadata(uuid, uuid, timestamptz) to service_role;
grant execute on function p85_stage_4b3_redact_stale_visual_evidence_v2(uuid, timestamptz, integer) to service_role;
grant execute on function p85_stage_4c_delete_message_v1(uuid, uuid, uuid, text, uuid, bigint, text, text, text) to service_role;
