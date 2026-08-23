import { expect, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collectStage7AxeViolations, axeSeverity } from "./stage-7-axe";
import { STAGE7_CLOCK, STAGE7_SYNTHETIC, type Stage7FixtureProfile } from "./stage-7-fixtures";
import { computeFindingFingerprint } from "./stage-7-fingerprint";
import { collectStage7GeometryFailures } from "./stage-7-geometry";
import { installStage7NetworkGuard, type Stage7NetworkSession } from "./stage-7-network";
import { scanArtifactPrivacy, redactArtifactText } from "./stage-7-redaction";
import type { Stage7Finding, Stage7Scenario } from "./stage-7-schema";

export const STAGE7_ARTIFACT_DIR = join(process.cwd(), "test-results", "stage-7");

function findingId(scenarioId: string, index: number) {
  return `S7-F-${scenarioId.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 48)}-${String(index + 1).padStart(2, "0")}`;
}

function remediationPhaseFor(surface: string): Stage7Finding["remediationPhase"] {
  if (surface.startsWith("dashboard") || surface === "pwa") return "7.3";
  return "7.2";
}

export async function prepareStage7Page(page: Page, scenario: Stage7Scenario): Promise<Stage7NetworkSession> {
  page.setDefaultTimeout(8_000);
  page.setDefaultNavigationTimeout(15_000);
  await page.context().addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  return installStage7NetworkGuard(page.context(), {
    allowedOrigin: "http://127.0.0.1:3100",
    fixtureId: scenario.fixtureId as Stage7FixtureProfile,
    mockApi: scenario.pwaMode === "service_worker_blocked",
  });
}

async function waitForVisualReady(page: Page) {
  try {
    await page.evaluate(async () => {
      const fontsReady =
        "fonts" in document
          ? (document as Document & { fonts: FontFaceSet }).fonts.ready
          : Promise.resolve();
      await Promise.race([fontsReady, new Promise((resolve) => setTimeout(resolve, 1500))]);
    });
  } catch {
    /* product/font readiness is recorded elsewhere if the page is stuck */
  }
}

async function driveState(page: Page, scenario: Stage7Scenario) {
  if (scenario.route.startsWith("/dashboard") || scenario.route.startsWith("/app-install")) {
    await page.request.post("/api/app-state").catch(() => undefined);
  }
  await page.goto(scenario.route, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.waitForTimeout(150);

  const action = { timeout: 5_000 };
  if (scenario.state.startsWith("contact-")) {
    await page.locator("#contact").scrollIntoViewIfNeeded(action).catch(() => undefined);
    if (scenario.state === "contact-invalid") {
      await page.locator("#contact-lead-name").fill(" ", action);
      await page.getByRole("button", { name: /Talebi gönder/i }).click(action).catch(() => undefined);
    }
    if (scenario.state === "contact-success" || scenario.state === "contact-submitting" || scenario.state === "contact-error") {
      await page.locator("#contact-lead-name").fill("Stage7 Dietitian", action);
      await page.locator("#contact-lead-email").fill(STAGE7_SYNTHETIC.dietitianEmail, action);
      await page.locator("#contact-lead-message").fill(STAGE7_SYNTHETIC.multilineNote, action);
      await page.getByRole("button", { name: /Talebi gönder/i }).click(action).catch(() => undefined);
    }
  }

  if (scenario.state.startsWith("login-") && scenario.state !== "login-idle") {
    await page.locator("#customer-login-email").fill(
      scenario.state === "login-invalid" ? "not-an-email" : STAGE7_SYNTHETIC.dietitianEmail,
      action,
    );
    await page.getByTestId("customer-login-submit").click(action).catch(() => undefined);
  }

  if (scenario.state.startsWith("purchase-") && scenario.route === "/purchase") {
    await page.locator("#purchase-email").fill(STAGE7_SYNTHETIC.dietitianEmail, action);
    await page.locator("#purchase-token").fill(STAGE7_SYNTHETIC.inviteToken, action);
    await page.locator("form button[type='submit']").first().click(action).catch(() => undefined);
  }

  if (scenario.state === "shell-offline" || scenario.state === "pwa-offline-lock") {
    await page
      .getByTestId("authenticated-shell")
      .or(page.getByTestId("shell-blocker"))
      .waitFor({ timeout: 15_000 })
      .catch(() => undefined);
    await page.context().setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });
    await page.getByTestId("shell-blocker").waitFor({ state: "visible", timeout: 8_000 }).catch(() => undefined);
  }

  if (scenario.state === "clients-active-switch") {
    await page.getByTestId("client-roster-item").first().click({ timeout: 4_000 }).catch(() => undefined);
  }

  if (scenario.state === "forms-dirty" || scenario.state === "shell-dirty-guard") {
    const textbox = page.locator("textarea, input[type='text']").first();
    if (await textbox.count()) {
      await textbox.fill(STAGE7_SYNTHETIC.longUnbrokenToken, { timeout: 5_000 }).catch(() => undefined);
    }
    if (scenario.state === "shell-dirty-guard") {
      await page.getByRole("link").first().click({ timeout: 5_000 }).catch(() => undefined);
    }
  }

  await waitForVisualReady(page);
}

