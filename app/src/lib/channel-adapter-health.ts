import type { ManuAppState } from "./types";

export type ChannelAdapterHealthSignal = {
  channelMockDeliveryFailureCount: number;
  channelQuarantineCount: number;
  channelDuplicateIgnoredCount: number;
  channelOptOutCount: number;
  channelGateBlockedCount: number;
};

export function buildChannelAdapterHealthSignal(state: ManuAppState): ChannelAdapterHealthSignal {
  return {
    channelMockDeliveryFailureCount: state.channelDeliveries.filter((delivery) => delivery.deliveryStatus === "failed")
      .length,
    channelQuarantineCount: state.inboundQuarantines.length,
    channelDuplicateIgnoredCount: state.auditEvents.filter((event) => event.eventType === "channel_duplicate_ignored")
      .length,
    channelOptOutCount: state.auditEvents.filter((event) => event.eventType === "channel_permission_opted_out").length,
    channelGateBlockedCount: state.auditEvents.filter(
      (event) =>
        event.eventType === "channel_policy_blocked" || event.eventType === "channel_policy_outbound_blocked",
    ).length,
  };
}
