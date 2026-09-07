#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildReleaseIdentity } from "./lib/release-identity.mjs";
import { verifyHostedSupabaseSchemaContract } from "../../tools/hosted-sandbox/deploy/lib/supabase-schema-contract.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(scriptDir, "..");
const repoRoot = path.join(appRoot, "..");

const REQUIRED_FILES = [
  "app/package.json",
  "app/src/app/api/health/release/route.ts",
  "app/src/app/api/auth/password-login/route.ts",
  "app/src/app/api/shell/bootstrap/route.ts",
  "app/supabase/migrations",
  "tools/hosted-sandbox/deploy/deploy-hosted-release.mjs",
  "tools/hosted-sandbox/deploy/lib/supabase-schema-contract.mjs",
  "README.md",
];

const REQUIRED_SCRIPTS = ["build", "lint", "typecheck", "test", "test:rls", "release:verify"];
const FORBIDDEN_PRODUCTION_FLAGS = [
  "MANU_DEV_FALLBACK_STORE",
  "MANU_ALLOW_PUBLIC_DEMO_LOGIN",
  "MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK",
  "MANU_ALLOW_MOCK_VISION",
  "MANU_ALLOW_MOCK_VOICE_TRANSCRIPTION",
  "AI_CHAT_DETERMINISTIC_MODE",
];

export function parseAuditArgs(argv = []) {
  const args = { profile: "local", runId: "", baseUrl: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--profile") args.profile = String(argv[++index] ?? "");
    else if (value.startsWith("--profile=")) args.profile = value.slice("--profile=".length);
    else if (value === "--run-id") args.runId = String(argv[++index] ?? "");
    else if (value.startsWith("--run-id=")) args.runId = value.slice("--run-id=".length);
    else if (value === "--base-url") args.baseUrl = String(argv[++index] ?? "");
    else if (value.startsWith("--base-url=")) args.baseUrl = value.slice("--base-url=".length);
    else if (value === "--help" || value === "-h") return { ...args, help: true };
    else if (!value.startsWith("-") && index === 0) args.profile = value;
    else if (!value.startsWith("-") && index === 1 && args.profile !== "local") args.baseUrl = value;
    else if (!value.startsWith("-") && index === 2 && args.baseUrl) args.runId = value;
    else throw new Error(`unknown audit argument: ${value}`);
  }
  if (!["local", "staging", "live-readonly"].includes(args.profile)) {
    throw new Error(`invalid audit profile: ${args.profile}`);
  }
  return args;
}

function result(id, status, summary, details = {}) {
  return { id, status, summary, details };
}

function runGit(args) {
  const command = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8", shell: false });
  return { status: command.status, stdout: String(command.stdout ?? "").trim(), stderr: String(command.stderr ?? "").trim() };
}

function runSupabase(args) {
  const localCommand = path.join(appRoot, "node_modules", ".bin", process.platform === "win32" ? "supabase.cmd" : "supabase");
  const command = existsSync(localCommand) ? localCommand : process.platform === "win32" ? "npx.cmd" : "npx";
  const commandArgs = existsSync(localCommand) ? args : ["supabase", ...args];
  const processResult = spawnSync(command, commandArgs, {
    cwd: appRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 120_000,
  });
  return {
    status: processResult.status,
    stdout: String(processResult.stdout ?? ""),
    stderr: String(processResult.stderr ?? ""),
    error: processResult.error?.message ?? null,
  };
}

function relativeExists(relativePath) {
  return existsSync(path.join(repoRoot, ...relativePath.split("/")));
}

