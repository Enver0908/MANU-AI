import { describe, expect, it } from "vitest";
import {
  MOCK_PROVIDER_ID,
  PROMPT_VERSION,
  assertMockProviderInputPolicy,
  buildMockProviderInput,
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

  it("builds provider input from the allowlisted client fields only", () => {
    const input = buildMockProviderInput(
      {
        dietPlan: {
          summary: "Three meals and one snack.",
          breakfast: "eggs",
          lunch: "private",
          dinner: "private",
        },
      },
      "green",
    );

    expect(input).toEqual({
      client: {
        dietPlan: {
          summary: "Three meals and one snack.",
        },
      },
      risk: "green",
    });
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

  it("rejects raw prompt or capsule payloads at the provider boundary", () => {
    expect(() =>
      assertMockProviderInputPolicy({
        client: { dietPlan: { summary: "Three meals and one snack." } },
        risk: "green",
        prompt: "raw prompt text",
      } as never),
    ).toThrowError(/Provider boundary rejected top_level keys/);

    expect(() =>
      assertMockProviderInputPolicy({
        client: { dietPlan: { summary: "Three meals and one snack." } },
        risk: "green",
        capsule: { client: { fullName: "Mert Kaya" } },
      } as never),
    ).toThrowError(/Provider boundary rejected top_level keys/);
  });

  it("rejects client fields outside the provider allowlist", () => {
    expect(() =>
      assertMockProviderInputPolicy({
        client: {
          dietPlan: { summary: "Three meals and one snack." },
          healthProfile: { goal: "fat_loss" },
          channelUserId: "+905551110001",
          clinicalRiskNotes: ["private"],
          pinnedNotes: ["private"],
        },
        risk: "green",
      } as never),
    ).toThrowError(/Provider boundary rejected client keys/);
  });

  it("rejects red-risk provider calls as defense in depth", async () => {
    await expect(
      generateMockProviderReply({
        client: { dietPlan: { summary: "Three meals and one snack." } },
        risk: "red",
      }),
    ).rejects.toMatchObject({ code: "provider_policy_violation" });
  });
});
