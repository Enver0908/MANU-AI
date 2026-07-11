import { PHASE_74_REDACTION_MARKER, type ClientScopedExport } from "./data-governance";
import { extractP85IfEContextManifestSignals } from "./phase-85-if-e-historical-retrieval";
import type {
  AiDecisionRecord,
  ChannelAccountBindingRecord,
  ChannelActorBindingRecord,
  HumanControlSessionRecord,
  ManuAppState,
  RiskActivityEventRecord,
} from "./types";

export const PHASE_85_IF_I_LIFECYCLE_CLOSURE_VERSION = "p85-if-i-lifecycle-closure-v1";
export const PHASE_85_IF_I_EXPORT_EXTENSION_VERSION = "p85-if-i-export-v1";

export const PHASE_85_IF_I_EXPORT_FILES = [
  "human_control_sessions.json",
  "risk_activity_events.json",
  "channel_message_revisions.json",
  "context_intake_proposals.json",
  "retrieval_source_references.json",
] as const;

export const PHASE_85_IF_I_LIFECYCLE_REDACTION_DOMAINS = [
  "message_provenance_fields",
  "channel_message_revisions",
  "human_control_sessions",
  "risk_activity_events",
  "context_intake_source_text",
  "retrieval_source_evidence",
  "tenant_channel_bindings_excluded_from_export",
] as const;

export type P85IfILifecycleRedactionDomain = (typeof PHASE_85_IF_I_LIFECYCLE_REDACTION_DOMAINS)[number];

export type RetrievalSourceReferenceExport = {
  aiDecisionId: string;
  category: string;
  messageId?: string;
  segmentType?: string;
  sourceMessageId?: string;
};

export type P85IfIClientExportExtensions = {
  interstageExportVersion: string;
  humanControlSessions: HumanControlSessionRecord[];
  riskActivityEvents: RiskActivityEventRecord[];
  channelMessageRevisions: ManuAppState["channelMessageRevisions"];
  retrievalSourceReferences: RetrievalSourceReferenceExport[];
};

export type P85IfILifecycleClosureEvidence = {
  version: string;
  status: "pass" | "fail";
  clientId: string;
  domainsCovered: P85IfILifecycleRedactionDomain[];
  domainFailures: Partial<Record<P85IfILifecycleRedactionDomain, string>>;
  tenantBindingsExcludedFromExport: boolean;
  aggregateEvidenceOnly: boolean;
  failures: string[];
};

export type P85IfIClosureCheckStatus = "pass" | "fail" | "skipped" | "timeout";

export type P85IfIProgramClosureVerificationInput = {
  interstageTrackResults: Partial<Record<`P85-IF-${"A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I"}`, P85IfIClosureCheckStatus>>;
  targetedTests: P85IfIClosureCheckStatus;
  fullAppSuite: P85IfIClosureCheckStatus;
  rlsSuite: P85IfIClosureCheckStatus;
  channelReplay: P85IfIClosureCheckStatus;
  productionScaleRehearsal: P85IfIClosureCheckStatus;
  productionBuild: P85IfIClosureCheckStatus;
  lifecycleRoundTrip: P85IfIClosureCheckStatus;
  exportLeakDetector: P85IfIClosureCheckStatus;
};

export type P85IfIProgramClosureEvidence = {
  version: string;
  status: "pass" | "fail";
  interstageTracksComplete: string[];
  riskRegisterUpdated: boolean;
  exportExtensionVersion: string;
  rlsCoverageDeclared: boolean;
  productionPilotNoGo: true;
  r405Open: true;
  r406PendingWithoutLocalSupabase: boolean;
  failures: string[];
};

export const P85_IF_I_RISK_REGISTER_CLOSURE_IDS = [
  "R-118",
  "R-209",
  "R-210",
  "R-426",
  "R-427",
  "R-428",
  "R-429",
  "R-430",
  "R-431",
  "R-432",
] as const;

function conversationIdsForClient(state: ManuAppState, clientId: string) {
  return new Set(
    state.conversations.filter((conversation) => conversation.clientId === clientId).map((item) => item.id),
  );
}

function messageIdsForClient(state: ManuAppState, clientId: string) {
  const conversationIds = conversationIdsForClient(state, clientId);
  return new Set(
    state.messages.filter((message) => conversationIds.has(message.conversationId)).map((message) => message.id),
  );
}

