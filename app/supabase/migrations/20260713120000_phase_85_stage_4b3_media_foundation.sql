-- Phase 85 Stage 4B-3: media foundation tables, private storage bucket, RLS, and worker claim RPCs.
-- Foundation-only: no webhook/UI/runtime ingress is enabled by this migration.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'p85-stage-4b3-media',
  'p85-stage-4b3-media',
  false,
  5242880,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists media_assets (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null,
  conversation_id uuid not null,
  message_id uuid not null,
  channel_event_id uuid,
  position integer not null default 1,
  provider_media_id text,
  provider_media_id_hash text,
  declared_mime_type text not null,
  detected_mime_type text,
  width integer,
  height integer,
  byte_size bigint,
  content_sha256 text,
  sanitized_full_object_key text,
  thumbnail_object_key text,
  status text not null default 'admitted',
  retry_count integer not null default 0,
  next_attempt_at timestamptz,
  lease_expires_at timestamptz,
  lease_owner text,
  stored_at timestamptz,
  expires_at timestamptz,
  deleted_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_assets_status_check check (
    status in (
      'admitted',
      'download_pending',
      'sanitized',
      'analysis_pending',
      'analysis_ready',
      'failed',
      'expired',
      'revoked'
    )
  ),
  constraint media_assets_retry_count_check check (retry_count >= 0 and retry_count <= 3),
  constraint media_assets_position_check check (position >= 1),
  constraint media_assets_dimensions_check check (
    (width is null and height is null)
    or (width is not null and height is not null and width > 0 and height > 0)
  )
);

create unique index if not exists media_assets_tenant_message_idx
  on media_assets (tenant_id, message_id);

create unique index if not exists media_assets_tenant_provider_media_hash_idx
  on media_assets (tenant_id, provider_media_id_hash)
  where provider_media_id_hash is not null;

create index if not exists media_assets_worker_claim_idx
  on media_assets (tenant_id, status, next_attempt_at, lease_expires_at, created_at);

alter table media_assets
  add constraint media_assets_tenant_id_id_key unique (tenant_id, id);

create table if not exists visual_analysis_records (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null,
  conversation_id uuid not null,
  media_asset_id uuid not null,
  message_id uuid not null,
  bundle_id uuid,
  analysis_revision bigint not null default 1,
  status text not null default 'pending',
  observation jsonb,
  superseded_by_analysis_id uuid,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visual_analysis_records_status_check check (
    status in ('pending', 'ready', 'failed', 'superseded')
  ),
  constraint visual_analysis_records_revision_check check (analysis_revision >= 1)
);

create unique index if not exists visual_analysis_records_tenant_asset_revision_idx
  on visual_analysis_records (tenant_id, media_asset_id, analysis_revision);

alter table visual_analysis_records
  add constraint visual_analysis_records_tenant_id_id_key unique (tenant_id, id);

create table if not exists inbound_message_bundles (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null,
  conversation_id uuid not null,
  anchor_message_id uuid not null,
  status text not null default 'open',
  opened_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  ready_at timestamptz not null default now(),
  bundle_revision bigint not null default 1,
  conversation_revision_at_open bigint not null default 1,
  item_count integer not null default 0,
  image_count integer not null default 0,
  unicode_codepoint_count integer not null default 0,
  retry_count integer not null default 0,
  next_attempt_at timestamptz,
  lease_expires_at timestamptz,
  lease_owner text,
  decision_id uuid,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbound_message_bundles_status_check check (
    status in ('open', 'ready', 'processing', 'completed', 'review_required', 'failed', 'superseded')
  ),
  constraint inbound_message_bundles_retry_count_check check (retry_count >= 0 and retry_count <= 3),
  constraint inbound_message_bundles_counts_check check (
    item_count >= 0
    and image_count >= 0
    and unicode_codepoint_count >= 0
  ),
  constraint inbound_message_bundles_revision_check check (bundle_revision >= 1)
);

create unique index if not exists inbound_message_bundles_one_active_per_conversation_idx
  on inbound_message_bundles (tenant_id, conversation_id)
  where status in ('open', 'ready', 'processing');

create index if not exists inbound_message_bundles_worker_claim_idx
  on inbound_message_bundles (tenant_id, status, ready_at, next_attempt_at, lease_expires_at, created_at);

alter table inbound_message_bundles
  add constraint inbound_message_bundles_tenant_id_id_key unique (tenant_id, id);

