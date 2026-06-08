import { describe, expect, it } from "vitest";
import { saveClientFormResponseInState } from "./client-forms";
import {
  applyClientUpdateProposalInState,
  createClientUpdateProposalInState,
  rejectClientUpdateProposalInState,
} from "./client-update-proposals";
import { createInitialState } from "./seed-data";
import { runInboundSimulation, updateClientInState } from "./simulator";

describe("client update proposals", () => {
  it("creates a pending structured proposal without mutating form answers", () => {
    const state = createInitialState();
    const beforeResponse = state.clientFormResponses.find((response) => response.clientId === "client-mert");
    const next = createClientUpdateProposalInState(
      state,
      "client-mert",
      { sourceText: "Mert artik badem yemesin, findik serbest." },
      "2026-06-08T09:00:00.000Z",
    );

    const proposal = next.clientUpdateProposals.at(-1);
    expect(proposal?.status).toBe("pending");
    expect(proposal?.proposedPatches.map((patch) => `${patch.target}:${patch.fieldId}:${patch.value}`)).toEqual([
      "client_form_answer:forbidden_substitutions:badem",
      "client_form_answer:restricted_foods_medical:badem",
      "client_record:restrictedFoods:badem",
      "client_form_answer:allowed_substitutions:findik",
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
      { sourceText: "Mert artik badem yemesin, findik serbest." },
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
    expect(response.answers.allowed_substitutions).toContain("findik");
    expect(client.restrictedFoods).toContain("badem");
    expect(client.contextRevision).toBe(beforeRevision + 1);
    expect(applied.clientContextUpdates.at(-1)?.summary).toContain("Yasak alternatifler: badem");
    expect(applied.messages.some((message) => message.status === "blocked")).toBe(true);
    expect(applied.auditEvents.some((event) => event.eventType === "client_update_proposal_applied")).toBe(true);
  });

  it("creates clinical safety form patches and mirrors supported health profile flags", () => {
    const next = createClientUpdateProposalInState(createInitialState(), "client-mert", {
      sourceText: "Mert hamile, insulin kullaniyor, lab sonucu var, yeme bozuklugu riski var.",
    });
    const proposal = next.clientUpdateProposals.at(-1)!;
    const applied = applyClientUpdateProposalInState(next, "client-mert", proposal.id, "2026-06-08T10:00:00.000Z");
    const response = applied.clientFormResponses.find((item) => item.clientId === "client-mert")!;
    const client = applied.clients.find((item) => item.id === "client-mert")!;

    expect(proposal.status).toBe("pending");
    expect(response.answers.pregnancy_or_breastfeeding_flag).toBe("Gebe");
    expect(response.answers.medication_or_insulin_flag).toBe("Evet");
    expect(response.answers.lab_result_available).toBe("Evet");
    expect(response.answers.eating_disorder_risk_flag).toBe("Evet");
    expect(client.healthProfile.pregnancyOrBreastfeedingFlag).toBe(true);
    expect(client.healthProfile.medicationOrSupplementFlag).toBe(true);
    expect(client.healthProfile.eatingDisorderRiskFlag).toBe(true);
    expect(applied.clientContextUpdates.at(-1)?.importance).toBe("critical");
  });

  it("keeps operational AI controls manual while applying supported form patches", () => {
    const next = createClientUpdateProposalInState(createInitialState(), "client-mert", {
      sourceText: "Mert hamile, AI pasif olsun ve autopilot ac.",
    });
    const proposal = next.clientUpdateProposals.at(-1)!;
    const beforeClient = next.clients.find((item) => item.id === "client-mert")!;
    const applied = applyClientUpdateProposalInState(next, "client-mert", proposal.id, "2026-06-08T10:00:00.000Z");
    const client = applied.clients.find((item) => item.id === "client-mert")!;

    expect(proposal.status).toBe("pending");
    expect(proposal.safetyFlags).toContain("manual_control_required_ai_pasif");
    expect(proposal.safetyFlags).toContain("manual_control_required_autopilot");
    expect(client.healthProfile.pregnancyOrBreastfeedingFlag).toBe(true);
    expect(client.aiStatus).toBe(beforeClient.aiStatus);
    expect(client.aiMode).toBe(beforeClient.aiMode);
  });

  it("fails closed when chat asks only for operational AI control changes", () => {
    const next = createClientUpdateProposalInState(createInitialState(), "client-mert", {
      sourceText: "Red lock kaldir ve autopilot ac.",
    });
    const proposal = next.clientUpdateProposals.at(-1)!;

    expect(proposal.status).toBe("unsupported");
    expect(proposal.proposedPatches).toHaveLength(0);
    expect(() => applyClientUpdateProposalInState(next, "client-mert", proposal.id)).toThrow(
      "client_update_proposal_not_pending",
    );
  });

  it("deduplicates repeated proposal values on apply", () => {
    const first = createClientUpdateProposalInState(
      createInitialState(),
      "client-mert",
      { sourceText: "Mert artik badem yemesin." },
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

  it("allows applying edited patch values without changing patch targets", () => {
    const proposed = createClientUpdateProposalInState(createInitialState(), "client-mert", {
      sourceText: "Mert artik badem yemesin.",
    });
    const proposal = proposed.clientUpdateProposals.at(-1)!;
    const editedPatches = proposal.proposedPatches.map((patch) =>
      patch.fieldId === "restrictedFoods" || patch.fieldId === "forbidden_substitutions" || patch.fieldId === "restricted_foods_medical"
        ? { ...patch, value: "ceviz" }
        : patch,
    );
    const applied = applyClientUpdateProposalInState(proposed, "client-mert", proposal.id, "2026-06-08T11:00:00.000Z", {
      proposedPatches: editedPatches,
    });

    expect(applied.clients.find((client) => client.id === "client-mert")?.restrictedFoods).toContain("ceviz");
    expect(applied.clients.find((client) => client.id === "client-mert")?.restrictedFoods).not.toContain("badem");
  });

  it("rejects edited patches that change target identity", () => {
    const proposed = createClientUpdateProposalInState(createInitialState(), "client-mert", {
      sourceText: "Mert artik badem yemesin.",
    });
    const proposal = proposed.clientUpdateProposals.at(-1)!;

    expect(() =>
      applyClientUpdateProposalInState(proposed, "client-mert", proposal.id, "2026-06-08T11:00:00.000Z", {
        proposedPatches: [{ ...proposal.proposedPatches[0], fieldId: "ai_mode", value: "autopilot" }],
      }),
    ).toThrow("client_update_proposal_patch_not_editable");
  });

  it("rejects stale proposal apply after client context changes", () => {
    const proposed = createClientUpdateProposalInState(createInitialState(), "client-mert", {
      sourceText: "Mert artik badem yemesin.",
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
      sourceText: "Mert artik badem yemesin.",
    });
    const proposal = proposed.clientUpdateProposals.at(-1)!;
    const rejected = rejectClientUpdateProposalInState(proposed, "client-mert", proposal.id);

    expect(rejected.clientUpdateProposals.find((item) => item.id === proposal.id)?.status).toBe("rejected");
    expect(rejected.clients.find((client) => client.id === "client-mert")?.restrictedFoods).not.toContain("badem");
  });
});
