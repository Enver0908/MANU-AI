import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const knownAuditFindings = new Set(["next:postcss", "postcss:GHSA-qx2v-qp2m-jg93"]);

const checks = [
  { label: "core package tests", command: "npm", args: ["test"], cwd: "../dietitian-ai-assistant" },
  { label: "lint", command: "npm", args: ["run", "lint"] },
  { label: "unit tests", command: "npm", args: ["test"] },
  { label: "production build", command: "npm", args: ["run", "build"], before: cleanNextBuildOutput },
];

for (const check of checks) {
  run(check);
}

runDependencyAuditGate();

console.log("Release verification passed. R-405 remains a documented production launch blocker.");

function run({ label, command, args, cwd, before }) {
  console.log(`\n[release:verify] ${label}`);
  if (typeof before === "function") {
    before();
  }
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function cleanNextBuildOutput() {
  rmSync(".next", { force: true, recursive: true });
}

function runDependencyAuditGate() {
  console.log("\n[release:verify] production dependency audit");
  const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  const audit = parseAuditJson(output);
  const findings = collectAuditFindings(audit);
  const unknownFindings = findings.filter((finding) => !knownAuditFindings.has(finding.key));
  const severeFindings = findings.filter((finding) => ["high", "critical"].includes(finding.severity));

  if (unknownFindings.length > 0 || severeFindings.length > 0) {
    console.error("Production dependency audit failed.");
    for (const finding of [...unknownFindings, ...severeFindings]) {
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
    if (vulnerability.name === "next" && includesVia(vulnerability, "postcss")) {
      return [{ key: "next:postcss", severity: vulnerability.severity }];
    }

    if (vulnerability.name === "postcss" && includesAdvisory(vulnerability, "GHSA-qx2v-qp2m-jg93")) {
      return [{ key: "postcss:GHSA-qx2v-qp2m-jg93", severity: vulnerability.severity }];
    }

    return [{ key: `${vulnerability.name}:unknown`, severity: vulnerability.severity ?? "unknown" }];
  });
}

function includesVia(vulnerability, name) {
  return (vulnerability.via || []).some((item) => item === name || item?.name === name);
}

function includesAdvisory(vulnerability, advisoryId) {
  return (vulnerability.via || []).some((item) => typeof item?.url === "string" && item.url.includes(advisoryId));
}
