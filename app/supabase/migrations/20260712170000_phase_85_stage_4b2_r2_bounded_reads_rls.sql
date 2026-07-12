-- Phase 85 Stage 4B-2 remediation R2: bounded read projections and receipt/RLS hardening.
-- The v1 RPCs remain immutable historical contracts. v2 physically limits every
-- projection branch before JSON aggregation and returns unread aggregates separately.

create or replace function p85_stage_4b2_load_list_projection_source_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_status text default 'all',
  p_query text default '',
  p_cursor_last_activity timestamptz default null,
  p_cursor_conversation_id uuid default null,
  p_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_result jsonb;
begin
  if not p85_stage_4b_actor_context_valid(p_tenant_id, p_user_id, p_dietitian_id, p_role)
     or p_role = 'auditor'
     or coalesce(p_status, 'all') not in ('all', 'unread') then
    raise exception 'conversation_read_forbidden';
  end if;

  with visible_base as (
    select
      cv.id,
      cv.tenant_id,
      cv.dietitian_id,
      cv.client_id,
      cv.channel,
      cv.revision,
      latest.id as latest_message_id,
      latest.created_at as last_activity_at,
      latest.body as latest_body,
      latest.sender as latest_sender,
      latest.origin as latest_origin,
      latest.source_message_id as latest_source_message_id,
      latest.conversation_sequence as latest_conversation_sequence,
      latest.content_status as latest_content_status,
      latest.status as latest_status,
      coalesce(unread.unread_count, 0)::bigint as unread_count
    from conversations cv
    join clients c
      on c.tenant_id = cv.tenant_id
     and c.id = cv.client_id
    left join lateral (
      select m.*
      from messages m
      where m.tenant_id = cv.tenant_id
        and m.conversation_id = cv.id
      order by coalesce(m.conversation_sequence, 0) desc, m.created_at desc, m.id desc
      limit 1
    ) latest on true
    left join lateral (
      select count(*)::bigint as unread_count
      from messages m
      left join conversation_read_receipts cr
        on cr.tenant_id = m.tenant_id
       and cr.conversation_id = m.conversation_id
       and cr.dietitian_id = p_dietitian_id
      where m.tenant_id = cv.tenant_id
        and m.conversation_id = cv.id
        and m.origin = 'client_inbound'
        and m.conversation_sequence is not null
        and m.conversation_sequence > coalesce(cr.last_read_sequence, 0)
        and m.content_status not in ('revoked', 'redacted')
    ) unread on true
    where cv.tenant_id = p_tenant_id
      and c.lifecycle_status = 'active'
      and p85_stage_4b_actor_can_read_client(
        p_tenant_id, c.id, p_user_id, p_dietitian_id, p_role
      )
  ), filtered as (
    select vb.*
    from visible_base vb
    where (coalesce(p_query, '') = '' or vb.client_id in (
      select c.id
      from clients c
      where c.tenant_id = p_tenant_id
        and c.id = vb.client_id
        and c.full_name ilike '%' || replace(replace(p_query, '%', '\%'), '_', '\_') || '%' escape '\'
    ))
      and (coalesce(p_status, 'all') = 'all' or vb.unread_count > 0)
      and (
        p_cursor_last_activity is null
        or (coalesce(vb.last_activity_at, '-infinity'::timestamptz), vb.id)
          < (coalesce(p_cursor_last_activity, 'infinity'::timestamptz), coalesce(p_cursor_conversation_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
      )
  ), page as (
    select *
    from filtered
    order by coalesce(last_activity_at, '-infinity'::timestamptz) desc, id desc
    limit v_limit
  ), visible_aggregate as (
    select
      count(*)::bigint as unread_conversation_count,
      coalesce(sum(unread_count), 0)::bigint as unread_message_count
    from visible_base
  ), filtered_aggregate as (
    select count(*)::bigint as filtered_total from filtered
  )
  select jsonb_build_object(
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tenant_id', ca.tenant_id,
        'client_id', ca.client_id,
        'dietitian_id', ca.dietitian_id,
        'access_level', ca.access_level
      ))
      from (
        select ca.tenant_id, ca.client_id, ca.dietitian_id, ca.access_level
        from client_assignments ca
        where ca.tenant_id = p_tenant_id
          and ca.client_id in (select client_id from page)
        limit 500
      ) ca
    ), '[]'::jsonb),
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'tenant_id', c.tenant_id,
        'dietitian_id', c.dietitian_id,
        'lifecycle_status', c.lifecycle_status,
        'full_name', c.full_name,
        'ai_status', c.ai_status,
        'human_takeover_locked', c.human_takeover_locked,
        'red_risk_lock', c.red_risk_lock,
        'yellow_risk_hold', c.yellow_risk_hold
      ))
      from clients c
      where c.tenant_id = p_tenant_id and c.id in (select client_id from page)
    ), '[]'::jsonb),
    'conversations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'tenant_id', p.tenant_id,
        'dietitian_id', p.dietitian_id,
        'client_id', p.client_id,
        'channel', p.channel,
        'revision', p.revision
      ) order by coalesce(p.last_activity_at, '-infinity'::timestamptz) desc, p.id desc)
      from page p
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.latest_message_id,
        'tenant_id', p.tenant_id,
        'conversation_id', p.id,
        'sender', p.latest_sender,
        'body', p.latest_body,
        'origin', p.latest_origin,
        'source_message_id', p.latest_source_message_id,
        'conversation_sequence', p.latest_conversation_sequence,
        'content_status', p.latest_content_status,
        'status', p.latest_status,
        'created_at', p.last_activity_at
      ) order by coalesce(p.last_activity_at, '-infinity'::timestamptz) desc, p.id desc)
      from page p
      where p.latest_message_id is not null
    ), '[]'::jsonb),
    'receipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tenant_id', cr.tenant_id,
        'conversation_id', cr.conversation_id,
        'dietitian_id', cr.dietitian_id,
        'actor_role', p_role,
        'last_read_sequence', cr.last_read_sequence,
        'read_at', cr.read_at,
        'created_at', cr.created_at,
        'updated_at', cr.updated_at
      ))
      from conversation_read_receipts cr
      where cr.tenant_id = p_tenant_id
        and cr.dietitian_id = p_dietitian_id
        and cr.conversation_id in (select id from page)
    ), '[]'::jsonb),
    'unread_counts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'conversation_id', p.id,
        'unread_count', p.unread_count
      )) from page p
    ), '[]'::jsonb),
    'filtered_total', (select filtered_total from filtered_aggregate),
    'unread_conversation_count', (select unread_conversation_count from visible_aggregate),
    'unread_message_count', (select unread_message_count from visible_aggregate),
    'next_cursor', null
  ) into v_result;

  return v_result;
