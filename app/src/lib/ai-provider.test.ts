import { describe, expect, it } from "vitest";
import {
  MOCK_PROVIDER_ID,
  PROMPT_VERSION,
  buildSafeProviderMetadata,
  generateMockProviderReply,
  getProviderErrorCode,
} from "./ai-provider";

describe("mock AI provider", () => {
  it("generates deterministic green and yellow replies", async () => {
    const client = { dietPlan: { summary: "Three meals and one snack." } };

    await expect(generateMockProviderReply({ client, risk: "green" })).resolves.toContain("Three meals");
    await expect(generateMockProviderReply({ client, risk: "yellow" })).resolves.toContain("onayiyla");
  });

  it("normalizes timeout and provider errors", async () => {
    await expect(
      generateMockProviderReply(
        { client: { dietPlan: { summary: "" } }, risk: "green" },
        { failureMode: "provider_timeout", maxRetries: 1 },
      ),
    ).rejects.toMatchObject({ code: "provider_timeout" });

    try {
      await generateMockProviderReply(
        { client: { dietPlan: { summary: "" } }, risk: "green" },
        { failureMode: "provider_error" },
      );
    } catch (error) {
      expect(getProviderErrorCode(error)).toBe("provider_error");
    }
  });

  it("builds safe provider metadata without raw prompt or message text", () => {
    expect(
      buildSafeProviderMetadata({
        providerId: MOCK_PROVIDER_ID,
        promptVersion: PROMPT_VERSION,
        model: "gemini-1.5-flash",
        status: "ok",
      }),
    ).toEqual({
      providerId: MOCK_PROVIDER_ID,
      promptVersion: PROMPT_VERSION,
      model: "gemini-1.5-flash",
      status: "ok",
      errorCode: null,
    });
  });
});
