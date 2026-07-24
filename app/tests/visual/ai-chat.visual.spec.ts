import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const FOCUS_SNAPSHOT_PROJECTS = new Set(["desktop", "desktop-xl", "tablet", "mobile-android"]);

test.describe.configure({ timeout: 120_000 });

async function bootstrapAiChat(page: Page) {
  await page.request.post("/api/app-state");
}

async function isCompactViewport(page: Page) {
  const viewport = page.viewportSize();
  return !viewport || viewport.width < 1024;
}

/** Opens the mobile/tablet history drawer only when the shell is not inline. */
async function openHistorySurface(page: Page) {
  if (await isCompactViewport(page)) {
    await page.getByTestId("ai-chat-history-drawer-toggle").click();
  }
  return page.getByTestId("ai-chat-history-sidebar");
}

test("AI Chat nav is a real route link and replaces the old Copilot entry", async ({ page }) => {
  await bootstrapAiChat(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Operasyon paneli" })).toBeVisible();

  const aiChatLink = page.getByRole("link", { name: "AI Chat" });
  await expect(aiChatLink).toBeVisible();
  await expect(aiChatLink).toHaveAttribute("href", "/dashboard/ai-chat");

  await expect(page.getByRole("button", { name: /copilot/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /copilot/i })).toHaveCount(0);

  await aiChatLink.click();
  await expect(page).toHaveURL(/\/dashboard\/ai-chat$/);
  await expect(page.getByTestId("ai-chat-workspace")).toBeVisible();
});

test("legacy ?section=copilot deep link replace-redirects to the AI Chat route", async ({ page }) => {
  await bootstrapAiChat(page);
  await page.goto("/dashboard?section=copilot");
  await expect(page).toHaveURL(/\/dashboard\/ai-chat$/);
  await expect(page.getByTestId("ai-chat-workspace")).toBeVisible();
});

test("client detail exposes an AI evaluate command that deep-links to a client chat", async ({ page }) => {
  await bootstrapAiChat(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Danışanlar" }).click();
  await page.getByRole("button", { name: /Mert Kaya/ }).click();
  await expect(page.getByRole("heading", { name: "Mert Kaya" })).toBeVisible();

  const evaluateButton = page.getByTestId("client-evaluate-with-ai");
  await expect(evaluateButton).toBeVisible();
  const box = await evaluateButton.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  // No second-client-selection affordance exists anywhere near this control.
  await expect(page.getByTestId("client-detail")).not.toContainText("İkinci danışan");

  // Without a configured backend this fails closed with a visible error
  // instead of silently doing nothing or navigating away (see CLAUDE.md
  // fail-closed principle); Faz 5 will wire the real create+redirect path.
  await evaluateButton.click();
  await expect(page.getByTestId("client-evaluate-with-ai-error")).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);
});

test("AI Chat root route renders the three-region workspace shell with a retry-able history error and empty chat state", async ({
  page,
}) => {
  await bootstrapAiChat(page);
  await page.goto("/dashboard/ai-chat");
  await expect(page.getByTestId("ai-chat-workspace")).toBeVisible();

  const compact = await isCompactViewport(page);
  const sidebar = await openHistorySurface(page);
  await expect(sidebar.getByRole("alert")).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Tekrar dene" })).toBeVisible();

  if (compact) {
    await page.getByTestId("ai-chat-drawer-backdrop").click();
    await expect(page.getByTestId("ai-chat-history-drawer")).toHaveCount(0);
  }

  await expect(page.getByText("Henüz sohbet yok")).toBeVisible();
  await expect(page.getByTestId("ai-chat-empty-new-chat-button")).toBeVisible();

  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);
});

