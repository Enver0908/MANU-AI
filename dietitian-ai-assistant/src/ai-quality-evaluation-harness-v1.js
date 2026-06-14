import { isClaimManifestComplete } from "./claim-manifest-v1.js";
import { compilePromptContext, renderPromptContext } from "./context-compiler.js";
import { buildClientContextCapsule } from "./context-capsule.js";
import { getPersona } from "./personas.js";
import { guardProviderOutput } from "./response-quality-guard.js";
import { defaultVoiceProfile } from "./voice-profile.js";

export const AI_QUALITY_EVAL_HARNESS_V1_VERSION = "ai-quality-evaluation-harness-v1-v0.1.0";
export const RELEASE_SUBSET_TARGET_COUNT = 100;
export const FULL_REHEARSAL_TARGET_COUNT = 1000;

const CLIENT_FACING_METADATA_LEAK_PATTERNS = [
  /internal_reason=/i,
  /workflowState/i,
  /intentFamily=/i,
  /replyMode=/i,
  /templateId=/i,
  /claim_manifest/i,
  /style_dna/i,
  /raw_label/i,
  /response-plan-v1/i,
  /claim-manifest-v1/i,
  /<client_message_data>/i,
  /sourceRefCount=/i,
  /messagePlanSummary=/i,
  /version=claim-manifest/i,
];

const MOCK_PROVIDER_SAFE_REPLY = "Planina uygun kisa bir yanit.";

