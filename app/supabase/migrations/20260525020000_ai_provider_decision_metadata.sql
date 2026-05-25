alter table ai_decisions
  add column if not exists prompt_version text,
  add column if not exists provider_id text,
  add column if not exists provider_status text not null default 'not_called',
  add column if not exists provider_error_code text;