end;
$$;

create or replace function p85_stage_4b2_load_detail_projection_source_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_conversation_id uuid,
  p_direction text default 'older',
  p_cursor text default null,
  p_anchor_message_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if not p85_stage_4b_actor_context_valid(p_tenant_id, p_user_id, p_dietitian_id, p_role)
     or p_role = 'auditor'
     or not p85_stage_4b2_actor_can_read_conversation(
       p_tenant_id, p_conversation_id, p_user_id, p_dietitian_id, p_role
     ) then
    raise exception 'conversation_not_found';
  end if;

  with target as (
    select cv.id, cv.tenant_id, cv.dietitian_id, cv.client_id, cv.channel, cv.revision,
      c.full_name, c.lifecycle_status, c.ai_status, c.human_takeover_locked,
      c.red_risk_lock, c.yellow_risk_hold
    from conversations cv
    join clients c on c.tenant_id = cv.tenant_id and c.id = cv.client_id
    where cv.tenant_id = p_tenant_id and cv.id = p_conversation_id
      and c.lifecycle_status = 'active'
  ), bounded_messages as (
    select m.*
    from messages m
    where m.tenant_id = p_tenant_id and m.conversation_id = p_conversation_id
    order by coalesce(m.conversation_sequence, 0) desc, m.created_at desc, m.id desc
    limit 100
  )
  select jsonb_build_object(
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tenant_id', ca.tenant_id,
        'client_id', ca.client_id,
        'dietitian_id', ca.dietitian_id,
        'access_level', ca.access_level
      ))
      from (
        select ca.tenant_id, ca.client_id, ca.dietitian_id, ca.access_level
        from client_assignments ca
        where ca.tenant_id = p_tenant_id
          and ca.client_id = (select client_id from target)
        limit 100
      ) ca
    ), '[]'::jsonb),
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.client_id,
        'tenant_id', t.tenant_id,
        'dietitian_id', t.dietitian_id,
        'lifecycle_status', t.lifecycle_status,
        'full_name', t.full_name,
        'ai_status', t.ai_status,
        'human_takeover_locked', t.human_takeover_locked,
        'red_risk_lock', t.red_risk_lock,
        'yellow_risk_hold', t.yellow_risk_hold
      )) from target t
    ), '[]'::jsonb),
    'conversations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'tenant_id', t.tenant_id,
        'dietitian_id', t.dietitian_id,
        'client_id', t.client_id,
        'channel', t.channel,
        'revision', t.revision
      )) from target t
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'tenant_id', m.tenant_id,
        'conversation_id', m.conversation_id,
        'sender', m.sender,
        'body', m.body,
        'origin', m.origin,
        'source_message_id', m.source_message_id,
        'conversation_sequence', m.conversation_sequence,
        'content_status', m.content_status,
        'status', m.status,
        'created_at', m.created_at
      ) order by coalesce(m.conversation_sequence, 0), m.created_at, m.id)
      from bounded_messages m
    ), '[]'::jsonb),
    'receipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tenant_id', cr.tenant_id,
        'conversation_id', cr.conversation_id,
        'dietitian_id', cr.dietitian_id,
        'actor_role', p_role,
        'last_read_sequence', cr.last_read_sequence,
        'read_at', cr.read_at,
        'created_at', cr.created_at,
        'updated_at', cr.updated_at
      ))
      from conversation_read_receipts cr
      where cr.tenant_id = p_tenant_id
        and cr.conversation_id = p_conversation_id
        and cr.dietitian_id = p_dietitian_id
    ), '[]'::jsonb),
    'unread_counts', jsonb_build_array(jsonb_build_object(
      'conversation_id', p_conversation_id,
      'unread_count', (
        select count(*)::bigint
        from messages m
        left join conversation_read_receipts cr
          on cr.tenant_id = m.tenant_id
         and cr.conversation_id = m.conversation_id
         and cr.dietitian_id = p_dietitian_id
        where m.tenant_id = p_tenant_id
          and m.conversation_id = p_conversation_id
          and m.origin = 'client_inbound'
          and m.conversation_sequence is not null
          and m.conversation_sequence > coalesce(cr.last_read_sequence, 0)
          and m.content_status not in ('revoked', 'redacted')
      )
    ))
  ) into v_result;

  return v_result;
