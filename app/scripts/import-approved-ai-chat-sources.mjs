import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const runnerPath = join(scriptDir, "..", "src", "lib", "phase-85-stage-4c-import-sources-cli.ts");

const result = spawnSync(process.execPath, ["--experimental-strip-types", runnerPath], {
  stdio: "inherit",
  env: process.env,
  shell: false,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
