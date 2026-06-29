import type { Channel, ChannelDeliveryRecord, ChannelDeliveryStatus } from "./types";

export type MockChannelDeliveryOutcome = {
  deliveryStatus: ChannelDeliveryStatus;
  failureCode: string | null;
  mockProviderMessageId: string;
};

export type MockChannelDeliveryPolicyInput = {
  channel: Channel;
  mockDeliveryStatus?: ChannelDeliveryStatus;
  mockDeliveryFailureCode?: string;
};

const LEDGER_CHANNELS: Channel[] = ["whatsapp", "telegram"];

export function isChannelDeliveryLedgerChannel(channel: Channel): boolean {
  return LEDGER_CHANNELS.includes(channel);
}

export function buildMockProviderMessageId(channel: Channel): string {
  const prefix = channel === "whatsapp" ? "wamid.MOCK" : "tg.MOCK";
  return `${prefix}.${crypto.randomUUID()}`;
}

export function resolveMockChannelDeliveryOutcome(
  input: MockChannelDeliveryPolicyInput,
): MockChannelDeliveryOutcome {
  const mockProviderMessageId = buildMockProviderMessageId(input.channel);
  const requestedStatus = input.mockDeliveryStatus ?? "delivered";

  if (requestedStatus === "failed") {
    return {
      deliveryStatus: "failed",
      failureCode: input.mockDeliveryFailureCode ?? "mock_delivery_provider_error",
      mockProviderMessageId,
    };
  }

  return {
    deliveryStatus: requestedStatus,
    failureCode: null,
    mockProviderMessageId,
  };
}

export function buildChannelDeliveryRecord(input: {
  tenantId: string;
  clientId: string;
  conversationId: string;
  messageId: string;
  channel: Channel;
  outcome: MockChannelDeliveryOutcome;
  now: string;
}): ChannelDeliveryRecord {
  return {
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    clientId: input.clientId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    channel: input.channel,
    direction: "outbound",
    mockProviderMessageId: input.outcome.mockProviderMessageId,
    deliveryStatus: input.outcome.deliveryStatus,
    failureCode: input.outcome.failureCode,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function serializeChannelDeliveryForExport(record: ChannelDeliveryRecord) {
  return {
    id: record.id,
    channel: record.channel,
    direction: record.direction,
    messageId: record.messageId,
    mockProviderMessageId: record.mockProviderMessageId,
    deliveryStatus: record.deliveryStatus,
    failureCode: record.failureCode,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
