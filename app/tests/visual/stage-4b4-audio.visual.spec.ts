import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow, bootstrapDashboard, openMessagingSection } from "./messaging-visual-helpers";

test.describe.configure({ timeout: 120_000 });

for (const viewport of [
  { width: 1440, height: 900, name: "desktop" },
  { width: 1024, height: 768, name: "tablet" },
  { width: 390, height: 844, name: "ios-mobile" },
  { width: 412, height: 915, name: "android-mobile" },
] as const) {
  test(`conversation panel renders without overflow on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await bootstrapDashboard(page);
    await openMessagingSection(page);
    await expect(page.getByTestId("messaging-panel")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
}
