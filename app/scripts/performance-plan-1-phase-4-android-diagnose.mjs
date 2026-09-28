#!/usr/bin/env node

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import {
  classifyPhase4Sample,
  collectAndroidTarget,
  collectMeasurementRound,
  connectPhase4AndroidCdp,
  disconnectCdpBrowser,
  hostedConfiguration,
  installPerformanceObservers,
  launchAndroidChromeTarget,
  navigateAndroidChromeHostedTarget,
  PHASE_4_FIXTURES,
  PHASE_4_SCENARIOS,
  sanitizePhase4Evidence,
} from "./performance-plan-1-phase-4.mjs";
import { inspectPhaseRuns } from "../../tools/phase-execution/checkpoint-store.mjs";
import {
  closePhaseCycle,
  openOrResumePhaseCycle,
} from "../../tools/phase-execution/phase-cycle-store.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const phaseId = "aiya-performance-plan1-phase4";
const checkpointRoot = join(repoRoot, ".manu-runtime", "phase-execution");
const evidencePath = join(
  repoRoot,
  "docs",
  "AIYA_PERFORMANCE_PLAN_1_PHASE_4_ANDROID_DIAGNOSTIC_EVIDENCE.json",
);
const diagnosticSchemaVersion = "aiya-performance-plan1-phase4-android-diagnostic-v1";
const repetitionCount = 3;

function selectedRunId() {
  const requestedIndex = process.argv.indexOf("--run");
  const requested = requestedIndex >= 0 ? process.argv[requestedIndex + 1] : null;
  if (requested && !requested.startsWith("--")) return requested;
  return inspectPhaseRuns({ root: checkpointRoot, phaseId })
    .filter((run) => run.status !== "COMPLETE")
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .at(0)?.runId;
}

function safeError(error) {
  return String(error instanceof Error ? error.message : error)
    .split("\n")[0]
    .slice(0, 240);
}

function safeRequest(request) {
  return {
    method: request.method,
    route: request.route,
    status: request.status ?? null,
    failure: request.failure ?? null,
    timeout: request.timeout === true,
    headerReceivedMs: Number.isFinite(request.headerReceivedMs)
      ? request.headerReceivedMs
      : null,
    bodyFinishedMs: Number.isFinite(request.bodyFinishedMs)
      ? request.bodyFinishedMs
      : null,
  };
}

function summarizeSample(sample, scenarioId) {
  const scenario = PHASE_4_SCENARIOS.find((item) => item.scenarioId === scenarioId);
  const classification = scenario ? classifyPhase4Sample(sample, scenario) : null;
  return {
    scenarioId,
    sampleId: sample.sampleId,
    authenticated: sample.authenticated === true,
    error: sample.error ?? null,
    loginResponseStatus: sample.loginResponseStatus ?? null,
    readySelectorMatched: sample.readySelectorMatched === true,
    targetUsable: sample.targetUsable === true,
    trustedInteraction: sample.trustedInteraction === true,
    taskReadyMs: sample.taskReadyMs ?? null,
    eventToNextPaintMs: sample.eventToNextPaintMs ?? null,
    maxLongTaskMs: sample.maxLongTaskMs ?? null,
    missingReads: sample.missingReads ?? [],
    failedRequestCount: sample.failedRequestCount ?? 0,
    requests: (sample.requests ?? []).map(safeRequest),
    validityStatus: classification?.validityStatus ?? "UNKNOWN",
    functionalStatus: classification?.functionalStatus ?? "UNKNOWN",
    budgetStatus: classification?.budgetStatus ?? "UNKNOWN",
    validityProblems: classification?.validityProblems ?? [],
    budgetProblems: classification?.budgetProblems ?? [],
  };
}

function summarizeRound(round) {
  return {
    status: round ? (round.invalidReason ? "DISCARDED" : "CAPTURED") : "FAILED",
    invalidReason: round?.invalidReason ?? null,
    invalidScenarioId: round?.invalidScenarioId ?? null,
    samples: round
      ? Object.fromEntries(
          [...round.attemptSamples.entries()].map(([scenarioId, sample]) => [
            scenarioId,
            summarizeSample(sample, scenarioId),
          ]),
        )
      : {},
  };
}

