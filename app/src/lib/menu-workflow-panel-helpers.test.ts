import { describe, expect, it } from "vitest";
import {
  formatMenuPlanStatusLabel,
  getMenuExportBlockReason,
  hasHardMenuPlanConflicts,
  isMenuExportEligible,
  summarizeMenuWorkflow,
} from "./menu-workflow-panel-helpers";
import type { ClientMenuPlanV1State } from "./phase-77f-client-menu-plan";

function buildPlan(partial: Partial<ClientMenuPlanV1State> & Pick<ClientMenuPlanV1State, "id" | "templateType">): ClientMenuPlanV1State {
  return {
    id: partial.id,
    templateType: partial.templateType,
    title: partial.title || "Plan",
    status: partial.status || "draft",
    revision: partial.revision || 1,
    exportVisible: partial.exportVisible ?? true,
    mealSlots: partial.mealSlots || [],
    preferredFoods: partial.preferredFoods || [],
    avoidFoods: partial.avoidFoods || [],
    dietitianNotes: partial.dietitianNotes || "",
    clientFacingNotes: partial.clientFacingNotes || "",
    effectiveDate: partial.effectiveDate || null,
    conflicts: partial.conflicts || [],
  } as ClientMenuPlanV1State;
}

describe("menu workflow panel helpers", () => {
  it("summarizes plan counts and template coverage", () => {
    const plans = [
      buildPlan({ id: "plan-1", templateType: "day_by_day_detailed", status: "active" }),
      buildPlan({ id: "plan-2", templateType: "simple_guidance", status: "draft", conflicts: [{ code: "menu_item_forbidden_food", message: "x" }] }),
    ];
    const summary = summarizeMenuWorkflow(plans, "plan-1");
    expect(summary.totalPlans).toBe(2);
    expect(summary.hasActivePlan).toBe(true);
    expect(summary.conflictCount).toBe(1);
    expect(summary.templateTypes).toHaveLength(4);
  });

  it("detects export eligibility from active visible plan", () => {
    const plan = {
      id: "plan-1",
      status: "active" as const,
      exportVisible: true,
    };
    expect(isMenuExportEligible(plan, "plan-1")).toBe(true);
    expect(isMenuExportEligible({ ...plan, exportVisible: false }, "plan-1")).toBe(false);
    expect(getMenuExportBlockReason({ ...plan, exportVisible: false }, "plan-1")).toContain("isaretli degil");
  });

  it("blocks activation on hard menu conflicts only", () => {
    expect(
      hasHardMenuPlanConflicts([
        { code: "menu_item_forbidden_food", message: "blocked" },
        { code: "menu_preferred_conflicts_with_forbidden", message: "warning" },
      ]),
    ).toBe(true);
    expect(
      hasHardMenuPlanConflicts([{ code: "menu_preferred_conflicts_with_forbidden", message: "warning" }]),
    ).toBe(false);
  });

  it("formats plan status labels", () => {
    expect(formatMenuPlanStatusLabel({ status: "draft" }, "plan-2", "plan-1")).toBe("Taslak");
    expect(formatMenuPlanStatusLabel({ status: "draft" }, "plan-1", "plan-1")).toBe("Aktif");
    expect(formatMenuPlanStatusLabel({ status: "archived" }, null, "plan-1")).toBe("Arsiv");
  });
});
