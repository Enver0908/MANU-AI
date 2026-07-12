import type { AppTenantContext } from "./auth-context";
import { exportClientInState } from "./app-state-store";
import { buildClientScopedExport } from "./data-governance";
import { DEMO_DIETITIAN_ID, DEMO_TENANT_ID, createInitialState } from "./seed-data";
import type { ClientRecord, ManuAppState, NotificationRecord } from "./types";
import type { ClinicalAlertListItem, SystemNotificationListItem } from "./phase-85-stage-4b-contracts";
import { projectClinicalAlertsFromState } from "./phase-85-stage-4b-alerts";
import {
  buildClinicalAlertsListResponse,
  buildSystemNotificationsListResponse,
  STAGE_4B_DEFAULT_PAGE_SIZE,
  STAGE_4B_MAX_PAGE_SIZE,
} from "./phase-85-stage-4b-api";
import { buildTestNotification } from "./phase-85-stage-4b-notifications";
import { runInboundSimulation } from "./simulator";

export const PHASE_85_STAGE_4B_INTEGRATION_VERSION = "p85-stage-4b-integration-v1";

export const STAGE_4B_SCALE_TARGETS = {
  clientCount: 5000,
  notificationCount: 10000,
  defaultPageSize: STAGE_4B_DEFAULT_PAGE_SIZE,
  maxPageSize: STAGE_4B_MAX_PAGE_SIZE,
} as const;

export const CLINICAL_ALERT_LIST_DTO_KEYS = [
  "id",
  "clientId",
  "conversationId",
  "clientFullName",
  "severity",
  "kind",
  "reasonLabelKey",
  "additionalReasonCount",
  "sourceMessageId",
  "activeDraftMessageId",
  "handoffId",
  "startedAt",
  "elapsedMinutes",
  "slaDeadline",
  "slaState",
  "target",
] as const;

export const SYSTEM_NOTIFICATION_LIST_DTO_KEYS = [
  "id",
  "kind",
  "priority",
  "category",
  "clientId",
  "conversationId",
  "messageId",
  "handoffId",
  "clientFullName",
  "titleKey",
  "summaryKey",
  "occurrenceCount",
  "lastOccurredAt",
  "readAt",
  "acknowledgedAt",
  "resolvedAt",
  "lifecycleState",
  "target",
] as const;

export const STAGE_4B_SENSITIVE_DTO_PATTERNS =
  /\b(body|rawPrompt|reasonCode|reasonCodes|safeAcknowledgement|recommendedAction|blockedReason|title|dedupeKey)\b|possible_emergency_symptom|prompt_injection/i;

export type Stage4BBoundedInboxEvidence = {
  ready: boolean;
  failures: string[];
  alertFilteredTotal: number;
  alertPageSize: number;
  notificationFilteredTotal: number;
  notificationPageSize: number;
};

export type Stage4BDataGovernanceEvidence = {
  ready: boolean;
  failures: string[];
};

export type Stage4BChannelIntegrationEvidence = {
  ready: boolean;
  failures: string[];
  safeReplyNotificationId: string | null;
  redAlertCount: number;
};

function ownerContextFor(state: ManuAppState): AppTenantContext {
  return {
    tenantId: state.tenant.id,
    dietitianId: state.dietitian.id,
    userId: "user-owner",
    role: "owner",
  };
}

function cloneTemplateClient(index: number): ClientRecord {
  const template = createInitialState().clients[0]!;
  const id = `client-scale-${index}`;
  return {
    ...template,
    id,
    fullName: `Scale Client ${index}`,
    primaryPhoneE164: `+9055500${String(index).padStart(5, "0")}`,
    channelUserId: `+9055500${String(index).padStart(5, "0")}`,
    redRiskLock: { status: "none" },
    yellowRiskHold: { status: "none" },
    humanTakeoverLocked: false,
  };
}

