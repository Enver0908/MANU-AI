import { spawnSync } from "node:child_process";

const targetedStage4B4Tests = [
  "src/lib/phase-85-stage-4b4-closure.test.ts",
  "src/lib/phase-85-stage-4b4-voice-simulator.test.ts",
  "src/lib/phase-85-stage-4b4-voice-contracts.test.ts",
  "src/lib/phase-85-stage-4b4-provider-gate.test.ts",
  "src/lib/phase-85-stage-4b4-mock-transcription-provider.test.ts",
  "src/lib/phase-85-stage-4b4-audio-canonicalizer.test.ts",
  "src/lib/phase-85-stage-4b4-audio-admission.test.ts",
  "src/lib/phase-85-stage-4b4-transcription-worker.test.ts",
  "src/lib/phase-85-stage-4b4-transcript-bridge.test.ts",
  "src/lib/phase-85-stage-4b4-durable-transcript-bridge-worker.test.ts",
  "src/lib/phase-85-stage-4b4-voice-bundle-orchestration.test.ts",
  "src/lib/phase-85-stage-4b3-bundle-orchestration.test.ts",
  "src/lib/phase-85-stage-4b4-transcript-corrections.test.ts",
  "src/lib/phase-85-stage-4b4-transcript-correction-bounded.test.ts",
  "src/lib/phase-85-stage-4b4-bounded-audio.test.ts",
  "src/lib/phase-85-stage-4b4-media-range.test.ts",
  "src/lib/phase-85-stage-4b4-audio-lifecycle.test.ts",
  "src/lib/phase-85-stage-4b4-migration-contract.test.ts",
  "src/lib/phase-85-stage-4b4-supabase-mappers.test.ts",
];

const checks = [
  {
    label: "Stage 4B-4 closure and golden corpus tests",
    command: "npx",
    args: ["vitest", "run", "src/lib/phase-85-stage-4b4-closure.test.ts"],
  },
  {
    label: "Stage 4B-4 targeted audio and transcription suites",
    command: "npx",
    args: ["vitest", "run", ...targetedStage4B4Tests],
  },
];

console.log("[rehearse:stage-4b4:audio] starting Stage 4B-4 audio, golden corpus, and closure rehearsal");

for (const check of checks) {
  console.log(`\n[rehearse:stage-4b4:audio] ${check.label}`);
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
  console.log("\n[rehearse:stage-4b4:audio] full 5000 cached-decision, 200 admission, and 5000 voice replay rehearsal");
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
  "\nStage 4B-4 audio, golden corpus, and closure rehearsal passed. Production pilot remains NO-GO; external STT egress remains disabled; Stage 4C remains blocked until Phase 11 closure.",
);
