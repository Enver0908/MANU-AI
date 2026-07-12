import { spawnSync } from "node:child_process";

const checks = [
  {
    label: "Stage 4B-2 verification tests",
    command: "npx",
    args: ["vitest", "run", "src/lib/phase-85-stage-4b2-verification.test.ts"],
  },
  {
    label: "Stage 4B-2 targeted messaging tests",
    command: "npx",
    args: [
      "vitest",
      "run",
      "src/lib/phase-85-stage-4b2-messaging.test.ts",
      "src/lib/phase-85-stage-4b2-api.test.ts",
      "src/lib/phase-85-stage-4b2-read-api.test.ts",
      "src/lib/phase-85-stage-4b2-mutations.test.ts",
      "src/lib/phase-85-stage-4b2-messaging-integration.test.ts",
      "src/lib/phase-85-stage-4b2-receipt-lifecycle.test.ts",
      "src/lib/messaging-panel-helpers.test.ts",
      "src/lib/conversation-detail-helpers.test.ts",
    ],
  },
];

console.log("[rehearse:stage-4b2:verification] starting Stage 4B-2 verification rehearsal");

for (const check of checks) {
  console.log(`\n[rehearse:stage-4b2:verification] ${check.label}`);
  const result = spawnSync(check.command, check.args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.STAGE_4B2_FULL_SCALE === "1") {
  console.log("\n[rehearse:stage-4b2:verification] full 10k conversation scale rehearsal");
  const fullScale = spawnSync(
    "npx",
    ["vitest", "run", "src/lib/phase-85-stage-4b2-verification.test.ts", "-t", "runs full"],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, STAGE_4B2_FULL_SCALE: "1" },
    },
  );
  if (fullScale.status !== 0) {
    process.exit(fullScale.status ?? 1);
  }
}

console.log(
  "\nStage 4B-2 verification rehearsal passed. Production pilot remains NO-GO; R-405 remains open.",
);