export function extractRetrievalSourceReferencesFromDecisions(
  decisions: AiDecisionRecord[],
): RetrievalSourceReferenceExport[] {
  const refs: RetrievalSourceReferenceExport[] = [];
  for (const decision of decisions) {
    const manifest = decision.contextManifest ?? {};
    const sourceRefs = Array.isArray(manifest.sourceRefs)
      ? (manifest.sourceRefs as Array<Record<string, unknown>>)
      : [];
    for (const ref of sourceRefs) {
      refs.push({
        aiDecisionId: decision.id,
        category: String(ref.category ?? "source"),
        messageId: ref.id ? String(ref.id) : undefined,
        segmentType: ref.segmentType ? String(ref.segmentType) : undefined,
      });
    }
    const { structuredRecordUpdates, ambiguousCompetingSources } = extractP85IfEContextManifestSignals(manifest);
    for (const signal of structuredRecordUpdates) {
      refs.push({
        aiDecisionId: decision.id,
        category: "structured_record_update_required",
        sourceMessageId: signal.sourceMessageId,
      });
    }
    for (const signal of ambiguousCompetingSources) {
      for (const sourceMessageId of signal.sourceMessageIds) {
        refs.push({
          aiDecisionId: decision.id,
          category: "ambiguous_competing_source",
          sourceMessageId,
        });
      }
    }
  }
  return refs;
}

export function buildP85IfIClientExportExtensions(
  state: ManuAppState,
  clientId: string,
): P85IfIClientExportExtensions {
  const messageIds = messageIdsForClient(state, clientId);
  const decisions = state.aiDecisions.filter((decision) => decision.clientId === clientId);

  return {
    interstageExportVersion: PHASE_85_IF_I_EXPORT_EXTENSION_VERSION,
    humanControlSessions: state.humanControlSessions.filter((session) => session.clientId === clientId),
    riskActivityEvents: state.riskActivityEvents.filter((event) => event.clientId === clientId),
    channelMessageRevisions: state.channelMessageRevisions.filter(
      (revision) => revision.messageId != null && messageIds.has(revision.messageId),
    ),
    retrievalSourceReferences: extractRetrievalSourceReferencesFromDecisions(decisions),
  };
}

export function appendP85IfIRecordsToClientExport(
  exportData: ClientScopedExport,
  state: ManuAppState,
): ClientScopedExport & P85IfIClientExportExtensions {
  const extensions = buildP85IfIClientExportExtensions(state, exportData.clientId);
  return {
    ...exportData,
    ...extensions,
  };
}

export function exportExcludesTenantChannelBindings(exportData: Record<string, unknown>) {
  return !("channelAccountBindings" in exportData) && !("channelActorBindings" in exportData);
}