function loadLocalEnv(env) {
  const envPath = path.join(appRoot, ".env.local");
  if (!existsSync(envPath)) return env;
  const merged = { ...env };
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (merged[key]) continue;
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    merged[key] = value;
  }
  return merged;
}

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function checkRepositoryInventory() {
  const gitHead = runGit(["rev-parse", "HEAD"]);
  const gitBranch = runGit(["branch", "--show-current"]);
  const gitStatus = runGit(["status", "--porcelain"]);
  const packageJson = JSON.parse(readFileSync(path.join(appRoot, "package.json"), "utf8"));
  const routeRoot = path.join(appRoot, "src", "app", "api");
  const routeCount = walkFiles(routeRoot).filter((file) => path.basename(file) === "route.ts").length;
  const migrationDir = path.join(appRoot, "supabase", "migrations");
  const migrationFiles = readdirSync(migrationDir).filter((file) => file.endsWith(".sql")).sort();
  const migrationTimestamps = migrationFiles.map((file) => file.match(/^(\d{14})_/)?.[1]).filter(Boolean);
  const duplicateTimestamps = [...new Set(migrationTimestamps.filter((stamp, index) => migrationTimestamps.indexOf(stamp) !== index))];
  const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
  const missingFiles = REQUIRED_FILES.filter((file) => !relativeExists(file));
  const missingScripts = REQUIRED_SCRIPTS.filter((name) => typeof packageJson.scripts?.[name] !== "string");
  const failures = [];
  if (gitHead.status !== 0 || !/^[a-f0-9]{40}$/.test(gitHead.stdout)) failures.push("git_head_unavailable");
  if (gitStatus.stdout) failures.push("worktree_dirty");
  if (missingFiles.length) failures.push("required_files_missing");
  if (missingScripts.length) failures.push("required_scripts_missing");
  if (duplicateTimestamps.length) failures.push("duplicate_migration_timestamps");
  if (!readme.includes("aiyaworkspace.com") || !readme.includes("Production remains `NO-GO`.")) failures.push("readme_current_authority_missing");

  return result(
    "repository_inventory",
    failures.length ? "FAIL" : "PASS",
    failures.length ? "Repository and release authority checks failed." : "Repository inventory and release authority are coherent.",
    {
      head: gitHead.stdout || null,
      branch: gitBranch.stdout || null,
      dirty: Boolean(gitStatus.stdout),
      routeCount,
      migrationCount: migrationFiles.length,
      migrationFileSetHash: hashText(migrationFiles.join("\n")),
      duplicateMigrationTimestamps: duplicateTimestamps,
      missingFiles,
      missingScripts,
      failures,
    },
  );
}

export function checkEnvironmentSafety(env, profile) {
  const enabledForbiddenFlags = FORBIDDEN_PRODUCTION_FLAGS.filter((name) => env[name] === "true");
  const isProduction = profile === "live-readonly" || env.MANU_APP_ENV === "production" || env.MANU_RELEASE_ENVIRONMENT === "production";
  if (isProduction && enabledForbiddenFlags.length) {
    return result("environment_safety", "FAIL", "Production safety flags are enabled.", { enabledForbiddenFlags });
  }
  return result("environment_safety", "PASS", "No forbidden production fixture or demo flag is enabled.", {
    profile,
    checkedFlags: FORBIDDEN_PRODUCTION_FLAGS,
    enabledForbiddenFlags,
  });
}

export function parseMigrationListOutput(output) {
  const entries = [];
  for (const line of String(output ?? "").split(/\r?\n/)) {
    const match = line.match(/^\s*(\d{14})\s*\|\s*(\d{14})?\s*\|/);
    if (!match) continue;
    entries.push({ local: match[1], remote: match[2] || null });
  }
  return entries;
}

export function checkLinkedMigrationAlignment(options = {}) {
  const command = options.run ?? (() => runSupabase(["migration", "list", "--linked"]));
  const migrationResult = command();
  if (migrationResult.status !== 0) {
    return result("migration_alignment", "BLOCKED", "Linked Supabase migration history could not be read.", {
      error: String(migrationResult.error || migrationResult.stderr || migrationResult.stdout).trim().slice(-300),
    });
  }
  const entries = parseMigrationListOutput(migrationResult.stdout);
  if (entries.length === 0) {
    return result("migration_alignment", "BLOCKED", "Supabase migration list returned no verifiable migration rows.");
  }
  const localOnly = entries.filter((entry) => entry.local && !entry.remote).map((entry) => entry.local);
  const remoteOnly = entries.filter((entry) => entry.remote && !entry.local).map((entry) => entry.remote);
  const mismatched = entries.filter((entry) => entry.local && entry.remote && entry.local !== entry.remote);
  const failures = [
    ...localOnly.map((id) => `local_only:${id}`),
    ...remoteOnly.map((id) => `remote_only:${id}`),
    ...mismatched.map((entry) => `timestamp_mismatch:${entry.local}:${entry.remote}`),
  ];
  return result(
    "migration_alignment",
    failures.length ? "FAIL" : "PASS",
    failures.length ? "Local and linked Supabase migration histories diverge." : "Local and linked Supabase migration histories are aligned.",
    { entries, localOnly, remoteOnly, mismatched, failures },
  );
}

