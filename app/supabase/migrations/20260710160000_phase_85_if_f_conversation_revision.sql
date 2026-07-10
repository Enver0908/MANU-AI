-- Phase 85 Interstage Foundation P85-IF-F: conversation revision and decision generation capture.

alter table conversations
  add column if not exists revision bigint not null default 1;

alter table ai_decisions
  add column if not exists conversation_revision_at_generation bigint;

create index if not exists conversations_tenant_client_revision_idx
  on conversations (tenant_id, client_id, revision);

create or replace function p85_if_f_commit_conversation_revisions(p_tenant_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  affected_rows integer;
begin
  for item in select * from jsonb_array_elements(coalesce(p_payload->'conversationUpdates', '[]'::jsonb)) loop
    update conversations
    set revision = greatest(revision, coalesce(nullif(item->>'revision', '')::bigint, revision))
    where tenant_id = p_tenant_id and id = (item->>'id')::uuid;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'conversation_not_found';
    end if;
  end loop;
end;
$$;
