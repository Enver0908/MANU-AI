import assert from "node:assert/strict";
import test from "node:test";
import {
  createDiagnosticDbLockSampler,
  diagnosticDbLockSamplerQueryForTests,
} from "./diagnostic-db-lock-sampler.mjs";

test("DB lock sampler query is aggregate-only and does not expose query text", () => {
  const query = diagnosticDbLockSamplerQueryForTests();
  assert.match(query, /pg_stat_activity/);
  assert.match(query, /pg_blocking_pids/);
  assert.doesNotMatch(query, /query\s*,/i);
  assert.doesNotMatch(query, /usename\s*,/i);
  assert.doesNotMatch(query, /application_name\s*,/i);
});

test("DB lock sampler distinguishes unavailable tooling from no lock waits", async () => {
  const sampler = createDiagnosticDbLockSampler({
    env: { AIYA_PSQL_PATH: "definitely-not-a-real-psql-binary" },
  });
  await sampler.start();
  await sampler.stop();
  const summary = sampler.summary();
  assert.equal(summary.status, "UNAVAILABLE");
  assert.equal(summary.unavailableReason, "psql_unavailable");
  assert.equal(summary.sampleCount, 0);
  assert.equal(summary.lockWaitSampleCount, 0);
});

test("DB lock sampler does not use Docker fallback unless a container is configured", async () => {
  const sampler = createDiagnosticDbLockSampler({
    env: {
      AIYA_PSQL_PATH: "definitely-not-a-real-psql-binary",
      AIYA_DB_DOCKER_CONTAINER: "",
    },
  });
  await sampler.start();
  await sampler.stop();
  assert.equal(sampler.summary().unavailableReason, "psql_unavailable");
});

test("DB lock sampler uses the configured Docker fallback and records successful samples", async () => {
  const calls = [];
  const sampler = createDiagnosticDbLockSampler({
    intervalMs: 1_000,
    env: {
      AIYA_PSQL_PATH: "missing-host-psql",
      AIYA_DOCKER_PATH: "docker",
      AIYA_DB_DOCKER_CONTAINER: "supabase_db_manu-ai-local",
    },
    execFileAsyncImpl: async (file, args) => {
      calls.push({ file, args });
      if (file === "missing-host-psql") {
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      }
      return {
        stdout: JSON.stringify({
          activeCount: 1,
          lockWaitCount: 0,
          blockedActivityCount: 0,
          maxBlockerCount: 0,
        }),
      };
    },
  });
  await sampler.start();
  await sampler.stop();
  const summary = sampler.summary();
  assert.equal(summary.status, "PASS");
  assert.equal(summary.sampleCount, 2);
  assert.equal(summary.sampleErrorCount, 0);
  assert.equal(summary.fallbackCount, 2);
  assert.equal(summary.commandSuccesses.docker, 2);
  assert.equal(calls.filter(({ file }) => file === "docker").length, 2);
});

test("DB lock sampler keeps later samples after a transient Docker failure", async () => {
  let dockerCalls = 0;
  const sampler = createDiagnosticDbLockSampler({
    intervalMs: 1_000,
    env: {
      AIYA_PSQL_PATH: "missing-host-psql",
      AIYA_DOCKER_PATH: "docker",
      AIYA_DB_DOCKER_CONTAINER: "supabase_db_manu-ai-local",
    },
    execFileAsyncImpl: async (file) => {
      if (file === "missing-host-psql") {
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      }
      dockerCalls += 1;
      if (dockerCalls === 1) {
        const error = new Error("temporary");
        error.code = "ETIMEDOUT";
        throw error;
      }
      return {
        stdout: JSON.stringify({
          activeCount: 1,
          lockWaitCount: 0,
          blockedActivityCount: 0,
          maxBlockerCount: 0,
        }),
      };
    },
  });
  await sampler.start();
  await sampler.stop();
  const summary = sampler.summary();
  assert.equal(summary.status, "PARTIAL");
  assert.equal(summary.sampleCount, 1);
  assert.equal(summary.sampleErrorCount, 1);
  assert.equal(summary.lastSampleErrorReason, "db_lock_snapshot_unreachable");
  assert.equal(summary.unavailableReason, null);
});
