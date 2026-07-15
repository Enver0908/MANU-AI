import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const once = process.argv.includes("--once");
const scriptDir = dirname(fileURLToPath(import.meta.url));

const workers = [
  {
    label: "admission",
    script: "worker-audio-stage4b4-admission.mjs",
  },
  {
    label: "transcription",
    script: "worker-audio-stage4b4-transcription.mjs",
  },
  {
    label: "bridge",
    script: "worker-audio-stage4b4-bridge.mjs",
  },
];

const children = workers.map((worker) => {
  const args = once ? ["--once"] : [];
  const child = spawn("node", [join(scriptDir, worker.script), ...args], {
    stdio: "inherit",
    env: process.env,
    shell: false,
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });
  return child;
});

const shutdown = () => {
  for (const child of children) {
    child.kill("SIGTERM");
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

if (once) {
  await Promise.all(
    children.map(
      (child) =>
        new Promise((resolve) => {
          child.on("exit", () => resolve());
        }),
    ),
  );
} else {
  await new Promise(() => {
    // Supervisor stays alive while admission and transcription workers poll.
  });
}
