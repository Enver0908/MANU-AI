import type { RetrievalCandidateMessage } from "./phase-85-if-e-historical-retrieval";

export const PHASE_85_IF_E_SUPABASE_SEARCH_VERSION = "p85-if-e-supabase-search-v1";

export type SupabaseConversationMessageSearchRow = {
  id: string;
  body: string;
  origin: string;
  sender: string;
  actor_type: string | null;
  actor_resolution_basis: string | null;
  provider_sent_at: string | null;
  created_at: string;
  conversation_sequence: number | null;
  content_status: string | null;
  retrieval_eligibility: string | null;
  rank: number;
};

export function mapSupabaseSearchRowToRetrievalCandidate(
  row: SupabaseConversationMessageSearchRow,
  tenantId: string,
  conversationId: string,
): RetrievalCandidateMessage {
  return {
    id: row.id,
    tenantId,
    conversationId,
    sender: row.sender as RetrievalCandidateMessage["sender"],
    body: row.body,
    origin: row.origin as RetrievalCandidateMessage["origin"],
    status: "stored",
    actorType: (row.actor_type as RetrievalCandidateMessage["actorType"]) || undefined,
    actorResolutionBasis:
      (row.actor_resolution_basis as RetrievalCandidateMessage["actorResolutionBasis"]) || undefined,
    providerSentAt: row.provider_sent_at,
    createdAt: row.created_at,
    conversationSequence: row.conversation_sequence,
    contentStatus: (row.content_status as RetrievalCandidateMessage["contentStatus"]) || "available",
    retrievalEligibility:
      (row.retrieval_eligibility as RetrievalCandidateMessage["retrievalEligibility"]) || "eligible",
  };
}

export function buildSearchConversationMessagesRpcParams(input: {
  tenantId: string;
  conversationId: string;
  query: string;
  limit?: number;
}) {
  return {
    p_tenant_id: input.tenantId,
    p_conversation_id: input.conversationId,
    p_query: input.query,
    p_limit: input.limit ?? 24,
  };
}
