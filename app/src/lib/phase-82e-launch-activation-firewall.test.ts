import { describe, expect, it } from "vitest";
import {
  buildPhase82BaselineFinalCompletionReport,
  buildPhase82EligibleSyntheticFinalCompletionReport,
} from "./phase-82d-final-completion-report";
import {
  buildPhase82BaselineLaunchActivationFirewallReport,
  buildPhase82EligibleSyntheticLaunchActivationFirewallReport,
  buildPhase82LaunchActivationFirewallReport,
  summarizePhase82LaunchActivationFirewallReport,
} from "./phase-82e-launch-activation-firewall";

const NOW = "2026-06-30T12:00:00.000Z";

describe("phase 82e launch activation firewall", () => {
  it("enforces baseline invariants with production traffic not started", () => {
    const report = buildPhase82BaselineLaunchActivationFirewallReport({ now: NOW });

    expect(report.firewallStatus).toBe("enforced");
    expect(report.launchActivationBlocked).toBe(true);
    expect(report.productionPilotStarted).toBe(false);
    expect(report.productionPilotGo).toBe(false);
    expect(report.realProviderConnected).toBe(false);
    expect(report.realChannelConnected).toBe(false);
    expect(report.phase82Outcome).toBe("NO_GO_EXTERNAL_PREREQUISITES_OPEN");
    expect(assertionPassed(report, "production_traffic_not_started")).toBe(true);
    expect(assertionPassed(report, "provider_flags_remain_false")).toBe(true);
    expect(assertionPassed(report, "channel_flags_remain_false")).toBe(true);
    expect(assertionPassed(report, "missing_authorization_blocks_readiness")).toBe(true);
  });

  it("blocks egress env flags from bypassing open launch gates", () => {
    const report = buildPhase82BaselineLaunchActivationFirewallReport({
      now: NOW,
      egressAttempt: {
        allowRealZaiFlag: "true",
        allowRealWhatsappFlag: "true",
        allowRealTelegramFlag: "true",
      },
    });

    expect(report.firewallStatus).toBe("enforced");
    expect(assertionPassed(report, "egress_flags_cannot_bypass_gates")).toBe(true);
    expect(report.phase82Outcome).not.toBe("READY_FOR_EXTERNAL_CONTROLLED_LAUNCH_AUTHORIZATION");
    expect(report.realProviderConnected).toBe(false);
    expect(report.realChannelConnected).toBe(false);
  });

  it("never allows a synthetic ready path to set productionPilotStarted to true", () => {
    const eligibleCompletion = buildPhase82EligibleSyntheticFinalCompletionReport({ now: NOW });
    const firewall = buildPhase82EligibleSyntheticLaunchActivationFirewallReport({ now: NOW });

    expect(eligibleCompletion.phase82Outcome).toBe("READY_FOR_EXTERNAL_CONTROLLED_LAUNCH_AUTHORIZATION");
    expect(eligibleCompletion.productionPilotStarted).toBe(false);
    expect(firewall.productionPilotStarted).toBe(false);
    expect(firewall.firewallStatus).toBe("enforced");
    expect(assertionPassed(firewall, "production_traffic_not_started")).toBe(true);
    expect(firewall.realProviderConnected).toBe(false);
    expect(firewall.realChannelConnected).toBe(false);
  });

  it("flags a violated firewall when completion report invariants are tampered", () => {
    const tampered = {
      ...buildPhase82BaselineFinalCompletionReport({ now: NOW }),
      productionPilotStarted: true as false,
    };
    const report = buildPhase82LaunchActivationFirewallReport({
      completionReport: tampered,
      launchAuthorizationApproved: false,
      now: NOW,
    });

    expect(report.firewallStatus).toBe("violated");
    expect(assertionPassed(report, "production_traffic_not_started")).toBe(false);
    expect(report.blockingReasons.length).toBeGreaterThan(0);
  });

  it("flags a violated firewall when ready outcome appears without launch authorization", () => {
    const report = buildPhase82LaunchActivationFirewallReport({
      completionReport: buildPhase82EligibleSyntheticFinalCompletionReport({ now: NOW }),
      launchAuthorizationApproved: false,
      now: NOW,
    });

    expect(report.firewallStatus).toBe("violated");
    expect(assertionPassed(report, "missing_authorization_blocks_readiness")).toBe(false);
    expect(report.productionPilotStarted).toBe(false);
  });

  it("summarizes firewall state without leaking secrets", () => {
    const summary = summarizePhase82LaunchActivationFirewallReport(
      buildPhase82BaselineLaunchActivationFirewallReport({ now: NOW }),
    );

    expect(summary.firewallStatus).toBe("enforced");
    expect(summary.productionPilotStarted).toBe(false);
    expect(JSON.stringify(summary)).not.toMatch(
      /SUPABASE_SERVICE_ROLE_KEY|manu-rls-test-password|primaryPhoneE164/,
    );
  });
});

function assertionPassed(
  report: ReturnType<typeof buildPhase82BaselineLaunchActivationFirewallReport>,
  id: Parameters<typeof assertionPassed>[1],
) {
  return report.assertions.find((assertion) => assertion.id === id)?.passed ?? false;
}
