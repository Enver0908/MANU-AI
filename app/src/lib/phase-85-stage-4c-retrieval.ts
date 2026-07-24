import { createHash } from "node:crypto";
import {
  AI_CHAT_CONTEXT_LIMIT_SEARCH_CHUNKS,
  AI_CHAT_MAX_QUERY_LENGTH,
  AI_CHAT_SOURCE_EXCERPT_MAX_LENGTH,
  type AiChatSourceType,
} from "./phase-85-stage-4c-contracts";

export type AiChatSemanticRetrieverStatus = "disabled" | "fixture" | "available";

export type AiChatSemanticRetrieverHit = {
  sourceId: string;
  excerpt: string;
  score: number;
  locator?: string | null;
};

export type AiChatSemanticRetrieverResult = {
  status: AiChatSemanticRetrieverStatus;
  hits: AiChatSemanticRetrieverHit[];
};

export interface AiChatSemanticRetriever {
  readonly status: AiChatSemanticRetrieverStatus;
  search(input: { query: string; limit: number }): Promise<AiChatSemanticRetrieverResult>;
}

export type CanonicalEvidenceRow = {
  sourceId: string;
  clientId: string;
  sourceType: AiChatSourceType;
  locator: string | null;
  excerpt: string;
  contentHash: string | null;
  sourceDate: string | null;
  updatedAt: string | null;
  occurredAt: string | null;
  lifecycleStatus: "current" | "superseded" | "deleted";
  retrievalEligible: boolean;
  authorityWeight: number;
};

const FTS_UNSAFE_PATTERN = /[^\p{L}\p{N}\s"'-]/gu;

export function createDisabledSemanticRetriever(): AiChatSemanticRetriever {
  return {
    status: "disabled",
    async search() {
      return { status: "disabled", hits: [] };
    },
  };
}

export function createFixtureSemanticRetriever(
  hits: AiChatSemanticRetrieverHit[],
): AiChatSemanticRetriever {
  return {
    status: "fixture",
    async search(input) {
      return {
        status: "fixture",
        hits: hits.slice(0, input.limit),
      };
    },
  };
}

export function sanitizeFtsQuery(query: string) {
  const trimmed = query.trim().slice(0, AI_CHAT_MAX_QUERY_LENGTH);
  if (!trimmed) return "";
  return trimmed.replace(FTS_UNSAFE_PATTERN, " ").replace(/\s+/g, " ").trim();
}

export function computeEvidenceContentHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function truncateEvidenceExcerpt(value: string, maxLength = AI_CHAT_SOURCE_EXCERPT_MAX_LENGTH) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

export function isRetrievalEligibleMessageRow(row: {
  retrievalEligibility?: string | null;
  contentStatus?: string | null;
  status?: string | null;
  origin?: string | null;
  actorType?: string | null;
  transcriptStatus?: string | null;
  visualVerificationState?: string | null;
}) {
  if (row.retrievalEligibility && row.retrievalEligibility !== "eligible") return false;
  if (row.contentStatus && !["available", "edited"].includes(row.contentStatus)) return false;
  if (row.status && ["draft", "blocked", "deleted"].includes(row.status)) return false;
  if (row.origin === "imported_unknown") return false;
  if (row.actorType === "unknown") return false;
  if (row.transcriptStatus && row.transcriptStatus !== "accepted") return false;
  if (row.visualVerificationState && row.visualVerificationState !== "verified") return false;
  return true;
}

export function verifyGeneralScopeEvidenceRow(
  row: CanonicalEvidenceRow,
): { ok: true } | { ok: false; reason: string } {
  if (row.clientId) {
    return { ok: false, reason: "general_scope_client_id_forbidden" };
  }
  if (row.sourceType !== "approved_clinical_source") {
    return { ok: false, reason: "general_scope_source_type_forbidden" };
  }
  if (!row.retrievalEligible) {
    return { ok: false, reason: "retrieval_ineligible" };
  }
  if (row.lifecycleStatus === "deleted" || row.lifecycleStatus === "superseded") {
    return { ok: false, reason: row.lifecycleStatus };
  }
  if (!row.excerpt.trim()) {
    return { ok: false, reason: "empty_excerpt" };
  }
  return { ok: true };
}

export function rowViolatesGeneralScopePhiPolicy(row: CanonicalEvidenceRow) {
  return Boolean(row.clientId) || row.sourceType === "client_record";
}

export function verifyCanonicalEvidenceRow(
  row: CanonicalEvidenceRow,
  expectedClientId: string,
): { ok: true } | { ok: false; reason: string } {
  if (row.clientId !== expectedClientId) {
    return { ok: false, reason: "cross_client_source" };
  }
  if (!row.retrievalEligible) {
    return { ok: false, reason: "retrieval_ineligible" };
  }
  if (row.lifecycleStatus === "deleted" || row.lifecycleStatus === "superseded") {
    return { ok: false, reason: row.lifecycleStatus };
  }
  if (!row.excerpt.trim()) {
    return { ok: false, reason: "empty_excerpt" };
  }
  return { ok: true };
}

export function dedupeEvidenceBySourceId<T extends { sourceId: string; contentHash?: string | null }>(
  rows: T[],
) {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const row of rows) {
    const key = `${row.sourceId}:${row.contentHash ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(row);
  }
  return output;
}

export function sortEvidenceByTemporalPriority<T extends {
  sourceDate: string | null;
  updatedAt: string | null;
  occurredAt: string | null;
  authorityWeight: number;
}>(rows: T[]) {
  return [...rows].sort((left, right) => {
    const leftStamp = left.updatedAt ?? left.occurredAt ?? left.sourceDate ?? "";
    const rightStamp = right.updatedAt ?? right.occurredAt ?? right.sourceDate ?? "";
    if (leftStamp !== rightStamp) {
      if (!leftStamp) return 1;
      if (!rightStamp) return -1;
      return rightStamp.localeCompare(leftStamp);
    }
    return right.authorityWeight - left.authorityWeight;
  });
}

export function lexicalSearchClientMessages<T extends { body: string; sourceId: string }>(
  rows: T[],
  query: string,
  limit = AI_CHAT_CONTEXT_LIMIT_SEARCH_CHUNKS,
) {
  const tokens = sanitizeFtsQuery(query)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return [];

  const scored = rows
    .map((row) => {
      const haystack = row.body.toLowerCase();
      const score = tokens.reduce((total, token) => (haystack.includes(token) ? total + 1 : total), 0);
      return { row, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return scored.slice(0, limit).map((item) => item.row);
}

export function formatUnknownDateLabel(sourceDate: string | null, updatedAt: string | null, occurredAt: string | null) {
  if (sourceDate || updatedAt || occurredAt) return null;
  return "date_unknown";
}
