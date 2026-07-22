-- Phase 85 Stage 4C Faz 2: AI Chat domain tables, constraints, and indexes.
-- Foundation-only: no runtime UI/API/orchestrator behavior is enabled by this migration.

create table if not exists ai_chat_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_by_user_id uuid not null,
  created_by_dietitian_id uuid not null,
  scope_type text not null,
  client_id uuid,
  title text not null,
  status text not null default 'active',
  active_branch_id uuid,
  revision bigint not null default 1,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_chat_conversations_scope_type_check check (scope_type in ('general', 'client')),
  constraint ai_chat_conversations_status_check check (
    status in ('active', 'locked', 'deleting', 'deleted')
  ),
  constraint ai_chat_conversations_scope_client_check check (
    (scope_type = 'general' and client_id is null)
    or (scope_type = 'client' and client_id is not null)
  ),
  constraint ai_chat_conversations_title_length_check check (char_length(title) <= 120),
  constraint ai_chat_conversations_revision_check check (revision >= 1)
);

alter table ai_chat_conversations
  add constraint ai_chat_conversations_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_conversations
  add constraint ai_chat_conversations_dietitian_tenant_fk
  foreign key (tenant_id, created_by_dietitian_id) references dietitians (tenant_id, id);

alter table ai_chat_conversations
  add constraint ai_chat_conversations_client_tenant_fk
  foreign key (tenant_id, client_id) references clients (tenant_id, id);

create index if not exists ai_chat_conversations_history_idx
  on ai_chat_conversations (tenant_id, created_by_user_id, status, last_message_at desc, id desc);

create table if not exists ai_chat_branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null,
  created_by_user_id uuid not null,
  parent_branch_id uuid,
  forked_from_message_version_id uuid,
  active_leaf_version_id uuid,
  fork_reason text,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_chat_branches_revision_check check (revision >= 1)
);

alter table ai_chat_branches
  add constraint ai_chat_branches_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_branches
  add constraint ai_chat_branches_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references ai_chat_conversations (tenant_id, id) on delete cascade;

create index if not exists ai_chat_branches_conversation_idx
  on ai_chat_branches (tenant_id, conversation_id, created_at desc);

create table if not exists ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null,
  created_by_user_id uuid not null,
  role text not null,
  author_user_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_chat_messages_role_check check (role in ('user', 'assistant'))
);

alter table ai_chat_messages
  add constraint ai_chat_messages_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_messages
  add constraint ai_chat_messages_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references ai_chat_conversations (tenant_id, id) on delete cascade;

create index if not exists ai_chat_messages_conversation_idx
  on ai_chat_messages (tenant_id, conversation_id, created_at asc);

create table if not exists ai_chat_message_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null,
  message_id uuid not null,
  branch_id uuid not null,
  created_by_user_id uuid not null,
  body text not null,
  body_sha256 text not null,
  parent_version_id uuid,
  supersedes_version_id uuid,
  run_id uuid,
  content_status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint ai_chat_message_versions_body_length_check check (char_length(body) <= 12000),
  constraint ai_chat_message_versions_content_status_check check (
    content_status in ('active', 'superseded', 'deleted')
  )
);

alter table ai_chat_message_versions
  add constraint ai_chat_message_versions_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_message_versions
  add constraint ai_chat_message_versions_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references ai_chat_conversations (tenant_id, id) on delete cascade;

alter table ai_chat_message_versions
  add constraint ai_chat_message_versions_message_tenant_fk
  foreign key (tenant_id, message_id) references ai_chat_messages (tenant_id, id) on delete cascade;

alter table ai_chat_message_versions
  add constraint ai_chat_message_versions_branch_tenant_fk
  foreign key (tenant_id, branch_id) references ai_chat_branches (tenant_id, id) on delete cascade;

create index if not exists ai_chat_message_versions_parent_idx
  on ai_chat_message_versions (tenant_id, conversation_id, parent_version_id);

create index if not exists ai_chat_message_versions_supersedes_idx
  on ai_chat_message_versions (tenant_id, message_id, supersedes_version_id);

create index if not exists ai_chat_message_versions_run_idx
  on ai_chat_message_versions (tenant_id, run_id);

create table if not exists ai_chat_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null,
  created_by_user_id uuid not null,
  trigger_message_version_id uuid not null,
  status text not null default 'queued',
  answerability text,
  risk_level text,
  safety_outcome text,
  cancel_requested_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_chat_runs_status_check check (
    status in (
      'queued',
      'retrieving',
      'generating',
      'validating',
      'cancel_requested',
      'completed',
      'stopped',
      'failed',
      'superseded'
    )
  ),
  constraint ai_chat_runs_answerability_check check (
    answerability is null
    or answerability in ('answerable', 'partial', 'insufficient', 'conflicting', 'not_authorized')
  ),
  constraint ai_chat_runs_risk_level_check check (
    risk_level is null or risk_level in ('green', 'yellow', 'red')
  )
);

