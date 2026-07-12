import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { buildTestNotification } from "./phase-85-stage-4b-notifications";
import {
  PHASE_79B_VERSION,
  WINDOWED_READ_DEFAULTS,
  windowClientList,
  windowClientDetail,
  windowTimeline,
  windowHandoffs,
  windowNotifications,
  windowAuditAggregate,
  buildPhase79WindowedDashboardPayload,
  evaluatePhase79bWindowedReadEvidence,
  buildPhase79bWindowedReadHealthSignal,
} from "./phase-79b-windowed-read-contracts";

function stateWithRemovedClient() {
  const state = createInitialState();
  const removedClient = {
    ...state.clients[0],
    id: "client-removed-test",
    lifecycleStatus: "removed_anonymized" as const,
    removedAt: "2026-06-20T00:00:00.000Z",
    fullName: "[REDACTED]",
    primaryPhoneE164: null,
  };
  state.clients = [...state.clients, removedClient];
  return { state, removedClientId: removedClient.id };
}

function stateWithManyClients(count: number) {
  const state = createInitialState();
  for (let i = 0; i < count; i += 1) {
    state.clients.push({
      ...state.clients[0],
      id: `client-scale-${String(i).padStart(4, "0")}`,
      fullName: `Scale Client ${i}`,
      primaryPhoneE164: null,
    });
  }
  return state;
}

