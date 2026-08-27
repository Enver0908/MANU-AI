#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function runSmokeCheck(baseUrl, options = {}) {
  if (process.env.MANU_SMOKE_CHECK_FORCE_FAIL === "true") {
    throw new Error("smoke check forced fail for test");
  }
  const url = String(baseUrl ?? "http://127.0.0.1:3000").replace(/\/$/, "");
  const expectedIdentity = options.expectedIdentity ?? null;
  const paths = options.paths ?? (expectedIdentity ? ["/api/health/release"] : ["/api/health/release", "/login"]);
  const failures = [];
  for (const pathname of paths) {
    try {
      const response = await fetch(url + pathname, {
        method: "GET",
        headers: { Accept: "application/json, text/html" },
        redirect: "manual",
      });
      if (response.status !== 200) {
        failures.push(pathname + " status " + response.status);
        continue;
      }
      if (pathname === "/api/health/release" && expectedIdentity) {
        const payload = await response.json();
        for (const key of ["releaseId", "commitSha", "migrationFingerprint", "compatibilityVersion"]) {
          if (payload[key] !== expectedIdentity[key]) {
            failures.push(pathname + " " + key + " mismatch");
          }
        }
      }
    } catch (error) {
      failures.push(pathname + " error " + (error instanceof Error ? error.message : String(error)));
    }
  }
  if (failures.length) {
    throw new Error("smoke check failed: " + failures.join("; "));
  }
  return { ok: true, checked: paths.length };
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    process.stdout.write(JSON.stringify({ result: "PASS", mode: "dry-run" }) + "\\n");
  } else {
    const result = await runSmokeCheck(process.env.MANU_SMOKE_BASE_URL);
    process.stdout.write(JSON.stringify({ result: "PASS", ...result }) + "\\n");
  }
}
