import type { AuditEventRecord, ChannelAdapterRollbackControls, ClientRecord, ManuAppState } from "./types";

export type ChannelAdapterRollbackScope = "global" | "tenant" | "dietitian" | "client";

export type ChannelAutomationRollbackBlock = {
  blockedReason:
    | "channel_automation_rollback_global"
    | "channel_automation_rollback_tenant"
    | "channel_automation_rollback_dietitian"
    | "channel_automation_rollback_client";
  scope: ChannelAdapterRollbackScope;
};

export function createDefaultChannelAdapterRollbackControls(): ChannelAdapterRollbackControls {
  return {
    globalChannelAutomationDisabled: false,
    tenantChannelAutomationDisabled: false,
    disabledDietitianIds: [],
    disabledClientIds: [],
  };
}

export function evaluateChannelAutomationRollback(
  state: ManuAppState,
  client: ClientRecord,
): ChannelAutomationRollbackBlock | null {
  const controls = state.channelAdapterRollback;

  if (controls.globalChannelAutomationDisabled) {
    return { blockedReason: "channel_automation_rollback_global", scope: "global" };
  }
  if (controls.tenantChannelAutomationDisabled) {
    return { blockedReason: "channel_automation_rollback_tenant", scope: "tenant" };
  }
  if (controls.disabledDietitianIds.includes(client.dietitianId)) {
    return { blockedReason: "channel_automation_rollback_dietitian", scope: "dietitian" };
  }
  if (controls.disabledClientIds.includes(client.id)) {
    return { blockedReason: "channel_automation_rollback_client", scope: "client" };
  }

  return null;
}

export function countActiveChannelAdapterRollbackScopes(controls: ChannelAdapterRollbackControls): number {
  let count = 0;
  if (controls.globalChannelAutomationDisabled) count += 1;
  if (controls.tenantChannelAutomationDisabled) count += 1;
  count += controls.disabledDietitianIds.length;
  count += controls.disabledClientIds.length;
  return count;
}

export function setChannelAdapterRollbackInState(
  state: ManuAppState,
  input: {
    scope: ChannelAdapterRollbackScope;
    targetId?: string;
    disabled: boolean;
    reason: string;
  },
): ManuAppState {
  const now = new Date().toISOString();
  const controls = { ...state.channelAdapterRollback };

  switch (input.scope) {
    case "global":
      controls.globalChannelAutomationDisabled = input.disabled;
      break;
    case "tenant":
      controls.tenantChannelAutomationDisabled = input.disabled;
      break;
    case "dietitian": {
      if (!input.targetId) {
        throw new Error("channel_rollback_dietitian_id_required");
      }
      controls.disabledDietitianIds = input.disabled
        ? Array.from(new Set([...controls.disabledDietitianIds, input.targetId]))
        : controls.disabledDietitianIds.filter((id) => id !== input.targetId);
      break;
    }
    case "client": {
      if (!input.targetId) {
        throw new Error("channel_rollback_client_id_required");
      }
      controls.disabledClientIds = input.disabled
        ? Array.from(new Set([...controls.disabledClientIds, input.targetId]))
        : controls.disabledClientIds.filter((id) => id !== input.targetId);
      break;
    }
  }

  const audit: AuditEventRecord = {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    eventType: "channel_automation_rollback_updated",
    entityType: "channel_rollback",
    entityId: input.targetId ?? input.scope,
    metadata: {
      scope: input.scope,
      targetId: input.targetId ?? null,
      disabled: input.disabled,
      reason: input.reason,
    },
    createdAt: now,
  };

  return {
    ...state,
    channelAdapterRollback: controls,
    auditEvents: [...state.auditEvents, audit],
  };
}
