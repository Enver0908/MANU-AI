-- P85-IF-R2: preserve the bigint conversation sequence contract in historical retrieval.

drop function if exists search_conversation_messages(uuid, uuid, text, integer);

create or replace function search_conversation_messages(
  p_tenant_id uuid,
  p_conversation_id uuid,
  p_query text,
  p_limit integer default 24
)
returns table (
  id uuid,
  body text,
  origin text,
  sender text,
  actor_type text,
  actor_resolution_basis text,
  provider_sent_at timestamptz,
  created_at timestamptz,
  conversation_sequence bigint,
  content_status text,
  retrieval_eligibility text,
  rank real
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.id,
    m.body,
    m.origin,
    m.sender,
    m.actor_type,
    m.actor_resolution_basis,
    m.provider_sent_at,
    m.created_at,
    m.conversation_sequence,
    m.content_status,
    m.retrieval_eligibility,
    ts_rank(m.search_vector, plainto_tsquery('simple', coalesce(p_query, ''))) as rank
  from messages m
  where m.tenant_id = p_tenant_id
    and m.conversation_id = p_conversation_id
    and coalesce(m.retrieval_eligibility, 'eligible') = 'eligible'
    and coalesce(m.content_status, 'available') in ('available', 'edited')
    and coalesce(m.status, 'stored') not in ('draft', 'blocked')
    and m.origin <> 'imported_unknown'
    and coalesce(m.actor_type, 'client') <> 'unknown'
    and (
      coalesce(p_query, '') = ''
      or m.search_vector @@ plainto_tsquery('simple', p_query)
    )
  order by rank desc, m.conversation_sequence desc nulls last, m.created_at desc
  limit greatest(p_limit, 1);
$$;