describe("Phase 79B windowed read contracts", () => {
  describe("windowClientList", () => {
    it("returns visible clients with cursor pagination", () => {
      const state = stateWithManyClients(120);
      const first = windowClientList(state, { limit: 50 });
      expect(first.items.length).toBeLessThanOrEqual(50);
      expect(first.totalVisible).toBeGreaterThan(50);
      expect(first.nextCursor).not.toBeNull();

      const second = windowClientList(state, { cursor: first.nextCursor, limit: 50 });
      expect(second.items.length).toBeGreaterThan(0);
      expect(second.items[0].id).not.toBe(first.items[0].id);
    });

    it("caps page size at maxPageSize", () => {
      const state = stateWithManyClients(200);
      const result = windowClientList(state, { limit: 999 });
      expect(result.pageSize).toBeLessThanOrEqual(WINDOWED_READ_DEFAULTS.clientListMaxPageSize);
    });

    it("rejects invalid cursor", () => {
      const state = createInitialState();
      expect(() => windowClientList(state, { cursor: "nonexistent-cursor" })).toThrow("cursor");
    });

    it("excludes removed/anonymized clients from visible list", () => {
      const { state, removedClientId } = stateWithRemovedClient();
      const result = windowClientList(state);
      const ids = result.items.map((item) => item.id);
      expect(ids).not.toContain(removedClientId);
      expect(result.totalVisible).toBe(state.clients.filter((c) => c.lifecycleStatus !== "removed_anonymized").length);
    });
  });

  describe("windowClientDetail", () => {
    it("returns detail for a visible client", () => {
      const state = createInitialState();
      const visibleId = state.clients.find((c) => c.lifecycleStatus === "active")!.id;
      const result = windowClientDetail(state, visibleId);
      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.client.id).toBe(visibleId);
      }
    });

    it("returns not found for removed client", () => {
      const { state, removedClientId } = stateWithRemovedClient();
      const result = windowClientDetail(state, removedClientId);
      expect(result.found).toBe(false);
    });

    it("returns not found for nonexistent client", () => {
      const state = createInitialState();
      const result = windowClientDetail(state, "no-such-client");
      expect(result.found).toBe(false);
    });
  });

  describe("windowTimeline", () => {
    it("returns messages only for the selected client", () => {
      const state = createInitialState();
      const clientId = state.clients[0].id;
      const clientConvIds = new Set(
        state.conversations.filter((c) => c.clientId === clientId).map((c) => c.id),
      );
      const result = windowTimeline(state, clientId);
      for (const entry of result.items) {
        expect(clientConvIds.has(entry.conversationId)).toBe(true);
      }
    });

    it("returns empty timeline for removed client", () => {
      const { state, removedClientId } = stateWithRemovedClient();
      const result = windowTimeline(state, removedClientId);
      expect(result.items).toHaveLength(0);
      expect(result.totalMessages).toBe(0);
    });

    it("caps timeline window at max window size", () => {
      const state = createInitialState();
      const clientId = state.clients[0].id;
      const result = windowTimeline(state, clientId, { limit: 999 });
      expect(result.windowSize).toBeLessThanOrEqual(WINDOWED_READ_DEFAULTS.timelineMaxWindowSize);
    });

    it("does not return raw message bodies in timeline entries", () => {
      const state = createInitialState();
      const clientId = state.clients[0].id;
      const result = windowTimeline(state, clientId);
      for (const entry of result.items) {
        expect(entry).not.toHaveProperty("body");
      }
    });
  });

  describe("windowHandoffs", () => {
    it("excludes handoffs belonging to removed clients", () => {
      const { state, removedClientId } = stateWithRemovedClient();
      state.handoffCases.push({
        id: "handoff-removed",
        tenantId: "demo-tenant",
        dietitianId: "demo-dietitian",
        clientId: removedClientId,
        conversationId: "conv-removed",
        triggeringMessageId: null,
        risk: "red",
        reasons: ["test"],
        status: "open",
        urgency: "urgent",
        safeAcknowledgement: "",
        recommendedAction: "",
        createdAt: "2026-06-20T00:00:00.000Z",
      });
      const result = windowHandoffs(state);
      const clientIds = result.items.map((h) => h.clientId);
      expect(clientIds).not.toContain(removedClientId);
    });

    it("paginates handoffs with cursor", () => {
      const state = createInitialState();
      for (let i = 0; i < 30; i += 1) {
        state.handoffCases.push({
          id: `handoff-gen-${i}`,
          tenantId: "demo-tenant",
          dietitianId: "demo-dietitian",
          clientId: state.clients[0].id,
          conversationId: state.conversations[0].id,
          triggeringMessageId: null,
          risk: "yellow",
          reasons: ["test"],
          status: "open",
          urgency: "standard",
          safeAcknowledgement: "",
          recommendedAction: "",
          createdAt: `2026-06-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
        });
      }
      const first = windowHandoffs(state, { limit: 10 });
      expect(first.items.length).toBe(10);
      expect(first.nextCursor).not.toBeNull();

      const second = windowHandoffs(state, { cursor: first.nextCursor, limit: 10 });
      expect(second.items.length).toBeGreaterThan(0);
    });
  });

  describe("windowNotifications", () => {
    it("paginates notifications with cursor", () => {
      const state = createInitialState();
      for (let i = 0; i < 30; i += 1) {
        state.notifications.push(
          buildTestNotification({
            id: `notif-gen-${i}`,
            tenantId: "demo-tenant",
            type: "system",
            entityType: "client",
            entityId: state.clients[0].id,
            clientId: state.clients[0].id,
            title: `Notification ${i}`,
            body: "test body",
            read: false,
            acknowledgedAt: null,
            createdAt: `2026-06-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
          }),
        );
      }
      const first = windowNotifications(state, { limit: 10 });
      expect(first.items.length).toBe(10);
      expect(first.nextCursor).not.toBeNull();
    });

    it("does not include raw notification body in windowed entries", () => {
      const state = createInitialState();
      state.notifications.push(
        buildTestNotification({
          id: "notif-body-test",
          tenantId: "demo-tenant",
          type: "system",
          entityType: "client",
          entityId: state.clients[0].id,
          clientId: state.clients[0].id,
          title: "Test",
          body: "secret body content",
          read: false,
          acknowledgedAt: null,
          createdAt: "2026-06-01T00:00:00.000Z",
        }),
      );
      const result = windowNotifications(state, { limit: 10 });
      for (const entry of result.items) {
        expect(entry).not.toHaveProperty("body");
      }
    });

    it("excludes notifications for removed clients", () => {
      const { state, removedClientId } = stateWithRemovedClient();
      state.notifications.push(
        buildTestNotification({
          id: "notif-removed-client",
          tenantId: "demo-tenant",
          type: "system",
          entityType: "client",
          entityId: removedClientId,
          clientId: removedClientId,
          title: "Removed client should not show",
          body: "hidden",
          read: false,
          acknowledgedAt: null,
          createdAt: "2026-06-20T00:00:00.000Z",
        }),
      );

      const result = windowNotifications(state, { limit: 10 });
      expect(result.items.map((item) => item.id)).not.toContain("notif-removed-client");
    });

    it("excludes unknown notification entity types fail-closed", () => {
      const state = createInitialState();
      state.notifications.push(
        buildTestNotification({
          id: "notif-unknown-entity",
          tenantId: "demo-tenant",
          type: "system",
          entityType: "unknown_external_entity",
          entityId: "external-1",
          title: "Unknown",
          body: "hidden",
          read: false,
          acknowledgedAt: null,
          createdAt: "2026-06-20T00:00:00.000Z",
        }),
      );

      const result = windowNotifications(state, { limit: 10 });
      expect(result.items.map((item) => item.id)).not.toContain("notif-unknown-entity");
    });
  });

  describe("windowAuditAggregate", () => {
    it("returns aggregate counts without raw event data", () => {
      const state = createInitialState();
      state.auditEvents.push({
        id: "audit-1",
        tenantId: "demo-tenant",
        eventType: "client_created",
        entityType: "client",
        entityId: "client-mert",
        metadata: {},
        createdAt: "2026-06-01T00:00:00.000Z",
      });
      state.auditEvents.push({
        id: "audit-2",
        tenantId: "demo-tenant",
        eventType: "ai_decision",
        entityType: "ai_decision",
        entityId: "decision-1",
        metadata: {},
        createdAt: "2026-06-02T00:00:00.000Z",
      });

      const result = windowAuditAggregate(state);
      expect(result.totalEventCount).toBe(2);
      expect(result.entityTypeCounts["client"]).toBe(1);
      expect(result.entityTypeCounts["ai_decision"]).toBe(1);
      expect(result).not.toHaveProperty("events");

      const json = JSON.stringify(result);
      expect(json).not.toContain("phone");
      expect(json).not.toContain("secret");
      expect(json).not.toContain("prompt");
    });
  });

  describe("buildPhase79WindowedDashboardPayload", () => {
    it("builds a bounded dashboard payload without notification bodies", () => {
      const state = createInitialState();
      state.notifications.push(
        buildTestNotification({
          id: "notif-visible-payload",
          tenantId: "demo-tenant",
          type: "system",
          entityType: "client",
          entityId: state.clients[0].id,
          clientId: state.clients[0].id,
          title: "Visible",
          body: "secret body content",
          read: false,
          acknowledgedAt: null,
          createdAt: "2026-06-20T00:00:00.000Z",
        }),
      );

      const payload = buildPhase79WindowedDashboardPayload(state, {
        clientLimit: 2,
        detailClientId: state.clients[0].id,
        timelineClientId: state.clients[0].id,
      });
      const json = JSON.stringify(payload);

      expect(payload.clients.items.length).toBeLessThanOrEqual(2);
      expect(payload.clientDetail?.found).toBe(true);
      expect(payload.timeline?.clientId).toBe(state.clients[0].id);
      expect(payload.healthSignal.phase79WindowedReadReady).toBe(true);
      expect(json).not.toContain("secret body content");
    });
  });

  describe("evaluatePhase79bWindowedReadEvidence", () => {
    it("passes with clean state", () => {
      const state = createInitialState();
      const evidence = evaluatePhase79bWindowedReadEvidence(state);
      expect(evidence.version).toBe(PHASE_79B_VERSION);
      expect(evidence.status).toBe("pass");
      expect(evidence.removedClientLeakDetected).toBe(false);
      expect(evidence.rawDataInAggregateDetected).toBe(false);
      expect(evidence.failures).toHaveLength(0);
    });

    it("detects removed client leak in windowed reads", () => {
      const { state, removedClientId } = stateWithRemovedClient();
      const clientConvId = state.conversations.find((c) => c.clientId === state.clients[0].id)?.id;
      if (clientConvId) {
        state.conversations.push({
          ...state.conversations[0],
          id: "conv-for-removed",
          clientId: removedClientId,
        });
        state.messages.push({
          id: "msg-for-removed",
          tenantId: "demo-tenant",
          conversationId: "conv-for-removed",
          sender: "client",
          body: "test",
          origin: "inbound",
          status: "sent",
          createdAt: "2026-06-20T00:00:00.000Z",
        });
      }

      const evidence = evaluatePhase79bWindowedReadEvidence(state);
      expect(evidence.removedClientLeakDetected).toBe(false);
      expect(evidence.status).toBe("pass");
    });

    it("keeps removed client notifications out of readiness evidence", () => {
      const { state, removedClientId } = stateWithRemovedClient();
      state.notifications.push(
        buildTestNotification({
          id: "notif-removed-evidence",
          tenantId: "demo-tenant",
          type: "system",
          entityType: "client",
          entityId: removedClientId,
          clientId: removedClientId,
          title: "Removed client evidence",
          body: "hidden",
          read: false,
          acknowledgedAt: null,
          createdAt: "2026-06-20T00:00:00.000Z",
        }),
      );

      const evidence = evaluatePhase79bWindowedReadEvidence(state);
      expect(evidence.removedClientLeakDetected).toBe(false);
      expect(evidence.status).toBe("pass");
    });

    it("reports all window readiness flags", () => {
      const state = createInitialState();
      const evidence = evaluatePhase79bWindowedReadEvidence(state);
      expect(evidence.clientListWindowReady).toBe(true);
      expect(evidence.clientDetailScopedReady).toBe(true);
      expect(evidence.timelineWindowReady).toBe(true);
      expect(evidence.handoffWindowReady).toBe(true);
      expect(evidence.notificationWindowReady).toBe(true);
      expect(evidence.auditAggregateReady).toBe(true);
    });
  });

  describe("buildPhase79bWindowedReadHealthSignal", () => {
    it("produces operational health fields from evidence", () => {
      const state = createInitialState();
      const evidence = evaluatePhase79bWindowedReadEvidence(state);
      const signal = buildPhase79bWindowedReadHealthSignal(evidence);
      expect(signal.phase79WindowedReadVersion).toBe(PHASE_79B_VERSION);
      expect(signal.phase79WindowedReadStatus).toBe("pass");
      expect(signal.phase79WindowedReadReady).toBe(true);
      expect(signal.phase79WindowedReadFailures).toHaveLength(0);
    });
  });
});
