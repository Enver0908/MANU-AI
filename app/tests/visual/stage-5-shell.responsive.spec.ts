import { expect, test, type Page } from "@playwright/test";
import { STAGE5_SHELL_OVERFLOW_FIXTURES } from "../../src/lib/phase-85-stage-5-shell-i18n";

test.describe.configure({ timeout: 120_000 });

async function bootstrapDashboard(page: Page) {
  await page.request.post("/api/app-state");
  await page.goto("/dashboard");
  await expect(page.getByTestId("authenticated-shell").or(page.getByTestId("shell-blocker"))).toBeVisible({
    timeout: 30_000,
  });
}

async function assertNoHorizontalPageScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("320px reflow keeps shell without horizontal page scroll", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await bootstrapDashboard(page);
  if (await page.getByTestId("shell-blocker").isVisible()) {
    test.skip(true, "Shell blocked in this environment.");
  }
  await assertNoHorizontalPageScroll(page);
});

test("200% text zoom keeps shell content readable without page-wide horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootstrapDashboard(page);
  if (await page.getByTestId("shell-blocker").isVisible()) {
    test.skip(true, "Shell blocked in this environment.");
  }
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await assertNoHorizontalPageScroll(page);
});

test("portrait and landscape orientations keep shell usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootstrapDashboard(page);
  if (await page.getByTestId("shell-blocker").isVisible()) {
    test.skip(true, "Shell blocked in this environment.");
  }
  await assertNoHorizontalPageScroll(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await assertNoHorizontalPageScroll(page);
});

test("reduced-motion preference does not hide skip link or blockers", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await bootstrapDashboard(page);
  await expect(page.locator(".skip-link").or(page.getByTestId("shell-blocker"))).toHaveCount(1);
});

test("tr/de/pt long-label fixtures do not force single-line overflow in measured chrome", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await bootstrapDashboard(page);
  if (await page.getByTestId("shell-blocker").isVisible()) {
    test.skip(true, "Shell blocked in this environment.");
  }

  for (const language of ["tr", "de", "pt"] as const) {
    const labels = Object.values(STAGE5_SHELL_OVERFLOW_FIXTURES[language]);
    const maxWidth = await page.evaluate((items) => {
      const probe = document.createElement("div");
      probe.style.cssText =
        "position:fixed;left:0;top:0;width:320px;overflow:hidden;font:14px/1.4 system-ui;visibility:hidden";
      document.body.appendChild(probe);
      let widest = 0;
      for (const text of items) {
        probe.textContent = text;
        widest = Math.max(widest, probe.scrollWidth);
      }
      probe.remove();
      return widest;
    }, labels);
    // Labels may wrap; scrollWidth of a constrained box should stay near the viewport width.
    expect(maxWidth).toBeLessThanOrEqual(320);
  }
});
