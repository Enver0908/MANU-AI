import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

async function bootstrapAiChat(page: Page) {
  await page.request.post("/api/app-state");
}

async function isCompactViewport(page: Page) {
  const viewport = page.viewportSize();
  return !viewport || viewport.width < 1024;
}

async function openHistorySurface(page: Page) {
  if (await isCompactViewport(page)) {
    await page.getByTestId("ai-chat-history-drawer-toggle").click();
  }
  return page.getByTestId("ai-chat-history-sidebar");
}

test("keyboard navigation reaches history, composer, and focus toggle", async ({ page }) => {
  await bootstrapAiChat(page);
  await page.goto("/dashboard/ai-chat");
  await expect(page.getByTestId("ai-chat-workspace")).toBeVisible();

  await page.keyboard.press("Tab");
  const focusedTestId = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
  expect(focusedTestId).toBeTruthy();

  await expect(page.getByTestId("ai-chat-composer")).toBeVisible();
  const composerInput = page.getByTestId("ai-chat-composer").getByRole("textbox");
  await composerInput.focus();
  await composerInput.fill("Klavye erisilebilirlik testi");
  await expect(composerInput).toHaveValue(/Klavye erisilebilirlik testi/);
});

test("new chat modal announces dialog semantics and traps focus", async ({ page }) => {
  await bootstrapAiChat(page);
  await page.goto("/dashboard/ai-chat");
  if (await isCompactViewport(page)) {
    await page.getByTestId("ai-chat-history-drawer-toggle").click();
  }
  await page.getByTestId("ai-chat-new-chat-button").first().click();

  const dialog = page.getByTestId("ai-chat-client-picker");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("role", "dialog");
  await expect(dialog).toHaveAttribute("aria-modal", "true");

  await page.keyboard.press("Shift+Tab");
  const focusStaysInsideDialog = await page.evaluate(
    () => document.activeElement?.closest('[data-testid="ai-chat-client-picker"]') !== null,
  );
  expect(focusStaysInsideDialog).toBe(true);
});

test("history drawer exposes alert semantics for fail-closed error state", async ({ page }) => {
  await bootstrapAiChat(page);
  await page.goto("/dashboard/ai-chat");
  const sidebar = await openHistorySurface(page);
  const alert = sidebar.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Tekrar dene" })).toBeVisible();
});

test("focus mode route hides shell navigation for screen-reader landmarks", async ({ page }) => {
  await bootstrapAiChat(page);
  await page.goto("/dashboard/ai-chat?focus=1");
  await expect(page.getByTestId("ai-chat-workspace")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Panel görünümleri" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Mobil navigasyon" })).toHaveCount(0);
});

test("AI Chat workspace has no serious or critical accessibility violations", async ({ page }) => {
  await bootstrapAiChat(page);
  await page.goto("/dashboard/ai-chat");
  await expect(page.getByTestId("ai-chat-workspace")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
});

test("history and context drawers remain mutually exclusive on compact viewports", async ({ page }) => {
  test.skip(!(await isCompactViewport(page)), "drawer mutual exclusion is a compact-viewport-only contract");
  await bootstrapAiChat(page);
  await page.goto("/dashboard/ai-chat");

  await page.getByTestId("ai-chat-history-drawer-toggle").click();
  await expect(page.getByTestId("ai-chat-history-drawer")).toBeVisible();
  await expect(page.getByTestId("ai-chat-context-drawer")).toHaveCount(0);

  await page.getByTestId("ai-chat-drawer-backdrop").click();
  await expect(page.getByTestId("ai-chat-history-drawer")).toHaveCount(0);

  await page.getByTestId("ai-chat-context-drawer-toggle").click();
  await expect(page.getByTestId("ai-chat-context-drawer")).toBeVisible();
  await expect(page.getByTestId("ai-chat-history-drawer")).toHaveCount(0);
});