async function fetchJson(fetchImpl, url, options = {}) {
  const response = await fetchImpl(url, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { response, body };
}

export async function checkRuntimeSurface(baseUrl, fetchImpl = fetch, expectedCommitSha = "") {
  const normalized = String(baseUrl ?? "").trim().replace(/\/$/, "");
  if (!normalized) return result("runtime_surface", "BLOCKED", "A runtime base URL is required for surface verification.");
  const checks = [
    { path: "/api/health/release", expected: 200, kind: "health" },
    { path: "/", expected: 200, kind: "public" },
    { path: "/login", expected: 200, kind: "login" },
    { path: "/admin", expected: 200, kind: "admin" },
    { path: "/api/app-state", expected: 401, kind: "unauthenticated_app_state" },
    { path: "/api/clients", expected: 401, kind: "unauthenticated_clients" },
  ];
  const observations = [];
  const failures = [];
  for (const check of checks) {
    try {
      const { response, body } = await fetchJson(fetchImpl, `${normalized}${check.path}`, { redirect: "manual" });
      observations.push({ path: check.path, status: response.status, expected: check.expected, kind: check.kind });
      if (response.status !== check.expected) failures.push(`${check.kind}:${response.status}`);
      if (check.kind === "health") {
        if (!body?.releaseId || !/^[a-f0-9]{40}$/.test(String(body.commitSha ?? ""))) {
          failures.push("health_release_identity_missing");
        } else if (expectedCommitSha && body.commitSha !== expectedCommitSha) {
          failures.push("runtime_commit_mismatch");
        }
      }
    } catch (error) {
      failures.push(`${check.kind}:request_failed`);
      observations.push({ path: check.path, error: String(error?.name ?? "unknown") });
    }
  }
  return result(
    "runtime_surface",
    failures.length ? "FAIL" : "PASS",
    failures.length ? "Runtime surface checks failed." : "Public, admin and unauthenticated API boundaries behaved as expected.",
    { baseUrl: normalized, expectedCommitSha: expectedCommitSha || null, observations, failures },
  );
}

export async function checkSupabaseSchema(env, options = {}) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return result("supabase_schema_contract", "BLOCKED", "Supabase service-role credentials are unavailable for schema verification.");
  }
  try {
    const checked = await verifyHostedSupabaseSchemaContract({ env, fetchImpl: options.fetchImpl ?? fetch });
    return result("supabase_schema_contract", "PASS", "Required hosted shell RPC contract is present and callable.", checked);
  } catch (error) {
    return result("supabase_schema_contract", "FAIL", "Required Supabase schema contract is missing or invalid.", {
      error: String(error?.message ?? error).slice(0, 240),
    });
  }
}

export async function runSystemAudit(options = {}) {
  const args = options.args ?? parseAuditArgs([]);
  const env = loadLocalEnv(options.env ?? process.env);
  const identity = buildReleaseIdentity({ repoRoot, env: { ...env, NODE_ENV: "production" } });
  const checks = [
    checkRepositoryInventory(),
    checkEnvironmentSafety(env, args.profile),
    await checkSupabaseSchema(env, options),
  ];
  if (args.profile === "live-readonly" || env.MANU_AUDIT_CHECK_LINKED_MIGRATIONS === "true") {
    checks.push(checkLinkedMigrationAlignment(options));
  }
  if (args.profile === "live-readonly" || args.baseUrl || env.MANU_AUDIT_BASE_URL) {
    checks.push(await checkRuntimeSurface(args.baseUrl || env.MANU_AUDIT_BASE_URL, options.fetchImpl ?? fetch, identity.commitSha));
  } else {
    checks.push(result("runtime_surface", "NOT_APPLICABLE", "Runtime URL was not supplied for the local static audit."));
  }
  const status = checks.some((check) => check.status === "FAIL") ? "FAIL" : checks.some((check) => check.status === "BLOCKED") ? "BLOCKED" : "PASS";
  return {
    schemaVersion: "aiya-system-audit-v1",
    runId: args.runId || `audit-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`,
    profile: args.profile,
    generatedAt: new Date().toISOString(),
    status,
    release: {
      commitSha: identity.commitSha,
      releaseId: identity.releaseId,
      migrationFingerprint: identity.migrationFingerprint,
    },
    checks,
  };
}

function walkFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function reportMarkdown(report) {
  const lines = [
    `# AIya System Audit ${report.runId}`,
    "",
    `- Status: **${report.status}**`,
    `- Profile: \`${report.profile}\``,
    `- Commit: \`${report.release.commitSha}\``,
    `- Release: \`${report.release.releaseId}\``,
    `- Generated: \`${report.generatedAt}\``,
    "",
    "## Checks",
    "",
  ];
  for (const check of report.checks) lines.push(`- \`${check.status}\` **${check.id}** — ${check.summary}`);
  lines.push("", "This report contains no secret values. A blocked check is not a passing check.", "");
  return lines.join("\n");
}

function printHelp() {
  console.log("Usage: node scripts/system-audit.mjs [--profile local|staging|live-readonly] [--base-url URL] [--run-id ID]");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseAuditArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      process.exit(0);
    }
    const report = await runSystemAudit({ args });
    const outputDir = path.join(repoRoot, ".manu-runtime", "system-audit", report.runId);
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    writeFileSync(path.join(outputDir, "report.md"), reportMarkdown(report), "utf8");
    console.log(JSON.stringify({ ...report, outputDir }, null, 2));
    process.exitCode = report.status === "PASS" ? 0 : report.status === "BLOCKED" ? 2 : 1;
  } catch (error) {
    console.error(`System audit failed to run: ${error.message}`);
    process.exitCode = 1;
  }
}
