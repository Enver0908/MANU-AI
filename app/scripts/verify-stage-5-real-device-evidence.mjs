#!/usr/bin/env node
/**
 * Validates manually captured Stage 5 real-device PWA evidence.
 * This script never approves emulators. It only accepts a signed-off evidence
 * artifact with existing local screenshots/logs for the required captures.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, relative } from "node:path";
import { buildStage5EvidenceHeader, docsRoot } from "./lib/stage-5-evidence.mjs";

const evidencePath = join(docsRoot, "PHASE_85_STAGE_5_REAL_DEVICE_EVIDENCE_STATUS.json");
const validationReportPath = join(docsRoot, "PHASE_85_STAGE_5_REAL_DEVICE_VALIDATION_REPORT.json");
const REQUIRED_CAPTURES = ["iphoneSafari", "iphonePwa", "androidChrome", "androidPwa", "offlinePrivacyLock"];
const REQUIRED_ROUTES = ["/dashboard", "/dashboard?section=clients", "/dashboard?section=messages", "/dashboard/ai-chat", "/dashboard/settings"];

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function resolveArtifactPath(path) {
  if (typeof path !== "string" || !path.trim()) return null;
  return normalize(isAbsolute(path) ? path : join(docsRoot, path));
}

function isInsideDocs(path) {
  const rel = relative(docsRoot, path);
  return rel && !rel.startsWith("..") && !isAbsolute(rel);
}

function requiredCaptureStatus(evidence, normalizedArtifacts = {}) {
  return Object.fromEntries(
    REQUIRED_CAPTURES.map((captureId) => {
      const capture = evidence?.deviceCaptures?.[captureId];
      const hasArtifacts = (normalizedArtifacts[captureId]?.length ?? 0) > 0;
      const passed =
        capture?.status === "PASS" &&
        capture.realDevice === true &&
        capture.emulator !== true &&
        Array.isArray(capture.routeWalk) &&
        REQUIRED_ROUTES.every((route) => capture.routeWalk.includes(route)) &&
        hasArtifacts;
      return [captureId, passed];
    }),
  );
}

function writeValidationReport(status, blockers, details = [], evidence = null, normalizedArtifacts = {}) {
  mkdirSync(dirname(validationReportPath), { recursive: true });
  const report = {
    ...buildStage5EvidenceHeader("real_device", "npm run test:stage-5-real-device"),
    status,
    productionStatus: "NO-GO",
    requiredCaptures: requiredCaptureStatus(evidence, normalizedArtifacts),
    blockers,
    details,
    expectedCaptureIds: REQUIRED_CAPTURES,
    expectedRouteWalk: REQUIRED_ROUTES,
    sourceEvidencePath: evidencePath,
    validationReportPath,
  };
  writeFileSync(validationReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

function writeBlocked(blockers, details = [], evidence = null, normalizedArtifacts = {}) {
  mkdirSync(dirname(evidencePath), { recursive: true });
  const validation = writeValidationReport("BLOCKED", blockers, details, evidence, normalizedArtifacts);
  const existing = evidence ?? {};
  const report = {
    ...existing,
    ...buildStage5EvidenceHeader("real_device", "npm run test:stage-5-real-device"),
    status: "BLOCKED",
    productionStatus: "NO-GO",
    requiredCaptures: validation.requiredCaptures,
    blockers,
    details,
    instructions:
      "Populate this file with real iPhone Safari/PWA and Android Chrome/PWA capture metadata plus local screenshot/log artifacts. Emulator or browser device emulation is rejected.",
    expectedCaptureIds: REQUIRED_CAPTURES,
    expectedRouteWalk: REQUIRED_ROUTES,
    previousStatus: existing?.status ?? null,
    evidencePath,
    validationReportPath,
  };
  writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function validateArtifact(captureId, artifact, blockers, details) {
  const resolved = resolveArtifactPath(artifact?.path);
  if (!resolved) {
    blockers.push(`${captureId}_artifact_path_missing`);
    return null;
  }
  if (!isInsideDocs(resolved)) {
    blockers.push(`${captureId}_artifact_outside_docs`);
    details.push({ captureId, artifactPath: artifact.path, reason: "artifact_must_be_under_docs" });
    return null;
  }
  if (!existsSync(resolved)) {
    blockers.push(`${captureId}_artifact_missing`);
    details.push({ captureId, artifactPath: artifact.path, reason: "file_not_found" });
    return null;
  }
  const actual = sha256(resolved);
  if (artifact.sha256 && artifact.sha256 !== actual) {
    blockers.push(`${captureId}_artifact_hash_mismatch`);
    details.push({ captureId, artifactPath: artifact.path, expected: artifact.sha256, actual });
    return null;
  }
  return { ...artifact, path: relative(docsRoot, resolved).replace(/\\/g, "/"), sha256: actual };
}

function validateEvidence(evidence) {
  const blockers = [];
  const details = [];
  const normalizedArtifacts = {};

  if (!evidence) {
    return { blockers: ["real_device_evidence_missing"], details, normalizedArtifacts };
  }
  if (evidence.schemaVersion !== "stage5-evidence-v2") blockers.push("schema_version_invalid");
  if (evidence.evidenceType !== "real_device") blockers.push("evidence_type_invalid");
  if (evidence.status !== "APPROVED") blockers.push("status_not_approved");
  if (!evidence.approvedBy || typeof evidence.approvedBy !== "string") blockers.push("approved_by_missing");
  if (!evidence.capturedAt || Number.isNaN(Date.parse(evidence.capturedAt))) blockers.push("captured_at_invalid");

  for (const captureId of REQUIRED_CAPTURES) {
    const capture = evidence.deviceCaptures?.[captureId];
    if (!capture) {
      blockers.push(`${captureId}_missing`);
      continue;
    }
    if (capture.status !== "PASS") blockers.push(`${captureId}_not_passed`);
    if (capture.realDevice !== true || capture.emulator === true) blockers.push(`${captureId}_not_real_device`);
    if (!Array.isArray(capture.routeWalk) || REQUIRED_ROUTES.some((route) => !capture.routeWalk.includes(route))) {
      blockers.push(`${captureId}_route_walk_incomplete`);
    }
    if (!Array.isArray(capture.artifacts) || capture.artifacts.length === 0) {
      blockers.push(`${captureId}_artifacts_missing`);
    } else {
      normalizedArtifacts[captureId] = capture.artifacts
        .map((artifact) => validateArtifact(captureId, artifact, blockers, details))
        .filter(Boolean);
    }
  }

  const offline = evidence.deviceCaptures?.offlinePrivacyLock;
  if (offline) {
    if (offline.noClientNamesVisible !== true) blockers.push("offline_privacy_client_names_visible_or_unverified");
    if (offline.protectedContentUnmounted !== true) blockers.push("offline_privacy_content_not_unmounted");
  }

  return { blockers: [...new Set(blockers)], details, normalizedArtifacts };
}

const evidence = readJson(evidencePath);
const result = validateEvidence(evidence);

if (result.blockers.length > 0) {
  writeBlocked(result.blockers, result.details, evidence, result.normalizedArtifacts);
  console.error("[stage-5-real-device] BLOCKED");
  for (const blocker of result.blockers) console.error(`- ${blocker}`);
  process.exit(1);
}

writeValidationReport("APPROVED", [], [], evidence, result.normalizedArtifacts);
const approved = {
  ...evidence,
  ...buildStage5EvidenceHeader("real_device", "npm run test:stage-5-real-device"),
  status: "APPROVED",
  productionStatus: "NO-GO",
  requiredCaptures: Object.fromEntries(REQUIRED_CAPTURES.map((capture) => [capture, true])),
  normalizedArtifacts: result.normalizedArtifacts,
  blockers: [],
  evidencePath,
  validationReportPath,
};
writeFileSync(evidencePath, `${JSON.stringify(approved, null, 2)}\n`, "utf8");
console.log("[stage-5-real-device] APPROVED real-device PWA evidence validated.");
