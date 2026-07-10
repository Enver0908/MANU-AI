-- P85-IF-R4: service-role-only atomic context-intake workflow mutations.

create or replace function p85_if_r4_context_intake_current_baselines(
  p_tenant_id uuid,
  p_client_id uuid
)
returns table (
  context_revision integer,
  form_revision integer,
  food_rule_revision integer,
  menu_plan_revision integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    c.context_revision,
    (
      select fr.schema_version
      from client_form_responses fr
      where fr.tenant_id = p_tenant_id and fr.client_id = p_client_id
      order by fr.updated_at desc
      limit 1
    ),
    (
      select fp.revision
      from client_food_rule_profiles fp
      where fp.tenant_id = p_tenant_id and fp.client_id = p_client_id and fp.status = 'published'
      order by fp.updated_at desc
      limit 1
    ),
    (
      select mp.revision
      from client_menu_plans mp
      where mp.tenant_id = p_tenant_id and mp.client_id = p_client_id and mp.status = 'active'
      order by mp.updated_at desc
      limit 1
    )
  from clients c
  where c.tenant_id = p_tenant_id and c.id = p_client_id;
end;
$$;

create or replace function p85_if_r4_structured_revision_ready(
  p_proposal context_intake_proposals
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  baselines record;
  flag text;
begin
  select *
  into baselines
  from p85_if_r4_context_intake_current_baselines(p_proposal.tenant_id, p_proposal.client_id);

  foreach flag in array coalesce(p_proposal.structured_impact_flags, '{}'::text[])
  loop
    if flag = 'form' and coalesce(baselines.form_revision, 0) <= coalesce(p_proposal.baseline_form_revision, 0) then
      return false;
    elsif flag = 'food_rules' and coalesce(baselines.food_rule_revision, 0) <= coalesce(p_proposal.baseline_food_rule_revision, 0) then
      return false;
    elsif flag = 'menu_plan' and coalesce(baselines.menu_plan_revision, 0) <= coalesce(p_proposal.baseline_menu_plan_revision, 0) then
      return false;
    elsif flag = 'active_plan' and baselines.context_revision <= p_proposal.baseline_context_revision then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create or replace function p85_if_r4_apply_context_intake_draft_invalidations(
  p_tenant_id uuid,
  p_client_id uuid,
  p_now timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  draft_count integer;
begin
  update messages m
  set status = 'blocked'
  where m.tenant_id = p_tenant_id
    and m.origin = 'ai_generated'
    and m.status = 'draft'
    and exists (
      select 1
      from conversations c
      where c.tenant_id = p_tenant_id
        and c.id = m.conversation_id
        and c.client_id = p_client_id
    );

  get diagnostics draft_count = row_count;

  update ai_decisions d
  set send_status = 'draft_invalidated',
      blocked_reason = 'client_context_update_added'
  where d.tenant_id = p_tenant_id
    and exists (
      select 1
      from messages m
      join conversations c on c.tenant_id = p_tenant_id and c.id = m.conversation_id
      where m.tenant_id = p_tenant_id
        and c.client_id = p_client_id
        and m.generated_by_ai_decision_id = d.id
        and m.status = 'blocked'
    );

  if draft_count > 0 then
    insert into audit_events (
      id, tenant_id, actor_type, actor_id, event_type, entity_type, entity_id, metadata, created_at
    ) values (
      gen_random_uuid(), p_tenant_id, 'system', null,
      'draft_context_invalidated', 'client', p_client_id::text,
      jsonb_build_object('source', 'client_context_update', 'minimized', true),
      p_now
    );
  end if;
end;
$$;

create or replace function p85_if_r4_mutate_context_intake_proposal(
  p_tenant_id uuid,
  p_client_id uuid,
  p_dietitian_id uuid,
  p_proposal_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal_row context_intake_proposals%rowtype;
  client_row clients%rowtype;
  baselines record;
  now_value timestamptz := now();
  update_id uuid;
begin
  select *
  into proposal_row
  from context_intake_proposals
  where tenant_id = p_tenant_id and client_id = p_client_id and id = p_proposal_id
  for update;

  if not found then
    raise exception 'context_intake_proposal_not_found';
  end if;

  if proposal_row.expires_at is not null and proposal_row.expires_at <= now_value then
    raise exception 'context_intake_proposal_expired';
  end if;

  if proposal_row.status in ('applied', 'rejected', 'stale', 'expired') and p_action <> 'reject' then
    raise exception 'context_intake_proposal_not_mutable';
  end if;

  select *
  into client_row
  from clients
  where tenant_id = p_tenant_id and id = p_client_id
  for update;

  if not found then
    raise exception 'client_not_found';
  end if;

  if client_row.lifecycle_status = 'removed_anonymized' then
    raise exception 'client_removed_anonymized';
  end if;

  if p_action = 'confirm' then
    if proposal_row.status = 'blocked_structured_impact' then
      update context_intake_proposals
      set confirmation_count = confirmation_count + 1,
          updated_at = now_value
      where tenant_id = p_tenant_id and id = p_proposal_id;
    elsif proposal_row.status in ('pending_confirmation', 'confirmed') then
      update context_intake_proposals
      set status = 'confirmed',
          confirmation_count = confirmation_count + 1,
          updated_at = now_value
      where tenant_id = p_tenant_id and id = p_proposal_id;
    else
      raise exception 'context_intake_proposal_not_confirmable';
    end if;

    insert into audit_events (
      id, tenant_id, actor_type, actor_id, event_type, entity_type, entity_id, metadata, created_at
    ) values (
      gen_random_uuid(), p_tenant_id, 'system', p_dietitian_id::text,
      case when proposal_row.status = 'blocked_structured_impact'
        then 'context_intake_proposal_confirmed_blocked'
        else 'context_intake_proposal_confirmed'
      end,
      'context_intake_proposal', p_proposal_id::text,
      jsonb_build_object('source', 'context_intake_workflow'),
      now_value
    );
  elsif p_action = 'recheck' then
    if proposal_row.status <> 'blocked_structured_impact' then
      raise exception 'context_intake_proposal_not_blocked';
    end if;

    if not p85_if_r4_structured_revision_ready(proposal_row) then
      raise exception 'context_intake_structured_revision_pending';
    end if;

    select *
    into baselines
    from p85_if_r4_context_intake_current_baselines(p_tenant_id, p_client_id);

    update context_intake_proposals
    set status = 'confirmed',
        baseline_context_revision = baselines.context_revision,
        baseline_form_revision = baselines.form_revision,
        baseline_food_rule_revision = baselines.food_rule_revision,
        baseline_menu_plan_revision = baselines.menu_plan_revision,
        updated_at = now_value
    where tenant_id = p_tenant_id and id = p_proposal_id;

    insert into audit_events (
      id, tenant_id, actor_type, actor_id, event_type, entity_type, entity_id, metadata, created_at
    ) values (
      gen_random_uuid(), p_tenant_id, 'system', p_dietitian_id::text,
      'context_intake_structured_revision_rechecked', 'context_intake_proposal', p_proposal_id::text,
      jsonb_build_object('source', 'context_intake_workflow', 'ready', true),
      now_value
    );
  elsif p_action = 'apply' then
    if proposal_row.baseline_context_revision <> client_row.context_revision then
      raise exception 'context_intake_proposal_stale';
    end if;
    if proposal_row.status <> 'confirmed' then
      raise exception 'context_intake_proposal_not_ready_to_apply';
    end if;
    if cardinality(coalesce(proposal_row.structured_impact_flags, '{}'::text[])) > 0 then
      if proposal_row.confirmation_count < 2 then
        raise exception 'context_intake_second_confirmation_required';
      end if;
    elsif proposal_row.confirmation_count < 1 then
      raise exception 'context_intake_confirmation_required';
    end if;

    update_id := gen_random_uuid();

    insert into client_context_updates (
      id, tenant_id, client_id, dietitian_id, source, occurred_at, title, summary,
      details, importance, status, supersedes_update_id, created_at
    ) values (
      update_id, p_tenant_id, p_client_id, p_dietitian_id, proposal_row.intake_source,
      proposal_row.occurred_at, proposal_row.title, proposal_row.summary, proposal_row.details,
      proposal_row.importance, 'active', null, now_value
    );

    update clients
    set context_revision = context_revision + 1
    where tenant_id = p_tenant_id and id = p_client_id;

    update context_intake_proposals
    set status = 'applied',
        applied_context_update_id = update_id,
        updated_at = now_value
    where tenant_id = p_tenant_id and id = p_proposal_id;

    insert into audit_events (
      id, tenant_id, actor_type, actor_id, event_type, entity_type, entity_id, metadata, created_at
    ) values (
      gen_random_uuid(), p_tenant_id, 'system', p_dietitian_id::text,
      'client_context_update_created', 'client_context_update', update_id::text,
      jsonb_build_object(
        'source', 'local_app',
        'clientId', p_client_id,
        'updateSource', proposal_row.intake_source,
        'importance', proposal_row.importance,
        'minimized', true
      ),
      now_value
    ), (
      gen_random_uuid(), p_tenant_id, 'system', p_dietitian_id::text,
      'context_intake_proposal_applied', 'context_intake_proposal', p_proposal_id::text,
      jsonb_build_object(
        'source', 'context_intake_workflow',
        'clientId', p_client_id,
        'contextUpdateId', update_id,
        'structuredImpactFlags', proposal_row.structured_impact_flags,
        'intakeSource', proposal_row.intake_source,
        'minimized', true
      ),
      now_value
    );

    perform p85_if_r4_apply_context_intake_draft_invalidations(p_tenant_id, p_client_id, now_value);
  elsif p_action = 'reject' then
    if proposal_row.status in ('applied', 'rejected', 'stale', 'expired') then
      raise exception 'context_intake_proposal_not_rejectable';
    end if;

    update context_intake_proposals
    set status = 'rejected',
        updated_at = now_value
    where tenant_id = p_tenant_id and id = p_proposal_id;

    insert into audit_events (
      id, tenant_id, actor_type, actor_id, event_type, entity_type, entity_id, metadata, created_at
    ) values (
      gen_random_uuid(), p_tenant_id, 'system', p_dietitian_id::text,
      'context_intake_proposal_rejected', 'context_intake_proposal', p_proposal_id::text,
      jsonb_build_object('source', 'context_intake_workflow'),
      now_value
    );
  else
    raise exception 'context_intake_action_invalid';
  end if;

  return jsonb_build_object(
    'ok', true,
    'operation', 'p85_if_r4_mutate_context_intake_proposal',
    'action', p_action,
    'clientId', p_client_id,
    'proposalId', p_proposal_id,
    'contextUpdateId', update_id
  );
end;
$$;

revoke all on function p85_if_r4_context_intake_current_baselines(uuid, uuid)
  from public, anon, authenticated;
revoke all on function p85_if_r4_structured_revision_ready(context_intake_proposals)
  from public, anon, authenticated;
revoke all on function p85_if_r4_apply_context_intake_draft_invalidations(uuid, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function p85_if_r4_mutate_context_intake_proposal(uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function p85_if_r4_mutate_context_intake_proposal(uuid, uuid, uuid, uuid, text)
  to service_role;
