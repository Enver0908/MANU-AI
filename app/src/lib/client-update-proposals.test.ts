import { describe, expect, it } from "vitest";
import { AppDomainError } from "./app-errors";
import {
  applyClientUpdateProposalInState,
  createClientUpdateProposalInState,
  rejectClientUpdateProposalInState,
} from "./client-update-proposals";
import { runInternalCopilotInState } from "./internal-copilot";
import { PHASE_77B_CHAT_MUTATION_DISABLED_ERROR } from "./phase-77b-chat-mutation-boundary";
import { createInitialState } from "./seed-data";
import type { ClientUpdateProposalRecord } from "./types";

function seedPendingProposal(state = createInitialState()): {
  state: ReturnType<typeof createInitialState>;
  proposal: ClientUpdateProposalRecord;
} {
  const proposal: ClientUpdateProposalRecord = {
    id: "proposal-historical-1",
    tenantId: state.tenant.id,
    clientId: "client-mert",
    dietitianId: state.dietitian.id,
    sourceText: "Mert artik badem yemesin.",
    proposedPatches: [
      {
        target: "client_form_answer",
        fieldId: "forbidden_substitutions",
        label: "Yasak alternatifler",
        operation: "append_unique",
        value: "badem",
        category: "nutrition",
        editable: true,
      },
    ],
    safetyFlags: [],
    status: "pending",
    expectedContextRevision: state.clients.find((client) => client.id === "client-mert")!.contextRevision,
    createdAt: "2026-06-08T09:00:00.000Z",
    resolvedAt: null,
  };

  return {
    state: {
      ...state,
      clientUpdateProposals: [...state.clientUpdateProposals, proposal],
    },
    proposal,
  };
}

describe("client update proposals (Phase 77B boundary)", () => {
  it("blocks chat proposal creation for manual source authorities", () => {
    expect(() =>
      createClientUpdateProposalInState(createInitialState(), "client-mert", {
        sourceText: "Mert artik badem yemesin.",
      }),
    ).toThrow(PHASE_77B_CHAT_MUTATION_DISABLED_ERROR);
  });

  it("blocks chat proposal apply for manual source authorities", () => {
    const { state, proposal } = seedPendingProposal();

    expect(() => applyClientUpdateProposalInState(state, "client-mert", proposal.id)).toThrow(
      PHASE_77B_CHAT_MUTATION_DISABLED_ERROR,
    );
  });

  it("still rejects historical pending proposals without mutating client context", () => {
    const { state, proposal } = seedPendingProposal();
    const beforeResponse = state.clientFormResponses.find((response) => response.clientId === "client-mert")!;
    const rejected = rejectClientUpdateProposalInState(state, "client-mert", proposal.id);

    expect(rejected.clientUpdateProposals.find((item) => item.id === proposal.id)?.status).toBe("rejected");
    expect(rejected.clientFormResponses.find((response) => response.id === beforeResponse.id)?.answers).toEqual(
      beforeResponse.answers,
    );
  });

  it("keeps internal copilot read-only after chat mutation removal", () => {
    const next = runInternalCopilotInState(createInitialState(), "Mert son durumu", "2026-06-08T09:00:00.000Z");

    expect(next.internalCopilotMessages).toHaveLength(2);
    expect(next.clientUpdateProposals).toHaveLength(0);
    expect(next.clientFormResponses).toEqual(createInitialState().clientFormResponses);
  });

  it("returns the expected domain error type for blocked chat mutation", () => {
    try {
      createClientUpdateProposalInState(createInitialState(), "client-mert", {
        sourceText: "Mert artik badem yemesin.",
      });
      throw new Error("expected_create_to_fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AppDomainError);
      expect((error as AppDomainError).status).toBe(409);
      expect((error as AppDomainError).message).toBe(PHASE_77B_CHAT_MUTATION_DISABLED_ERROR);
    }
  });
});
