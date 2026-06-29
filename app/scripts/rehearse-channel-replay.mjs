import { spawnSync } from "node:child_process";

console.log("[rehearse:channel:replay] running full 100x50 mock channel replay rehearsal");

const result = spawnSync(
  "npx",
  [
    "vitest",
    "run",
    "src/lib/phase-77ag-channel-replay-rehearsal.test.ts",
    "-t",
    "runs the full channel replay rehearsal with integration checks",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, PHASE_77AG_FULL_REPLAY: "1" },
    shell: process.platform === "win32",
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Channel replay rehearsal passed.");
