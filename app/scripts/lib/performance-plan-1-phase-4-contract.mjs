import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { join, relative } from "node:path";

export const PHASE_4_READINESS_SCHEMA_VERSION =
  "aiya-performance-plan1-phase4-readiness-v1";

export const PHASE_4_READINESS_STAGE_IDS = ["H1", "H2", "H3", "H4"];

export const PHASE_4_FINDING_IDS = [
  "PERF-F2-001",
  "PERF-F2-002",
  "PERF-F2-003",
  "PERF-F12-001",
  "PERF-F12-002",
];

export const PHASE_4_HOSTED_ENV_RELATIVE_PATH =
  ".manu-runtime/performance-phase4/hosted.env";

export const PHASE_4_HOSTED_ENV_KEYS = [
  "AIYA_PHASE4_HOSTED_BASE_URL",
  "AIYA_PHASE4_HOSTED_EMAIL",
  "AIYA_PHASE4_HOSTED_PASSWORD",
];

export const PHASE_4_IDENTITY_PATHS = [
  "app/scripts/measure-aiya-performance-phase-2.mjs",
  "app/scripts/performance-plan-1-phase-4.mjs",
  "app/scripts/performance-plan-1-phase-4.test.mjs",
  "app/scripts/lib/performance-plan-1-phase-4-contract.mjs",
  "app/scripts/performance-plan-1-phase-4-readiness.mjs",
  "app/scripts/performance-plan-1-phase-4-readiness.test.mjs",
  "app/package.json",
  "app/package-lock.json",
  "app/next.config.ts",
  "app/public/sw.js",
  "app/public/manifest.webmanifest",
  "app/supabase/migrations/20260911070000_phase_85_stage_5_session_activity_race_fix.sql",
];

const SENSITIVE_KEY = /^(?:email|password|phone|authorization|authorisation|cookie|cookies|headers?|prompt|clinical|clientname|body|rawbody|requestbody|responsebody|payload|content|token|secret|apikey|api_key|privatekey|private_key|credential|credentials)$/i;
const SENSITIVE_KEY_FRAGMENT = /(?:access|refresh)[_-]?token|service[_-]?role|secret|private[_-]?key|api[_-]?key/i;
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const JWT_VALUE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;
const BEARER_VALUE = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/i;
const SECRET_ASSIGNMENT = /\b(?:password|token|secret|api[_-]?key|service[_-]?role[_-]?key)\s*[:=]\s*[^\s,;]+/i;
const SENSITIVE_FIELD_VALUE = /["'](?:access_token|refresh_token|authorization|password|token|secret)["']\s*:\s*["'](?!<redacted>)[^"']+/i;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function posixPath(path) {
  return path.replaceAll("\\", "/");
}

function hostedEnvPath(repoRoot) {
  return join(repoRoot, ...PHASE_4_HOSTED_ENV_RELATIVE_PATH.split("/"));
}

function normalizeHostedInput(key, value) {
  if (typeof value !== "string") return null;
  if (key === "AIYA_PHASE4_HOSTED_PASSWORD") return value;
  const normalized = value.trim();
  return key === "AIYA_PHASE4_HOSTED_BASE_URL"
    ? normalized.replace(/\/$/, "")
    : normalized;
}

function hasHostedInput(value) {
  return typeof value === "string" && value.length > 0;
}

function hostedInputPresence(values) {
  return Object.fromEntries(
    PHASE_4_HOSTED_ENV_KEYS.map((key) => [key, hasHostedInput(values[key])]),
  );
}

