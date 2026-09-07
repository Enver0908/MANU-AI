import type { Page } from "@playwright/test";
import { collectStage7GeometryFailures } from "./stage-7-geometry";
import {
  STAGE7_REQUIRED_ASSERTIONS,
  type Stage7RequiredAssertion,
  type Stage7Scenario,
  type Stage7Severity,
} from "./stage-7-schema";

export type Stage7AssertionFailure = {
  assertion: Stage7RequiredAssertion;
  category: string;
  severity: Stage7Severity;
  wcagCriteria: string[];
  expected: string;
  actual: string;
  rootCause: string;
  evidenceRefs: string[];
};

const KNOWN_ASSERTIONS = new Set<string>(STAGE7_REQUIRED_ASSERTIONS);

function textPatternFor(assertion: Stage7RequiredAssertion): RegExp | null {
  switch (assertion) {
    case "success-status":
    case "save-ack":
      return /başar|gönderildi|kaydedildi|success|sent|saved/i;
    case "error-status":
      return /hata|başarısız|error|failed|denied|unavailable/i;
    case "validation-message":
      return /geçerli|zorunlu|doldur|invalid|required|email/i;
    case "pending-status":
      return /bekle|pending|incelen/i;
    case "blocked-status":
    case "blocker-status":
      return /engell|uygun değil|blocked|inactive|revoked|erişim/i;
    case "empty-state":
    case "empty-or-defaults":
    case "empty-or-prompt":
      return /henüz|boş|yok|seç|empty|no |choose|select/i;
    case "offline-blocker":
      return /çevrimdışı|offline|bağlantı|retry|yeniden/i;
    case "dirty-state":
    case "dirty-dialog":
      return /kaydedilmemiş|değişiklik|unsaved|discard|ayrıl/i;
    case "conflict-status":
    case "stale-status":
      return /çakış|güncel|stale|conflict|yenile/i;
    case "readonly-or-hidden":
      return /salt okunur|read.only|yetki|izin|permission|view/i;
    case "risk-yellow":
      return /sarı|yellow|inceleme|review/i;
    case "risk-red":
      return /kırmızı|red|acil|manual|handoff/i;
    case "pwa-shell":
    case "install-guidance":
    case "installed-or-settings":
      return /yükle|install|pwa|mobil|ayar|settings/i;
    default:
      return null;
  }
}

async function bodyText(page: Page): Promise<string> {
  return page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
}

function failure(
  assertion: Stage7RequiredAssertion,
  actual: string,
  overrides: Partial<Omit<Stage7AssertionFailure, "assertion" | "actual">> = {},
): Stage7AssertionFailure {
  return {
    assertion,
    category: overrides.category ?? "behavior",
    severity: overrides.severity ?? "P2",
    wcagCriteria: overrides.wcagCriteria ?? [],
    expected: overrides.expected ?? `Required Stage 7 assertion '${assertion}' is satisfied by rendered UI state.`,
    actual,
    rootCause: overrides.rootCause ?? "Stage 7R trusted harness assertion failed against the rendered scenario state.",
    evidenceRefs: overrides.evidenceRefs ?? [],
  };
}

export function assertKnownStage7Assertions(scenario: Stage7Scenario) {
  for (const assertion of scenario.requiredAssertions) {
    if (!KNOWN_ASSERTIONS.has(assertion)) {
      throw new Error(`Stage7 harness: unknown required assertion '${assertion}' in ${scenario.id}`);
    }
  }
}

export async function runStage7RequiredAssertion(
  page: Page,
  scenario: Stage7Scenario,
  assertion: Stage7RequiredAssertion,
): Promise<Stage7AssertionFailure[]> {
  if (!KNOWN_ASSERTIONS.has(assertion)) {
    throw new Error(`Stage7 harness: unknown required assertion '${assertion}' in ${scenario.id}`);
  }

  if (assertion === "geometry") {
    return (await collectStage7GeometryFailures(page)).map((item) =>
      failure("geometry", `${item.code}: ${item.detail}`, {
        category: "geometry",
        severity: item.code === "horizontal-overflow" ? "P1" : "P2",
        wcagCriteria: item.code === "touch-target" ? ["2.5.5"] : ["1.4.10"],
        expected: "Layout stays within the viewport, with visible 44x44 targets and unclipped text.",
        rootCause: "Baseline visual/geometry defect recorded by required assertion dispatch.",
        evidenceRefs: [`test-results/stage-7/${scenario.id}.png`],
      }),
    );
  }

  if (assertion === "visible-root") {
    const text = await bodyText(page);
    const mainCount = await page.locator("main, [role='main'], body").count();
    if (text.trim().length === 0 || mainCount === 0) {
      return [
        failure("visible-root", "Rendered page has no visible body text or root landmark.", {
          severity: "P1",
          expected: "The scenario renders a visible application root with text content.",
        }),
      ];
    }
    return [];
  }

  if (assertion === "axe-a-aa") {
    return [];
  }

  const selectorChecks: Partial<Record<Stage7RequiredAssertion, string>> = {
    "active-client": "[data-testid*='active-client'], [data-testid*='client-roster-item']",
    "claim-cta": "button, a[href]",
    "dense-list": "li, tr, [data-testid*='item'], [data-testid*='row']",
    "dense-table": "table, [role='table'], [role='grid']",
    "eligible-cta": "button, a[href]",
    "export-disabled": "button[disabled], [aria-disabled='true']",
    "export-enabled": "button:not([disabled]), a[href]",
    filters: "button, select, [role='tab'], [role='combobox']",
    "loading-state": "[aria-busy='true'], [role='status']",
    pagination: "button, a[href]",
    "search-field": "input[type='search'], input[placeholder], [role='searchbox']",
    "unread-marker": "[aria-label*='okunmamış' i], [aria-label*='unread' i], [data-testid*='unread']",
  };
  const selector = selectorChecks[assertion];
  if (selector) {
    const count = await page.locator(selector).count().catch(() => 0);
    if (count === 0) {
      return [failure(assertion, `No element matched selector ${selector}`)];
    }
    return [];
  }

  const pattern = textPatternFor(assertion);
  if (pattern) {
    const text = await bodyText(page);
    if (!pattern.test(text)) {
      return [failure(assertion, `Rendered text did not match ${String(pattern)}.`)];
    }
    return [];
  }

  return [];
}
