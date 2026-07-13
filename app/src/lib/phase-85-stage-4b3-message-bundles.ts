import type { RawChannelEventCandidate } from "./phase-85-if-c-channel-event-normalizer";
import type { ChannelEventRoutedOutcome } from "./phase-85-if-c-channel-event-routing";
import { conversationRevisionOrDefault } from "./phase-85-if-f-conversation-revision";
import {
  STAGE_4B3_BUNDLE_MAX_IMAGES,
  STAGE_4B3_BUNDLE_MAX_MESSAGES,
  STAGE_4B3_BUNDLE_MAX_UNICODE_CODEPOINTS,
  STAGE_4B3_BUNDLE_SILENCE_SECONDS,
  type InboundMessageBundleItemRecord,
  type InboundMessageBundleItemType,
  type InboundMessageBundleRecord,
  type InboundMessageBundleStatus,
} from "./phase-85-stage-4b3-media-contracts";
import type { ManuAppState, MessageRecord } from "./types";

export const STAGE_4B3_MESSAGE_BUNDLES_VERSION = "p85-stage-4b3-message-bundles-v1";
export const STAGE_4B3_ACTIVE_BUNDLE_STATUSES = ["open", "ready", "processing"] as const satisfies readonly InboundMessageBundleStatus[];

export type Stage4B3BundleIngressContext = {
  candidate: RawChannelEventCandidate;
  routing: Extract<ChannelEventRoutedOutcome, { status: "routed" }>;
  channelEventId: string;
  observedAt: string;
};

export type Stage4B3BundleAppendInput = {
  messageId: string;
  channelEventId: string;
  observedAt: string;
  itemType: InboundMessageBundleItemType;
  captionText?: string | null;
  replyToProviderMessageId?: string | null;
  mediaAssetId?: string | null;
  bodyText?: string;
};

export function countUnicodeCodepoints(value: string): number {
  return Array.from(value).length;
}

export function computeBundleReadyAt(observedAt: string): string {
  const observedMs = new Date(observedAt).getTime();
  if (!Number.isFinite(observedMs)) {
    return observedAt;
  }
  return new Date(observedMs + STAGE_4B3_BUNDLE_SILENCE_SECONDS * 1000).toISOString();
}

export function findActiveInboundBundle(
  state: ManuAppState,
  conversationId: string,
): InboundMessageBundleRecord | null {
  const bundles = state.inboundMessageBundles.filter(
    (bundle) =>
      bundle.tenantId === state.tenant.id &&
      bundle.conversationId === conversationId &&
      STAGE_4B3_ACTIVE_BUNDLE_STATUSES.includes(bundle.status as (typeof STAGE_4B3_ACTIVE_BUNDLE_STATUSES)[number]),
  );
  if (bundles.length === 0) {
    return null;
  }
  return bundles.sort((left, right) => right.openedAt.localeCompare(left.openedAt))[0] ?? null;
}

export function hasActiveInboundBundle(state: ManuAppState, conversationId: string): boolean {
  return findActiveInboundBundle(state, conversationId) !== null;
}

export function promoteDueInboundBundles(state: ManuAppState, now: string): ManuAppState {
  return {
    ...state,
    inboundMessageBundles: state.inboundMessageBundles.map((bundle) => {
      if (bundle.tenantId !== state.tenant.id || bundle.status !== "open") {
        return bundle;
      }
      if (new Date(bundle.readyAt).getTime() > new Date(now).getTime()) {
        return bundle;
      }
      return {
        ...bundle,
        status: "ready",
        updatedAt: now,
      };
    }),
  };
}

