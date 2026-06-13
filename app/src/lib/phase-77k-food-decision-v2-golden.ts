import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import { publishClientFormSchemaInState, saveClientFormResponseInState } from "./client-forms";
import { getPhase77DFoodById } from "./phase-77d-master-food-catalog";
import {
  getClientFoodRuleProfileV2Record,
  getClientFoodRuleProfileV2State,
  saveClientFoodRuleProfileV2InState,
} from "./phase-77e-client-food-rule-profile";
import {
  activateClientMenuPlanV1InState,
  createClientMenuPlanV1InState,
  menuPlanV1RecordToState,
  saveClientMenuPlanV1InState,
} from "./phase-77f-client-menu-plan";
import {
  evaluateClientFoodDecisionV2,
  type FoodDecisionV2Decision,
} from "./phase-77g-food-decision-engine-v2";
import type { ProductIngredientEvidenceInput } from "./food-rule-runtime";
import type { ManuAppState } from "./types";
import { createInitialState } from "./seed-data";
import type { RiskLevel } from "dietitian-ai-assistant-architecture";

export const PHASE_77K_FOOD_DECISION_V2_GOLDEN_VERSION = "phase-77k-food-decision-v2-golden-v1";

export type FoodDecisionV2GoldenCase = {
  id: string;
  category: string;
  message: string;
  riskLevel?: RiskLevel;
  expectDecisions: FoodDecisionV2Decision[];
  expectProviderEligible?: boolean;
  profilePatch?: Record<string, unknown>;
  menuFoodIds?: string[];
  formGoalType?: string;
  productIngredientEvidence?: ProductIngredientEvidenceInput;
};

export type FoodDecisionV2GoldenCaseResult = {
  id: string;
  category: string;
  passed: boolean;
  decision: FoodDecisionV2Decision;
  providerEligible: boolean;
  sourceReferenceCount: number;
  failures: string[];
};

export type Phase77kFoodDecisionV2GoldenMetrics = {
  goldenVersion: string;
  status: "pass" | "fail";
  totalCaseCount: number;
  passedCaseCount: number;
  failedCaseCount: number;
  categoryCoverage: string[];
  needsLabelCorrectCount: number;
  needsReviewCorrectCount: number;
  inappropriateApprovalCount: number;
  forbiddenFoodApprovalCount: number;
  sourceManifestCompleteCount: number;
  failures: string[];
  caseResults: FoodDecisionV2GoldenCaseResult[];
};

let cachedGoldenCases: FoodDecisionV2GoldenCase[] | null = null;

export function loadFoodDecisionV2GoldenCases(): FoodDecisionV2GoldenCase[] {
  if (cachedGoldenCases) return cachedGoldenCases;
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(moduleDir, "food-decision-v2-golden-cases.jsonl"), "utf8");
  cachedGoldenCases = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FoodDecisionV2GoldenCase);
  return cachedGoldenCases;
}

function profileBody(profile: NonNullable<ReturnType<typeof getClientFoodRuleProfileV2State>>) {
  const { conflicts, ...body } = profile;
  void conflicts;
  return body;
}

function buildMenuItem(foodId: string) {
  const located = getPhase77DFoodById(foodId);
  return {
    id: `item-${foodId}`,
    label: located?.food.name || foodId,
    freeText: located?.food.name || foodId,
    catalogFoodIds: [foodId],
    catalogMatch: located
      ? {
          query: located.food.name,
          catalogFoodId: foodId,
          catalogFoodName: located.food.name,
          matchConfidence: "exact" as const,
        }
      : null,
    portionNote: "",
    recipe: null,
  };
}

export function seedFoodDecisionV2GoldenCaseState(
  goldenCase: FoodDecisionV2GoldenCase,
  clientId = "client-mert",
  baseState?: ManuAppState,
): ManuAppState {
  const initial = baseState ?? createInitialState();
  const schema = initial.clientFormSchemas[0];
  let state = publishClientFormSchemaInState(initial, schema.id);
  const answers = {
    ...buildPhase70QualifiedClientAnswers(),
    ...(goldenCase.formGoalType ? { goal_type: goldenCase.formGoalType } : {}),
  };
  state = saveClientFormResponseInState(state, clientId, schema.id, answers);

  const profile = getClientFoodRuleProfileV2State(state, clientId);
  if (profile && goldenCase.profilePatch) {
    state = saveClientFoodRuleProfileV2InState(state, clientId, {
      revision: profile.revision,
      profile: {
        ...profileBody(profile),
        ...goldenCase.profilePatch,
      },
    });
  }

  if (goldenCase.menuFoodIds && goldenCase.menuFoodIds.length > 0) {
    state = createClientMenuPlanV1InState(state, clientId, { templateType: "weekly_meal_framework" });
    const created = state.clientMenuPlans.find((plan) => plan.clientId === clientId)!;
    const foodProfile = getClientFoodRuleProfileV2Record(state, clientId);
    const editable = menuPlanV1RecordToState(created, foodProfile);
    const { conflicts, ...planBody } = editable;
    void conflicts;
    const slot = editable.mealSlots.find((item) => item.mealKey === "kahvalti") || editable.mealSlots[0];
    state = saveClientMenuPlanV1InState(state, clientId, created.id, {
      revision: editable.revision,
      plan: {
        ...planBody,
        mealSlots: editable.mealSlots.map((item) =>
          item.id === slot.id
            ? { ...item, items: goldenCase.menuFoodIds!.map((foodId) => buildMenuItem(foodId)) }
            : item,
        ),
      },
    });
    state = activateClientMenuPlanV1InState(state, clientId, created.id);
  }

  return state;
}