export function createStage4BScaleState(options?: {
  clientCount?: number;
  notificationCount?: number;
  redEvery?: number;
  yellowEvery?: number;
}): ManuAppState {
  const clientCount = options?.clientCount ?? 250;
  const notificationCount = options?.notificationCount ?? 500;
  const redEvery = options?.redEvery ?? 50;
  const yellowEvery = options?.yellowEvery ?? 25;
  const base = createInitialState();
  const clients: ClientRecord[] = [];
  const handoffCases = [...base.handoffCases];
  const notifications: NotificationRecord[] = [];
  const notificationReceipts = [...base.notificationReceipts];

  for (let index = 0; index < clientCount; index += 1) {
    const client = cloneTemplateClient(index);
    if (index > 0 && index % redEvery === 0) {
      const handoffId = `handoff-scale-red-${index}`;
      handoffCases.push({
        id: handoffId,
        tenantId: DEMO_TENANT_ID,
        dietitianId: DEMO_DIETITIAN_ID,
        clientId: client.id,
        conversationId: `conversation-${client.id}`,
        triggeringMessageId: `message-scale-${index}`,
        risk: "red",
        reasons: ["possible_emergency_symptom"],
        status: "open",
        urgency: "urgent",
        safeAcknowledgement: "Review required.",
        recommendedAction: "Review required.",
        createdAt: "2026-07-12T10:00:00.000Z",
      });
      client.redRiskLock = {
        status: "locked",
        handoffId,
        lockedAt: "2026-07-12T10:00:00.000Z",
        reasons: ["possible_emergency_symptom"],
        previousAiStatus: "active",
        previousAiMode: "copilot",
      };
      client.aiStatus = "passive";
      client.humanTakeoverLocked = true;
    } else if (index > 0 && index % yellowEvery === 0) {
      client.yellowRiskHold = {
        status: "active",
        startedAt: "2026-07-12T09:30:00.000Z",
        firstMessageId: `message-yellow-${index}`,
        latestMessageId: `message-yellow-${index}`,
        activeDraftMessageId: null,
        activeDecisionId: null,
        messageIds: [`message-yellow-${index}`],
        reasons: ["symptom_question"],
        previousAiStatus: "active",
        previousAiMode: "copilot",
        blockedByRedHandoffId: null,
      };
    }
    clients.push(client);
  }

  for (let index = 0; index < notificationCount; index += 1) {
    const client = clients[index % clients.length]!;
    const notificationId = `notification-scale-${index}`;
    notifications.push(
      buildTestNotification({
        id: notificationId,
        tenantId: DEMO_TENANT_ID,
        type: "system",
        kind: index % 3 === 0 ? "ai_window_expired" : "safe_reply_unavailable",
        entityType: "client",
        entityId: client.id,
        clientId: client.id,
        title: "hidden-title",
        body: "hidden-body-with-raw-provider-content",
        read: false,
        acknowledgedAt: null,
        createdAt: "2026-07-12T08:00:00.000Z",
        lastOccurredAt: "2026-07-12T08:00:00.000Z",
      }),
    );
    if (index % 4 === 0) {
      notificationReceipts.push({
        tenantId: DEMO_TENANT_ID,
        notificationId,
        dietitianId: "dietitian-other",
        readAt: "2026-07-12T08:30:00.000Z",
        acknowledgedAt: null,
        createdAt: "2026-07-12T08:30:00.000Z",
        updatedAt: "2026-07-12T08:30:00.000Z",
      });
    }
  }

  return {
    ...base,
    clients,
    handoffCases,
    notifications,
    notificationReceipts,
  };
}

export function assertClinicalAlertListDtoSafety(item: ClinicalAlertListItem) {
  const keys = Object.keys(item).sort();
  expectKeysExact(keys, CLINICAL_ALERT_LIST_DTO_KEYS);
  const serialized = JSON.stringify(item);
  if (STAGE_4B_SENSITIVE_DTO_PATTERNS.test(serialized)) {
    throw new Error(`clinical_alert_list_dto_sensitive_field:${item.id}`);
  }
}

export function assertSystemNotificationListDtoSafety(item: SystemNotificationListItem) {
  const keys = Object.keys(item).sort();
  expectKeysExact(keys, SYSTEM_NOTIFICATION_LIST_DTO_KEYS);
  const serialized = JSON.stringify(item);
  if (STAGE_4B_SENSITIVE_DTO_PATTERNS.test(serialized)) {
    throw new Error(`system_notification_list_dto_sensitive_field:${item.id}`);
  }
  if (!item.titleKey.startsWith("notification")) {
    throw new Error(`system_notification_list_dto_unsafe_title_key:${item.id}`);
  }
}

function expectKeysExact(actual: string[], allowed: readonly string[]) {
  const allowedSet = new Set(allowed);
  for (const key of actual) {
    if (!allowedSet.has(key)) {
      throw new Error(`unexpected_dto_key:${key}`);
    }
  }
  if (actual.length !== allowed.length) {
    throw new Error(`dto_key_count_mismatch:${actual.length}`);
  }
}

