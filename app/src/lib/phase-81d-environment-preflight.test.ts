import { describe, expect, it } from "vitest";
import { PRODUCTION_PILOT_LAUNCH_GATES } from "./launch-gates";
import {
  buildCompletePhase81dEnvironmentPreflightInput,
  buildPhase81dBaselineEnvironmentPreflightReport,
  buildPhase81dEnvironmentPreflightReport,
  evaluatePhase81dEnvironmentPreflight,
  summarizePhase81dEnvironmentPreflightReport,
} from "./phase-81d-environment-preflight";

const NOW = "2026-06-30T12:00:00.000Z";

describe("phase 81d environment preflight", () => {
  it("blocks the baseline when launch gate evidence is missing", () => {
    const report = buildPhase81dBaselineEnvironmentPreflightReport({ now: NOW });

    expect(report.preflightMode).toBe("dry_run_only");
    expect(report.preflightStatus).toBe("blocked");
    expect(report.goReadyBlocked).toBe(true);
    expect(report.checks.allLaunchGatesApproved).toBe(false);
    expect(report.checks.realZaiEgressAllowed).toBe(false);
    expect(report.blockingReasons.some((reason) => reason.includes("missing approved launch gate"))).toBe(
      true,
    );
  });

  it("passes a complete dry-run preflight when all evidence is present", () => {
    const report = buildPhase81dEnvironmentPreflightReport({
      preflight: buildCompletePhase81dEnvironmentPreflightInput(),
      now: NOW,
    });

    expect(report.preflightStatus).toBe("ready");
    expect(report.goReadyBlocked).toBe(false);
    expect(report.checks.allLaunchGatesApproved).toBe(true);
    expect(report.checks.launchAuthorizationApproved).toBe(true);
    expect(report.checks.opsGatesApproved).toBe(true);
    expect(report.checks.webhookApprovedExternalEvidence).toBe(true);
    expect(report.checks.conservativeClientAiPosture).toBe(true);
    expect(report.checks.realZaiEgressAllowed).toBe(true);
    expect(report.checks.realWhatsappEgressAllowed).toBe(true);
    expect(report.productionPilotGoReady).toBe(false);
    expect(report.productionPilotStarted).toBe(false);
  });

  it("does not allow MANU_ALLOW_REAL_ZAI to bypass missing gate evidence", () => {
    const evaluation = evaluatePhase81dEnvironmentPreflight({
      productionEnvIdentity: "production",
      allowRealZaiFlag: "true",
      approvedGateIds: [],
      launchAuthorizationApproved: false,
      webhookApprovedExternalEvidence: false,
      globalRollbackControlDeclared: false,
      globalAutopilotEnablement: false,
    });

    expect(evaluation.checks.realZaiEgressAllowed).toBe(false);
    expect(evaluation.blockingReasons).toContain(
      "MANU_ALLOW_REAL_ZAI cannot bypass missing Phase 75/provider launch gate evidence",
    );
  });

  it("does not allow real WhatsApp egress without channel gate and launch authorization", () => {
    const evaluation = evaluatePhase81dEnvironmentPreflight({
      productionEnvIdentity: "production",
      allowRealWhatsappFlag: "true",
      approvedGateIds: PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id).filter(
        (gateId) => gateId !== "channel_policy_review",
      ),
      launchAuthorizationApproved: false,
      webhookApprovedExternalEvidence: true,
      globalRollbackControlDeclared: true,
      globalAutopilotEnablement: false,
    });

    expect(evaluation.checks.realWhatsappEgressAllowed).toBe(false);
    expect(evaluation.blockingReasons).toContain(
      "real WhatsApp egress cannot bypass missing channel gate or launch authorization evidence",
    );
  });

  it("blocks when secret values are marked exposed", () => {
    const evaluation = evaluatePhase81dEnvironmentPreflight(
      buildCompletePhase81dEnvironmentPreflightInput({
        secretValuesExposed: true,
      }),
    );

    expect(evaluation.preflightStatus).toBe("blocked");
    expect(evaluation.blockingReasons).toContain(
      "secret values must not be exposed in preflight evidence",
    );
  });

  it("blocks global autopilot enablement", () => {
    const evaluation = evaluatePhase81dEnvironmentPreflight(
      buildCompletePhase81dEnvironmentPreflightInput({
        globalAutopilotEnablement: true,
      }),
    );

    expect(evaluation.preflightStatus).toBe("blocked");
    expect(evaluation.blockingReasons).toContain(
      "global autopilot enablement is not allowed for production preflight",
    );
  });

  it("never records production GO or started state", () => {
    const blocked = buildPhase81dBaselineEnvironmentPreflightReport({ now: NOW });
    const ready = buildPhase81dEnvironmentPreflightReport({
      preflight: buildCompletePhase81dEnvironmentPreflightInput(),
      now: NOW,
    });

    for (const report of [blocked, ready]) {
      expect(report.productionPilotGoReady).toBe(false);
      expect(report.productionPilotStarted).toBe(false);
    }
  });

  it("summarizes preflight without leaking secret values", () => {
    const summary = summarizePhase81dEnvironmentPreflightReport(
      buildPhase81dEnvironmentPreflightReport({
        preflight: buildCompletePhase81dEnvironmentPreflightInput({
          productionEnvIdentity: "production",
        }),
        now: NOW,
      }),
    );

    expect(summary.preflightMode).toBe("dry_run_only");
    expect(JSON.stringify(summary)).not.toMatch(
      /SUPABASE_SERVICE_ROLE_KEY|manu-rls-test-password|sk-[A-Za-z0-9]+/,
    );
  });
});
