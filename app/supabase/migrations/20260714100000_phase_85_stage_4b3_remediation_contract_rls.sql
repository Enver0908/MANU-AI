-- Phase 85 Stage 4B-3 remediation R2: V2 contract columns, legacy status migration, and RLS hardening.

-- 1) Bundle status V2 migration
update inbound_message_bundles
set status = 'decided',
    updated_at = now()
where status = 'completed'
  and decision_id is not null;

update inbound_message_bundles
set status = 'failed',
    failure_code = coalesce(failure_code, 'legacy_completed_without_decision'),
    updated_at = now()
where status = 'completed'
  and decision_id is null;

alter table inbound_message_bundles
  drop constraint if exists inbound_message_bundles_status_check;

alter table inbound_message_bundles
  add constraint inbound_message_bundles_status_check check (
    status in (
      'open',
      'ready',
      'processing',
      'decided',
      'review_required',
      'superseded',
      'failed',
      'cancelled'
    )
  );

drop index if exists inbound_message_bundles_one_active_per_conversation_idx;
create unique index if not exists inbound_message_bundles_one_active_per_conversation_idx
  on inbound_message_bundles (tenant_id, conversation_id)
  where status in ('open', 'ready', 'processing');

-- 2) Bundle item actor/sender columns
alter table inbound_message_bundle_items
  add column if not exists actor_type text,
  add column if not exists sender_id text,
  add column if not exists reply_to_message_id uuid;

update inbound_message_bundle_items bi
set actor_type = 'client',
    sender_id = b.client_id::text
from inbound_message_bundles b
where bi.tenant_id = b.tenant_id
  and bi.bundle_id = b.id
  and bi.actor_type is null;

alter table inbound_message_bundle_items
  alter column actor_type set default 'client';

update inbound_message_bundle_items
set actor_type = 'client'
where actor_type is null;

update inbound_message_bundle_items
set sender_id = tenant_id::text
where sender_id is null or trim(sender_id) = '';

alter table inbound_message_bundle_items
  alter column actor_type set not null,
  alter column sender_id set not null;

alter table inbound_message_bundle_items
  drop constraint if exists inbound_message_bundle_items_actor_type_check;

alter table inbound_message_bundle_items
  add constraint inbound_message_bundle_items_actor_type_check check (
    actor_type in ('client', 'dietitian', 'system')
  );

alter table inbound_message_bundle_items
  drop constraint if exists inbound_message_bundle_items_reply_message_tenant_fk;

alter table inbound_message_bundle_items
  add constraint inbound_message_bundle_items_reply_message_tenant_fk
  foreign key (tenant_id, reply_to_message_id) references messages (tenant_id, id);

-- 3) Analysis retrieval eligibility
alter table visual_analysis_records
  add column if not exists retrieval_eligible boolean,
  add column if not exists evidence_expires_at timestamptz;

update visual_analysis_records
set retrieval_eligible = true
where retrieval_eligible is null;

alter table visual_analysis_records
  alter column retrieval_eligible set default true;

update visual_analysis_records
set retrieval_eligible = false
where status in ('superseded', 'failed');

alter table visual_analysis_records
  alter column retrieval_eligible set not null;

-- 4) Lease token columns for durable worker claims
alter table media_assets
  add column if not exists lease_token uuid;

alter table inbound_message_bundles
  add column if not exists lease_token uuid;

-- 5) Remove authenticated direct reads on sensitive media tables
drop policy if exists "p85 stage4b3 media assets scoped read" on media_assets;
drop policy if exists "p85 stage4b3 visual analysis scoped read" on visual_analysis_records;
drop policy if exists "p85 stage4b3 inbound bundles scoped read" on inbound_message_bundles;
drop policy if exists "p85 stage4b3 bundle items scoped read" on inbound_message_bundle_items;
drop policy if exists "p85 stage4b3 visual corrections scoped read" on visual_corrections;

create policy "p85 stage4b3 media assets deny direct access"
on media_assets for all
using (false)
with check (false);

