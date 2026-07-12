import { expect, test } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  bootstrapDashboard,
  ensureMessagingListVisible,
  openConversation,
  openMessagingSection,
} from "./messaging-visual-helpers";

test.describe.configure({ timeout: 120_000 });

test("messaging controls expose keyboard and layout accessibility contracts", async ({ page }) => {
  await bootstrapDashboard(page);
  await openMessagingSection(page);
  await ensureMessagingListVisible(page);

  const panel = page.getByTestId("messaging-panel");
  await expect(panel.getByRole("tablist")).toBeVisible();
  await expect(panel.getByRole("tab")).toHaveCount(2);
  await expect(panel.locator("input").first()).toBeVisible();

  const firstRow = panel.getByTestId(/^conversation-list-row-/).first();
  await expect(firstRow).toHaveAttribute("aria-label", /.+/);
  await firstRow.focus();
  await expect(firstRow).toBeFocused();
  await assertNoHorizontalOverflow(page);

  await openConversation(page, "conversation-client-mert", "client-mert");
  await expect(page.getByTestId("conversation-panel")).toBeVisible();
  await assertNoHorizontalOverflow(page);

  const isMobile = await page.evaluate(() => window.innerWidth < 768);
  if (isMobile) {
    await expect(page.getByRole("button", { name: /conversation list|liste/i })).toBeVisible();
  }
});
