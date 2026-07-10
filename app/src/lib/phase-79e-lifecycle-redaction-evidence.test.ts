import { describe, expect, it } from "vitest";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import { removeClientDataInState, saveFormResponseInState, simulateInState } from "./app-state-store";
import { createClientContextUpdateInState } from "./client-context-updates";
import { processMockChannelInbound } from "./channel-adapters";
import { runInternalCopilotInState, resolveVisibleClientByName } from "./internal-copilot";
import { createInitialState, DEMO_FORM_SCHEMA_ID } from "./seed-data";
import { PHASE_74_REDACTION_MARKER } from "./data-governance";
import {
  PHASE_79E_LIFECYCLE_REDACTION_DOMAINS,
  applyPhase79LifecycleRedactionContract,
  evaluatePhase79eLifecycleRedactionEvidence,
  evaluatePhase79eLifecycleRedactionEvidenceForHealth,
  lifecycleRedactionEvidenceIsAggregateOnly,
  verifyRemovedClientOperationalPathsBlocked,
} from "./phase-79e-lifecycle-redaction-evidence";
import { PHASE_85_IF_I_LIFECYCLE_REDACTION_DOMAINS } from "./phase-85-if-i-lifecycle-closure";
import { buildOperationalHealthSnapshot } from "./operational-health";
import {
  getClientFoodRuleProfileV2State,
  profileContainsUnredactedFoodRuleData,
  saveClientFoodRuleProfileV2InState,
} from "./phase-77e-client-food-rule-profile";

function profileBody(profile: NonNullable<ReturnType<typeof getClientFoodRuleProfileV2State>>) {
  const { conflicts, ...body } = profile;
  void conflicts;
  return body;
}

async function seedClientLifecycleState() {
  let state = saveFormResponseInState(createInitialState(), {
    clientId: "client-mert",
    schemaId: DEMO_FORM_SCHEMA_ID,
    submittedPhoneE164: "+905551110001",
    answers: {
      ...buildPhase70QualifiedClientAnswers(),
      primary_goal: "I eat breakfast at 8 with health details.",
    },
  });
  state = createClientContextUpdateInState(state, "client-mert", {
    title: "Follow-up call",
    summary: "Discussed meal timing with health details.",
    source: "phone",
    importance: "routine",
  });
  state = await simulateInState(state, {
    clientId: "client-mert",
    body: "Ara ogun icin ne yiyebilirim?",
    idempotencyKey: "phase79e-redaction",
  });
  state = await processMockChannelInbound(state, {
    channel: "whatsapp",
    providerEventId: "wa-phase79e-1",
    channelUserId: "+905551110001",
    body: "Bugun aksam yemeginde ne yiyebilirim?",
  });
  const profile = getClientFoodRuleProfileV2State(state, "client-mert");
  if (profile) {
    state = saveClientFoodRuleProfileV2InState(state, "client-mert", {
      revision: profile.revision,
      profile: {
        ...profileBody(profile),
        notes: "phase79e profile notes",
      },
    });
  }
  return state;
}