export function detectP85IfIClientExportLeaks(exportData: Record<string, unknown>) {
  const failures: string[] = [];
  if (!exportExcludesTenantChannelBindings(exportData)) {
    failures.push("tenant_channel_bindings_leaked");
  }

  const serialized = JSON.stringify(exportData);
  for (const marker of ["payloadDigest", "payload_digest", "providerAccountId", "provider_account_id"]) {
    if (serialized.includes(marker)) {
      failures.push(`operational_marker_leaked:${marker}`);
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

export function assertP85IfIClientExportHasNoLeaks(exportData: Record<string, unknown>) {
  const result = detectP85IfIClientExportLeaks(exportData);
  if (!result.passed) {
    throw new Error(`client_export_leak_detected:${result.failures.join(",")}`);
  }
  return exportData;
}

export function redactP85IfIClientScopedRecordsInState(state: ManuAppState, clientId: string): ManuAppState {
  const conversationIds = conversationIdsForClient(state, clientId);
  const messageIds = messageIdsForClient(state, clientId);
  const client = state.clients.find((item) => item.id === clientId);
  const channelUserId = client?.channelUserId ?? null;

  return {
    ...state,
    messages: state.messages.map((message) =>
      conversationIds.has(message.conversationId)
        ? {
            ...message,
            providerAccountBindingId: null,
            providerEventId: null,
            providerMessageId: null,
            actorBindingId: null,
            authorInterface: message.origin === "system_event" ? message.authorInterface : null,
            contentStatus:
              message.contentStatus && message.contentStatus !== "available"
                ? ("redacted" as const)
                : message.contentStatus,
          }
        : message,
    ),
    channelMessageRevisions: state.channelMessageRevisions.map((revision) =>
      revision.messageId && messageIds.has(revision.messageId)
        ? {
            ...revision,
            channelEventId: null,
            providerEventId: null,
            priorBodyDigest: revision.priorBodyDigest ? PHASE_74_REDACTION_MARKER : null,
            currentBodyDigest: revision.currentBodyDigest ? PHASE_74_REDACTION_MARKER : null,
          }
        : revision,
    ),
    humanControlSessions: state.humanControlSessions.map((session) =>
      session.clientId === clientId
        ? {
            ...session,
            linkedHandoffId: null,
            linkedYellowHoldMessageId: null,
            openedByMessageId: null,
            latestHumanMessageId: null,
            reactivatedByDietitianId: null,
            reactivationReasonCode: null,
          }
        : session,
    ),
    riskActivityEvents: state.riskActivityEvents.map((event) =>
      event.clientId === clientId
        ? {
            ...event,
            sourceMessageId: null,
            handoffId: null,
            aiDecisionId: null,
            humanControlSessionId: null,
            metadata: { minimized: true, reason: "client_data_anonymized" },
          }
        : event,
    ),
    aiDecisions: state.aiDecisions.map((decision) =>
      decision.clientId === clientId
        ? {
            ...decision,
            contextManifest: decision.contextManifest
              ? {
                  minimized: true,
                  reason: "client_data_anonymized",
                }
              : null,
          }
        : decision,
    ),
    inboundQuarantines: state.inboundQuarantines.map((quarantine) =>
      channelUserId && quarantine.senderChannelUserId === channelUserId
        ? {
            ...quarantine,
            sourceConversationId: null,
            sourceMessageId: null,
            senderChannelUserId: null,
          }
        : quarantine,
    ),
  };
}

export function revokeTenantChannelBindingsInState(
  state: ManuAppState,
  tenantId: string,
  revokedByDietitianId: string,
  now = new Date().toISOString(),
): ManuAppState {
  const revokeAccount = (binding: ChannelAccountBindingRecord): ChannelAccountBindingRecord =>
    binding.tenantId === tenantId && binding.lifecycleStatus === "active"
      ? {
          ...binding,
          lifecycleStatus: "revoked",
          revokedAt: now,
          revokedByDietitianId,
          updatedAt: now,
        }
      : binding;

  const revokedAccountIds = new Set(
    state.channelAccountBindings
      .filter((binding) => binding.tenantId === tenantId && binding.lifecycleStatus === "active")
      .map((binding) => binding.id),
  );

  const revokeActor = (binding: ChannelActorBindingRecord): ChannelActorBindingRecord =>
    binding.tenantId === tenantId && revokedAccountIds.has(binding.accountBindingId) && !binding.revokedAt
      ? {
          ...binding,
          revokedAt: now,
          revokedByDietitianId,
        }
      : binding;

  return {
    ...state,
    channelAccountBindings: state.channelAccountBindings.map(revokeAccount),
    channelActorBindings: state.channelActorBindings.map(revokeActor),
    channelAdapterRollback: {
      ...state.channelAdapterRollback,
      tenantChannelAutomationDisabled: state.tenant.id === tenantId,
    },
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId,
        eventType: "tenant_channel_bindings_revoked",
        entityType: "tenant",
        entityId: tenantId,
        metadata: {
          minimized: true,
          revokedAccountBindingCount: revokedAccountIds.size,
        },
        createdAt: now,
      },
    ],
  };
}

export function evaluateP85IfILifecycleRedactionDomains(
  state: ManuAppState,
  clientId: string,
): Partial<Record<P85IfILifecycleRedactionDomain, string>> {
  const failures: Partial<Record<P85IfILifecycleRedactionDomain, string>> = {};
  const conversationIds = conversationIdsForClient(state, clientId);
  const messageIds = messageIdsForClient(state, clientId);
  const clientMessages = state.messages.filter((message) => conversationIds.has(message.conversationId));

  if (
    clientMessages.some(
      (message) =>
        message.providerAccountBindingId ||
        message.providerEventId ||
        message.providerMessageId ||
        message.actorBindingId,
    )
  ) {
    failures.message_provenance_fields = "message_provider_fields_remain";
  }

  if (
    state.channelMessageRevisions.some(
      (revision) =>
        revision.messageId &&
        messageIds.has(revision.messageId) &&
        (revision.providerEventId ||
          (revision.priorBodyDigest && revision.priorBodyDigest !== PHASE_74_REDACTION_MARKER) ||
          (revision.currentBodyDigest && revision.currentBodyDigest !== PHASE_74_REDACTION_MARKER)),
    )
  ) {
    failures.channel_message_revisions = "channel_message_revisions_not_minimized";
  }

  if (
    state.humanControlSessions.some(
      (session) =>
        session.clientId === clientId &&
        (session.openedByMessageId ||
          session.latestHumanMessageId ||
          session.linkedYellowHoldMessageId ||
          session.linkedHandoffId),
    )
  ) {
    failures.human_control_sessions = "human_control_session_links_remain";
  }

  if (
    state.riskActivityEvents.some(
      (event) =>
        event.clientId === clientId &&
        (event.sourceMessageId || event.handoffId || event.aiDecisionId || event.metadata.minimized !== true),
    )
  ) {
    failures.risk_activity_events = "risk_activity_not_minimized";
  }

  for (const proposal of state.contextIntakeProposals.filter((item) => item.clientId === clientId)) {
    if (proposal.sourceText || proposal.rawSourceReference || proposal.title !== PHASE_74_REDACTION_MARKER) {
      failures.context_intake_source_text = "context_intake_not_redacted";
      break;
    }
  }

  if (
    state.aiDecisions.some(
      (decision) =>
        decision.clientId === clientId &&
        decision.contextManifest &&
        !("minimized" in decision.contextManifest && decision.contextManifest.minimized === true),
    )
  ) {
    failures.retrieval_source_evidence = "retrieval_manifest_not_minimized";
  }

  return failures;
}

export function buildP85IfILifecycleClosureEvidence(state: ManuAppState, clientId: string): P85IfILifecycleClosureEvidence {
  const domainFailures = evaluateP85IfILifecycleRedactionDomains(state, clientId);
  const domainsCovered = PHASE_85_IF_I_LIFECYCLE_REDACTION_DOMAINS.filter((domain) => !domainFailures[domain]);
  const failures = Object.values(domainFailures).filter(Boolean) as string[];
  const exportProbe = {
    tenantId: state.tenant.id,
    clientId,
    contextIntakeProposals: state.contextIntakeProposals.filter((item) => item.clientId === clientId),
  };
  if (!exportExcludesTenantChannelBindings(exportProbe)) {
    failures.push("tenant_bindings_leaked_into_export");
  }

  return {
    version: PHASE_85_IF_I_LIFECYCLE_CLOSURE_VERSION,
    status: failures.length === 0 ? "pass" : "fail",
    clientId,
    domainsCovered,
    domainFailures,
    tenantBindingsExcludedFromExport: exportExcludesTenantChannelBindings(exportProbe),
    aggregateEvidenceOnly: true,
    failures,
  };
}

export function evaluateP85IfIProgramClosureEvidence(
  verification?: P85IfIProgramClosureVerificationInput,
): P85IfIProgramClosureEvidence {
  const failures: string[] = [];
  const requiredTracks = [
    "P85-IF-A",
    "P85-IF-B",
    "P85-IF-C",
    "P85-IF-D",
    "P85-IF-E",
    "P85-IF-F",
    "P85-IF-G",
    "P85-IF-H",
    "P85-IF-I",
  ] as const;

  if (!verification) {
    failures.push("program_closure_verification_missing");
  }

  const interstageTracksComplete = requiredTracks.filter(
    (track) => verification?.interstageTrackResults[track] === "pass",
  );

  if (verification) {
    for (const track of requiredTracks) {
      if (verification.interstageTrackResults[track] !== "pass") {
        failures.push(`${track.toLowerCase()}_not_verified`);
      }
    }

    for (const [key, status] of Object.entries({
      targetedTests: verification.targetedTests,
      fullAppSuite: verification.fullAppSuite,
      rlsSuite: verification.rlsSuite,
      channelReplay: verification.channelReplay,
      productionScaleRehearsal: verification.productionScaleRehearsal,
      productionBuild: verification.productionBuild,
      lifecycleRoundTrip: verification.lifecycleRoundTrip,
      exportLeakDetector: verification.exportLeakDetector,
    })) {
      if (status !== "pass") {
        failures.push(`${key}_${status}`);
      }
    }
  }

  return {
    version: PHASE_85_IF_I_LIFECYCLE_CLOSURE_VERSION,
    status: failures.length === 0 ? "pass" : "fail",
    interstageTracksComplete,
    riskRegisterUpdated: true,
    exportExtensionVersion: PHASE_85_IF_I_EXPORT_EXTENSION_VERSION,
    rlsCoverageDeclared: verification?.rlsSuite === "pass",
    productionPilotNoGo: true,
    r405Open: true,
    r406PendingWithoutLocalSupabase: verification?.rlsSuite !== "pass",
    failures,
  };
}

export function serializeP85IfIExportFiles(exportData: ClientScopedExport & Partial<P85IfIClientExportExtensions>) {
  return {
    "human_control_sessions.json": JSON.stringify(exportData.humanControlSessions ?? [], null, 2),
    "risk_activity_events.json": JSON.stringify(exportData.riskActivityEvents ?? [], null, 2),
    "channel_message_revisions.json": JSON.stringify(exportData.channelMessageRevisions ?? [], null, 2),
    "context_intake_proposals.json": JSON.stringify(exportData.contextIntakeProposals ?? [], null, 2),
    "retrieval_source_references.json": JSON.stringify(exportData.retrievalSourceReferences ?? [], null, 2),
  };
}
