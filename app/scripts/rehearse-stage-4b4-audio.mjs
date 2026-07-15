import { spawnSync } from "node:child_process";

const targetedStage4B4Tests = [
  "src/lib/phase-85-stage-4b4-voice-contracts.test.ts",
  "src/lib/phase-85-stage-4b4-provider-gate.test.ts",
  "src/lib/phase-85-stage-4b4-mock-transcription-provider.test.ts",
  "src/lib/phase-85-stage-4b4-audio-canonicalizer.test.ts",
  "src/lib/phase-85-stage-4b4-audio-admission.test.ts",
  "src/lib/phase-85-stage-4b4-transcription-worker.test.ts",
  "src/lib/phase-85-stage-4b4-transcript-bridge.test.ts",
  "src/lib/phase-85-stage-4b4-voice-bundle-orchestration.test.ts",
  "src/lib/phase-85-stage-4b3-bundle-orchestration.test.ts",
  "src/lib/phase-85-stage-4b4-transcript-corrections.test.ts",
  "src/lib/phase-85-stage-4b4-transcript-correction-bounded.test.ts",
  "src/lib/phase-85-stage-4b4-supabase-mappers.test.ts",
];

console.log("[rehearse:stage-4b4:audio] starting Stage 4B-4 audio and transcription rehearsal");

for (const suite of targetedStage4B4Tests) {
  console.log(`\n[rehearse:stage-4b4:audio] ${suite}`);
  const result = spawnSync("npx", ["vitest", "run", suite], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(
  "\nStage 4B-4 audio and transcription rehearsal passed. Production pilot remains NO-GO; external STT egress remains disabled.",
);
