-- Phase 85 Stage 4C Faz 9: risk, safe draft transfer, and explicit handoff lineage.

create table if not exists ai_chat_run_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  run_id uuid not null,
  conversation_id uuid not null,
  created_by_user_id uuid not null,
  client_id uuid,
  risk_level text not null,
  reasons jsonb not null default '[]'::jsonb,
  source_ref_ids jsonb not null default '[]'::jsonb,
  confidence_class text not null,
  recommended_human_action text not null,
  hypothetical_red boolean not null default false,
  source_revision_digest text not null,
  handoff_confirmation_token text,
  status text not null default 'active',
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_chat_run_risk_assessments_risk_level_check check (risk_level in ('green', 'yellow', 'red')),
  constraint ai_chat_run_risk_assessments_status_check check (status in ('active', 'superseded'))
);

alter table ai_chat_run_risk_assessments
  add constraint ai_chat_run_risk_assessments_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_run_risk_assessments
  add constraint ai_chat_run_risk_assessments_run_tenant_fk
  foreign key (tenant_id, run_id) references ai_chat_runs (tenant_id, id);

create index if not exists ai_chat_run_risk_assessments_run_idx
  on ai_chat_run_risk_assessments (tenant_id, run_id, status);

alter table ai_chat_answer_envelopes
  add column if not exists safe_draft jsonb;

create table if not exists ai_chat_draft_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  run_id uuid not null,
  source_conversation_id uuid not null,
  destination_conversation_id uuid not null,
  destination_client_id uuid not null,
  created_by_user_id uuid not null,
  risk_level text not null,
  review_origin text not null default 'ai_chat',
  transfer_mode text not null,
  draft_body text not null,
  source_ref_ids jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  destination_revision integer not null,
  client_context_revision integer not null,
  consumed_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_chat_draft_transfers_risk_level_check check (risk_level in ('green', 'yellow')),
  constraint ai_chat_draft_transfers_transfer_mode_check check (transfer_mode in ('composer_pending', 'yellow_review')),
  constraint ai_chat_draft_transfers_status_check check (status in ('pending', 'consumed', 'superseded', 'blocked'))
);

alter table ai_chat_draft_transfers
  add constraint ai_chat_draft_transfers_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_draft_transfers
  add constraint ai_chat_draft_transfers_run_tenant_fk
  foreign key (tenant_id, run_id) references ai_chat_runs (tenant_id, id);

create unique index if not exists ai_chat_draft_transfers_pending_destination_idx
  on ai_chat_draft_transfers (tenant_id, destination_conversation_id)
  where status = 'pending';

create table if not exists ai_chat_handoff_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  run_id uuid not null,
  conversation_id uuid not null,
  client_id uuid not null,
  created_by_user_id uuid not null,
  handoff_id uuid not null,
  fingerprint text not null,
  confirmation_token text not null,
  status text not null default 'active',
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_chat_handoff_links_status_check check (status in ('active', 'superseded'))
);

alter table ai_chat_handoff_links
  add constraint ai_chat_handoff_links_tenant_id_id_key unique (tenant_id, id);

alter table ai_chat_handoff_links
  add constraint ai_chat_handoff_links_run_tenant_fk
  foreign key (tenant_id, run_id) references ai_chat_runs (tenant_id, id);

create unique index if not exists ai_chat_handoff_links_active_fingerprint_idx
  on ai_chat_handoff_links (tenant_id, fingerprint)
  where status = 'active';

alter table handoff_cases
  add column if not exists source_ai_chat_run_id uuid;

alter table handoff_cases
  drop constraint if exists handoff_cases_trigger_xor_check;

alter table handoff_cases
  add constraint handoff_cases_trigger_xor_check check (
    (triggering_message_id is not null and source_ai_chat_run_id is null)
    or (triggering_message_id is null and source_ai_chat_run_id is not null)
    or (triggering_message_id is null and source_ai_chat_run_id is null)
  );

alter table ai_chat_run_risk_assessments enable row level security;
alter table ai_chat_draft_transfers enable row level security;
alter table ai_chat_handoff_links enable row level security;

drop policy if exists "p85 stage4c run risk creator read" on ai_chat_run_risk_assessments;
create policy "p85 stage4c run risk creator read"
on ai_chat_run_risk_assessments for select
using (p85_stage_4c_actor_owns_chat(tenant_id, created_by_user_id, conversation_id));

drop policy if exists "p85 stage4c draft transfers creator read" on ai_chat_draft_transfers;
create policy "p85 stage4c draft transfers creator read"
on ai_chat_draft_transfers for select
using (p85_stage_4c_actor_owns_chat(tenant_id, created_by_user_id, source_conversation_id));

drop policy if exists "p85 stage4c handoff links creator read" on ai_chat_handoff_links;
create policy "p85 stage4c handoff links creator read"
on ai_chat_handoff_links for select
using (p85_stage_4c_actor_owns_chat(tenant_id, created_by_user_id, conversation_id));

revoke all on table ai_chat_run_risk_assessments from public, anon;
revoke all on table ai_chat_draft_transfers from public, anon;
revoke all on table ai_chat_handoff_links from public, anon;
grant select on table ai_chat_run_risk_assessments to authenticated;
grant select on table ai_chat_draft_transfers to authenticated;
grant select on table ai_chat_handoff_links to authenticated;
grant all on table ai_chat_run_risk_assessments to service_role;
grant all on table ai_chat_draft_transfers to service_role;
grant all on table ai_chat_handoff_links to service_role;