create table if not exists inbound_message_bundle_items (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  bundle_id uuid not null,
  message_id uuid not null,
  channel_event_id uuid,
  media_asset_id uuid,
  ordinal integer not null,
  item_type text not null,
  caption_text text,
  reply_to_provider_message_id text,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint inbound_message_bundle_items_item_type_check check (
    item_type in ('text', 'image', 'caption')
  ),
  constraint inbound_message_bundle_items_ordinal_check check (ordinal >= 1)
);

create unique index if not exists inbound_message_bundle_items_bundle_ordinal_idx
  on inbound_message_bundle_items (tenant_id, bundle_id, ordinal);

create unique index if not exists inbound_message_bundle_items_bundle_message_idx
  on inbound_message_bundle_items (tenant_id, bundle_id, message_id);

create table if not exists visual_corrections (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null,
  conversation_id uuid not null,
  analysis_id uuid not null,
  dietitian_id uuid not null,
  status text not null default 'submitted',
  reason_code text not null,
  explanation text not null,
  corrected_scene_type text,
  corrected_ocr_text text,
  corrected_entity_labels text[] not null default '{}',
  conversation_revision_at_submit bigint not null,
  analysis_revision_at_submit bigint not null,
  result_action text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visual_corrections_status_check check (
    status in ('submitted', 'applied_to_pending', 'manual_follow_up_required', 'closed')
  ),
  constraint visual_corrections_result_action_check check (
    result_action in ('supersede_rerun', 'invalidate_pending', 'manual_follow_up', 'closed_without_send')
  )
);

create index if not exists visual_corrections_tenant_analysis_idx
  on visual_corrections (tenant_id, analysis_id, created_at desc);

alter table media_assets
  add constraint media_assets_client_tenant_fk
  foreign key (tenant_id, client_id) references clients (tenant_id, id);

alter table media_assets
  add constraint media_assets_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references conversations (tenant_id, id);

alter table media_assets
  add constraint media_assets_message_tenant_fk
  foreign key (tenant_id, message_id) references messages (tenant_id, id);

alter table media_assets
  add constraint media_assets_channel_event_tenant_fk
  foreign key (tenant_id, channel_event_id) references channel_events (tenant_id, id);

alter table visual_analysis_records
  add constraint visual_analysis_records_client_tenant_fk
  foreign key (tenant_id, client_id) references clients (tenant_id, id);

alter table visual_analysis_records
  add constraint visual_analysis_records_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references conversations (tenant_id, id);

alter table visual_analysis_records
  add constraint visual_analysis_records_message_tenant_fk
  foreign key (tenant_id, message_id) references messages (tenant_id, id);

alter table visual_analysis_records
  add constraint visual_analysis_records_asset_tenant_fk
  foreign key (tenant_id, media_asset_id) references media_assets (tenant_id, id);

alter table visual_analysis_records
  add constraint visual_analysis_records_bundle_tenant_fk
  foreign key (tenant_id, bundle_id) references inbound_message_bundles (tenant_id, id);

alter table visual_analysis_records
  add constraint visual_analysis_records_supersede_tenant_fk
  foreign key (tenant_id, superseded_by_analysis_id) references visual_analysis_records (tenant_id, id);

alter table inbound_message_bundles
  add constraint inbound_message_bundles_client_tenant_fk
  foreign key (tenant_id, client_id) references clients (tenant_id, id);

alter table inbound_message_bundles
  add constraint inbound_message_bundles_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references conversations (tenant_id, id);

alter table inbound_message_bundles
  add constraint inbound_message_bundles_anchor_message_tenant_fk
  foreign key (tenant_id, anchor_message_id) references messages (tenant_id, id);

alter table inbound_message_bundles
  add constraint inbound_message_bundles_decision_tenant_fk
  foreign key (tenant_id, decision_id) references ai_decisions (tenant_id, id);

alter table inbound_message_bundle_items
  add constraint inbound_message_bundle_items_bundle_tenant_fk
  foreign key (tenant_id, bundle_id) references inbound_message_bundles (tenant_id, id);

alter table inbound_message_bundle_items
  add constraint inbound_message_bundle_items_message_tenant_fk
  foreign key (tenant_id, message_id) references messages (tenant_id, id);

alter table inbound_message_bundle_items
  add constraint inbound_message_bundle_items_channel_event_tenant_fk
  foreign key (tenant_id, channel_event_id) references channel_events (tenant_id, id);

alter table inbound_message_bundle_items
  add constraint inbound_message_bundle_items_media_asset_tenant_fk
  foreign key (tenant_id, media_asset_id) references media_assets (tenant_id, id);

alter table visual_corrections
  add constraint visual_corrections_client_tenant_fk
  foreign key (tenant_id, client_id) references clients (tenant_id, id);

