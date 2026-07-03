import { describe, expect, it } from "vitest";
import {
  buildCompletePhase81cLaunchAuthorizationEvidence,
  buildPhase81cBaselineAuthorizationReport,
  buildPhase81cLaunchAuthorizationReport,
  evaluatePhase81cLaunchAuthorization,
  summarizePhase81cLaunchAuthorizationReport,
} from "./phase-81c-launch-authorization-evidence";

const NOW = "2026-06-30T12:00:00.000Z";

describe("phase 81c launch authorization evidence", () => {
  it("blocks the baseline when no authorization evidence is supplied", () => {
    const report = buildPhase81cBaselineAuthorizationReport({ now: NOW });

    expect(report.intakeStatus).toBe("no_authorization_supplied");
    expect(report.authorizationStatus).toBe("no_authorization_supplied");
    expect(report.goReadyBlocked).toBe(true);
    expect(report.isLaunchGate).toBe(false);
    expect(report.authorizationKind).toBe("phase81_execution_authorization");
    expect(report.blockingReasons).toContain("no Phase 81 launch authorization evidence supplied");
  });

  it("approves complete sanitized launch authorization evidence", () => {
    const report = buildPhase81cLaunchAuthorizationReport({
      evidence: buildCompletePhase81cLaunchAuthorizationEvidence(),
      now: NOW,
    });

    expect(report.intakeStatus).toBe("authorization_supplied");
    expect(report.authorizationStatus).toBe("approved");
    expect(report.goReadyBlocked).toBe(false);
    expect(report.blockingReasons).toEqual([]);
    expect(report.productionPilotGoReady).toBe(false);
    expect(report.productionPilotStarted).toBe(false);
  });

  it("blocks when launch authorization owner is missing", () => {
    const evaluation = evaluatePhase81cLaunchAuthorization({
      evidence: buildCompletePhase81cLaunchAuthorizationEvidence({
        launchAuthorizationOwner: "",
      }),
      now: NOW,
    });

    expect(evaluation.authorizationStatus).toBe("blocked");
    expect(evaluation.blockingReasons).toContain("missing launch authorization owner");
  });

  it("blocks when approval is expired", () => {
    const evaluation = evaluatePhase81cLaunchAuthorization({
      evidence: buildCompletePhase81cLaunchAuthorizationEvidence({
        expiresAt: "2026-06-01T00:00:00.000Z",
      }),
      now: NOW,
    });

    expect(evaluation.authorizationStatus).toBe("blocked");
    expect(evaluation.blockingReasons).toContain("launch authorization approval is expired");
  });

  it("blocks draft launch authorization", () => {
    const evaluation = evaluatePhase81cLaunchAuthorization({
      evidence: buildCompletePhase81cLaunchAuthorizationEvidence({
        approvalStatus: "draft",
      }),
      now: NOW,
    });

    expect(evaluation.authorizationStatus).toBe("blocked");
    expect(evaluation.blockingReasons).toContain("launch authorization is not approved: draft");
  });

  it("blocks conditional launch authorization", () => {
    const evaluation = evaluatePhase81cLaunchAuthorization({
      evidence: buildCompletePhase81cLaunchAuthorizationEvidence({
        approvalStatus: "conditional",
      }),
      now: NOW,
    });

    expect(evaluation.authorizationStatus).toBe("blocked");
    expect(evaluation.blockingReasons).toContain(
      "launch authorization is not approved: conditional",
    );
  });

  it("blocks unsanitized artifact reference", () => {
    const evaluation = evaluatePhase81cLaunchAuthorization({
      evidence: buildCompletePhase81cLaunchAuthorizationEvidence({
        sanitizedReference: false,
      }),
      now: NOW,
    });

    expect(evaluation.authorizationStatus).toBe("blocked");
    expect(evaluation.blockingReasons).toContain(
      "launch authorization artifact reference is not marked sanitized",
    );
  });

  it("never records production GO or started state", () => {
    const blocked = buildPhase81cBaselineAuthorizationReport({ now: NOW });
    const approved = buildPhase81cLaunchAuthorizationReport({
      evidence: buildCompletePhase81cLaunchAuthorizationEvidence(),
      now: NOW,
    });

    for (const report of [blocked, approved]) {
      expect(report.productionPilotGoReady).toBe(false);
      expect(report.productionPilotStarted).toBe(false);
      expect(report.isLaunchGate).toBe(false);
    }
  });

  it("summarizes authorization without leaking secrets", () => {
    const summary = summarizePhase81cLaunchAuthorizationReport(
      buildPhase81cBaselineAuthorizationReport({ now: NOW }),
    );

    expect(summary.isLaunchGate).toBe(false);
    expect(summary.productionPilotStarted).toBe(false);
    expect(JSON.stringify(summary)).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|manu-rls-test-password/);
  });
});
