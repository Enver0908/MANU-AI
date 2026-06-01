import { describe, expect, it } from "vitest";
import {
  addManualReplyInState,
  approveDraftInState,
  createClientInState,
  dismissDraftInState,
  anonymizeClientDataInState,
  exportClientInState,
  patchClientInState,
  recordClientExportRequestInState,
  releaseHumanTakeoverInState,
  removeClientDataInState,
  resolveAndReactivateRedRiskInState,
  saveFormResponseInState,
  simulateInState,
  updateHandoffStatusInState,
} from "./app-state-store";
import { RETENTION_POLICY_PLACEHOLDERS } from "./data-governance";
import { createInitialState, DEMO_FORM_SCHEMA_ID } from "./seed-data";

describe("app state store operations", () => {
  it("creates a client with a conversation", () => {
    const next = createClientInState(createInitialState(), {
      fullName: "Ada Soylu",
      channel: "telegram",
      channelUserId: "ada_tg",
      primaryPhoneE164: "+905551110099",
      communicationLanguage: "en",
    });

    const client = next.clients.find((item) => item.fullName === "Ada Soylu");
    expect(client?.channel).toBe("telegram");
    expect(client?.primaryPhoneE164).toBe("+905551110099");
    expect(client?.communicationLanguage).toBe("en");
    expect(next.conversations.some((conversation) => conversation.clientId === client?.id)).toBe(true);
  });

  it("rejects duplicate client phone identities", () => {
    const state = createInitialState();

    expect(() =>
      createClientInState(state, {
        fullName: "Duplicate Phone",
        channel: "whatsapp",
        channelUserId: "duplicate",
        primaryPhoneE164: "+905551110001",
        communicationLanguage: "tr",
      }),
    ).toThrowError(/primary_phone_e164_duplicate/);
  });

  it("adds manual replies with dietitian provenance", () => {
    const next = addManualReplyInState(createInitialState(), "client-mert", "Tamam, bunu not aldım.");
    const manual = next.messages.find((message) => message.origin === "dietitian_manual");

    expect(manual?.authorDietitianId).toBe(next.dietitian.id);
    expect(manual?.status).toBe("sent");
  });

  it("keeps duplicate simulator events from creating extra records", async () => {
    const first = await simulateInState(createInitialState(), {
      clientId: "client-mert",
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: "store-duplicate",
    });
    const second = await simulateInState(first, {
      clientId: "client-mert",
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: "store-duplicate",
    });

    expect(second.lastSimulation?.action).toBe("duplicate_ignored");
    expect(second.messages).toHaveLength(first.messages.length);
    expect(second.aiDecisions).toHaveLength(first.aiDecisions.length);
    expect(second.riskAssessments).toHaveLength(first.riskAssessments.length);
  });

  it("resolves only open handoffs", async () => {
    const withHandoff = await simulateInState(createInitialState(), {
      clientId: "client-mert",
      body: "Gecen hafta konustugumuz o yemegi tekrar yapayim mi?",
      idempotencyKey: "store-red",
      mockProviderOutput: "missing_historical_context",
    });
    const handoffId = withHandoff.handoffCases[0].id;
    const resolved = updateHandoffStatusInState(withHandoff, handoffId, "resolved");

    expect(resolved.handoffCases[0].status).toBe("resolved");
  });

  it("creates an explicit red risk reactivation lock on red handoff", async () => {
    const withHandoff = await simulateInState(createInitialState(), {
      clientId: "client-mert",
      body: "Alerjiden nefes alamiyorum, bogazim sisti.",
      idempotencyKey: "store-red-lock",
    });
    const client = withHandoff.clients.find((item) => item.id === "client-mert");
    const handoff = withHandoff.handoffCases[0];

    expect(client?.aiStatus).toBe("passive");
    expect(client?.aiMode).toBe("manual");
    expect(client?.humanTakeoverLocked).toBe(true);
    expect(client?.redRiskLock).toMatchObject({ status: "locked", handoffId: handoff.id });
    expect(withHandoff.auditEvents.some((event) => event.eventType === "red_risk_lock_created")).toBe(true);
  });

  it("does not clear a red risk lock through manual replies or normal handoff resolution", async () => {
    const withHandoff = await simulateInState(createInitialState(), {
      clientId: "client-mert",
      body: "Alerjiden nefes alamiyorum, bogazim sisti.",
      idempotencyKey: "store-red-manual-does-not-unlock",
    });
    const handoffId = withHandoff.handoffCases[0].id;
    const withManualReply = addManualReplyInState(withHandoff, "client-mert", "Ben devraldim, kontrol ediyorum.");
    const client = withManualReply.clients.find((item) => item.id === "client-mert");

    expect(client?.redRiskLock.status).toBe("locked");
    expect(client?.aiStatus).toBe("passive");
    expect(client?.humanTakeoverLocked).toBe(true);
    expect(() => updateHandoffStatusInState(withManualReply, handoffId, "resolved")).toThrowError(
      /red_risk_reactivation_required/,
    );
  });

  it("blocks direct AI reactivation, takeover release, and dismissal while red risk lock is active", async () => {
    const withHandoff = await simulateInState(createInitialState(), {
      clientId: "client-mert",
      body: "Alerjiden nefes alamiyorum, bogazim sisti.",
      idempotencyKey: "store-red-blockers",
    });
    const handoffId = withHandoff.handoffCases[0].id;

    expect(() => patchClientInState(withHandoff, "client-mert", { aiStatus: "active" })).toThrowError(
      /red_risk_reactivation_required/,
    );
    expect(() => releaseHumanTakeoverInState(withHandoff, "client-mert")).toThrowError(
      /red_risk_reactivation_required/,
    );
    expect(() => updateHandoffStatusInState(withHandoff, handoffId, "dismissed")).toThrowError(
      /red_risk_handoff_cannot_be_dismissed/,
    );
  });

  it("reactivates red risk locks only through explicit dietitian resolution", async () => {
    const withHandoff = await simulateInState(createInitialState(), {
      clientId: "client-mert",
      body: "Alerjiden nefes alamiyorum, bogazim sisti.",
      idempotencyKey: "store-red-reactivate",
    });
    const handoffId = withHandoff.handoffCases[0].id;
    const reactivated = resolveAndReactivateRedRiskInState(withHandoff, handoffId, {
      reactivationReason: "Dietitian reviewed the red handoff and confirmed safe follow-up.",
      aiMode: "copilot",
    });
    const client = reactivated.clients.find((item) => item.id === "client-mert");

    expect(reactivated.handoffCases[0].status).toBe("resolved");
    expect(client?.aiStatus).toBe("active");
    expect(client?.aiMode).toBe("copilot");
    expect(client?.humanTakeoverLocked).toBe(false);
    expect(client?.redRiskLock).toMatchObject({
      status: "reactivated",
      handoffId,
      reactivatedAiMode: "copilot",
    });
    expect(
      reactivated.auditEvents.some((event) => event.eventType === "red_risk_resolved_and_reactivated"),
    ).toBe(true);
  });

  it("requires a complete safety profile before red risk autopilot reactivation", async () => {
    const withHandoff = await simulateInState(createInitialState(), {
      clientId: "client-mert",
      body: "Alerjiden nefes alamiyorum, bogazim sisti.",
      idempotencyKey: "store-red-autopilot-block",
    });
    const handoffId = withHandoff.handoffCases[0].id;
    const incompleteSafety = {
      ...withHandoff,
      clients: withHandoff.clients.map((client) =>
        client.id === "client-mert"
          ? { ...client, mandatorySafetyComplete: false, safetyChecklist: { ...client.safetyChecklist, allergiesReviewed: false } }
          : client,
      ),
    };

    expect(() =>
      resolveAndReactivateRedRiskInState(incompleteSafety, handoffId, {
        reactivationReason: "Reviewed.",
        aiMode: "autopilot",
      }),
    ).toThrowError(/autopilot_reactivation_requires_completed_safety_profile/);
  });

  it("approves AI drafts with dietitian approval provenance", async () => {
    const withDraft = await simulateInState(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "store-draft-approve",
    });
    const draft = withDraft.messages.find((message) => message.status === "draft");
    const approved = approveDraftInState(withDraft, draft?.id || "");
    const message = approved.messages.find((item) => item.id === draft?.id);

    expect(message?.status).toBe("sent");
    expect(message?.approvedByDietitianId).toBe(approved.dietitian.id);
    expect(approved.auditEvents.some((event) => event.eventType === "draft_approved")).toBe(true);
  });

  it("edits and dismisses AI drafts without losing AI provenance", async () => {
    const withDraft = await simulateInState(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "store-draft-edit",
    });
    const draft = withDraft.messages.find((message) => message.status === "draft");
    const edited = approveDraftInState(withDraft, draft?.id || "", "Bunu birlikte kontrol edip netlestirelim.");
    const editedMessage = edited.messages.find((item) => item.id === draft?.id);

    expect(editedMessage?.body).toBe("Bunu birlikte kontrol edip netlestirelim.");
    expect(editedMessage?.origin).toBe("ai_generated");
    expect(editedMessage?.status).toBe("sent");

    const withSecondDraft = await simulateInState(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "store-draft-dismiss",
    });
    const secondDraft = withSecondDraft.messages.find((message) => message.status === "draft");
    const dismissed = dismissDraftInState(withSecondDraft, secondDraft?.id || "");
    const dismissedMessage = dismissed.messages.find((item) => item.id === secondDraft?.id);

    expect(dismissedMessage?.status).toBe("blocked");
    expect(dismissedMessage?.origin).toBe("ai_generated");
  });

  it("releases human takeover locks with an audit event", () => {
    const state = createInitialState();
    const locked = {
      ...state,
      clients: state.clients.map((client) =>
        client.id === "client-mert" ? { ...client, humanTakeoverLocked: true } : client,
      ),
    };

    const released = releaseHumanTakeoverInState(locked, "client-mert");
    const client = released.clients.find((item) => item.id === "client-mert");

    expect(client?.humanTakeoverLocked).toBe(false);
    expect(released.auditEvents.some((event) => event.eventType === "human_takeover_released")).toBe(true);
  });

  it("keeps client exports scoped to one tenant/client", async () => {
    const state = await simulateInState(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "export-scope",
    });

    const bundle = exportClientInState(state, "client-elif");
    const conversationIds = new Set(bundle.conversations.map((conversation) => conversation.id));

    expect(bundle.clientId).toBe("client-elif");
    expect(bundle.client.fullName).toBe("Elif Demir");
    expect(bundle.messages.every((message) => conversationIds.has(message.conversationId))).toBe(true);
    expect(bundle.messages.some((message) => message.conversationId === "conversation-client-mert")).toBe(false);
    expect(bundle.aiDecisions.every((decision) => decision.clientId === "client-elif")).toBe(true);
  });

  it("records client export requests in the legal operations ledger", async () => {
    const state = await simulateInState(createInitialState(), {
      clientId: "client-elif",
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: "export-ledger",
    });
    const next = recordClientExportRequestInState(state, "client-elif");
    const bundle = exportClientInState(next, "client-elif");

    expect(next.dataRequests).toHaveLength(1);
    expect(next.dataRequests[0]).toMatchObject({
      clientId: "client-elif",
      requestType: "export",
      status: "completed",
      requestedByDietitianId: next.dietitian.id,
    });
    expect(bundle.dataRequests).toEqual(next.dataRequests);
    expect(next.auditEvents.some((event) => event.eventType === "client_data_exported")).toBe(true);
  });

  it("anonymizes client data and invalidates promptable memory", async () => {
    const state = await simulateInState(createInitialState(), {
      clientId: "client-mert",
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: "anonymize-client",
    });

    const next = anonymizeClientDataInState(state, "client-mert");
    const client = next.clients.find((item) => item.id === "client-mert");
    const conversation = next.conversations.find((item) => item.clientId === "client-mert");
    const promptableMessages = next.messages.filter((message) => message.conversationId === conversation?.id);

    expect(client?.fullName).toBe("Anonymized Client");
    expect(client?.lifecycleStatus).toBe("active");
    expect(client?.channelUserId).toBe("");
    expect(client?.channelPermission).toBe("blocked");
    expect(client?.aiStatus).toBe("passive");
    expect(conversation?.rollingSummary).toBe("");
    expect(promptableMessages.every((message) => message.body === "[client data anonymized]")).toBe(true);
    expect(next.auditEvents.some((event) => event.eventType === "client_data_anonymized")).toBe(true);
    expect(next.dataRequests).toHaveLength(1);
    expect(next.dataRequests[0]).toMatchObject({
      clientId: "client-mert",
      requestType: "anonymization",
      status: "completed",
    });
  });

  it("removes clients through a soft-delete anonymization lifecycle", async () => {
    const withFormResponse = saveFormResponseInState(createInitialState(), {
      clientId: "client-mert",
      schemaId: DEMO_FORM_SCHEMA_ID,
      submittedPhoneE164: "+905551110001",
      answers: {
        daily_routine: "I eat breakfast at 8 with health details.",
        private_note: "Sensitive private note.",
      },
    });
    const withMessage = await simulateInState(withFormResponse, {
      clientId: "client-mert",
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: "remove-client",
    });

    const removed = removeClientDataInState(withMessage, "client-mert");
    const client = removed.clients.find((item) => item.id === "client-mert");
    const conversation = removed.conversations.find((item) => item.clientId === "client-mert");
    const bundle = exportClientInState(removed, "client-mert");

    expect(client).toMatchObject({
      lifecycleStatus: "removed_anonymized",
      fullName: "Anonymized Client",
      primaryPhoneE164: null,
      channelUserId: "",
      channelPermission: "blocked",
      aiStatus: "passive",
      aiMode: "manual",
    });
    expect(client?.removedAt).toEqual(expect.any(String));
    expect(conversation?.rollingSummary).toBe("");
    expect(removed.messages.filter((message) => message.conversationId === conversation?.id)).toEqual(
      expect.arrayContaining([expect.objectContaining({ body: "[client data anonymized]" })]),
    );
    expect(removed.clientFormResponses[0]).toMatchObject({
      submittedPhoneE164: null,
      answers: { redacted: "[client data anonymized]" },
    });
    expect(bundle.clientFormResponses[0].answers).toEqual({ redacted: "[client data anonymized]" });
    expect(removed.dataRequests.at(-1)).toMatchObject({
      clientId: "client-mert",
      requestType: "deletion",
      status: "completed",
    });
    expect(removed.auditEvents.some((event) => event.eventType === "client_removed_anonymized")).toBe(true);
    await expect(
      simulateInState(removed, {
        clientId: "client-mert",
        body: "Merhaba",
        idempotencyKey: "removed-client-inbound",
      }),
    ).rejects.toThrowError(/client_removed_anonymized/);
  });

  it("keeps retention durations behind legal review placeholders", () => {
    expect(RETENTION_POLICY_PLACEHOLDERS.length).toBeGreaterThan(0);
    expect(
      RETENTION_POLICY_PLACEHOLDERS.every((policy) => policy.retentionDecision === "legal_review_required"),
    ).toBe(true);
  });
});