describe("phase 79e lifecycle redaction evidence", () => {
  it("applies unified lifecycle redaction contract with all domain coverage", async () => {
    const seeded = await seedClientLifecycleState();
    expect(seeded.channelDeliveries.some((delivery) => delivery.clientId === "client-mert")).toBe(true);

    const { state, evidence } = applyPhase79LifecycleRedactionContract(seeded, "client-mert", "deletion");

    expect(evidence.status).toBe("pass");
    expect(evidence.domainsCovered).toEqual([
      ...PHASE_79E_LIFECYCLE_REDACTION_DOMAINS,
      ...PHASE_85_IF_I_LIFECYCLE_REDACTION_DOMAINS,
    ]);
    expect(evidence.channelDeliveriesRemoved).toBe(true);
    expect(evidence.conversationMemoryCleared).toBe(true);
    expect(evidence.foodMenuProfileRedacted).toBe(true);
    expect(evidence.operationalPathsBlocked).toBe(true);
    expect(state.clients.find((client) => client.id === "client-mert")).toMatchObject({
      lifecycleStatus: "removed_anonymized",
      fullName: "Anonymized Client",
      channelPermission: "blocked",
    });
  });

  it("blocks removed client from simulator, channel replay identity, and copilot resolve paths", async () => {
    const seeded = await seedClientLifecycleState();
    const { state: removed } = applyPhase79LifecycleRedactionContract(seeded, "client-mert", "deletion");

    await expect(
      simulateInState(removed, {
        clientId: "client-mert",
        body: "Merhaba",
        idempotencyKey: "phase79e-removed-simulator",
      }),
    ).rejects.toThrowError(/client_removed_anonymized/);

    const copilot = runInternalCopilotInState(removed, "Mert son durumu ne?");
    const assistantBody = copilot.internalCopilotMessages.at(-1)?.body ?? "";
    expect(assistantBody).toContain("bulunamadi");
    expect(resolveVisibleClientByName(removed, "Mert").status).toBe("not_found");

    const channelReplay = await processMockChannelInbound(removed, {
      channel: "whatsapp",
      providerEventId: "wa-phase79e-removed",
      channelUserId: "+905551110001",
      body: "Merhaba",
    });
    expect(channelReplay.lastSimulation?.blockedReason).not.toBe("client_removed_anonymized");
    expect(verifyRemovedClientOperationalPathsBlocked(removed, "client-mert").blocked).toBe(true);
  });

  it("removes channel delivery records and clears conversation memory on redaction", async () => {
    const seeded = await seedClientLifecycleState();
    const conversation = seeded.conversations.find((item) => item.clientId === "client-mert");
    expect(seeded.channelDeliveries.some((delivery) => delivery.clientId === "client-mert")).toBe(true);

    const { state, evidence } = applyPhase79LifecycleRedactionContract(seeded, "client-mert", "deletion");
    const redactedConversation = state.conversations.find((item) => item.id === conversation?.id);

    expect(evidence.channelDeliveriesRemoved).toBe(true);
    expect(state.channelDeliveries.some((delivery) => delivery.clientId === "client-mert")).toBe(false);
    expect(evidence.conversationMemoryCleared).toBe(true);
    expect(redactedConversation?.rollingSummary.trim()).toBe("");
  });

  it("redacts food rule profile and message raw data", async () => {
    const seeded = await seedClientLifecycleState();
    const { state, evidence } = applyPhase79LifecycleRedactionContract(seeded, "client-mert", "deletion");
    const profile = state.clientFoodRuleProfiles.find((item) => item.clientId === "client-mert");

    expect(evidence.foodMenuProfileRedacted).toBe(true);
    expect(profile).toBeTruthy();
    expect(profileContainsUnredactedFoodRuleData(profile!)).toBe(false);
    expect(
      state.messages
        .filter((message) => message.conversationId === "conversation-client-mert")
        .every((message) => message.body === PHASE_74_REDACTION_MARKER),
    ).toBe(true);
  });

  it("keeps lifecycle evidence aggregate-only without raw health data in health payload", async () => {
    const seeded = await seedClientLifecycleState();
    const { evidence } = applyPhase79LifecycleRedactionContract(seeded, "client-mert", "deletion");

    expect(lifecycleRedactionEvidenceIsAggregateOnly(evidence)).toBe(true);
    expect(evidence.aggregateEvidenceOnly).toBe(true);
    expect(evidence.rawHealthDataInEvidence).toBe(false);
    expect(JSON.stringify(evidence)).not.toMatch(/health details|\+905551110001|Ara ogun/);

    const health = buildOperationalHealthSnapshot(seeded);
    expect(health.phase79LifecycleReady).toBe(true);
    expect(health.phase79LifecycleRedactionStatus).toBe("pass");
    expect(JSON.stringify(health)).not.toMatch(/health details|\+905551110001|Ara ogun/);
  });

  it("evaluates post-redaction evidence and routes removeClientDataInState through the contract", async () => {
    const seeded = await seedClientLifecycleState();
    const removed = removeClientDataInState(seeded, "client-mert");
    const evidence = evaluatePhase79eLifecycleRedactionEvidence(removed, "client-mert", "deletion");

    expect(evidence.status).toBe("pass");
    expect(evaluatePhase79eLifecycleRedactionEvidenceForHealth(seeded).status).toBe("pass");
  });
});