export function openInboundMessageBundle(
  state: ManuAppState,
  input: {
    clientId: string;
    conversationId: string;
    anchorMessageId: string;
    observedAt: string;
    item: Stage4B3BundleAppendInput;
  },
): ManuAppState {
  const conversation = state.conversations.find((entry) => entry.id === input.conversationId);
  const conversationRevisionAtOpen = conversation ? conversationRevisionOrDefault(conversation) : 1;
  const readyAt = computeBundleReadyAt(input.observedAt);
  const bundleId = crypto.randomUUID();
  const counts = computeBundleCounts(input.item);

  const bundle: InboundMessageBundleRecord = {
    id: bundleId,
    tenantId: state.tenant.id,
    clientId: input.clientId,
    conversationId: input.conversationId,
    anchorMessageId: input.anchorMessageId,
    status: "open",
    openedAt: input.observedAt,
    lastEventAt: input.observedAt,
    readyAt,
    bundleRevision: 1,
    conversationRevisionAtOpen,
    itemCount: counts.itemCount,
    imageCount: counts.imageCount,
    unicodeCodepointCount: counts.unicodeCodepointCount,
    retryCount: 0,
    nextAttemptAt: null,
    leaseExpiresAt: null,
    decisionId: null,
    failureCode: null,
    createdAt: input.observedAt,
    updatedAt: input.observedAt,
  };

  const bundleItem = buildBundleItem(state, bundleId, input.item, 1);
  const overflow = detectBundleOverflow(bundle, counts);
  const nextBundle = overflow ? applyBundleOverflow(bundle, overflow) : bundle;

  return {
    ...state,
    inboundMessageBundles: [...state.inboundMessageBundles, nextBundle],
    inboundMessageBundleItems: [...state.inboundMessageBundleItems, bundleItem],
  };
}

export function appendInboundBundleItem(
  state: ManuAppState,
  bundleId: string,
  item: Stage4B3BundleAppendInput,
): ManuAppState {
  const bundle = state.inboundMessageBundles.find((entry) => entry.id === bundleId);
  if (!bundle) {
    return state;
  }

  const existingItem = state.inboundMessageBundleItems.find(
    (entry) => entry.tenantId === state.tenant.id && entry.bundleId === bundleId && entry.messageId === item.messageId,
  );
  if (existingItem) {
    return state;
  }

  const ordinal = bundle.itemCount + 1;
  const increment = computeBundleCounts(item);
  const nextCounts = {
    itemCount: bundle.itemCount + increment.itemCount,
    imageCount: bundle.imageCount + increment.imageCount,
    unicodeCodepointCount: bundle.unicodeCodepointCount + increment.unicodeCodepointCount,
  };
  const overflow = detectBundleOverflow(bundle, nextCounts);
  const readyAt = computeBundleReadyAt(item.observedAt);
  const nextStatus: InboundMessageBundleStatus =
    bundle.status === "processing"
      ? "open"
      : overflow
        ? "review_required"
        : bundle.status === "review_required"
          ? "review_required"
          : "open";

  const updatedBundle: InboundMessageBundleRecord = {
    ...bundle,
    status: nextStatus,
    lastEventAt: item.observedAt,
    readyAt,
    bundleRevision: bundle.bundleRevision + 1,
    itemCount: nextCounts.itemCount,
    imageCount: nextCounts.imageCount,
    unicodeCodepointCount: nextCounts.unicodeCodepointCount,
    leaseExpiresAt: null,
    failureCode: overflow ?? bundle.failureCode,
    updatedAt: item.observedAt,
  };

  return {
    ...state,
    inboundMessageBundles: state.inboundMessageBundles.map((entry) => (entry.id === bundleId ? updatedBundle : entry)),
    inboundMessageBundleItems: [
      ...state.inboundMessageBundleItems,
      buildBundleItem(state, bundleId, item, ordinal),
    ],
  };
}

export function buildBundledClientTextMessage(
  state: ManuAppState,
  context: Stage4B3BundleIngressContext,
): MessageRecord {
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    conversationId: context.routing.conversationId!,
    sender: "client",
    origin: "client_inbound",
    body: context.candidate.body?.trim() || "",
    status: "stored",
    contentStatus: "available",
    retrievalEligibility: "eligible",
    providerAccountBindingId: context.routing.accountBindingId,
    providerEventId: context.candidate.providerEventId,
    providerMessageId: context.candidate.providerMessageId ?? context.candidate.providerEventId,
    actorType: "client",
    actorBindingId: null,
    authorInterface: "client_channel",
    actorResolutionBasis: "provider_counterparty",
    providerSentAt: context.candidate.providerTime,
    observedAt: context.observedAt,
    persistedAt: context.observedAt,
    createdAt: context.observedAt,
  };
}

