import { describe, expect, it } from "vitest";

import { AppDomainError } from "./app-errors";
import { createInitialState } from "./seed-data";
import { runInboundSimulation, updateClientInState } from "./simulator";
import {
  applyContextIntakeProposalInState,
  confirmContextIntakeProposalInState,
  createContextIntakeProposalInState,
  detectContextIntakeStructuredImpact,
  digestContextIntakeSourceText,
  expireContextIntakeProposalsInState,
  recheckContextIntakeProposalInState,
  rejectContextIntakeProposalInState,
  resolveContextIntakeClient,
} from "./phase-85-if-g-context-intake";
import { runInternalCopilotInState } from "./internal-copilot";

describe("P85-IF-G context intake workflow", () => {
  it("requires explicit name and phone confirmation for a client-scoped intake", () => {
    const state = createInitialState();

    expect(() =>
      createContextIntakeProposalInState(
        state,
        { clientId: "client-mert" },
        { sourceText: "Telefon gorusmesinde ara ogun duzeni konusuldu.", intakeSource: "phone" },
      ),
    ).toThrowError(/context_intake_client_confirmation_mismatch/);
  });

  it("resolves exactly one visible client by normalized name and phone", () => {
    const state = createInitialState();
    expect(
      resolveContextIntakeClient(state, { fullName: "Mert Kaya", phoneE164: "+905551110001" }).status,
    ).toBe("resolved");
    expect(resolveContextIntakeClient(state, { fullName: "Mert Kaya", phoneE164: "+905559999999" }).status).toBe(
      "not_found",
    );
    expect(resolveContextIntakeClient(state, { fullName: "Unknown", phoneE164: "+905551110001" }).status).toBe(
      "not_found",
    );
  });

  it("fails closed for client-scoped confirmation mismatch", () => {
    const state = createInitialState();
    expect(() =>
      createContextIntakeProposalInState(
        state,
        { clientId: "client-mert", confirmFullName: "Wrong Name", confirmPhoneE164: "+905551110001" },
        { sourceText: "Telefonda kahvalti saatini 09:00 yaptik.", intakeSource: "phone" },
      ),
    ).toThrow(new AppDomainError(409, "context_intake_client_confirmation_mismatch"));
  });

  it("creates and applies a pure context-only proposal after confirmation", () => {
    const state = createInitialState();
    const withProposal = createContextIntakeProposalInState(
      state,
      { clientId: "client-mert", confirmFullName: "Mert Kaya", confirmPhoneE164: "+905551110001" },
      {
        sourceText: "Telefonda kahvalti saatini 09:00 yaptik.",
        intakeSource: "phone",
        title: "Kahvalti saati",
        summary: "Kahvalti 09:00",
      },
    );
    const proposal = withProposal.contextIntakeProposals.at(-1);
    expect(proposal?.status).toBe("pending_confirmation");
    expect(proposal?.structuredImpactFlags).toEqual([]);

    const confirmed = confirmContextIntakeProposalInState(withProposal, "client-mert", proposal!.id);
    const applied = applyContextIntakeProposalInState(confirmed, "client-mert", proposal!.id);
    const appliedProposal = applied.contextIntakeProposals.find((item) => item.id === proposal!.id);
    expect(appliedProposal?.status).toBe("applied");
    expect(applied.clientContextUpdates.some((update) => update.title === "Kahvalti saati")).toBe(true);
    expect(applied.clients.find((client) => client.id === "client-mert")?.contextRevision).toBe(2);
  });

  it("blocks structured-impact proposals until dashboard revision evidence and second confirmation", () => {
    const state = createInitialState();
    const withProposal = createContextIntakeProposalInState(
      state,
      { clientId: "client-mert", confirmFullName: "Mert Kaya", confirmPhoneE164: "+905551110001" },
      {
        sourceText: "Zoom gorusmesinde form alanlarini guncellememiz gerekiyor.",
        intakeSource: "zoom",
      },
    );
    const proposal = withProposal.contextIntakeProposals.at(-1)!;
    expect(proposal.status).toBe("blocked_structured_impact");
    expect(detectContextIntakeStructuredImpact(proposal.sourceText || "")).toContain("form");

    const acknowledged = confirmContextIntakeProposalInState(withProposal, "client-mert", proposal.id);
    expect(() => recheckContextIntakeProposalInState(acknowledged, "client-mert", proposal.id)).toThrow(
      new AppDomainError(409, "context_intake_structured_revision_pending"),
    );

    const revised = {
      ...acknowledged,
      clientFormResponses: acknowledged.clientFormResponses.map((response) =>
        response.clientId === "client-mert"
          ? { ...response, schemaVersion: response.schemaVersion + 1, updatedAt: new Date().toISOString() }
          : response,
      ),
    };

    const rechecked = recheckContextIntakeProposalInState(revised, "client-mert", proposal.id);
    expect(() => applyContextIntakeProposalInState(rechecked, "client-mert", proposal.id)).toThrow(
      new AppDomainError(409, "context_intake_second_confirmation_required"),
    );

    const twiceConfirmed = confirmContextIntakeProposalInState(rechecked, "client-mert", proposal.id);
    const applied = applyContextIntakeProposalInState(twiceConfirmed, "client-mert", proposal.id);
    expect(applied.contextIntakeProposals.find((item) => item.id === proposal.id)?.status).toBe("applied");
    expect(applied.clientContextUpdates.length).toBeGreaterThan(0);
  });

  it("rejects duplicate replay for the same source digest", () => {
    const state = createInitialState();
    const sourceText = "Telefonda su tuketimini artirdi.";
    const first = createContextIntakeProposalInState(
      state,
      { clientId: "client-elif", confirmFullName: "Elif Demir", confirmPhoneE164: "+905551110002" },
      { sourceText, intakeSource: "phone" },
    );
    expect(digestContextIntakeSourceText(sourceText)).toHaveLength(8);
    expect(() =>
      createContextIntakeProposalInState(
        first,
        { clientId: "client-elif", confirmFullName: "Elif Demir", confirmPhoneE164: "+905551110002" },
        { sourceText, intakeSource: "phone" },
      ),
    ).toThrow(new AppDomainError(409, "context_intake_duplicate_proposal"));
  });

  it("invalidates pending drafts when a context intake proposal is applied", async () => {
    const copilotState = updateClientInState(createInitialState(), "client-mert", { aiMode: "copilot" });
    const withDraft = await runInboundSimulation(copilotState, {
      clientId: "client-mert",
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: "context-intake-draft-invalidation",
      now: "2026-05-22T10:24:40.000Z",
    });
    const draft = withDraft.messages.find((message) => message.status === "draft");
    expect(draft).toBeTruthy();

    const withProposal = createContextIntakeProposalInState(
      withDraft,
      { clientId: "client-mert", confirmFullName: "Mert Kaya", confirmPhoneE164: "+905551110001" },
      { sourceText: "Yuz yuze gorusmede ara ogun saatini netlestirdik.", intakeSource: "in_person" },
    );
    const proposal = withProposal.contextIntakeProposals.at(-1)!;
    const confirmed = confirmContextIntakeProposalInState(withProposal, "client-mert", proposal.id);
    const applied = applyContextIntakeProposalInState(confirmed, "client-mert", proposal.id);
    const blockedDraft = applied.messages.find((message) => message.id === draft?.id);
    expect(blockedDraft?.status).toBe("blocked");
  });

  it("keeps general internal copilot read-only", () => {
    const state = createInitialState();
    const next = runInternalCopilotInState(state, "Mert Kaya son durumu");
    expect(next.contextIntakeProposals).toHaveLength(0);
    expect(next.internalCopilotMessages.length).toBeGreaterThan(0);
  });

  it("expires stale pending proposals by ttl", () => {
    const state = createInitialState();
    const withProposal = createContextIntakeProposalInState(
      state,
      { clientId: "client-mert", confirmFullName: "Mert Kaya", confirmPhoneE164: "+905551110001" },
      { sourceText: "Telefonda not.", intakeSource: "phone" },
      "2020-01-01T00:00:00.000Z",
    );
    const proposal = withProposal.contextIntakeProposals.at(-1)!;
    const expired = expireContextIntakeProposalsInState(withProposal, "2020-01-10T00:00:00.000Z");
    expect(expired.contextIntakeProposals.find((item) => item.id === proposal.id)?.status).toBe("expired");
    expect(() => confirmContextIntakeProposalInState(expired, "client-mert", proposal.id)).toThrow(
      new AppDomainError(409, "context_intake_proposal_expired"),
    );
  });

  it("allows explicit rejection without apply", () => {
    const state = createInitialState();
    const withProposal = createContextIntakeProposalInState(
      state,
      { fullName: "Elif Demir", phoneE164: "+905551110002" },
      { sourceText: "Telefonda not.", intakeSource: "phone" },
    );
    const proposal = withProposal.contextIntakeProposals.at(-1)!;
    const rejected = rejectContextIntakeProposalInState(withProposal, proposal.clientId, proposal.id);
    expect(rejected.contextIntakeProposals.find((item) => item.id === proposal.id)?.status).toBe("rejected");
  });
});
