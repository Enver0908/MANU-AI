import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const appRoot = path.join(repoRoot, "app");
const requireFromApp = createRequire(path.join(appRoot, "package.json"));
const { chromium } = requireFromApp("playwright");
const { createClient } = requireFromApp("@supabase/supabase-js");
const PROJECT_ID = "manu-ai-local";
const DEMO_EMAIL = "demo@manu.local";
const DEMO_PASSWORD = "phase-5-local-demo-password";
const ADMIN_EMAIL = "phase5-admin@manu.local";
const ADMIN_PASSWORD = "phase-5-local-admin-password";
const LOCAL_API_URL_PATTERN = /^https?:\/\/(?:127\.0\.0\.1|localhost):54321(?:\/)?$/i;

function commandName(name) {
  if (process.platform !== "win32") return name;
  if (name === "docker") return "docker.exe";
  return ["npx", "npm"].includes(name) ? `${name}.cmd` : name;
}

function redact(value, secrets = []) {
  let output = String(value ?? "");
  for (const secret of secrets.filter(Boolean)) output = output.split(secret).join("[redacted-secret]");
  return output
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/(SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|password|token|secret)[^\r\n]{0,120}/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-5_000);
}

function run(command, args, options = {}) {
  const result = spawnSync(commandName(command), args, {
    cwd: options.cwd ?? appRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: options.timeout ?? 180_000,
    maxBuffer: 50 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    status: result.status,
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? ""),
    error: result.error?.message ?? null,
    timedOut: result.error?.code === "ETIMEDOUT",
  };
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function flattenStatus(value, prefix = "", output = new Map()) {
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    const flatKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) flattenStatus(child, flatKey, output);
    else {
      output.set(normalizeKey(flatKey), child);
      output.set(normalizeKey(key), child);
    }
  }
  return output;
}

function parseStatus(result) {
  try {
    const flat = flattenStatus(JSON.parse(result.stdout));
    const pick = (aliases) => {
      for (const alias of aliases) {
        const value = flat.get(normalizeKey(alias));
        if (typeof value === "string" && value.trim()) return value.trim();
      }
      return null;
    };
    return {
      apiUrl: pick(["api.url", "api_url", "API URL", "API_URL"]),
      anonKey: pick(["auth.anon_key", "anon_key", "anon key", "ANON_KEY"]),
      serviceRoleKey: pick(["auth.service_role_key", "service_role_key", "service_role key", "SERVICE_ROLE_KEY"]),
    };
  } catch {
    const text = `${result.stdout}\n${result.stderr}`;
    return {
      apiUrl: text.match(/API URL:\s*(\S+)/i)?.[1] ?? null,
      anonKey: text.match(/anon key:\s*(\S+)/i)?.[1] ?? null,
      serviceRoleKey: text.match(/service_role key:\s*(\S+)/i)?.[1] ?? null,
    };
  }
}

function supabase(args, options = {}) {
  return run("npx", ["supabase", ...args], { ...options, cwd: appRoot });
}

async function ensureLocalAuthUser(localStatus, email, password) {
  const admin = createClient(localStatus.apiUrl, localStatus.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const users = await admin.auth.admin.listUsers({ perPage: 1_000 });
  if (users.error) throw users.error;
  const existing = users.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    const updated = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (updated.error) throw updated.error;
    return updated.data.user.id;
  }
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  return created.data.user.id;
}

function copyStandaloneAssets() {
  const standaloneRoot = path.join(appRoot, ".next", "standalone");
  const staticSource = path.join(appRoot, ".next", "static");
  const staticTarget = path.join(standaloneRoot, ".next", "static");
  if (!existsSync(standaloneRoot) || !existsSync(staticSource)) throw new Error("standalone_build_output_missing");
  cpSync(staticSource, staticTarget, { recursive: true, force: true });
  const publicSource = path.join(appRoot, "public");
  if (existsSync(publicSource)) cpSync(publicSource, path.join(standaloneRoot, "public"), { recursive: true, force: true });
  return { staticCopied: true, publicCopied: existsSync(publicSource) };
}

async function waitForHttp(url, child, timeoutMs = 45_000) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0) return response.status;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`next_server_not_ready:${redact(lastError?.message ?? "process_exited")}`);
}