export function evaluateStage4BBoundedInboxEvidence(
  state: ManuAppState,
  context: AppTenantContext = ownerContextFor(state),
): Stage4BBoundedInboxEvidence {
  const failures: string[] = [];
  const alerts = buildClinicalAlertsListResponse(state, context, [], {
    limit: STAGE_4B_DEFAULT_PAGE_SIZE,
    generatedAt: "2026-07-12T12:00:00.000Z",
  });
  const notifications = buildSystemNotificationsListResponse(state, context, [], {
    status: "active",
    limit: STAGE_4B_DEFAULT_PAGE_SIZE,
    generatedAt: "2026-07-12T12:00:00.000Z",
  });

  if (alerts.items.length > STAGE_4B_DEFAULT_PAGE_SIZE) {
    failures.push("alerts_page_exceeds_default_limit");
  }
  if (notifications.items.length > STAGE_4B_DEFAULT_PAGE_SIZE) {
    failures.push("notifications_page_exceeds_default_limit");
  }
  if (alerts.filteredTotal > 0 && alerts.items.length === 0) {
    failures.push("alerts_filtered_total_without_items");
  }

  for (const item of alerts.items) {
    try {
      assertClinicalAlertListDtoSafety(item);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "clinical_alert_dto_invalid");
    }
  }
  for (const item of notifications.items) {
    try {
      assertSystemNotificationListDtoSafety(item);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "notification_dto_invalid");
    }
  }

  return {
    ready: failures.length === 0,
    failures,
    alertFilteredTotal: alerts.filteredTotal,
    alertPageSize: alerts.items.length,
    notificationFilteredTotal: notifications.filteredTotal,
    notificationPageSize: notifications.items.length,
  };
}

export function evaluateStage4BDataGovernanceEvidence(state: ManuAppState, clientId?: string) {
  const failures: string[] = [];
  const resolvedClientId =
    clientId && state.clients.some((client) => client.id === clientId)
      ? clientId
      : state.clients[0]?.id;
  if (!resolvedClientId) {
    return { ready: false, failures: ["no_client_for_export"] };
  }

  const ownerContext = ownerContextFor(state);
  const auditorContext = { ...ownerContext, role: "auditor" as const };
  const alerts = buildClinicalAlertsListResponse(state, auditorContext, [], {});
  const notifications = buildSystemNotificationsListResponse(state, auditorContext, [], {});
  if (alerts.items.length > 0 || notifications.items.length > 0) {
    failures.push("auditor_inbox_not_empty");
  }

  const exportPayload = exportClientInState(state, resolvedClientId);
  const exportJson = JSON.stringify(exportPayload);
  if (exportJson.includes("notificationReceipts")) {
    failures.push("client_export_contains_notification_receipts");
  }
  if (exportJson.includes("dietitian-other")) {
    failures.push("client_export_contains_other_actor_receipt");
  }

  const scopedExport = buildClientScopedExport(state, resolvedClientId);
  if ("notificationReceipts" in scopedExport) {
    failures.push("scoped_export_contains_notification_receipts");
  }

  const projected = projectClinicalAlertsFromState(state, {
    now: "2026-07-12T12:00:00.000Z",
    visibleClientIds: new Set(state.clients.map((client) => client.id)),
  });
  for (const alert of projected) {
    if (JSON.stringify(alert).includes("safeAcknowledgement")) {
      failures.push("alert_projection_leaked_handoff_narrative");
      break;
    }
  }

  return {
    ready: failures.length === 0,
    failures,
  } satisfies Stage4BDataGovernanceEvidence;
}

