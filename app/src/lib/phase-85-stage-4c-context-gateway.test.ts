import { describe, expect, it } from "vitest";
import {
  AI_CHAT_CONTEXT_MAX_SOURCE_REFS,
  AI_CHAT_CONTEXT_MAX_UNSTRUCTURED_EXCERPTS,
  AI_CHAT_CONTEXT_TOOLS,
} from "./phase-85-stage-4c-contracts";
import {
  buildClientContext,
  detectSecondClientReference,
  normalizeContextToolExecutionResult,
  parseContextToolArgs,
  planContextTools,
  recheckGatewayAccessBeforeCommit,
} from "./phase-85-stage-4c-context-gateway";
import {
  createDefaultClientGatewayFixture,
  createLargeClientGatewayFixture,
  executeInMemoryContextTool,
  toAccessibleClientIdentity,
  wrapContextToolExecutionResult,
} from "./phase-85-stage-4c-context-fixtures";
import {
  createDisabledSemanticRetriever,
  createFixtureSemanticRetriever,
  isRetrievalEligibleMessageRow,
  verifyCanonicalEvidenceRow,
} from "./phase-85-stage-4c-retrieval";
import { DIETITIAN_CHAT_INTENTS } from "dietitian-ai-assistant-architecture";

const clientA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const clientB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function buildGatewayInput(overrides: Partial<Parameters<typeof buildClientContext>[0]> = {}) {
  const fixture = createDefaultClientGatewayFixture(clientA, "Ayse Yilmaz");
  return {
    scopeType: "client" as const,
    clientId: clientA,
    triggerBody: "Guncel durum ozeti nedir?",
    accessCheck: async () => ({
      authorized: true,
      clientId: clientA,
      revisionToken: fixture.revisionToken,
      checkedAt: "2026-07-22T10:00:00.000Z",
    }),
    listAccessibleClients: async () => [
      toAccessibleClientIdentity({ id: clientA, fullName: "Ayse Yilmaz" }),
      toAccessibleClientIdentity({ id: clientB, fullName: "Mehmet Demir" }),
    ],
    executeTool: (tool, args) => executeInMemoryContextTool(fixture, tool, args),
    semanticRetriever: createDisabledSemanticRetriever(),
    ...overrides,
  };
}

