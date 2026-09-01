import { expect, type Page } from "@playwright/test";

export async function bootstrapDashboard(page: Page) {
  await page.request.post("/api/app-state");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Operasyon paneli" })).toBeVisible({ timeout: 30_000 });
}

export function visibleShellNavButton(page: Page, name: string | RegExp) {
  const shellNav = page.locator(
    '[data-testid="shell-wide-nav"], [data-testid="shell-medium-rail"], [data-testid="shell-compact-bottom-nav"]',
  );
  return shellNav.getByRole("button", { name }).or(shellNav.getByRole("link", { name })).filter({ visible: true });
}

export async function openVisibleShellNavOrHref(page: Page, name: string | RegExp, href: string) {
  const button = visibleShellNavButton(page, name);
  if (await button.isVisible()) {
    await button.click();
    return;
  }
  await page.evaluate((nextHref) => {
    window.history.pushState(window.history.state, "", nextHref);
    window.dispatchEvent(new Event("manu:dashboard-href-change"));
  }, href);
}

export async function openMessagingSection(page: Page) {
  await visibleShellNavButton(page, /Mesajlaşma|Mesajlar/).click();
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
