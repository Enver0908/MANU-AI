-- Phase 85 Stage 4D remediation Phase 2: auth rate limits and PWA audit hardening.

alter table rate_limit_buckets
  drop constraint if exists rate_limit_buckets_scope_check;

alter table rate_limit_buckets
  add constraint rate_limit_buckets_scope_check check (
    scope in (
      'simulator',
      'channel_inbound',
      'manual_reply',
      'draft_review',
      'internal_copilot',
      'dietitian_ai_chat',
      'commercial_mobile_install_audit'
    )
  );

create or replace function consume_rate_limit(
  p_tenant_id uuid,
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket rate_limit_buckets%rowtype;
  window_interval interval;
begin
  if p_scope not in (
    'simulator',
    'channel_inbound',
    'manual_reply',
    'draft_review',
    'internal_copilot',
    'dietitian_ai_chat',
    'commercial_mobile_install_audit'
  ) then
    raise exception 'rate_limit_scope_invalid';
  end if;
  if p_key_hash is null or length(p_key_hash) < 32 then
    raise exception 'rate_limit_key_hash_invalid';
  end if;
  if p_limit <= 0 or p_window_seconds <= 0 then
    raise exception 'rate_limit_config_invalid';
  end if;

  window_interval := make_interval(secs => p_window_seconds);

  insert into rate_limit_buckets as buckets (
    tenant_id,
    scope,
    key_hash,
    window_start,
    reset_at,
    count,
    created_at,
    updated_at
  )
  values (
    p_tenant_id,
    p_scope,
    p_key_hash,
    p_now,
    p_now + window_interval,
    1,
    p_now,
    p_now
  )
  on conflict (tenant_id, scope, key_hash)
  do update set
    window_start = case
      when buckets.reset_at <= p_now then p_now
      else buckets.window_start
    end,
    reset_at = case
      when buckets.reset_at <= p_now then p_now + window_interval
      else buckets.reset_at
    end,
    count = case
      when buckets.reset_at <= p_now then 1
      else buckets.count + 1
    end,
    updated_at = p_now
  returning * into bucket;

  return jsonb_build_object(
    'allowed', bucket.count <= p_limit,
    'scope', bucket.scope,
    'count', bucket.count,
    'limit', p_limit,
    'resetAt', bucket.reset_at
  );
end;
$$;

create table if not exists global_rate_limit_buckets (
  scope text not null,
  key_hash text not null,
  window_start timestamptz not null,
  reset_at timestamptz not null,
  count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash),
  constraint global_rate_limit_buckets_scope_check check (
    scope in (
      'commercial_invite_status',
      'commercial_checkout_create',
      'commercial_contact_leads',
      'auth_magic_link',
      'auth_password_login',
      'auth_password_reset',
      'auth_reauthenticate',
      'auth_password_update',
      'auth_email_change'
    )
  ),
  constraint global_rate_limit_buckets_key_hash_check check (length(key_hash) >= 32),
  constraint global_rate_limit_buckets_count_check check (count >= 0)
);

create index if not exists global_rate_limit_buckets_reset_idx
  on global_rate_limit_buckets (reset_at);

alter table global_rate_limit_buckets enable row level security;

drop policy if exists "service role only global rate limit buckets" on global_rate_limit_buckets;
create policy "service role only global rate limit buckets"
on global_rate_limit_buckets
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create or replace function consume_global_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket global_rate_limit_buckets%rowtype;
  window_interval interval;
