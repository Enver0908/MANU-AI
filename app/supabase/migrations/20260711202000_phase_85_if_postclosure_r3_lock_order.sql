-- P85-IF post-closure audit: use the same client -> conversation lock order as atomic activation.

create or replace function p85_if_r3_assert_expected_conversation_revisions(
  p_tenant_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  current_revision bigint;
begin
  perform client.id
  from clients client
  where client.tenant_id = p_tenant_id
    and client.id in (
      select distinct conversation.client_id
      from conversations conversation
      join jsonb_each_text(coalesce(p_payload->'expectedConversationRevisions', '{}'::jsonb)) expected
        on expected.key::uuid = conversation.id
      where conversation.tenant_id = p_tenant_id
    )
  order by client.id
  for update;

  for item in
    select key::uuid as conversation_id, value::bigint as expected_revision
    from jsonb_each_text(coalesce(p_payload->'expectedConversationRevisions', '{}'::jsonb))
    order by key::uuid
  loop
    select revision
    into current_revision
    from conversations
    where tenant_id = p_tenant_id and id = item.conversation_id
    for update;

    if not found then raise exception 'conversation_not_found'; end if;
    if current_revision <> item.expected_revision then
      raise exception 'reactivation_conflict_conversation_revision';
    end if;
  end loop;
end;
$$;

revoke all on function p85_if_r3_assert_expected_conversation_revisions(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function p85_if_r3_assert_expected_conversation_revisions(uuid, jsonb)
  to service_role;
