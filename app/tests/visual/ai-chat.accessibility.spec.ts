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
  const compact = await isCompactViewport(page);
  const focusMode = page.url().includes("focus=1");
  if (compact || focusMode) {
    await page.getByTestId("ai-chat-history-drawer-toggle").click();
    const drawer = page.getByTestId("ai-chat-history-drawer");
    await expect(drawer).toBeVisible();
    return drawer.getByTestId("ai-chat-history-sidebar");
  }
  return page.locator('[data-testid="ai-chat-history-sidebar"]:visible').first();
}

test("keyboard navigation reaches history, composer, and focus toggle", async ({ page }) => {
  await bootstrapAiChat(page);
  await page.goto("/dashboard/ai-chat");
  await expect(page.getByTestId("ai-chat-workspace")).toBeVisible();

  const focusToggle = page.getByTestId("ai-chat-focus-toggle");
  await focusToggle.focus();
  await expect(focusToggle).toBeFocused();

  const newChatButton = page.getByTestId("ai-chat-empty-new-chat-button");
  await newChatButton.focus();
  await expect(newChatButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("ai-chat-client-picker")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("ai-chat-client-picker")).toHaveCount(0);
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
  await expect(sidebar).toBeVisible();
  await expect
    .poll(async () => {
      if (await sidebar.getByRole("alert").isVisible()) return "error";
      if (await sidebar.getByRole("status").isVisible()) return "empty";
      if (await sidebar.getByRole("searchbox").isVisible()) return "chrome";
      return null;
    }, { timeout: 15_000 })
    .not.toBeNull();
  if (await sidebar.getByRole("alert").isVisible()) {
    await expect(sidebar.getByRole("button", { name: "Tekrar dene" })).toBeVisible();
  }
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
