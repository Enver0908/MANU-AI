#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, relative } from "node:path";
import { buildStage5EvidenceHeader, docsRoot } from "./lib/stage-5-evidence.mjs";

const evidencePath = join(docsRoot, "PHASE_85_STAGE_7_REAL_DEVICE_EVIDENCE_STATUS.json");
const reportPath = join(docsRoot, "PHASE_85_STAGE_7_REAL_DEVICE_VALIDATION_REPORT.json");

const requiredCaptureIds = ["androidChrome", "androidPwa", "androidTalkBack", "iphoneSafari", "iphonePwa"];
const waivableCaptureIds = new Set(["iphoneSafari", "iphonePwa"]);
const requiredAndroidSteps = [
  "public_contact",
  "login",
  "purchase_valid",
  "install_guidance",
  "dashboard_shell",
  "client_workspace",
  "forms_dirty_or_save",
  "nutrition_or_menu",
  "messaging",
  "alerts_or_notifications",
  "settings_or_more",
  "offline_privacy_lock",
];
const requiredTalkBackSteps = [
  "launch",
  "landmarks",
  "skip_or_primary_navigation",
  "purchase_or_login_form",
  "dashboard_shell",
  "client_workspace",
  "messaging",
  "offline_privacy_lock",
];

function readEvidence() {
  if (!existsSync(evidencePath)) return null;
  return JSON.parse(readFileSync(evidencePath, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function resolveArtifactPath(artifactPath) {
  if (typeof artifactPath !== "string" || !artifactPath.trim()) return null;
  return normalize(isAbsolute(artifactPath) ? artifactPath : join(docsRoot, artifactPath));
}

function validateArtifact(captureId, artifact, blockers, details) {
  const resolved = resolveArtifactPath(artifact?.path);
  if (!resolved) {
    blockers.push(`${captureId}_artifact_path_missing`);
    return null;
  }
  const rel = relative(docsRoot, resolved);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
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
  return { ...artifact, path: rel.replace(/\\/g, "/"), sha256: actual };
}

function requiredStepsFor(captureId) {
  return captureId === "androidTalkBack" ? requiredTalkBackSteps : requiredAndroidSteps;
}

function validateCapture(captureId, capture, blockers, details, normalizedArtifacts) {
  if (waivableCaptureIds.has(captureId)) {
    if (capture?.status !== "WAIVED_NOT_EXECUTED") blockers.push(`${captureId}_waiver_status_invalid`);
    if (capture?.executionStatus !== "NOT_EXECUTED") blockers.push(`${captureId}_execution_status_invalid`);
    if (capture?.realDevice === true || capture?.emulator === true) blockers.push(`${captureId}_waiver_device_claim_invalid`);
    if ((capture?.workflowWalk?.length ?? 0) > 0) blockers.push(`${captureId}_waiver_workflow_claim_invalid`);
    if ((capture?.artifacts?.length ?? 0) > 0) blockers.push(`${captureId}_waiver_artifact_claim_invalid`);
    normalizedArtifacts[captureId] = [];
    return;
  }

  if (!capture) {
    blockers.push(`${captureId}_missing`);
    normalizedArtifacts[captureId] = [];
    return;
  }
  if (capture.status !== "PASS") blockers.push(`${captureId}_status_not_pass`);
  if (capture.realDevice !== true || capture.emulator === true) blockers.push(`${captureId}_not_real_device`);
  if (captureId === "androidTalkBack" && capture.assistiveTechnology !== "TalkBack") {
    blockers.push("androidTalkBack_assistive_technology_invalid");
  }
  const requiredSteps = requiredStepsFor(captureId);
  if (!Array.isArray(capture.workflowWalk) || requiredSteps.some((step) => !capture.workflowWalk.includes(step))) {
    blockers.push(`${captureId}_workflow_walk_incomplete`);
  }
  const artifacts = Array.isArray(capture.artifacts) ? capture.artifacts : [];
  normalizedArtifacts[captureId] = artifacts
    .map((artifact) => validateArtifact(captureId, artifact, blockers, details))
    .filter(Boolean);
  if (normalizedArtifacts[captureId].length === 0) blockers.push(`${captureId}_artifacts_missing`);

  if (captureId !== "androidTalkBack" && capture.offlinePrivacyLock) {
    if (capture.offlinePrivacyLock.protectedContentUnmounted !== true) {
      blockers.push(`${captureId}_offline_protected_content_not_unmounted`);
    }
    if (capture.offlinePrivacyLock.noClientNamesVisible !== true) {
      blockers.push(`${captureId}_offline_client_names_visible_or_unverified`);
    }
  }
}

function validateEvidence(evidence) {
  const blockers = [];
  const details = [];
  const normalizedArtifacts = {};

  if (!evidence) {
    return {
      blockers: ["stage_7_real_device_evidence_missing"],
      details,
      normalizedArtifacts,
    };
  }

  if (evidence.status === "BLOCKED" && !evidence.deviceCaptures) {
    return {
      blockers: ["stage_7_real_device_evidence_missing"],
      details,
      normalizedArtifacts,
    };
  }

  if (evidence.schemaVersion !== "stage7-real-device-v1") blockers.push("schema_version_invalid");
  if (!["APPROVED_WITH_WAIVER", "APPROVED"].includes(evidence.status)) blockers.push("status_not_approved");
  if (evidence.productionStatus !== "NO-GO") blockers.push("production_status_invalid");
  if (!evidence.approvedBy || typeof evidence.approvedBy !== "string") blockers.push("approved_by_missing");
  if (!evidence.capturedAt || Number.isNaN(Date.parse(evidence.capturedAt))) blockers.push("captured_at_invalid");

  const waiver = evidence.riskAcceptance;
  const waivedCaptureIds = new Set(Array.isArray(waiver?.waivedCaptureIds) ? waiver.waivedCaptureIds : []);
  if (!waivedCaptureIds.has("iphoneSafari") || !waivedCaptureIds.has("iphonePwa")) {
    blockers.push("iphone_waiver_scope_invalid");
  }
  for (const captureId of waivedCaptureIds) {
    if (!waivableCaptureIds.has(captureId)) blockers.push(`${captureId}_waiver_not_allowed`);
  }
  if (!waiver?.acceptedBy) blockers.push("risk_acceptance_accepted_by_missing");
  if (!waiver?.acceptedAt || Number.isNaN(Date.parse(waiver.acceptedAt))) blockers.push("risk_acceptance_date_invalid");
  if (waiver?.productionStatus !== "NO-GO") blockers.push("risk_acceptance_production_status_invalid");
  if (waiver?.iosPilotRequirement !== "REQUIRED_BEFORE_IOS_PILOT") {
    blockers.push("risk_acceptance_ios_pilot_requirement_invalid");
  }

  for (const captureId of requiredCaptureIds) {
    validateCapture(captureId, evidence.deviceCaptures?.[captureId], blockers, details, normalizedArtifacts);
  }

  return {
    blockers: [...new Set(blockers)],
    details,
    normalizedArtifacts,
  };
}

function writeStatusAndReport(status, blockers, details, evidence, normalizedArtifacts) {
  mkdirSync(dirname(evidencePath), { recursive: true });
  const report = {
    ...buildStage5EvidenceHeader("stage_7_real_device", "npm run test:stage-7-real-device"),
    schemaVersion: "stage7-real-device-validation-v1",
    status,
    productionStatus: "NO-GO",
    sourceEvidencePath: evidencePath,
    validationReportPath: reportPath,
    requiredCaptureIds,
    requiredAndroidSteps,
    requiredTalkBackSteps,
    waivedCaptureIds: ["iphoneSafari", "iphonePwa"],
    blockers,
    details,
    normalizedArtifacts,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (status === "BLOCKED") {
    const blockedEvidence = {
      ...(evidence ?? {}),
      ...buildStage5EvidenceHeader("stage_7_real_device", "npm run test:stage-7-real-device"),
      schemaVersion: evidence?.schemaVersion ?? "stage7-real-device-v1",
      status: "BLOCKED",
      productionStatus: "NO-GO",
      instructions:
        "Populate this file with physical Android Chrome, installed Android PWA, and Android TalkBack PASS metadata plus local screenshot/log artifacts. Browser emulation is rejected. iPhone Safari/PWA must remain WAIVED_NOT_EXECUTED unless a separate user decision changes Stage 7 scope.",
      requiredCaptureIds,
      requiredAndroidSteps,
      requiredTalkBackSteps,
      blockers,
      details,
      evidencePath,
      validationReportPath: reportPath,
    };
    writeFileSync(evidencePath, `${JSON.stringify(blockedEvidence, null, 2)}\n`, "utf8");
  }

  return report;
}

const evidence = readEvidence();
const result = validateEvidence(evidence);
const status = result.blockers.length === 0 ? "APPROVED_WITH_WAIVER" : "BLOCKED";
const report = writeStatusAndReport(status, result.blockers, result.details, evidence, result.normalizedArtifacts);

console.log(JSON.stringify({ status: report.status, blockers: report.blockers }, null, 2));
if (result.blockers.length > 0) process.exitCode = 1;
