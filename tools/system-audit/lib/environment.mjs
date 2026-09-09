import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { AUDIT_PLAN_ID, AUDIT_PLAN_VERSION } from "./audit-plan.mjs";
import { stableDigest } from "./audit-contract.mjs";

function parseEnvKeys(filePath) {
  if (!existsSync(filePath)) return { exists: false, keys: [] };
  const keys = [];
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/);
    if (match && !keys.includes(match[1])) keys.push(match[1]);
  }
  return { exists: true, keys: keys.sort() };
}

function safeUrlInfo(raw) {
  try {
    const parsed = new URL(raw);
    return { protocol: parsed.protocol, host: parsed.host, projectRef: parsed.hostname.split(".")[0] || null };
  } catch {
    return null;
  }
}

async function readHealth(url) {
  try {
    const response = await fetch(url, { redirect: "manual" });
    const body = await response.json().catch(() => ({}));
    return { url, httpStatus: response.status, releaseId: body.releaseId ?? null, commitSha: body.commitSha ?? null, environment: body.environment ?? null };
  } catch (error) {
    return { url, httpStatus: null, errorCategory: "temporarily_unavailable", errorName: error?.name || "Error" };
  }
}

function packageServiceMap(repoRoot) {
  const packageJsonPath = path.join(repoRoot, "app", "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const scripts = packageJson.scripts || {};
  const workers = Object.entries(scripts).filter(([key]) => key.startsWith("worker:")).map(([id, command]) => ({ id, command, verificationScenario: "phase-4.1.worker-contract" }));
  const workflowDir = path.join(repoRoot, ".github", "workflows");
  const workflows = existsSync(workflowDir) ? readdirSync(workflowDir).filter((name) => name.endsWith(".yml") || name.endsWith(".yaml")).sort().map((name) => ({ source: `.github/workflows/${name}`, verificationScenario: "phase-7.2.ci-deploy-gate" })) : [];
  return { nodeVersion: process.version, packageName: packageJson.name, packageVersion: packageJson.version, scripts: Object.keys(scripts).sort(), workers, workflows };
}

export async function buildEnvironmentMap(repoRoot, gitSnapshot) {
  const localEnv = parseEnvKeys(path.join(repoRoot, "app", ".env.local"));
  const exampleEnv = parseEnvKeys(path.join(repoRoot, "app", ".env.local.example"));
  const envKeys = [...new Set([...localEnv.keys, ...exampleEnv.keys])].sort();
  const publicSupabaseUrl = (() => {
    const text = existsSync(path.join(repoRoot, "app", ".env.local")) ? readFileSync(path.join(repoRoot, "app", ".env.local"), "utf8") : "";
    const value = text.match(/^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim();
    return value ? safeUrlInfo(value) : null;
  })();
  const hostedHealth = await Promise.all([
    readHealth("https://aiyaworkspace.com/api/health/release"),
    readHealth("https://admin.aiyaworkspace.com/api/health/release"),
  ]);
  const environmentMap = {
    schemaVersion: "aiya-system-audit-environment-map-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    capturedAt: new Date().toISOString(),
    sourceCommit: gitSnapshot.head,
    profiles: {
      local: {
        status: localEnv.exists ? "configured_key_inventory_only" : "not_configured",
        envSources: { local: localEnv, example: exampleEnv },
        supabase: publicSupabaseUrl,
        verificationScenario: "phase-1.4.local-environment-contract",
      },
      hosted_sandbox: {
        status: hostedHealth.every((item) => item.httpStatus === 200) ? "reachable_read_only" : "read_only_probe_incomplete",
        publicAdminHealth: hostedHealth,
        verificationScenario: "phase-1.4.hosted-release-contract",
      },
      production: {
        status: "NO-GO",
        configured: false,
        ownerActionRequired: true,
        reason: "Current production readiness decision explicitly blocks production launch.",
        verificationScenario: "phase-7.4.production-release-decision",
      },
    },
    environmentKeys: envKeys.map((key) => ({ key, valueRecorded: false, sensitivityClass: /KEY|TOKEN|SECRET|PASSWORD|PRIVATE|MASTER|IDENTITY/i.test(key) ? "secret_name_only" : "configuration_name_only" })),
    services: packageServiceMap(repoRoot),
    sourceControl: gitSnapshot,
  };
  environmentMap.environmentDigest = stableDigest({ ...environmentMap, environmentDigest: null });
  return environmentMap;
}
