import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const LOCK_SAMPLE_SQL = [
  "select json_build_object(",
  "'activeCount', count(*) filter (where state = 'active'),",
  "'lockWaitCount', count(*) filter (where wait_event_type = 'Lock'),",
  "'blockedActivityCount', count(*) filter (where cardinality(pg_blocking_pids(pid)) > 0),",
  "'maxBlockerCount', coalesce(max(cardinality(pg_blocking_pids(pid))), 0)",
  ")::text from pg_stat_activity where datname = current_database();",
].join(" ");

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseSnapshot(stdout) {
  try {
    const parsed = JSON.parse(String(stdout).trim());
    const snapshot = {
      activeCount: Number.isInteger(parsed.activeCount) ? parsed.activeCount : null,
      lockWaitCount: Number.isInteger(parsed.lockWaitCount) ? parsed.lockWaitCount : null,
      blockedActivityCount: Number.isInteger(parsed.blockedActivityCount)
        ? parsed.blockedActivityCount
        : null,
      maxBlockerCount: Number.isInteger(parsed.maxBlockerCount) ? parsed.maxBlockerCount : null,
    };
    return Object.values(snapshot).every((value) => Number.isInteger(value)) ? snapshot : null;
  } catch {
    return null;
  }
}

function resolvePsqlPath(env = process.env) {
  return env.AIYA_PSQL_PATH || "psql";
}

function resolveDockerPath(env = process.env) {
  return env.AIYA_DOCKER_PATH || "docker";
}

function buildPsqlArgs(env = process.env) {
  return [
    "--host",
    env.AIYA_DB_HOST || "127.0.0.1",
    "--port",
    env.AIYA_DB_PORT || "54322",
    "--username",
    env.AIYA_DB_USER || "postgres",
    "--dbname",
    env.AIYA_DB_NAME || "postgres",
    "--tuples-only",
    "--no-align",
    "--command",
    LOCK_SAMPLE_SQL,
  ];
}

function buildDockerArgs(env = process.env) {
  return [
    "exec",
    env.AIYA_DB_DOCKER_CONTAINER,
    "psql",
    "--username",
    env.AIYA_DB_USER || "postgres",
    "--dbname",
    env.AIYA_DB_NAME || "postgres",
    "--tuples-only",
    "--no-align",
    "--command",
    LOCK_SAMPLE_SQL,
  ];
}

function buildChildEnv(env = process.env) {
  const childEnv = { ...env };
  if (env.AIYA_DB_PASSWORD) childEnv.PGPASSWORD = env.AIYA_DB_PASSWORD;
  return childEnv;
}

