-- Phase 85 Stage 4B-4 bounded voice reads and audio stream resolution.

create or replace function p85_stage_4b4_load_bounded_voice_v1(
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

  select jsonb_build_object(
    'media_assets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ma.id,
        'message_id', ma.message_id,
        'status', ma.status,
        'declared_mime_type', ma.declared_mime_type,
        'detected_mime_type', ma.detected_mime_type,
        'duration_ms', ma.duration_ms,
        'expires_at', ma.expires_at,
        'media_kind', ma.media_kind,
        'voice_message', ma.voice_message,
        'has_audio', ma.sanitized_audio_object_key is not null
      ))
      from media_assets ma
      where ma.tenant_id = p_tenant_id
        and ma.conversation_id = p_conversation_id
        and ma.message_id = any(p_message_ids)
        and ma.status not in ('deletion_pending')
        and (ma.media_kind = 'audio' or ma.voice_message = true)
    ), '[]'::jsonb),
    'audio_transcription_records', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', atr.id,
        'media_asset_id', atr.media_asset_id,
        'message_id', atr.message_id,
        'transcription_revision', atr.transcription_revision,
        'status', atr.status,
        'transcript_status', case
          when atr.status = 'accepted' then 'accepted'
          when atr.status = 'superseded' then 'expired'
          else atr.status::text
        end
      ))
      from audio_transcription_records atr
      where atr.tenant_id = p_tenant_id
        and atr.conversation_id = p_conversation_id
        and atr.message_id = any(p_message_ids)
        and atr.status <> 'superseded'
    ), '[]'::jsonb),
    'audio_transcript_corrections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', atc.id,
        'transcription_id', atc.transcription_id,
        'status', atc.status,
        'corrected_transcript', atc.corrected_transcript,
        'created_at', atc.created_at
      ) order by atc.created_at desc)
      from audio_transcript_corrections atc
      where atc.tenant_id = p_tenant_id
        and atc.conversation_id = p_conversation_id
        and atc.transcription_id in (
          select atr.id
          from audio_transcription_records atr
          where atr.tenant_id = p_tenant_id
            and atr.conversation_id = p_conversation_id
            and atr.message_id = any(p_message_ids)
        )
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function p85_stage_4b3_resolve_media_stream_v2(
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
  v_variant text := coalesce(p_variant, 'thumbnail');
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

  if v_asset.status in ('expired', 'revoked') or v_asset.deleted_at is not null then
    raise exception 'media_asset_unavailable';
  end if;

  if v_variant = 'audio' then
    if coalesce(v_asset.media_kind, '') <> 'audio' and coalesce(v_asset.voice_message, false) = false then
      raise exception 'media_asset_not_found';
    end if;
    v_object_key := v_asset.sanitized_audio_object_key;
    v_content_type := 'audio/wav';
  elsif v_variant = 'full' then
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
    'content_type', v_content_type,
    'bucket_id', case when v_variant = 'audio' then 'p85-stage-4b4-audio' else 'p85-stage-4b3-media' end
  );
end;
$$;

revoke all on function p85_stage_4b4_load_bounded_voice_v1(uuid, uuid, uuid, text, uuid, uuid[]) from public, anon, authenticated;
grant execute on function p85_stage_4b4_load_bounded_voice_v1(uuid, uuid, uuid, text, uuid, uuid[]) to service_role;
