import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

export async function collectStage7AxeViolations(page: Page) {
  page.setDefaultTimeout(8_000);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"])
    .setLegacyMode(true)
    .analyze();
  return results.violations.flatMap((violation) =>
    violation.nodes.slice(0, 5).map((node) => ({
      id: violation.id,
      impact: violation.impact ?? "unknown",
      help: violation.help,
      wcag: violation.tags.filter((tag) => tag.startsWith("wcag")),
      target: node.target.join(" "),
      failureSummary: node.failureSummary ?? violation.description,
    })),
  );
}

export function axeSeverity(impact: string): "P0" | "P1" | "P2" | "P3" {
  if (impact === "critical") return "P0";
  if (impact === "serious") return "P1";
  if (impact === "moderate") return "P2";
  return "P3";
}
