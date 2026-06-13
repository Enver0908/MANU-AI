export function resolveFoodDecisionV2IntentFamily(foodDecisionV2) {
  if (!foodDecisionV2 || foodDecisionV2.decision === "not_applicable") return null;

  const { decision, queryType } = foodDecisionV2;
  if (decision === "discourage") return "green_food_decision_discourage";
  if (decision === "forbid") return "green_forbidden_food_reminder";
  if (decision === "allow") return "green_allowed_food_confirmation";
  if (decision === "needs_label" || (queryType === "product_ingredient" && decision === "forbid")) {
    return "green_product_ingredient_check";
  }
  return null;
}

export function resolveFoodIntentFamily(foodRule) {
  if (!foodRule || foodRule.decision === "not_applicable") return null;

  if (foodRule.queryType === "food_permission") {
    if (foodRule.decision === "forbidden_food_rejection" || foodRule.decision === "diet_type_conflict") {
      return "green_forbidden_food_reminder";
    }
    if (foodRule.decision === "allowed_food_confirmation" || foodRule.decision === "diet_type_compatible") {
      return "green_allowed_food_confirmation";
    }
  }

  if (foodRule.queryType === "food_substitution" && foodRule.decision === "equivalent_substitution_allowed") {
    return "green_allowed_substitution";
  }

  if (foodRule.queryType === "meal_skip" && foodRule.decision === "optional_skip_allowed") {
    return "green_optional_meal_skip";
  }

  if (foodRule.queryType === "product_ingredient") {
    if (
      foodRule.decision === "product_ingredient_conflict" ||
      foodRule.decision === "allowed_food_confirmation"
    ) {
      return "green_product_ingredient_check";
    }
    if (foodRule.decision === "diet_type_conflict") {
      return "green_forbidden_food_reminder";
    }
  }

  return null;
}
