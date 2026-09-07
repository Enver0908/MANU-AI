-- Phase 85 Stage 4C remediation: align scale EXPLAIN profiles with the live schema.

create index if not exists clients_tenant_lifecycle_id_idx
  on clients (tenant_id, lifecycle_status, id);

create index if not exists ai_chat_deletion_jobs_tenant_claim_idx
  on ai_chat_deletion_jobs (tenant_id, status, requested_at, created_at);

create or replace function p85_stage_4c_scale_explain_profile_v1(
  p_profile text,
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_conversation_id uuid default null,
  p_branch_id uuid default null,
  p_client_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan jsonb;
  v_conversation_id uuid := coalesce(p_conversation_id, p85_stage_4c_scale_uuid_from_seed('conversation:0'));
  v_branch_id uuid := coalesce(p_branch_id, p85_stage_4c_scale_uuid_from_seed('branch:0'));
  v_client_id uuid := coalesce(p_client_id, p85_stage_4c_scale_uuid_from_seed('client:0'));
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  case p_profile
    when 'history_list' then
      execute format(
        'explain (analyze, buffers, format json) select c.id from ai_chat_conversations c where c.tenant_id = %L and c.created_by_user_id = %L and c.status = %L order by c.last_message_at desc nulls last, c.id desc limit 30',
        p_tenant_id,
        p_user_id,
        'active'
      ) into v_plan;
    when 'conversation_load' then
      execute format(
        'explain (analyze, buffers, format json) select c.* from ai_chat_conversations c where c.tenant_id = %L and c.id = %L',
        p_tenant_id,
        v_conversation_id
      ) into v_plan;
    when 'branch_chain' then
      execute format(
        'explain (analyze, buffers, format json) select mv.id from ai_chat_message_versions mv where mv.tenant_id = %L and mv.branch_id = %L order by mv.created_at asc, mv.id asc limit 50',
        p_tenant_id,
        v_branch_id
      ) into v_plan;
    when 'run_event_catch_up' then
      execute format(
        'explain (analyze, buffers, format json) select e.sequence_number from ai_chat_run_events e where e.tenant_id = %L and e.conversation_id = %L order by e.sequence_number asc limit 200',
        p_tenant_id,
        v_conversation_id
      ) into v_plan;
    when 'context_gateway_access' then
      execute format(
        'explain (analyze, buffers, format json) select c.id from clients c where c.tenant_id = %L and c.lifecycle_status = %L and c.id >= %L order by c.tenant_id, c.lifecycle_status, c.id limit 1',
        p_tenant_id,
        'active',
        v_client_id
      ) into v_plan;
    when 'source_search' then
      execute format(
        'explain (analyze, buffers, format json) select s.id from ai_chat_approved_sources s where s.approval_status = %L order by s.approval_status, s.retired_at, s.review_due_at limit 20',
        'approved'
      ) into v_plan;
    when 'job_claim' then
      execute format(
        'explain (analyze, buffers, format json) select j.id from ai_chat_jobs j where j.tenant_id = %L and j.status = %L order by j.created_at asc limit 1',
        p_tenant_id,
        'queued'
      ) into v_plan;
    when 'deletion_claim' then
      execute format(
        'explain (analyze, buffers, format json) select j.id from ai_chat_deletion_jobs j where j.tenant_id = %L and j.status = %L order by j.requested_at asc, j.created_at asc limit 1',
        p_tenant_id,
        'queued'
      ) into v_plan;
    else
      raise exception 'unknown_scale_explain_profile:%', p_profile;
  end case;

  return jsonb_build_object('profile', p_profile, 'plan', v_plan);
end;
$$;

revoke all on function p85_stage_4c_scale_explain_profile_v1(text, uuid, uuid, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function p85_stage_4c_scale_explain_profile_v1(text, uuid, uuid, uuid, uuid, uuid, uuid)
  to service_role;
