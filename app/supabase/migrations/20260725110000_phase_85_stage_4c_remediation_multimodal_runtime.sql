-- Phase 85 Stage 4C remediation Faz 4: multimodal attachment runtime, message linkage, and send integration.

alter table ai_chat_attachments
  add column if not exists upload_token text;

create unique index if not exists ai_chat_attachments_upload_token_uidx
  on ai_chat_attachments (upload_token)
  where upload_token is not null;

create unique index if not exists ai_chat_message_versions_tenant_conversation_id_uidx
  on ai_chat_message_versions (tenant_id, conversation_id, id);

create unique index if not exists ai_chat_attachments_tenant_conversation_id_uidx
  on ai_chat_attachments (tenant_id, conversation_id, id);

create table if not exists ai_chat_message_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null,
  message_version_id uuid not null,
  attachment_id uuid not null,
  ordinal integer not null,
  created_at timestamptz not null default now(),
  constraint ai_chat_message_attachments_ordinal_check check (ordinal >= 1)
);

alter table ai_chat_message_attachments
  add constraint ai_chat_message_attachments_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_message_attachments
  add constraint ai_chat_message_attachments_conversation_tenant_fk
  foreign key (tenant_id, conversation_id)
  references ai_chat_conversations (tenant_id, id) on delete cascade;

alter table ai_chat_message_attachments
  add constraint ai_chat_message_attachments_version_conversation_fk
  foreign key (tenant_id, conversation_id, message_version_id)
  references ai_chat_message_versions (tenant_id, conversation_id, id) on delete cascade;

alter table ai_chat_message_attachments
  add constraint ai_chat_message_attachments_attachment_conversation_fk
  foreign key (tenant_id, conversation_id, attachment_id)
  references ai_chat_attachments (tenant_id, conversation_id, id) on delete cascade;

create unique index if not exists ai_chat_message_attachments_version_attachment_uidx
  on ai_chat_message_attachments (tenant_id, message_version_id, attachment_id);

create unique index if not exists ai_chat_message_attachments_version_ordinal_uidx
  on ai_chat_message_attachments (tenant_id, message_version_id, ordinal);

create index if not exists ai_chat_message_attachments_attachment_idx
  on ai_chat_message_attachments (tenant_id, attachment_id);

alter table ai_chat_message_attachments enable row level security;

drop policy if exists "p85 stage4c message attachments deny all" on ai_chat_message_attachments;
create policy "p85 stage4c message attachments deny all"
on ai_chat_message_attachments for all
to authenticated
using (false)
with check (false);

revoke all on table ai_chat_message_attachments from public, anon;
grant all on table ai_chat_message_attachments to service_role;

create or replace function p85_stage_4c_build_attachment_object_key(
  p_tenant_id uuid,
  p_user_id uuid,
  p_conversation_id uuid,
  p_attachment_id uuid
)
returns text
language sql
immutable
set search_path = public
as $$
  select concat_ws('/', p_tenant_id::text, p_user_id::text, p_conversation_id::text, p_attachment_id::text)
$$;

create or replace function p85_stage_4c_resolve_attachment_kind_from_mime(p_mime_type text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_mime text := lower(trim(coalesce(p_mime_type, '')));
begin
  if v_mime in ('image/jpeg', 'image/png', 'image/webp') then
    return 'image';
  end if;
  if v_mime in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv'
  ) then
    return 'document';
  end if;
  if v_mime in ('audio/wav', 'audio/x-wav') or v_mime like 'audio/ogg%' then
    return 'audio';
  end if;
  return null;
end;
$$;

create or replace function p85_stage_4c_is_rejected_attachment_file_name(p_file_name text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(trim(coalesce(p_file_name, ''))) ~ '\.(docm|xls|xlsx|zip|rar|svg|html|htm|exe|bat|cmd|msi)$'
$$;

create or replace function p85_stage_4c_attachment_derivative_to_json(p_row ai_chat_attachment_derivatives)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'attachment_id', p_row.attachment_id,
    'kind', p_row.kind,
    'status', p_row.status,
    'excerpt', p_row.excerpt,
    'locator', coalesce(
      nullif(p_row.payload ->> 'citation', ''),
      case when p_row.locator ? 'section' then p_row.locator ->> 'section' else null end
    ),
    'confidence', p_row.confidence,
    'created_at', p_row.created_at
  )
