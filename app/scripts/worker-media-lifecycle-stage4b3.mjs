import { spawnSync } from "node:child_process";

const once = process.argv.includes("--once");
const intervalMs = Number(process.env.MANU_STAGE4B3_LIFECYCLE_INTERVAL_MS || "60000");

function runTick() {
  const result = spawnSync(
    "npx",
    [
      "vitest",
      "run",
      "src/lib/phase-85-stage-4b3-media-lifecycle-runner.test.ts",
      "-t",
      "runs one local Stage 4B-3 media lifecycle tick",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        MANU_DEV_FALLBACK_STORE: process.env.MANU_DEV_FALLBACK_STORE ?? "true",
      },
      shell: process.platform === "win32",
    },
  );

  return result.status === 0;
}

async function main() {
  console.log(
    once
      ? "[worker:media:lifecycle] running one media lifecycle tick"
      : `[worker:media:lifecycle] polling every ${intervalMs}ms (Ctrl+C to stop)`,
  );

  do {
    if (!runTick()) {
      process.exit(1);
    }
    if (once) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (true);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