export function loadPhase4HostedInputs({
  repoRoot,
  environment = process.env,
} = {}) {
  if (!repoRoot) {
    return {
      status: "BLOCKED",
      reason: "hosted_env_repo_root_missing",
      filePresent: false,
      filePath: PHASE_4_HOSTED_ENV_RELATIVE_PATH,
      requiredKeys: Object.fromEntries(
        PHASE_4_HOSTED_ENV_KEYS.map((key) => [key, false]),
      ),
    };
  }

  const absolutePath = hostedEnvPath(repoRoot);
  const filePath = posixPath(relative(repoRoot, absolutePath));
  let fileValues = {};
  let filePresent = false;
  if (!existsSync(absolutePath)) {
    return {
      status: "BLOCKED",
      reason: "hosted_env_file_missing",
      filePresent: false,
      filePath,
      requiredKeys: Object.fromEntries(
        PHASE_4_HOSTED_ENV_KEYS.map((key) => [key, false]),
      ),
    };
  }

  try {
    const stats = lstatSync(absolutePath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      return {
        status: "BLOCKED",
        reason: "hosted_env_file_not_regular_file",
        filePresent: false,
        filePath,
        requiredKeys: Object.fromEntries(
          PHASE_4_HOSTED_ENV_KEYS.map((key) => [key, false]),
        ),
      };
    }
    fileValues = parseEnv(readFileSync(absolutePath, "utf8").replace(/^\uFEFF/, ""));
    filePresent = true;
  } catch {
    return {
      status: "BLOCKED",
      reason: "hosted_env_file_parse_failed",
      filePresent: false,
      filePath,
      requiredKeys: Object.fromEntries(
        PHASE_4_HOSTED_ENV_KEYS.map((key) => [key, false]),
      ),
    };
  }

  const selected = {};
  const requiredKeys = {};
  const conflicts = [];
  const missingKeys = [];
  for (const key of PHASE_4_HOSTED_ENV_KEYS) {
    const fileValue = normalizeHostedInput(key, fileValues[key]);
    const processValue = normalizeHostedInput(key, environment?.[key]);
    if (hasHostedInput(fileValue) && hasHostedInput(processValue) && fileValue !== processValue) {
      conflicts.push(key);
    }
    selected[key] = fileValue;
    requiredKeys[key] = hasHostedInput(fileValue);
    if (!requiredKeys[key]) missingKeys.push(key);
  }

  const baseResult = {
    filePresent,
    filePath,
    requiredKeys,
    fileSource: "repo_runtime_file",
  };
  if (conflicts.length) {
    return {
      status: "BLOCKED",
      reason: "hosted_env_source_conflict",
      ...baseResult,
      conflicts,
    };
  }
  if (missingKeys.length) {
    return {
      status: "BLOCKED",
      reason: "hosted_env_required_key_missing",
      ...baseResult,
      missingKeys,
    };
  }

  return {
    status: "READY",
    ...baseResult,
    source: "hosted_env_file",
    baseUrl: selected.AIYA_PHASE4_HOSTED_BASE_URL,
    email: selected.AIYA_PHASE4_HOSTED_EMAIL,
    password: selected.AIYA_PHASE4_HOSTED_PASSWORD,
    inputPresence: hostedInputPresence(selected),
  };
}

function isSensitiveKey(key) {
  const normalized = String(key ?? "").replaceAll("-", "_");
  if (/(?:present|provided|recorded|used|configured|enabled|status)$/i.test(normalized)) {
    return false;
  }
  return SENSITIVE_KEY.test(normalized) || SENSITIVE_KEY_FRAGMENT.test(normalized);
}

function isUrlKey(key) {
  const normalized = String(key ?? "").toLowerCase();
  return normalized.includes("url") || normalized.includes("endpoint") || normalized === "route";
}

function sanitizeUrl(value) {
  try {
    const parsed = new URL(String(value), "http://local.invalid");
    return parsed.origin === "http://local.invalid"
      ? parsed.pathname
      : parsed.origin + parsed.pathname;
  } catch {
    return String(value).split("?")[0];
  }
}

function looksSensitive(value, secretValues) {
  const stringValue = String(value);
  return (
    secretValues.some((secret) => secret && stringValue.includes(String(secret))) ||
    EMAIL_VALUE.test(stringValue) ||
    JWT_VALUE.test(stringValue) ||
    BEARER_VALUE.test(stringValue) ||
    SECRET_ASSIGNMENT.test(stringValue)
  );
}

export function sha256File(path) {
  return existsSync(path) ? sha256(readFileSync(path)) : null;
}

