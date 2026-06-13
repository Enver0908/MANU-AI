import { AppDomainError } from "./app-errors";
import {
  PHASE_77F_MENU_PLAN_TEMPLATE_LABELS,
  type ClientMenuPlanV1SummarySource,
} from "./phase-77f-client-menu-plan";
import type { ClientMenuPlanV1Record, ClientRecord, Phase77FMenuPlanMealItem, Phase77FMenuPlanMealSlot } from "./types";

export const PHASE_77J_MENU_PLAN_EXPORT_VERSION = "phase-77j-menu-plan-export-v1";
export const TURKISH_EXPORT_SAMPLE = "şğüöçıİ Kahvaltı menüsü";

export const MENU_PLAN_CLIENT_EXPORT_INTERNAL_FIELD_KEYS = [
  "dietitianNotes",
  "catalogVersion",
  "catalogSourceSha256",
  "catalogRecordSetSha256",
  "tenantId",
  "dietitianId",
  "revision",
  "version",
  "conflicts",
  "migratedFromLegacyDietPlan",
] as const;

const DAY_LABELS: Record<string, string> = {
  pzt: "Pazartesi",
  sal: "Sali",
  car: "Carsamba",
  per: "Persembe",
  cum: "Cuma",
  cmt: "Cumartesi",
  paz: "Pazar",
};

export type ClientFacingMenuExportItem = {
  label: string;
  portionNote: string | null;
  recipe: { title: string; ingredients: string[]; instructions: string } | null;
};

export type ClientFacingMenuExportSection = {
  title: string;
  items: ClientFacingMenuExportItem[];
  alternatives: ClientFacingMenuExportItem[];
  exchangeGuidance: string | null;
  weeklyTargetNote: string | null;
};

export type ClientFacingMenuExportDocument = {
  exportVersion: string;
  clientName: string;
  planTitle: string;
  templateLabel: string;
  templateType: ClientMenuPlanV1Record["templateType"];
  effectiveDate: string | null;
  clientFacingNotes: string;
  preferredFoods: string[];
  avoidFoods: string[];
  sections: ClientFacingMenuExportSection[];
};

export type MenuPlanExportOptions = {
  includeRecipes?: boolean;
};

function itemLabel(item: Phase77FMenuPlanMealItem) {
  return item.freeText.trim() || item.catalogMatch?.catalogFoodName || item.label.trim();
}

function toExportItem(item: Phase77FMenuPlanMealItem, includeRecipes: boolean): ClientFacingMenuExportItem {
  return {
    label: itemLabel(item),
    portionNote: item.portionNote.trim() || null,
    recipe:
      includeRecipes && item.recipe && item.recipe.title.trim()
        ? {
            title: item.recipe.title.trim(),
            ingredients: item.recipe.ingredients.filter(Boolean),
            instructions: item.recipe.instructions.trim(),
          }
        : null,
  };
}

function slotTitle(slot: Phase77FMenuPlanMealSlot) {
  const day = slot.dayKey ? DAY_LABELS[slot.dayKey] || slot.dayKey : null;
  return day ? `${day} · ${slot.title}` : slot.title;
}

export function buildClientFacingMenuPlanExportDocument(
  client: Pick<ClientRecord, "fullName">,
  plan: ClientMenuPlanV1Record,
  options: MenuPlanExportOptions = {},
): ClientFacingMenuExportDocument {
  const includeRecipes = options.includeRecipes ?? true;

  return {
    exportVersion: PHASE_77J_MENU_PLAN_EXPORT_VERSION,
    clientName: client.fullName,
    planTitle: plan.title,
    templateLabel: PHASE_77F_MENU_PLAN_TEMPLATE_LABELS[plan.templateType],
    templateType: plan.templateType,
    effectiveDate: plan.effectiveDate,
    clientFacingNotes: plan.clientFacingNotes.trim(),
    preferredFoods: [...plan.preferredFoods],
    avoidFoods: [...plan.avoidFoods],
    sections: plan.mealSlots.map((slot) => ({
      title: slotTitle(slot),
      items: slot.items.map((item) => toExportItem(item, includeRecipes)).filter((item) => item.label),
      alternatives: slot.alternatives.map((item) => toExportItem(item, includeRecipes)).filter((item) => item.label),
      exchangeGuidance: slot.exchangeGuidance.trim() || null,
      weeklyTargetNote: slot.weeklyTargetNote.trim() || null,
    })),
  };
}

