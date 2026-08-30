-- Production readiness stage 1 phase 4: real AI adapter audit and file safety contracts.
-- This migration does not enable real AI provider egress.

create table if not exists ai_provider_egress_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  operation text not null,
  provider text not null,
  model text not null,
  request_digest text not null,
  response_digest text,
  risk_level text not null,
  provider_status text not null,
  error_category text,
  payload_schema_version text not null,
  token_count_method text not null,
  safety_settings_digest text not null,
  retention_policy text not null,
  created_at timestamptz not null default now(),
  constraint ai_provider_egress_audit_operation_check check (
    operation in ('ai_text_generate', 'ai_vision_analyze', 'ocr_extract', 'audio_transcribe')
  ),
  constraint ai_provider_egress_audit_provider_check check (
    provider in ('gemini', 'vision', 'ocr', 'transcription')
  ),
  constraint ai_provider_egress_audit_status_check check (
    provider_status in ('blocked', 'attempted', 'ok', 'failed', 'timeout', 'rate_limited', 'invalid_output')
  ),
  constraint ai_provider_egress_audit_risk_check check (risk_level in ('green', 'yellow', 'red')),
  constraint ai_provider_egress_audit_token_count_method_check check (token_count_method in ('provider_native')),
  constraint ai_provider_egress_audit_retention_policy_check check (
    retention_policy in ('disabled', 'contractually_bounded')
  )
);

create index if not exists ai_provider_egress_audit_tenant_created_idx
  on ai_provider_egress_audit (tenant_id, created_at desc);

alter table ai_chat_attachments
  add column if not exists malware_scan_status text not null default 'not_scanned',
  add column if not exists malware_scan_provider text,
  add column if not exists malware_scan_digest text,
  add column if not exists malware_scan_completed_at timestamptz,
  add column if not exists provider_egress_eligible boolean not null default false;

alter table ai_chat_attachments drop constraint if exists ai_chat_attachments_malware_scan_status_check;
alter table ai_chat_attachments add constraint ai_chat_attachments_malware_scan_status_check
  check (malware_scan_status in ('not_scanned', 'pending', 'passed', 'failed', 'unavailable'));

alter table ai_chat_attachments drop constraint if exists ai_chat_attachments_provider_egress_requires_scan_check;
alter table ai_chat_attachments add constraint ai_chat_attachments_provider_egress_requires_scan_check
  check (provider_egress_eligible = false or malware_scan_status = 'passed');

alter table ai_provider_egress_audit enable row level security;

revoke all on table ai_provider_egress_audit from public, anon, authenticated;
grant select, insert on table ai_provider_egress_audit to service_role;
