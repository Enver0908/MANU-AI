import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { collectLiveIdentity } from "./lib/identity.mjs";
import { runNegativeControls } from "./lib/negative-controls.mjs";

export function findRepoRoot(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if (existsSync(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(startDir);
    current = parent;
  }
}

export function runHostedSandboxVerifier(options = {}) {
  const repoRoot = options.repoRoot || findRepoRoot(process.cwd());
  const startedAt = new Date().toISOString();
  const identity = collectLiveIdentity(repoRoot);
  const negativeControls = runNegativeControls(repoRoot);
  const runId = `hs-verify-${startedAt.replace(/[:.]/g, "-")}`;
  const artifact = {
    schemaVersion: "1.0.0",
    runId,
    timestamp: startedAt,
    commitSha: identity.commitSha,
    identity,
    negativeControls,
    result: "PASS"
  };
  const outputDir = path.join(repoRoot, ".execution-governance", "runtime", "hosted-sandbox");
  mkdirSync(outputDir, { recursive: true });
  const artifactPath = path.join(outputDir, `${runId}.json`);
  writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return { artifact, artifactPath };
}

const invokedDirectly = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  try {
    const result = runHostedSandboxVerifier();
    process.stdout.write(`${JSON.stringify({
      result: "PASS",
      artifactPath: result.artifactPath,
      commitSha: result.artifact.commitSha,
      migrationFingerprint: result.artifact.identity.migrations.fingerprint
    }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`FAIL hosted-sandbox verifier: ${error.message}\n`);
    process.exit(1);
  }
}
