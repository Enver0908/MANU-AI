import { evaluatePhase81dEnvironmentPreflight } from "./phase-81d-environment-preflight";
import type { Phase82FinalCompletionReport } from "./phase-82d-final-completion-report";
import {
  buildPhase82BaselineFinalCompletionReport,
  buildPhase82EligibleSyntheticFinalCompletionReport,
} from "./phase-82d-final-completion-report";

export const PHASE_82E_VERSION = "phase82-launch-activation-firewall-v1";

export type Phase82LaunchActivationEgressAttempt = {
  allowRealGeminiFlag?: string;
  allowRealWhatsappFlag?: string;
  allowRealTelegramFlag?: string;
};

export type Phase82LaunchActivationFirewallAssertionId =
  | "production_traffic_not_started"
  | "production_go_not_granted"
  | "provider_flags_remain_false"
  | "channel_flags_remain_false"
  | "egress_flags_cannot_bypass_gates"
  | "missing_authorization_blocks_readiness";

export type Phase82LaunchActivationFirewallAssertion = {
  id: Phase82LaunchActivationFirewallAssertionId;
  passed: boolean;
  detail: string;
};

export type Phase82LaunchActivationFirewallStatus = "enforced" | "violated";

export type Phase82LaunchActivationFirewallReport = {
  phase82Version: string;
  generatedAt: string;
  firewallStatus: Phase82LaunchActivationFirewallStatus;
  launchActivationBlocked: boolean;
  phase82Outcome: Phase82FinalCompletionReport["phase82Outcome"];
  productionPilotStarted: false;
  productionPilotGo: false;
  realProviderConnected: false;
  realChannelConnected: false;
  assertions: Phase82LaunchActivationFirewallAssertion[];
  blockingReasons: string[];
};

function egressFlagsRequested(egressAttempt?: Phase82LaunchActivationEgressAttempt) {
  return (
    egressAttempt?.allowRealGeminiFlag === "true" ||
    egressAttempt?.allowRealWhatsappFlag === "true" ||
    egressAttempt?.allowRealTelegramFlag === "true"
  );
}

export function evaluatePhase82LaunchActivationFirewallAssertions(input: {
  completionReport: Phase82FinalCompletionReport;
  egressAttempt?: Phase82LaunchActivationEgressAttempt;
  launchAuthorizationApproved?: boolean;
}): Phase82LaunchActivationFirewallAssertion[] {
  const { completionReport } = input;
  const launchAuthorizationApproved = input.launchAuthorizationApproved === true;
  const preflight = evaluatePhase81dEnvironmentPreflight({
    allowRealGeminiFlag: input.egressAttempt?.allowRealGeminiFlag,
    allowRealWhatsappFlag: input.egressAttempt?.allowRealWhatsappFlag,
    allowRealTelegramFlag: input.egressAttempt?.allowRealTelegramFlag,
    approvedGateIds: completionReport.approvedGateIds,
    launchAuthorizationApproved,
  });
  const egressRequested = egressFlagsRequested(input.egressAttempt);
  const readyOutcome =
    completionReport.phase82Outcome === "READY_FOR_EXTERNAL_CONTROLLED_LAUNCH_AUTHORIZATION";

  const assertions: Phase82LaunchActivationFirewallAssertion[] = [
    {
      id: "production_traffic_not_started",
      passed: completionReport.productionPilotStarted === false,
      detail:
        completionReport.productionPilotStarted === false
          ? "productionPilotStarted remains false"
          : "productionPilotStarted must remain false",
    },
    {
      id: "production_go_not_granted",
      passed: completionReport.productionPilotGo === false,
      detail:
        completionReport.productionPilotGo === false
          ? "productionPilotGo remains false"
          : "productionPilotGo must remain false in repo-local Phase 82 closure",
    },
    {
      id: "provider_flags_remain_false",
      passed: completionReport.realProviderConnected === false,
      detail:
        completionReport.realProviderConnected === false
          ? "realProviderConnected remains false"
          : "realProviderConnected must remain false",
    },
    {
      id: "channel_flags_remain_false",
      passed: completionReport.realChannelConnected === false,
      detail:
        completionReport.realChannelConnected === false
          ? "realChannelConnected remains false"
          : "realChannelConnected must remain false",
    },
    {
      id: "egress_flags_cannot_bypass_gates",
      passed: evaluateEgressCannotBypassGates({
        completionReport,
        egressRequested,
        preflightChecks: preflight.checks,
      }),
      detail: egressRequested
        ? completionReport.openGateIds.length > 0
          ? "egress env flags did not bypass open launch gates"
          : "egress env flags did not activate repo-local provider/channel connections"
        : "no egress bypass attempt supplied",
    },
    {
      id: "missing_authorization_blocks_readiness",
      passed: evaluateMissingAuthorizationBlocks({
        readyOutcome,
        launchAuthorizationApproved,
      }),
      detail: launchAuthorizationApproved
        ? "launch authorization is approved for the evaluated chain"
        : readyOutcome
          ? "ready outcome recorded without launch authorization"
          : "missing launch authorization blocks readiness",
    },
  ];

  return assertions;
}

