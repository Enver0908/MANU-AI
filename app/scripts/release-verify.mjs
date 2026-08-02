import { rmSync } from "node:fs";
import { spawnWithTimeoutSync } from "./lib/spawn-with-timeout.mjs";

const knownAuditFindings = new Set([
  "next:postcss",
  "next:sharp",
  "postcss:GHSA-qx2v-qp2m-jg93",
  "postcss:GHSA-6g55-p6wh-862q",
  "postcss:GHSA-r28c-9q8g-f849",
  "sharp:GHSA-f88m-g3jw-g9cj",
]);
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
  { label: "stage-5 shell verify", command: "npm", args: ["run", "test:stage-5-shell"] },
];

for (const check of checks) {
  run(check);
}

runDependencyAuditGate();

console.log("Release verification passed. R-405 remains a documented production launch blocker.");

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
  const findings = collectAuditFindings(audit);
  const unknownFindings = findings.filter((finding) => !knownAuditFindings.has(finding.key));

  if (unknownFindings.length > 0) {
    console.error("Production dependency audit failed.");
    for (const finding of unknownFindings) {
      console.error(`- ${finding.key} (${finding.severity})`);
    }
    process.exit(1);
  }

  if (findings.length > 0) {
    console.log("Known production dependency audit finding remains open:");
    for (const finding of findings) {
      console.log(`- ${finding.key} (${finding.severity})`);
    }
    console.log("Do not run npm audit fix --force; track R-405 until a safe stable Next.js/PostCSS path exists.");
  }
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
