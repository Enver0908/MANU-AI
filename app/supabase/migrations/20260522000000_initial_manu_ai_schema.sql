-- MANU-AI Supabase migration v1.
-- Converted from dietitian-ai-assistant/docs/data-model.sql and extended with
-- local SaaS prototype defaults, tenant memberships, RLS, and persona seeds.

create extension if not exists "pgcrypto";

create type client_channel as enum ('whatsapp', 'telegram');
create type client_ai_status as enum ('active', 'passive');
create type client_ai_mode as enum ('autopilot', 'copilot', 'manual', 'paused');
create type risk_level as enum ('green', 'yellow', 'red');
create type sender_type as enum ('client', 'assistant', 'dietitian', 'system');
create type message_origin as enum ('client_inbound', 'ai_generated', 'dietitian_manual', 'system_event', 'imported_unknown');
create type message_status as enum ('stored', 'sent', 'draft', 'handoff', 'blocked');
create type case_status as enum ('open', 'assigned', 'resolved', 'dismissed');
create type tenant_role as enum ('owner', 'admin', 'dietitian', 'assistant', 'auditor');
create type permission_state as enum ('ready', 'pending', 'blocked');

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null,
  role tenant_role not null default 'dietitian',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table dietitians (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  display_name text not null,
  timezone text not null default 'Europe/Istanbul',
  auth_user_id uuid unique,
  created_at timestamptz not null default now()
);

create table dietitian_voice_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  dietitian_id uuid not null references dietitians(id) on delete cascade,
  average_message_chars integer not null default 140,
  formality text not null default 'balanced',
  emoji_policy text not null default 'limited',
  common_greetings text[] not null default '{}',
  common_closings text[] not null default '{}',
  style_notes text not null default '',
  updated_at timestamptz not null default now(),
  unique (tenant_id, dietitian_id)
);

create table personas (
  id text primary key,
  label text not null,
  behavior_contract jsonb not null,
  is_active boolean not null default true
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  dietitian_id uuid not null references dietitians(id) on delete cascade,
  full_name text not null,
  selected_persona_id text not null references personas(id),
  ai_status client_ai_status not null default 'passive',
  ai_mode client_ai_mode not null default 'copilot',
  ai_active_from timestamptz,
  ai_active_until timestamptz,
  channel_permission permission_state not null default 'pending',
  mandatory_safety_complete boolean not null default false,
  safety_checklist jsonb not null default '{}',
  human_takeover_locked boolean not null default false,
  health_profile jsonb not null default '{}',
  diet_plan jsonb not null default '{}',
  allergies text[] not null default '{}',
  restricted_foods text[] not null default '{}',
  clinical_risk_notes text[] not null default '{}',
  pinned_notes text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table client_channels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  channel client_channel not null,
  channel_user_id text not null,
  display_handle text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (channel, channel_user_id),
  unique (tenant_id, client_id, channel)
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  dietitian_id uuid not null references dietitians(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  channel client_channel not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender sender_type not null,
  body text not null,
  origin message_origin not null,
  author_dietitian_id uuid references dietitians(id),
  generated_by_ai_decision_id uuid,
  approved_by_dietitian_id uuid references dietitians(id),
  source_message_id uuid references messages(id),
  provider_message_id text,
  risk risk_level,
  status message_status not null default 'stored',
  created_at timestamptz not null default now()
);

create table client_ai_status_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  dietitian_id uuid not null references dietitians(id) on delete cascade,
  previous_status client_ai_status,
  new_status client_ai_status not null,
  ai_mode client_ai_mode,
  active_from timestamptz,
  active_until timestamptz,
  reason text,
  created_at timestamptz not null default now()
);

create table conversation_memories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  rolling_summary text not null default '',
  durable_facts jsonb not null default '{}',
  last_compacted_message_id uuid,
  updated_at timestamptz not null default now(),
  unique (tenant_id, conversation_id)
);

create table risk_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  message_id uuid not null references messages(id) on delete cascade,
  level risk_level not null,
  reasons text[] not null default '{}',
  classifier_version text not null,
  created_at timestamptz not null default now()
);

create table handoff_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  dietitian_id uuid not null references dietitians(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  triggering_message_id uuid references messages(id),
  risk risk_level not null,
  reasons text[] not null default '{}',
  status case_status not null default 'open',
  urgency text not null default 'normal',
  safe_acknowledgement text not null,
  recommended_action text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table ai_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  mode client_ai_mode not null,
  ai_status client_ai_status not null,
  persona_id text not null references personas(id),
  risk risk_level not null,
  model text,
  action text not null,
  blocked_reason text,
  quality_issues text[] not null default '{}',
  reasons text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table messages
  add constraint messages_generated_by_ai_decision_fk
  foreign key (generated_by_ai_decision_id)
  references ai_decisions(id);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor_type text not null,
  actor_id text,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table processed_inbound_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  channel client_channel not null,
  provider_event_id text not null,
  received_at timestamptz not null default now(),
  unique (channel, provider_event_id)
);

create index clients_tenant_dietitian_idx on clients (tenant_id, dietitian_id);
create index tenant_memberships_user_idx on tenant_memberships (user_id, tenant_id);
create index messages_tenant_conversation_created_idx on messages (tenant_id, conversation_id, created_at desc);
create index messages_tenant_origin_created_idx on messages (tenant_id, origin, created_at desc);
create index client_ai_status_events_tenant_client_idx on client_ai_status_events (tenant_id, client_id, created_at desc);
create index handoff_cases_tenant_status_idx on handoff_cases (tenant_id, status, created_at desc);
create index ai_decisions_tenant_conversation_idx on ai_decisions (tenant_id, conversation_id, created_at desc);
create index processed_inbound_events_tenant_idx on processed_inbound_events (tenant_id, received_at desc);

