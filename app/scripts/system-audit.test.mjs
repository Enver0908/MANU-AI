import test from "node:test";
import assert from "node:assert/strict";
import {
  checkEnvironmentSafety,
  checkLinkedMigrationAlignment,
  checkRuntimeSurface,
  parseAuditArgs,
  parseMigrationListOutput,
} from "./system-audit.mjs";

test("system audit rejects unknown profiles and parses live read-only options", () => {
  assert.deepEqual(parseAuditArgs(["--profile", "live-readonly", "--base-url", "https://example.test"]), {
    profile: "live-readonly",
    runId: "",
    baseUrl: "https://example.test",
  });
  assert.deepEqual(parseAuditArgs(["live-readonly", "https://example.test", "run-1"]), {
    profile: "live-readonly",
    runId: "run-1",
    baseUrl: "https://example.test",
  });
  assert.throws(() => parseAuditArgs(["--profile", "production"]), /invalid audit profile/);
});

test("system audit fails when production fixture flags are enabled", () => {
  const result = checkEnvironmentSafety({ MANU_DEV_FALLBACK_STORE: "true" }, "live-readonly");
  assert.equal(result.status, "FAIL");
  assert.deepEqual(result.details.enabledForbiddenFlags, ["MANU_DEV_FALLBACK_STORE"]);
});

test("system audit identifies local-only linked migrations", () => {
  const entries = parseMigrationListOutput([
    "20260903090000 | 20260903090000 | 2026-09-03 09:00:00",
    "20260903100000 |                | 2026-09-03 10:00:00",
  ].join("\n"));
  assert.deepEqual(entries, [
    { local: "20260903090000", remote: "20260903090000" },
    { local: "20260903100000", remote: null },
  ]);
  const result = checkLinkedMigrationAlignment({
    run: () => ({ status: 0, stdout: "20260903100000 |                | 2026-09-03 10:00:00", stderr: "" }),
  });
  assert.equal(result.status, "FAIL");
  assert.deepEqual(result.details.localOnly, ["20260903100000"]);
});

test("runtime audit requires controlled unauthenticated responses", async () => {
  const responses = new Map([
    ["/api/health/release", { status: 200, body: { releaseId: "hs-test", commitSha: "a".repeat(40) } }],
    ["/", { status: 200, body: {} }],
    ["/login", { status: 200, body: {} }],
    ["/admin", { status: 200, body: {} }],
    ["/api/app-state", { status: 401, body: {} }],
    ["/api/clients", { status: 200, body: {} }],
  ]);
  const result = await checkRuntimeSurface("https://example.test", async (url) => {
    const path = new URL(url).pathname;
    const entry = responses.get(path);
    return new Response(JSON.stringify(entry.body), { status: entry.status });
  });
  assert.equal(result.status, "FAIL");
  assert.match(result.details.failures.join(","), /unauthenticated_clients:200/);
});