export function createDiagnosticDbLockSampler({
  intervalMs = 50,
  env = process.env,
  now = () => Date.now(),
  execFileAsyncImpl = execFileAsync,
  commandTimeoutMs = Math.max(2_000, intervalMs * 4),
} = {}) {
  const samples = [];
  let timer = null;
  let activeSamplePromise = null;
  let terminalUnavailable = false;
  let unavailableReason = null;
  let sampleErrorCount = 0;
  let lastSampleErrorReason = null;
  let fallbackCount = 0;
  const commandAttempts = { psql: 0, docker: 0 };
  const commandSuccesses = { psql: 0, docker: 0 };

  const dockerConfigured = Boolean(String(env.AIYA_DB_DOCKER_CONTAINER || "").trim());

  function commandPlan(childOptions) {
    const commands = [
      {
        name: "psql",
        path: resolvePsqlPath(env),
        args: buildPsqlArgs(env),
      },
    ];
    if (dockerConfigured) {
      commands.push({
        name: "docker",
        path: resolveDockerPath(env),
        args: buildDockerArgs(env),
      });
    }
    return commands.map((command) => ({ ...command, options: childOptions }));
  }

  async function querySnapshot(childOptions) {
    const failures = [];
    const commands = commandPlan(childOptions);
    for (const command of commands) {
      commandAttempts[command.name] += 1;
      try {
        const result = await execFileAsyncImpl(command.path, command.args, command.options);
        const snapshot = parseSnapshot(result.stdout);
        if (snapshot) {
          commandSuccesses[command.name] += 1;
          if (command.name === "docker" && commands[0]?.name === "psql") fallbackCount += 1;
          return { snapshot, command: command.name };
        }
        failures.push({ command: command.name, reason: "db_lock_snapshot_invalid" });
      } catch (error) {
        failures.push({
          command: command.name,
          reason: error?.code === "ENOENT"
            ? `${command.name}_unavailable`
            : "db_lock_snapshot_unreachable",
        });
      }
    }
    const onlyPsqlUnavailable = failures.length === 1 && failures[0].reason === "psql_unavailable";
    const onlyInvalidSnapshots = failures.length > 0 && failures.every(
      (failure) => failure.reason === "db_lock_snapshot_invalid",
    );
    return {
      snapshot: null,
      reason: onlyPsqlUnavailable
        ? "psql_unavailable"
        : onlyInvalidSnapshots
          ? "db_lock_snapshot_invalid"
          : "db_lock_snapshot_unreachable",
    };
  }

  async function sample() {
    if (terminalUnavailable) return activeSamplePromise;
    if (activeSamplePromise) return activeSamplePromise;
    activeSamplePromise = (async () => {
      const startedAt = now();
      try {
        const result = await querySnapshot({
          env: buildChildEnv(env),
          windowsHide: true,
          timeout: commandTimeoutMs,
          maxBuffer: 8 * 1024,
        });
        if (!result.snapshot) {
          sampleErrorCount += 1;
          unavailableReason = result.reason;
          lastSampleErrorReason = result.reason;
          if (!dockerConfigured) terminalUnavailable = true;
          return;
        }
        samples.push({
          atMs: now(),
          queryDurationMs: finite(now() - startedAt),
          ...result.snapshot,
        });
      } finally {
        activeSamplePromise = null;
      }
    })();
    return activeSamplePromise;
  }

  return {
    async start() {
      await sample();
      if (terminalUnavailable) return;
      timer = setInterval(() => void sample(), intervalMs);
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = null;
      await sample();
    },
    summary() {
      const lockWaitSamples = samples.filter((sample) => sample.lockWaitCount > 0);
      const blockedSamples = samples.filter((sample) => sample.blockedActivityCount > 0);
      const status = samples.length
        ? sampleErrorCount > 0 ? "PARTIAL" : "PASS"
        : unavailableReason ? "UNAVAILABLE" : "NO_SAMPLES";
      return {
        status,
        unavailableReason: samples.length ? null : unavailableReason,
        sampleErrorCount,
        lastSampleErrorReason,
        fallbackCount,
        commandAttempts: { ...commandAttempts },
        commandSuccesses: { ...commandSuccesses },
        intervalMs,
        sampleCount: samples.length,
        lockWaitSampleCount: lockWaitSamples.length,
        blockedActivitySampleCount: blockedSamples.length,
        maxLockWaitCount: samples.reduce((max, sample) => Math.max(max, sample.lockWaitCount ?? 0), 0),
        maxBlockedActivityCount: samples.reduce(
          (max, sample) => Math.max(max, sample.blockedActivityCount ?? 0),
          0,
        ),
        maxBlockerCount: samples.reduce((max, sample) => Math.max(max, sample.maxBlockerCount ?? 0), 0),
        queryDurationMs: {
          min: samples.length ? Math.min(...samples.map((sample) => sample.queryDurationMs)) : null,
          max: samples.length ? Math.max(...samples.map((sample) => sample.queryDurationMs)) : null,
        },
        samples: samples.map((sample) => ({
          atMs: sample.atMs,
          queryDurationMs: sample.queryDurationMs,
          activeCount: sample.activeCount,
          lockWaitCount: sample.lockWaitCount,
          blockedActivityCount: sample.blockedActivityCount,
          maxBlockerCount: sample.maxBlockerCount,
        })),
      };
    },
  };
}

export function diagnosticDbLockSamplerQueryForTests() {
  return LOCK_SAMPLE_SQL;
}
