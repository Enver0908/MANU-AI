import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { AUDIT_PLAN_ID, AUDIT_PLAN_VERSION } from "./audit-plan.mjs";
import { stableDigest } from "./audit-contract.mjs";

const require = createRequire(import.meta.url);
const ts = require(path.join("..", "..", "..", "app", "node_modules", "typescript"));
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const SCAN_ROOTS = ["app/src", "app/scripts", "dietitian-ai-assistant/src", "tools/hosted-sandbox", ".github/workflows"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".manu-runtime", ".git", "coverage", "test-results", "playwright-report"]);
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

function walk(root, relative = "", output = []) {
  const absolute = path.join(root, relative);
  if (!existsSync(absolute)) return output;
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) walk(root, child, output);
    else if (entry.isFile() && CODE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) output.push(child);
  }
  return output;
}

function relativePosix(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function literalText(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function propertyName(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isStringLiteral(node)) return node.text;
  return null;
}

function addUnique(list, value, keyFields) {
  const key = keyFields.map((field) => String(value[field] ?? "")).join("|");
  if (!list.some((item) => keyFields.map((field) => String(item[field] ?? "")).join("|") === key)) list.push(value);
}

function classifyEnvKey(key) {
  if (/KEY|TOKEN|SECRET|PASSWORD|PRIVATE|MASTER|IDENTITY/i.test(key)) return "secret_name_only";
  if (/URL|HOST|DOMAIN|PORT|ENV|FLAG|ENABLED|MODE|VERSION|INTERVAL|TIMEOUT/i.test(key)) return "configuration_name_only";
  return "runtime_name_only";
}

function parseFile(repoRoot, filePath, inventory) {
  const source = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const relative = relativePosix(repoRoot, filePath);
  const routeMethods = new Set();
  const visitor = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && HTTP_METHODS.has(node.name.text) && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) routeMethods.add(node.name.text);
    if (ts.isVariableStatement(node) && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of node.declarationList.declarations) {
        const name = propertyName(declaration.name);
        if (name && HTTP_METHODS.has(name)) routeMethods.add(name);
      }
    }
    if (ts.isPropertyAccessExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(sourceFile) === "process" && node.expression.name.text === "env") {
      addUnique(inventory.environmentReferences, { source: relative, line: lineOf(sourceFile, node), key: node.name.text, sensitivityClass: classifyEnvKey(node.name.text), verificationScenario: "phase-1.4.environment-contract" }, ["source", "line", "key"]);
    }
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const method = ts.isPropertyAccessExpression(expression) ? expression.name.text : ts.isIdentifier(expression) ? expression.text : null;
      const argument = literalText(node.arguments[0]);
      if (method === "fetch") {
        addUnique(inventory.externalCalls, { source: relative, line: lineOf(sourceFile, node), kind: "fetch", target: argument ?? "<dynamic>", verificationScenario: "phase-4.4.integration-contract" }, ["source", "line", "kind"]);
        if (!argument) inventory.unresolvedReferences.push({ source: relative, line: lineOf(sourceFile, node), kind: "fetch", verificationScenario: "phase-1.3.unresolved-reference" });
      }
      if (method === "rpc" || method === "from") {
        const operation = method === "rpc" ? "rpc" : "table_or_storage";
        addUnique(inventory.databaseCalls, { source: relative, line: lineOf(sourceFile, node), operation, target: argument ?? "<dynamic>", verificationScenario: method === "rpc" ? "phase-2.4.schema-contract" : "phase-3.3.tenant-data-contract" }, ["source", "line", "operation"]);
        if (!argument) inventory.unresolvedReferences.push({ source: relative, line: lineOf(sourceFile, node), kind: method, verificationScenario: "phase-1.3.unresolved-reference" });
      }
    }
    ts.forEachChild(node, visitor);
  };
  visitor(sourceFile);
  if (relative.startsWith("app/src/app/api/") && path.basename(relative).startsWith("route.")) {
    inventory.apiRoutes.push({ source: relative, methods: [...routeMethods].sort(), verificationScenario: "phase-3.1.api-contract" });
  }
  if (relative.startsWith("app/scripts/") && /(^|\/)worker-[^/]+\.(mjs|js|ts)$/.test(relative)) {
    inventory.workerEntries.push({ source: relative, kind: "app-worker-entry", verificationScenario: "phase-4.1.worker-contract" });
  }
  if (relative.startsWith("tools/hosted-sandbox/") && /worker|deploy|backup|restore/i.test(path.basename(relative))) {
    inventory.workerEntries.push({ source: relative, kind: "hosted-operation-entry", verificationScenario: "phase-6.4.operations-contract" });
  }
}

export function buildSystemInventory(repoRoot) {
  const inventory = {
    schemaVersion: "aiya-system-audit-system-inventory-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    scanRoots: SCAN_ROOTS,
    files: [],
    apiRoutes: [],
    databaseCalls: [],
    externalCalls: [],
    environmentReferences: [],
    workerEntries: [],
    unresolvedReferences: [],
  };
  for (const root of SCAN_ROOTS) {
    for (const relative of walk(repoRoot, root)) {
      const absolute = path.join(repoRoot, relative);
      inventory.files.push({ source: relative, bytes: statSync(absolute).size, contentSha256: createHash("sha256").update(readFileSync(absolute)).digest("hex") });
      parseFile(repoRoot, absolute, inventory);
    }
  }
  for (const key of ["apiRoutes", "databaseCalls", "externalCalls", "environmentReferences", "workerEntries", "unresolvedReferences"]) {
    inventory[key].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  inventory.counts = Object.fromEntries(["files", "apiRoutes", "databaseCalls", "externalCalls", "environmentReferences", "workerEntries", "unresolvedReferences"].map((key) => [key, inventory[key].length]));
  inventory.inventoryDigest = stableDigest({ ...inventory, inventoryDigest: null });
  return inventory;
}

export function buildCoverageMatrix(inventory) {
  const entries = [];
  const add = (kind, records, phase, scenario) => records.forEach((record) => entries.push({ inventoryKind: kind, source: record.source, line: record.line ?? null, target: record.target ?? null, phase, verificationScenario: record.verificationScenario || scenario }));
  add("apiRoute", inventory.apiRoutes, "phase-3", "phase-3.1.api-contract");
  add("databaseCall", inventory.databaseCalls, "phase-2", "phase-2.4.schema-contract");
  add("externalCall", inventory.externalCalls, "phase-4", "phase-4.4.integration-contract");
  add("environmentReference", inventory.environmentReferences, "phase-1", "phase-1.4.environment-contract");
  add("workerEntry", inventory.workerEntries, "phase-4", "phase-4.1.worker-contract");
  add("unresolvedReference", inventory.unresolvedReferences, "phase-1", "phase-1.3.unresolved-reference");
  entries.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const matrix = { schemaVersion: "aiya-system-audit-coverage-matrix-v1", planId: AUDIT_PLAN_ID, planVersion: AUDIT_PLAN_VERSION, inventoryDigest: inventory.inventoryDigest, entries, coveredRecordCount: entries.length, coverageDigest: stableDigest({ inventoryDigest: inventory.inventoryDigest, entries }) };
  return matrix;
}
