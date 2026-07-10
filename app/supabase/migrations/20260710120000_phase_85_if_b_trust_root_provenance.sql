-- Phase 85 IF-B: trust-root and provenance data model foundation.
-- Foundation-only migration: no real provider/channel path is enabled here.

create table if not exists channel_account_bindings (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null,
  provider_account_id text not null,
  waba_id text,
  business_phone_number_id text,
  normalized_display_number text,
  operating_mode text not null default 'disabled',
  lifecycle_status text not null default 'draft',
  attribution_policy text not null,
  verified_at timestamptz,
  revoked_at timestamptz,
  created_by_dietitian_id uuid references dietitians(id) on delete set null,
  revoked_by_dietitian_id uuid references dietitians(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint channel_account_bindings_provider_check check (provider in ('whatsapp_cloud', 'telegram_bot')),
  constraint channel_account_bindings_operating_mode_check check (operating_mode in ('mock', 'disabled', 'future_real')),
  constraint channel_account_bindings_lifecycle_status_check check (lifecycle_status in ('draft', 'active', 'revoked')),
  constraint channel_account_bindings_attribution_policy_check check (attribution_policy in ('exclusive_dietitian', 'shared_authorized_team')),
  constraint channel_account_bindings_revoke_timestamp_check check (
    (lifecycle_status = 'revoked' and revoked_at is not null)
    or (lifecycle_status <> 'revoked')
  )
);

create unique index if not exists channel_account_bindings_provider_account_active_idx
  on channel_account_bindings (provider, provider_account_id)
  where revoked_at is null;

create unique index if not exists channel_account_bindings_business_phone_active_idx
  on channel_account_bindings (provider, business_phone_number_id)
  where business_phone_number_id is not null and revoked_at is null;

create unique index if not exists channel_account_bindings_display_number_active_idx
  on channel_account_bindings (provider, normalized_display_number)
  where normalized_display_number is not null and revoked_at is null;

create index if not exists channel_account_bindings_tenant_status_idx
  on channel_account_bindings (tenant_id, lifecycle_status, created_at desc);

create table if not exists channel_actor_bindings (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_binding_id uuid not null references channel_account_bindings(id) on delete cascade,
  dietitian_id uuid references dietitians(id) on delete set null,
  actor_type text not null,
  attribution_basis text not null,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  verified_at timestamptz,
  revoked_at timestamptz,
  created_by_dietitian_id uuid references dietitians(id) on delete set null,
  revoked_by_dietitian_id uuid references dietitians(id) on delete set null,
  audit_reason_code text,
  created_at timestamptz not null default now(),
  constraint channel_actor_bindings_actor_type_check check (
    actor_type in ('client', 'exact_dietitian', 'business_operator', 'ai', 'system', 'unknown')
  ),
  constraint channel_actor_bindings_attribution_basis_check check (
    attribution_basis in (
      'authenticated_manu_action',
      'exclusive_verified_account',
      'shared_authorized_team',
      'provider_counterparty',
      'ai_decision',
      'system_operation',
      'imported_unknown'
    )
  ),
  constraint channel_actor_bindings_exact_dietitian_check check (
    actor_type <> 'exact_dietitian' or dietitian_id is not null
  ),
  constraint channel_actor_bindings_valid_window_check check (valid_to is null or valid_to > valid_from)
);

create unique index if not exists channel_actor_bindings_active_exact_dietitian_idx
  on channel_actor_bindings (tenant_id, account_binding_id, dietitian_id)
  where actor_type = 'exact_dietitian' and revoked_at is null and valid_to is null;

create index if not exists channel_actor_bindings_tenant_account_idx
  on channel_actor_bindings (tenant_id, account_binding_id, valid_from desc);

create table if not exists channel_events (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_binding_id uuid references channel_account_bindings(id) on delete set null,
  event_kind text not null,
  processing_status text not null default 'received',
  provider_account_id text,
  provider_event_id text,
  provider_message_id text,
  from_identity text,
  to_identity text,
  counterparty_identity text,
  payload_digest text not null,
  payload_schema_version text not null default 'p85-if-b-v1',
  provider_time timestamptz,
  observed_at timestamptz not null default now(),
  committed_at timestamptz,
  quarantine_id uuid references inbound_quarantines(id) on delete set null,
  replay_of_event_id uuid references channel_events(id) on delete set null,
  retry_count integer not null default 0,
  internal_sequence bigint generated always as identity,
  constraint channel_events_event_kind_check check (
    event_kind in (
      'client_message_text',
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
  ),
  constraint channel_events_processing_status_check check (
    processing_status in ('received', 'normalized', 'quarantined', 'committed', 'duplicate', 'replayed', 'rejected', 'expired')
  ),
  constraint channel_events_retry_count_check check (retry_count >= 0)
);

create unique index if not exists channel_events_tenant_provider_event_idx
  on channel_events (tenant_id, provider_event_id)
  where provider_event_id is not null;

create index if not exists channel_events_tenant_observed_idx
  on channel_events (tenant_id, observed_at desc);

create index if not exists channel_events_tenant_provider_message_idx
  on channel_events (tenant_id, provider_message_id)
  where provider_message_id is not null;

alter table messages
  add column if not exists provider_account_binding_id uuid references channel_account_bindings(id) on delete set null,
  add column if not exists provider_event_id text,
  add column if not exists provider_message_id text,
  add column if not exists actor_type text,
  add column if not exists actor_binding_id uuid references channel_actor_bindings(id) on delete set null,
  add column if not exists author_interface text,
  add column if not exists actor_resolution_basis text,
  add column if not exists provider_sent_at timestamptz,
  add column if not exists observed_at timestamptz,
  add column if not exists persisted_at timestamptz not null default now(),
  add column if not exists conversation_sequence bigint,
  add column if not exists content_status text not null default 'available',
  add column if not exists retrieval_eligibility text not null default 'eligible';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_actor_type_check'
  ) then
    alter table messages add constraint messages_actor_type_check check (
      actor_type is null or actor_type in ('client', 'exact_dietitian', 'business_operator', 'ai', 'system', 'unknown')
    );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'messages_author_interface_check'
  ) then
    alter table messages add constraint messages_author_interface_check check (
      author_interface is null or author_interface in (
        'manu_dashboard',
        'whatsapp_business_surface',
        'telegram_business_surface',
        'client_channel',
        'ai_provider',
        'system',
        'unknown'
      )
    );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'messages_actor_resolution_basis_check'
  ) then
    alter table messages add constraint messages_actor_resolution_basis_check check (
      actor_resolution_basis is null or actor_resolution_basis in (
        'authenticated_manu_action',
        'exclusive_verified_account',
        'shared_authorized_team',
        'provider_counterparty',
        'ai_decision',
        'system_operation',
        'imported_unknown'
      )
    );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'messages_content_status_check'
  ) then
    alter table messages add constraint messages_content_status_check check (
      content_status in ('available', 'edited', 'revoked', 'content_unavailable', 'redacted')
    );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'messages_retrieval_eligibility_check'
  ) then
    alter table messages add constraint messages_retrieval_eligibility_check check (
      retrieval_eligibility in (
        'eligible',
        'excluded_imported_unknown',
        'excluded_revoked',
        'excluded_unavailable',
        'excluded_blocked',
        'excluded_draft',
        'excluded_unverified_actor'
      )
    );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'messages_dietitian_manual_provenance_check'
  ) then
    alter table messages add constraint messages_dietitian_manual_provenance_check check (
      origin <> 'dietitian_manual'
      or author_dietitian_id is not null
      or (
        actor_type = 'business_operator'
        and actor_resolution_basis = 'shared_authorized_team'
        and actor_binding_id is not null
      )
      or (
        actor_type = 'exact_dietitian'
        and actor_resolution_basis in ('authenticated_manu_action', 'exclusive_verified_account')
        and actor_binding_id is not null
      )
    );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'messages_ai_generated_decision_check'
  ) then
    alter table messages add constraint messages_ai_generated_decision_check check (
      origin <> 'ai_generated'
      or generated_by_ai_decision_id is not null
      or body = 'REDACTED_BY_PHASE74_POLICY'
    );
  end if;
