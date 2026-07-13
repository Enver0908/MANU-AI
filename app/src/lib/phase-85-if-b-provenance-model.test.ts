import { describe, expect, it } from "vitest";

import {
  CHANNEL_ACTOR_ATTRIBUTION_BASES,
  CHANNEL_ACTOR_TYPES,
  CHANNEL_AUTHOR_INTERFACES,
  CHANNEL_EVENT_KINDS,
  CHANNEL_EVENT_PROCESSING_STATUSES,
  PHASE_85_IF_B_PROVENANCE_MODEL_VERSION,
  isVerifiedBusinessHumanMessage,
  resolveLegacyRetrievalEligibility,
} from "./phase-85-if-b-provenance-model";

describe("P85-IF-B provenance model contract", () => {
  it("exports the canonical trust-root vocabulary", () => {
    expect(PHASE_85_IF_B_PROVENANCE_MODEL_VERSION).toBe("p85-if-b-trust-root-provenance-v1");
    expect(CHANNEL_ACTOR_TYPES).toContain("business_operator");
    expect(CHANNEL_ACTOR_TYPES).toContain("exact_dietitian");
    expect(CHANNEL_ACTOR_ATTRIBUTION_BASES).toContain("shared_authorized_team");
    expect(CHANNEL_AUTHOR_INTERFACES).toContain("whatsapp_business_surface");
    expect(CHANNEL_EVENT_KINDS).toContain("business_human_echo_text");
    expect(CHANNEL_EVENT_KINDS).toContain("client_message_image");
    expect(CHANNEL_EVENT_KINDS).toContain("message_revision_unknown_target");
    expect(CHANNEL_EVENT_PROCESSING_STATUSES).toContain("quarantined");
    expect(CHANNEL_EVENT_PROCESSING_STATUSES).toContain("replayed");
  });

  it("allows verified shared business-human messages without fabricating an exact dietitian", () => {
    expect(
      isVerifiedBusinessHumanMessage({
        origin: "dietitian_manual",
        actorType: "business_operator",
        actorResolutionBasis: "shared_authorized_team",
      }),
    ).toBe(true);

    expect(
      isVerifiedBusinessHumanMessage({
        origin: "dietitian_manual",
        actorType: "exact_dietitian",
        actorResolutionBasis: "authenticated_manu_action",
      }),
    ).toBe(false);
  });

  it("keeps legacy and unsafe messages out of retrieval eligibility", () => {
    expect(resolveLegacyRetrievalEligibility({ origin: "imported_unknown" })).toBe("excluded_imported_unknown");
    expect(resolveLegacyRetrievalEligibility({ origin: "client_inbound", contentStatus: "revoked" })).toBe(
      "excluded_revoked",
    );
    expect(resolveLegacyRetrievalEligibility({ origin: "client_inbound", status: "draft" })).toBe("excluded_draft");
    expect(resolveLegacyRetrievalEligibility({ origin: "client_inbound", actorType: "unknown" })).toBe(
      "excluded_unverified_actor",
    );
    expect(resolveLegacyRetrievalEligibility({ origin: "client_inbound" })).toBe("eligible");
  });
});
