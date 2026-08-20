import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openMessagingSection } from "./messaging-visual-helpers";

test.describe.configure({ timeout: 120_000 });

function visibleTestId(page: Page, testId: string) {
  return page.locator(`[data-testid="${testId}"]:visible`);
}

async function assertAxeClean(page: Page, context: string) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = result.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  const summary = blocking.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    targets: violation.nodes.map((node) => node.target.join(" ")),
  }));
  expect(summary, `${context}: ${JSON.stringify(summary, null, 2)}`).toEqual([]);
}

async function openWorkspace(page: Page) {
  await page.request.post("/api/app-state");
  await page.goto("/dashboard?section=clients");
  await expect(page.getByTestId("client-roster")).toBeVisible();
  await page.getByTestId("client-roster-item").filter({ hasText: "Mert Kaya" }).click();
  await expect(page.getByTestId("client-workspace-header")).toBeVisible();
}

test("dashboard home and client roster are WCAG 2.2 AA blocking-violation clean", async ({ page }) => {
  await page.request.post("/api/app-state");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Operasyon paneli" })).toBeVisible();
  await assertAxeClean(page, "dashboard home");

  await page.goto("/dashboard?section=clients");
  await expect(page.getByTestId("client-roster")).toBeVisible();
  await assertAxeClean(page, "client roster");
});

const clientTasks = [
  { name: "forms", testId: "tab-tab_personal_form", panel: "client-form-panel" },
  { name: "nutrition", testId: "tab-tab_food_rules", panel: "active-nutrition-plan-panel" },
  { name: "menu", testId: "tab-tab_menu", panel: "menu-workflow-panel" },
  { name: "AI controls", testId: "tab-tab_ai_assistant", panel: "ai-assistant-control-panel" },
];

for (const task of clientTasks) {
  test(`${task.name} task is keyboard reachable and axe-clean`, async ({ page }) => {
    await openWorkspace(page);
    const trigger = visibleTestId(page, task.testId);
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId(task.panel)).toBeVisible();
    await assertAxeClean(page, task.panel);
  });
}

test("messaging, alerts, and notifications are axe-clean", async ({ page }) => {
  await page.request.post("/api/app-state");
  await page.goto("/dashboard");
  await openMessagingSection(page);
  await expect(page.getByTestId("messaging-panel")).toBeVisible();
  await assertAxeClean(page, "messaging");

  await page.goto("/dashboard?section=alerts");
  await expect(page.getByTestId("alerts-panel")).toBeVisible();
  await assertAxeClean(page, "alerts");

  await page.goto("/dashboard?section=notifications");
  await expect(page.getByTestId("notifications-panel")).toBeVisible();
  await assertAxeClean(page, "notifications");
});
