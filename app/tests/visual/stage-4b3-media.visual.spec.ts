import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow, assertRemovedProductionChrome, bootstrapDashboard } from "./messaging-visual-helpers";

test.describe.configure({ timeout: 120_000 });

test("retired visual simulator surface is not reachable from dashboard navigation", async ({ page }) => {
  await bootstrapDashboard(page);
  await assertRemovedProductionChrome(page);

  await page.goto("/dashboard?section=simulator");
  await expect(page).toHaveURL(/\/dashboard\/?$/);
  await expect(page.getByTestId("visual-simulator-panel")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Görsel simülatörü" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Günlük iş girişi" })).toBeVisible();
  await assertNoHorizontalOverflow(page);
});
