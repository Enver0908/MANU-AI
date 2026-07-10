-- P85-IF-R2: durable structured-update linkage, dedupe, and explicit resolution evidence.

alter table notifications
  add column if not exists dedupe_key text,
  add column if not exists source_message_id uuid,
  add column if not exists target_panel text,
  add column if not exists baseline_revision integer,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by_dietitian_id uuid;

alter table notifications
  add constraint notifications_tenant_id_id_key unique (tenant_id, id);

alter table notifications
  add constraint notifications_tenant_source_message_fk
    foreign key (tenant_id, source_message_id) references messages (tenant_id, id),
  add constraint notifications_tenant_resolved_by_dietitian_fk
    foreign key (tenant_id, resolved_by_dietitian_id) references dietitians (tenant_id, id);

create unique index if not exists notifications_tenant_open_dedupe_key_idx
  on notifications (tenant_id, dedupe_key)
  where dedupe_key is not null and resolved_at is null;

create or replace function p85_if_r2_commit_inbound_notifications(p_tenant_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
  for item in select * from jsonb_array_elements(coalesce(p_payload->'notifications', '[]'::jsonb)) loop
    if nullif(item->>'dedupeKey', '') is null then
      insert into notifications (
        id, tenant_id, type, entity_type, entity_id, title, body, read, acknowledged_at,
        dedupe_key, source_message_id, target_panel, baseline_revision,
        resolved_at, resolved_by_dietitian_id, created_at
      ) values (
        (item->>'id')::uuid, p_tenant_id, item->>'type', item->>'entityType', item->>'entityId',
        item->>'title', item->>'body', coalesce((item->>'read')::boolean, false),
        nullif(item->>'acknowledgedAt', '')::timestamptz, nullif(item->>'dedupeKey', ''),
        nullif(item->>'sourceMessageId', '')::uuid, nullif(item->>'targetPanel', ''),
        nullif(item->>'baselineRevision', '')::integer, nullif(item->>'resolvedAt', '')::timestamptz,
        nullif(item->>'resolvedByDietitianId', '')::uuid,
        coalesce(nullif(item->>'createdAt', '')::timestamptz, now())
      ) on conflict (id) do update set
        read = excluded.read,
        acknowledged_at = excluded.acknowledged_at,
        source_message_id = excluded.source_message_id,
        target_panel = excluded.target_panel,
        baseline_revision = excluded.baseline_revision,
        resolved_at = excluded.resolved_at,
        resolved_by_dietitian_id = excluded.resolved_by_dietitian_id;
    else
      insert into notifications (
        id, tenant_id, type, entity_type, entity_id, title, body, read, acknowledged_at,
        dedupe_key, source_message_id, target_panel, baseline_revision,
        resolved_at, resolved_by_dietitian_id, created_at
      ) values (
        (item->>'id')::uuid, p_tenant_id, item->>'type', item->>'entityType', item->>'entityId',
        item->>'title', item->>'body', coalesce((item->>'read')::boolean, false),
        nullif(item->>'acknowledgedAt', '')::timestamptz, nullif(item->>'dedupeKey', ''),
        nullif(item->>'sourceMessageId', '')::uuid, nullif(item->>'targetPanel', ''),
        nullif(item->>'baselineRevision', '')::integer, nullif(item->>'resolvedAt', '')::timestamptz,
        nullif(item->>'resolvedByDietitianId', '')::uuid,
        coalesce(nullif(item->>'createdAt', '')::timestamptz, now())
      ) on conflict (tenant_id, dedupe_key) where dedupe_key is not null and resolved_at is null do update set
        read = excluded.read,
        acknowledged_at = excluded.acknowledged_at,
        source_message_id = excluded.source_message_id,
        target_panel = excluded.target_panel,
        baseline_revision = excluded.baseline_revision,
        resolved_at = excluded.resolved_at,
        resolved_by_dietitian_id = excluded.resolved_by_dietitian_id;
    end if;
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
    p_payload - 'messages' - 'messageUpdates' - 'channelEvents' - 'channelMessageRevisions' - 'humanControlSessions' - 'riskActivityEvents' - 'notifications' - 'conversationUpdates'
  );
  perform p85_if_f_commit_conversation_revisions(p_tenant_id, p_payload);
  perform p85_if_r1_commit_inbound_records(p_tenant_id, p_payload);
  perform p85_if_r2_commit_inbound_notifications(p_tenant_id, p_payload);
  return jsonb_build_object('ok', true, 'operation', 'inbound_simulation');
end;
$$;