export function buildMenuPlanExportPreviewText(document: ClientFacingMenuExportDocument) {
  const lines: string[] = [
    `${document.clientName} · ${document.planTitle}`,
    document.templateLabel,
    TURKISH_EXPORT_SAMPLE,
  ];

  if (document.effectiveDate) lines.push(`Effective: ${document.effectiveDate}`);
  if (document.clientFacingNotes) lines.push(document.clientFacingNotes);

  if (document.templateType === "simple_guidance") {
    if (document.preferredFoods.length > 0) lines.push(`Preferred: ${document.preferredFoods.join(", ")}`);
    if (document.avoidFoods.length > 0) lines.push(`Avoid: ${document.avoidFoods.join(", ")}`);
  }

  for (const section of document.sections) {
    if (section.items.length === 0 && section.alternatives.length === 0) continue;
    lines.push(section.title);
    for (const item of section.items) {
      lines.push(`- ${item.label}${item.portionNote ? ` (${item.portionNote})` : ""}`);
      if (item.recipe) {
        lines.push(`  Recipe: ${item.recipe.title}`);
      }
    }
    for (const item of section.alternatives) {
      lines.push(`- Alt: ${item.label}${item.portionNote ? ` (${item.portionNote})` : ""}`);
    }
    if (section.exchangeGuidance) lines.push(`Exchange: ${section.exchangeGuidance}`);
    if (section.weeklyTargetNote) lines.push(`Weekly: ${section.weeklyTargetNote}`);
  }

  return lines.join("\n");
}

export function menuPlanExportDocumentExcludesInternalFields(document: ClientFacingMenuExportDocument) {
  const serialized = JSON.stringify(document);
  return MENU_PLAN_CLIENT_EXPORT_INTERNAL_FIELD_KEYS.every((key) => !serialized.includes(`"${key}"`));
}

export function resolveMenuPlanExportFilename(
  clientName: string,
  planTitle: string,
  format: "docx" | "pdf",
) {
  const safe = `${clientName}-${planTitle}`
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${safe || "menu-plan"}.${format}`;
}

export function assertMenuPlanExportEligible(plan: ClientMenuPlanV1Record) {
  if (!plan.exportVisible) {
    throw new AppDomainError(409, "menu_plan_export_not_visible");
  }
  if (plan.status !== "active") {
    throw new AppDomainError(409, "menu_plan_not_active");
  }
}

export function deriveMenuPlanExportFromSummarySource(
  client: Pick<ClientRecord, "fullName">,
  plan: ClientMenuPlanV1SummarySource & Pick<ClientMenuPlanV1Record, "templateType" | "effectiveDate" | "preferredFoods" | "avoidFoods" | "exportVisible" | "status">,
  options?: MenuPlanExportOptions,
) {
  return buildClientFacingMenuPlanExportDocument(
    client,
    {
      ...plan,
      id: "preview",
      tenantId: "preview",
      clientId: "preview",
      dietitianId: "preview",
      version: 1,
      revision: 1,
      dietitianNotes: "",
      migratedFromLegacyDietPlan: false,
      catalogVersion: "",
      catalogSourceSha256: "",
      catalogRecordSetSha256: "",
      createdAt: "",
      updatedAt: "",
      activatedAt: null,
      mealSlots: plan.mealSlots,
    },
    options,
  );
}
