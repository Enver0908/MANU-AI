#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function runSmokeCheck(baseUrl, options = {}) {
  if (process.env.MANU_SMOKE_CHECK_FORCE_FAIL === "true") {
    throw new Error("smoke check forced fail for test");
  }
  const url = String(baseUrl ?? "http://127.0.0.1:3000").replace(/\/$/, "");
  const expectedIdentity = options.expectedIdentity ?? null;
  const paths = options.paths ?? (
    expectedIdentity
      ? [
          { path: "/api/health/release", statuses: [200], kind: "release" },
          { path: "/", statuses: [200], kind: "branded" },
          { path: "/login", statuses: [200], kind: "branded" },
          { path: "/purchase", statuses: [200], kind: "branded" },
          { path: "/app-install", statuses: [200, 307] },
          { path: "/manifest.webmanifest", statuses: [200], kind: "manifest" },
          { path: "/api/app-state", statuses: [401] },
          { path: "/api/clients", statuses: [401] },
        ]
      : [{ path: "/api/health/release", statuses: [200], kind: "release" }, { path: "/login", statuses: [200] }]
  );
  const attempts = Number(options.attempts ?? process.env.MANU_SMOKE_ATTEMPTS ?? 8);
  const retryDelayMs = Number(options.retryDelayMs ?? process.env.MANU_SMOKE_RETRY_DELAY_MS ?? 5000);
  const failures = [];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    failures.length = 0;
    for (const entry of paths) {
      await checkPath({ url, entry, expectedIdentity, failures });
    }
    if (failures.length === 0) {
      return { ok: true, checked: paths.length, attempts: attempt };
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  throw new Error("smoke check failed: " + failures.join("; "));
}

async function checkPath({ url, entry, expectedIdentity, failures }) {
    const pathname = typeof entry === "string" ? entry : entry.path;
    const statuses = typeof entry === "string" ? [200] : entry.statuses;
    const kind = typeof entry === "string" ? "" : entry.kind;
    try {
      const response = await fetch(url + pathname, {
        method: "GET",
        headers: { Accept: "application/json, text/html" },
        redirect: "manual",
      });
      if (!statuses.includes(response.status)) {
        failures.push(pathname + " status " + response.status);
        return;
      }
      if (pathname === "/api/health/release" && expectedIdentity) {
        const payload = await response.json();
        for (const key of ["releaseId", "commitSha", "migrationFingerprint", "compatibilityVersion"]) {
          if (payload[key] !== expectedIdentity[key]) {
            failures.push(pathname + " " + key + " mismatch");
          }
        }
      }
      if (kind === "branded") {
        const body = await response.text();
        if (!body.includes("AIya")) {
          failures.push(pathname + " missing AIya brand");
        }
        if (/SiriusAI|MANU-AI|AI-ya/.test(body)) {
          failures.push(pathname + " legacy brand present");
        }
      }
      if (kind === "manifest") {
        const payload = await response.json();
        if (payload.name !== "AIya" || payload.short_name !== "AIya") {
          failures.push(pathname + " manifest brand mismatch");
        }
      }
    } catch (error) {
      failures.push(pathname + " error " + (error instanceof Error ? error.message : String(error)));
    }
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
