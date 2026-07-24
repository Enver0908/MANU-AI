import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const STAGE_4C_ISOLATION_VERSION = "p85-stage-4c-isolation-v1";

const REPO_ROOT = join(__dirname, "..", "..");
const STAGE_4C_ROOTS = [
  join(REPO_ROOT, "src", "components", "ai-chat"),
  join(REPO_ROOT, "src", "lib"),
  join(REPO_ROOT, "src", "app", "api", "ai-chat"),
];

const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/;

const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+["']@\/lib\/internal-copilot["']/,
  /from\s+["']\.\/internal-copilot["']/,
  /from\s+["'].*phase-79d-bounded-internal-copilot/,
  /from\s+["'].*internal-copilot/,
];

const FORBIDDEN_ENDPOINT_PATTERNS = [
  /\/api\/internal-copilot/,
  /sendInternalCopilotMessage/,
];

function collectSourceFiles(directory: string, files: string[] = []) {
  if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) {
    return files;
  }
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      collectSourceFiles(fullPath, files);
      continue;
    }
    if (!SOURCE_FILE_PATTERN.test(entry)) continue;
    if (entry.includes("phase-85-stage-4c-isolation")) continue;
    if (!fullPath.includes("ai-chat") && !entry.startsWith("phase-85-stage-4c-") && entry !== "use-ai-chat.ts") {
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

export function verifyStage4CSourceIsolation(repoRoot: string = REPO_ROOT) {
  const files = STAGE_4C_ROOTS.flatMap((root) => collectSourceFiles(root));
  const violations: string[] = [];

  for (const filePath of files) {
    const source = readFileSync(filePath, "utf8");
    const relativePath = relative(repoRoot, filePath).replace(/\\/g, "/");
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      if (pattern.test(source)) {
        violations.push(`${relativePath}: forbidden import (${pattern.source})`);
      }
    }
    if (relativePath.includes("components/ai-chat") || relativePath === "src/lib/use-ai-chat.ts") {
      for (const pattern of FORBIDDEN_ENDPOINT_PATTERNS) {
        if (pattern.test(source)) {
          violations.push(`${relativePath}: forbidden legacy endpoint (${pattern.source})`);
        }
      }
    }
  }

  return {
    verified: violations.length === 0,
    scannedFileCount: files.length,
    violations,
  };
}

export function verifyStage4CCopilotTabRemoved(repoRoot: string = REPO_ROOT) {
  const dashboardApp = readFileSync(join(repoRoot, "src", "components", "dashboard-app.tsx"), "utf8");
  const clientsPanel = readFileSync(join(repoRoot, "src", "components", "dashboard", "clients-panel.tsx"), "utf8");
  const shared = readFileSync(join(repoRoot, "src", "components", "dashboard", "shared.tsx"), "utf8");
  const violations: string[] = [];
  if (dashboardApp.includes('section === "copilot"')) {
    violations.push("dashboard-app.tsx: legacy copilot section render remains");
  }
  if (clientsPanel.includes("tab_copilot")) {
    violations.push("clients-panel.tsx: hidden tab_copilot render remains");
  }
  if (shared.includes('"tab_copilot"')) {
    violations.push("shared.tsx: tab_copilot type remains");
  }
  return {
    verified: violations.length === 0,
    violations,
  };
}