export function collectPhase4MeasurementIdentity({
  repoRoot,
  phase3Evidence = null,
  artifactPaths = [],
} = {}) {
  const files = [...new Set([...PHASE_4_IDENTITY_PATHS, ...artifactPaths])].map(
    (path) => {
      const absolutePath = join(repoRoot, path);
      return {
        path: posixPath(path),
        exists: existsSync(absolutePath),
        sha256: sha256File(absolutePath),
      };
    },
  );
  const presentFiles = files.filter((file) => file.sha256);
  const buildIdPath = join(repoRoot, "app", ".next", "BUILD_ID");
  const buildArtifact = {
    path: posixPath(relative(repoRoot, buildIdPath)),
    exists: existsSync(buildIdPath),
    sha256: sha256File(buildIdPath),
    buildId: existsSync(buildIdPath) ? readFileSync(buildIdPath, "utf8").trim() : null,
  };
  return {
    files,
    sourceFingerprint: sha256(JSON.stringify(presentFiles)),
    fixture: {
      phase3EvidenceFixtureHash: phase3Evidence?.fixture?.hash ?? null,
      phase3EvidenceHead: phase3Evidence?.sourceIdentity?.head ?? null,
      fixtureReady: phase3Evidence?.finalControls?.fixtureReady === true,
      authenticatedSessionReady:
        phase3Evidence?.finalControls?.authenticatedSessionReady === true,
    },
    buildArtifact,
  };
}

export function sanitizePhase4Evidence(value, key = "", secretValues = []) {
  if (isSensitiveKey(key)) return "<redacted>";
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePhase4Evidence(item, key, secretValues));
  }
  if (value === null || typeof value !== "object") {
    if (typeof value !== "string") return value;
    if (isUrlKey(key)) return sanitizeUrl(value);
    if (looksSensitive(value, secretValues)) return "<redacted>";
    return value;
  }
  const output = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    output[childKey] = sanitizePhase4Evidence(childValue, childKey, secretValues);
  }
  return output;
}

export function redactionCheck(value, secretValues = []) {
  const serialized = JSON.stringify(value);
  const forbiddenValues = [
    ...secretValues.filter(Boolean).map(String),
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const leakedSensitiveValues = forbiddenValues
    .filter((forbidden) => serialized.includes(forbidden))
    .map(() => "redacted_sensitive_value");
  const leakedStructuredSecrets = [EMAIL_VALUE, JWT_VALUE, BEARER_VALUE].some((pattern) =>
    pattern.test(serialized),
  );
  const leakedSensitiveFieldValue = SENSITIVE_FIELD_VALUE.test(serialized);
  return {
    status:
      leakedSensitiveValues.length === 0 &&
      !leakedStructuredSecrets &&
      !leakedSensitiveFieldValue,
    forbiddenValuesFound: [
      ...new Set([
        ...leakedSensitiveValues,
        ...(leakedStructuredSecrets ? ["structured_sensitive_value"] : []),
        ...(leakedSensitiveFieldValue ? ["sensitive_field_value"] : []),
      ]),
    ],
  };
}

export function evaluateOrderedStageLedger(stageLedger, requiredStageIds = PHASE_4_READINESS_STAGE_IDS) {
  const actualIds = (stageLedger ?? []).map((stage) => stage.stageId);
  const failures = [];
  if (actualIds.length !== requiredStageIds.length) failures.push("stage_count_mismatch");
  requiredStageIds.forEach((stageId, index) => {
    if (actualIds[index] !== stageId) failures.push(`stage_order_mismatch:${stageId}`);
  });
  if (new Set(actualIds).size !== actualIds.length) failures.push("duplicate_stage_id");
  for (const stage of stageLedger ?? []) {
    if (stage.status !== "COMPLETE") failures.push(`stage_not_complete:${stage.stageId}`);
  }
  return {
    status: failures.length === 0 ? "PASS" : "FAIL",
    failures: [...new Set(failures)],
  };
}

export function phase4ReadinessClosure({ stageLedger, tests, evidenceIntegrity }) {
  const orderedStages = evaluateOrderedStageLedger(stageLedger);
  const testResults = tests ?? [];
  const testsPass = testResults.length > 0 && testResults.every((test) => test.status === "PASS");
  const integrityPass = evidenceIntegrity?.status === "PASS";
  const blockers = [
    ...orderedStages.failures,
    ...(testsPass ? [] : ["required_readiness_test_not_pass"]),
    ...(integrityPass ? [] : ["readiness_evidence_integrity_failed"]),
  ];
  return {
    status: blockers.length === 0 ? "COMPLETE" : "BLOCKED",
    outcome: blockers.length === 0 ? "READY_FOR_PHASE4_BASELINE" : "READINESS_BLOCKED",
    blockers: [...new Set(blockers)],
    orderedStages,
    testsPass,
    evidenceIntegrityPass: integrityPass,
  };
}
