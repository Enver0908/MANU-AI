import { describe, expect, it } from "vitest";
import {
  buildClaimManifestV1,
  detectClaimManifestOutputViolations,
  guardProviderOutput,
  renderDeterministicTemplate,
} from "dietitian-ai-assistant-architecture";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import { publishClientFormSchemaInState, saveClientFormResponseInState } from "./client-forms";
import { createInitialState } from "./seed-data";
import { runInboundSimulation } from "./simulator";

function seedPublishedFormResponse(state = createInitialState()) {
  const schema = state.clientFormSchemas[0];
  const published = publishClientFormSchemaInState(state, schema.id);
  return saveClientFormResponseInState(published, "client-mert", schema.id, buildPhase70QualifiedClientAnswers());
}

describe("phase 77Q claim manifest and output grounding v1", () => {
  it("records complete claimManifest on successful provider path", async () => {
    const state = await runInboundSimulation(createInitialState(), {
      clientId: "client-mert",
      body: "Bugun kahvaltida yumurta yerine ne yiyebilirim?",
      idempotencyKey: "phase-77q-manifest-1",
      now: "2026-06-13T13:00:00.000Z",
    });

    const manifest = state.aiDecisions.at(-1)?.contextManifest?.claimManifest as {
      version?: string;
      claims?: Array<{ type?: string; authority?: string }>;
      complete?: boolean;
    };

    expect(state.lastSimulation?.action).toBe("sent");
    expect(manifest?.version).toBe("claim-manifest-v1-v0.1.0");
    expect(manifest?.claims?.length).toBeGreaterThan(0);
    expect(manifest?.claims?.some((claim) => claim.authority === "template_library_v1")).toBe(true);
  });

  it("blocks manifest-outside food approval for ingredient label plans", () => {
    const manifest = buildClaimManifestV1({
      responsePlan: {
        templateId: "ingredient_label_request_v1",
        intentFamily: "green_product_ingredient_check",
        sourceRefs: [{ id: "food-profile-1", category: "food_profile_v2" }],
        foodDecision: { engine: "food_decision_v2", decision: "needs_label" },
      },
    });

    const violations = detectClaimManifestOutputViolations("Evet cikolata yiyebilirsin.", { claimManifest: manifest });
    expect(violations).toContain("claim_outside_manifest");
  });

  it("allows deterministic template output that matches manifest claims", () => {
    const manifest = buildClaimManifestV1({
      responsePlan: {
        templateId: "allowed_substitution_v1",
        intentFamily: "green_allowed_substitution",
        sourceRefs: [{ id: "plan-1", category: "active_diet_plan" }],
        foodDecision: null,
      },
    });
    const output = renderDeterministicTemplate({
      templateId: "allowed_substitution_v1",
      language: "tr",
      replyMode: "send",
      riskClass: "green",
    });

    const result = guardProviderOutput({
      output,
      capsule: { client: { fullName: "Mert" }, persona: { behavior: {} }, voiceProfile: {} },
      riskDecision: { level: "green" },
      claimManifest: manifest,
    });

    expect(result.allowed).toBe(true);
  });

  it("attaches complete manifest for needs_label handoff path", async () => {
    const state = await runInboundSimulation(seedPublishedFormResponse(), {
      clientId: "client-mert",
      body: "Bir tane cikolata yiyebilir miyim?",
      idempotencyKey: "phase-77q-label-manifest-1",
      now: "2026-06-13T13:01:00.000Z",
    });

    const manifest = state.aiDecisions.at(-1)?.contextManifest?.claimManifest as {
      claims?: Array<{ type?: string }>;
    };

    expect(state.lastSimulation?.action).toBe("handoff");
    expect(manifest?.claims?.some((claim) => claim.type === "ingredient_label_request")).toBe(true);
  });
});
