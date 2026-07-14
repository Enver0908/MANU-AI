-- Phase 85 Stage 4B-3: media lifecycle expiry indexes and service-role finalize RPCs.

create index if not exists media_assets_expiry_due_idx
  on media_assets (tenant_id, expires_at)
  where deleted_at is null and status not in ('expired', 'revoked');

create index if not exists inbound_message_bundles_client_open_idx
  on inbound_message_bundles (tenant_id, client_id, status)
  where status in ('open', 'ready', 'processing');

create or replace function p85_stage_4b3_finalize_media_asset_expiry(
  p_tenant_id uuid,
  p_asset_id uuid,
  p_now timestamptz default now()
)
returns table (
  id uuid,
  status text,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tenant_id is null or p_asset_id is null then
    raise exception 'tenant_and_asset_required';
  end if;

  return query
  update media_assets
  set status = 'expired',
      provider_media_id = null,
      sanitized_full_object_key = null,
      thumbnail_object_key = null,
      deleted_at = p_now,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and id = p_asset_id
    and deleted_at is null
    and status not in ('expired', 'revoked')
    and expires_at is not null
    and expires_at <= p_now
  returning media_assets.id, media_assets.status, media_assets.deleted_at;
end;
$$;

create or replace function p85_stage_4b3_redact_client_media_metadata(
  p_tenant_id uuid,
  p_client_id uuid,
  p_now timestamptz default now()
)
returns table (
  media_assets_updated integer,
  bundles_updated integer,
  analyses_updated integer,
  corrections_updated integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_media_count integer := 0;
  v_bundle_count integer := 0;
  v_analysis_count integer := 0;
  v_correction_count integer := 0;
begin
  if p_tenant_id is null or p_client_id is null then
    raise exception 'tenant_and_client_required';
  end if;

  update inbound_message_bundles
  set status = 'superseded',
      lease_owner = null,
      lease_expires_at = null,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and client_id = p_client_id
    and status in ('open', 'ready', 'processing');
  get diagnostics v_bundle_count = row_count;

  update media_assets
  set status = 'revoked',
      provider_media_id = null,
      sanitized_full_object_key = null,
      thumbnail_object_key = null,
      deleted_at = p_now,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and client_id = p_client_id
    and deleted_at is null;
  get diagnostics v_media_count = row_count;

  update visual_analysis_records
  set observation = jsonb_build_object(
        'schemaVersion', 'visual-observation-v1',
        'sceneType', coalesce(observation->>'sceneType', 'unknown'),
        'sceneConfidence', 0,
        'overallConfidence', 0,
        'qualityFlags', '[]'::jsonb,
        'entityCandidates', '[]'::jsonb,
        'ocrBlocks', '[]'::jsonb,
        'labelIntegrity', observation->'labelIntegrity',
        'sensitivitySignals', jsonb_build_array('REDACTED_BY_PHASE74_POLICY'),
        'promptInjectionSignals', jsonb_build_array('REDACTED_BY_PHASE74_POLICY'),
        'providerId', coalesce(observation->>'providerId', 'redacted'),
        'providerVersion', coalesce(observation->>'providerVersion', 'redacted')
      ),
      failure_code = case when failure_code is null then null else 'REDACTED_BY_PHASE74_POLICY' end,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and client_id = p_client_id;
  get diagnostics v_analysis_count = row_count;

  update visual_corrections
  set explanation = 'REDACTED_BY_PHASE74_POLICY',
      corrected_ocr_text = case when corrected_ocr_text is null then null else 'REDACTED_BY_PHASE74_POLICY' end,
      corrected_entity_labels = '[]'::jsonb,
      updated_at = p_now
  where tenant_id = p_tenant_id
    and client_id = p_client_id;
  get diagnostics v_correction_count = row_count;

  return query
  select v_media_count, v_bundle_count, v_analysis_count, v_correction_count;
end;
$$;

revoke all on function p85_stage_4b3_finalize_media_asset_expiry(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function p85_stage_4b3_redact_client_media_metadata(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function p85_stage_4b3_finalize_media_asset_expiry(uuid, uuid, timestamptz) to service_role;
grant execute on function p85_stage_4b3_redact_client_media_metadata(uuid, uuid, timestamptz) to service_role;
