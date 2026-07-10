import { describe, expect, it } from "vitest";
import { buildClientScopedExport, anonymizeClientInState } from "./data-governance";
import { buildPhase74ExportPackage } from "./phase-74-data-lifecycle-policy";
import { applyPhase79LifecycleRedactionContract } from "./phase-79e-lifecycle-redaction-evidence";
import {
  buildP85IfILifecycleClosureEvidence,
  evaluateP85IfIProgramClosureEvidence,
  exportExcludesTenantChannelBindings,
  revokeTenantChannelBindingsInState,
  PHASE_85_IF_I_EXPORT_EXTENSION_VERSION,
} from "./phase-85-if-i-lifecycle-closure";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";

function seedP85IfIState() {
  const base = createInitialState();
  return {
    ...base,
    messages: [
      ...base.messages,
      {
        id: "message-p85-if-i-1",
        tenantId: DEMO_TENANT_ID,
        conversationId: "conversation-client-mert",
        sender: "client" as const,
        body: "Menu degisikligi",
        origin: "client_inbound" as const,
        providerAccountBindingId: "binding-1",
        providerEventId: "evt-1",
        providerMessageId: "wamid-1",
        actorBindingId: "actor-1",
        actorType: "client" as const,
        actorResolutionBasis: "provider_counterparty" as const,
        authorDietitianId: null,
        risk: "green" as const,
        status: "sent" as const,
        createdAt: "2026-07-10T10:00:00.000Z",
        retrievalEligibility: "eligible" as const,
        contentStatus: "available" as const,
      },
    ],
    channelMessageRevisions: [
      {
        id: "revision-1",
        tenantId: DEMO_TENANT_ID,
        messageId: "message-p85-if-i-1",
        channelEventId: "channel-event-1",
        providerEventId: "evt-1",
        revisionAction: "edit" as const,
        priorContentStatus: "available" as const,
        currentContentStatus: "edited" as const,
        priorBodyDigest: "digest-before",
        currentBodyDigest: "digest-after",
        revisionSequence: 1,
        providerTime: "2026-07-10T10:01:00.000Z",
        observedAt: "2026-07-10T10:01:00.000Z",
      },
    ],
    humanControlSessions: [
      {
        id: "session-1",
        tenantId: DEMO_TENANT_ID,
        clientId: "client-mert",
        conversationId: "conversation-client-mert",
        reason: "yellow_risk_hold" as const,
        status: "active" as const,
        previousAiStatus: "active" as const,
        previousAiMode: "copilot" as const,
        linkedHandoffId: null,
        linkedYellowHoldMessageId: "message-p85-if-i-1",
        openedByMessageId: "message-p85-if-i-1",
        latestHumanMessageId: "message-p85-if-i-1",
        humanResponseObservedCount: 1,
        openedAt: "2026-07-10T10:02:00.000Z",
        resolvedAt: null,
        reactivatedByDietitianId: null,
        reactivationReasonCode: null,
        restoredAiMode: null,
      },
    ],
    riskActivityEvents: [
      {
        id: "risk-activity-1",
        tenantId: DEMO_TENANT_ID,
        clientId: "client-mert",
        conversationId: "conversation-client-mert",
        humanControlSessionId: "session-1",
        eventType: "human_response_observed" as const,
        sourceMessageId: "message-p85-if-i-1",
        handoffId: null,
        aiDecisionId: null,
        metadata: { observed: true },
        createdAt: "2026-07-10T10:03:00.000Z",
      },
    ],
    contextIntakeProposals: [
      {
        id: "proposal-1",
        tenantId: DEMO_TENANT_ID,
        clientId: "client-mert",
        dietitianId: "dietitian-ayse",
        sourceChannel: "whatsapp" as const,
        intakeSource: "phone" as const,
        sourceTextDigest: "digest",
        sourceText: "Off-channel note",
        rawSourceReference: "message-p85-if-i-1",
        occurredAt: "2026-07-10T09:00:00.000Z",
        title: "Phone follow-up",
        summary: "Client discussed menu",
        details: "",
        importance: "important" as const,
        structuredImpactFlags: ["menu_plan"],
        baselineContextRevision: 1,
        baselineFormRevision: null,
        baselineFoodRuleRevision: null,
        baselineMenuPlanRevision: 1,
        status: "blocked_structured_impact" as const,
        confirmationCount: 0,
        appliedContextUpdateId: null,
        createdAt: "2026-07-10T09:01:00.000Z",
        updatedAt: "2026-07-10T09:01:00.000Z",
        expiresAt: null,
      },
    ],
    aiDecisions: [
      ...base.aiDecisions,
      {
        id: "decision-p85-if-i-1",
        tenantId: DEMO_TENANT_ID,
        conversationId: "conversation-client-mert",
        clientId: "client-mert",
        mode: "copilot" as const,
        aiStatus: "active" as const,
        personaId: "balanced_coach",
        risk: "green" as const,
        model: "mock",
        promptVersion: "v2",
        providerAttempted: false,
        providerStatus: "not_called" as const,
        providerErrorCode: null,
        blockedReason: null,
        qualityIssues: [],
        reasons: [],
        contextManifest: {
          sourceRefs: [{ id: "message-p85-if-i-1", category: "message", segmentType: "history" }],
          structuredRecordUpdates: [{ sourceMessageId: "message-p85-if-i-1", targetPanel: "menu" }],
        },
        createdAt: "2026-07-10T10:04:00.000Z",
      },
    ],
    channelAccountBindings: [
      {
        id: "binding-1",
        tenantId: DEMO_TENANT_ID,
        provider: "whatsapp_cloud" as const,
        providerAccountId: "acct-1",
        wabaId: "waba-1",
        businessPhoneNumberId: "phone-1",
        normalizedDisplayNumber: "+905551110000",
        operatingMode: "mock" as const,
        lifecycleStatus: "active" as const,
        attributionPolicy: "shared_authorized_team" as const,
        verifiedAt: "2026-07-10T08:00:00.000Z",
        revokedAt: null,
        createdByDietitianId: "dietitian-ayse",
        revokedByDietitianId: null,
        createdAt: "2026-07-10T08:00:00.000Z",
        updatedAt: "2026-07-10T08:00:00.000Z",
      },
    ],
    channelActorBindings: [
      {
        id: "actor-1",
        tenantId: DEMO_TENANT_ID,
        accountBindingId: "binding-1",
        dietitianId: "dietitian-ayse",
        actorType: "business_operator" as const,
        attributionBasis: "shared_authorized_team" as const,
        verifiedAt: "2026-07-10T08:00:00.000Z",
        revokedAt: null,
        createdByDietitianId: "dietitian-ayse",
        revokedByDietitianId: null,
        createdAt: "2026-07-10T08:00:00.000Z",
        updatedAt: "2026-07-10T08:00:00.000Z",
      },
    ],
  };
}

