import { describe, expect, it } from "vitest";
import {
  MISSING_HISTORICAL_CONTEXT_TOKEN,
  MOCK_PROVIDER_ID,
  PROMPT_VERSION,
  assertMockProviderInputPolicy,
  buildMockProviderInput,
  buildSafeProviderMetadata,
  generateMockProviderReply,
  getProviderErrorCode,
} from "./ai-provider";

const promptContext = {
  segments: [{ type: "diet_plan_summary", text: "Three meals and one snack." }],
};

describe("mock AI provider", () => {
  it("generates deterministic green and yellow replies", async () => {
    await expect(generateMockProviderReply({ context: promptContext, risk: "green" })).resolves.toContain(
      "Three meals",
    );
    await expect(generateMockProviderReply({ context: promptContext, risk: "yellow" })).resolves.toContain("onayiyla");
  });

  it("builds provider input from prompt context only", () => {
    const input = buildMockProviderInput(promptContext, "green");

    expect(input).toEqual({
      context: promptContext,
      risk: "green",
    });
  });

  it("normalizes timeout and provider errors", async () => {
    await expect(
      generateMockProviderReply(
        { context: { segments: [] }, risk: "green" },
        { failureMode: "provider_timeout", maxRetries: 1 },
      ),
    ).rejects.toMatchObject({ code: "provider_timeout" });

    try {
      await generateMockProviderReply(
        { context: { segments: [] }, risk: "green" },
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

  it("rejects raw prompt or capsule payloads at the provider boundary", () => {
    expect(() =>
      assertMockProviderInputPolicy({
        context: promptContext,
        risk: "green",
        prompt: "raw prompt text",
      } as never),
    ).toThrowError(/Provider boundary rejected top_level keys/);

    expect(() =>
      assertMockProviderInputPolicy({
        context: promptContext,
        risk: "green",
        capsule: { client: { fullName: "Mert Kaya" } },
      } as never),
    ).toThrowError(/Provider boundary rejected top_level keys/);
  });

  it("rejects context segment fields outside the provider allowlist", () => {
    expect(() =>
      assertMockProviderInputPolicy({
        context: { segments: [{ type: "diet_plan_summary", text: "Three meals", raw: "private" }] },
        risk: "green",
      } as never),
    ).toThrowError(/Provider boundary rejected context_segment keys/);
  });

  it("rejects red-risk provider calls as defense in depth", async () => {
    await expect(
      generateMockProviderReply({
        context: promptContext,
        risk: "red",
      }),
    ).rejects.toMatchObject({ code: "provider_policy_violation" });
  });

  it("returns the missing historical context token when the prompt context requires it", async () => {
    await expect(
      generateMockProviderReply({ context: promptContext, risk: "green" }, { forceMissingHistoricalContext: true }),
    ).resolves.toBe(MISSING_HISTORICAL_CONTEXT_TOKEN);
  });
});
