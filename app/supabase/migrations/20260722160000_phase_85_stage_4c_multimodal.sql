-- Phase 85 Stage 4C Faz 8: multimodal attachment storage, derivatives, and client-record copies.

alter table ai_chat_jobs drop constraint if exists ai_chat_jobs_job_type_check;
alter table ai_chat_jobs add constraint ai_chat_jobs_job_type_check check (
  job_type in ('generation', 'title', 'attachment_scan', 'attachment_parse', 'attachment_cleanup')
);

create table if not exists ai_chat_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null,
  created_by_user_id uuid not null,
  scope_type text not null,
  client_id uuid,
  kind text not null,
  file_name text not null,
  mime_type text not null,
  byte_size bigint not null,
  content_sha256 text not null,
  object_key text not null,
  status text not null default 'upload_pending',
  failure_code text,
  page_count integer,
  duration_sec numeric,
  upload_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_chat_attachments_scope_check check (scope_type in ('general', 'client')),
  constraint ai_chat_attachments_kind_check check (kind in ('image', 'document', 'audio')),
  constraint ai_chat_attachments_status_check check (
    status in (
      'upload_pending', 'uploaded', 'quarantined', 'scanning', 'processing',
      'review_required', 'ready', 'rejected', 'failed', 'deleting', 'deleted'
    )
  )
);

alter table ai_chat_attachments
  add constraint ai_chat_attachments_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_attachments
  add constraint ai_chat_attachments_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references ai_chat_conversations (tenant_id, id) on delete cascade;

create index if not exists ai_chat_attachments_conversation_idx
  on ai_chat_attachments (tenant_id, conversation_id, created_at desc);

create table if not exists ai_chat_attachment_derivatives (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  attachment_id uuid not null,
  kind text not null,
  status text not null,
  content_sha256 text,
  excerpt text,
  locator jsonb not null default '{}'::jsonb,
  confidence numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_chat_attachment_derivatives_kind_check check (
    kind in ('sanitized_original', 'extracted_text', 'ocr_text', 'transcript', 'chunk')
  ),
  constraint ai_chat_attachment_derivatives_status_check check (
    status in ('pending', 'review_required', 'accepted', 'superseded', 'rejected')
  )
);

alter table ai_chat_attachment_derivatives
  add constraint ai_chat_attachment_derivatives_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_attachment_derivatives
  add constraint ai_chat_attachment_derivatives_attachment_tenant_fk
  foreign key (tenant_id, attachment_id) references ai_chat_attachments (tenant_id, id) on delete cascade;

create table if not exists client_record_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null,
  category text not null,
  title text not null,
  source_attachment_id uuid,
  object_key text not null,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint client_record_assets_category_check check (
    category in ('clinical_document', 'laboratory_result', 'diet_plan_reference', 'form_source', 'general_context')
  )
);

alter table client_record_assets
  add constraint client_record_assets_tenant_id_id_key unique (tenant_id, id);

create table if not exists client_record_asset_derivatives (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  asset_id uuid not null,
  kind text not null,
  status text not null,
  excerpt text,
  locator jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table client_record_asset_derivatives
  add constraint client_record_asset_derivatives_tenant_id_id_key unique (tenant_id, id);

alter table client_record_asset_derivatives
  add constraint client_record_asset_derivatives_asset_tenant_fk
  foreign key (tenant_id, asset_id) references client_record_assets (tenant_id, id) on delete cascade;

create table if not exists ai_chat_attachment_record_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  attachment_id uuid not null,
  client_record_asset_id uuid not null,
  status text not null,
  created_at timestamptz not null default now(),
  constraint ai_chat_attachment_record_transfers_status_check check (status in ('completed', 'failed'))
);

alter table ai_chat_attachment_record_transfers enable row level security;
alter table ai_chat_attachments enable row level security;
alter table ai_chat_attachment_derivatives enable row level security;
alter table client_record_assets enable row level security;
alter table client_record_asset_derivatives enable row level security;

drop policy if exists "p85 stage4c attachments creator read" on ai_chat_attachments;
create policy "p85 stage4c attachments creator read"
on ai_chat_attachments for select
to authenticated
using (created_by_user_id = auth.uid());

drop policy if exists "p85 stage4c attachments deny mutation" on ai_chat_attachments;
create policy "p85 stage4c attachments deny mutation"
on ai_chat_attachments for all
to authenticated
using (false)
with check (false);

revoke all on table ai_chat_attachments from public, anon;
revoke all on table ai_chat_attachment_derivatives from public, anon;
revoke all on table client_record_assets from public, anon;
revoke all on table client_record_asset_derivatives from public, anon;
revoke all on table ai_chat_attachment_record_transfers from public, anon;
grant select on table ai_chat_attachments to authenticated;
grant all on table ai_chat_attachments to service_role;
grant all on table ai_chat_attachment_derivatives to service_role;
grant all on table client_record_assets to service_role;
grant all on table client_record_asset_derivatives to service_role;
grant all on table ai_chat_attachment_record_transfers to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('p85-stage-4c-ai-chat', 'p85-stage-4c-ai-chat', false, 78643200, null),
  ('p85-stage-4c-client-records', 'p85-stage-4c-client-records', false, 78643200, null)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;
