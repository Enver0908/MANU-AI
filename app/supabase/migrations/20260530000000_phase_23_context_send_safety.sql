alter table clients
  add column if not exists context_revision integer not null default 1;

alter table conversation_memories
  add column if not exists memory_version text not null default 'memory-v1',
  add column if not exists memory_revision integer not null default 1,
  add column if not exists stale boolean not null default false,
  add column if not exists stale_reasons text[] not null default '{}',
  add column if not exists compacted_through_message_id uuid references messages(id),
  add column if not exists compacted_through_created_at timestamptz,
  add column if not exists source_message_count integer not null default 0;

alter table ai_decisions
  add column if not exists context_manifest jsonb,
  add column if not exists send_status text not null default 'not_called',
  add column if not exists provider_output_safety jsonb,
  add column if not exists token_budget jsonb;

update ai_decisions
set send_status = case
  when action = 'sent' then 'legacy_sent_unverified'
  when action = 'draft_for_approval' then 'legacy_draft_unverified'
  when action = 'handoff' then 'not_applicable'
  when action = 'no_ai' and blocked_reason is not null then 'send_blocked'
  when action = 'no_ai' then 'not_called'
  else send_status
end
where send_status = 'not_called';

alter table ai_decisions
  drop constraint if exists ai_decisions_send_status_check;

alter table ai_decisions
  add constraint ai_decisions_send_status_check
  check (
    send_status in (
      'not_called',
      'send_eligible',
      'sent',
      'send_blocked',
      'draft_created',
      'draft_invalidated',
      'legacy_sent_unverified',
      'legacy_draft_unverified',
      'not_applicable'
    )
  );