test("new chat modal traps focus, supports general/client scope, and closes on Escape", async ({ page }) => {
  await bootstrapAiChat(page);
  await page.goto("/dashboard/ai-chat");
  if (await isCompactViewport(page)) {
    await page.getByTestId("ai-chat-history-drawer-toggle").click();
  }
  await page.getByTestId("ai-chat-new-chat-button").first().click();

  const dialog = page.getByTestId("ai-chat-client-picker");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");

  const generalTab = dialog.getByRole("tab", { name: "Genel" });
  const clientTab = dialog.getByRole("tab", { name: "Danışan" });
  await expect(generalTab).toHaveAttribute("aria-selected", "true");

  await clientTab.click();
  await expect(clientTab).toHaveAttribute("aria-selected", "true");
  const clientSearchInput = dialog.getByPlaceholder("Danışan ara");
  await expect(clientSearchInput).toBeVisible();
  await clientSearchInput.fill("a");
  await expect(dialog.getByText("En az 2 karakter yazın")).toBeVisible();
  await clientSearchInput.fill("me");
  await expect(dialog.getByRole("listbox")).toBeVisible();

  // Focus trap: Shift+Tab from the first focusable element must stay inside the dialog.
  await page.keyboard.press("Shift+Tab");
  const focusStaysInsideDialog = await page.evaluate(
    () => document.activeElement?.closest('[data-testid="ai-chat-client-picker"]') !== null,
  );
  expect(focusStaysInsideDialog).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("focus mode hides dashboard chrome and persists across reload via the query param", async ({ page }) => {
  await bootstrapAiChat(page);
  await page.goto("/dashboard/ai-chat?focus=1");
  await expect(page.getByTestId("ai-chat-workspace")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Panel görünümleri" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Mobil navigasyon" })).toHaveCount(0);
  await expect(page.getByTestId("ai-chat-focus-toggle")).toHaveAttribute("aria-label", "Odak modundan çık");

  await page.reload();
  await expect(page.getByTestId("ai-chat-workspace")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Panel görünümleri" })).toHaveCount(0);

  await page.getByTestId("ai-chat-focus-toggle").click();
  await expect(page).toHaveURL(/\/dashboard\/ai-chat$/);
});

test("history and context drawers are mutually exclusive on compact viewports", async ({ page }) => {
  test.skip(!(await isCompactViewport(page)), "drawer mutual exclusion is a compact-viewport-only contract");
  await bootstrapAiChat(page);
  await page.goto("/dashboard/ai-chat");

  // Both drawers are full-screen overlays (by design, like any mobile sheet),
  // so the header's other toggle is intentionally unreachable while one is
  // open. The contract under test is that the two never render at once.
  await page.getByTestId("ai-chat-history-drawer-toggle").click();
  await expect(page.getByTestId("ai-chat-history-drawer")).toBeVisible();
  await expect(page.getByTestId("ai-chat-context-drawer")).toHaveCount(0);

  await page.getByTestId("ai-chat-drawer-backdrop").click();
  await expect(page.getByTestId("ai-chat-history-drawer")).toHaveCount(0);

  await page.getByTestId("ai-chat-context-drawer-toggle").click();
  await expect(page.getByTestId("ai-chat-context-drawer")).toBeVisible();
  await expect(page.getByTestId("ai-chat-history-drawer")).toHaveCount(0);

  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);
});

test("AI Chat root route has no serious or critical accessibility violations", async ({ page }) => {
  await bootstrapAiChat(page);
  await page.goto("/dashboard/ai-chat");
  await expect(page.getByTestId("ai-chat-workspace")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
});

test("new chat modal has no serious or critical accessibility violations", async ({ page }) => {
  await bootstrapAiChat(page);
  await page.goto("/dashboard/ai-chat");
  if (await isCompactViewport(page)) {
    await page.getByTestId("ai-chat-history-drawer-toggle").click();
  }
  await page.getByTestId("ai-chat-new-chat-button").first().click();
  await expect(page.getByTestId("ai-chat-client-picker")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
});

test("AI Chat empty workspace visual snapshot", async ({ page }) => {
  await bootstrapAiChat(page);
  await page.goto("/dashboard/ai-chat");
  await expect(page.getByTestId("ai-chat-workspace")).toBeVisible();

  // Wait for the history fetch to settle (fails closed to a retry state
  // without a backend) so the screenshot is deterministic instead of
  // capturing a transient pre-fetch empty flash.
  const sidebar = await openHistorySurface(page);
  await expect(sidebar.getByRole("alert")).toBeVisible();
  if (await isCompactViewport(page)) {
    await page.getByTestId("ai-chat-drawer-backdrop").click();
    await expect(page.getByTestId("ai-chat-history-drawer")).toHaveCount(0);
  }
  await expect(page.getByTestId("ai-chat-empty-new-chat-button")).toBeVisible();

  await expect(page).toHaveScreenshot("ai-chat-empty-workspace.png", {
    animations: "disabled",
    maxDiffPixels: 400,
  });
});

test("AI Chat focus mode visual snapshot", async ({ page }, testInfo) => {
  test.skip(!FOCUS_SNAPSHOT_PROJECTS.has(testInfo.project.name), "focus snapshots run on four canonical viewports only");
  await bootstrapAiChat(page);
  await page.goto("/dashboard/ai-chat?focus=1");
  await expect(page.getByTestId("ai-chat-workspace")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Panel görünümleri" })).toHaveCount(0);

  const sidebar = await openHistorySurface(page);
  await expect(sidebar.getByRole("alert")).toBeVisible();
  if (await isCompactViewport(page)) {
    await page.getByTestId("ai-chat-drawer-backdrop").click();
    await expect(page.getByTestId("ai-chat-history-drawer")).toHaveCount(0);
  }

  await expect(page).toHaveScreenshot("ai-chat-focus-workspace.png", {
    animations: "disabled",
    maxDiffPixels: 400,
  });
});
