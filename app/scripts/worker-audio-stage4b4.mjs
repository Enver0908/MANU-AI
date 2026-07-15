import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const once = process.argv.includes("--once");
const scriptDir = dirname(fileURLToPath(import.meta.url));
const runnerPath = join(scriptDir, "worker-audio-stage4b4-supervisor.mjs");
const forwardedArgs = once ? ["--once"] : [];

const result = spawnSync(process.execPath, [runnerPath, ...forwardedArgs], {
  stdio: "inherit",
  env: process.env,
  shell: false,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