begin
  if p_scope not in (
    'commercial_invite_status',
    'commercial_checkout_create',
    'commercial_contact_leads',
    'auth_magic_link',
    'auth_password_login',
    'auth_password_reset',
    'auth_reauthenticate',
    'auth_password_update',
    'auth_email_change'
  ) then
    raise exception 'global_rate_limit_scope_invalid';
  end if;
  if p_key_hash is null or length(p_key_hash) < 32 then
    raise exception 'global_rate_limit_key_hash_invalid';
  end if;
  if p_limit <= 0 or p_window_seconds <= 0 then
    raise exception 'global_rate_limit_config_invalid';
  end if;

  window_interval := make_interval(secs => p_window_seconds);

  insert into global_rate_limit_buckets as buckets (
    scope,
    key_hash,
    window_start,
    reset_at,
    count,
    created_at,
    updated_at
  )
  values (
    p_scope,
    p_key_hash,
    p_now,
    p_now + window_interval,
    1,
    p_now,
    p_now
  )
  on conflict (scope, key_hash)
  do update set
    window_start = case
      when buckets.reset_at <= p_now then p_now
      else buckets.window_start
    end,
    reset_at = case
      when buckets.reset_at <= p_now then p_now + window_interval
      else buckets.reset_at
    end,
    count = case
      when buckets.reset_at <= p_now then 1
      else buckets.count + 1
    end,
    updated_at = p_now
  returning * into bucket;

  return jsonb_build_object(
    'allowed', bucket.count <= p_limit,
    'scope', bucket.scope,
    'count', bucket.count,
    'limit', p_limit,
    'resetAt', bucket.reset_at
  );
end;
$$;

alter table mobile_install_audit_events
  add column if not exists event_day date;

update mobile_install_audit_events
set event_day = created_at::date
where event_day is null;

alter table mobile_install_audit_events
  alter column event_day set default current_date,
  alter column event_day set not null;

create table if not exists mobile_install_audit_event_duplicate_archive (
  archived_id uuid primary key,
  kept_id uuid not null,
  tenant_id uuid not null,
  dietitian_id uuid,
  auth_user_id uuid,
  event_type text not null,
  event_day date not null,
  user_agent_summary text not null default '',
  original_created_at timestamptz not null,
  archived_at timestamptz not null default now()
);

alter table mobile_install_audit_event_duplicate_archive enable row level security;

drop policy if exists "service role only mobile install duplicate archive"
on mobile_install_audit_event_duplicate_archive;
create policy "service role only mobile install duplicate archive"
on mobile_install_audit_event_duplicate_archive
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

with ranked as (
  select
    id,
    first_value(id) over (
      partition by tenant_id, dietitian_id, auth_user_id, event_type, event_day
      order by created_at asc, id asc
    ) as kept_id,
    row_number() over (
      partition by tenant_id, dietitian_id, auth_user_id, event_type, event_day
      order by created_at asc, id asc
    ) as duplicate_rank
  from mobile_install_audit_events
),
duplicates as (
  delete from mobile_install_audit_events events
  using ranked
  where events.id = ranked.id
    and ranked.duplicate_rank > 1
  returning
    events.id,
    ranked.kept_id,
    events.tenant_id,
    events.dietitian_id,
    events.auth_user_id,
    events.event_type,
    events.event_day,
    events.user_agent_summary,
    events.created_at
)
insert into mobile_install_audit_event_duplicate_archive (
  archived_id,
  kept_id,
  tenant_id,
  dietitian_id,
  auth_user_id,
  event_type,
  event_day,
  user_agent_summary,
  original_created_at
)
select
  id,
  kept_id,
  tenant_id,
  dietitian_id,
  auth_user_id,
  event_type,
  event_day,
  user_agent_summary,
  created_at
from duplicates
on conflict (archived_id) do nothing;

create unique index if not exists mobile_install_audit_events_daily_unique_idx
  on mobile_install_audit_events (tenant_id, dietitian_id, auth_user_id, event_type, event_day);

drop policy if exists "tenant members insert own mobile install audit" on mobile_install_audit_events;
create policy "tenant members insert own mobile install audit"
on mobile_install_audit_events for insert
with check (
  auth.uid() = auth_user_id
  and exists (
    select 1
    from tenant_memberships tm
    where tm.tenant_id = mobile_install_audit_events.tenant_id
      and tm.user_id = auth.uid()
  )
  and exists (
    select 1
    from dietitians d
    where d.id = mobile_install_audit_events.dietitian_id
      and d.tenant_id = mobile_install_audit_events.tenant_id
      and d.auth_user_id = auth.uid()
  )
);

revoke all on table global_rate_limit_buckets from public, anon, authenticated;
revoke all on table mobile_install_audit_event_duplicate_archive from public, anon, authenticated;
revoke all on function consume_global_rate_limit(text, text, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function consume_global_rate_limit(text, text, integer, integer, timestamptz) to service_role;
grant execute on function consume_rate_limit(uuid, text, text, integer, integer, timestamptz) to service_role;