$$;

create or replace function p85_stage_4c_attachment_to_json(
  p_attachment ai_chat_attachments,
  p_include_derivatives boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_derivatives jsonb := '[]'::jsonb;
begin
  if p_include_derivatives then
    select coalesce(
      jsonb_agg(
        p85_stage_4c_attachment_derivative_to_json(d)
        order by d.created_at asc
      ),
      '[]'::jsonb
    )
      into v_derivatives
    from ai_chat_attachment_derivatives d
    where d.tenant_id = p_attachment.tenant_id
      and d.attachment_id = p_attachment.id
      and d.status <> 'superseded';
  end if;

  return jsonb_build_object(
    'id', p_attachment.id,
    'tenant_id', p_attachment.tenant_id,
    'conversation_id', p_attachment.conversation_id,
    'created_by_user_id', p_attachment.created_by_user_id,
    'scope_type', p_attachment.scope_type,
    'client_id', p_attachment.client_id,
    'kind', p_attachment.kind,
    'file_name', p_attachment.file_name,
    'mime_type', p_attachment.mime_type,
    'byte_size', p_attachment.byte_size,
    'content_sha256', p_attachment.content_sha256,
    'status', p_attachment.status,
    'failure_code', p_attachment.failure_code,
    'page_count', p_attachment.page_count,
    'duration_sec', p_attachment.duration_sec,
    'derivatives', v_derivatives,
    'created_at', p_attachment.created_at,
    'updated_at', p_attachment.updated_at
  );
end;
$$;

create or replace function p85_stage_4c_validate_attachment_upload_limits(
  p_tenant_id uuid,
  p_conversation_id uuid,
  p_kind text,
  p_byte_size bigint
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_existing_count integer;
  v_image_count integer;
  v_document_count integer;
  v_audio_count integer;
  v_total_bytes bigint;
begin
  select
    count(*) filter (where status <> 'deleted'),
    count(*) filter (where kind = 'image' and status <> 'deleted'),
    count(*) filter (where kind = 'document' and status <> 'deleted'),
    count(*) filter (where kind = 'audio' and status <> 'deleted'),
    coalesce(sum(byte_size) filter (where status <> 'deleted'), 0)
    into v_existing_count, v_image_count, v_document_count, v_audio_count, v_total_bytes
  from ai_chat_attachments
  where tenant_id = p_tenant_id
    and conversation_id = p_conversation_id;

  if v_existing_count >= 10 then
    raise exception 'ai_chat_attachment_count_limit';
  end if;

  if (v_total_bytes + p_byte_size) > 78643200 then
    raise exception 'ai_chat_attachment_size_limit';
  end if;

  if p_kind = 'image' then
    if v_image_count >= 4 then
      raise exception 'ai_chat_attachment_count_limit';
    end if;
    if p_byte_size > 10485760 then
      raise exception 'ai_chat_attachment_size_limit';
    end if;
  elsif p_kind = 'document' then
    if v_document_count >= 5 then
      raise exception 'ai_chat_attachment_count_limit';
    end if;
    if p_byte_size > 26214400 then
      raise exception 'ai_chat_attachment_size_limit';
    end if;
  elsif p_kind = 'audio' then
    if v_audio_count >= 4 then
      raise exception 'ai_chat_attachment_count_limit';
    end if;
    if p_byte_size > 16777216 then
      raise exception 'ai_chat_attachment_size_limit';
    end if;
  else
    raise exception 'ai_chat_attachment_unsupported_mime';
  end if;
end;
$$;

create or replace function p85_stage_4c_create_attachment_upload_session_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_conversation_id uuid,
  p_file_name text,
  p_mime_type text,
  p_byte_size bigint,
  p_content_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation ai_chat_conversations%rowtype;
  v_kind text;
  v_attachment_id uuid := gen_random_uuid();
  v_upload_token text := gen_random_uuid()::text;
  v_object_key text;
  v_upload_expires_at timestamptz := now() + interval '600 seconds';
  v_attachment ai_chat_attachments%rowtype;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if not p85_stage_4c_validate_creator_membership(p_tenant_id, p_user_id, p_dietitian_id) then
    raise exception 'ai_chat_creator_membership_invalid';
  end if;

  if p_byte_size is null or p_byte_size <= 0 then
    raise exception 'ai_chat_attachment_size_limit';
  end if;

  if coalesce(trim(p_content_sha256), '') = '' then
    raise exception 'ai_chat_attachment_hash_mismatch';
  end if;

  if p85_stage_4c_is_rejected_attachment_file_name(p_file_name) then
    raise exception 'ai_chat_attachment_rejected_extension';
  end if;

  v_kind := p85_stage_4c_resolve_attachment_kind_from_mime(p_mime_type);
  if v_kind is null then
    raise exception 'ai_chat_attachment_unsupported_mime';
  end if;

  select *
    into v_conversation
  from ai_chat_conversations c
  where c.tenant_id = p_tenant_id
    and c.id = p_conversation_id
    and c.created_by_user_id = p_user_id
    and c.status = 'active'
    and (
      c.scope_type = 'general'
      or p85_stage_4c_resolve_client_access_v1(
        p_tenant_id, c.client_id, p_user_id, p_dietitian_id, p_role
      )
    );

  if not found then
    raise exception 'ai_chat_not_found';
  end if;

  perform p85_stage_4c_validate_attachment_upload_limits(
    p_tenant_id,
    p_conversation_id,
    v_kind,
    p_byte_size
  );

  v_object_key := p85_stage_4c_build_attachment_object_key(
    p_tenant_id,
    p_user_id,
    p_conversation_id,
    v_attachment_id
  );

  insert into ai_chat_attachments (
    id,
    tenant_id,
    conversation_id,
    created_by_user_id,
    scope_type,
    client_id,
    kind,
    file_name,
    mime_type,
    byte_size,
    content_sha256,
    object_key,
    status,
    upload_expires_at,
    upload_token,
    created_at,
    updated_at
  )
  values (
    v_attachment_id,
    p_tenant_id,
    p_conversation_id,
    p_user_id,
    v_conversation.scope_type,
    v_conversation.client_id,
    v_kind,
    trim(p_file_name),
    lower(trim(p_mime_type)),
    p_byte_size,
    lower(trim(p_content_sha256)),
    v_object_key,
    'upload_pending',
    v_upload_expires_at,
    v_upload_token,
    v_now,
    v_now
  )
  returning * into v_attachment;

  return jsonb_build_object(
    'attachment', p85_stage_4c_attachment_to_json(v_attachment, false),
    'object_key', v_object_key,
    'upload_expires_at', v_upload_expires_at,
    'upload_token', v_upload_token
  );
end;
$$;

create or replace function p85_stage_4c_complete_attachment_upload_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_attachment_id uuid,
  p_upload_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attachment ai_chat_attachments%rowtype;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_attachment
  from ai_chat_attachments a
  where a.tenant_id = p_tenant_id
    and a.id = p_attachment_id
    and a.created_by_user_id = p_user_id
  for update;

  if not found then
    raise exception 'ai_chat_attachment_not_found';
  end if;

  if v_attachment.status not in ('upload_pending', 'uploaded') then
    raise exception 'ai_chat_attachment_invalid_state';
  end if;

  if p_upload_token is not null
     and coalesce(v_attachment.upload_token, '') <> p_upload_token then
    raise exception 'ai_chat_attachment_not_found';
  end if;

  if v_attachment.upload_expires_at is not null
     and v_attachment.upload_expires_at < v_now then
    raise exception 'ai_chat_attachment_upload_expired';
  end if;

  update ai_chat_attachments
  set status = 'scanning',
      upload_token = null,
      updated_at = v_now
  where tenant_id = p_tenant_id
    and id = p_attachment_id
  returning * into v_attachment;

  return p85_stage_4c_attachment_to_json(v_attachment, true);
end;
$$;

create or replace function p85_stage_4c_get_attachment_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_attachment_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_attachment ai_chat_attachments%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into v_attachment
  from ai_chat_attachments a
  where a.tenant_id = p_tenant_id
    and a.id = p_attachment_id
    and a.created_by_user_id = p_user_id
    and a.status <> 'deleted';

  if not found then
    raise exception 'ai_chat_attachment_not_found';
  end if;

  return p85_stage_4c_attachment_to_json(v_attachment, true);
end;
$$;

create or replace function p85_stage_4c_list_conversation_attachments_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_conversation_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_items jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if not exists (
    select 1
    from ai_chat_conversations c
    where c.tenant_id = p_tenant_id
      and c.id = p_conversation_id
      and c.created_by_user_id = p_user_id
  ) then
    raise exception 'ai_chat_not_found';
  end if;

  select coalesce(
    jsonb_agg(
      p85_stage_4c_attachment_to_json(a, true)
      order by a.created_at asc
    ),
    '[]'::jsonb
  )
    into v_items
  from ai_chat_attachments a
  where a.tenant_id = p_tenant_id
    and a.conversation_id = p_conversation_id
    and a.created_by_user_id = p_user_id
    and a.status <> 'deleted';

  return v_items;
end;
$$;

create or replace function p85_stage_4c_delete_attachment_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_attachment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  update ai_chat_attachments
  set status = 'deleting',
      updated_at = v_now
  where tenant_id = p_tenant_id
    and id = p_attachment_id
    and created_by_user_id = p_user_id
    and status not in ('deleted', 'deleting');

  if not found then
    raise exception 'ai_chat_attachment_not_found';
  end if;

  update ai_chat_attachments
  set status = 'deleted',
      updated_at = v_now
  where tenant_id = p_tenant_id
    and id = p_attachment_id;
end;
$$;

create or replace function p85_stage_4c_update_attachment_status_v1(
  p_tenant_id uuid,
  p_attachment_id uuid,
  p_expected_status text,
  p_new_status text,
  p_failure_code text default null,
  p_page_count integer default null,
  p_duration_sec numeric default null
)
returns ai_chat_attachments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attachment ai_chat_attachments%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_new_status not in (
    'upload_pending', 'uploaded', 'quarantined', 'scanning', 'processing',
    'review_required', 'ready', 'rejected', 'failed', 'deleting', 'deleted'
  ) then
    raise exception 'ai_chat_attachment_invalid_state';
  end if;

  update ai_chat_attachments
  set status = p_new_status,
      failure_code = coalesce(p_failure_code, failure_code),
      page_count = coalesce(p_page_count, page_count),
      duration_sec = coalesce(p_duration_sec, duration_sec),
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_attachment_id
    and status = p_expected_status
  returning * into v_attachment;

  if not found then
    raise exception 'ai_chat_attachment_status_conflict';
  end if;

  return v_attachment;
end;
$$;

create or replace function p85_stage_4c_save_attachment_derivative_v1(
  p_tenant_id uuid,
  p_attachment_id uuid,
  p_kind text,
  p_status text,
  p_content_sha256 text default null,
  p_excerpt text default null,
  p_locator jsonb default '{}'::jsonb,
  p_confidence numeric default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_derivative_id uuid := gen_random_uuid();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if not exists (
    select 1
    from ai_chat_attachments a
    where a.tenant_id = p_tenant_id
      and a.id = p_attachment_id
  ) then
    raise exception 'ai_chat_attachment_not_found';
  end if;

  if p_kind not in ('sanitized_original', 'extracted_text', 'ocr_text', 'transcript', 'chunk') then
    raise exception 'ai_chat_attachment_derivative_missing';
  end if;

  if p_status not in ('pending', 'review_required', 'accepted', 'superseded', 'rejected') then
    raise exception 'ai_chat_attachment_derivative_missing';
  end if;

  update ai_chat_attachment_derivatives
  set status = 'superseded'
  where tenant_id = p_tenant_id
    and attachment_id = p_attachment_id
    and kind = p_kind
    and status <> 'superseded';

  insert into ai_chat_attachment_derivatives (
    id,
    tenant_id,
    attachment_id,
    kind,
    status,
    content_sha256,
    excerpt,
    locator,
    confidence,
    payload
  )
  values (
    v_derivative_id,
    p_tenant_id,
    p_attachment_id,
    p_kind,
    p_status,
    p_content_sha256,
    p_excerpt,
    coalesce(p_locator, '{}'::jsonb),
    p_confidence,
    coalesce(p_payload, '{}'::jsonb)
  );

  return v_derivative_id;
end;
$$;

create or replace function p85_stage_4c_accept_attachment_derivative_correction_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_attachment_id uuid,
  p_derivative_id uuid,
  p_corrected_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attachment ai_chat_attachments%rowtype;
  v_current ai_chat_attachment_derivatives%rowtype;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if coalesce(trim(p_corrected_text), '') = '' then
    raise exception 'ai_chat_attachment_derivative_missing';
  end if;

  select *
    into v_attachment
  from ai_chat_attachments a
  where a.tenant_id = p_tenant_id
    and a.id = p_attachment_id
    and a.created_by_user_id = p_user_id
  for update;

  if not found then
    raise exception 'ai_chat_attachment_not_found';
  end if;

  select *
    into v_current
  from ai_chat_attachment_derivatives d
  where d.tenant_id = p_tenant_id
    and d.id = p_derivative_id
    and d.attachment_id = p_attachment_id
    and d.status <> 'superseded';

  if not found then
    raise exception 'ai_chat_attachment_derivative_missing';
  end if;

  perform p85_stage_4c_save_attachment_derivative_v1(
    p_tenant_id,
    p_attachment_id,
    v_current.kind,
    'accepted',
    null,
    p_corrected_text,
    v_current.locator,
    1,
    coalesce(v_current.payload, '{}'::jsonb) || jsonb_build_object('corrected_by_user_id', p_user_id)
  );

  update ai_chat_attachments
  set status = 'ready',
      updated_at = v_now
  where tenant_id = p_tenant_id
    and id = p_attachment_id
  returning * into v_attachment;

  return p85_stage_4c_attachment_to_json(v_attachment, true);
end;
$$;

create or replace function p85_stage_4c_transfer_attachment_to_client_record_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_attachment_id uuid,
  p_client_id uuid,
  p_category text,
  p_title text,
  p_preview_accepted boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attachment ai_chat_attachments%rowtype;
  v_asset_id uuid := gen_random_uuid();
  v_object_key text;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if not coalesce(p_preview_accepted, false) then
    raise exception 'ai_chat_attachment_transfer_preview_required';
  end if;

  if p_category not in (
    'clinical_document', 'laboratory_result', 'diet_plan_reference', 'form_source', 'general_context'
  ) then
    raise exception 'ai_chat_attachment_transfer_scope_mismatch';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'ai_chat_attachment_transfer_scope_mismatch';
  end if;

  select *
    into v_attachment
  from ai_chat_attachments a
  where a.tenant_id = p_tenant_id
    and a.id = p_attachment_id
    and a.created_by_user_id = p_user_id
    and a.status not in ('deleted', 'deleting')
  for update;

  if not found then
    raise exception 'ai_chat_attachment_not_found';
  end if;

  if v_attachment.scope_type <> 'client' or v_attachment.client_id is distinct from p_client_id then
    raise exception 'ai_chat_attachment_transfer_scope_mismatch';
  end if;

  v_object_key := concat_ws('/', p_tenant_id::text, p_client_id::text, v_asset_id::text);

  insert into client_record_assets (
    id,
    tenant_id,
    client_id,
    category,
    title,
    source_attachment_id,
    object_key,
    created_by_user_id
  )
  values (
    v_asset_id,
    p_tenant_id,
    p_client_id,
    p_category,
    trim(p_title),
    v_attachment.id,
    v_object_key,
    p_user_id
  );

  insert into ai_chat_attachment_record_transfers (
    tenant_id,
    attachment_id,
    client_record_asset_id,
    status
  )
  values (
    p_tenant_id,
    v_attachment.id,
    v_asset_id,
    'completed'
  );

  return jsonb_build_object(
    'asset_id', v_asset_id,
    'object_key', v_object_key
  );
end;
$$;

create or replace function p85_stage_4c_enqueue_attachment_job_v1(
  p_tenant_id uuid,
  p_conversation_id uuid,
  p_user_id uuid,
  p_job_type text,
  p_attachment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid := gen_random_uuid();
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_job_type not in ('attachment_scan', 'attachment_parse', 'attachment_cleanup') then
    raise exception 'ai_chat_attachment_invalid_state';
  end if;

  if not exists (
    select 1
    from ai_chat_attachments a
    where a.tenant_id = p_tenant_id
      and a.id = p_attachment_id
      and a.conversation_id = p_conversation_id
      and a.created_by_user_id = p_user_id
      and a.status <> 'deleted'
  ) then
    raise exception 'ai_chat_attachment_not_found';
  end if;

  insert into ai_chat_jobs (
    id,
    tenant_id,
    job_type,
    run_id,
    conversation_id,
    created_by_user_id,
    status,
    payload,
    next_attempt_at,
    created_at,
    updated_at
  )
  values (
    v_job_id,
    p_tenant_id,
    p_job_type,
    null,
    p_conversation_id,
    p_user_id,
    'queued',
    jsonb_build_object('attachmentId', p_attachment_id),
    v_now,
    v_now,
    v_now
  );

  return v_job_id;
end;
$$;

create or replace function p85_stage_4c_list_message_attachment_derivatives_v1(
  p_tenant_id uuid,
  p_message_version_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_items jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'attachment_id', d.attachment_id,
        'kind', d.kind,
        'status', d.status,
        'excerpt', d.excerpt,
        'locator', coalesce(
          nullif(d.payload ->> 'citation', ''),
          case when d.locator ? 'section' then d.locator ->> 'section' else null end
        ),
        'confidence', d.confidence,
        'content_sha256', d.content_sha256,
        'payload', d.payload,
        'created_at', d.created_at,
        'ordinal', ma.ordinal,
        'file_name', a.file_name,
        'mime_type', a.mime_type,
        'attachment_kind', a.kind
      )
      order by ma.ordinal asc, d.created_at asc
    ),
    '[]'::jsonb
  )
    into v_items
  from ai_chat_message_attachments ma
  join ai_chat_attachments a
    on a.tenant_id = ma.tenant_id
   and a.id = ma.attachment_id
  join ai_chat_attachment_derivatives d
    on d.tenant_id = ma.tenant_id
   and d.attachment_id = ma.attachment_id
  where ma.tenant_id = p_tenant_id
    and ma.message_version_id = p_message_version_id
    and d.status = 'accepted';

  return v_items;
end;
$$;

create or replace function p85_stage_4c_send_message_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_chat_id uuid,
  p_expected_revision bigint,
  p_body text,
  p_branch_id uuid,
  p_request_id text,
  p_body_hash text,
  p_attachment_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing ai_chat_mutation_ledger%rowtype;
  v_conversation ai_chat_conversations%rowtype;
  v_branch ai_chat_branches%rowtype;
  v_message ai_chat_messages%rowtype;
  v_version ai_chat_message_versions%rowtype;
  v_run ai_chat_runs%rowtype;
  v_digest_parts text[];
  v_now timestamptz := now();
  v_body text := coalesce(p_body, '');
  v_attachment_ids uuid[] := coalesce(p_attachment_ids, '{}'::uuid[]);
  v_attachment_count integer;
  v_attachment_id uuid;
  v_attachment ai_chat_attachments%rowtype;
  v_ordinal integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  v_attachment_count := coalesce(array_length(v_attachment_ids, 1), 0);

  if coalesce(trim(v_body), '') = '' and v_attachment_count = 0 then
    raise exception 'ai_chat_message_body_required';
  end if;

  if coalesce(trim(v_body), '') <> '' and char_length(v_body) > 12000 then
    raise exception 'ai_chat_message_body_too_long';
  end if;

  if v_attachment_count > 10 then
    raise exception 'ai_chat_attachment_count_limit';
  end if;

  if v_attachment_count > 0
     and v_attachment_count <> (
       select count(distinct attachment_id)
       from unnest(v_attachment_ids) as attachment_id
     ) then
    raise exception 'ai_chat_attachment_not_ready';
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
      'run_id', v_digest_parts[1]::uuid,
      'message_id', v_digest_parts[2]::uuid,
      'message_version_id', v_digest_parts[3]::uuid,
      'conversation_revision', v_digest_parts[4]::bigint
    );
  end if;

  select *
    into v_conversation
  from ai_chat_conversations c
  where c.tenant_id = p_tenant_id
    and c.id = p_chat_id
    and c.created_by_user_id = p_user_id
    and (
      c.scope_type = 'general'
      or p85_stage_4c_resolve_client_access_v1(
        p_tenant_id, c.client_id, p_user_id, p_dietitian_id, p_role
      )
    )
  for update;

  if not found then
    raise exception 'ai_chat_not_found';
  end if;
  if v_conversation.status <> 'active' then
    raise exception 'ai_chat_conversation_locked';
  end if;
  if v_conversation.revision <> p_expected_revision then
    raise exception 'ai_chat_revision_conflict:%', v_conversation.revision;
  end if;

  select *
    into v_branch
  from ai_chat_branches b
  where b.tenant_id = p_tenant_id
    and b.conversation_id = p_chat_id
    and b.id = coalesce(p_branch_id, v_conversation.active_branch_id)
    and b.created_by_user_id = p_user_id
    and coalesce(b.status, 'active') = 'active'
  for update;

  if not found then
    raise exception 'ai_chat_not_found';
  end if;

  if exists (
    select 1
    from ai_chat_runs r
    where r.tenant_id = p_tenant_id
      and r.conversation_id = p_chat_id
      and p85_stage_4c_is_active_run_status(r.status)
  ) then
    raise exception 'ai_chat_active_run_conflict';
  end if;

  perform p85_stage_4c_assert_user_run_budget(p_tenant_id, p_user_id, 3);

  if v_attachment_count > 0 then
    foreach v_attachment_id in array v_attachment_ids loop
      select *
        into v_attachment
      from ai_chat_attachments a
      where a.tenant_id = p_tenant_id
        and a.id = v_attachment_id
      for update;

      if not found then
        raise exception 'ai_chat_attachment_not_found';
      end if;

      if v_attachment.conversation_id <> p_chat_id
         or v_attachment.created_by_user_id <> p_user_id then
        raise exception 'ai_chat_attachment_not_ready';
      end if;

      if v_attachment.status <> 'ready' then
        raise exception 'ai_chat_attachment_not_ready';
      end if;

      if exists (
        select 1
        from ai_chat_message_attachments ma
        where ma.tenant_id = p_tenant_id
          and ma.attachment_id = v_attachment_id
      ) then
        raise exception 'ai_chat_attachment_not_ready';
      end if;
    end loop;
  end if;

  insert into ai_chat_messages (
    tenant_id,
    conversation_id,
    created_by_user_id,
    role,
    author_user_id,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    p_chat_id,
    p_user_id,
    'user',
    p_user_id,
    v_now,
    v_now
  )
  returning * into v_message;

  insert into ai_chat_message_versions (
    tenant_id,
    conversation_id,
    message_id,
    branch_id,
    created_by_user_id,
    body,
    body_sha256,
    parent_version_id,
    created_at
  )
  values (
    p_tenant_id,
    p_chat_id,
    v_message.id,
    v_branch.id,
    p_user_id,
    v_body,
    p85_stage_4c_message_body_sha256(v_body),
    v_branch.active_leaf_version_id,
    v_now
  )
  returning * into v_version;

  if v_attachment_count > 0 then
    foreach v_attachment_id in array v_attachment_ids loop
      v_ordinal := v_ordinal + 1;
      insert into ai_chat_message_attachments (
        tenant_id,
        conversation_id,
        message_version_id,
        attachment_id,
        ordinal
      )
      values (
        p_tenant_id,
        p_chat_id,
        v_version.id,
        v_attachment_id,
        v_ordinal
      );
    end loop;
  end if;

  update ai_chat_branches
  set active_leaf_version_id = v_version.id,
      revision = revision + 1,
      updated_at = v_now
  where tenant_id = p_tenant_id
    and id = v_branch.id;

  insert into ai_chat_runs (
    tenant_id,
    conversation_id,
    created_by_user_id,
    trigger_message_version_id,
    status,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    p_chat_id,
    p_user_id,
    v_version.id,
    'queued',
    v_now,
    v_now
  )
  returning * into v_run;

  insert into ai_chat_jobs (
    tenant_id,
    job_type,
    run_id,
    conversation_id,
    created_by_user_id,
    status,
    payload,
    next_attempt_at,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    'generation',
    v_run.id,
    p_chat_id,
    p_user_id,
    'queued',
    jsonb_build_object('runId', v_run.id, 'messageVersionId', v_version.id),
    v_now,
    v_now,
    v_now
  );

  perform p85_stage_4c_append_accepted_event(p_tenant_id, v_run.id);

  update ai_chat_conversations
  set active_branch_id = v_branch.id,
      revision = revision + 1,
      last_message_at = v_now,
      updated_at = v_now
  where tenant_id = p_tenant_id
    and id = p_chat_id
  returning * into v_conversation;

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
    concat_ws('|', v_run.id::text, v_message.id::text, v_version.id::text, v_conversation.revision::text)
  );

  return jsonb_build_object(
    'run_id', v_run.id,
    'message_id', v_message.id,
    'message_version_id', v_version.id,
    'conversation_revision', v_conversation.revision
  );