create or replace function current_tenant_id()
returns uuid
language sql
stable
as $$
  select tenant_id
  from tenant_memberships
  where user_id = auth.uid()
  order by created_at asc
  limit 1
$$;

create or replace function is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from tenant_memberships
    where tenant_id = target_tenant_id
      and user_id = auth.uid()
  )
$$;

alter table tenants enable row level security;
alter table tenant_memberships enable row level security;
alter table dietitians enable row level security;
alter table dietitian_voice_profiles enable row level security;
alter table clients enable row level security;
alter table client_channels enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table client_ai_status_events enable row level security;
alter table conversation_memories enable row level security;
alter table risk_assessments enable row level security;
alter table handoff_cases enable row level security;
alter table ai_decisions enable row level security;
alter table audit_events enable row level security;
alter table processed_inbound_events enable row level security;

create policy "tenant members can read tenants"
on tenants for select
using (id = current_tenant_id() or is_tenant_member(id));

create policy "tenant members can read memberships"
on tenant_memberships for select
using (tenant_id = current_tenant_id() or is_tenant_member(tenant_id));

create policy "tenant scoped select dietitians"
on dietitians for select
using (tenant_id = current_tenant_id() or is_tenant_member(tenant_id));

create policy "tenant scoped select voice profiles"
on dietitian_voice_profiles for select
using (tenant_id = current_tenant_id() or is_tenant_member(tenant_id));

create policy "tenant scoped crud clients"
on clients for all
using (tenant_id = current_tenant_id() or is_tenant_member(tenant_id))
with check (tenant_id = current_tenant_id() or is_tenant_member(tenant_id));

create policy "tenant scoped crud client channels"
on client_channels for all
using (tenant_id = current_tenant_id() or is_tenant_member(tenant_id))
with check (tenant_id = current_tenant_id() or is_tenant_member(tenant_id));

create policy "tenant scoped crud conversations"
on conversations for all
using (tenant_id = current_tenant_id() or is_tenant_member(tenant_id))
with check (tenant_id = current_tenant_id() or is_tenant_member(tenant_id));

create policy "tenant scoped crud messages"
on messages for all
using (tenant_id = current_tenant_id() or is_tenant_member(tenant_id))
with check (tenant_id = current_tenant_id() or is_tenant_member(tenant_id));

create policy "tenant scoped crud activation events"
on client_ai_status_events for all
using (tenant_id = current_tenant_id() or is_tenant_member(tenant_id))
with check (tenant_id = current_tenant_id() or is_tenant_member(tenant_id));

create policy "tenant scoped crud memories"
on conversation_memories for all
using (tenant_id = current_tenant_id() or is_tenant_member(tenant_id))
with check (tenant_id = current_tenant_id() or is_tenant_member(tenant_id));

create policy "tenant scoped crud risk assessments"
on risk_assessments for all
using (tenant_id = current_tenant_id() or is_tenant_member(tenant_id))
with check (tenant_id = current_tenant_id() or is_tenant_member(tenant_id));

create policy "tenant scoped crud handoff cases"
on handoff_cases for all
using (tenant_id = current_tenant_id() or is_tenant_member(tenant_id))
with check (tenant_id = current_tenant_id() or is_tenant_member(tenant_id));

create policy "tenant scoped crud ai decisions"
on ai_decisions for all
using (tenant_id = current_tenant_id() or is_tenant_member(tenant_id))
with check (tenant_id = current_tenant_id() or is_tenant_member(tenant_id));

create policy "tenant scoped insert audit events"
on audit_events for insert
with check (tenant_id = current_tenant_id() or is_tenant_member(tenant_id));

create policy "tenant scoped read audit events"
on audit_events for select
using (tenant_id = current_tenant_id() or is_tenant_member(tenant_id));

create policy "tenant scoped crud processed events"
on processed_inbound_events for all
using (tenant_id = current_tenant_id() or is_tenant_member(tenant_id))
with check (tenant_id = current_tenant_id() or is_tenant_member(tenant_id));

insert into personas (id, label, behavior_contract)
values
  ('balanced_coach', 'Dengeli Koc', '{"tone":"warm, clear, practical","sentenceLength":"short","emojiPolicy":"rare"}'),
  ('warm_supporter', 'Sicak Destekci', '{"tone":"gentle, encouraging, emotionally present","sentenceLength":"short to medium","emojiPolicy":"limited"}'),
  ('disciplined_tracker', 'Disiplinli Takipci', '{"tone":"direct, accountable, structured","sentenceLength":"short","emojiPolicy":"none"}'),
  ('minimal_reply', 'Minimal Yanit', '{"tone":"concise, neutral, fast","sentenceLength":"very short","emojiPolicy":"none"}'),
  ('motivational_partner', 'Motivasyon Ortagi', '{"tone":"energetic, optimistic, action oriented","sentenceLength":"short to medium","emojiPolicy":"limited"}'),
  ('clinical_formal', 'Klinik Resmi', '{"tone":"professional, precise, reserved","sentenceLength":"medium","emojiPolicy":"none"}')
on conflict (id) do update
set label = excluded.label,
    behavior_contract = excluded.behavior_contract,
    is_active = true;