alter table ai_chat_runs
  add constraint ai_chat_runs_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_runs
  add constraint ai_chat_runs_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references ai_chat_conversations (tenant_id, id) on delete cascade;

alter table ai_chat_runs
  add constraint ai_chat_runs_trigger_version_tenant_fk
  foreign key (tenant_id, trigger_message_version_id) references ai_chat_message_versions (tenant_id, id);

create index if not exists ai_chat_runs_conversation_idx
  on ai_chat_runs (tenant_id, conversation_id, created_at desc);

alter table ai_chat_message_versions
  add constraint ai_chat_message_versions_run_tenant_fk
  foreign key (tenant_id, run_id) references ai_chat_runs (tenant_id, id);

create table if not exists ai_chat_run_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  run_id uuid not null,
  conversation_id uuid not null,
  created_by_user_id uuid not null,
  sequence_number bigint not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint ai_chat_run_events_sequence_check check (sequence_number >= 1)
);

alter table ai_chat_run_events
  add constraint ai_chat_run_events_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_run_events
  add constraint ai_chat_run_events_run_tenant_fk
  foreign key (tenant_id, run_id) references ai_chat_runs (tenant_id, id) on delete cascade;

alter table ai_chat_run_events
  add constraint ai_chat_run_events_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references ai_chat_conversations (tenant_id, id) on delete cascade;

create unique index if not exists ai_chat_run_events_run_sequence_idx
  on ai_chat_run_events (tenant_id, run_id, sequence_number);

create index if not exists ai_chat_run_events_expires_idx
  on ai_chat_run_events (tenant_id, expires_at);

create table if not exists ai_chat_tool_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  run_id uuid not null,
  conversation_id uuid not null,
  created_by_user_id uuid not null,
  tool_name text not null,
  status text not null,
  result_identity_digest text,
  permission_decision text not null,
  created_at timestamptz not null default now(),
  constraint ai_chat_tool_calls_status_check check (
    status in ('allowed', 'denied', 'completed', 'failed', 'superseded')
  )
);

alter table ai_chat_tool_calls
  add constraint ai_chat_tool_calls_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_tool_calls
  add constraint ai_chat_tool_calls_run_tenant_fk
  foreign key (tenant_id, run_id) references ai_chat_runs (tenant_id, id) on delete cascade;

alter table ai_chat_tool_calls
  add constraint ai_chat_tool_calls_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references ai_chat_conversations (tenant_id, id) on delete cascade;

create index if not exists ai_chat_tool_calls_run_idx
  on ai_chat_tool_calls (tenant_id, run_id, created_at asc);

create table if not exists ai_chat_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  run_id uuid not null,
  conversation_id uuid not null,
  created_by_user_id uuid not null,
  source_identity_refs jsonb not null default '[]'::jsonb,
  freshness_metadata jsonb not null default '{}'::jsonb,
  evidence_excerpts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table ai_chat_context_snapshots
  add constraint ai_chat_context_snapshots_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_context_snapshots
  add constraint ai_chat_context_snapshots_run_tenant_fk
  foreign key (tenant_id, run_id) references ai_chat_runs (tenant_id, id) on delete cascade;

alter table ai_chat_context_snapshots
  add constraint ai_chat_context_snapshots_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references ai_chat_conversations (tenant_id, id) on delete cascade;

create index if not exists ai_chat_context_snapshots_run_idx
  on ai_chat_context_snapshots (tenant_id, run_id);

create table if not exists ai_chat_source_refs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  run_id uuid not null,
  conversation_id uuid not null,
  message_version_id uuid,
  created_by_user_id uuid not null,
  source_type text not null,
  canonical_entity_id text not null,
  locator text,
  source_date date,
  content_hash text,
  claim_id uuid,
  client_id uuid,
  created_at timestamptz not null default now(),
  constraint ai_chat_source_refs_source_type_check check (
    source_type in (
      'client_record',
      'approved_clinical_source',
      'chat_attachment',
      'web_source',
      'dietitian_input'
    )
  )
);

alter table ai_chat_source_refs
  add constraint ai_chat_source_refs_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_source_refs
  add constraint ai_chat_source_refs_run_tenant_fk
  foreign key (tenant_id, run_id) references ai_chat_runs (tenant_id, id) on delete cascade;

