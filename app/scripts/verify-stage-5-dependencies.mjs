#!/usr/bin/env node
/**
 * Stage 5 dependency security verifier.
 * R-405 is technically resolved only when the production dependency audit is clean
 * after the stable Next.js patch path has been applied.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  appRoot,
  buildStage5EvidenceHeader,
  docsRoot,
  npmCommand,
  runCapture,
} from "./lib/stage-5-evidence.mjs";

const reportPath = join(docsRoot, "PHASE_85_STAGE_5_DEPENDENCY_SECURITY_REPORT.json");
const REQUIRED_NEXT_VERSION = "16.3.0";
const REQUIRED_ESLINT_CONFIG_NEXT_VERSION = "16.3.0";
const MIN_PATCHED_POSTCSS_VERSION = "8.5.23";
const MIN_PATCHED_SHARP_VERSION = "0.35.0";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function parseJsonOutput(commandResult, label) {
  const output = `${commandResult.stdout || ""}${commandResult.stderr || ""}`.trim();
  try {
    return JSON.parse(output || "{}");
  } catch {
    throw new Error(`${label}_json_parse_failed`);
  }
}

function compareVersions(left, right) {
  const leftParts = String(left || "0").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = String(right || "0").split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function versionAtLeast(actual, minimum) {
  return compareVersions(actual, minimum) >= 0;
}

function packageVersion(tree, name) {
  return tree.dependencies?.[name]?.version ?? null;
}

function nestedPackageVersion(tree, parentName, nestedName) {
  return tree.dependencies?.[parentName]?.dependencies?.[nestedName]?.version ?? null;
}

function collectAuditFindings(audit) {
  return Object.entries(audit.vulnerabilities ?? {}).flatMap(([name, vulnerability]) => {
    const via = Array.isArray(vulnerability.via) ? vulnerability.via : [];
    const advisoryKeys = via
      .filter((item) => item && typeof item === "object" && typeof item.url === "string")
      .map((item) => `${name}:${String(item.url).split("/").pop() || "unknown"}`);
    return advisoryKeys.length > 0
      ? advisoryKeys.map((key) => ({ key, severity: vulnerability.severity ?? "unknown" }))
      : [{ key: `${name}:direct`, severity: vulnerability.severity ?? "unknown" }];
  });
}

function addAssertion(assertions, blockers, code, passed, details = {}) {
  assertions.push({ code, passed, ...details });
  if (!passed) blockers.push(code);
}

const header = buildStage5EvidenceHeader("dependency", "npm run test:stage-5-dependencies");
const packageJson = readJson(join(appRoot, "package.json"));
const npm = npmCommand();
const auditResult = runCapture(npm, ["audit", "--omit=dev", "--json"], { timeoutMs: 120_000 });
const npmLsResult = runCapture(npm, ["ls", "next", "eslint-config-next", "postcss", "sharp", "--all", "--json"], {
  timeoutMs: 120_000,
});

let report;
try {
  const audit = parseJsonOutput(auditResult, "production_dependency_audit");
  const packageTree = parseJsonOutput(npmLsResult, "dependency_tree");
  const auditTotals = audit.metadata?.vulnerabilities ?? {};
  const auditFindingTotal = Number(auditTotals.total ?? 0);
  const nextVersion = packageVersion(packageTree, "next");
  const eslintConfigNextVersion = packageVersion(packageTree, "eslint-config-next");
  const directSharpVersion = packageVersion(packageTree, "sharp");
  const nextPostcssVersion = nestedPackageVersion(packageTree, "next", "postcss");
  const nextSharpVersion = nestedPackageVersion(packageTree, "next", "sharp");
  const assertions = [];
  const blockers = [];

  addAssertion(assertions, blockers, "next_package_json_exact_16_3_0", packageJson.dependencies?.next === REQUIRED_NEXT_VERSION, {
    actual: packageJson.dependencies?.next ?? null,
    expected: REQUIRED_NEXT_VERSION,
  });
  addAssertion(
    assertions,
    blockers,
    "eslint_config_next_package_json_exact_16_3_0",
    packageJson.devDependencies?.["eslint-config-next"] === REQUIRED_ESLINT_CONFIG_NEXT_VERSION,
    {
      actual: packageJson.devDependencies?.["eslint-config-next"] ?? null,
      expected: REQUIRED_ESLINT_CONFIG_NEXT_VERSION,
    },
  );
  addAssertion(assertions, blockers, "next_installed_16_3_0", nextVersion === REQUIRED_NEXT_VERSION, {
    actual: nextVersion,
    expected: REQUIRED_NEXT_VERSION,
  });
  addAssertion(assertions, blockers, "eslint_config_next_installed_16_3_0", eslintConfigNextVersion === REQUIRED_ESLINT_CONFIG_NEXT_VERSION, {
    actual: eslintConfigNextVersion,
    expected: REQUIRED_ESLINT_CONFIG_NEXT_VERSION,
  });
  addAssertion(assertions, blockers, "next_nested_postcss_patched", versionAtLeast(nextPostcssVersion, MIN_PATCHED_POSTCSS_VERSION), {
    actual: nextPostcssVersion,
    minimum: MIN_PATCHED_POSTCSS_VERSION,
  });
  addAssertion(assertions, blockers, "next_nested_sharp_patched", versionAtLeast(nextSharpVersion, MIN_PATCHED_SHARP_VERSION), {
    actual: nextSharpVersion,
    minimum: MIN_PATCHED_SHARP_VERSION,
  });
  addAssertion(assertions, blockers, "direct_sharp_patched", versionAtLeast(directSharpVersion, MIN_PATCHED_SHARP_VERSION), {
    actual: directSharpVersion,
    minimum: MIN_PATCHED_SHARP_VERSION,
  });
  addAssertion(assertions, blockers, "production_audit_zero_vulnerabilities", auditResult.status === 0 && auditFindingTotal === 0, {
    auditExitCode: auditResult.status,
    totals: auditTotals,
  });

  report = {
    ...header,
    status: blockers.length === 0 ? "PASS" : "FAIL",
    r405Status: blockers.length === 0 ? "technically_resolved" : "open",
    productionStatus: "NO-GO",
    packages: {
      next: nextVersion,
      eslintConfigNext: eslintConfigNextVersion,
      nextNestedPostcss: nextPostcssVersion,
      nextNestedSharp: nextSharpVersion,
      directSharp: directSharpVersion,
    },
    productionAudit: {
      status: auditResult.status === 0 && auditFindingTotal === 0 ? "PASS" : "FAIL",
      command: "npm audit --omit=dev --json",
      exitCode: auditResult.status,
      totals: auditTotals,
      findings: collectAuditFindings(audit),
    },
    assertions,
    blockers,
    evidencePath: reportPath,
  };
} catch (error) {
  report = {
    ...header,
    status: "FAIL",
    r405Status: "open",
    productionStatus: "NO-GO",
    productionAudit: {
      status: "FAIL",
      command: "npm audit --omit=dev --json",
      exitCode: auditResult.status,
    },
    assertions: [],
    blockers: [error instanceof Error ? error.message : String(error)],
    evidencePath: reportPath,
  };
}

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (report.status !== "PASS") {
  console.error("[stage-5-dependencies] FAIL");
  for (const blocker of report.blockers) {
    console.error(`- ${blocker}`);
  }
  process.exit(1);
}

console.log("[stage-5-dependencies] PASS; R-405 technically resolved by clean production dependency audit.");
console.log(`Report: ${reportPath}`);
