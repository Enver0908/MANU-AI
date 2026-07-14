import { expect, test, type Page } from "@playwright/test";
import { assertNoHorizontalOverflow, bootstrapDashboard } from "./messaging-visual-helpers";

test.describe.configure({ timeout: 120_000 });

async function openSimulatorSection(page: Page) {
  const simulatorNav = page.getByRole("button", { name: "Simülatör", exact: true });
  if ((await simulatorNav.count()) > 1) {
    await simulatorNav.last().click();
  } else {
    await simulatorNav.click();
  }
  await expect(page.getByRole("heading", { name: "Gelen mesaj simülatörü" })).toBeVisible({ timeout: 30_000 });
}

function visualRunButton(page: Page) {
  return page.getByRole("button", { name: /Görsel akışı çalıştır/i }).last();
}

test("visual simulator panel renders and runs fixture flow without overflow", async ({ page }) => {
  await bootstrapDashboard(page);
  await openSimulatorSection(page);

  const visualPanel = page.getByTestId("visual-simulator-panel");
  await expect(visualPanel).toBeVisible();
  await expect(visualPanel.getByRole("heading", { name: "Görsel simülatörü" })).toBeVisible();
  await expect(visualPanel.getByLabel("Fixture sahnesi")).toBeVisible();
  await expect(visualPanel.getByLabel("Görsel istek anahtarı")).toBeVisible();

  await visualPanel.getByLabel("Görsel istek anahtarı").fill(`visual-4b3-${Date.now()}`);
  await visualPanel.getByLabel("Fixture sahnesi").selectOption("meal_plate");
  await visualPanel.getByLabel("Caption (isteğe bağlı)").fill("Izgara tavuk");
  await visualPanel.getByLabel("Ardışık metinler (her satır bir mesaj)").fill("Afiyet olsun");
  await visualPanel.getByRole("checkbox", { name: /120 saniyelik sessizliği anında tamamla/i }).check();

  const runVisualButton = visualRunButton(page);
  await expect(runVisualButton).toBeVisible();
  const buttonBox = await runVisualButton.boundingBox();
  expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  await runVisualButton.click();
  await expect(page.getByText(/Son sonuç|draft|handoff|review|stored|bundle/i).first()).toBeVisible({ timeout: 30_000 });

  await assertNoHorizontalOverflow(page);
});