export function loadHarnessCasesFromJsonl(raw) {
  return String(raw || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function expandHarnessCasesDeterministically(seedCases, targetCount) {
  if (!Array.isArray(seedCases) || seedCases.length === 0) {
    throw new Error("harness_seed_cases_required");
  }
  if (!Number.isInteger(targetCount) || targetCount < seedCases.length) {
    throw new Error("harness_target_count_invalid");
  }

  const expanded = [];
  let variant = 0;

  while (expanded.length < targetCount) {
    for (const seedCase of seedCases) {
      if (expanded.length >= targetCount) break;
      expanded.push(cloneHarnessCaseVariant(seedCase, variant));
    }
    variant += 1;
  }

  return expanded;
}

export function buildHarnessBaseInput(overrides = {}) {
  const baseInput = {
    tenantId: "tenant-harness",
    dietitian: {
      id: "dietitian-harness",
      tenantId: "tenant-harness",
      displayName: "Dyt. Harness",
      timezone: "Europe/Istanbul",
    },
    client: {
      id: "client-harness",
      tenantId: "tenant-harness",
      dietitianId: "dietitian-harness",
      fullName: "Harness Client",
      lifecycleStatus: "active",
      selectedPersonaId: "balanced_coach",
      aiStatus: "active",
      aiMode: "autopilot",
      channelPermission: "ready",
      channelUserId: "wa-harness",
      mandatorySafetyComplete: true,
      humanTakeoverLocked: false,
      redRiskLock: { status: "none" },
      healthProfile: { goal: "fat_loss", adultStatus: "adult" },
      dietPlan: { breakfast: "eggs and vegetables", summary: "Three meals and one snack." },
      allergies: ["peanut"],
      restrictedFoods: [],
      clinicalRiskNotes: [],
      pinnedNotes: ["No peanut suggestions."],
      clientFormSummary: "Primary goal: fat loss with steady meal adherence.",
      communicationLanguage: "tr",
    },
    conversation: {
      id: "conversation-harness",
      tenantId: "tenant-harness",
      dietitianId: "dietitian-harness",
      clientId: "client-harness",
      channel: "whatsapp",
    },
    message: { body: "" },
    recentMessages: [],
    memory: {
      rollingSummary: "Harness rehearsal client prefers practical swaps.",
      durableFacts: {},
    },
  };

  return deepMerge(baseInput, overrides);
}

export function extractHarnessEvalSnapshot(result) {
  const plan = result?.contextManifest?.responsePlan || null;
  const claimManifest = plan?.claimManifest || result?.contextManifest?.claimManifest || null;

  return {
    action: result?.action || null,
    risk: result?.risk || null,
    blockedReason: result?.blockedReason || null,
    providerAttempted: result?.providerAttempted === true,
    responsePlanVersion: plan?.version || null,
    intentFamily: plan?.intentFamily || result?.contextManifest?.canonicalIntent?.intentFamily || null,
    replyMode: plan?.replyMode || null,
    templateId: plan?.templateId || null,
    workflowState: result?.contextManifest?.canonicalIntent?.workflowState || null,
    claimManifestVersion: claimManifest?.version || null,
    claimManifestComplete: isClaimManifestComplete(claimManifest, {
      providerEligible: plan?.providerEligible === true,
    }),
    sourceRefCount: Array.isArray(plan?.sourceRefs) ? plan.sourceRefs.length : 0,
    claimTypeCount: Array.isArray(claimManifest?.claims) ? claimManifest.claims.length : 0,
    foodDecision: plan?.foodDecision?.decision || result?.contextManifest?.foodDecisionV2?.decision || null,
    internalReason: plan?.internalReason || null,
    greenIntentDecision: result?.contextManifest?.greenIntent?.decision || null,
    answerabilityDecision: result?.contextManifest?.answerability?.decision || null,
    deterministicClientMessageTemplateId: result?.contextManifest?.deterministicClientMessage?.templateId || null,
    deterministicClientMessageText: result?.contextManifest?.deterministicClientMessage?.text || null,
    providerOutputSafetyAllowed: result?.providerOutputSafety?.allowed ?? null,
  };
}

export function evaluateHarnessExpectations(expect = {}, snapshot = {}) {
  const failures = [];

  if (expect.action !== undefined && snapshot.action !== expect.action) {
    failures.push(`action expected ${expect.action}, got ${snapshot.action}`);
  }
  if (expect.risk !== undefined && snapshot.risk !== expect.risk) {
    failures.push(`risk expected ${expect.risk}, got ${snapshot.risk}`);
  }
  if (expect.blockedReason !== undefined && snapshot.blockedReason !== expect.blockedReason) {
    failures.push(`blockedReason expected ${expect.blockedReason}, got ${snapshot.blockedReason}`);
  }
  if (expect.providerAttempted !== undefined && snapshot.providerAttempted !== expect.providerAttempted) {
    failures.push(`providerAttempted expected ${expect.providerAttempted}, got ${snapshot.providerAttempted}`);
  }
  if (expect.responsePlanVersion !== undefined && snapshot.responsePlanVersion !== expect.responsePlanVersion) {
    failures.push(`responsePlanVersion expected ${expect.responsePlanVersion}, got ${snapshot.responsePlanVersion}`);
  }
  if (expect.intentFamily !== undefined && snapshot.intentFamily !== expect.intentFamily) {
    failures.push(`intentFamily expected ${expect.intentFamily}, got ${snapshot.intentFamily}`);
  }
  if (expect.replyMode !== undefined && snapshot.replyMode !== expect.replyMode) {
    failures.push(`replyMode expected ${expect.replyMode}, got ${snapshot.replyMode}`);
  }
  if (expect.templateId !== undefined && snapshot.templateId !== expect.templateId) {
    failures.push(`templateId expected ${expect.templateId}, got ${snapshot.templateId}`);
  }
  if (expect.workflowState !== undefined && snapshot.workflowState !== expect.workflowState) {
    failures.push(`workflowState expected ${expect.workflowState}, got ${snapshot.workflowState}`);
  }
  if (expect.foodDecision !== undefined && snapshot.foodDecision !== expect.foodDecision) {
    failures.push(`foodDecision expected ${expect.foodDecision}, got ${snapshot.foodDecision}`);
  }
  if (expect.greenIntentDecision !== undefined && snapshot.greenIntentDecision !== expect.greenIntentDecision) {
    failures.push(`greenIntentDecision expected ${expect.greenIntentDecision}, got ${snapshot.greenIntentDecision}`);
  }
  if (expect.claimManifestComplete !== undefined && snapshot.claimManifestComplete !== expect.claimManifestComplete) {
    failures.push(`claimManifestComplete expected ${expect.claimManifestComplete}, got ${snapshot.claimManifestComplete}`);
  }
  if (expect.sourceRefCountMin !== undefined && snapshot.sourceRefCount < expect.sourceRefCountMin) {
    failures.push(`sourceRefCount expected >= ${expect.sourceRefCountMin}, got ${snapshot.sourceRefCount}`);
  }
  if (expect.claimTypeCountMin !== undefined && snapshot.claimTypeCount < expect.claimTypeCountMin) {
    failures.push(`claimTypeCount expected >= ${expect.claimTypeCountMin}, got ${snapshot.claimTypeCount}`);
  }
  if (expect.expectNoResponsePlan === true && snapshot.responsePlanVersion !== null) {
    failures.push("responsePlan expected absent");
  }
  if (expect.providerOutputSafetyAllowed !== undefined && snapshot.providerOutputSafetyAllowed !== expect.providerOutputSafetyAllowed) {
    failures.push(
      `providerOutputSafetyAllowed expected ${expect.providerOutputSafetyAllowed}, got ${snapshot.providerOutputSafetyAllowed}`,
    );
  }

  return failures;
}

export function detectClientFacingMetadataLeaks(text) {
  const normalized = String(text || "");
  const leaks = [];

  for (const pattern of CLIENT_FACING_METADATA_LEAK_PATTERNS) {
    if (pattern.test(normalized)) {
      leaks.push(pattern.source);
    }
  }

  return leaks;
}

export function assertClientFacingTextSafe(text) {
  const leaks = detectClientFacingMetadataLeaks(text);
  if (leaks.length > 0) {
    throw new Error(`client_facing_metadata_leak:${leaks.join(",")}`);
  }
}

export async function runHarnessCase(caseDef, { handleInboundMessage, baseInput = buildHarnessBaseInput(), mockProviderReply = MOCK_PROVIDER_SAFE_REPLY } = {}) {
  if (!handleInboundMessage) {
    throw new Error("harness_handle_inbound_required");
  }

  if (caseDef.category === "adversarial_metadata_detect") {
    return runAdversarialMetadataDetectCase(caseDef);
  }

  if (caseDef.category === "adversarial_provider_leak") {
    return runAdversarialProviderLeakCase(caseDef);
  }

  if (caseDef.category === "adversarial_prompt_boundary") {
    return runPromptBoundaryCase(caseDef, baseInput);
  }

  const turns = Array.isArray(caseDef.turns) && caseDef.turns.length > 0
    ? caseDef.turns
    : [{ message: caseDef.message, ...caseDef }];

  const snapshots = [];
  const failures = [];
  let recentMessages = [];

  for (const [index, turn] of turns.entries()) {
    const input = buildTurnInput({
      baseInput,
      caseDef,
      turn,
      recentMessages,
    });
    const result = await handleInboundMessage(input, buildHarnessAdapters(mockProviderReply));
    const snapshot = {
      ...extractHarnessEvalSnapshot(result),
      harnessDetails: {
        contextManifest: result.contextManifest || null,
        providerOutputSafety: result.providerOutputSafety || null,
        replyText: result.replyText || null,
      },
    };
    snapshots.push(snapshot);

    const turnFailures = evaluateHarnessExpectations(turn.expect || caseDef.expect || {}, snapshot).map(
      (failure) => `${caseDef.id} turn ${index + 1}: ${failure}`,
    );
    failures.push(...turnFailures);

    if (turn.expect?.clientTextSafe === true || caseDef.expect?.clientTextSafe === true) {
      const clientText = snapshot.deterministicClientMessageText;
      if (clientText) {
        const leaks = detectClientFacingMetadataLeaks(clientText);
        if (leaks.length > 0) {
          failures.push(`${caseDef.id} turn ${index + 1}: client text metadata leak ${leaks.join(",")}`);
        }
      }
    }

    recentMessages = [
      ...recentMessages,
      {
        body: turn.message,
        origin: "client_inbound",
        createdAt: `2026-06-13T12:${String(index).padStart(2, "0")}:00.000Z`,
      },
    ];
  }

  return {
    id: caseDef.id,
    category: caseDef.category,
    snapshots,
    failures,
    pass: failures.length === 0,
  };
}

export async function runHarnessBatch(cases, options = {}) {
  const startedAt = Date.now();
  const results = [];

  for (const caseDef of cases) {
    results.push(await runHarnessCase(caseDef, options));
  }

  const failures = results.flatMap((result) => result.failures);
  const metrics = {
    harnessVersion: AI_QUALITY_EVAL_HARNESS_V1_VERSION,
    status: failures.length === 0 ? "pass" : "fail",
    caseCount: cases.length,
    passCount: results.filter((result) => result.pass).length,
    failureCount: failures.length,
    failures,
    categoryCounts: countBy(results, (result) => result.category),
    elapsedMs: Date.now() - startedAt,
  };

  return { results, metrics };
}

function runAdversarialMetadataDetectCase(caseDef) {
  const output = caseDef.adversarial?.providerOutput || "";
  const leaks = detectClientFacingMetadataLeaks(output);
  const failures = [];

  if (caseDef.expect?.metadataLeakDetected === true && leaks.length === 0) {
    failures.push(`${caseDef.id}: expected metadata leak detection`);
  }
  if (caseDef.expect?.metadataLeakDetected === false && leaks.length > 0) {
    failures.push(`${caseDef.id}: unexpected metadata leak detection ${leaks.join(",")}`);
  }

  return {
    id: caseDef.id,
    category: caseDef.category,
    snapshots: [{ metadataLeakCount: leaks.length }],
    failures,
    pass: failures.length === 0,
  };
}

function runAdversarialProviderLeakCase(caseDef) {
  const guard = guardProviderOutput({
    output: caseDef.adversarial?.providerOutput || "",
    capsule: {
      client: { fullName: "Harness Client", knownOtherClientNames: [] },
      voiceProfile: { averageMessageChars: 240 },
    },
    riskDecision: { level: "green" },
    claimManifest: caseDef.adversarial?.claimManifest || null,
    styleDna: caseDef.adversarial?.styleDna || null,
  });

  const snapshot = {
    providerOutputSafetyAllowed: guard.allowed,
  };
  const failures = evaluateHarnessExpectations(caseDef.expect || {}, snapshot).map(
    (failure) => `${caseDef.id}: ${failure}`,
  );

  return {
    id: caseDef.id,
    category: caseDef.category,
    snapshots: [snapshot],
    failures,
    pass: failures.length === 0,
  };
}

function runPromptBoundaryCase(caseDef, baseInput) {
  const capsule = buildClientContextCapsule({
    tenantId: baseInput.tenantId,
    dietitian: baseInput.dietitian,
    client: baseInput.client,
    conversation: baseInput.conversation,
    persona: getPersona(baseInput.client.selectedPersonaId),
    voiceProfile: defaultVoiceProfile(),
    memory: baseInput.memory,
  });

  const compiled = compilePromptContext({
    capsule,
    currentMessage: { body: caseDef.message },
    recentMessages: caseDef.recentMessages || [],
    riskLevel: "green",
  });
  const rendered = renderPromptContext(compiled.promptContext);
  const failures = [];

  if (!rendered.includes("<client_message_data>")) {
    failures.push(`${caseDef.id}: missing client_message_data boundary`);
  }
  if (rendered.includes(caseDef.message) && !rendered.includes(`<client_message_data>\n${caseDef.message}\n</client_message_data>`)) {
    failures.push(`${caseDef.id}: client message not wrapped in client_message_data boundary`);
  }

  const leaks = detectClientFacingMetadataLeaks(rendered);
  if (leaks.some((leak) => /response-plan-v1|claim-manifest-v1/i.test(leak))) {
    failures.push(`${caseDef.id}: internal plan/manifest version leaked into prompt render`);
  }

  return {
    id: caseDef.id,
    category: caseDef.category,
    snapshots: [{ promptBoundaryWrapped: failures.length === 0 }],
    failures,
    pass: failures.length === 0,
  };
}

function buildTurnInput({ baseInput, caseDef, turn, recentMessages }) {
  const casePatch = caseDef.inputPatch || {};
  const turnPatch = turn.inputPatch || {};
  const merged = deepMerge(baseInput, withoutClientReplace(casePatch), withoutClientReplace(turnPatch));

  if (casePatch._replaceClient || turnPatch._replaceClient) {
    merged.client = {
      ...baseInput.client,
      ...(casePatch.client || {}),
      ...(turnPatch.client || {}),
    };
  }

  return {
    ...merged,
    message: { body: turn.message },
    recentMessages,
    foodDecisionV2: turn.foodDecisionV2 ?? caseDef.foodDecisionV2 ?? merged.foodDecisionV2 ?? null,
    productIngredientEvidence:
      turn.productIngredientEvidence ?? caseDef.productIngredientEvidence ?? merged.productIngredientEvidence ?? null,
    structuredFoodRules: turn.structuredFoodRules ?? caseDef.structuredFoodRules ?? merged.structuredFoodRules ?? null,
    foodRuleDecisionOverride: turn.foodRule ?? caseDef.foodRule ?? merged.foodRuleDecisionOverride ?? null,
    riskDecisionOverride: turn.riskDecisionOverride ?? caseDef.riskDecisionOverride ?? merged.riskDecisionOverride ?? null,
  };
}

function deepMerge(target, ...sources) {
  const output = structuredClone(target);
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        output[key] = deepMerge(output[key] || {}, value);
      } else if (value !== undefined) {
        output[key] = value;
      }
    }
  }
  return output;
}

function withoutClientReplace(patch) {
  if (!patch || typeof patch !== "object") return patch;
  const { _replaceClient, ...rest } = patch;
  return rest;
}

function buildHarnessAdapters(mockProviderReply) {
  return {
    generateReply: async () => mockProviderReply,
    sendMessage: async () => {},
    onHandoff: async () => {},
  };
}

function cloneHarnessCaseVariant(seedCase, variant) {
  const suffix = `__v${variant}`;
  return {
    ...seedCase,
    id: `${seedCase.id}${suffix}`,
    inputPatch: deepMerge(seedCase.inputPatch || {}, {
      client: {
        channelUserId: `wa-harness-${variant}`,
      },
    }),
    turns: Array.isArray(seedCase.turns)
      ? seedCase.turns.map((turn) => ({ ...turn }))
      : undefined,
  };
}

function countBy(items, selector) {
  return items.reduce((counts, item) => {
    const key = selector(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}