describe("phase-85-if-i lifecycle closure", () => {
  it("extends client export with interstage records and excludes tenant channel bindings", () => {
    const state = seedP85IfIState();
    const exported = buildClientScopedExport(state, "client-mert");

    expect(exported.interstageExportVersion).toBe(PHASE_85_IF_I_EXPORT_EXTENSION_VERSION);
    expect(exported.humanControlSessions).toHaveLength(1);
    expect(exported.riskActivityEvents).toHaveLength(1);
    expect(exported.channelMessageRevisions).toHaveLength(1);
    expect(exported.retrievalSourceReferences?.length).toBeGreaterThan(0);
    expect(exportExcludesTenantChannelBindings(exported)).toBe(true);
  });

  it("includes interstage export files in phase 74 export package", () => {
    const state = seedP85IfIState();
    const exportPackage = buildPhase74ExportPackage(state, "client-mert");
    expect(exportPackage.manifest.interstageExportVersion).toBe(PHASE_85_IF_I_EXPORT_EXTENSION_VERSION);
    expect(exportPackage.files["human_control_sessions.json"]).toContain("session-1");
    expect(exportPackage.files["retrieval_source_references.json"]).toContain("message-p85-if-i-1");
  });

  it("redacts interstage client-scoped records during anonymization", () => {
    const state = seedP85IfIState();
    const anonymized = anonymizeClientInState(state, "client-mert");
    const evidence = buildP85IfILifecycleClosureEvidence(anonymized, "client-mert");

    expect(evidence.status).toBe("pass");
    const message = anonymized.messages.find((item) => item.id === "message-p85-if-i-1");
    expect(message?.providerEventId).toBeNull();
    expect(anonymized.humanControlSessions[0]?.openedByMessageId).toBeNull();
    expect(anonymized.riskActivityEvents[0]?.metadata).toMatchObject({ minimized: true });
    expect(anonymized.contextIntakeProposals[0]?.sourceText).toBeNull();
    expect(anonymized.aiDecisions.find((item) => item.id === "decision-p85-if-i-1")?.contextManifest).toMatchObject({
      minimized: true,
    });
  });

  it("routes full lifecycle redaction contract through phase 79 with interstage domains", () => {
    const state = seedP85IfIState();
    const { evidence } = applyPhase79LifecycleRedactionContract(state, "client-mert", "anonymization");
    expect(evidence.status).toBe("pass");
    expect(evidence.domainsCovered).toEqual(
      expect.arrayContaining(["human_control_sessions", "retrieval_source_evidence"]),
    );
  });

  it("revokes tenant channel bindings without placing them in client export", () => {
    const state = seedP85IfIState();
    const revoked = revokeTenantChannelBindingsInState(state, DEMO_TENANT_ID, "dietitian-ayse");
    expect(revoked.channelAccountBindings[0]?.lifecycleStatus).toBe("revoked");
    expect(revoked.channelActorBindings[0]?.revokedAt).not.toBeNull();
    expect(buildClientScopedExport(revoked, "client-mert").channelAccountBindings).toBeUndefined();
  });

  it("records program closure readiness with production pilot NO-GO and R-406 pending without local Supabase", () => {
    const closure = evaluateP85IfIProgramClosureEvidence({ localSupabaseAvailable: false });
    expect(closure.status).toBe("pass");
    expect(closure.productionPilotNoGo).toBe(true);
    expect(closure.r406PendingWithoutLocalSupabase).toBe(true);
    expect(closure.interstageTracksComplete).toContain("P85-IF-I");
  });
});
