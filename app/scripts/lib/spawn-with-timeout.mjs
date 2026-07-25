import { spawn, spawnSync } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 600_000;
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

export function spawnWithTimeoutSync({
  label,
  command,
  args = [],
  cwd,
  env,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBuffer = DEFAULT_MAX_BUFFER,
  stdio = "pipe",
}) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd,
    encoding: stdio === "inherit" ? undefined : "utf8",
    stdio,
    shell: process.platform === "win32",
    timeout: timeoutMs,
    maxBuffer,
    env: { ...process.env, ...(env ?? {}) },
  });
  const output =
    stdio === "inherit" ? "" : `${result.stdout || ""}${result.stderr || ""}`;
  const timedOut = result.error?.code === "ETIMEDOUT" || result.signal === "SIGTERM";
  const status = timedOut ? "timeout" : result.status === 0 ? "pass" : "fail";
  const reason = timedOut ? "command_timeout" : status === "pass" ? "completed" : `exit_${result.status ?? 1}`;

  return {
    label,
    status,
    reason,
    exitCode: result.status ?? 1,
    durationMs: Date.now() - startedAt,
    output,
    timedOut,
    result,
  };
}

export function spawnWithTimeout({
  label,
  command,
  args = [],
  cwd,
  env,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  stdio = "inherit",
}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === "win32",
      stdio,
      env: { ...process.env, ...(env ?? {}) },
    });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 5_000).unref();
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      const status = timedOut || signal === "SIGTERM" ? "timeout" : exitCode === 0 ? "pass" : "fail";
      resolve({
        label,
        status,
        reason: timedOut ? "command_timeout" : status === "pass" ? "completed" : `exit_${exitCode ?? 1}`,
        exitCode: exitCode ?? 1,
        durationMs: Date.now() - startedAt,
        timedOut,
        signal,
      });
    });
  });
}