export function applyBundledClientTextIngress(
  state: ManuAppState,
  context: Stage4B3BundleIngressContext,
): ManuAppState {
  const message = buildBundledClientTextMessage(state, context);
  const withMessage = {
    ...state,
    messages: [...state.messages, message],
  };
  return integrateClientTextIntoBundle(withMessage, context, message);
}

export function integrateClientImageIntoBundle(
  state: ManuAppState,
  context: Stage4B3BundleIngressContext,
  messageId: string,
  mediaAssetId: string,
): ManuAppState {
  if (!context.routing.clientId || !context.routing.conversationId) {
    return state;
  }

  const item: Stage4B3BundleAppendInput = {
    messageId,
    channelEventId: context.channelEventId,
    observedAt: context.observedAt,
    itemType: context.candidate.caption?.trim() ? "caption" : "image",
    captionText: context.candidate.caption ?? null,
    replyToProviderMessageId: context.candidate.replyToProviderMessageId,
    mediaAssetId,
    bodyText: context.candidate.caption ?? undefined,
  };

  const activeBundle = findActiveInboundBundle(state, context.routing.conversationId);
  if (activeBundle) {
    return appendInboundBundleItem(state, activeBundle.id, item);
  }

  return openInboundMessageBundle(state, {
    clientId: context.routing.clientId,
    conversationId: context.routing.conversationId,
    anchorMessageId: messageId,
    observedAt: context.observedAt,
    item,
  });
}

export function integrateClientTextIntoBundle(
  state: ManuAppState,
  context: Stage4B3BundleIngressContext,
  message: MessageRecord,
): ManuAppState {
  const conversationId = context.routing.conversationId;
  if (!conversationId) {
    return state;
  }

  const activeBundle = findActiveInboundBundle(state, conversationId);
  if (!activeBundle) {
    return state;
  }

  return appendInboundBundleItem(state, activeBundle.id, {
    messageId: message.id,
    channelEventId: context.channelEventId,
    observedAt: context.observedAt,
    itemType: "text",
    captionText: null,
    replyToProviderMessageId: context.candidate.replyToProviderMessageId,
    mediaAssetId: null,
    bodyText: message.body,
  });
}

export function supersedeConversationBundles(
  state: ManuAppState,
  conversationId: string,
  observedAt: string,
): ManuAppState {
  return {
    ...state,
    inboundMessageBundles: state.inboundMessageBundles.map((bundle) =>
      bundle.tenantId === state.tenant.id &&
      bundle.conversationId === conversationId &&
      STAGE_4B3_ACTIVE_BUNDLE_STATUSES.includes(bundle.status as (typeof STAGE_4B3_ACTIVE_BUNDLE_STATUSES)[number])
        ? {
            ...bundle,
            status: "superseded",
            leaseExpiresAt: null,
            updatedAt: observedAt,
          }
        : bundle,
    ),
  };
}

