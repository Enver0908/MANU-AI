import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const once = process.argv.includes("--once");
const intervalMs = Number(process.env.MANU_STAGE4C_WORKER_INTERVAL_MS || "3000");
const lifecycleSweepsEnabled = process.env.MANU_STAGE4C_LIFECYCLE_SWEEPS !== "false";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const runnerPath = join(scriptDir, "..", "src", "lib", "phase-85-stage-4c-run-worker-cli.ts");
const forwardedArgs = once ? ["--once"] : [];

const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", runnerPath, ...forwardedArgs],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      MANU_STAGE4C_WORKER_INTERVAL_MS: String(intervalMs),
      MANU_STAGE4C_LIFECYCLE_SWEEPS: lifecycleSweepsEnabled ? "true" : "false",
    },
    shell: false,
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
