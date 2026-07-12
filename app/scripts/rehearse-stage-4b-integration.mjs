import { spawnSync } from "node:child_process";

const checks = [
  {
    label: "Stage 4B integration verification tests",
    command: "npx",
    args: ["vitest", "run", "src/lib/phase-85-stage-4b-integration-verification.test.ts"],
  },
  {
    label: "Stage 4B targeted API and panel tests",
    command: "npx",
    args: [
      "vitest",
      "run",
      "src/lib/phase-85-stage-4b-api.test.ts",
      "src/lib/phase-85-stage-4b-alerts.test.ts",
      "src/lib/phase-85-stage-4b-notifications.test.ts",
      "src/lib/phase-85-stage-4b-phase-5-red-atomic-activation.test.ts",
      "src/lib/alerts-panel-helpers.test.ts",
      "src/lib/notifications-panel-helpers.test.ts",
    ],
  },
];

console.log("[rehearse:stage-4b:integration] starting Stage 4B integration rehearsal");

for (const check of checks) {
  console.log(`\n[rehearse:stage-4b:integration] ${check.label}`);
  const result = spawnSync(check.command, check.args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.STAGE_4B_FULL_SCALE === "1") {
  console.log("\n[rehearse:stage-4b:integration] full 5k/10k scale rehearsal");
  const fullScale = spawnSync(
    "npx",
    ["vitest", "run", "src/lib/phase-85-stage-4b-integration-verification.test.ts", "-t", "runs full"],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, STAGE_4B_FULL_SCALE: "1" },
    },
  );
  if (fullScale.status !== 0) {
    process.exit(fullScale.status ?? 1);
  }
}

console.log(
  "\nStage 4B integration rehearsal passed. Production pilot remains NO-GO; R-405 remains open.",
);
