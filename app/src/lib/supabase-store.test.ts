import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { scopeSupabaseState, type DbClientAssignment } from "./supabase-store";
import type { AppTenantContext } from "./auth-context";

const OTHER_DIETITIAN_ID = "dietitian-other";

describe("Supabase scoped access", () => {
  it("keeps owner and admin access tenant-wide", () => {
    const state = scopedFixture();

    expect(scopeSupabaseState(state, context("owner"), []).clients).toHaveLength(state.clients.length);
    expect(scopeSupabaseState(state, context("admin"), []).messages).toHaveLength(state.messages.length);
  });

  it("lets dietitians see owned and explicitly assigned clients only", () => {
    const state = scopedFixture();
    const assignedClientId = state.clients[1].id;
    const hiddenClientId = state.clients[2].id;
    const scoped = scopeSupabaseState(state, context("dietitian"), [
      assignment(assignedClientId, state.dietitian.id),
    ]);

    expect(scoped.clients.map((client) => client.id)).toContain(state.clients[0].id);
    expect(scoped.clients.map((client) => client.id)).toContain(assignedClientId);
    expect(scoped.clients.map((client) => client.id)).not.toContain(hiddenClientId);
    expect(scoped.messages.every((message) => scoped.conversations.some((item) => item.id === message.conversationId))).toBe(true);
  });

  it("limits assistants to assigned clients", () => {
    const state = scopedFixture();
    const assignedClientId = state.clients[1].id;
    const scoped = scopeSupabaseState(state, context("assistant"), [
      assignment(assignedClientId, state.dietitian.id),
    ]);

    expect(scoped.clients.map((client) => client.id)).toEqual([assignedClientId]);
    expect(scoped.handoffCases.every((handoff) => handoff.clientId === assignedClientId)).toBe(true);
  });

  it("keeps auditor app state free of raw client and message records", () => {
    const state = scopedFixture();
    const scoped = scopeSupabaseState(state, context("auditor"), [
      assignment(state.clients[0].id, state.dietitian.id),
    ]);

    expect(scoped.clients).toEqual([]);
    expect(scoped.messages).toEqual([]);
    expect(scoped.aiDecisions).toEqual([]);
    expect(scoped.handoffCases).toEqual([]);
    expect(scoped.notifications).toEqual([]);
  });
});

function scopedFixture() {
  const state = createInitialState();
  return {
    ...state,
    clients: state.clients.map((client, index) =>
      index === 0 ? client : { ...client, dietitianId: OTHER_DIETITIAN_ID },
    ),
    conversations: state.conversations.map((conversation, index) =>
      index === 0 ? conversation : { ...conversation, dietitianId: OTHER_DIETITIAN_ID },
    ),
    handoffCases: state.handoffCases.map((handoff) => ({ ...handoff, clientId: state.clients[1].id })),
  };
}

function context(role: AppTenantContext["role"]): AppTenantContext {
  const state = createInitialState();
  return {
    tenantId: state.tenant.id,
    dietitianId: state.dietitian.id,
    userId: "user-test",
    role,
  };
}

function assignment(clientId: string, dietitianId: string): DbClientAssignment {
  return { client_id: clientId, dietitian_id: dietitianId };
}
