import { encodeClientReferenceCode, formatClientReferenceShort } from "./client-reference-code";
import type { AiChatContextTool } from "./phase-85-stage-4c-contracts";
import type { CanonicalEvidenceRow } from "./phase-85-stage-4c-retrieval";
import type { ContextToolExecutionResult } from "./phase-85-stage-4c-context-gateway";

export type ClientGatewayFixture = {
  profile: CanonicalEvidenceRow | null;
  activeForm: CanonicalEvidenceRow[];
  foodRules: CanonicalEvidenceRow[];
  menuPlans: CanonicalEvidenceRow[];
  contextUpdates: CanonicalEvidenceRow[];
  recentMessages: CanonicalEvidenceRow[];
  searchableMessages: CanonicalEvidenceRow[];
  transcripts: CanonicalEvidenceRow[];
  riskTimeline: CanonicalEvidenceRow[];
  handoffs: CanonicalEvidenceRow[];
  aiDecisions: CanonicalEvidenceRow[];
  recordAssets: CanonicalEvidenceRow[];
  approvedSources: CanonicalEvidenceRow[];
  revisionToken: string;
};

export function createDefaultClientGatewayFixture(clientId: string, fullName: string): ClientGatewayFixture {
  const now = "2026-07-22T10:00:00.000Z";
  const base = {
    clientId,
    sourceDate: "2026-07-01",
    updatedAt: now,
    occurredAt: now,
    lifecycleStatus: "current" as const,
    retrievalEligible: true,
    authorityWeight: 3,
  };

  return {
    revisionToken: `rev-${clientId}`,
    profile: {
      sourceId: `profile:${clientId}`,
      sourceType: "client_record",
      locator: "clients.profile",
      excerpt: `${fullName} active client profile snapshot.`,
      contentHash: null,
      ...base,
    },
    activeForm: [
      {
        sourceId: `form:${clientId}:1`,
        sourceType: "client_record",
        locator: "client_form_responses.active",
        excerpt: "Active form: weight trend stable.",
        contentHash: null,
        ...base,
      },
    ],
    foodRules: [
      {
        sourceId: `food:${clientId}:1`,
        sourceType: "client_record",
        locator: "client_food_rule_profiles",
        excerpt: "Forbidden: shellfish.",
        contentHash: null,
        ...base,
      },
    ],
    menuPlans: [
      {
        sourceId: `menu:${clientId}:1`,
        sourceType: "client_record",
        locator: "client_menu_plans.active",
        excerpt: "Active menu plan week 29.",
        contentHash: null,
        ...base,
      },
    ],
    contextUpdates: [
      {
        sourceId: `ctx:${clientId}:1`,
        sourceType: "client_record",
        locator: "client_context_updates",
        excerpt: "Dietitian context update: hydration goal adjusted.",
        contentHash: null,
        ...base,
      },
    ],
    recentMessages: [
      {
        sourceId: `msg:${clientId}:recent:1`,
        sourceType: "client_record",
        locator: "messages.recent",
        excerpt: "Client: Feeling better after lunch.",
        contentHash: null,
        ...base,
      },
    ],
    searchableMessages: [
      {
        sourceId: `msg:${clientId}:search:1`,
        sourceType: "client_record",
        locator: "messages.search",
        excerpt: "Client asked about evening snack options.",
        contentHash: null,
        ...base,
      },
      {
        sourceId: `msg:${clientId}:search:deleted`,
        sourceType: "client_record",
        locator: "messages.search",
        excerpt: "Deleted message should never surface.",
        contentHash: null,
        clientId,
        sourceDate: "2026-06-01",
        updatedAt: now,
        occurredAt: now,
        lifecycleStatus: "deleted",
        retrievalEligible: false,
        authorityWeight: 1,
      },
    ],
    transcripts: [
      {
        sourceId: `tx:${clientId}:accepted`,
        sourceType: "client_record",
        locator: "audio_transcription_records.accepted",
        excerpt: "Accepted transcript: discussed weekly adherence.",
        contentHash: null,
        ...base,
      },
      {
        sourceId: `tx:${clientId}:pending`,
        sourceType: "client_record",
        locator: "audio_transcription_records.pending",
        excerpt: "Pending transcript must be excluded.",
        contentHash: null,
        clientId,
        sourceDate: "2026-06-15",
        updatedAt: now,
        occurredAt: now,
        lifecycleStatus: "current",
        retrievalEligible: false,
        authorityWeight: 1,
      },
    ],
    riskTimeline: [
      {
        sourceId: `risk:${clientId}:1`,
        sourceType: "client_record",
        locator: "risk_assessments",
        excerpt: "Risk timeline: latest assessment green.",
        contentHash: null,
        ...base,
      },
    ],
    handoffs: [
      {
        sourceId: `handoff:${clientId}:1`,
        sourceType: "client_record",
        locator: "handoff_cases",
        excerpt: "No open handoff cases.",
        contentHash: null,
        ...base,
      },
    ],
    aiDecisions: [
      {
        sourceId: `decision:${clientId}:1`,
        sourceType: "client_record",
        locator: "ai_decisions",
        excerpt: "Latest AI decision required dietitian review.",
        contentHash: null,
        ...base,
      },
    ],
    recordAssets: [
      {
        sourceId: `asset:${clientId}:1`,
        sourceType: "client_record",
        locator: "media_assets",
        excerpt: "Uploaded lab PDF summary.",
        contentHash: null,
        ...base,
      },
      {
        sourceId: `asset:${clientId}:unverified`,
        sourceType: "client_record",
        locator: "media_assets.visual",
        excerpt: "Unverified visual observation.",
        contentHash: null,
        clientId,
        sourceDate: null,
        updatedAt: null,
        occurredAt: null,
        lifecycleStatus: "current",
        retrievalEligible: false,
        authorityWeight: 1,
      },
    ],
    approvedSources: [
      {
        sourceId: `approved:${clientId}:1`,
        sourceType: "approved_clinical_source",
        locator: "approved_sources",
        excerpt: "Approved clinical source snippet on fiber intake.",
        contentHash: null,
        ...base,
        authorityWeight: 2,
      },
    ],
  };
}

