import { expect, type Page } from "@playwright/test";

export async function bootstrapDashboard(page: Page) {
  await page.request.post("/api/app-state");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Operasyon paneli" })).toBeVisible({ timeout: 30_000 });
}

export async function openMessagingSection(page: Page) {
  const messagingNav = page.getByRole("button", { name: "Mesajlaşma" });
  if ((await messagingNav.count()) > 1) {
    await messagingNav.last().click();
  } else {
    await messagingNav.click();
  }
  await expect(page.getByTestId("messaging-panel")).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => {
      if (await page.getByTestId("conversation-panel").isVisible()) return true;
      return page.getByTestId(/^conversation-list-row-/).first().isVisible();
    })
    .toBe(true);
}

export async function ensureMessagingListVisible(page: Page) {
  if (await page.getByTestId(/^conversation-list-row-/).first().isVisible()) {
    return;
  }
  await page.goto("/dashboard?section=messages");
  await expect(page.getByTestId("messaging-panel")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId(/^conversation-list-row-/).first()).toBeVisible({ timeout: 30_000 });
}

export function conversationComposerInput(page: Page) {
  return page.getByLabel("Yanıt metni", { exact: true }).locator("visible=true");
}

export async function openConversation(
  page: Page,
  conversationId: string,
  clientId = conversationId.replace(/^conversation-/, ""),
) {
  const panel = page.getByTestId("conversation-panel");
  if (page.url().includes(conversationId) && (await panel.isVisible())) {
    return;
  }

  const detailResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes(`/api/conversations/${encodeURIComponent(conversationId)}/messages`) &&
      response.ok(),
    { timeout: 30_000 },
  );

  const row = page.getByTestId(`conversation-list-row-${conversationId}`);
  if (await row.isVisible()) {
    await row.click();
  } else {
    await page.goto(`/dashboard?section=messages&clientId=${clientId}&conversationId=${conversationId}`);
  }

  await expect(page).toHaveURL(new RegExp(`conversationId=${conversationId}`), { timeout: 15_000 });
  await detailResponsePromise;
  await expect(panel).toBeVisible({ timeout: 30_000 });
}

export async function assertNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);
}