function stopProcess(child) {
  if (!child || child.exitCode !== null) return { status: "NOT_RUNNING", exitCode: child?.exitCode ?? null };
  if (process.platform === "win32" && child.pid) {
    const result = run("taskkill", ["/PID", String(child.pid), "/T", "/F"], { cwd: repoRoot, timeout: 30_000 });
    if (result.status === 0) return { status: "PASS", exitCode: result.status };
    const remaining = run("tasklist", ["/FI", `PID eq ${child.pid}`], { cwd: repoRoot, timeout: 15_000 });
    const stillRunning = new RegExp(`\\b${child.pid}\\b`).test(`${remaining.stdout}\n${remaining.stderr}`);
    return { status: stillRunning ? "FAIL" : "PASS", exitCode: result.status };
  }
  child.kill("SIGTERM");
  return { status: "PASS", exitCode: 0 };
}

async function main() {
  const baseUrl = "http://127.0.0.1:3120";
  const steps = {};
  const blockers = [];
  let supabaseStarted = false;
  let seedProcess = null;
  let nextProcess = null;
  let localStatus = null;
  let browser = null;
  const nextLogs = { stdout: "", stderr: "" };
  const commandTail = [];

  const cli = supabase(["--version"], { timeout: 60_000 });
  steps.supabaseCli = { status: cli.status === 0 ? "PASS" : "FAIL", exitCode: cli.status, version: cli.status === 0 ? cli.stdout.trim() : null };
  if (cli.status !== 0) blockers.push("supabase_cli_unavailable");

  const docker = run("docker", ["version", "--format", "json"], { cwd: appRoot, timeout: 60_000 });
  steps.docker = { status: docker.status === 0 ? "PASS" : "FAIL", exitCode: docker.status };
  if (docker.status !== 0) blockers.push("docker_preflight_failed");

  try {
    if (blockers.length === 0) {
      const start = supabase(["start"], { timeout: 300_000 });
      supabaseStarted = true;
      steps.supabaseStart = { status: start.status === 0 ? "PASS" : "FAIL", exitCode: start.status };
      commandTail.push(start.stdout, start.stderr);
      if (start.status !== 0) blockers.push("supabase_start_failed");
    }

    if (blockers.length === 0) {
      const status = supabase(["status", "-o", "json"], { timeout: 120_000 });
      localStatus = parseStatus(status);
      const credentialsPresent = Boolean(localStatus.apiUrl && localStatus.anonKey && localStatus.serviceRoleKey);
      const localOnly = LOCAL_API_URL_PATTERN.test(localStatus.apiUrl ?? "");
      steps.supabaseStatus = { status: status.status === 0 && credentialsPresent && localOnly ? "PASS" : "FAIL", exitCode: status.status, localOnly, credentialsPresent };
      commandTail.push(status.stdout, status.stderr);
      if (status.status !== 0 || !credentialsPresent || !localOnly) blockers.push("supabase_status_not_local_or_missing_credentials");
    }

    if (blockers.length === 0) {
      const reset = supabase(["db", "reset", "--local"], { timeout: 300_000 });
      steps.supabaseReset = { status: reset.status === 0 ? "PASS" : "FAIL", exitCode: reset.status };
      commandTail.push(reset.stdout, reset.stderr);
      if (reset.status !== 0) blockers.push("supabase_db_reset_failed");
    }

    if (blockers.length === 0) {
      const commonEnv = {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: localStatus.apiUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: localStatus.anonKey,
        SUPABASE_URL: localStatus.apiUrl,
        SUPABASE_SERVICE_ROLE_KEY: localStatus.serviceRoleKey,
        MANU_DEV_FALLBACK_STORE: "false",
        AI_CHAT_UI_ENABLED: "true",
        AI_CHAT_DETERMINISTIC_MODE: "true",
        MANU_ALLOW_REAL_ZAI: "false",
        MANU_WHATSAPP_REAL_WEBHOOK_ENABLED: "false",
        MANU_MEDIA_REAL_PROVIDER_ENABLED: "false",
        MANU_ALLOW_REMOTE_RLS_TESTS: "false",
        MANU_DEMO_PASSWORD: DEMO_PASSWORD,
      };

      // The local demo endpoint is deliberately development-only. Use a
      // short-lived dev server only to seed the local fixture, then exercise
      // the production artifact through the real password-login route.
      seedProcess = spawn(commandName("npx"), ["next", "dev", "--webpack", "--port", "3121"], {
        cwd: appRoot,
        env: { ...commonEnv, NODE_ENV: "development", MANU_ALLOW_PUBLIC_DEMO_LOGIN: "true" },
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
        windowsHide: true,
      });
      let seedStdout = "";
      let seedStderr = "";
      seedProcess.stdout?.on("data", (chunk) => { seedStdout += String(chunk); });
      seedProcess.stderr?.on("data", (chunk) => { seedStderr += String(chunk); });
      await waitForHttp("http://127.0.0.1:3121/login", seedProcess);
      const seedResponse = await fetch("http://127.0.0.1:3121/api/demo-login", { method: "POST", redirect: "manual" });
      const seedLocation = seedResponse.headers.get("location");
      steps.localFixtureSeed = { status: seedResponse.status === 303 && seedLocation === "/dashboard" ? "PASS" : "FAIL", httpStatus: seedResponse.status, location: seedLocation };
      commandTail.push(seedStdout, seedStderr);
      if (steps.localFixtureSeed.status !== "PASS") blockers.push("local_fixture_seed_failed");
      const seedCleanup = stopProcess(seedProcess);
      steps.seedServerCleanup = seedCleanup;
      if (seedCleanup.status === "FAIL") blockers.push("seed_server_cleanup_failed");
      seedProcess = null;

      if (blockers.length === 0) {
        const productionBuild = run("npm", ["run", "build"], {
          cwd: appRoot,
          env: { ...commonEnv, NODE_ENV: "production" },
          timeout: 1_200_000,
        });
        steps.productionBuild = {
          status: productionBuild.status === 0 ? "PASS" : "FAIL",
          exitCode: productionBuild.status,
          timedOut: productionBuild.timedOut,
        };
        commandTail.push(productionBuild.stdout, productionBuild.stderr);
        if (productionBuild.status !== 0) blockers.push("production_build_failed");
      }

      if (blockers.length === 0) {
        await ensureLocalAuthUser(localStatus, ADMIN_EMAIL, ADMIN_PASSWORD);
        const standaloneAssets = copyStandaloneAssets();
        const { buildReleaseIdentity, sanitizeReleaseIdForCache } = await import(
          pathToFileURL(path.join(appRoot, "scripts", "lib", "release-identity.mjs")).href,
        );
        const releaseIdentity = buildReleaseIdentity({
          repoRoot,
          env: { ...commonEnv, NODE_ENV: "production" },
        });
        const releaseEnv = {
          MANU_RELEASE_ID: releaseIdentity.releaseId,
          MANU_RELEASE_COMMIT_SHA: releaseIdentity.commitSha,
          MANU_RELEASE_BUILT_AT: releaseIdentity.builtAt,
          MANU_RELEASE_ENVIRONMENT: releaseIdentity.environment,
          MANU_RELEASE_MIGRATION_FINGERPRINT: releaseIdentity.migrationFingerprint,
          MANU_RELEASE_COMPATIBILITY_VERSION: releaseIdentity.compatibilityVersion,
          MANU_SW_CACHE_VERSION: sanitizeReleaseIdForCache(releaseIdentity.releaseId),
          NEXT_PUBLIC_SIRIUSAI_APP_VERSION: releaseIdentity.compatibilityVersion,
          SIRIUSAI_APP_DEPLOYMENT_VERSION: releaseIdentity.compatibilityVersion,
          SIRIUSAI_SHELL_MIN_CLIENT_VERSION: releaseIdentity.compatibilityVersion,
        };
        const productionEnv = {
          ...commonEnv,
          ...releaseEnv,
          NODE_ENV: "production",
          MANU_ALLOW_PUBLIC_DEMO_LOGIN: "false",
          MANU_ADMIN_EMAIL_ALLOWLIST: ADMIN_EMAIL,
          PORT: "3120",
          HOSTNAME: "127.0.0.1",
        };
        const serverScript = path.join(appRoot, ".next", "standalone", "server.js");
        nextProcess = spawn(process.execPath, [serverScript], {
          cwd: path.dirname(serverScript),
          env: productionEnv,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        });
        nextProcess.stdout?.on("data", (chunk) => { nextLogs.stdout += String(chunk); });
        nextProcess.stderr?.on("data", (chunk) => { nextLogs.stderr += String(chunk); });
        const readyStatus = await waitForHttp(`${baseUrl}/login`, nextProcess);
        const serverReady = readyStatus >= 200 && readyStatus < 400;
        steps.releaseIdentity = {
          status: "PASS",
          releaseId: releaseIdentity.releaseId,
          compatibilityVersion: releaseIdentity.compatibilityVersion,
          migrationFingerprint: releaseIdentity.migrationFingerprint,
        };
        steps.nextServer = { status: serverReady ? "PASS" : "FAIL", httpStatus: readyStatus, fallbackStore: false, serverKind: "next-standalone", standaloneAssets };
        commandTail.push(nextLogs.stdout, nextLogs.stderr);
        if (!serverReady) blockers.push("production_server_http_failed");

        if (blockers.length === 0) {
          browser = await chromium.launch({ headless: true });
          const context = await browser.newContext();
          const page = await context.newPage();
          const demoResponse = await context.request.post(`${baseUrl}/api/demo-login`, { maxRedirects: 0 });
          steps.productionDemoGate = { status: demoResponse.status() === 403 ? "PASS" : "FAIL", httpStatus: demoResponse.status() };
          if (steps.productionDemoGate.status !== "PASS") blockers.push("production_demo_gate_not_fail_closed");

          const customerLogin = await context.request.post(`${baseUrl}/api/auth/password-login`, {
            data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
          });
          const customerPayload = await customerLogin.json().catch(() => ({}));
          const customerPass = customerLogin.status() === 200 && customerPayload.authenticated === true;
          steps.customerPasswordLogin = { status: customerPass ? "PASS" : "FAIL", httpStatus: customerLogin.status(), authenticated: customerPayload.authenticated === true, error: customerPayload.error ?? null, serverAliveAfterRequest: nextProcess.exitCode === null };
          if (!customerPass) blockers.push("customer_password_login_failed");

          if (blockers.length === 0) {
            const dashboard = await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30_000 });
            await page.locator('[data-testid="authenticated-shell"]').waitFor({ state: "visible", timeout: 30_000 });
            const dashboardShell = await page.locator('[data-testid="authenticated-shell"]').count() > 0;
            const bootstrap = await context.request.get(`${baseUrl}/api/shell/bootstrap`);
            const appState = await context.request.get(`${baseUrl}/api/app-state?view=windowed`);
            const settings = await page.goto(`${baseUrl}/dashboard/settings`, { waitUntil: "domcontentloaded", timeout: 30_000 });
            await page.locator('[data-testid="settings-page"]').waitFor({ state: "visible", timeout: 30_000 });
            const settingsShell = await page.locator('[data-testid="authenticated-shell"]').count() > 0;
            const more = await page.goto(`${baseUrl}/dashboard/more`, { waitUntil: "domcontentloaded", timeout: 30_000 });
            await page.locator('[data-testid="more-page"]').waitFor({ state: "visible", timeout: 30_000 });
            const moreShell = await page.locator('[data-testid="authenticated-shell"]').count() > 0;
            const aiChat = await page.goto(`${baseUrl}/dashboard/ai-chat`, { waitUntil: "domcontentloaded", timeout: 30_000 });
            await page.locator('[data-testid="ai-chat-workspace"]').waitFor({ state: "visible", timeout: 30_000 });
            const aiChatWorkspace = await page.locator('[data-testid="ai-chat-workspace"]').count() > 0;
            const routeChecks = {
              dashboardShell,
              bootstrap: bootstrap.status() === 200,
              appStateWindowed: appState.status() === 200,
              settings: settings?.status() === 200 && settingsShell,
              more: more?.status() === 200 && moreShell,
              aiChat: aiChat?.status() === 200 && aiChatWorkspace,
            };
            steps.authenticatedReadFlow = {
              status: Object.values(routeChecks).every(Boolean) ? "PASS" : "FAIL",
              routeChecks,
              routes: {
                dashboard: { httpStatus: dashboard?.status() ?? null, path: new URL(dashboard?.url() ?? page.url()).pathname },
                settings: { httpStatus: settings?.status() ?? null, shell: settingsShell },
                more: { httpStatus: more?.status() ?? null, shell: moreShell },
                aiChat: { httpStatus: aiChat?.status() ?? null, workspace: aiChatWorkspace },
              },
            };
            if (steps.authenticatedReadFlow.status !== "PASS") blockers.push("authenticated_read_flow_failed");
          }

          const adminContext = await browser.newContext();
          const adminPage = await adminContext.newPage();
          const adminLogin = await adminContext.request.post(`${baseUrl}/api/admin/auth/password-login`, {
            data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
          });
          const adminPayload = await adminLogin.json().catch(() => ({}));
          const adminLoginPass = adminLogin.status() === 200 && adminPayload.authenticated === true;
          await adminPage.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded", timeout: 30_000 });
          const adminConsoleVisible = await adminPage.getByText(new RegExp(`Oturum:\\s*${ADMIN_EMAIL}`, "i")).count() > 0;
          steps.adminPasswordLogin = { status: adminLoginPass && adminConsoleVisible ? "PASS" : "FAIL", httpStatus: adminLogin.status(), authenticated: adminPayload.authenticated === true, consoleVisible: adminConsoleVisible, error: adminPayload.error ?? null, serverAliveAfterRequest: nextProcess.exitCode === null };
          if (steps.adminPasswordLogin.status !== "PASS") blockers.push("admin_password_login_failed");
          await adminContext.close();

          const anonymous = await browser.newContext();
          steps.beforeAnonymous = { serverAlive: nextProcess.exitCode === null, exitCode: nextProcess.exitCode };
          const anonymousResponse = await anonymous.request.get(`${baseUrl}/dashboard`, { maxRedirects: 0 });
          const anonymousLocation = anonymousResponse.headers()["location"] ?? "";
          const anonymousRedirect = anonymousResponse.status() >= 300 && anonymousResponse.status() < 400 && /\/login\?next=%2Fdashboard|\/login\?next=\/dashboard/.test(anonymousLocation);
          steps.unauthenticatedRedirect = { status: anonymousRedirect ? "PASS" : "FAIL", httpStatus: anonymousResponse.status(), location: anonymousLocation };
          if (!anonymousRedirect) blockers.push("unauthenticated_dashboard_redirect_failed");
          await anonymous.close();
        }
        commandTail.push(nextLogs.stdout, nextLogs.stderr);
      }
    }
  } catch (error) {
    blockers.push(`smoke_exception:${redact(error?.message ?? error, [localStatus?.anonKey, localStatus?.serviceRoleKey])}`);
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    commandTail.push(nextLogs.stdout, nextLogs.stderr);
    const seedCleanup = stopProcess(seedProcess);
    if (seedProcess && seedCleanup.status === "FAIL") blockers.push("seed_server_cleanup_failed");
    if (seedProcess) steps.seedServerCleanup = seedCleanup;
    steps.nextServerCleanup = stopProcess(nextProcess);
    if (supabaseStarted) {
      const stop = supabase(["stop", "--project-id", PROJECT_ID, "--no-backup"], { timeout: 180_000 });
      steps.supabaseCleanup = { status: stop.status === 0 ? "PASS" : "FAIL", exitCode: stop.status };
      commandTail.push(stop.stdout, stop.stderr);
      if (stop.status !== 0) blockers.push("supabase_stop_failed");
    }
  }

  const result = {
    schemaVersion: "aiya-system-audit-phase-5-real-backend-browser-smoke-result-v1",
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    production: false,
    linkedSupabase: false,
    localOnly: true,
    target: { kind: "local_supabase", apiUrl: "http://127.0.0.1:54321", projectId: PROJECT_ID },
    environmentAssertions: {
      fallbackStore: false,
      demoFlag: "local-development-only",
      realWhatsAppEgress: false,
      realAiProviderEgress: false,
      rawMediaTransfer: false,
    },
    steps,
    blockers,
    outputTail: redact(commandTail.join("\n"), [localStatus?.anonKey, localStatus?.serviceRoleKey]),
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== "PASS") process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`FAIL phase-5-real-backend-smoke: ${redact(error?.message ?? error)}\n`);
    process.exitCode = 1;
  });
}

export { main as runRealBackendSmoke };
