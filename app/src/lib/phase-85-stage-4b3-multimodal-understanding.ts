import {
  resolveVisualMeaningV1,
  VISUAL_MEANING_RESOLVER_V1_VERSION,
} from "dietitian-ai-assistant-architecture";
import { getClientFoodRuleProfileV2Record } from "./phase-77e-client-food-rule-profile";
import {
  buildMultimodalMessageEnvelope,
  type Stage4B3BoundedVisualProviderContext,
  type Stage4B3MultimodalEnvelopeBuildResult,
} from "./phase-85-stage-4b3-multimodal-envelope";
import type { MultimodalMessageEnvelope } from "./phase-85-stage-4b3-media-contracts";
import type { ManuAppState } from "./types";

export const STAGE_4B3_MULTIMODAL_UNDERSTANDING_VERSION = "p85-stage-4b3-multimodal-understanding-v1";

export type Stage4B3MultimodalUnderstandingResult =
  | {
      ok: true;
      envelope: MultimodalMessageEnvelope;
      providerContext: Stage4B3BoundedVisualProviderContext;
      meaning: ReturnType<typeof resolveVisualMeaningV1>;
    }
  | { ok: false; failureCode: string; envelopeBuild?: Stage4B3MultimodalEnvelopeBuildResult };

export function getActiveClientMenuPlan(state: ManuAppState, clientId: string) {
  return (
    state.clientMenuPlans.find(
      (plan) => plan.tenantId === state.tenant.id && plan.clientId === clientId && plan.status === "active",
    ) ?? null
  );
}

export function buildVisualMeaningFoodRules(state: ManuAppState, clientId: string) {
  const profile = getClientFoodRuleProfileV2Record(state, clientId);
  if (!profile) {
    return {
      forbiddenFoodItems: [],
      forbiddenFoodGroups: [],
      ingredientAllergenKeywords: [],
      dietTypeRules: null,
    };
  }

  return {
    forbiddenFoodItems: profile.freeTextForbiddenFoods,
    forbiddenFoodGroups: profile.forbiddenFoodGroups,
    ingredientAllergenKeywords: profile.forbiddenIngredientKeywords,
    dietTypeRules: profile.dietTypeRestrictions.join(", ") || null,
  };
}

export function buildMessagesByProviderMessageId(state: ManuAppState, conversationId: string) {
  const map: Record<string, { id: string; providerMessageId: string | null }> = {};
  for (const message of state.messages) {
    if (message.tenantId !== state.tenant.id || message.conversationId !== conversationId) continue;
    const providerMessageId = message.providerMessageId ?? message.providerEventId;
    if (!providerMessageId) continue;
    map[providerMessageId] = { id: message.id, providerMessageId };
  }
  return map;
}

export function resolveMultimodalBundleUnderstanding(
  state: ManuAppState,
  bundleId: string,
): Stage4B3MultimodalUnderstandingResult {
  const built = buildMultimodalMessageEnvelope(state, bundleId);
  if (!built.ok) {
    return { ok: false, failureCode: built.failureCode, envelopeBuild: built };
  }

  const bundle = state.inboundMessageBundles.find((entry) => entry.id === bundleId);
  if (!bundle) {
    return { ok: false, failureCode: "bundle_not_found" };
  }

  const meaning = resolveVisualMeaningV1({
    envelope: built.envelope,
    activeMenu: getActiveClientMenuPlan(state, bundle.clientId),
    foodRules: buildVisualMeaningFoodRules(state, bundle.clientId),
    messagesByProviderMessageId: buildMessagesByProviderMessageId(state, bundle.conversationId),
    providerContext: built.providerContext,
  });

  const envelope: MultimodalMessageEnvelope = {
    ...built.envelope,
    sourceAuthorityState: meaning.sourceAuthorityState,
  };

  return {
    ok: true,
    envelope,
    providerContext: built.providerContext,
    meaning,
  };
}

export { VISUAL_MEANING_RESOLVER_V1_VERSION };