alter table visual_corrections
  add constraint visual_corrections_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references conversations (tenant_id, id);

alter table visual_corrections
  add constraint visual_corrections_analysis_tenant_fk
  foreign key (tenant_id, analysis_id) references visual_analysis_records (tenant_id, id);

alter table visual_corrections
  add constraint visual_corrections_dietitian_tenant_fk
  foreign key (tenant_id, dietitian_id) references dietitians (tenant_id, id);

alter table channel_events drop constraint if exists channel_events_event_kind_check;
alter table channel_events add constraint channel_events_event_kind_check check (
  event_kind in (
    'client_message_text',
    'client_message_image',
    'client_message_media_unsupported',
    'business_human_echo_text',
    'business_human_echo_media_unsupported',
    'outbound_status',
    'history_client_message',
    'history_business_human_message',
    'message_edit',
    'message_revoke',
    'message_revision_unknown_target',
    'malformed_event',
    'duplicate_event',
    'duplicate_message',
    'unknown_account',
    'unknown_client',
    'ambiguous_client',
    'cross_tenant_collision',
    'unsupported_event'
  )
);

alter table media_assets enable row level security;
alter table visual_analysis_records enable row level security;
alter table inbound_message_bundles enable row level security;
alter table inbound_message_bundle_items enable row level security;
alter table visual_corrections enable row level security;

drop policy if exists "p85 stage4b3 media assets scoped read" on media_assets;
drop policy if exists "p85 stage4b3 media assets deny direct write" on media_assets;
drop policy if exists "p85 stage4b3 visual analysis scoped read" on visual_analysis_records;
drop policy if exists "p85 stage4b3 visual analysis deny direct write" on visual_analysis_records;
drop policy if exists "p85 stage4b3 inbound bundles scoped read" on inbound_message_bundles;
drop policy if exists "p85 stage4b3 inbound bundles deny direct write" on inbound_message_bundles;
drop policy if exists "p85 stage4b3 bundle items scoped read" on inbound_message_bundle_items;
drop policy if exists "p85 stage4b3 bundle items deny direct write" on inbound_message_bundle_items;
drop policy if exists "p85 stage4b3 visual corrections scoped read" on visual_corrections;
drop policy if exists "p85 stage4b3 visual corrections deny direct write" on visual_corrections;

create policy "p85 stage4b3 media assets scoped read"
on media_assets for select
using (
  is_tenant_member(tenant_id)
  and can_read_conversation(conversation_id)
);

create policy "p85 stage4b3 media assets deny direct write"
on media_assets for all
using (false)
with check (false);

create policy "p85 stage4b3 visual analysis scoped read"
on visual_analysis_records for select
using (
  is_tenant_member(tenant_id)
  and can_read_conversation(conversation_id)
);

create policy "p85 stage4b3 visual analysis deny direct write"
on visual_analysis_records for all
using (false)
with check (false);

create policy "p85 stage4b3 inbound bundles scoped read"
on inbound_message_bundles for select
using (
  is_tenant_member(tenant_id)
  and can_read_conversation(conversation_id)
);

create policy "p85 stage4b3 inbound bundles deny direct write"
on inbound_message_bundles for all
using (false)
with check (false);

create policy "p85 stage4b3 bundle items scoped read"
on inbound_message_bundle_items for select
using (
  is_tenant_member(tenant_id)
  and exists (
    select 1
    from inbound_message_bundles b
    where b.tenant_id = inbound_message_bundle_items.tenant_id
      and b.id = inbound_message_bundle_items.bundle_id
      and can_read_conversation(b.conversation_id)
  )
);

create policy "p85 stage4b3 bundle items deny direct write"
on inbound_message_bundle_items for all
using (false)
with check (false);

create policy "p85 stage4b3 visual corrections scoped read"
on visual_corrections for select
using (
  is_tenant_member(tenant_id)
  and can_read_conversation(conversation_id)
  and current_tenant_role(tenant_id) in ('owner', 'admin', 'dietitian')
);

create policy "p85 stage4b3 visual corrections deny direct write"
on visual_corrections for all
using (false)
with check (false);

grant select on table media_assets to authenticated;
grant select on table visual_analysis_records to authenticated;
grant select on table inbound_message_bundles to authenticated;
grant select on table inbound_message_bundle_items to authenticated;
grant select on table visual_corrections to authenticated;

grant all on table media_assets to service_role;
grant all on table visual_analysis_records to service_role;
grant all on table inbound_message_bundles to service_role;
grant all on table inbound_message_bundle_items to service_role;
grant all on table visual_corrections to service_role;