end;
$$;

-- Receipt writes remain RPC-only. The function now explicitly rejects auditor
-- and invalid actor contexts before inspecting or mutating the receipt row.
create or replace function p85_stage_4b2_mark_conversation_read_v2(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_conversation_id uuid,
  p_through_sequence bigint
)
returns table (
  conversation_id uuid,
  dietitian_id uuid,
  actor_role text,
  last_read_sequence bigint,
  read_at timestamptz,
  unread_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role = 'auditor'
     or not p85_stage_4b_actor_context_valid(p_tenant_id, p_user_id, p_dietitian_id, p_role)
     or not p85_stage_4b2_actor_can_read_conversation(
       p_tenant_id, p_conversation_id, p_user_id, p_dietitian_id, p_role
     ) then
    raise exception 'conversation_not_found';
  end if;

  return query select * from p85_stage_4b2_mark_conversation_read_v1(
    p_tenant_id, p_user_id, p_dietitian_id, p_role,
    p_conversation_id, p_through_sequence
  );
end;
$$;

revoke all on function p85_stage_4b2_load_list_projection_source_v2(uuid, uuid, uuid, text, text, text, timestamptz, uuid, integer) from public, anon;
revoke all on function p85_stage_4b2_load_detail_projection_source_v2(uuid, uuid, uuid, text, uuid, text, text, uuid, integer) from public, anon;
revoke all on function p85_stage_4b2_mark_conversation_read_v2(uuid, uuid, uuid, text, uuid, bigint) from public, anon;

grant execute on function p85_stage_4b2_load_list_projection_source_v2(uuid, uuid, uuid, text, text, text, timestamptz, uuid, integer) to authenticated, service_role;
grant execute on function p85_stage_4b2_load_detail_projection_source_v2(uuid, uuid, uuid, text, uuid, text, text, uuid, integer) to authenticated, service_role;
grant execute on function p85_stage_4b2_mark_conversation_read_v2(uuid, uuid, uuid, text, uuid, bigint) to authenticated, service_role;
