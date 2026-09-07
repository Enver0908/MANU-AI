import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const appRoot = join(__dirname, "../..");
export const repoRoot = join(appRoot, "..");
export const docsRoot = join(repoRoot, "docs");
export const artifactDir = join(appRoot, "test-results", "stage-7");
export const findingsPath = join(docsRoot, "PHASE_85_STAGE_7_FINDINGS.json");
export const matrixPath = join(docsRoot, "PHASE_85_STAGE_7_SCENARIO_MATRIX.json");
export const auditReportJsonPath = join(docsRoot, "PHASE_85_STAGE_7_BASELINE_AUDIT_REPORT.json");
export const auditReportMdPath = join(docsRoot, "PHASE_85_STAGE_7_BASELINE_AUDIT_REPORT.md");
export const auditEvidencePath = join(docsRoot, "PHASE_85_STAGE_7_PHASE_1_BASELINE_AUDIT_EVIDENCE.md");
export const stableArtifactDir = join(appRoot, ".stage-7r-baseline-artifacts");

export function repoRelative(filePath) {
  return relative(repoRoot, filePath).replace(/\\/g, "/");
}

const FORBIDDEN = [
  /set-cookie\s*:/i,
  /authorization\s*:\s*bearer\s+\S+/i,
  /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/,
  /\bsk_(live|test)_[a-zA-Z0-9]+\b/,
  /\b[a-z0-9._%+-]+@gmail\.com\b/i,
];

export function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function scanPrivacy(text) {
  return FORBIDDEN.filter((pattern) => pattern.test(text)).map((pattern) => String(pattern));
}

export function assertPrivacy(text, label) {
  const hits = scanPrivacy(text);
  if (hits.length) {
    throw new Error(`Stage 7 privacy scan failed for ${label}`);
  }
}

export function assertPrivacyForTextArtifacts(root, extensions = new Set([".json", ".md", ".txt", ".html"])) {
  if (!existsSync(root)) return [];
  const scanned = [];
  const visit = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        visit(path);
        continue;
      }
      const lower = name.toLowerCase();
      const extension = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
      if (!extensions.has(extension)) continue;
      assertPrivacy(readFileSync(path, "utf8"), path);
      scanned.push(path);
    }
  };
  visit(root);
  return scanned;
}

export function collectFindingFiles(dir = artifactDir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".findings.json"))
    .map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")))
    .flat();
}

export function mergeByFingerprint(findings) {
  const merged = new Map();
  for (const finding of findings) {
    if (!merged.has(finding.fingerprint)) merged.set(finding.fingerprint, finding);
  }
  return [...merged.values()].sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));
}

export function countOpenBlocking(findings) {
  return findings.filter(
    (finding) =>
      finding.status === "open" && (finding.severity === "P0" || finding.severity === "P1" || finding.severity === "P2"),
  );
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const json = `${JSON.stringify(value, null, 2)}\n`;
  assertPrivacy(json, path);
  writeFileSync(path, json);
}

export function verifyFindingsGate(findings, runMeta = {}) {
  const blockers = [];
  if (runMeta.skipped) blockers.push("skipped_tests");
  if (runMeta.flaky) blockers.push("flaky_tests");
  if (runMeta.timedOut) blockers.push("timed_out_tests");
  if (runMeta.blocked) blockers.push("blocked_tests");
  if (countOpenBlocking(findings).length > 0) blockers.push("open_p0_p1_p2");
  return { ok: blockers.length === 0, blockers, openBlocking: countOpenBlocking(findings).length };
}
