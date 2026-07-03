create table if not exists scope_rules (
  id text primary key,
  title text not null,
  body text not null,
  language_code text not null default 'tr',
  escalation_level text not null,
  version integer not null default 1,
  status text not null default 'draft',
  approved_by_dietitian_id uuid references dietitians(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint scope_rules_language_check check (language_code in ('tr', 'en', 'de', 'fr', 'es', 'pt', 'cs')),
  constraint scope_rules_escalation_check check (escalation_level in ('yellow', 'red')),
  constraint scope_rules_status_check check (status in ('draft', 'approved', 'archived'))
);

create table if not exists scope_rule_chunks (
  id text primary key,
  rule_id text not null references scope_rules(id) on delete cascade,
  chunk_index integer not null,
  chunk_text text not null,
  lexical_tokens jsonb not null default '[]'::jsonb,
  language_code text not null,
  escalation_level text not null,
  constraint scope_rule_chunks_escalation_check check (escalation_level in ('yellow', 'red'))
);

create index if not exists scope_rule_chunks_rule_idx on scope_rule_chunks (rule_id);

create table if not exists scope_guard_evaluations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  message_id uuid references messages(id) on delete set null,
  decision_level text not null,
  matched_rule_ids jsonb not null default '[]'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  scope_guard_version text not null,
  status text not null,
  created_at timestamptz not null default now(),
  constraint scope_guard_evaluations_level_check check (decision_level in ('green', 'yellow', 'red')),
  constraint scope_guard_evaluations_status_check check (status in ('noop', 'matched', 'no_match', 'unavailable'))
);

create index if not exists scope_guard_evaluations_tenant_created_idx
  on scope_guard_evaluations (tenant_id, created_at desc);

alter table scope_rules enable row level security;
alter table scope_rule_chunks enable row level security;
alter table scope_guard_evaluations enable row level security;

drop policy if exists "authenticated read scope rules" on scope_rules;
create policy "authenticated read scope rules"
on scope_rules for select
using (exists (select 1 from tenant_memberships tm where tm.user_id = auth.uid()));

drop policy if exists "owner admin write scope rules" on scope_rules;
create policy "owner admin write scope rules"
on scope_rules for all
using (
  exists (
    select 1 from tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.role in ('owner', 'admin')
  )
);

drop policy if exists "authenticated read scope rule chunks" on scope_rule_chunks;
create policy "authenticated read scope rule chunks"
on scope_rule_chunks for select
using (exists (select 1 from tenant_memberships tm where tm.user_id = auth.uid()));

drop policy if exists "owner admin write scope rule chunks" on scope_rule_chunks;
create policy "owner admin write scope rule chunks"
on scope_rule_chunks for all
using (
  exists (
    select 1 from tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.role in ('owner', 'admin')
  )
);

drop policy if exists "tenant scoped read scope guard evaluations" on scope_guard_evaluations;
create policy "tenant scoped read scope guard evaluations"
on scope_guard_evaluations for select
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian', 'assistant', 'auditor']::tenant_role[]));

drop policy if exists "tenant scoped insert scope guard evaluations" on scope_guard_evaluations;
create policy "tenant scoped insert scope guard evaluations"
on scope_guard_evaluations for insert
with check (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));
