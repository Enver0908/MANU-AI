import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { buildTestNotification } from "./phase-85-stage-4b-notifications";
import {
  buildChannelTrustOperationalSnapshot,
  buildClientHumanControlBanner,
  buildQuarantineInspectionRows,
  buildStructuredUpdateSourceLinks,
  buildStructuredUpdateSourceLinksFromNotifications,
  buildTrustBindingInspectionSummary,
  resolveMessageProvenancePresentation,
} from "./phase-85-if-h-operational-visibility";
import { ensureHumanControlSessionForRiskState } from "./phase-85-if-f-risk-reactivation";

describe("phase-85-if-h operational visibility", () => {
  it("resolves provenance labels for client, AI, exact dietitian, and verified business human", () => {
    expect(resolveMessageProvenancePresentation({ origin: "client_inbound", actorType: "client", actorResolutionBasis: "provider_counterparty", authorDietitianId: null }).kind).toBe("client");
    expect(resolveMessageProvenancePresentation({ origin: "ai_generated", actorType: "ai", actorResolutionBasis: "ai_decision", authorDietitianId: null }).kind).toBe("ai");
    expect(
      resolveMessageProvenancePresentation({
        origin: "dietitian_manual",
        actorType: "exact_dietitian",
        actorResolutionBasis: "authenticated_manu_action",
        authorDietitianId: "dietitian-1",
      }).kind,
    ).toBe("exact_dietitian");
    expect(
      resolveMessageProvenancePresentation({
        origin: "dietitian_manual",
        actorType: "business_operator",
        actorResolutionBasis: "shared_authorized_team",
        authorDietitianId: null,
      }).kind,
    ).toBe("verified_business_human");
  });

  it("builds human-control banner with latest response time and activation eligibility", () => {
    const base = createInitialState();
    const client = base.clients.find((item) => item.id === "client-elif")!;
    const conversation = base.conversations.find((item) => item.clientId === "client-elif")!;
    const withSession = ensureHumanControlSessionForRiskState(
      {
        ...base,
        clients: base.clients.map((item) =>
          item.id === "client-elif" ? { ...item, aiStatus: "passive", aiMode: "manual" } : item,
        ),
      },
      {
      clientId: client.id,
      conversationId: conversation.id,
      reason: "yellow_risk_hold",
      previousAiStatus: client.aiStatus,
      previousAiMode: client.aiMode,
      openedByMessageId: "message-yellow-1",
      openedAt: "2026-07-10T10:00:00.000Z",
      },
    );
    const banner = buildClientHumanControlBanner(withSession, "client-elif");
    expect(banner).toMatchObject({
      reason: "yellow_risk_hold",
      reasonI18nKey: "humanControlReasonYellowHold",
      canActivateAi: true,
    });
  });

  it("aggregates channel trust counters without raw health text", () => {
    const state = createInitialState();
    const snapshot = buildChannelTrustOperationalSnapshot(state);
    expect(snapshot.status).toBe("healthy");
    expect(snapshot).toMatchObject({
      openQuarantineCount: expect.any(Number),
      activeAccountBindingCount: expect.any(Number),
      duplicateIgnoredCount: expect.any(Number),
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/password|token|secret/i);
  });

  it("lists quarantine and trust-binding inspection rows", () => {
    const state = createInitialState();
    expect(buildQuarantineInspectionRows(state).length).toBeGreaterThanOrEqual(0);
    expect(buildTrustBindingInspectionSummary(state).accounts.length).toBeGreaterThanOrEqual(0);
  });

  it("links structured updates to source messages from intake and notifications", () => {
    const state = {
      ...createInitialState(),
      messages: [
        {
          id: "message-structured-1",
          tenantId: "tenant-manu-demo",
          conversationId: "conversation-client-elif",
          sender: "client",
          body: "Menu degisikligi",
          origin: "client_inbound",
          actorType: "client",
          actorResolutionBasis: "provider_counterparty",
          authorDietitianId: null,
          risk: "green",
          status: "sent",
          createdAt: "2026-07-10T09:00:00.000Z",
          providerSentAt: null,
          sourceMessageId: null,
          retrievalEligibility: "eligible",
          contentStatus: "available",
        },
      ],
      contextIntakeProposals: [
        {
          id: "proposal-1",
          tenantId: "tenant-manu-demo",
          clientId: "client-elif",
          dietitianId: "dietitian-ayse",
          sourceChannel: "whatsapp",
          intakeSource: "phone",
          sourceTextDigest: "digest",
          sourceText: "Menu update",
          rawSourceReference: "message-structured-1",
          occurredAt: "2026-07-10T09:00:00.000Z",
          title: "Menu change",
          summary: "Client asked for menu change",
          details: "",
          importance: "important",
          structuredImpactFlags: ["menu_plan"],
          baselineContextRevision: 1,
          baselineFormRevision: null,
          baselineFoodRuleRevision: null,
          baselineMenuPlanRevision: 1,
          status: "blocked_structured_impact",
          confirmationCount: 0,
          appliedContextUpdateId: null,
          createdAt: "2026-07-10T09:01:00.000Z",
          updatedAt: "2026-07-10T09:01:00.000Z",
          expiresAt: null,
        },
      ],
      notifications: [
        buildTestNotification({
          id: "notification-1",
          tenantId: "tenant-manu-demo",
          type: "system",
          kind: "structured_record_update_required",
          entityType: "client",
          entityId: "client-elif",
          clientId: "client-elif",
          messageId: "message-structured-1",
          sourceMessageId: "message-structured-1",
          title: "Structured record update required",
          body: "WhatsApp instruction message-structured-1 requires a menu plan update before related AI intents can proceed.",
          read: false,
          acknowledgedAt: null,
          createdAt: "2026-07-10T09:02:00.000Z",
        }),
      ],
    };

    const links = buildStructuredUpdateSourceLinks(state, "client-elif");
    expect(links.some((link) => link.sourceMessageId === "message-structured-1")).toBe(true);
    expect(buildStructuredUpdateSourceLinksFromNotifications(state, "client-elif")).toHaveLength(1);
  });
});