export async function runStage4BChannelIntegrationChecks(): Promise<Stage4BChannelIntegrationEvidence> {
  const failures: string[] = [];
  let safeReplyNotificationId: string | null = null;
  let redAlertCount = 0;

  const safeReplyState = await runInboundSimulation(createInitialState(), {
    clientId: "client-mert",
    body: "Bugun kahvaltida ne yiyebilirim?",
    idempotencyKey: "stage-4b-integration-safe-reply",
    mockProviderFailure: "provider_timeout",
    now: "2026-07-12T10:00:00.000Z",
  });
  safeReplyNotificationId =
    safeReplyState.notifications.find((notification) => notification.kind === "safe_reply_unavailable")?.id ?? null;
  if (!safeReplyNotificationId) {
    failures.push("safe_reply_notification_missing");
  }

  const redState = await runInboundSimulation(createInitialState(), {
    clientId: "client-mert",
    body: "Alerjiden nefes alamiyorum, bogazim sisti.",
    idempotencyKey: "stage-4b-integration-red-lock",
    now: "2026-07-12T10:01:00.000Z",
  });
  redAlertCount = projectClinicalAlertsFromState(redState, {
    now: "2026-07-12T10:02:00.000Z",
    visibleClientIds: new Set(redState.clients.map((client) => client.id)),
  }).length;
  if (redAlertCount === 0) {
    failures.push("red_alert_projection_missing");
  }

  const duplicateFirst = await runInboundSimulation(createInitialState(), {
    clientId: "client-elif",
    body: "D vitamin takviyesi kullanayim mi?",
    idempotencyKey: "stage-4b-integration-duplicate",
    now: "2026-07-12T10:03:00.000Z",
  });
  const duplicateSecond = await runInboundSimulation(duplicateFirst, {
    clientId: "client-elif",
    body: "D vitamin takviyesi kullanayim mi?",
    idempotencyKey: "stage-4b-integration-duplicate",
    now: "2026-07-12T10:04:00.000Z",
  });
  if (duplicateSecond.lastSimulation?.action !== "duplicate_ignored") {
    failures.push("duplicate_inbound_not_ignored");
  }

  return {
    ready: failures.length === 0,
    failures,
    safeReplyNotificationId,
    redAlertCount,
  };
}

export function buildStage4BIntegrationEvidencePackMetrics(input: {
  bounded: Stage4BBoundedInboxEvidence;
  governance: Stage4BDataGovernanceEvidence;
  channel: Stage4BChannelIntegrationEvidence;
  clientCount: number;
  notificationCount: number;
  redProjectionCount?: number;
  yellowProjectionCount?: number;
}) {
  return {
    phase: PHASE_85_STAGE_4B_INTEGRATION_VERSION,
    status: input.bounded.ready && input.governance.ready && input.channel.ready ? "pass" : "fail",
    production_pilot_go: false,
    client_count: input.clientCount,
    notification_count: input.notificationCount,
    alert_filtered_total: input.bounded.alertFilteredTotal,
    alert_page_size: input.bounded.alertPageSize,
    notification_filtered_total: input.bounded.notificationFilteredTotal,
    notification_page_size: input.bounded.notificationPageSize,
    red_projection_count: input.redProjectionCount ?? 0,
    yellow_projection_count: input.yellowProjectionCount ?? 0,
    red_alert_count: input.channel.redAlertCount,
    failures: [...input.bounded.failures, ...input.governance.failures, ...input.channel.failures],
  };
}

export async function runStage4BIntegrationRehearsalSample() {
  const state = createStage4BScaleState();
  const bounded = evaluateStage4BBoundedInboxEvidence(state);
  const governance = evaluateStage4BDataGovernanceEvidence(state);
  const channel = await runStage4BChannelIntegrationChecks();
  const projected = projectClinicalAlertsFromState(state, {
    now: "2026-07-12T12:00:00.000Z",
    visibleClientIds: new Set(state.clients.map((client) => client.id)),
  });
  return buildStage4BIntegrationEvidencePackMetrics({
    bounded,
    governance,
    channel,
    clientCount: state.clients.length,
    notificationCount: state.notifications.length,
    redProjectionCount: projected.filter((alert) => alert.severity === "red").length,
    yellowProjectionCount: projected.filter((alert) => alert.severity === "yellow").length,
  });
}

export async function runStage4BIntegrationRehearsalFull() {
  const state = createStage4BScaleState({
    clientCount: STAGE_4B_SCALE_TARGETS.clientCount,
    notificationCount: STAGE_4B_SCALE_TARGETS.notificationCount,
  });
  const bounded = evaluateStage4BBoundedInboxEvidence(state);
  const governance = evaluateStage4BDataGovernanceEvidence(state);
  const channel = await runStage4BChannelIntegrationChecks();
  const projected = projectClinicalAlertsFromState(state, {
    now: "2026-07-12T12:00:00.000Z",
    visibleClientIds: new Set(state.clients.map((client) => client.id)),
  });
  return buildStage4BIntegrationEvidencePackMetrics({
    bounded,
    governance,
    channel,
    clientCount: state.clients.length,
    notificationCount: state.notifications.length,
    redProjectionCount: projected.filter((alert) => alert.severity === "red").length,
    yellowProjectionCount: projected.filter((alert) => alert.severity === "yellow").length,
  });
}
