import { spawnSync } from "node:child_process";

const targetedStage4B3Tests = [
  "src/lib/phase-85-stage-4b3-closure.test.ts",
  "src/lib/phase-85-stage-4b3-media-contracts.test.ts",
  "src/lib/phase-85-stage-4b3-media-admission.test.ts",
  "src/lib/phase-85-stage-4b3-image-admission.test.ts",
  "src/lib/phase-85-stage-4b3-message-bundles.test.ts",
  "src/lib/phase-85-stage-4b3-mock-vision-provider.test.ts",
  "src/lib/phase-85-stage-4b3-visual-observation-validator.test.ts",
  "src/lib/phase-85-stage-4b3-provider-gate.test.ts",
  "src/lib/phase-85-stage-4b3-multimodal-understanding.test.ts",
  "src/lib/phase-85-stage-4b3-bundle-orchestration.test.ts",
  "src/lib/phase-85-stage-4b3-bounded-media.test.ts",
  "src/lib/phase-85-stage-4b3-canonical-ingress.test.ts",
  "src/lib/phase-85-stage-4b3-media-lifecycle.test.ts",
  "src/lib/phase-85-stage-4b3-migration-contract.test.ts",
];

const checks = [
  {
    label: "Stage 4B-3 closure and golden corpus tests",
    command: "npx",
    args: ["vitest", "run", "src/lib/phase-85-stage-4b3-closure.test.ts"],
  },
  {
    label: "Stage 4B-3 targeted multimodal safety suites",
    command: "npx",
    args: ["vitest", "run", ...targetedStage4B3Tests],
  },
];

console.log("[rehearse:stage-4b3:media] starting Stage 4B-3 media closure rehearsal");

for (const check of checks) {
  console.log(`\n[rehearse:stage-4b3:media] ${check.label}`);
  const result = spawnSync(check.command, check.args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.STAGE_4B3_FULL_SCALE === "1") {
  console.log("\n[rehearse:stage-4b3:media] full 5000 cached-decision and 200 admission round-trip rehearsal");
  const fullScale = spawnSync(
    "npx",
    ["vitest", "run", "src/lib/phase-85-stage-4b3-closure.test.ts", "-t", "runs full"],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, STAGE_4B3_FULL_SCALE: "1" },
    },
  );
  if (fullScale.status !== 0) {
    process.exit(fullScale.status ?? 1);
  }
}

console.log(
  "\nStage 4B-3 media closure rehearsal passed. Production pilot remains NO-GO; R-405 remains open; Stage 4C read gate opens only after full closure evidence.",
);