alter table ai_chat_source_refs
  add constraint ai_chat_source_refs_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references ai_chat_conversations (tenant_id, id) on delete cascade;

alter table ai_chat_source_refs
  add constraint ai_chat_source_refs_message_version_tenant_fk
  foreign key (tenant_id, message_version_id) references ai_chat_message_versions (tenant_id, id);

alter table ai_chat_source_refs
  add constraint ai_chat_source_refs_client_tenant_fk
  foreign key (tenant_id, client_id) references clients (tenant_id, id);

create index if not exists ai_chat_source_refs_run_idx
  on ai_chat_source_refs (tenant_id, run_id, created_at asc);

create table if not exists ai_chat_memory_summaries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null,
  branch_id uuid not null,
  created_by_user_id uuid not null,
  summary_text text not null,
  is_authoritative boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ai_chat_memory_summaries
  add constraint ai_chat_memory_summaries_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_memory_summaries
  add constraint ai_chat_memory_summaries_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references ai_chat_conversations (tenant_id, id) on delete cascade;

alter table ai_chat_memory_summaries
  add constraint ai_chat_memory_summaries_branch_tenant_fk
  foreign key (tenant_id, branch_id) references ai_chat_branches (tenant_id, id) on delete cascade;

create index if not exists ai_chat_memory_summaries_branch_idx
  on ai_chat_memory_summaries (tenant_id, branch_id, created_at desc);

create table if not exists ai_chat_provider_egress_manifests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  run_id uuid not null,
  conversation_id uuid not null,
  created_by_user_id uuid not null,
  provider_name text not null,
  purpose text not null,
  data_categories text[] not null default '{}',
  source_identity_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table ai_chat_provider_egress_manifests
  add constraint ai_chat_provider_egress_manifests_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_provider_egress_manifests
  add constraint ai_chat_provider_egress_manifests_run_tenant_fk
  foreign key (tenant_id, run_id) references ai_chat_runs (tenant_id, id) on delete cascade;

alter table ai_chat_provider_egress_manifests
  add constraint ai_chat_provider_egress_manifests_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references ai_chat_conversations (tenant_id, id) on delete cascade;

create index if not exists ai_chat_provider_egress_manifests_run_idx
  on ai_chat_provider_egress_manifests (tenant_id, run_id);

create table if not exists ai_chat_mutation_ledger (
  tenant_id uuid not null references tenants(id) on delete cascade,
  request_id text not null,
  created_by_user_id uuid not null,
  body_hash text not null,
  response_digest text,
  created_at timestamptz not null default now(),
  primary key (tenant_id, request_id, created_by_user_id)
);

create index if not exists ai_chat_mutation_ledger_created_idx
  on ai_chat_mutation_ledger (tenant_id, created_by_user_id, created_at desc);

create table if not exists ai_chat_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid,
  created_by_user_id uuid not null,
  event_kind text not null,
  created_at timestamptz not null default now()
);

alter table ai_chat_events
  add constraint ai_chat_events_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_events
  add constraint ai_chat_events_conversation_tenant_fk
  foreign key (tenant_id, conversation_id) references ai_chat_conversations (tenant_id, id) on delete cascade;

create index if not exists ai_chat_events_conversation_idx
  on ai_chat_events (tenant_id, conversation_id, created_at desc);

alter table ai_chat_branches
  add constraint ai_chat_branches_parent_branch_tenant_fk
  foreign key (tenant_id, parent_branch_id) references ai_chat_branches (tenant_id, id);

alter table ai_chat_branches
  add constraint ai_chat_branches_fork_version_tenant_fk
  foreign key (tenant_id, forked_from_message_version_id) references ai_chat_message_versions (tenant_id, id);

alter table ai_chat_branches
  add constraint ai_chat_branches_active_leaf_version_tenant_fk
  foreign key (tenant_id, active_leaf_version_id) references ai_chat_message_versions (tenant_id, id);

alter table ai_chat_message_versions
  add constraint ai_chat_message_versions_parent_version_tenant_fk
  foreign key (tenant_id, parent_version_id) references ai_chat_message_versions (tenant_id, id);

alter table ai_chat_message_versions
  add constraint ai_chat_message_versions_supersedes_version_tenant_fk
  foreign key (tenant_id, supersedes_version_id) references ai_chat_message_versions (tenant_id, id);

alter table ai_chat_conversations
  add constraint ai_chat_conversations_active_branch_tenant_fk
  foreign key (tenant_id, active_branch_id) references ai_chat_branches (tenant_id, id);
