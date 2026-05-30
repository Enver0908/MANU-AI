-- Phase 26: read-only internal copilot persistence.

create table if not exists internal_copilot_tool_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  dietitian_id uuid not null references dietitians(id) on delete cascade,
  tool_name text not null,
  arguments jsonb not null default '{}',
  status text not null check (status in ('ok', 'ambiguous', 'not_found', 'unsupported')),
  source_refs jsonb not null default '[]',
  result_summary text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists internal_copilot_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  dietitian_id uuid not null references dietitians(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  body text not null,
  source_refs jsonb not null default '[]',
  tool_call_ids uuid[] not null default '{}',
  safety_status text not null check (safety_status in ('ok', 'needs_clarification', 'not_found', 'unsupported', 'no_sources')),
  created_at timestamptz not null default now()
);

create index if not exists internal_copilot_messages_tenant_dietitian_idx
  on internal_copilot_messages (tenant_id, dietitian_id, created_at desc);

create index if not exists internal_copilot_tool_calls_tenant_dietitian_idx
  on internal_copilot_tool_calls (tenant_id, dietitian_id, created_at desc);

alter table internal_copilot_messages enable row level security;
alter table internal_copilot_tool_calls enable row level security;

drop policy if exists "tenant scoped select internal copilot messages" on internal_copilot_messages;
create policy "tenant scoped select internal copilot messages"
on internal_copilot_messages for select
using (is_tenant_member(tenant_id));

drop policy if exists "tenant scoped write internal copilot messages" on internal_copilot_messages;
create policy "tenant scoped write internal copilot messages"
on internal_copilot_messages for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));

drop policy if exists "tenant scoped select internal copilot tool calls" on internal_copilot_tool_calls;
create policy "tenant scoped select internal copilot tool calls"
on internal_copilot_tool_calls for select
using (is_tenant_member(tenant_id));

drop policy if exists "tenant scoped write internal copilot tool calls" on internal_copilot_tool_calls;
create policy "tenant scoped write internal copilot tool calls"
on internal_copilot_tool_calls for all
using (is_tenant_member(tenant_id))
with check (is_tenant_member(tenant_id));
