import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHostedSandboxVerifier } from "../../tools/hosted-sandbox/run-verifier.mjs";

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
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
