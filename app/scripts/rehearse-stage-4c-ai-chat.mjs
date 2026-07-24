import { spawnSync } from "node:child_process";

const checks = [
  {
    label: "Stage 4C closure and program closure tests",
    command: "npx",
    args: ["vitest", "run", "src/lib/phase-85-stage-4c-closure.test.ts"],
  },
  {
    label: "core dietitian chat golden corpus tests",
    command: "npm",
    args: ["test", "--", "tests/dietitian-chat-golden-corpus.test.mjs", "tests/dietitian-chat-red-team-corpus.test.mjs"],
    cwd: "../dietitian-ai-assistant",
  },
  {
    label: "lint",
    command: "npm",
    args: ["run", "lint"],
  },
  {
    label: "typecheck",
    command: "npm",
    args: ["run", "typecheck"],
  },
  {
    label: "unit tests",
    command: "npm",
    args: ["test"],
  },
  {
    label: "RLS integration suite",
    command: "npm",
    args: ["run", "test:rls"],
  },
  {
    label: "production build",
    command: "npm",
    args: ["run", "build"],
  },
  {
    label: "AI Chat visual acceptance",
    command: "npx",
    args: ["playwright", "test", "tests/visual/ai-chat.visual.spec.ts"],
  },
  {
    label: "AI Chat accessibility acceptance",
    command: "npx",
    args: ["playwright", "test", "tests/visual/ai-chat.accessibility.spec.ts"],
  },
  {
    label: "release verification",
    command: "npm",
    args: ["run", "release:verify"],
  },
];

console.log("[rehearse:stage-4c] starting Stage 4C measured closure rehearsal");

for (const check of checks) {
  console.log(`\n[rehearse:stage-4c] ${check.label}`);
  const result = spawnSync(check.command, check.args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env },
    cwd: check.cwd,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(
  "\nStage 4C measured closure rehearsal passed locally. Production pilot remains NO-GO; R-405 remains open; PASS_LOCAL_STAGE_4C requires zero skipped security gates.",
);