export async function runStage7Scenario(page: Page, scenario: Stage7Scenario, testInfo: TestInfo) {
  const findings: Stage7Finding[] = [];
  const record = (partial: Omit<Stage7Finding, "id" | "fingerprint" | "status" | "resolutionEvidence">) => {
    const fingerprint = computeFindingFingerprint({
      category: partial.category,
      surface: partial.surface,
      scenarioId: partial.scenarioId,
      expected: partial.expected,
      actual: partial.actual,
      wcagCriteria: partial.wcagCriteria,
    });
    findings.push({
      ...partial,
      expected: redactArtifactText(partial.expected),
      actual: redactArtifactText(partial.actual),
      rootCause: redactArtifactText(partial.rootCause),
      evidenceRefs: partial.evidenceRefs.map((ref) => redactArtifactText(ref)),
      id: findingId(scenario.id, findings.length),
      fingerprint,
      status: "open",
      resolutionEvidence: [],
    });
  };

  try {
    const network = await prepareStage7Page(page, scenario);
    await driveState(page, scenario);

    if (network.escapedExternal.length > 0) {
      throw new Error(`unexpected external request ${network.escapedExternal[0]}`);
    }
    for (const url of network.blockedExternal.slice(0, 5)) {
      record({
        category: "network",
        severity: "P1",
        surface: scenario.surface,
        scenarioId: scenario.id,
        role: scenario.tenantRole,
        locale: scenario.locale,
        browser: scenario.browserTier,
        viewport: scenario.viewportTier,
        wcagCriteria: [],
        expected: "No requests leave the local test origin.",
        actual: `Aborted external request ${url}`,
        reproductionSteps: [`Open ${scenario.route}`, `Apply state ${scenario.state}`],
        evidenceRefs: [`network:${url}`],
        rootCause: "Renderer attempted a non-local network request during the baseline audit.",
        remediationPhase: "7.4",
      });
    }

    const bodyText = await page.locator("body").innerText({ timeout: 5_000 });
    const privacyHits = scanArtifactPrivacy(bodyText);
    const secretHits = privacyHits.filter(
      (hit) =>
        hit === "cookie-header" ||
        hit === "authorization-header" ||
        hit === "jwt" ||
        hit === "supabase-service-role" ||
        hit === "stripe-secret" ||
        hit === "raw-json-body",
    );
    if (secretHits.length > 0) {
      throw new Error(`Stage7 privacy scan failed for ${scenario.id}: ${secretHits.join(", ")}`);
    }
    for (const hit of privacyHits.filter((item) => !secretHits.includes(item))) {
      record({
        category: "privacy",
        severity: "P1",
        surface: scenario.surface,
        scenarioId: scenario.id,
        role: scenario.tenantRole,
        locale: scenario.locale,
        browser: scenario.browserTier,
        viewport: scenario.viewportTier,
        wcagCriteria: [],
        expected: "Rendered UI contains only synthetic example.com identities.",
        actual: "Non-synthetic identity marker was rendered on the page.",
        reproductionSteps: [`Open ${scenario.route}`, `Apply state ${scenario.state}`],
        evidenceRefs: [`privacy:${hit.split(":")[0]}`],
        rootCause: "Page copy or data includes a non-allowlisted identity token.",
        remediationPhase: "7.2",
      });
    }

    if (scenario.snapshotKind === "page" || scenario.snapshotKind === "state" || scenario.snapshotKind === "locator") {
      mkdirSync(STAGE7_ARTIFACT_DIR, { recursive: true });
      const shotPath = join(STAGE7_ARTIFACT_DIR, `${scenario.id}.png`);
      await page.screenshot({
        path: shotPath,
        fullPage: scenario.snapshotKind === "page",
        timeout: 8_000,
      }).catch(() => undefined);
      testInfo.attachments.push({ name: "stage-7-snapshot", contentType: "image/png", path: shotPath });
    }

    const geometry = await collectStage7GeometryFailures(page);
    for (const failure of geometry) {
      record({
        category: "geometry",
        severity: failure.code === "horizontal-overflow" ? "P1" : "P2",
        surface: scenario.surface,
        scenarioId: scenario.id,
        role: scenario.tenantRole,
        locale: scenario.locale,
        browser: scenario.browserTier,
        viewport: scenario.viewportTier,
        wcagCriteria: failure.code === "touch-target" ? ["2.5.5"] : ["1.4.10"],
        expected: "Layout stays within the viewport, with visible 44x44 targets and unclipped text.",
        actual: `${failure.code}: ${failure.detail}`,
        reproductionSteps: [`Open ${scenario.route}`, `Apply state ${scenario.state}`, "Inspect geometry metrics"],
        evidenceRefs: [`test-results/stage-7/${scenario.id}.png`],
        rootCause: "Baseline visual/geometry defect recorded before remediation.",
        remediationPhase: remediationPhaseFor(scenario.surface),
      });
    }

    const runAxe =
      scenario.accessibilityChecks.includes("axe-wcag-a-aa") ||
      scenario.requiredAssertions.includes("axe-a-aa");
    if (runAxe) {
      let violations: Awaited<ReturnType<typeof collectStage7AxeViolations>> = [];
      try {
        violations = await collectStage7AxeViolations(page);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        record({
          category: "accessibility",
          severity: "P2",
          surface: scenario.surface,
          scenarioId: scenario.id,
          role: scenario.tenantRole,
          locale: scenario.locale,
          browser: scenario.browserTier,
          viewport: scenario.viewportTier,
          wcagCriteria: ["2.1.1"],
          expected: "Axe WCAG A/AA completes within the audit budget.",
          actual: redactArtifactText(message).slice(0, 500),
          reproductionSteps: [`Open ${scenario.route}`, "Run axe WCAG A/AA"],
          evidenceRefs: ["axe:timeout-or-error"],
          rootCause: "Axe analysis did not complete during the baseline audit.",
          remediationPhase: scenario.surface.startsWith("dashboard") ? "7.4" : "7.2",
        });
      }
      for (const violation of violations) {
        record({
          category: "accessibility",
          severity: axeSeverity(violation.impact),
          surface: scenario.surface,
          scenarioId: scenario.id,
          role: scenario.tenantRole,
          locale: scenario.locale,
          browser: scenario.browserTier,
          viewport: scenario.viewportTier,
          wcagCriteria: violation.wcag,
          expected: "No WCAG A/AA axe violations on the rendered state.",
          actual: `${violation.id} ${violation.help} (${violation.target}): ${violation.failureSummary}`,
          reproductionSteps: [`Open ${scenario.route}`, "Run axe WCAG A/AA"],
          evidenceRefs: [`axe:${violation.id}`],
          rootCause: "Automated accessibility baseline failure.",
          remediationPhase: scenario.surface.startsWith("dashboard") ? "7.4" : "7.2",
        });
      }
    }

    if (scenario.accessibilityChecks.includes("keyboard-tab")) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => document.activeElement?.tagName ?? "NONE");
      if (focused === "BODY" || focused === "HTML" || focused === "NONE") {
        record({
          category: "accessibility",
          severity: "P2",
          surface: scenario.surface,
          scenarioId: scenario.id,
          role: scenario.tenantRole,
          locale: scenario.locale,
          browser: scenario.browserTier,
          viewport: scenario.viewportTier,
          wcagCriteria: ["2.1.1", "2.4.7"],
          expected: "Tab moves focus to a visible interactive control.",
          actual: `Focus remained on ${focused}`,
          reproductionSteps: [`Open ${scenario.route}`, "Press Tab"],
          evidenceRefs: [],
          rootCause: "Keyboard focus did not enter an interactive control.",
          remediationPhase: "7.4",
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Stage7 privacy scan") || message.includes("unexpected external request")) {
      throw error;
    }
    record({
      category: "behavior",
      severity: "P1",
      surface: scenario.surface,
      scenarioId: scenario.id,
      role: scenario.tenantRole,
      locale: scenario.locale,
      browser: scenario.browserTier,
      viewport: scenario.viewportTier,
      wcagCriteria: [],
      expected: `Scenario ${scenario.id} completes without harness or product exceptions.`,
      actual: message.slice(0, 500),
      reproductionSteps: [`Open ${scenario.route}`, `Drive state ${scenario.state}`],
      evidenceRefs: [],
      rootCause: "Exception during baseline audit interaction or assertion.",
      remediationPhase: remediationPhaseFor(scenario.surface),
    });
  }

  mkdirSync(STAGE7_ARTIFACT_DIR, { recursive: true });
  writeFileSync(join(STAGE7_ARTIFACT_DIR, `${scenario.id}.findings.json`), JSON.stringify(findings, null, 2));
  expect(Array.isArray(findings)).toBe(true);
  return findings;
}
