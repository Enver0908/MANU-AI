import { spawnSync } from "node:child_process";

const checks = [
  { label: "expanded AI quality rehearsal", command: "npm", args: ["run", "rehearse:ai:expanded"] },
  { label: "channel replay rehearsal", command: "npm", args: ["run", "rehearse:channel:replay"] },
  {
    label: "phase 79 production-scale acceptance tests",
    command: "npx",
    args: [
      "vitest",
      "run",
      "src/lib/phase-79g-unified-production-scale-rehearsal.test.ts",
    ],
    env: { PHASE_79G_FULL_REHEARSAL: "1" },
  },
  { label: "release verification", command: "npm", args: ["run", "release:verify"] },
];

console.log("[rehearse:production-scale:79g] starting unified Phase 79G acceptance chain");

for (const check of checks) {
  console.log(`\n[rehearse:production-scale:79g] ${check.label}`);
  const result = spawnSync(check.command, check.args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...(check.env ?? {}) },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(
  "\nPhase 79G unified production-scale rehearsal passed. Production pilot remains NO-GO; R-405 remains open.",
);
