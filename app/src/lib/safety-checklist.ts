import type { ClientRecord, SafetyChecklist } from "./types";

export const safetyChecklistLabels: Record<keyof SafetyChecklist, string> = {
  goalReviewed: "Goal reviewed",
  dietPlanReviewed: "Diet plan reviewed",
  allergiesReviewed: "Allergies reviewed",
  restrictedFoodsReviewed: "Restricted foods reviewed",
  riskFlagsReviewed: "Risk flags reviewed",
  channelPermissionVerified: "Channel permission verified",
  adultStatusConfirmed: "Adult/minor status confirmed",
};

export function completeSafetyChecklist(): SafetyChecklist {
  return {
    goalReviewed: true,
    dietPlanReviewed: true,
    allergiesReviewed: true,
    restrictedFoodsReviewed: true,
    riskFlagsReviewed: true,
    channelPermissionVerified: true,
    adultStatusConfirmed: true,
  };
}

export function emptySafetyChecklist(): SafetyChecklist {
  return {
    goalReviewed: false,
    dietPlanReviewed: false,
    allergiesReviewed: false,
    restrictedFoodsReviewed: false,
    riskFlagsReviewed: false,
    channelPermissionVerified: false,
    adultStatusConfirmed: false,
  };
}

export function normalizeSafetyChecklist(value: Partial<SafetyChecklist> | null | undefined): SafetyChecklist {
  const legacyValue = value as Partial<SafetyChecklist> & { mandatorySafetyComplete?: boolean } | null | undefined;
  if (legacyValue?.mandatorySafetyComplete === true) {
    return completeSafetyChecklist();
  }

  return {
    ...emptySafetyChecklist(),
    ...(value || {}),
  };
}

export function getMissingSafetyChecklistItems(client: ClientRecord) {
  const checklist = normalizeSafetyChecklist(client.safetyChecklist);
  const missing = (Object.keys(safetyChecklistLabels) as Array<keyof SafetyChecklist>).filter((key) => !checklist[key]);

  if (client.channelPermission !== "ready" && !missing.includes("channelPermissionVerified")) {
    missing.push("channelPermissionVerified");
  }

  if (client.healthProfile.adultStatus === "unknown" && !missing.includes("adultStatusConfirmed")) {
    missing.push("adultStatusConfirmed");
  }

  return missing;
}

export function isSafetyChecklistComplete(client: ClientRecord) {
  return getMissingSafetyChecklistItems(client).length === 0;
}