describe("phase-85 stage 4c context gateway", () => {
  it("covers intent to tool-plan matrix for every client intent", () => {
    for (const intent of DIETITIAN_CHAT_INTENTS) {
      if (intent === "general_non_client" || intent === "second_client_reference") continue;
      const tools = planContextTools(intent, "client");
      if (intent === "unsupported_write_action") {
        expect(tools).toEqual([]);
        continue;
      }
      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        expect(AI_CHAT_CONTEXT_TOOLS).toContain(tool);
      }
    }
  });

  it("plans approved-source retrieval for general clinical queries", async () => {
    const tools = planContextTools("general_non_client", "general", "What is protein intake evidence?");
    expect(tools).toEqual(["search_approved_sources"]);

    const result = await buildClientContext({
      scopeType: "general",
      clientId: null,
      triggerBody: "Protein kaynaklari nelerdir?",
      accessCheck: async () => ({
        authorized: true,
        clientId: null,
        revisionToken: "conversation:1",
        checkedAt: "2026-07-22T10:00:00.000Z",
      }),
      listAccessibleClients: async () => [],
      executeTool: async (tool, args) =>
        wrapContextToolExecutionResult(tool, [
          {
            sourceId: "approved:1",
            clientId: "",
            sourceType: "approved_clinical_source",
            locator: "approved:1",
            excerpt: "Protein guidance excerpt.",
            contentHash: "hash-1",
            sourceDate: "2026-01-01",
            updatedAt: "2026-01-01T00:00:00.000Z",
            occurredAt: null,
            lifecycleStatus: "current",
            retrievalEligible: true,
            authorityWeight: 2,
          },
        ]),
    });
    expect(result.blocked).toBe(false);
    if (!result.blocked) {
      expect(result.toolCalls).toEqual(["search_approved_sources"]);
      expect(result.evidencePackage.sourceRefs.length).toBeGreaterThan(0);
      expect(
        result.evidencePackage.sourceRefs.every((item) => item.sourceType === "approved_clinical_source"),
      ).toBe(true);
    }
  });

  it("blocks general scope when client record evidence leaks into envelope", async () => {
    const blocked = await buildClientContext({
      scopeType: "general",
      clientId: null,
      triggerBody: "__fixture:general:clinical__",
      accessCheck: async () => ({
        authorized: true,
        clientId: null,
        revisionToken: "conversation:1",
        checkedAt: "2026-07-22T10:00:00.000Z",
      }),
      listAccessibleClients: async () => [],
      executeTool: async (tool) =>
        wrapContextToolExecutionResult(tool, [
          {
            sourceId: "client:leak",
            clientId: clientA,
            sourceType: "client_record",
            locator: "clients.profile",
            excerpt: "Leaked PHI",
            contentHash: "hash-leak",
            sourceDate: null,
            updatedAt: null,
            occurredAt: null,
            lifecycleStatus: "current",
            retrievalEligible: true,
            authorityWeight: 3,
          },
        ]),
    });
    expect(blocked.blocked).toBe(true);
    if (blocked.blocked) {
      expect(blocked.blockReason).toBe("general_scope_phi_leak");
    }
  });

  it("distinguishes ok, empty, and failed tool execution statuses", () => {
    expect(
      normalizeContextToolExecutionResult("load_client_profile", {
        status: "empty",
        rows: [],
      }),
    ).toMatchObject({ status: "empty", ok: false, categoryFailed: false });

    expect(
      normalizeContextToolExecutionResult("load_client_risk_timeline", {
        status: "failed",
        errorCode: "tool_timeout",
        rows: [],
        categoryFailed: true,
      }),
    ).toMatchObject({ status: "failed", ok: false, categoryCritical: true });
  });

  it("plans zero client tools in non-clinical general chat", async () => {
    const result = await buildClientContext({
      scopeType: "general",
      clientId: null,
      triggerBody: "Danisan durumu nasil?",
      accessCheck: async () => ({
        authorized: true,
        clientId: null,
        revisionToken: "conversation:1",
        checkedAt: "2026-07-22T10:00:00.000Z",
      }),
      listAccessibleClients: async () => [],
      executeTool: async (tool) => ({ tool, ok: true, rows: [] }),
    });
    expect(result.blocked).toBe(false);
    if (!result.blocked) {
      expect(result.toolCalls).toEqual([]);
      expect(result.evidencePackage.sourceRefs).toEqual([]);
    }
  });

  it("blocks second client full name, reference code, and uuid", async () => {
    const identities = [
      toAccessibleClientIdentity({ id: clientA, fullName: "Ayse Yilmaz" }),
      toAccessibleClientIdentity({ id: clientB, fullName: "Mehmet Demir" }),
    ];

    expect(
      detectSecondClientReference({
        triggerBody: "Mehmet Demir icin de bak",
        conversationClientId: clientA,
        accessibleClients: identities,
      }).blocked,
    ).toBe(true);

    expect(
      detectSecondClientReference({
        triggerBody: `Referans ${identities[1]!.referenceCode}`,
        conversationClientId: clientA,
        accessibleClients: identities,
      }).blocked,
    ).toBe(true);

    expect(
      detectSecondClientReference({
        triggerBody: `UUID ${clientB}`,
        conversationClientId: clientA,
        accessibleClients: identities,
      }).blocked,
    ).toBe(true);

    const blocked = await buildClientContext(
      buildGatewayInput({
        triggerBody: "Mehmet Demir kayitlarini da kiyasla",
      }),
    );
    expect(blocked.blocked).toBe(true);
    if (blocked.blocked) {
      expect(blocked.blockReason).toBe("second_client_reference");
    }
  });

  it("rejects forbidden tool args that try to inject client identity", () => {
    expect(() => parseContextToolArgs({ client_id: clientB })).toThrow("forbidden_tool_arg");
  });

  it("drops cross-client and deleted canonical rows", async () => {
    const fixture = createDefaultClientGatewayFixture(clientA, "Ayse Yilmaz");
    const crossClientRow = {
      ...fixture.profile!,
      sourceId: "cross:1",
      clientId: clientB,
    };
    const result = await buildClientContext(
      buildGatewayInput({
        executeTool: async (tool, args) => {
          if (tool === "load_client_profile") {
            return wrapContextToolExecutionResult(tool, [crossClientRow, fixture.profile!]);
          }
          return executeInMemoryContextTool(fixture, tool, args);
        },
      }),
    );
    expect(result.blocked).toBe(false);
    if (!result.blocked) {
      expect(result.evidencePackage.sourceRefs.every((item) => !item.sourceId.startsWith("cross:"))).toBe(
        true,
      );
      expect(result.evidencePackage.sourceRefs.some((item) => item.sourceId.includes("deleted"))).toBe(
        false,
      );
    }
  });

  it("enforces bounded limits on large fixture data", async () => {
    const fixture = createLargeClientGatewayFixture(clientA, "Ayse Yilmaz", 120);
    const result = await buildClientContext(
      buildGatewayInput({
        triggerBody: "__fixture:intent:client_specific_record__",
        executeTool: (tool, args) => executeInMemoryContextTool(fixture, tool, args),
      }),
    );
    expect(result.blocked).toBe(false);
    if (!result.blocked) {
      expect(result.evidencePackage.sourceRefs.length).toBeLessThanOrEqual(AI_CHAT_CONTEXT_MAX_SOURCE_REFS);
      expect(result.evidencePackage.unstructuredExcerpts.length).toBeLessThanOrEqual(
        AI_CHAT_CONTEXT_MAX_UNSTRUCTURED_EXCERPTS,
      );
    }
  });

  it("excludes unaccepted transcripts and unverified visual observations", () => {
    expect(
      isRetrievalEligibleMessageRow({
        transcriptStatus: "pending",
      }),
    ).toBe(false);
    expect(
      isRetrievalEligibleMessageRow({
        visualVerificationState: "unverified",
      }),
    ).toBe(false);
    expect(
      verifyCanonicalEvidenceRow(
        {
          sourceId: "x",
          clientId: clientA,
          sourceType: "client_record",
          locator: null,
          excerpt: "ok",
          contentHash: null,
          sourceDate: null,
          updatedAt: null,
          occurredAt: null,
          lifecycleStatus: "deleted",
          retrievalEligible: true,
          authorityWeight: 1,
        },
        clientA,
      ).ok,
    ).toBe(false);
  });

  it("detects stale revision before commit", () => {
    expect(
      recheckGatewayAccessBeforeCommit({
        capturedRevisionToken: "rev-a",
        currentAccess: {
          authorized: true,
          clientId: clientA,
          revisionToken: "rev-b",
          checkedAt: "2026-07-22T10:00:00.000Z",
        },
      }),
    ).toEqual({ ok: false, reason: "stale_context" });
  });

  it("marks critical risk tool failure as insufficient evidence", async () => {
    const fixture = createDefaultClientGatewayFixture(clientA, "Ayse Yilmaz");
    const result = await buildClientContext(
      buildGatewayInput({
        triggerBody: "__fixture:intent:client_risk_review__",
        executeTool: (tool, args) =>
          executeInMemoryContextTool(fixture, tool, args, { failRisk: true }),
      }),
    );
    expect(result.blocked).toBe(false);
    if (!result.blocked) {
      expect(result.evidencePackage.insufficientEvidence).toBe(true);
    }
  });

  it("uses fixture semantic retriever only in tests", async () => {
    const fixture = createDefaultClientGatewayFixture(clientA, "Ayse Yilmaz");
    const result = await buildClientContext(
      buildGatewayInput({
        semanticRetriever: createFixtureSemanticRetriever([
          {
            sourceId: "semantic:1",
            excerpt: "Fixture semantic excerpt",
            score: 0.9,
          },
        ]),
        executeTool: (tool, args) => executeInMemoryContextTool(fixture, tool, args),
      }),
    );
    expect(result.blocked).toBe(false);
    if (!result.blocked) {
      expect(result.evidencePackage.sourceRefs.some((item) => item.sourceId === "semantic:1")).toBe(true);
    }
  });
});
