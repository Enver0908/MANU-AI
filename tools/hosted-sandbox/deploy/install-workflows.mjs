#!/usr/bin/env node
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const templateDir = path.join(repoRoot, "tools/hosted-sandbox/deploy/workflow-templates");
const workflowDir = path.join(repoRoot, ".github/workflows");
mkdirSync(workflowDir, { recursive: true });
const names = readdirSync(templateDir).filter((n) => n.startsWith("hosted-sandbox-") && n.endsWith(".yml"));
for (const name of names) {
  copyFileSync(path.join(templateDir, name), path.join(workflowDir, name));
}
process.stdout.write(JSON.stringify({ result: "PASS", installed: names }, null, 2) + "\n");
