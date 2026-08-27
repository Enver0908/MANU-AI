#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FORBIDDEN_WORKFLOW_PATTERNS } from "./lib/deploy-contract.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const workflowDirs = [
  path.join(repoRoot, "tools/hosted-sandbox/deploy/workflow-templates"),
  path.join(repoRoot, ".github/workflows"),
];

function validateWorkflowDir(dir) {
  const targets = readdirSync(dir)
    .filter((name) => name.startsWith("hosted-sandbox-") && name.endsWith(".yml"))
    .sort();
  if (targets.length === 0) {
    throw new Error("no hosted sandbox workflows in " + dir);
  }
  for (const name of targets) {
    const content = readFileSync(path.join(dir, name), "utf8");
    if (!content.includes("permissions:")) throw new Error(name + " missing permissions block in " + dir);
    if (!content.includes("MANU_CI_NO_PRODUCTION_EFFECTS")) {
      throw new Error(name + " missing production-effects guard in " + dir);
    }
    for (const pattern of FORBIDDEN_WORKFLOW_PATTERNS) {
      if (pattern.test(content)) throw new Error(name + " forbidden pattern in " + dir + ": " + pattern);
    }
  }
  const migration = readFileSync(path.join(dir, "hosted-sandbox-migration.yml"), "utf8");
  const deploy = readFileSync(path.join(dir, "hosted-sandbox-deploy.yml"), "utf8");
  const productCi = readFileSync(path.join(dir, "hosted-sandbox-product-ci.yml"), "utf8");
  if (!migration.includes("environment:")) throw new Error("migration workflow missing environment gate in " + dir);
  if (!deploy.includes("environment:")) throw new Error("deploy workflow missing environment gate in " + dir);
  if (!deploy.includes('MANU_RELEASE_ARTIFACT_REQUIRED: "true"')) {
    throw new Error("deploy workflow missing required release artifact gate in " + dir);
  }
  if (!deploy.includes("node tools/hosted-sandbox/deploy/build-release-artifact.mjs")) {
    throw new Error("deploy workflow missing archive artifact build in " + dir);
  }
  if (!productCi.includes("npm run build")) {
    throw new Error("product CI missing production build in " + dir);
  }
  if (!productCi.includes("node tools/hosted-sandbox/deploy/build-release-artifact.mjs")) {
    throw new Error("product CI missing hosted release archive build in " + dir);
  }
  return targets;
}

const checked = {};
for (const dir of workflowDirs) {
  checked[dir] = validateWorkflowDir(dir);
}

process.stdout.write(JSON.stringify({ result: "PASS", checked }, null, 2) + "\n");
