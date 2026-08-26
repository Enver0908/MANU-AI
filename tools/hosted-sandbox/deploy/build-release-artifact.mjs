#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReleaseIdentity } from "../../../app/scripts/lib/release-identity.mjs";
import { assertDeployEnvironmentSafe } from "./lib/deploy-contract.mjs";
import { buildArtifactManifest, collectArtifactEntries } from "./lib/artifact-manifest.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const args = new Set(process.argv.slice(2));
const manifestOnly = args.has("--manifest-only");

assertDeployEnvironmentSafe(process.env);

const identity = buildReleaseIdentity({ repoRoot, env: process.env });
const artifactSources = [
  "app/next.config.ts",
  "app/public/sw.js",
  "app/scripts/lib/release-identity.mjs",
  "app/src/lib/hosted-sandbox-security-headers.ts",
  "tools/hosted-sandbox/deploy/workflow-templates/hosted-sandbox-product-ci.yml",
  "tools/hosted-sandbox/deploy/workflow-templates/hosted-sandbox-migration.yml",
  "tools/hosted-sandbox/deploy/workflow-templates/hosted-sandbox-deploy.yml",
  "tools/hosted-sandbox/deploy/deploy-hosted-release.mjs",
  "tools/hosted-sandbox/deploy/pm2.ecosystem.config.cjs",
  "tools/hosted-sandbox/deploy/nginx/hosted-sandbox.conf.template",
];

if (!manifestOnly) {
  artifactSources.push("app/package.json");
}

const entries = collectArtifactEntries(repoRoot, artifactSources);
const manifest = buildArtifactManifest({
  commitSha: identity.commitSha,
  migrationFingerprint: identity.migrationFingerprint,
  releaseId: identity.releaseId,
  compatibilityVersion: identity.compatibilityVersion,
  entries,
});

const outDir = path.join(
  repoRoot,
  ".manu-runtime",
  "hosted-sandbox",
  "artifacts",
  identity.commitSha,
);
mkdirSync(outDir, { recursive: true });
const manifestPath = path.join(outDir, "release-manifest.json");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
process.stdout.write(JSON.stringify({ result: "PASS", manifestPath, releaseId: identity.releaseId }, null, 2) + "\n");
