#!/usr/bin/env node
/**
 * Faz 8 frontend import graph. Walks App Router entries and static/dynamic
 * imports, writes an ignored runtime report, and fails if proven-unused UI
 * files exist or become reachable again.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const srcRoot = join(appRoot, "src");
const repoRoot = resolve(appRoot, "..");
const reportPath = join(repoRoot, ".manu-runtime", "frontend-import-graph.json");

export const PROVEN_UNUSED_UI_FILES = [
  "src/components/dashboard/simulator-panel.tsx",
  "src/components/dashboard/operational-foundation-panel.tsx",
  "src/components/dashboard/active-client-control.tsx",
  "src/components/dashboard/client-status-strip.tsx",
  "src/components/dashboard/copilot-panel.tsx",
  "src/components/dashboard/handoffs-panel.tsx",
  "src/components/aiya-marketing-page.tsx",
  "src/components/contact-lead-form.tsx",
];

export const KEPT_BACKEND_SURFACES = [
  "src/app/api/simulator/route.ts",
  "src/app/api/simulator/visual/route.ts",
  "src/app/api/simulator/voice/route.ts",
  "src/app/api/operational-foundation/route.ts",
  "src/app/api/commercial/checkout/route.ts",
  "src/app/api/commercial/webhook/route.ts",
  "src/app/api/whatsapp/webhook/route.ts",
];

const ENTRY_FILENAMES = new Set([
  "page.tsx",
  "page.ts",
  "layout.tsx",
  "layout.ts",
  "route.ts",
  "route.js",
  "loading.tsx",
  "error.tsx",
  "not-found.tsx",
  "default.tsx",
  "template.tsx",
  "middleware.ts",
  "proxy.ts",
  "instrumentation.ts",
]);

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

function walk(dir, files = []) {
  if (!existsSync(dir)) {
    return files;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") {
      continue;
    }
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, files);
    } else {
      files.push(absolute);
    }
  }
  return files;
}

function toPosix(path) {
  return path.replaceAll("\\", "/");
}

function collectEntryFiles() {
  const entries = [];
  for (const file of walk(join(srcRoot, "app"))) {
    if (ENTRY_FILENAMES.has(file.split(/[\\/]/).pop() ?? "")) {
      entries.push(file);
    }
  }
  for (const extra of ["proxy.ts", "middleware.ts", "instrumentation.ts"]) {
    const absolute = join(srcRoot, extra);
    if (existsSync(absolute)) {
      entries.push(absolute);
    }
  }
  return entries;
}

function extractSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /from\s+['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /export\s+\*\s+from\s+['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) {
    return null;
  }
  const base = specifier.startsWith("@/")
    ? join(srcRoot, specifier.slice(2))
    : resolve(dirname(fromFile), specifier);
  if (existsSync(base) && statSync(base).isFile()) {
    return base;
  }
  for (const extension of SOURCE_EXTENSIONS) {
    if (existsSync(base + extension)) {
      return base + extension;
    }
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const extension of SOURCE_EXTENSIONS) {
      const indexPath = join(base, `index${extension}`);
      if (existsSync(indexPath)) {
        return indexPath;
      }
    }
  }
  return null;
}

export function analyzeFrontendImportGraph() {
  const entries = collectEntryFiles();
  const reachable = new Set();
  const queue = [...entries];
  const unresolved = [];

  while (queue.length > 0) {
    const current = queue.pop();
    const relativePath = toPosix(relative(appRoot, current));
    if (reachable.has(relativePath) || !existsSync(current)) {
      continue;
    }
    reachable.add(relativePath);
    if (!SOURCE_EXTENSIONS.includes(extname(current))) {
      continue;
    }
    const source = readFileSync(current, "utf8");
    for (const specifier of extractSpecifiers(source)) {
      const resolved = resolveSpecifier(current, specifier);
      if (!resolved) {
        if (specifier.startsWith(".") || specifier.startsWith("@/")) {
          unresolved.push({ from: relativePath, specifier });
        }
        continue;
      }
      queue.push(resolved);
    }
  }

  const missingProvenUnused = PROVEN_UNUSED_UI_FILES.filter((file) => existsSync(join(appRoot, file)));
  const reachableProvenUnused = PROVEN_UNUSED_UI_FILES.filter((file) => reachable.has(file));
  const missingKeptBackend = KEPT_BACKEND_SURFACES.filter((file) => !existsSync(join(appRoot, file)));
  const reachableKeptBackend = KEPT_BACKEND_SURFACES.filter((file) => reachable.has(file));

  const report = {
    generatedAt: new Date().toISOString(),
    entryCount: entries.length,
    reachableCount: reachable.size,
    reachable: [...reachable].sort(),
    unresolved,
    provenUnusedUi: {
      expectedAbsent: PROVEN_UNUSED_UI_FILES,
      stillPresent: missingProvenUnused,
      reachable: reachableProvenUnused,
    },
    keptBackend: {
      expectedPresent: KEPT_BACKEND_SURFACES,
      missing: missingKeptBackend,
      reachable: reachableKeptBackend,
    },
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const blockers = [];
  if (missingProvenUnused.length > 0) {
    blockers.push(`proven_unused_ui_still_present:${missingProvenUnused.join(",")}`);
  }
  if (reachableProvenUnused.length > 0) {
    blockers.push(`proven_unused_ui_reachable:${reachableProvenUnused.join(",")}`);
  }
  if (missingKeptBackend.length > 0) {
    blockers.push(`kept_backend_missing:${missingKeptBackend.join(",")}`);
  }
  if (reachableKeptBackend.length !== KEPT_BACKEND_SURFACES.length) {
    blockers.push(`kept_backend_not_reachable:${KEPT_BACKEND_SURFACES.filter((file) => !reachable.has(file)).join(",")}`);
  }

  return { report, reportPath, blockers, ok: blockers.length === 0 };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const result = analyzeFrontendImportGraph();
  if (!result.ok) {
    console.error(result.blockers.join("\n"));
    process.exit(1);
  }
  console.log(`frontend import graph ok: ${result.report.reachableCount} files -> ${result.reportPath}`);
}
