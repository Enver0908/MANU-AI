export function evaluateInboundPreflight(client, options = {}) {
  if (client?.lifecycleStatus === "removed_anonymized") {
    return {
      blockedReason: "client_removed_anonymized",
      reasons: ["client_removed_anonymized"],
    };
  }

  if (client?.redRiskLock?.status === "locked") {
    return {
      blockedReason: "red_risk_reactivation_required",
      reasons: ["red_risk_lock_active", `handoff_${client.redRiskLock.handoffId}`],
    };
  }

  if (client?.channelPermission !== "ready") {
    return {
      blockedReason: `channel_permission_${client?.channelPermission || "missing"}`,
      reasons: [`permission_state_${client?.channelPermission || "missing"}`],
    };
  }

  if (!client?.channelUserId || !String(client.channelUserId).trim()) {
    return {
      blockedReason: "identity_quarantine_no_channel_id",
      reasons: ["channel_user_id_missing_or_empty"],
    };
  }

  if (client?.healthProfile?.adultStatus === "unknown") {
    return {
      blockedReason: "identity_quarantine_adult_status_unknown",
      reasons: ["adult_status_not_confirmed"],
    };
  }

  if (client?.humanTakeoverLocked) {
    return {
      blockedReason: "human_takeover_lock",
      reasons: ["dietitian_manual_takeover_active"],
    };
  }

  if (client?.aiMode === "autopilot") {
    const safetyComplete =
      options.safetyChecklistComplete !== undefined
        ? Boolean(options.safetyChecklistComplete)
        : client?.mandatorySafetyComplete === true;

    if (!safetyComplete) {
      return {
        blockedReason: "mandatory_safety_fields_missing",
        reasons: [
          "autopilot_requires_completed_safety_profile",
          ...(options.missingSafetyChecklistItems || []),
        ],
      };
    }
  }

  return null;
}
