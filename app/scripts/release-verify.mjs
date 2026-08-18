import { rmSync } from "node:fs";
import { spawnWithTimeoutSync } from "./lib/spawn-with-timeout.mjs";

const isolatedUnitTestEnv = {
  MANU_DEV_FALLBACK_STORE: "true",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  STAGE_4C_FULL_REHEARSAL: "",
};

const checks = [
  { label: "core package tests", command: "npm", args: ["test"], cwd: "../dietitian-ai-assistant" },
  { label: "lint", command: "npm", args: ["run", "lint"] },
  { label: "production typecheck", command: "npm", args: ["run", "typecheck"] },
  {
    label: "unit tests",
    command: "npm",
    args: ["test"],
    env: isolatedUnitTestEnv,
    timeoutMs: 2_400_000,
  },
  { label: "production build", command: "npm", args: ["run", "build"], before: cleanNextBuildOutput },
  { label: "stage-5 dependency security verify", command: "npm", args: ["run", "test:stage-5-dependencies"] },
  { label: "stage-5 shell verify", command: "npm", args: ["run", "test:stage-5-shell"] },
];

for (const check of checks) {
  run(check);
}

runDependencyAuditGate();

console.log("Release verification passed. Production dependency audit is clean; R-405 is technically resolved.");

function run({ label, command, args, cwd, env, before, timeoutMs }) {
  console.log(`\n[release:verify] ${label}`);
  if (typeof before === "function") {
    before();
  }
  const result = spawnWithTimeoutSync({
    label,
    command,
    args,
    cwd,
    env,
    timeoutMs: timeoutMs ?? 900_000,
    stdio: "inherit",
  });

  if (result.status !== "pass") {
    process.exit(result.exitCode ?? 1);
  }
}

function cleanNextBuildOutput() {
  // Windows + OneDrive can throw ENOTEMPTY when another build still holds .next open.
  rmSync(".next", { force: true, recursive: true, maxRetries: 10, retryDelay: 500 });
}

function runDependencyAuditGate() {
  console.log("\n[release:verify] production dependency audit");
  const result = spawnWithTimeoutSync({
    label: "production_dependency_audit",
    command: "npm",
    args: ["audit", "--omit=dev", "--json"],
    timeoutMs: 120_000,
  });

  if (result.status === "timeout") {
    console.error("Production dependency audit timed out.");
    process.exit(1);
  }

  const output = `${result.output || ""}`.trim();
  const audit = parseAuditJson(output);
  const totalVulnerabilities = Number(audit.metadata?.vulnerabilities?.total ?? 0);

  if (result.status !== "pass" || totalVulnerabilities !== 0) {
    console.error("Production dependency audit failed.");
    for (const finding of collectAuditFindings(audit)) {
      console.error(`- ${finding.key} (${finding.severity})`);
    }
    process.exit(1);
  }

  console.log("Production dependency audit passed with zero production vulnerabilities.");
}

function parseAuditJson(output) {
  try {
    return JSON.parse(output);
  } catch {
    console.error("Could not parse npm audit JSON output.");
    process.exit(1);
  }
}

function collectAuditFindings(audit) {
  if (!audit?.metadata?.vulnerabilities || !audit?.vulnerabilities) {
    console.error("npm audit JSON output is missing expected vulnerability metadata.");
    process.exit(1);
  }

  return Object.values(audit.vulnerabilities).flatMap((vulnerability) => {
    if (vulnerability.name === "next") {
      const findings = [];
      if (includesVia(vulnerability, "postcss")) {
        findings.push({ key: "next:postcss", severity: vulnerability.severity });
      }
      if (includesVia(vulnerability, "sharp")) {
        findings.push({ key: "next:sharp", severity: vulnerability.severity });
      }
      return findings.length > 0 ? findings : [{ key: "next:unknown", severity: vulnerability.severity ?? "unknown" }];
    }

    if (vulnerability.name === "postcss") {
      return collectAdvisoryFindings(vulnerability, "postcss");
    }

    if (vulnerability.name === "sharp") {
      return collectAdvisoryFindings(vulnerability, "sharp");
    }

    return [{ key: `${vulnerability.name}:unknown`, severity: vulnerability.severity ?? "unknown" }];
  });
}

function includesVia(vulnerability, name) {
  return (vulnerability.via || []).some((item) => item === name || item?.name === name);
}

function collectAdvisoryFindings(vulnerability, packageName) {
  const findings = (vulnerability.via || [])
    .filter((item) => typeof item?.url === "string")
    .map((item) => {
      const advisory = String(item.url).split("/").pop() || "unknown";
      return { key: `${packageName}:${advisory}`, severity: item.severity ?? vulnerability.severity ?? "unknown" };
    });
  return findings.length > 0
    ? findings
    : [{ key: `${packageName}:unknown`, severity: vulnerability.severity ?? "unknown" }];
}
