create table if not exists inbound_quarantines (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  channel text not null,
  source_conversation_type text not null,
  source_conversation_id text,
  source_message_id text,
  sender_channel_user_id text,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint inbound_quarantines_channel_check check (channel in ('whatsapp', 'telegram')),
  constraint inbound_quarantines_source_type_check check (source_conversation_type in ('group')),
  constraint inbound_quarantines_reason_check check (reason in ('whatsapp_group_unsupported'))
);

create index if not exists inbound_quarantines_tenant_created_idx
  on inbound_quarantines (tenant_id, created_at desc);

alter table inbound_quarantines enable row level security;

drop policy if exists "tenant scoped crud inbound quarantines" on inbound_quarantines;

create policy "tenant scoped crud inbound quarantines"
on inbound_quarantines for all
using (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]))
with check (has_tenant_role(tenant_id, array['owner', 'admin', 'dietitian']::tenant_role[]));