create policy "p85 stage4b3 visual analysis deny direct access"
on visual_analysis_records for all
using (false)
with check (false);

create policy "p85 stage4b3 inbound bundles deny direct access"
on inbound_message_bundles for all
using (false)
with check (false);

create policy "p85 stage4b3 bundle items deny direct access"
on inbound_message_bundle_items for all
using (false)
with check (false);

create policy "p85 stage4b3 visual corrections deny direct access"
on visual_corrections for all
using (false)
with check (false);

revoke select on table media_assets from authenticated;
revoke select on table visual_analysis_records from authenticated;
revoke select on table inbound_message_bundles from authenticated;
revoke select on table inbound_message_bundle_items from authenticated;
revoke select on table visual_corrections from authenticated;

revoke execute on function p85_stage_4b3_load_bounded_media_metadata_v1(uuid, uuid, uuid, text, uuid, uuid[])
  from authenticated;

-- 6) Bundle decision commit uses V2 terminal status
create or replace function p85_stage_4b3_commit_bundle_decision_v1(
  p_tenant_id uuid,
  p_bundle_id uuid,
  p_expected_bundle_revision bigint,
  p_expected_conversation_revision bigint,
  p_idempotency_key text,
  p_decision_id uuid
)
returns inbound_message_bundles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bundle inbound_message_bundles%rowtype;
  v_conversation_revision bigint;
  v_cached bundle_decision_idempotency%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'idempotency_key_required';
  end if;

  select *
    into v_cached
  from bundle_decision_idempotency
  where tenant_id = p_tenant_id
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_cached.decision_id <> p_decision_id then
      raise exception 'idempotency_key_conflict';
    end if;
    select *
      into v_bundle
    from inbound_message_bundles
    where tenant_id = p_tenant_id
      and id = p_bundle_id;
    return v_bundle;
  end if;

  select *
    into v_bundle
  from inbound_message_bundles
  where tenant_id = p_tenant_id
    and id = p_bundle_id
  for update;

  if not found then
    raise exception 'bundle_not_found';
  end if;

  if v_bundle.bundle_revision <> p_expected_bundle_revision then
    raise exception 'stale_bundle_revision';
  end if;

  select coalesce(c.revision, 1)
    into v_conversation_revision
  from conversations c
  where c.tenant_id = p_tenant_id
    and c.id = v_bundle.conversation_id;

  if v_conversation_revision <> p_expected_conversation_revision then
    raise exception 'stale_conversation_revision';
  end if;

  if v_bundle.decision_id is not null and v_bundle.decision_id <> p_decision_id then
    raise exception 'bundle_decision_already_committed';
  end if;

  if v_bundle.status not in ('processing', 'ready') then
    raise exception 'bundle_not_processable';
  end if;

  update inbound_message_bundles
  set status = 'decided',
      decision_id = p_decision_id,
      lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_bundle_id
  returning *
  into v_bundle;

  insert into bundle_decision_idempotency (
    tenant_id,
    idempotency_key,
    bundle_id,
    bundle_revision,
    decision_id,
    conversation_revision
  ) values (
    p_tenant_id,
    p_idempotency_key,
    p_bundle_id,
    p_expected_bundle_revision,
    p_decision_id,
    p_expected_conversation_revision
  );

  return v_bundle;
end;
$$;

revoke all on function p85_stage_4b3_commit_bundle_decision_v1(uuid, uuid, bigint, bigint, text, uuid)
  from public, anon, authenticated;
grant execute on function p85_stage_4b3_commit_bundle_decision_v1(uuid, uuid, bigint, bigint, text, uuid)
  to service_role;

-- 7) Keep private bucket non-public; remove direct object access for anon/authenticated if present
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'p85-stage-4b3-media',
  'p85-stage-4b3-media',
  false,
  5242880,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "p85 stage4b3 media bucket public read" on storage.objects;
drop policy if exists "p85 stage4b3 media bucket authenticated read" on storage.objects;
drop policy if exists "p85 stage4b3 media bucket authenticated write" on storage.objects;