export function createLargeClientGatewayFixture(clientId: string, fullName: string, rowCount = 120) {
  const fixture = createDefaultClientGatewayFixture(clientId, fullName);
  const rows: CanonicalEvidenceRow[] = [];
  for (let index = 0; index < rowCount; index += 1) {
    rows.push({
      sourceId: `msg:${clientId}:bulk:${index}`,
      clientId,
      sourceType: "client_record",
      locator: "messages.bulk",
      excerpt: `Bulk message ${index} about meal logging.`,
      contentHash: null,
      sourceDate: "2026-07-01",
      updatedAt: `2026-07-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
      occurredAt: `2026-07-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
      lifecycleStatus: "current",
      retrievalEligible: true,
      authorityWeight: 1,
    });
  }
  fixture.searchableMessages = rows;
  fixture.recentMessages = rows.slice(-40);
  return fixture;
}

export function executeInMemoryContextTool(
  fixture: ClientGatewayFixture,
  tool: AiChatContextTool,
  args: Record<string, unknown>,
  options?: { failRisk?: boolean; delayMs?: number },
): Promise<ContextToolExecutionResult> {
  return new Promise((resolve) => {
    const finish = () => {
      if (options?.failRisk && tool === "load_client_risk_timeline") {
        resolve({
          tool,
          ok: false,
          errorCode: "tool_failed",
          rows: [],
          categoryFailed: true,
          categoryCritical: true,
        });
        return;
      }

      const rows = selectFixtureRows(fixture, tool, args);
      resolve({
        tool,
        ok: true,
        rows,
      });
    };

    if (options?.delayMs) {
      setTimeout(finish, options.delayMs);
      return;
    }
    finish();
  });
}

function selectFixtureRows(fixture: ClientGatewayFixture, tool: AiChatContextTool, args: Record<string, unknown>) {
  switch (tool) {
    case "load_client_profile":
      return fixture.profile ? [fixture.profile] : [];
    case "load_client_active_form":
      return fixture.activeForm;
    case "load_client_food_rule_profile":
      return fixture.foodRules;
    case "load_client_menu_plans":
      return fixture.menuPlans;
    case "load_client_context_updates":
      return fixture.contextUpdates;
    case "load_client_recent_messages":
      return fixture.recentMessages;
    case "search_client_messages": {
      const query = String(args.query ?? "").toLowerCase();
      return fixture.searchableMessages.filter((row) => row.excerpt.toLowerCase().includes(query) || !query);
    }
    case "load_client_accepted_transcripts":
      return fixture.transcripts.filter((row) => row.retrievalEligible);
    case "load_client_risk_timeline":
      return fixture.riskTimeline;
    case "load_client_handoffs":
      return fixture.handoffs;
    case "load_client_ai_decisions":
      return fixture.aiDecisions;
    case "load_client_record_assets":
      return fixture.recordAssets.filter((row) => row.retrievalEligible);
    case "search_approved_sources": {
      const query = String(args.query ?? "").toLowerCase();
      return fixture.approvedSources.filter((row) => row.excerpt.toLowerCase().includes(query) || !query);
    }
    default:
      return [];
  }
}

export function toAccessibleClientIdentity(client: {
  id: string;
  fullName: string;
}) {
  return {
    id: client.id,
    fullName: client.fullName,
    referenceCode: encodeClientReferenceCode(client.id),
    referenceShort: formatClientReferenceShort(client.id),
  };
}
