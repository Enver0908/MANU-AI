-- Phase 85 Stage 4C Faz 10: chat/message deletion, retention sweeps, DSAR ledger, legal hold.

alter table ai_chat_branches
  add column if not exists status text not null default 'active';

alter table ai_chat_branches
  drop constraint if exists ai_chat_branches_status_check;

alter table ai_chat_branches
  add constraint ai_chat_branches_status_check check (status in ('active', 'deleted'));

create table if not exists ai_chat_legal_holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid,
  scope text not null,
  reason text not null,
  created_by_user_id uuid not null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_chat_legal_holds_scope_check check (scope in ('tenant', 'client'))
);

alter table ai_chat_legal_holds
  add constraint ai_chat_legal_holds_tenant_id_id_key unique (tenant_id, id);

create index if not exists ai_chat_legal_holds_active_idx
  on ai_chat_legal_holds (tenant_id, client_id)
  where released_at is null;

create table if not exists ai_chat_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_kind text not null,
  target_conversation_id uuid,
  target_message_id uuid,
  target_client_id uuid,
  target_user_id uuid,
  reason text not null,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  cursor jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_chat_deletion_jobs_job_kind_check check (
    job_kind in ('conversation_purge', 'message_purge', 'client_chats_purge', 'account_chats_purge', 'lifecycle_sweep')
  ),
  constraint ai_chat_deletion_jobs_status_check check (
    status in ('queued', 'processing', 'completed', 'failed', 'blocked_legal_hold')
  )
);

alter table ai_chat_deletion_jobs
  add constraint ai_chat_deletion_jobs_tenant_id_id_key unique (tenant_id, id);

create index if not exists ai_chat_deletion_jobs_claim_idx
  on ai_chat_deletion_jobs (status, requested_at, created_at);

create unique index if not exists ai_chat_deletion_jobs_active_conversation_idx
  on ai_chat_deletion_jobs (tenant_id, target_conversation_id)
  where status in ('queued', 'processing') and job_kind = 'conversation_purge';

create table if not exists ai_chat_deletion_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  entity_type text not null,
  entity_id_hash text not null,
  reason text not null,
  requested_at timestamptz not null,
  completed_at timestamptz,
  replay_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_chat_deletion_ledger_replay_status_check check (
    replay_status in ('pending', 'applied', 'verified')
  )
);

alter table ai_chat_deletion_ledger
  add constraint ai_chat_deletion_ledger_tenant_id_id_key unique (tenant_id, id);

create index if not exists ai_chat_deletion_ledger_replay_idx
  on ai_chat_deletion_ledger (tenant_id, replay_status, completed_at);

alter table ai_chat_jobs drop constraint if exists ai_chat_jobs_job_type_check;
alter table ai_chat_jobs add constraint ai_chat_jobs_job_type_check check (
  job_type in (
    'generation',
    'title',
    'attachment_scan',
    'attachment_parse',
    'attachment_cleanup',
    'conversation_purge',
    'message_purge',
    'lifecycle_sweep'
  )
);

alter table ai_chat_message_versions
  drop constraint if exists ai_chat_message_versions_content_status_check;

alter table ai_chat_message_versions
  add constraint ai_chat_message_versions_content_status_check check (
    content_status in ('active', 'superseded', 'deleted', 'deleting')
  );
