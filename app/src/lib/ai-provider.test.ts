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

function providerContextWithResponsePlan(
  extraSegments: Array<{ type: string; text: string }> = [],
  replyMode: "send" | "draft" = "send",
  templateId = "plan_lookup_v1",
  riskClass: "green" | "yellow" = "green",
) {
  return {
    segments: [
      { type: "diet_plan_summary", text: "Three meals and one snack." },
      {
        type: "response_plan",
        text: `version=response-plan-v1-v0.1.0; intentFamily=green_plan_lookup; replyMode=${replyMode}; templateId=${templateId}; riskClass=${riskClass}; sourceRefCount=1; foodDecision=none; messagePlanSummary=replyMode=${replyMode}`,
      },
      {
        type: "claim_manifest",
        text: "version=claim-manifest-v1-v0.1.0; templateId=plan_lookup_v1; claims=2; claimTypes=plan_alignment_guidance,generic_plan_guidance; sourceIds=1",
      },
      {
        type: "style_dna",
        text: "version=style-dna-v2-v0.1.0; scope=tenant:tenant-manu-demo;dietitian:dietitian-demo; formality=balanced; emojiPolicy=limited; sentenceLength=medium; warmthTone=balanced; boundaryPhrasing=practical_neutral; responseTimingStyle=prompt; candidatePhraseCount=0",
      },
      ...extraSegments,
    ],
  };
}

const promptContext = providerContextWithResponsePlan();

describe("mock AI provider", () => {
  it("generates deterministic template-based green and yellow replies", async () => {
    await expect(generateMockProviderReply({ context: promptContext, risk: "green" })).resolves.toContain(
      "planindaki",
    );
    await expect(
      generateMockProviderReply({
        context: providerContextWithResponsePlan([], "draft", "provider_styled_draft_v1", "yellow"),
        risk: "yellow",
      }),
    ).resolves.toContain("inceleme icin kaydedildi");
  });

  it("uses the conversation language segment for deterministic localized replies", async () => {
    await expect(
      generateMockProviderReply({
        context: providerContextWithResponsePlan([
          { type: "conversation_language", text: "Reply to this client in en." },
        ]),
        risk: "green",
      }),
    ).resolves.toContain("planned meal");
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
        { context: providerContextWithResponsePlan(), risk: "green" },
        { failureMode: "provider_timeout", maxRetries: 1 },
      ),
    ).rejects.toMatchObject({ code: "provider_timeout" });

    try {
      await generateMockProviderReply(
        { context: providerContextWithResponsePlan(), risk: "green" },
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

  it("rejects unknown and overlong provider context segments", () => {
    expect(() =>
      assertMockProviderInputPolicy({
        context: { segments: [{ type: "raw_audit_log", text: "private" }] },
        risk: "green",
      } as never),
    ).toThrowError(/rejected segment type/);

    expect(() =>
      assertMockProviderInputPolicy({
        context: { segments: [{ type: "current_message", text: "a".repeat(3001) }] },
        risk: "green",
      }),
    ).toThrowError(/overlong segment/);
  });

  it("rejects provider calls without response_plan templateId", async () => {
    const context = providerContextWithResponsePlan();
    context.segments = context.segments.map((segment) =>
      segment.type === "response_plan"
        ? {
            ...segment,
            text: "version=response-plan-v1-v0.1.0; intentFamily=green_plan_lookup; replyMode=send; templateId=none; riskClass=green",
          }
        : segment,
    );

    await expect(generateMockProviderReply({ context, risk: "green" })).rejects.toMatchObject({
      code: "provider_policy_violation",
    });
  });

  it("rejects provider calls without response_plan segments", async () => {
    await expect(
      generateMockProviderReply({
        context: { segments: [{ type: "diet_plan_summary", text: "Three meals" }] },
        risk: "green",
      }),
    ).rejects.toMatchObject({ code: "provider_policy_violation" });
  });

  it("accepts bounded response_plan, claim_manifest, and style_dna segments", () => {
    expect(() =>
      assertMockProviderInputPolicy({
        context: providerContextWithResponsePlan(),
        risk: "green",
      }),
    ).not.toThrow();
  });

  it("allows long non-response-plan segments above the 480-char response-plan bound", () => {
    expect(() =>
      assertMockProviderInputPolicy({
        context: providerContextWithResponsePlan([
          { type: "client_form_summary", text: "Hedef: ".repeat(120) },
        ]),
        risk: "green",
      }),
    ).not.toThrow();
  });

  it("rejects raw internal metadata markers inside provider segments", async () => {
    const context = providerContextWithResponsePlan();
    context.segments = context.segments.map((segment) =>
      segment.type === "response_plan"
        ? { ...segment, text: "version=v1; replyMode=send; internal_reason=leak" }
        : segment,
    );

    await expect(generateMockProviderReply({ context, risk: "green" })).rejects.toMatchObject({
      code: "provider_policy_violation",
    });
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

  it("keeps deterministic template output within the product communication covenant", async () => {
    const reply = await generateMockProviderReply({ context: promptContext, risk: "green" });
    expect(reply).not.toMatch(/consult your doctor/i);
    expect(reply).not.toMatch(/as an ai/i);
  });
});