function isForbiddenCategory(category: string) {
  return category === "forbidden_food" || category === "forbidden_group" || category === "forbidden_ingredient";
}

export function evaluateFoodDecisionV2GoldenCase(
  goldenCase: FoodDecisionV2GoldenCase,
): FoodDecisionV2GoldenCaseResult {
  const state = seedFoodDecisionV2GoldenCaseState(goldenCase);
  const result = evaluateClientFoodDecisionV2(state, "client-mert", goldenCase.message, {
    riskLevel: goldenCase.riskLevel || "green",
    productIngredientEvidence: goldenCase.productIngredientEvidence || null,
  });

  const failures: string[] = [];
  if (!goldenCase.expectDecisions.includes(result.decision)) {
    failures.push(`expected_${goldenCase.expectDecisions.join("|")}_got_${result.decision}`);
  }
  if (
    goldenCase.expectProviderEligible !== undefined &&
    result.providerEligible !== goldenCase.expectProviderEligible
  ) {
    failures.push(`provider_eligible_expected_${goldenCase.expectProviderEligible}`);
  }
  if (result.decision === "allow" && !goldenCase.expectDecisions.includes("allow")) {
    failures.push("inappropriate_approval");
  }
  if (result.decision === "allow" && isForbiddenCategory(goldenCase.category)) {
    failures.push("forbidden_food_approval");
  }

  const sourceReferenceCount = result.sourceReferences.length;
  if (result.decision !== "not_applicable" && sourceReferenceCount === 0) {
    failures.push("source_manifest_missing");
  }

  return {
    id: goldenCase.id,
    category: goldenCase.category,
    passed: failures.length === 0,
    decision: result.decision,
    providerEligible: result.providerEligible,
    sourceReferenceCount,
    failures,
  };
}

export function evaluatePhase77kFoodDecisionV2GoldenSuite(): Phase77kFoodDecisionV2GoldenMetrics {
  const cases = loadFoodDecisionV2GoldenCases();
  const caseResults = cases.map((goldenCase) => evaluateFoodDecisionV2GoldenCase(goldenCase));
  const failures: string[] = [];
  let inappropriateApprovalCount = 0;
  let forbiddenFoodApprovalCount = 0;
  let needsLabelCorrectCount = 0;
  let needsReviewCorrectCount = 0;
  let sourceManifestCompleteCount = 0;

  for (const result of caseResults) {
    if (!result.passed) failures.push(`${result.id}:${result.failures.join(",")}`);
    if (result.failures.includes("inappropriate_approval")) inappropriateApprovalCount += 1;
    if (result.failures.includes("forbidden_food_approval")) forbiddenFoodApprovalCount += 1;
    if (result.category === "product_label_needs_ingredients" && result.decision === "needs_label") {
      needsLabelCorrectCount += 1;
    }
    if (
      (result.category === "mixed_clinical_intent" ||
        result.category === "pregnancy_context" ||
        result.category === "out_of_catalog_uncertain") &&
      result.decision === "needs_review"
    ) {
      needsReviewCorrectCount += 1;
    }
    if (result.sourceReferenceCount > 0 || result.decision === "not_applicable") {
      sourceManifestCompleteCount += 1;
    }
  }

  const passedCaseCount = caseResults.filter((result) => result.passed).length;

  return {
    goldenVersion: PHASE_77K_FOOD_DECISION_V2_GOLDEN_VERSION,
    status: failures.length === 0 ? "pass" : "fail",
    totalCaseCount: cases.length,
    passedCaseCount,
    failedCaseCount: cases.length - passedCaseCount,
    categoryCoverage: [...new Set(cases.map((item) => item.category))],
    needsLabelCorrectCount,
    needsReviewCorrectCount,
    inappropriateApprovalCount,
    forbiddenFoodApprovalCount,
    sourceManifestCompleteCount,
    failures,
    caseResults,
  };
}