create or replace function p85_stage_4b3_claim_media_asset_worker(
  p_tenant_id uuid,
  p_worker_id text
)
returns setof media_assets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed media_assets%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if coalesce(trim(p_worker_id), '') = '' then
    raise exception 'worker_id_required';
  end if;

  select *
    into v_claimed
  from media_assets
  where tenant_id = p_tenant_id
    and status in ('download_pending', 'sanitized', 'analysis_pending')
    and retry_count < 3
    and (next_attempt_at is null or next_attempt_at <= now())
    and (lease_expires_at is null or lease_expires_at < now())
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update media_assets
  set lease_owner = p_worker_id,
      lease_expires_at = now() + interval '60 seconds',
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = v_claimed.id
  returning * into v_claimed;

  return next v_claimed;
end;
$$;

create or replace function p85_stage_4b3_release_media_asset_lease(
  p_tenant_id uuid,
  p_asset_id uuid,
  p_worker_id text,
  p_success boolean,
  p_failure_code text default null
)
returns media_assets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row media_assets%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  update media_assets
  set lease_owner = null,
      lease_expires_at = null,
      retry_count = case
        when p_success then retry_count
        else least(retry_count + 1, 3)
      end,
      next_attempt_at = case
        when p_success then null
        else now() + interval '30 seconds'
      end,
      failure_code = case when p_success then null else coalesce(p_failure_code, failure_code) end,
      status = case
        when p_success then status
        when least(retry_count + 1, 3) >= 3 then 'failed'
        else status
      end,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_asset_id
    and lease_owner = p_worker_id
  returning * into v_row;

  if not found then
    raise exception 'media_asset_lease_not_found';
  end if;

  return v_row;
end;
$$;

create or replace function p85_stage_4b3_claim_inbound_message_bundle_worker(
  p_tenant_id uuid,
  p_worker_id text
)
returns setof inbound_message_bundles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed inbound_message_bundles%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if coalesce(trim(p_worker_id), '') = '' then
    raise exception 'worker_id_required';
  end if;

  select *
    into v_claimed
  from inbound_message_bundles
  where tenant_id = p_tenant_id
    and status = 'ready'
    and ready_at <= now()
    and retry_count < 3
    and (next_attempt_at is null or next_attempt_at <= now())
    and (lease_expires_at is null or lease_expires_at < now())
  order by ready_at asc, created_at asc
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update inbound_message_bundles
  set status = 'processing',
      lease_owner = p_worker_id,
      lease_expires_at = now() + interval '60 seconds',
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = v_claimed.id
  returning * into v_claimed;

  return next v_claimed;
end;
$$;

create or replace function p85_stage_4b3_release_inbound_bundle_lease(
  p_tenant_id uuid,
  p_bundle_id uuid,
  p_worker_id text,
  p_success boolean,
  p_reopen boolean default false,
  p_failure_code text default null
)
returns inbound_message_bundles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row inbound_message_bundles%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  update inbound_message_bundles
  set lease_owner = null,
      lease_expires_at = null,
      status = case
        when p_success then status
        when p_reopen then 'open'
        when least(retry_count + 1, 3) >= 3 then 'failed'
        else 'ready'
      end,
      retry_count = case
        when p_success then retry_count
        else least(retry_count + 1, 3)
      end,
      next_attempt_at = case
        when p_success then null
        else now() + interval '30 seconds'
      end,
      failure_code = case when p_success then null else coalesce(p_failure_code, failure_code) end,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_bundle_id
    and lease_owner = p_worker_id
  returning * into v_row;

  if not found then
    raise exception 'bundle_lease_not_found';
  end if;

  return v_row;
end;
$$;

revoke all on function p85_stage_4b3_claim_media_asset_worker(uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4b3_release_media_asset_lease(uuid, uuid, text, boolean, text) from public, anon, authenticated;
revoke all on function p85_stage_4b3_claim_inbound_message_bundle_worker(uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4b3_release_inbound_bundle_lease(uuid, uuid, text, boolean, boolean, text) from public, anon, authenticated;

grant execute on function p85_stage_4b3_claim_media_asset_worker(uuid, text) to service_role;
grant execute on function p85_stage_4b3_release_media_asset_lease(uuid, uuid, text, boolean, text) to service_role;
grant execute on function p85_stage_4b3_claim_inbound_message_bundle_worker(uuid, text) to service_role;
grant execute on function p85_stage_4b3_release_inbound_bundle_lease(uuid, uuid, text, boolean, boolean, text) to service_role;