end;
$$;

revoke all on function p85_stage_4c_build_attachment_object_key(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_resolve_attachment_kind_from_mime(text) from public, anon, authenticated;
revoke all on function p85_stage_4c_is_rejected_attachment_file_name(text) from public, anon, authenticated;
revoke all on function p85_stage_4c_attachment_derivative_to_json(ai_chat_attachment_derivatives) from public, anon, authenticated;
revoke all on function p85_stage_4c_attachment_to_json(ai_chat_attachments, boolean) from public, anon, authenticated;
revoke all on function p85_stage_4c_validate_attachment_upload_limits(uuid, uuid, text, bigint) from public, anon, authenticated;
revoke all on function p85_stage_4c_create_attachment_upload_session_v1(uuid, uuid, uuid, text, uuid, text, text, bigint, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_complete_attachment_upload_v1(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_get_attachment_v1(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_list_conversation_attachments_v1(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_delete_attachment_v1(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_update_attachment_status_v1(uuid, uuid, text, text, text, integer, numeric) from public, anon, authenticated;
revoke all on function p85_stage_4c_save_attachment_derivative_v1(uuid, uuid, text, text, text, text, jsonb, numeric, jsonb) from public, anon, authenticated;
revoke all on function p85_stage_4c_accept_attachment_derivative_correction_v1(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function p85_stage_4c_transfer_attachment_to_client_record_v1(uuid, uuid, uuid, uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function p85_stage_4c_enqueue_attachment_job_v1(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_list_message_attachment_derivatives_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function p85_stage_4c_send_message_v1(uuid, uuid, uuid, text, uuid, bigint, text, uuid, text, text, uuid[]) from public, anon, authenticated;
revoke all on function p85_stage_4c_send_message_v1(uuid, uuid, uuid, text, uuid, bigint, text, uuid, text, text) from public, anon, authenticated;

grant execute on function p85_stage_4c_build_attachment_object_key(uuid, uuid, uuid, uuid) to service_role;
grant execute on function p85_stage_4c_resolve_attachment_kind_from_mime(text) to service_role;
grant execute on function p85_stage_4c_is_rejected_attachment_file_name(text) to service_role;
grant execute on function p85_stage_4c_attachment_derivative_to_json(ai_chat_attachment_derivatives) to service_role;
grant execute on function p85_stage_4c_attachment_to_json(ai_chat_attachments, boolean) to service_role;
grant execute on function p85_stage_4c_validate_attachment_upload_limits(uuid, uuid, text, bigint) to service_role;
grant execute on function p85_stage_4c_create_attachment_upload_session_v1(uuid, uuid, uuid, text, uuid, text, text, bigint, text) to service_role;
grant execute on function p85_stage_4c_complete_attachment_upload_v1(uuid, uuid, uuid, text) to service_role;
grant execute on function p85_stage_4c_get_attachment_v1(uuid, uuid, uuid) to service_role;
grant execute on function p85_stage_4c_list_conversation_attachments_v1(uuid, uuid, uuid) to service_role;
grant execute on function p85_stage_4c_delete_attachment_v1(uuid, uuid, uuid) to service_role;
grant execute on function p85_stage_4c_update_attachment_status_v1(uuid, uuid, text, text, text, integer, numeric) to service_role;
grant execute on function p85_stage_4c_save_attachment_derivative_v1(uuid, uuid, text, text, text, text, jsonb, numeric, jsonb) to service_role;
grant execute on function p85_stage_4c_accept_attachment_derivative_correction_v1(uuid, uuid, uuid, uuid, text) to service_role;
grant execute on function p85_stage_4c_transfer_attachment_to_client_record_v1(uuid, uuid, uuid, uuid, text, text, boolean) to service_role;
grant execute on function p85_stage_4c_enqueue_attachment_job_v1(uuid, uuid, uuid, text, uuid) to service_role;
grant execute on function p85_stage_4c_list_message_attachment_derivatives_v1(uuid, uuid) to service_role;
grant execute on function p85_stage_4c_send_message_v1(uuid, uuid, uuid, text, uuid, bigint, text, uuid, text, text, uuid[]) to service_role;
