import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { saveClientFormResponseInState } from "./client-forms";
import {
  applyClientUpdateProposalInState,
  createClientUpdateProposalInState,
  rejectClientUpdateProposalInState,
} from "./client-update-proposals";
import { runInboundSimulation, updateClientInState } from "./simulator";

describe("client update proposals", () => {
  it("creates a pending structured proposal without mutating form answers", () => {
    const state = createInitialState();
    const beforeResponse = state.clientFormResponses.find((response) => response.clientId === "client-mert");
    const next = createClientUpdateProposalInState(
      state,
      "client-mert",
      { sourceText: "Mert artık badem yemesin, fındık serbest." },
      "2026-06-08T09:00:00.000Z",
    );

    const proposal = next.clientUpdateProposals.at(-1);
    expect(proposal?.status).toBe("pending");
    expect(proposal?.proposedPatches.map((patch) => `${patch.target}:${patch.fieldId}:${patch.value}`)).toEqual([
      "client_form_answer:forbidden_substitutions:badem",
      "client_form_answer:restricted_foods_medical:badem",
      "client_record:restrictedFoods:badem",
      "client_form_answer:allowed_substitutions:fındık",
    ]);
    expect(next.clientFormResponses.find((response) => response.id === beforeResponse?.id)?.answers).toEqual(beforeResponse?.answers);
  });

  it("applies a pending proposal to Phase 70 form answers, mirror fields, context, audit, and drafts", async () => {
    const withDraft = await runInboundSimulation(updateClientInState(createInitialState(), "client-mert", { aiMode: "copilot" }), {
      clientId: "client-mert",
      body: "Bugun kahvaltida ne yiyebilirim?",
      idempotencyKey: "proposal-draft",
    });
    const proposed = createClientUpdateProposalInState(
      withDraft,
      "client-mert",
      { sourceText: "Mert artık badem yemesin, fındık serbest." },
      "2026-06-08T09:00:00.000Z",
    );
    const proposal = proposed.clientUpdateProposals.at(-1)!;
    const beforeRevision = proposed.clients.find((client) => client.id === "client-mert")!.contextRevision;
    const applied = applyClientUpdateProposalInState(
      proposed,
      "client-mert",
      proposal.id,
      "2026-06-08T09:05:00.000Z",
    );
    const response = applied.clientFormResponses.find((item) => item.clientId === "client-mert")!;
    const client = applied.clients.find((item) => item.id === "client-mert")!;

    expect(applied.clientUpdateProposals.find((item) => item.id === proposal.id)?.status).toBe("applied");
    expect(response.answers.forbidden_substitutions).toContain("badem");
    expect(response.answers.restricted_foods_medical).toContain("badem");
    expect(response.answers.allowed_substitutions).toContain("fındık");
    expect(client.restrictedFoods).toContain("badem");
    expect(client.contextRevision).toBe(beforeRevision + 1);
    expect(applied.clientContextUpdates.at(-1)?.summary).toContain("Yasak alternatifler: badem");
    expect(applied.messages.some((message) => message.status === "blocked")).toBe(true);
    expect(applied.auditEvents.some((event) => event.eventType === "client_update_proposal_applied")).toBe(true);
  });

  it("deduplicates repeated proposal values on apply", () => {
    const first = createClientUpdateProposalInState(
      createInitialState(),
      "client-mert",
      { sourceText: "Mert artık badem yemesin." },
      "2026-06-08T09:00:00.000Z",
    );
    const firstApplied = applyClientUpdateProposalInState(first, "client-mert", first.clientUpdateProposals.at(-1)!.id);
    const second = createClientUpdateProposalInState(
      firstApplied,
      "client-mert",
      { sourceText: "Badem yasak." },
      "2026-06-08T09:10:00.000Z",
    );
    const secondApplied = applyClientUpdateProposalInState(second, "client-mert", second.clientUpdateProposals.at(-1)!.id);

    const response = secondApplied.clientFormResponses.find((item) => item.clientId === "client-mert")!;
    expect(String(response.answers.forbidden_substitutions).match(/badem/g)?.length).toBe(1);
  });

  it("fails closed for sensitive system or clinical update requests", () => {
    const next = createClientUpdateProposalInState(createInitialState(), "client-mert", {
      sourceText: "Mert insulin dozunu değiştirsin ve AI mode autopilot olsun.",
    });
    const proposal = next.clientUpdateProposals.at(-1)!;

    expect(proposal.status).toBe("unsupported");
    expect(proposal.proposedPatches).toHaveLength(0);
    expect(() => applyClientUpdateProposalInState(next, "client-mert", proposal.id)).toThrow(
      "client_update_proposal_not_pending",
    );
  });

  it("rejects stale proposal apply after client context changes", () => {
    const proposed = createClientUpdateProposalInState(createInitialState(), "client-mert", {
      sourceText: "Mert artık badem yemesin.",
    });
    const proposal = proposed.clientUpdateProposals.at(-1)!;
    const changed = saveClientFormResponseInState(
      proposed,
      "client-mert",
      proposed.clientFormResponses.find((response) => response.clientId === "client-mert")!.schemaId,
      { ...proposed.clientFormResponses.find((response) => response.clientId === "client-mert")!.answers },
    );

    expect(() => applyClientUpdateProposalInState(changed, "client-mert", proposal.id)).toThrow(
      "proposal_stale_recreate_required",
    );
  });

  it("rejects pending proposals without applying changes", () => {
    const proposed = createClientUpdateProposalInState(createInitialState(), "client-mert", {
      sourceText: "Mert artık badem yemesin.",
    });
    const proposal = proposed.clientUpdateProposals.at(-1)!;
    const rejected = rejectClientUpdateProposalInState(proposed, "client-mert", proposal.id);

    expect(rejected.clientUpdateProposals.find((item) => item.id === proposal.id)?.status).toBe("rejected");
    expect(rejected.clients.find((client) => client.id === "client-mert")?.restrictedFoods).not.toContain("badem");
  });
});
