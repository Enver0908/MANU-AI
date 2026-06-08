import { expect, test } from "@playwright/test";

test("dashboard core views render in fallback mode", async ({ page }) => {
  await page.request.post("/api/app-state");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dietitian messaging operations console" })).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Operations dashboard" })).toBeVisible();
  await expect(page.getByText("PWA ready")).toBeVisible();

  await page.getByRole("button", { name: "Clients" }).click();
  await expect(page.getByRole("heading", { name: "Mert Kaya" })).toBeVisible();
  await expect(page.getByText("Safety checklist")).toBeVisible();

  await page.getByRole("button", { name: "Conversation" }).click();
  await expect(page.getByText("Conversation timeline with origin labels")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save manual reply" })).toBeVisible();

  await page.getByRole("button", { name: "Simulator" }).click();
  await expect(page.getByRole("heading", { name: "Inbound simulator" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run inbound flow" })).toBeVisible();

  await page.getByLabel("Client").selectOption({ label: "Elif Demir" });
  await page.getByLabel("Idempotency key").fill(`visual-yellow-${Date.now()}`);
  await page.getByLabel("Inbound message").fill("D vitamini takviyesi kullanayim mi?");
  await page.getByRole("button", { name: "Run inbound flow" }).click();
  await expect(page.getByText("draft_for_approval")).toBeVisible();

  await page.getByRole("button", { name: "Conversation" }).click();
  await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit & send" })).toBeVisible();

  await page.getByLabel("Reply body").fill(
    "BuCokUzunTekKelimeTasmasiniKontrolEtmekIcinYazildiBuCokUzunTekKelimeTasmasiniKontrolEtmekIcinYazildi",
  );
  await page.getByRole("button", { name: "Save manual reply" }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);

  await page.getByRole("button", { name: "Simulator" }).click();
  await page.getByLabel("Client").selectOption({ label: "Mert Kaya" });
  await page.getByLabel("Idempotency key").fill(`visual-red-${Date.now()}`);
  await page.getByLabel("Inbound message").fill("Alerjiden nefes alamiyorum, bogazim sisti.");
  await page.getByRole("button", { name: "Run inbound flow" }).click();
  await expect(page.getByText("handoff").first()).toBeVisible();

  await page.getByRole("button", { name: "Clients" }).click();
  await page.getByRole("button", { name: /Mert Kaya/ }).click();
  await page.getByLabel("Diet plan reviewed").click();
  await expect(page.getByLabel("Diet plan reviewed")).not.toBeChecked();

  await page.getByRole("button", { name: "Simulator" }).click();
  await page.getByLabel("Client").selectOption({ label: "Mert Kaya" });
  await page.getByLabel("Idempotency key").fill(`visual-safety-${Date.now()}`);
  await page.getByLabel("Inbound message").fill("Bugun kahvaltida ne yiyebilirim?");
  await page.getByRole("button", { name: "Run inbound flow" }).click();
  await expect(page.getByText("mandatory_safety_fields_missing")).toBeVisible();

  await page.getByRole("button", { name: "Handoffs" }).click();
  await expect(page.getByRole("heading", { name: "Handoff queue" })).toBeVisible();
  await expect(page.getByText("possible_severe_allergic_reaction")).toBeVisible();

  await page.getByRole("button", { name: "Forms" }).click();
  await expect(page.getByTestId("food-rules-panel")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Structured food rules" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);
});