end $$;

create unique index if not exists messages_tenant_provider_account_message_idx
  on messages (tenant_id, provider_account_binding_id, provider_message_id)
  where provider_account_binding_id is not null and provider_message_id is not null;

create index if not exists messages_tenant_conversation_sequence_idx
  on messages (tenant_id, conversation_id, conversation_sequence)
  where conversation_sequence is not null;

create table if not exists channel_message_revisions (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  message_id uuid references messages(id) on delete set null,
  channel_event_id uuid references channel_events(id) on delete set null,
  provider_event_id text,
  revision_action text not null,
  prior_content_status text,
  current_content_status text not null,
  prior_body_digest text,
  current_body_digest text,
  revision_sequence integer not null,
  provider_time timestamptz,
  observed_at timestamptz not null default now(),
  constraint channel_message_revisions_action_check check (revision_action in ('edit', 'revoke', 'unknown_target')),
  constraint channel_message_revisions_prior_status_check check (
    prior_content_status is null or prior_content_status in ('available', 'edited', 'revoked', 'content_unavailable', 'redacted')
  ),
  constraint channel_message_revisions_current_status_check check (
    current_content_status in ('available', 'edited', 'revoked', 'content_unavailable', 'redacted')
  ),
  constraint channel_message_revisions_sequence_check check (revision_sequence > 0)
);

