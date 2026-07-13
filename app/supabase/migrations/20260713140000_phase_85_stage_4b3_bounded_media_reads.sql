-- Phase 85 Stage 4B-3 Phase 9: bounded media metadata reads and service-role stream resolution.

create or replace function p85_stage_4b3_load_bounded_media_metadata_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_conversation_id uuid,
  p_message_ids uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not p85_stage_4b_actor_context_valid(p_tenant_id, p_user_id, p_dietitian_id, p_role)
     or p_role = 'auditor'
     or not p85_stage_4b2_actor_can_read_conversation(
       p_tenant_id, p_conversation_id, p_user_id, p_dietitian_id, p_role
     ) then
    raise exception 'conversation_not_found';
  end if;

  select jsonb_build_object(
    'media_assets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ma.id,
        'message_id', ma.message_id,
        'status', ma.status,
        'declared_mime_type', ma.declared_mime_type,
        'detected_mime_type', ma.detected_mime_type,
        'width', ma.width,
        'height', ma.height,
        'expires_at', ma.expires_at,
        'has_thumbnail', ma.thumbnail_object_key is not null
      ))
      from media_assets ma
      where ma.tenant_id = p_tenant_id
        and ma.conversation_id = p_conversation_id
        and ma.message_id = any(p_message_ids)
    ), '[]'::jsonb),
    'visual_analysis_records', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', va.id,
        'media_asset_id', va.media_asset_id,
        'message_id', va.message_id,
        'bundle_id', va.bundle_id,
        'analysis_revision', va.analysis_revision,
        'status', va.status,
        'observation', va.observation
      ))
      from visual_analysis_records va
      where va.tenant_id = p_tenant_id
        and va.conversation_id = p_conversation_id
        and va.message_id = any(p_message_ids)
        and va.status <> 'superseded'
    ), '[]'::jsonb),
    'inbound_message_bundles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'anchor_message_id', b.anchor_message_id,
        'status', b.status
      ))
      from inbound_message_bundles b
      where b.tenant_id = p_tenant_id
        and b.conversation_id = p_conversation_id
        and b.anchor_message_id = any(p_message_ids)
    ), '[]'::jsonb),
    'visual_corrections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', vc.id,
        'analysis_id', vc.analysis_id,
        'status', vc.status,
        'created_at', vc.created_at
      ) order by vc.created_at desc)
      from visual_corrections vc
      where vc.tenant_id = p_tenant_id
        and vc.conversation_id = p_conversation_id
        and vc.analysis_id in (
          select va.id
          from visual_analysis_records va
          where va.tenant_id = p_tenant_id
            and va.conversation_id = p_conversation_id
            and va.message_id = any(p_message_ids)
        )
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function p85_stage_4b3_resolve_media_stream_v1(
  p_tenant_id uuid,
  p_user_id uuid,
  p_dietitian_id uuid,
  p_role text,
  p_conversation_id uuid,
  p_asset_id uuid,
  p_variant text default 'thumbnail'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_asset media_assets%rowtype;
  v_object_key text;
  v_content_type text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if not p85_stage_4b_actor_context_valid(p_tenant_id, p_user_id, p_dietitian_id, p_role)
     or p_role = 'auditor'
     or not p85_stage_4b2_actor_can_read_conversation(
       p_tenant_id, p_conversation_id, p_user_id, p_dietitian_id, p_role
     ) then
    raise exception 'conversation_not_found';
  end if;

  select *
    into v_asset
  from media_assets
  where tenant_id = p_tenant_id
    and id = p_asset_id
    and conversation_id = p_conversation_id;

  if not found then
    raise exception 'media_asset_not_found';
  end if;

  if v_asset.status in ('expired', 'revoked') then
    raise exception 'media_asset_unavailable';
  end if;

  if coalesce(p_variant, 'thumbnail') = 'full' then
    v_object_key := coalesce(v_asset.sanitized_full_object_key, v_asset.thumbnail_object_key);
    v_content_type := coalesce(v_asset.detected_mime_type, v_asset.declared_mime_type, 'image/jpeg');
  else
    v_object_key := coalesce(v_asset.thumbnail_object_key, v_asset.sanitized_full_object_key);
    v_content_type := 'image/jpeg';
  end if;

  if v_object_key is null or trim(v_object_key) = '' then
    raise exception 'media_asset_unavailable';
  end if;

  return jsonb_build_object(
    'object_key', v_object_key,
    'content_type', v_content_type
  );
end;
$$;

revoke all on function p85_stage_4b3_load_bounded_media_metadata_v1(uuid, uuid, uuid, text, uuid, uuid[]) from public, anon;
revoke all on function p85_stage_4b3_resolve_media_stream_v1(uuid, uuid, uuid, text, uuid, uuid, text) from public, anon, authenticated;

grant execute on function p85_stage_4b3_load_bounded_media_metadata_v1(uuid, uuid, uuid, text, uuid, uuid[]) to authenticated, service_role;
grant execute on function p85_stage_4b3_resolve_media_stream_v1(uuid, uuid, uuid, text, uuid, uuid, text) to service_role;
