import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

export const STAGE7_WCAG_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
] as const;

export type Stage7AxeNode = {
  id: string;
  impact: string;
  help: string;
  wcag: string[];
  target: string;
  failureSummary: string;
};

function flattenAxeNodes(
  items: Array<{
    id: string;
    impact?: string | null;
    help: string;
    tags: string[];
    description: string;
    nodes: Array<{ target: string[]; failureSummary?: string }>;
  }>,
): Stage7AxeNode[] {
  return items.flatMap((item) =>
    item.nodes.slice(0, 5).map((node) => ({
      id: item.id,
      impact: item.impact ?? "unknown",
      help: item.help,
      wcag: item.tags.filter((tag) => tag.startsWith("wcag")),
      target: node.target.join(" "),
      failureSummary: node.failureSummary ?? item.description,
    })),
  );
}

export async function analyzeStage7Axe(page: Page) {
  page.setDefaultTimeout(8_000);
  const results = await new AxeBuilder({ page })
    .withTags([...STAGE7_WCAG_TAGS])
    .setLegacyMode(true)
    .analyze();
  return {
    violations: flattenAxeNodes(results.violations),
    incompletes: flattenAxeNodes(results.incomplete),
  };
}

export async function collectStage7AxeViolations(page: Page) {
  return (await analyzeStage7Axe(page)).violations;
}

export function axeSeverity(impact: string): "P0" | "P1" | "P2" | "P3" {
  if (impact === "critical") return "P0";
  if (impact === "serious") return "P1";
  if (impact === "moderate") return "P2";
  return "P3";
}