create unique index if not exists channel_message_revisions_tenant_message_sequence_idx
  on channel_message_revisions (tenant_id, message_id, revision_sequence)
  where message_id is not null;

create index if not exists channel_message_revisions_tenant_observed_idx
  on channel_message_revisions (tenant_id, observed_at desc);

create table if not exists human_control_sessions (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  reason text not null,
  status text not null default 'active',
  previous_ai_status text not null,
  previous_ai_mode text not null,
  linked_handoff_id uuid references handoff_cases(id) on delete set null,
  linked_yellow_hold_message_id uuid references messages(id) on delete set null,
  opened_by_message_id uuid references messages(id) on delete set null,
  latest_human_message_id uuid references messages(id) on delete set null,
  human_response_observed_count integer not null default 0,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  reactivated_by_dietitian_id uuid references dietitians(id) on delete set null,
  reactivation_reason_code text,
  restored_ai_mode text,
  constraint human_control_sessions_reason_check check (
    reason in ('yellow_risk_hold', 'red_risk_lock', 'manual_takeover', 'channel_trust_gap')
  ),
  constraint human_control_sessions_status_check check (status in ('active', 'resolved', 'reactivated')),
  constraint human_control_sessions_previous_ai_status_check check (previous_ai_status in ('active', 'passive')),
  constraint human_control_sessions_previous_ai_mode_check check (previous_ai_mode in ('autopilot', 'copilot', 'manual', 'paused')),
  constraint human_control_sessions_restored_ai_mode_check check (
    restored_ai_mode is null or restored_ai_mode in ('autopilot', 'copilot', 'manual', 'paused')
  ),
  constraint human_control_sessions_count_check check (human_response_observed_count >= 0)
);

create index if not exists human_control_sessions_tenant_client_status_idx
  on human_control_sessions (tenant_id, client_id, status, opened_at desc);

create table if not exists risk_activity_events (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  human_control_session_id uuid references human_control_sessions(id) on delete set null,
  event_type text not null,
  source_message_id uuid references messages(id) on delete set null,
  handoff_id uuid references handoff_cases(id) on delete set null,
  ai_decision_id uuid references ai_decisions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint risk_activity_events_type_check check (
    event_type in ('human_response_observed', 'ai_paused', 'draft_invalidated', 'risk_resolved', 'ai_reactivated')
  )
);

create index if not exists risk_activity_events_tenant_client_created_idx
  on risk_activity_events (tenant_id, client_id, created_at desc);

