import { createHash } from "node:crypto";
import {
  PHASE_71_TURKIYE_OFFICIAL_SOURCES,
  PHASE_71_TURKIYE_SOURCE_PACK_VERSION,
  type Phase71TurkiyeOfficialSource,
} from "./phase-71-turkiye-official-sources";
import { AI_CHAT_SOURCE_EXCERPT_MAX_LENGTH } from "./phase-85-stage-4c-contracts";
import {
  buildDeidentifiedWebResearchQuery,
  detectDietitianChatPromptInjectionSignals,
  wrapUntrustedSourceContent,
} from "dietitian-ai-assistant-architecture";

export const STAGE_4C_SOURCES_VERSION = "p85-stage-4c-sources-v1";

export type AiChatApprovedSourceStatus = "approved" | "review_required" | "retired";

export type AiChatApprovedSourceRecord = {
  id: string;
  externalSourceId: string;
  title: string;
  publisher: string;
  sourceUrl: string;
  publicationDate: string | null;
  versionLabel: string;
  jurisdiction: string;
  approvalStatus: AiChatApprovedSourceStatus;
  effectiveAt: string;
  retiredAt: string | null;
  reviewDueAt: string | null;
  sourceHash: string;
  createdAt: string;
};

export type AiChatApprovedSourceChunkRecord = {
  id: string;
  approvedSourceId: string;
  page: number | null;
  section: string | null;
  locator: string;
  excerpt: string;
  contentHash: string;
};

export type AiChatRunSourceClaimDto = {
  claimId: string;
  kind: "verified_fact" | "inference" | "recommendation";
  text: string;
  label: string | null;
  uncertainty: string | null;
  sourceRefIds: string[];
};

export type AiChatRunSourceItemDto = {
  sourceRefId: string;
  sourceType: string;
  title: string;
  publisher: string | null;
  sourceUrl: string | null;
  locator: string | null;
  sourceDate: string | null;
  excerpt: string;
  dateLabel: string | null;
};

export type AiChatRunSourcesResponse = {
  runId: string;
  claims: AiChatRunSourceClaimDto[];
  sources: AiChatRunSourceItemDto[];
};

export type AiChatWebResearchProviderStatus = "disabled" | "fixture";

export interface AiChatWebResearchProvider {
  readonly status: AiChatWebResearchProviderStatus;
  research(input: { query: string }): Promise<{
    ok: boolean;
    reason?: string;
    publisher?: string | null;
    snippet?: string | null;
    contentHash?: string | null;
    pageOpened?: boolean;
    sourceUrl?: string | null;
  }>;
}

export function computeApprovedSourceHash(source: {
  externalSourceId: string;
  title: string;
  publicationDate: string | null;
  versionLabel: string;
  publisher: string;
  sourceUrl: string;
  chunkTexts: string[];
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        externalSourceId: source.externalSourceId,
        title: source.title,
        publicationDate: source.publicationDate,
        versionLabel: source.versionLabel,
        publisher: source.publisher,
        sourceUrl: source.sourceUrl,
        chunkTexts: source.chunkTexts,
      }),
    )
    .digest("hex");
}

export function buildApprovedSourceImportManifest(sources: Phase71TurkiyeOfficialSource[] = PHASE_71_TURKIYE_OFFICIAL_SOURCES) {
  return sources.map((source) => {
    const chunkTexts = [
      source.phase71Role,
      ...source.criticalSections.map((section) => `${section}: ${source.title}`),
      ...source.impact.green,
      ...source.impact.yellow,
    ].map((text) => text.slice(0, AI_CHAT_SOURCE_EXCERPT_MAX_LENGTH));

    return {
      packVersion: PHASE_71_TURKIYE_SOURCE_PACK_VERSION,
      externalSourceId: source.sourceId,
      title: source.title,
      publisher: source.officialAuthority,
      sourceUrl: source.sourceUrl,
      publicationDate: source.publicationDate,
      versionLabel: source.versionNote,
      jurisdiction: source.jurisdiction,
      approvalStatus: source.priority === "P2" ? ("review_required" as const) : ("approved" as const),
      sourceHash: computeApprovedSourceHash({
        externalSourceId: source.sourceId,
        title: source.title,
        publicationDate: source.publicationDate,
        versionLabel: source.versionNote,
        publisher: source.officialAuthority,
        sourceUrl: source.sourceUrl,
        chunkTexts,
      }),
      chunks: chunkTexts.map((excerpt, index) => ({
        page: null,
        section: source.criticalSections[index] ?? `section-${index + 1}`,
        locator: `${source.sourceId}#${index + 1}`,
        excerpt,
        contentHash: createHash("sha256").update(excerpt).digest("hex"),
      })),
    };
  });
}

