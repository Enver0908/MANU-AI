import { spawnSync } from "node:child_process";

const checks = [
  {
    label: "Stage 4B-4 closure and program closure tests",
    command: "npx",
    args: ["vitest", "run", "src/lib/phase-85-stage-4b4-closure.test.ts"],
  },
  {
    label: "Stage 4B-4 audio golden corpus rehearsal",
    command: "npm",
    args: ["run", "rehearse:stage-4b4:audio"],
  },
  {
    label: "lint",
    command: "npm",
    args: ["run", "lint"],
  },
  {
    label: "production build",
    command: "npm",
    args: ["run", "build"],
  },
  {
    label: "Stage 4B-4 visual acceptance",
    command: "npx",
    args: ["playwright", "test", "tests/visual/stage-4b4-audio.visual.spec.ts"],
  },
];

console.log("[rehearse:stage-4b4:closure] starting Stage 4B-4 measured closure rehearsal");

for (const check of checks) {
  console.log(`\n[rehearse:stage-4b4:closure] ${check.label}`);
  const result = spawnSync(check.command, check.args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.STAGE_4B4_FULL_SCALE === "1") {
  console.log("\n[rehearse:stage-4b4:closure] full 5000 cached-decision, 200 admission, and 5000 voice replay rehearsal");
  const fullScale = spawnSync(
    "npx",
    ["vitest", "run", "src/lib/phase-85-stage-4b4-closure.test.ts", "-t", "runs full"],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, STAGE_4B4_FULL_SCALE: "1" },
    },
  );
  if (fullScale.status !== 0) {
    process.exit(fullScale.status ?? 1);
  }
}

console.log(
  "\nStage 4B-4 measured closure rehearsal passed locally. Stage 4C read gate is authorized only after program closure evidence with zero skipped security gates. Production pilot remains NO-GO; R-405 remains open.",
);
