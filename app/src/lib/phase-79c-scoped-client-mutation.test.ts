import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AppDomainError } from "./app-errors";
import { createClientInState, patchClientInState } from "./app-state-store";
import {
  buildClientCreateValidationState,
  buildClientPatchValidationState,
  evaluatePhase79cScopedClientMutationEvidence,
  mergeScopedClientCreateIntoAppState,
  mergeScopedClientPatchIntoAppState,
  patchValidationStateExcludesUnrelatedMessages,
} from "./phase-79c-scoped-client-mutation";
import { createBlankClient, createInitialState } from "./seed-data";

function stateWithSecondClient() {
  const state = createInitialState();
  const secondClient = createBlankClient({
    id: "client-second",
    fullName: "Second Client",
    primaryPhoneE164: "+905551110002",
    channelUserId: "second-user",
  });
  state.clients.push(secondClient);
  state.conversations.push({
    id: "conversation-client-second",
    tenantId: state.tenant.id,
    dietitianId: state.dietitian.id,
    clientId: secondClient.id,
    channel: "whatsapp",
    rollingSummary: "",
    memoryVersion: 1,
    memoryRevision: 1,
    memoryStale: false,
    revision: 1,
    createdAt: "2026-06-01T00:00:00.000Z",
  });
  state.messages.push({
    id: "msg-second-client",
    tenantId: state.tenant.id,
    conversationId: "conversation-client-second",
    sender: "client",
    body: "Unrelated client message body",
    origin: "inbound",
    status: "sent",
    createdAt: "2026-06-01T00:00:00.000Z",
  });
  return state;
}

function stateWithRemovedClient() {
  const state = createInitialState();
  state.clients.push({
    ...state.clients[0],
    id: "client-removed",
    lifecycleStatus: "removed_anonymized",
    removedAt: "2026-06-20T00:00:00.000Z",
    fullName: "[REDACTED]",
    primaryPhoneE164: null,
  });
  return state;
}

describe("Phase 79C scoped client mutation", () => {
  it("rejects duplicate phone on scoped create validation state", () => {
    const base = createInitialState();
    const validationState = buildClientCreateValidationState(base);

    expect(() =>
      createClientInState(validationState, {
        fullName: "Duplicate Phone",
        channel: "whatsapp",
        channelUserId: "duplicate",
        primaryPhoneE164: "+905551110001",
        communicationLanguage: "tr",
      }),
    ).toThrowError(/primary_phone_e164_duplicate/);
  });

  it("creates a client through scoped validation without loading unrelated messages", () => {
    const base = stateWithSecondClient();
    const validationState = buildClientCreateValidationState(base);

    expect(validationState.messages).toHaveLength(0);

    const next = createClientInState(validationState, {
      fullName: "New Client",
      channel: "whatsapp",
      channelUserId: "new-user",
      primaryPhoneE164: "+905551110099",
      communicationLanguage: "tr",
    });
    const newClient = next.clients[next.clients.length - 1];
    const newConversation = next.conversations.find((item) => item.clientId === newClient.id);
    const merged = mergeScopedClientCreateIntoAppState(base, newClient, newConversation);

    expect(merged.clients.some((client) => client.id === newClient.id)).toBe(true);
    expect(merged.messages).toHaveLength(base.messages.length);
    expect(merged.messages.some((message) => message.id === "msg-second-client")).toBe(true);
  });

  it("patches AI control through scoped validation and preserves dashboard state consistency", () => {
    const base = stateWithSecondClient();
    const validationState = buildClientPatchValidationState(base, "client-mert");
    const patched = patchClientInState(validationState, "client-mert", { aiStatus: "passive", aiMode: "copilot" });
    const updatedClient = patched.clients.find((client) => client.id === "client-mert")!;
    const auditEvent = {
      id: "audit-ai-control",
      tenantId: base.tenant.id,
      eventType: "client_ai_control_updated",
      entityType: "client",
      entityId: "client-mert",
      metadata: { source: "test" },
      createdAt: "2026-06-29T00:00:00.000Z",
    };
    const merged = mergeScopedClientPatchIntoAppState(base, updatedClient, [auditEvent]);

    expect(merged.clients.find((client) => client.id === "client-mert")?.aiStatus).toBe("passive");
    expect(merged.clients.find((client) => client.id === "client-mert")?.aiMode).toBe("copilot");
    expect(merged.messages).toEqual(base.messages);
    expect(merged.auditEvents.some((event) => event.id === "audit-ai-control")).toBe(true);
    expect(merged.clients.find((client) => client.id === "client-second")?.fullName).toBe("Second Client");
  });

  it("blocks patch on removed clients", () => {
    const base = stateWithRemovedClient();

    expect(() => buildClientPatchValidationState(base, "client-removed")).toThrow(AppDomainError);
    expect(() => buildClientPatchValidationState(base, "client-removed")).toThrow(/client_not_found/);
  });

  it("excludes unrelated client messages from patch validation state", () => {
    const base = stateWithSecondClient();
    const validationState = buildClientPatchValidationState(base, "client-mert");

    expect(validationState.messages).toHaveLength(0);
    expect(patchValidationStateExcludesUnrelatedMessages(validationState, "client-mert")).toBe(true);
  });

  it("rejects duplicate phone on scoped patch validation state", () => {
    const base = stateWithSecondClient();

    expect(() =>
      patchClientInState(buildClientPatchValidationState(base, "client-mert"), "client-mert", {
        primaryPhoneE164: "+905551110002",
      }),
    ).toThrowError(/primary_phone_e164_duplicate/);
  });

  it("evaluates Phase 79C scoped client mutation evidence as pass on clean fixture", () => {
    const base = stateWithRemovedClient();
    const evidence = evaluatePhase79cScopedClientMutationEvidence(base, "client-mert");

    expect(evidence.status).toBe("pass");
    expect(evidence.createValidationReady).toBe(true);
    expect(evidence.patchValidationReady).toBe(true);
    expect(evidence.mergeHelperReady).toBe(true);
    expect(evidence.removedClientPatchBlocked).toBe(true);
    expect(evidence.unrelatedMessagesExcluded).toBe(true);
    expect(evidence.failures).toHaveLength(0);
  });

  it("keeps Supabase create and patch off post-mutation broad reloads", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./supabase-store.ts", import.meta.url)),
      "utf8",
    );
    const createBody = source.match(/export async function createSupabaseClientRecord[\s\S]*?^}/m)?.[0] ?? "";
    const patchBody = source.match(/export async function patchSupabaseClientRecord[\s\S]*?^}/m)?.[0] ?? "";

    expect(createBody).not.toContain("return loadSupabaseState(context)");
    expect(patchBody).not.toContain("return loadSupabaseState(context)");
  });
});