export function isApprovedSourceRetrievalEligible(source: Pick<AiChatApprovedSourceRecord, "approvalStatus" | "retiredAt" | "reviewDueAt">, now = new Date()) {
  if (source.approvalStatus === "retired" || source.retiredAt) return false;
  if (source.reviewDueAt && new Date(source.reviewDueAt).getTime() < now.getTime()) return false;
  return source.approvalStatus === "approved";
}

export function sanitizeApprovedSourceExcerpt(excerpt: string) {
  const injection = detectDietitianChatPromptInjectionSignals(excerpt);
  if (injection.flagged) {
    return {
      excerpt: "",
      blocked: true,
      reasons: injection.reasons,
    };
  }
  return {
    excerpt: wrapUntrustedSourceContent(excerpt.slice(0, AI_CHAT_SOURCE_EXCERPT_MAX_LENGTH)),
    blocked: false,
    reasons: [],
  };
}

export function createDisabledWebResearchProvider(): AiChatWebResearchProvider {
  return {
    status: "disabled",
    async research() {
      return { ok: false, reason: "web_research_disabled" };
    },
  };
}

export function createFixtureWebResearchProvider(result: {
  publisher: string;
  snippet: string;
  contentHash: string;
  sourceUrl: string;
}): AiChatWebResearchProvider {
  return {
    status: "fixture",
    async research() {
      return {
        ok: true,
        publisher: result.publisher,
        snippet: result.snippet,
        contentHash: result.contentHash,
        pageOpened: true,
        sourceUrl: result.sourceUrl,
      };
    },
  };
}

export { buildDeidentifiedWebResearchQuery };

export type InMemoryApprovedSourceState = {
  sources: AiChatApprovedSourceRecord[];
  chunks: AiChatApprovedSourceChunkRecord[];
};

export function createInMemoryApprovedSourceStateFromManifest(
  manifest = buildApprovedSourceImportManifest(),
): InMemoryApprovedSourceState {
  const now = new Date().toISOString();
  const sources: AiChatApprovedSourceRecord[] = [];
  const chunks: AiChatApprovedSourceChunkRecord[] = [];

  for (const item of manifest) {
    const sourceId = `approved:${item.externalSourceId}:${item.sourceHash.slice(0, 12)}`;
    sources.push({
      id: sourceId,
      externalSourceId: item.externalSourceId,
      title: item.title,
      publisher: item.publisher,
      sourceUrl: item.sourceUrl,
      publicationDate: item.publicationDate,
      versionLabel: item.versionLabel,
      jurisdiction: item.jurisdiction,
      approvalStatus: item.approvalStatus,
      effectiveAt: now,
      retiredAt: null,
      reviewDueAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      sourceHash: item.sourceHash,
      createdAt: now,
    });
    for (const chunk of item.chunks) {
      chunks.push({
        id: `${sourceId}:${chunk.locator}`,
        approvedSourceId: sourceId,
        page: chunk.page,
        section: chunk.section,
        locator: chunk.locator,
        excerpt: chunk.excerpt,
        contentHash: chunk.contentHash,
      });
    }
  }

  return { sources, chunks };
}

export function searchInMemoryApprovedSources(
  state: InMemoryApprovedSourceState,
  query: string,
  limit = 5,
) {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2);
  const results: Array<{ source: AiChatApprovedSourceRecord; chunk: AiChatApprovedSourceChunkRecord; score: number }> = [];

  for (const chunk of state.chunks) {
    const source = state.sources.find((item) => item.id === chunk.approvedSourceId);
    if (!source || !isApprovedSourceRetrievalEligible(source)) continue;
    const haystack = `${source.title} ${chunk.excerpt}`.toLowerCase();
    const score = tokens.reduce((total, token) => (haystack.includes(token) ? total + 1 : total), 0);
    if (!tokens.length || score > 0) {
      results.push({ source, chunk, score: score || 1 });
    }
  }

  return results
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => ({
      sourceRefId: item.chunk.id,
      sourceType: "approved_clinical_source" as const,
      canonicalEntityId: item.source.id,
      locator: item.chunk.locator,
      excerpt: item.chunk.excerpt,
      title: item.source.title,
      publisher: item.source.publisher,
      sourceUrl: item.source.sourceUrl,
      sourceDate: item.source.publicationDate,
      contentHash: item.chunk.contentHash,
    }));
}

export function importApprovedSourcesIdempotent(
  current: InMemoryApprovedSourceState,
  manifest = buildApprovedSourceImportManifest(),
) {
  const next = {
    sources: [...current.sources],
    chunks: [...current.chunks],
  };
  let inserted = 0;
  let skipped = 0;

  for (const item of manifest) {
    const existing = next.sources.find(
      (source) =>
        source.externalSourceId === item.externalSourceId && source.sourceHash === item.sourceHash,
    );
    if (existing) {
      skipped += 1;
      continue;
    }

    const created = createInMemoryApprovedSourceStateFromManifest([item]);
    next.sources.push(...created.sources);
    next.chunks.push(...created.chunks);
    inserted += 1;
  }

  return { state: next, inserted, skipped };
}