create table if not exists context_intake_proposals (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  dietitian_id uuid references dietitians(id) on delete set null,
  source_channel text not null,
  source_text_digest text not null,
  source_text text,
  occurred_at timestamptz not null,
  title text not null,
  summary text not null,
  details text not null,
  importance text not null,
  structured_impact_flags text[] not null default '{}',
  baseline_context_revision integer not null,
  baseline_form_revision integer,
  baseline_food_rule_revision integer,
  baseline_menu_plan_revision integer,
  status text not null default 'pending_confirmation',
  confirmation_count integer not null default 0,
  applied_context_update_id uuid references client_context_updates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint context_intake_proposals_source_channel_check check (source_channel in ('whatsapp', 'telegram', 'internal_copilot')),
  constraint context_intake_proposals_importance_check check (importance in ('routine', 'important', 'critical')),
  constraint context_intake_proposals_status_check check (
    status in ('pending_confirmation', 'confirmed', 'applied', 'rejected', 'stale', 'blocked_structured_impact')
  ),
  constraint context_intake_proposals_confirmation_count_check check (confirmation_count >= 0)
);

create index if not exists context_intake_proposals_tenant_client_status_idx
  on context_intake_proposals (tenant_id, client_id, status, created_at desc);

alter table channel_account_bindings enable row level security;
alter table channel_actor_bindings enable row level security;
alter table channel_events enable row level security;
alter table channel_message_revisions enable row level security;
alter table human_control_sessions enable row level security;
alter table risk_activity_events enable row level security;
alter table context_intake_proposals enable row level security;

drop policy if exists "tenant scoped read channel account bindings" on channel_account_bindings;
drop policy if exists "tenant scoped write channel account bindings" on channel_account_bindings;
drop policy if exists "tenant scoped read channel actor bindings" on channel_actor_bindings;
drop policy if exists "tenant scoped write channel actor bindings" on channel_actor_bindings;
drop policy if exists "tenant scoped read channel events" on channel_events;
drop policy if exists "tenant scoped write channel events" on channel_events;
drop policy if exists "tenant scoped read channel message revisions" on channel_message_revisions;
drop policy if exists "tenant scoped write channel message revisions" on channel_message_revisions;
drop policy if exists "tenant scoped read human control sessions" on human_control_sessions;
drop policy if exists "tenant scoped write human control sessions" on human_control_sessions;
drop policy if exists "tenant scoped read risk activity events" on risk_activity_events;
drop policy if exists "tenant scoped write risk activity events" on risk_activity_events;
drop policy if exists "tenant scoped read context intake proposals" on context_intake_proposals;
drop policy if exists "tenant scoped write context intake proposals" on context_intake_proposals;

create policy "tenant scoped read channel account bindings"
on channel_account_bindings for select
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));

create policy "tenant scoped write channel account bindings"
on channel_account_bindings for all
using (has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[]))
with check (has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[]));

create policy "tenant scoped read channel actor bindings"
on channel_actor_bindings for select
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));

create policy "tenant scoped write channel actor bindings"
on channel_actor_bindings for all
using (has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[]))
with check (has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[]));

create policy "tenant scoped read channel events"
on channel_events for select
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));

create policy "tenant scoped write channel events"
on channel_events for all
using (has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[]))
with check (has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[]));

create policy "tenant scoped read channel message revisions"
on channel_message_revisions for select
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));

create policy "tenant scoped write channel message revisions"
on channel_message_revisions for all
using (has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[]))
with check (has_tenant_role(tenant_id, array['owner', 'admin']::tenant_role[]));

create policy "tenant scoped read human control sessions"
on human_control_sessions for select
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));

create policy "tenant scoped write human control sessions"
on human_control_sessions for all
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]))
with check (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));

create policy "tenant scoped read risk activity events"
on risk_activity_events for select
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));

create policy "tenant scoped write risk activity events"
on risk_activity_events for all
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]))
with check (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));

create policy "tenant scoped read context intake proposals"
on context_intake_proposals for select
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));

create policy "tenant scoped write context intake proposals"
on context_intake_proposals for all
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]))
with check (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));
