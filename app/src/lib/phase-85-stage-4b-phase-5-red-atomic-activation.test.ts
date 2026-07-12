import { describe, expect, it } from "vitest";
import { AppDomainError } from "./app-errors";
import { createInitialState } from "./seed-data";
import {
  collectAiPreflightBlockers,
  resolveAiControlDisabledState,
} from "./ai-assistant-control-panel-helpers";
import { buildClientHumanControlBanner } from "./phase-85-if-h-operational-visibility";
import { projectClinicalAlertsFromState } from "./phase-85-stage-4b-alerts";
import { conversationRevisionOrDefault } from "./phase-85-if-f-conversation-revision";
import { DIRECT_DIETITIAN_REACTIVATION_REASON_CODE } from "./phase-85-if-f-risk-reactivation";
import {
  activateClientAiWithControlledRiskResolutionInState,
  runInboundSimulation,
  updateClientInState,
} from "./simulator";
import { addManualReplyInState } from "./app-state-store";
import type { ClientRecord } from "./types";

function buildRedLockedClient(partial: Partial<ClientRecord> = {}): ClientRecord {
  const base = createInitialState().clients.find((client) => client.id === "client-mert")!;
  return {
    ...base,
    aiStatus: "passive",
    aiMode: "manual",
    humanTakeoverLocked: true,
    redRiskLock: {
      status: "locked",
      handoffId: "handoff-red-1",
      lockedAt: "2026-07-10T10:00:00.000Z",
      reasons: ["red"],
      previousAiStatus: "active",
      previousAiMode: "copilot",
    },
    ...partial,
  };
}

describe("phase-85-stage-4b phase-5 red atomic activation", () => {
  it("keeps activation enabled while configuration stays disabled under red lock", () => {
    const client = buildRedLockedClient();
    const gates = resolveAiControlDisabledState(client);
    expect(gates.activationDisabled).toBe(false);
    expect(gates.configurationDisabled).toBe(true);
  });

  it("treats red lock as a warn preflight item instead of a hard activation blocker", () => {
    const client = buildRedLockedClient();
    const blockers = collectAiPreflightBlockers(createInitialState(), client);
    const redBlocker = blockers.find((blocker) => blocker.code === "red_risk_lock_active");
    expect(redBlocker?.severity).toBe("warn");
  });

  it("exposes atomic red activation on the human-control banner", async () => {
    const withHandoff = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Alerjiden nefes alamiyorum, bogazim sisti.",
      idempotencyKey: "p85-4b-phase-5-banner",
      now: "2026-07-10T10:00:00.000Z",
    });
    const banner = buildClientHumanControlBanner(withHandoff, "client-mert");
    expect(banner).toMatchObject({
      canActivateAi: true,
      requiresAtomicRedActivation: true,
    });
  });

  it("atomically closes red lock, handoff, and human-control session through activate-ai", async () => {
    const withHandoff = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Alerjiden nefes alamiyorum, bogazim sisti.",
      idempotencyKey: "p85-4b-phase-5-atomic",
      now: "2026-07-10T10:01:00.000Z",
    });
    const handoffId = withHandoff.handoffCases[0]?.id;
    const conversation = withHandoff.conversations.find((item) => item.clientId === "client-mert")!;
    const clientBefore = withHandoff.clients.find((item) => item.id === "client-mert")!;
    expect(withHandoff.clients.find((item) => item.id === "client-mert")?.redRiskLock.status).toBe("locked");
    expect(projectClinicalAlertsFromState(withHandoff, { now: "2026-07-10T10:01:00.000Z" }).length).toBeGreaterThan(0);

    const activated = activateClientAiWithControlledRiskResolutionInState(withHandoff, "client-mert", {
      requestedAiMode: "copilot",
      expectedConversationRevision: conversationRevisionOrDefault(conversation),
      expectedClientContextRevision: clientBefore.contextRevision,
      activationSource: "activate_ai_api",
    });

    const client = activated.clients.find((item) => item.id === "client-mert");
    expect(client?.aiStatus).toBe("active");
    expect(client?.redRiskLock.status).toBe("reactivated");
    expect(client?.redRiskLock.reactivationReason).toBe(DIRECT_DIETITIAN_REACTIVATION_REASON_CODE);
    expect(client?.humanTakeoverLocked).toBe(false);
    expect(activated.handoffCases.find((item) => item.id === handoffId)?.status).toBe("resolved");
    expect(
      activated.humanControlSessions.filter(
        (session) => session.clientId === "client-mert" && session.status === "active",
      ),
    ).toHaveLength(0);
    expect(projectClinicalAlertsFromState(activated, { now: "2026-07-10T10:02:00.000Z" })).toHaveLength(0);
  });

  it("does not clear red lock through manual replies", async () => {
    const withHandoff = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Alerjiden nefes alamiyorum, bogazim sisti.",
      idempotencyKey: "p85-4b-phase-5-manual",
      now: "2026-07-10T10:03:00.000Z",
    });
    const withManualReply = addManualReplyInState(withHandoff, "client-mert", "Ben devraldim.");
    expect(withManualReply.clients.find((item) => item.id === "client-mert")?.redRiskLock.status).toBe("locked");
  });

  it("rejects direct client patch aiStatus active", async () => {
    const withHandoff = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Alerjiden nefes alamiyorum, bogazim sisti.",
      idempotencyKey: "p85-4b-phase-5-patch-block",
      now: "2026-07-10T10:04:00.000Z",
    });

    expect(() =>
      updateClientInState(withHandoff, "client-mert", { aiStatus: "active", aiMode: "copilot" }),
    ).toThrowError(new AppDomainError(409, "direct_ai_activation_requires_activate_ai_endpoint"));
  });

  it("leaves state unchanged when expected revision CAS fails", async () => {
    const withHandoff = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Alerjiden nefes alamiyorum, bogazim sisti.",
      idempotencyKey: "p85-4b-phase-5-cas",
      now: "2026-07-10T10:05:00.000Z",
    });
    const conversation = withHandoff.conversations.find((item) => item.clientId === "client-mert")!;
    const client = withHandoff.clients.find((item) => item.id === "client-mert")!;

    expect(() =>
      activateClientAiWithControlledRiskResolutionInState(withHandoff, "client-mert", {
        expectedConversationRevision: conversationRevisionOrDefault(conversation) + 99,
        expectedClientContextRevision: client.contextRevision,
        activationSource: "activate_ai_api",
      }),
    ).toThrowError(new AppDomainError(409, "reactivation_conflict_conversation_revision"));

    expect(withHandoff.clients.find((item) => item.id === "client-mert")?.redRiskLock.status).toBe("locked");
    expect(withHandoff.clients.find((item) => item.id === "client-mert")?.aiStatus).toBe("passive");
  });
});
