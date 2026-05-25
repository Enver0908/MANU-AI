export function resolveAiActivation(client, now = new Date()) {
  const status = client.aiStatus || "passive";
  const activeFrom = client.aiActiveFrom ? new Date(client.aiActiveFrom) : null;
  const activeUntil = client.aiActiveUntil ? new Date(client.aiActiveUntil) : null;

  if (status !== "active") {
    return {
      active: false,
      status: "passive",
      reason: "client_ai_passive",
    };
  }

  if (activeFrom && now < activeFrom) {
    return {
      active: false,
      status: "scheduled",
      reason: "client_ai_not_started",
      activeFrom: activeFrom.toISOString(),
    };
  }

  if (activeUntil && now > activeUntil) {
    return {
      active: false,
      status: "expired",
      reason: "client_ai_window_expired",
      activeUntil: activeUntil.toISOString(),
    };
  }

  return {
    active: true,
    status: "active",
    reason: "client_ai_active",
    activeFrom: activeFrom?.toISOString() || null,
    activeUntil: activeUntil?.toISOString() || null,
  };
}

