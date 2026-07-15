-- Phase 85 Stage 4B-4 post-closure remediation R4:
-- fail-closed transcription terminalization; exhausted retries route to review_required.

drop function if exists p85_stage_4b4_fail_transcription_work_v2(uuid, uuid, text, uuid, text, text);

create or replace function p85_stage_4b4_fail_transcription_work_v2(
  p_tenant_id uuid,
  p_transcription_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_failure_code text,
  p_terminal_class text default 'transient',
  p_rejection_reasons text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row audio_transcription_records%rowtype;
  v_next_retry integer;
  v_terminal boolean;
  v_reasons text[];
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_lease_token is null then
    raise exception 'lease_token_required';
  end if;

  select *
    into v_row
  from audio_transcription_records
  where tenant_id = p_tenant_id
    and id = p_transcription_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  for update;

  if not found then
    raise exception 'transcription_lease_not_found';
  end if;

  v_terminal := p_terminal_class in ('security', 'review_required');

  if not v_terminal then
    v_next_retry := least(v_row.retry_count + 1, 3);
    v_terminal := v_next_retry >= 3;
  end if;

  v_reasons := coalesce(
    p_rejection_reasons,
    case
      when p_failure_code = 'provider_gate_disabled' then array['provider_disabled']
      when p_failure_code = 'provider_timeout' then array['provider_timeout']
      when p_failure_code = 'retry_limit_exceeded' then array['retry_limit_exceeded']
      when p_failure_code = 'unknown_fixture' then array['unknown_fixture']
      else array['malformed_observation']
    end
  );

  if v_terminal then
    if p_terminal_class = 'transient' and v_next_retry >= 3 then
      v_reasons := array['retry_limit_exceeded'];
    end if;

    update audio_transcription_records
    set status = 'review_required',
        failure_code = coalesce(p_failure_code, failure_code),
        rejection_reasons = v_reasons,
        lease_owner = null,
        lease_token = null,
        lease_expires_at = null,
        next_attempt_at = null,
        updated_at = now()
    where tenant_id = p_tenant_id
      and id = p_transcription_id;

    update media_assets
    set failure_code = coalesce(v_reasons[1], failure_code),
        updated_at = now()
    where tenant_id = p_tenant_id
      and id = v_row.media_asset_id
      and status = 'analysis_pending';

    return jsonb_build_object(
      'status', 'terminal_failure',
      'terminalStatus', 'review_required',
      'transcriptionId', p_transcription_id
    );
  end if;

  update audio_transcription_records
  set status = 'pending',
      retry_count = least(retry_count + 1, 3),
      next_attempt_at = case
        when retry_count = 0 then now() + interval '1 second'
        else now() + interval '5 seconds'
      end,
      failure_code = coalesce(p_failure_code, failure_code),
      rejection_reasons = v_reasons,
      lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_transcription_id;

  return jsonb_build_object(
    'status', 'retry_scheduled',
    'transcriptionId', p_transcription_id,
    'retryCount', least(v_row.retry_count + 1, 3)
  );
end;
$$;

revoke all on function p85_stage_4b4_fail_transcription_work_v2(uuid, uuid, text, uuid, text, text, text[]) from public, anon, authenticated;
grant execute on function p85_stage_4b4_fail_transcription_work_v2(uuid, uuid, text, uuid, text, text, text[]) to service_role;
