import {
  PHASE_77F_MENU_PLAN_TEMPLATE_LABELS,
  PHASE_77F_MENU_PLAN_TEMPLATE_TYPES,
  type ClientMenuPlanV1Conflict,
  type ClientMenuPlanV1State,
} from "./phase-77f-client-menu-plan";
import type { Phase77FMenuPlanTemplateType } from "./types";

export const MENU_TEMPLATE_DESCRIPTIONS_TR: Record<Phase77FMenuPlanTemplateType, string> = {
  day_by_day_detailed: "Gun gun ogun detaylari, porsiyon ve alternatiflerle tam plan.",
  weekly_meal_framework: "Haftalik ogun hedefleri ve cerceve notlari.",
  exchange_option_based: "Degisim listesi ve ogun bazli alternatif secenekler.",
  simple_guidance: "Tercih edilen/kacinilacak besinler ve kisa rehberlik metni.",
};

export const MENU_TEMPLATE_LABELS_TR: Record<Phase77FMenuPlanTemplateType, string> = {
  day_by_day_detailed: "Gun gun detayli",
  weekly_meal_framework: "Haftalik cerceve",
  exchange_option_based: "Degisim / secenek",
  simple_guidance: "Basit rehberlik",
};

const HARD_MENU_CONFLICT_CODES = new Set<ClientMenuPlanV1Conflict["code"]>([
  "menu_item_forbidden_food",
  "menu_item_forbidden_category",
  "menu_item_forbidden_group",
]);

export function getMenuTemplateLabel(templateType: Phase77FMenuPlanTemplateType, language: "tr" | "en" = "tr") {
  if (language === "tr") return MENU_TEMPLATE_LABELS_TR[templateType];
  return PHASE_77F_MENU_PLAN_TEMPLATE_LABELS[templateType];
}

export function formatMenuPlanStatusLabel(plan: Pick<ClientMenuPlanV1State, "status">, activePlanId: string | null, planId: string) {
  if (plan.status === "active" || planId === activePlanId) return "Aktif";
  if (plan.status === "archived") return "Arsiv";
  return "Taslak";
}

export function isMenuExportEligible(
  plan: Pick<ClientMenuPlanV1State, "id" | "exportVisible" | "status"> | null | undefined,
  activePlanId: string | null,
) {
  if (!plan || !activePlanId) return false;
  return plan.id === activePlanId && plan.status === "active" && plan.exportVisible;
}

export function hasHardMenuPlanConflicts(conflicts: ClientMenuPlanV1Conflict[]) {
  return conflicts.some((conflict) => HARD_MENU_CONFLICT_CODES.has(conflict.code));
}

export function summarizeMenuWorkflow(plans: ClientMenuPlanV1State[], activePlanId: string | null) {
  const activePlan = plans.find((plan) => plan.id === activePlanId) || null;
  return {
    totalPlans: plans.length,
    draftCount: plans.filter((plan) => plan.status === "draft").length,
    archivedCount: plans.filter((plan) => plan.status === "archived").length,
    hasActivePlan: Boolean(activePlanId),
    activeExportVisible: Boolean(activePlan?.exportVisible),
    conflictCount: plans.reduce((sum, plan) => sum + plan.conflicts.length, 0),
    templateTypes: PHASE_77F_MENU_PLAN_TEMPLATE_TYPES.map((templateType) => ({
      templateType,
      count: plans.filter((plan) => plan.templateType === templateType).length,
    })),
  };
}

export function getMenuExportBlockReason(
  plan: Pick<ClientMenuPlanV1State, "id" | "exportVisible" | "status"> | null | undefined,
  activePlanId: string | null,
) {
  if (!activePlanId) return "Aktif menu plani yok.";
  if (!plan || plan.id !== activePlanId) return "Disa aktarim yalnizca aktif plan icin kullanilabilir.";
  if (plan.status !== "active") return "Plan henuz aktif degil.";
  if (!plan.exportVisible) return "Plan disa aktarim icin isaretli degil.";
  return null;
}
