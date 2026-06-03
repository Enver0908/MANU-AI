import { tokenizeScopeText } from "./scope-corpus";
import type { ScopeRuleChunkRecord } from "./types";

export type RetrievedScopeRule = {
  ruleId: string;
  chunkId: string;
  score: number;
  escalationLevel: "yellow" | "red";
  titleHint?: string;
  chunkText?: string;
};

export type RetrievalProvider = {
  id: string;
  retrieve(input: { message: string; chunks: ScopeRuleChunkRecord[]; topK?: number }): Promise<RetrievedScopeRule[]>;
};

export const MOCK_LEXICAL_RETRIEVAL_PROVIDER_ID = "mock-lexical-retrieval-v0";

export function scoreLexicalSimilarity(messageTokens: string[], chunkTokens: string[]) {
  if (messageTokens.length === 0 || chunkTokens.length === 0) return 0;

  const messageSet = new Set(messageTokens);
  const chunkSet = new Set(chunkTokens);
  let intersection = 0;

  for (const token of messageSet) {
    if (chunkSet.has(token)) intersection += 1;
  }

  const denominator = Math.min(messageSet.size, chunkSet.size);
  return denominator === 0 ? 0 : intersection / denominator;
}

export function retrieveScopeRulesLexical(
  message: string,
  chunks: ScopeRuleChunkRecord[],
  topK = 3,
): RetrievedScopeRule[] {
  const messageTokens = tokenizeScopeText(message);
  const scored = chunks
    .map((chunk) => ({
      ruleId: chunk.ruleId,
      chunkId: chunk.id,
      score: scoreLexicalSimilarity(messageTokens, chunk.lexicalTokens),
      escalationLevel: chunk.escalationLevel,
      chunkText: chunk.chunkText,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

export const mockLexicalRetrievalProvider: RetrievalProvider = {
  id: MOCK_LEXICAL_RETRIEVAL_PROVIDER_ID,
  async retrieve({ message, chunks, topK = 3 }) {
    return retrieveScopeRulesLexical(message, chunks, topK);
  },
};

export class RealEmbeddingRetrievalProvider implements RetrievalProvider {
  readonly id = "real-embedding-retrieval-disconnected";

  async retrieve(): Promise<RetrievedScopeRule[]> {
    throw new Error("real_embedding_retrieval_disconnected");
  }
}

export function resolveRetrievalProvider(options: { allowReal?: boolean } = {}): RetrievalProvider {
  if (options.allowReal) {
    return new RealEmbeddingRetrievalProvider();
  }
  return mockLexicalRetrievalProvider;
}
