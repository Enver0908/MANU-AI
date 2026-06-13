import { normalizeSafetyText } from "./normalize-safety-text.js";

export const RESPONSE_PLAN_PROMPT_SEGMENTS_VERSION = "response-plan-prompt-segments-v0.1.0";
export const BOUNDED_RESPONSE_PLAN_SEGMENT_MAX_CHARS = 480;

const FORBIDDEN_PROVIDER_SEGMENT_MARKERS = [
  /\braw[_\s-]?label\b/i,
  /\binternal[_\s-]?reason=/i,
  /\bblock[_\s-]?reason=/i,
  /\bwhatsapp_phone\b/i,
  /\btelegram_user_id\b/i,
  /\bdate_of_birth\b/i,
];

export function buildResponsePlanPromptSegments({ responsePlan, claimManifest = null, styleDna = null }) {
  if (!responsePlan) return [];

  const segments = [
    buildSegment("response_plan", formatResponsePlanSegment(responsePlan)),
    buildSegment("claim_manifest", formatClaimManifestSegment(claimManifest || responsePlan.claimManifest)),
    buildSegment("style_dna", formatStyleDnaSegment(styleDna || responsePlan.styleDna)),
  ];

  for (const segment of segments) {
    assertBoundedProviderSegment(segment);
  }

  return segments;
}

export function appendResponsePlanPromptSegments(promptContext, responsePlan) {
  if (!promptContext || !Array.isArray(promptContext.segments) || !responsePlan) {
    return promptContext;
  }

  return {
    ...promptContext,
    segments: [...promptContext.segments, ...buildResponsePlanPromptSegments({ responsePlan })],
  };
}

export function assertBoundedProviderSegment(segment) {
  if (!segment || typeof segment.text !== "string") {
    throw new Error("provider_segment_invalid");
  }

  if (segment.text.length > BOUNDED_RESPONSE_PLAN_SEGMENT_MAX_CHARS) {
    throw new Error(`provider_segment_overlong:${segment.type}`);
  }

  const normalized = normalizeSafetyText(segment.text);
  for (const marker of FORBIDDEN_PROVIDER_SEGMENT_MARKERS) {
    if (marker.test(normalized)) {
      throw new Error(`provider_segment_forbidden_marker:${segment.type}`);
    }
  }
}

function buildSegment(type, text) {
  return {
    type,
    text,
    authority: "response_plan_engine_v1",
    origin: "response_plan_v1",
    sourceId: "response_plan_v1",
  };
}

function formatResponsePlanSegment(responsePlan) {
  return [
    `version=${responsePlan.version}`,
    `intentFamily=${responsePlan.intentFamily || "none"}`,
    `replyMode=${responsePlan.replyMode}`,
    `templateId=${responsePlan.templateId || "none"}`,
    `riskClass=${responsePlan.riskClass || "none"}`,
    `sourceRefCount=${responsePlan.sourceRefs?.length || 0}`,
    `foodDecision=${responsePlan.foodDecision?.decision || "none"}`,
    `messagePlanSummary=${responsePlan.clientMessagePlan?.summary || "none"}`,
  ].join("; ");
}

function formatClaimManifestSegment(claimManifest) {
  if (!claimManifest) return "version=none; claims=0; sourceIds=0";
  return [
    `version=${claimManifest.version}`,
    `templateId=${claimManifest.templateId || "none"}`,
    `claims=${claimManifest.claims?.length || 0}`,
    `sourceIds=${claimManifest.sourceIds?.length || 0}`,
  ].join("; ");
}

function formatStyleDnaSegment(styleDna) {
  if (!styleDna) return "version=none; scope=none";
  return [
    `version=${styleDna.version}`,
    `scope=${styleDna.scope || "none"}`,
    `formality=${styleDna.formality || "unset"}`,
    `emojiPolicy=${styleDna.emojiPolicy || "unset"}`,
  ].join("; ");
}
