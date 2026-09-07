import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import {
  assertNoSpoofedTenantIdentity,
  parseClientCreateEnvelope,
  parseClientPatchEnvelope,
  parseFormSaveEnvelope,
  parseRosterQuery,
  resetStage6IdempotencyForTests,
  scopedMutation,
  STAGE_6_REVISION_CONFLICT,
  Stage6ContractError,
} from "./phase-85-stage-6-dashboard-contracts";
import {
  mergeStage6MutationIntoAppState,
  projectStage6Roster,
  shouldApplyStage6Response,
} from "./phase-85-stage-6-client-workspace";

describe("phase-85-stage-6-dashboard-contracts", () => {
  it("parses roster query with clamped limit and rejects oversized query", () => {
    expect(parseRosterQuery({ query: "mert", limit: "500" }).limit).toBe(100);
    expect(() => parseRosterQuery({ query: "x".repeat(81) })).toThrow(Stage6ContractError);
    expect(() => parseRosterQuery({ limit: "0" })).toThrow(Stage6ContractError);
  });

  it("rejects actor-supplied tenant identity", () => {
    expect(() => assertNoSpoofedTenantIdentity({ tenantId: "other" })).toThrow(/actor_supplied_tenant_identity_rejected/);
    expect(() => parseClientPatchEnvelope({ requestId: "not-a-uuid", expectedRevision: 1 })).toThrow(/request_id_invalid/);
  });

  it("requires request id and expected revision on client patch", () => {
    const requestId = "11111111-1111-4111-8111-111111111111";
    const parsed = parseClientPatchEnvelope({ requestId, expectedRevision: 3, fullName: "Ayse" });
    expect(parsed.patch.fullName).toBe("Ayse");
    expect(() => parseClientPatchEnvelope({ requestId, expectedRevision: 3, unknown: true })).toThrow(/unknown_field/);
  });

  it("requires form save envelope revisions", () => {
    const requestId = "22222222-2222-4222-8222-222222222222";
    expect(() =>
      parseFormSaveEnvelope({ requestId, schemaId: "s", answers: {}, expectedClientContextRevision: 1 }),
    ).toThrow(/expected_schema_revision_required/);
  });

  it("requires request id on client create", () => {
    expect(() => parseClientCreateEnvelope({ fullName: "Mert" })).toThrow(/request_id_invalid/);
  });
});

describe("phase-85-stage-6-client-workspace merge", () => {
  it("merges form save into the matching client slice without a broad state field", () => {
    resetStage6IdempotencyForTests();
    const base = createInitialState();
    const client = base.clients[0]!;
    const schema = base.clientFormSchemas.find((item) => item.status === "published")!;
    const response = {
      kind: "client_form_save" as const,
      clientId: client.id,
      requestId: "33333333-3333-4333-8333-333333333333",
      payload: {
        response: {
          id: "resp-1",
          tenantId: client.tenantId,
          clientId: client.id,
          schemaId: schema.id,
          schemaVersion: schema.version,
          schemaSnapshot: schema,
          languageCode: schema.languageCode,
          submittedPhoneE164: client.primaryPhoneE164,
          answers: { goal: "updated" },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        clientContextRevision: client.contextRevision + 1,
      },
      revisions: { clientContextRevision: client.contextRevision + 1, formSchemaRevision: schema.version },
    };
    expect("state" in response).toBe(false);
    const merged = mergeStage6MutationIntoAppState(base, response);
    expect(merged.clients.find((item) => item.id === client.id)?.contextRevision).toBe(client.contextRevision + 1);
    expect(merged.clientFormResponses.some((item) => item.id === "resp-1")).toBe(true);
    expect(merged.messages.length).toBe(base.messages.length);
  });

  it("ignores stale responses for a different client id", () => {
    const response = scopedMutation("client_patch", "client-other", { client: { id: "client-other" } }, {}, null);
    expect(shouldApplyStage6Response(response, "client-mert")).toBe(false);
  });

  it("projects an active roster without removed clients", () => {
    const state = createInitialState();
    const page = projectStage6Roster(state, { query: "", cursor: null, limit: 10 });
    expect(page.items.every((item) => item.lifecycleStatus === "active")).toBe(true);
    expect(page.items.some((item) => "healthProfile" in item)).toBe(false);
  });

  it("uses revision_conflict code", () => {
    expect(STAGE_6_REVISION_CONFLICT).toBe("revision_conflict");
  });
});
