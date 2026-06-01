alter table clients
  add column if not exists red_risk_lock jsonb not null default '{"status":"none"}'::jsonb;

update clients
set red_risk_lock = '{"status":"none"}'::jsonb
where red_risk_lock is null;

create index if not exists clients_tenant_red_risk_lock_status_idx
  on clients (tenant_id, ((red_risk_lock->>'status')));