function evaluateEgressCannotBypassGates(input: {
  completionReport: Phase82FinalCompletionReport;
  egressRequested: boolean;
  preflightChecks: ReturnType<typeof evaluatePhase81dEnvironmentPreflight>["checks"];
}) {
  if (!input.egressRequested) return true;
  if (input.completionReport.realProviderConnected || input.completionReport.realChannelConnected) {
    return false;
  }
  if (input.completionReport.openGateIds.length > 0) {
    if (input.completionReport.phase82Outcome === "READY_FOR_EXTERNAL_CONTROLLED_LAUNCH_AUTHORIZATION") {
      return false;
    }
    if (
      input.preflightChecks.realGeminiEgressAllowed ||
      input.preflightChecks.realWhatsappEgressAllowed ||
      input.preflightChecks.realTelegramEgressAllowed
    ) {
      return false;
    }
  }
  return true;
}

function evaluateMissingAuthorizationBlocks(input: {
  readyOutcome: boolean;
  launchAuthorizationApproved: boolean;
}) {
  if (input.launchAuthorizationApproved) return true;
  return !input.readyOutcome;
}

export function buildPhase82LaunchActivationFirewallReport(input: {
  completionReport: Phase82FinalCompletionReport;
  egressAttempt?: Phase82LaunchActivationEgressAttempt;
  launchAuthorizationApproved?: boolean;
  now?: string;
}): Phase82LaunchActivationFirewallReport {
  const assertions = evaluatePhase82LaunchActivationFirewallAssertions(input);
  const blockingReasons = assertions.filter((assertion) => !assertion.passed).map((assertion) => assertion.detail);
  const firewallStatus = blockingReasons.length === 0 ? "enforced" : "violated";

  return {
    phase82Version: PHASE_82E_VERSION,
    generatedAt: input.now ?? input.completionReport.generatedAt,
    firewallStatus,
    launchActivationBlocked: true,
    phase82Outcome: input.completionReport.phase82Outcome,
    productionPilotStarted: false,
    productionPilotGo: false,
    realProviderConnected: false,
    realChannelConnected: false,
    assertions,
    blockingReasons,
  };
}

export function buildPhase82BaselineLaunchActivationFirewallReport(options: {
  now?: string;
  egressAttempt?: Phase82LaunchActivationEgressAttempt;
} = {}) {
  const now = options.now ?? "2026-06-30T12:00:00.000Z";
  return buildPhase82LaunchActivationFirewallReport({
    completionReport: buildPhase82BaselineFinalCompletionReport({ now }),
    egressAttempt: options.egressAttempt,
    launchAuthorizationApproved: false,
    now,
  });
}

export function buildPhase82EligibleSyntheticLaunchActivationFirewallReport(options: {
  now?: string;
} = {}) {
  const now = options.now ?? "2026-06-30T12:00:00.000Z";
  return buildPhase82LaunchActivationFirewallReport({
    completionReport: buildPhase82EligibleSyntheticFinalCompletionReport({ now }),
    egressAttempt: {
      allowRealGeminiFlag: "true",
      allowRealWhatsappFlag: "true",
      allowRealTelegramFlag: "true",
    },
    launchAuthorizationApproved: true,
    now,
  });
}

export function summarizePhase82LaunchActivationFirewallReport(
  report: Phase82LaunchActivationFirewallReport,
) {
  return {
    firewallStatus: report.firewallStatus,
    launchActivationBlocked: report.launchActivationBlocked,
    phase82Outcome: report.phase82Outcome,
    productionPilotStarted: report.productionPilotStarted,
    productionPilotGo: report.productionPilotGo,
    realProviderConnected: report.realProviderConnected,
    realChannelConnected: report.realChannelConnected,
    failedAssertionCount: report.assertions.filter((assertion) => !assertion.passed).length,
    blockingReasonCount: report.blockingReasons.length,
  };
}
