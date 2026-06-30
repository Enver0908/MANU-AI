import { spawnSync } from "node:child_process";
import {
  buildPhase79fEvidenceFromRunResult,
  buildPhase79fPendingEvidence,
  isLocalSupabaseRlsConfigured,
  type Phase79CurrentRlsEvidence,
} from "./phase-79f-current-rls-evidence";

export const PHASE_80E_VERSION = "phase80-current-rls-evidence-v1";

export type Phase80eCurrentRlsEvidenceReport = {
  phase80eVersion: string;
  generatedAt: string;
  runAttempted: boolean;
  evidence: Phase79CurrentRlsEvidence;
  r406NarrativeForPhase80: string;
  launchGateImpact: "readiness_evidence_only";
  closesLaunchGate: false;
};

export function buildPhase80eR406Narrative(evidence: Phase79CurrentRlsEvidence) {
  if (evidence.status === "pass") {
    return "Phase 50/52 baseline local RLS mitigation remains valid; current post-76N/77AA-77AI/79 migration/RLS re-run complete.";
  }
  if (evidence.status === "fail") {
    return "Phase 50/52 baseline local RLS mitigation remains valid; current post-76N/77AA-77AI/79 migration/RLS re-run failed and must be remediated before production GO.";
  }
  return "Phase 50/52 baseline local RLS mitigation remains valid; current post-76N/77AA-77AI/79 migration/RLS re-run pending when local Supabase is unavailable.";
}

export function buildPhase80eCurrentRlsEvidenceReport(input: {
  evidence: Phase79CurrentRlsEvidence;
  generatedAt?: string;
  runAttempted?: boolean;
}): Phase80eCurrentRlsEvidenceReport {
  return {
    phase80eVersion: PHASE_80E_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    runAttempted: input.runAttempted ?? input.evidence.runAttempted,
    evidence: input.evidence,
    r406NarrativeForPhase80: buildPhase80eR406Narrative(input.evidence),
    launchGateImpact: "readiness_evidence_only",
    closesLaunchGate: false,
  };
}

export function runPhase80eCurrentRlsEvidencePass(options: {
  cwd?: string;
  env?: Record<string, string | undefined>;
  now?: string;
} = {}): Phase80eCurrentRlsEvidenceReport {
  const env = options.env ?? process.env;
  const localSupabaseAvailable = isLocalSupabaseRlsConfigured(env);
  const result = spawnSync("npm", ["run", "test:rls"], {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    env: env as NodeJS.ProcessEnv,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  const evidence = localSupabaseAvailable
    ? buildPhase79fEvidenceFromRunResult({
        exitCode: result.status ?? 1,
        output,
        localSupabaseAvailable: true,
        runAttempted: true,
      })
    : buildPhase79fPendingEvidence({
        localSupabaseAvailable: false,
        runAttempted: true,
        failures: output.includes("skipped")
          ? ["local_supabase_unavailable", "rls_integration_suite_skipped"]
          : ["local_supabase_unavailable", "current_migration_rls_re_run_pending"],
      });

  return buildPhase80eCurrentRlsEvidenceReport({
    evidence,
    generatedAt: options.now,
    runAttempted: true,
  });
}