function stableIssueSignature(value) {
  return String(value ?? "unknown")
    .split(":")[0]
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

function issueSignatures(repetitions) {
  const counts = new Map();
  const add = (signature) => {
    const key = String(signature).slice(0, 200);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (const repetition of repetitions) {
    if (repetition.error) add(`repetition_error:${stableIssueSignature(repetition.error)}`);
    const round = repetition.round;
    if (round?.invalidReason) add(`round_invalid:${stableIssueSignature(round.invalidReason)}`);
    for (const sample of Object.values(round?.samples ?? {})) {
      const scenarioId = sample.scenarioId || "unknown_scenario";
      for (const problem of sample.validityProblems ?? []) {
        add(`validity:${scenarioId}:${stableIssueSignature(problem)}`);
      }
      for (const problem of sample.budgetProblems ?? []) {
        add(`budget:${scenarioId}:${stableIssueSignature(problem)}`);
      }
      if (sample.error) add(`sample_error:${scenarioId}:${stableIssueSignature(sample.error)}`);
    }
  }
  return [...counts.entries()]
    .map(([signature, count]) => ({ signature, count }))
    .sort((a, b) => b.count - a.count || a.signature.localeCompare(b.signature));
}

function safeTarget(target) {
  return {
    status: target?.status ?? "BLOCKED",
    reason: target?.reason ?? null,
    model: target?.model ?? null,
    androidVersion: target?.androidVersion ?? null,
    chromeVersionName: target?.chromeVersionName ?? null,
    chromeLaunchStatus: target?.chromeLaunchStatus ?? null,
    cdpForwardStatus: target?.cdpForwardStatus ?? null,
    pwaStatus: target?.pwa?.status ?? null,
  };
}

function writeEvidence(value, password) {
  const sanitized = sanitizePhase4Evidence(value, "", [password]);
  writeFileSync(evidencePath, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
  const cycleFilePart = String(sanitized.cycleId || "latest")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .slice(0, 180);
  const historyPath = join(
    repoRoot,
    "docs",
    `AIYA_PERFORMANCE_PLAN_1_PHASE_4_ANDROID_DIAGNOSTIC_EVIDENCE_HISTORY_${cycleFilePart}.json`,
  );
  writeFileSync(historyPath, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
  return sanitized;
}

async function main() {
  const runId = selectedRunId();
  if (!runId) throw new Error("phase4_diagnostic_checkpoint_run_not_found");
  const cycle = openOrResumePhaseCycle({
    root: checkpointRoot,
    phaseId,
    runId,
    trigger: "android_discard_reason_diagnosis",
    evidenceRefs: ["docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_ANDROID_DIAGNOSTIC_EVIDENCE.json"],
  });
  const checkpoint = cycle.run;
  let browser = null;
  let diagnostic = {
    phase: "AIya Performance Plan 1 Phase 4 Android diagnostic cycle",
    schemaVersion: diagnosticSchemaVersion,
    generatedAt: new Date().toISOString(),
    runId,
    cycleId: cycle.cycleId,
    cycleNumber: cycle.cycleNumber,
    mode: "diagnostic_only",
    officialSamplesAdded: 0,
    environment: "android_chrome",
    repetitions: [],
    target: null,
    launch: null,
    navigation: null,
    connectionMonitoring: null,
    result: {
      status: "BLOCKED",
      reason: null,
      repeatedFailureSignatures: [],
      observedIssueSignatures: [],
      repeatedIssueSignatures: [],
    },
  };

  try {
    const configuration = hostedConfiguration();
    checkpoint.append("phase.cycle.diagnosis", {
      cycleId: cycle.cycleId,
      environment: "android_chrome",
      repetitionCount,
      officialSamplesAdded: 0,
      configurationStatus: configuration.status,
    });
    if (configuration.status !== "READY") {
      diagnostic.result.reason = configuration.reason || "hosted_configuration_blocked";
      diagnostic.result.observedIssueSignatures = issueSignatures(diagnostic.repetitions);
      const evidence = writeEvidence(diagnostic, configuration.password);
      closePhaseCycle(checkpoint, {
        cycleId: cycle.cycleId,
        state: "BLOCKED",
        reason: diagnostic.result.reason,
        evidenceRefs: ["docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_ANDROID_DIAGNOSTIC_EVIDENCE.json"],
      });
      console.log(JSON.stringify({ status: "BLOCKED", runId, cycleId: cycle.cycleId, evidence: evidence.result }, null, 2));
      return;
    }

    const target = collectAndroidTarget({ includeRuntime: true });
    const runtime = target.runtime ?? null;
    diagnostic.target = safeTarget(target);
    diagnostic.connectionMonitoring = runtime?.monitor?.evidence() ?? null;
    if (target.status !== "READY_FOR_CDP_CAPTURE") {
      diagnostic.result.reason = target.reason || "android_target_not_ready";
    } else {
      diagnostic.launch = launchAndroidChromeTarget(target, runtime, configuration.baseUrl);
      if (diagnostic.launch.status !== "PASS") {
        diagnostic.result.reason = diagnostic.launch.reason || "android_chrome_launch_blocked";
      } else {
        browser = await connectPhase4AndroidCdp();
        const navigation = await navigateAndroidChromeHostedTarget(
          browser,
          new URL(configuration.baseUrl).origin,
          runtime?.monitor ?? null,
          "android_diagnostic",
        );
        diagnostic.navigation = {
          status: navigation.status,
          navigation: navigation.navigation,
          reason: navigation.reason,
        };
        if (navigation.status !== "PASS" || !navigation.target) {
          diagnostic.result.reason = navigation.reason || "android_chrome_target_blocked";
        } else {
          const page = navigation.target.page;
          const context = navigation.target.context;
          await page.bringToFront().catch(() => undefined);
          await installPerformanceObservers(page);
          const fixture = {
            id: PHASE_4_FIXTURES.normal.id,
            fixtureClass: PHASE_4_FIXTURES.normal.fixtureClass,
            email: configuration.email,
            password: configuration.password,
          };
          for (let index = 1; index <= repetitionCount; index += 1) {
            const startedAt = new Date().toISOString();
            let round = null;
            let error = null;
            const trace = [];
            try {
              round = await collectMeasurementRound(page, context, configuration.baseUrl, fixture, {
                androidCdp: true,
                trace,
              });
            } catch (caught) {
              error = safeError(caught);
            }
            diagnostic.repetitions.push({
              repetition: index,
              startedAt,
              finishedAt: new Date().toISOString(),
              error,
              trace,
              round: summarizeRound(round),
              connectionAfter: runtime?.monitor?.check(`diagnostic_after_repetition_${index}`) ?? null,
            });
          }
          const reasons = diagnostic.repetitions
            .map((item) => item.round.invalidReason || item.error)
            .filter(Boolean);
          diagnostic.result = {
            status: reasons.length ? "BLOCKED" : "COMPLETE",
            reason: reasons.length ? "diagnostic_failures_captured" : null,
            repeatedFailureSignatures: [...new Set(reasons)],
            observedIssueSignatures: issueSignatures(diagnostic.repetitions),
            repeatedIssueSignatures: issueSignatures(diagnostic.repetitions)
              .filter((item) => item.count >= 3)
              .map((item) => item.signature),
          };
        }
      }
    }
    diagnostic.connectionMonitoring = runtime?.monitor?.evidence() ?? diagnostic.connectionMonitoring;
    const evidence = writeEvidence(diagnostic, configuration.password);
    checkpoint.append("phase.cycle.diagnosis.completed", {
      cycleId: cycle.cycleId,
      environment: "android_chrome",
      repetitionCount: diagnostic.repetitions.length,
      officialSamplesAdded: 0,
      result: diagnostic.result,
    });
    closePhaseCycle(checkpoint, {
      cycleId: cycle.cycleId,
      state: "BLOCKED",
      reason: diagnostic.result.reason || "diagnostic_complete_requires_targeted_fix_or_next_cycle",
      evidenceRefs: ["docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_ANDROID_DIAGNOSTIC_EVIDENCE.json"],
      details: { officialSamplesAdded: 0, repetitionCount: diagnostic.repetitions.length },
    });
    console.log(JSON.stringify({ status: diagnostic.result.status, runId, cycleId: cycle.cycleId, evidence: evidence.result }, null, 2));
    if (diagnostic.result.status !== "COMPLETE") process.exitCode = 1;
  } catch (error) {
    diagnostic.result = {
      status: "BLOCKED",
      reason: safeError(error),
      repeatedFailureSignatures: [],
      observedIssueSignatures: issueSignatures(diagnostic.repetitions),
      repeatedIssueSignatures: [],
    };
    const evidence = writeEvidence(diagnostic, null);
    closePhaseCycle(checkpoint, {
      cycleId: cycle.cycleId,
      state: "BLOCKED",
      reason: diagnostic.result.reason,
      evidenceRefs: ["docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_ANDROID_DIAGNOSTIC_EVIDENCE.json"],
      details: { officialSamplesAdded: 0 },
    });
    console.error(JSON.stringify({ status: "BLOCKED", runId, cycleId: cycle.cycleId, evidence: evidence.result }, null, 2));
    process.exitCode = 1;
  } finally {
    if (browser) disconnectCdpBrowser(browser);
    checkpoint.close();
  }
}

main().catch((error) => {
  console.error(safeError(error));
  process.exit(1);
});
