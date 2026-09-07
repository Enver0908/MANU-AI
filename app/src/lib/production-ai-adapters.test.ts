import { afterEach, describe, expect, it, vi } from "vitest";
import { generateWithRealZaiGlmFlashTextAdapter } from "./production-ai-adapters";
import { TURKEY_FIRST_DIRECT_LAUNCH_SCOPE } from "./production-readiness-contracts";

const allApprovals = {
  vendorRiskApproved: true,
  clinicalSafetyApproved: true,
  privacyLegalApproved: true,
  providerTrainingDisabled: true,
  providerRetentionDisabledOrBounded: true,
  nativeTokenCountingVerified: true,
  safetySettingsConfigured: true,
};

const safeRequest = {
  model: "glm-5.3-flash",
  prompt: "Bounded, server-built prompt context.",
  payloadSafety: {
    riskLevel: "green" as const,
    serializedCharCount: 1200,
    topLevelKeys: ["promptContext", "contextManifest", "responsePlan"],
    attachmentStatuses: [],
  },
  approvalState: allApprovals,
  boundary: {
    env: {
      NODE_ENV: "production",
      MANU_APP_ENV: "production",
      MANU_ALLOW_REAL_ZAI: "true",
    },
    approvedGateIdsSource: "server_authority" as const,
    approvedGateIds: [
      "legal_privacy_review",
      "clinical_taxonomy_approval",
      "provider_vendor_review",
      "channel_policy_review",
      "incident_response_runbook",
      "backup_restore_test",
      "secret_rotation_plan",
      "dependency_audit_clearance",
    ],
    launchAuthorizationApproved: true,
    tenantEntitlementActive: true,
    tenantPermissionGranted: true,
    contextAuthority: "server" as const,
    launchScope: TURKEY_FIRST_DIRECT_LAUNCH_SCOPE,
  },
};

describe("production Z.ai GLM-5.3-Flash adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ZAI_API_KEY;
  });

  it("blocks before transport when production readiness gates are not closed", async () => {
    await expect(
      generateWithRealZaiGlmFlashTextAdapter({
        ...safeRequest,
        boundary: { ...safeRequest.boundary, launchAuthorizationApproved: false },
      }),
    ).rejects.toMatchObject({ status: 403, code: "real_ai_provider_blocked" });
  });

  it("requires ZAI_API_KEY after gates pass", async () => {
    await expect(generateWithRealZaiGlmFlashTextAdapter(safeRequest)).rejects.toMatchObject({
      status: 503,
      code: "real_ai_provider_not_configured",
    });
  });

  it("sends only the Z.ai GLM-5.3-Flash chat completion shape and discards reasoning content", async () => {
    process.env.ZAI_API_KEY = "test-zai-key";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Tamam, bunu plana uygun bicimde yanitlayalim.",
              reasoning_content: "must not be returned",
            },
          },
        ],
      }),
    } as Response);

    const response = await generateWithRealZaiGlmFlashTextAdapter(safeRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.z.ai/api/paas/v4/chat/completions");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: "glm-5.3-flash",
      messages: [{ role: "user", content: safeRequest.prompt }],
      temperature: 1,
      top_p: 0.95,
      reasoning_effort: "max",
      thinking: { type: "enabled", clear_thinking: false },
    });
    expect(response).toMatchObject({
      provider: "zai",
      model: "glm-5.3-flash",
      text: "Tamam, bunu plana uygun bicimde yanitlayalim.",
      requestContract: {
        reasoningContentPolicy: "discard_before_app_logging",
      },
    });
    expect(JSON.stringify(response)).not.toContain("must not be returned");
  });

  it("maps provider rate limits to stable app errors", async () => {
    process.env.ZAI_API_KEY = "test-zai-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({}),
    } as Response);

    await expect(generateWithRealZaiGlmFlashTextAdapter(safeRequest)).rejects.toMatchObject({
      status: 429,
      code: "real_ai_provider_rate_limited",
    });
  });

  it("maps empty provider output to invalid output", async () => {
    process.env.ZAI_API_KEY = "test-zai-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "" } }] }),
    } as Response);

    await expect(generateWithRealZaiGlmFlashTextAdapter(safeRequest)).rejects.toMatchObject({
      status: 502,
      code: "real_ai_provider_invalid_output",
    });
  });
});
