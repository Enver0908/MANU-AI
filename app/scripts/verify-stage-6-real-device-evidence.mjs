#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, normalize, relative } from "node:path";
import { buildStage5EvidenceHeader, docsRoot } from "./lib/stage-5-evidence.mjs";

const evidencePath = join(docsRoot, "PHASE_85_STAGE_6_REAL_DEVICE_EVIDENCE_STATUS.json");
const reportPath = join(docsRoot, "PHASE_85_STAGE_6_REAL_DEVICE_VALIDATION_REPORT.json");
const captureIds = ["iphoneSafari", "iphonePwa", "androidChrome", "androidPwa"];
const workflowSteps = [
  "dashboard_home",
  "first_client_workspace",
  "forms_revision_save",
  "nutrition_task",
  "menu_task",
  "ai_controls",
  "client_scoped_messages",
  "guarded_second_client_switch",
  "offline_privacy_lock",
];

function readEvidence() {
  if (!existsSync(evidencePath)) return null;
  return JSON.parse(readFileSync(evidencePath, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function validateArtifact(captureId, artifact, blockers, details) {
  const resolved = normalize(isAbsolute(artifact?.path ?? "") ? artifact.path : join(docsRoot, artifact?.path ?? ""));
  const rel = relative(docsRoot, resolved);
  if (!artifact?.path || !rel || rel.startsWith("..") || isAbsolute(rel)) {
    blockers.push(`${captureId}_artifact_path_invalid`);
    return null;
  }
  if (!existsSync(resolved)) {
    blockers.push(`${captureId}_artifact_missing`);
    details.push({ captureId, path: artifact.path, reason: "file_not_found" });
    return null;
  }
  const actual = sha256(resolved);
  if (artifact.sha256 && artifact.sha256 !== actual) {
    blockers.push(`${captureId}_artifact_hash_mismatch`);
    details.push({ captureId, path: artifact.path, expected: artifact.sha256, actual });
    return null;
  }
  return { ...artifact, path: rel.replace(/\\/g, "/"), sha256: actual };
}

function main() {
  const evidence = readEvidence();
  const blockers = [];
  const details = [];
  const normalizedArtifacts = {};

  if (!evidence) blockers.push("stage_6_real_device_evidence_missing");
  if (evidence?.schemaVersion !== "stage6-real-device-v1") blockers.push("schema_version_invalid");
  if (evidence?.status !== "APPROVED") blockers.push("status_not_approved");
  if (!evidence?.approvedBy) blockers.push("approved_by_missing");
  if (!evidence?.capturedAt || Number.isNaN(Date.parse(evidence.capturedAt))) blockers.push("captured_at_invalid");

  for (const captureId of captureIds) {
    const capture = evidence?.deviceCaptures?.[captureId];
    if (capture?.status !== "PASS") blockers.push(`${captureId}_status_not_pass`);
    if (capture?.realDevice !== true || capture?.emulator === true) blockers.push(`${captureId}_not_real_device`);
    if (!workflowSteps.every((step) => capture?.workflowWalk?.includes(step))) {
      blockers.push(`${captureId}_workflow_walk_incomplete`);
    }
    const artifacts = Array.isArray(capture?.artifacts) ? capture.artifacts : [];
    normalizedArtifacts[captureId] = artifacts
      .map((artifact) => validateArtifact(captureId, artifact, blockers, details))
      .filter(Boolean);
    if (normalizedArtifacts[captureId].length === 0) blockers.push(`${captureId}_artifacts_missing`);
  }

  const uniqueBlockers = [...new Set(blockers)];
  const report = {
    ...buildStage5EvidenceHeader("stage_6_real_device", "npm run test:stage-6-real-device"),
    schemaVersion: "stage6-real-device-validation-v1",
    status: uniqueBlockers.length === 0 ? "APPROVED" : "BLOCKED",
    productionStatus: "NO-GO",
    sourceEvidencePath: evidencePath,
    requiredCaptureIds: captureIds,
    requiredWorkflowSteps: workflowSteps,
    blockers: uniqueBlockers,
    details,
    normalizedArtifacts,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: report.status, blockers: report.blockers }, null, 2));
  if (uniqueBlockers.length > 0) process.exitCode = 1;
}

main();