export function claimReadyInboundBundle(
  state: ManuAppState,
  input: { workerId: string; now: string },
): { state: ManuAppState; claimed: InboundMessageBundleRecord | null } {
  const promoted = promoteDueInboundBundles(state, input.now);
  const candidate = promoted.inboundMessageBundles
    .filter(
      (bundle) =>
        bundle.tenantId === promoted.tenant.id &&
        bundle.status === "ready" &&
        new Date(bundle.readyAt).getTime() <= new Date(input.now).getTime() &&
        !bundle.leaseExpiresAt,
    )
    .sort((left, right) => left.readyAt.localeCompare(right.readyAt))[0];

  if (!candidate) {
    return { state: promoted, claimed: null };
  }

  const conversation = promoted.conversations.find((entry) => entry.id === candidate.conversationId);
  const currentRevision = conversation ? conversationRevisionOrDefault(conversation) : candidate.conversationRevisionAtOpen;
  if (currentRevision !== candidate.conversationRevisionAtOpen) {
    const reopened: InboundMessageBundleRecord = {
      ...candidate,
      status: "open",
      readyAt: computeBundleReadyAt(input.now),
      lastEventAt: input.now,
      bundleRevision: candidate.bundleRevision + 1,
      conversationRevisionAtOpen: currentRevision,
      leaseExpiresAt: null,
      updatedAt: input.now,
    };
    return {
      state: {
        ...promoted,
        inboundMessageBundles: promoted.inboundMessageBundles.map((bundle) =>
          bundle.id === candidate.id ? reopened : bundle,
        ),
      },
      claimed: null,
    };
  }

  const leaseExpiresAt = new Date(new Date(input.now).getTime() + 60_000).toISOString();
  const claimed: InboundMessageBundleRecord = {
    ...candidate,
    status: "processing",
    leaseExpiresAt,
    updatedAt: input.now,
  };

  return {
    state: {
      ...promoted,
      inboundMessageBundles: promoted.inboundMessageBundles.map((bundle) =>
        bundle.id === candidate.id ? claimed : bundle,
      ),
    },
    claimed,
  };
}

export function releaseInboundBundleLease(
  state: ManuAppState,
  bundleId: string,
  input: { workerId: string; now: string; success: boolean },
): ManuAppState {
  const bundle = state.inboundMessageBundles.find((entry) => entry.id === bundleId);
  if (!bundle || bundle.status !== "processing") {
    return state;
  }

  const nextStatus: InboundMessageBundleStatus = input.success ? "completed" : "ready";
  return {
    ...state,
    inboundMessageBundles: state.inboundMessageBundles.map((entry) =>
      entry.id === bundleId
        ? {
            ...entry,
            status: nextStatus,
            leaseExpiresAt: null,
            updatedAt: input.now,
          }
        : entry,
    ),
  };
}

function buildBundleItem(
  state: ManuAppState,
  bundleId: string,
  item: Stage4B3BundleAppendInput,
  ordinal: number,
): InboundMessageBundleItemRecord {
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    bundleId,
    messageId: item.messageId,
    channelEventId: item.channelEventId,
    mediaAssetId: item.mediaAssetId ?? null,
    ordinal,
    itemType: item.itemType,
    captionText: item.captionText ?? null,
    replyToProviderMessageId: item.replyToProviderMessageId ?? null,
    observedAt: item.observedAt,
    createdAt: item.observedAt,
  };
}

function computeBundleCounts(item: Stage4B3BundleAppendInput) {
  const body = item.bodyText ?? item.captionText ?? "";
  return {
    itemCount: 1,
    imageCount: item.itemType === "image" || item.itemType === "caption" ? 1 : 0,
    unicodeCodepointCount: countUnicodeCodepoints(body),
  };
}

function detectBundleOverflow(
  bundle: InboundMessageBundleRecord,
  nextCounts: { itemCount: number; imageCount: number; unicodeCodepointCount: number },
): string | null {
  if (nextCounts.itemCount > STAGE_4B3_BUNDLE_MAX_MESSAGES) {
    return "bundle_message_cap_exceeded";
  }
  if (nextCounts.imageCount > STAGE_4B3_BUNDLE_MAX_IMAGES) {
    return "bundle_image_cap_exceeded";
  }
  if (nextCounts.unicodeCodepointCount > STAGE_4B3_BUNDLE_MAX_UNICODE_CODEPOINTS) {
    return "bundle_unicode_cap_exceeded";
  }
  return null;
}

function applyBundleOverflow(bundle: InboundMessageBundleRecord, failureCode: string): InboundMessageBundleRecord {
  return {
    ...bundle,
    status: "review_required",
    failureCode,
  };
}
