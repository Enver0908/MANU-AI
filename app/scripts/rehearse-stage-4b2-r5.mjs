import { spawnSync } from "node:child_process";

const checks = [
  {
    label: "R5 targeted evidence and full 10k bounded scale",
    command: "npx",
    args: ["vitest", "run", "src/lib/phase-85-stage-4b2-remediation-r5-evidence.test.ts"],
    env: { STAGE_4B2_R5_FULL_SCALE: "1" },
  },
  {
    label: "R5 channel replay hard-zero rehearsal",
    command: "npm",
    args: ["run", "rehearse:channel:replay"],
    env: { PHASE_77AG_FULL_REPLAY: "1" },
  },
  {
    label: "R5 messaging accessibility visual projects",
    command: "npx",
    args: ["playwright", "test", "tests/visual/messaging.accessibility.spec.ts"],
  },
];

console.log("[rehearse:stage-4b2-r5] starting R5 evidence reconstruction");

for (const check of checks) {
  console.log(`\n[rehearse:stage-4b2-r5] ${check.label}`);
  const result = spawnSync(check.command, check.args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...(check.env ?? {}) },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("\nStage 4B-2 R5 evidence reconstruction passed. Production pilot remains NO-GO; R-405 remains open.");
