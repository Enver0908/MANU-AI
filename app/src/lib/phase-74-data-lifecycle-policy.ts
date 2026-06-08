import { createHash } from "node:crypto";
import {
  anonymizeClientInState,
  buildClientScopedExport,
  PHASE_74_REDACTION_MARKER,
  removeClientInState,
  type ClientScopedExport,
} from "./data-governance";
import {
  answersContainUnredactedFoodRuleData,
  buildFoodRuleExportSection,
  buildProposalExportSection,
  clientContainsUnredactedFoodRuleProfile,
  PHASE_76N_EXPORT_FOOD_RULE_CATEGORIES,
  PHASE_76N_LIFECYCLE_VERSION,
  PHASE_76N_TRANSACTIONAL_REDACTION_FIELDS,
  proposalContainsUnredactedFoodRuleData,
} from "./phase-76n-food-rule-lifecycle";
import type { LaunchGateEvidenceRecord } from "./launch-gates";
import type { ClientRecord, ManuAppState, MessageRecord } from "./types";

export const PHASE_74_POLICY_VERSION = "phase-74-data-lifecycle-policy-v1";
export const PHASE_74_EXPORT_VERSION = "phase74-export-v1.1";
export { PHASE_74_REDACTION_MARKER } from "./data-governance";

export type Phase74ApprovalStatus = "draft";

export type Phase74RetentionPhase = "active_service" | "inactive_client" | "post_removal_dsar";

export type Phase74RetentionEntry = {
  dataCategory: string;
  activeServiceRetention: string;
  inactiveClientRetention: string;
  postRemovalRetention: string;
  note: string;
  approvalStatus: Phase74ApprovalStatus;
};

export type Phase74DsarRequestType =
  | "access_export"
  | "correction"
  | "deletion"
  | "anonymization"
  | "processing_restriction"
  | "consent_withdrawal"
  | "data_transfer"
  | "objection";

export type Phase74DsarSlaEntry = {
  stage: string;
  targetDuration: string;
  maximumDuration: string;
};

export type Phase74ExportManifest = {
  exportVersion: string;
  generatedAt: string;
  tenantId: string;
  clientId: string;
  requestId: string | null;
  scope: "client_full_export";
  includedFiles: string[];
  excludedCategories: string[];
  checksumAlgorithm: "sha256";
  containsRawHealthData: boolean;
  containsSecrets: false;
  generatedBy: string;
};

export type Phase74ExportPackage = {
  manifest: Phase74ExportManifest;
  files: Record<string, string>;
  checksums: Record<string, string>;
};

export type Phase74RedactionEvidence = {
  policyVersion: string;
  redactionVersion: string;
  clientId: string;
  requestType: "deletion" | "anonymization";
  completedAt: string;
  affectedTableCounts: Record<string, number>;
  minimizedEvidenceOnly: true;
};

export type Phase74RedactionInvariantResult = {
  passed: boolean;
  blockingReasons: string[];
};

const DRAFT: Phase74ApprovalStatus = "draft";

export const PHASE_74_OFFICIAL_SOURCE_FAMILIES = [
  "6698 sayili KVKK",
  "Kisisel Saglik Verileri Hakkinda Yonetmelik",
  "Kisisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkinda Yonetmelik",
  "KVKK Kurumu silme/yok etme/anonimlestirme rehberi",
  "Hasta Haklari Yonetmeligi",
  "Uzaktan Saglik Hizmetleri Yonetmeligi",
  "Saglik Bilgi Yonetim Sistemleri Hakkinda Yonetmelik",
] as const;

export const PHASE_74_RETENTION_SUMMARY = {
  activeRetention: "service_active_duration",
  inactiveClientRetentionMonths: 24,
  rawWebhookRetentionDaysMax: 7,
  idempotencyRetentionDays: 90,
  notificationRetentionMonths: 12,
  conversationMemoryRetentionMonths: 12,
  auditLegalEvidenceRetentionYears: 5,
  backupRetentionDays: 30,
  channelIdentityPostDeactivationMonths: 6,
} as const;

export const PHASE_74_RETENTION_POLICY: Phase74RetentionEntry[] = [
  entry("client_profile", "Hizmet devam ettigi surece", "24 ay", "Anonimize/redact", "Kimlik ve kanal bilgileri ilk redaction hedefi."),
  entry("health_profile_flags", "Hizmet devam ettigi surece", "24 ay", "Prompt/source path'ten hemen kaldirilir", "Detaylar prompt'a zaten girmemeli."),
  entry("active_diet_plan_summary", "Hizmet devam ettigi surece", "24 ay", "Redact/anonymize", "Removal sonrasi answerability source olamaz."),
  entry("plan_version_audit_refs", "Hizmet devam ettigi surece", "24 ay", "Minimized audit ref kalabilir", "Raw plan icerigi silinir."),
  entry("messages", "Hizmet devam ettigi surece", "24 ay", "Client text redact", "Origin metadata korunabilir."),
  entry("ai_decisions", "Hizmet devam ettigi surece", "24 ay", "Minimized metadata kalabilir", "ProviderAttempted, risk, send_status."),
  entry("risk_assessments", "Hizmet devam ettigi surece", "24 ay", "Reason codes minimized", "Raw text yok."),
  entry("handoffs", "Hizmet devam ettigi surece", "24 ay", "Content redact", "Status/timestamps minimized."),
  entry("notifications", "Hizmet devam ettigi surece", "12 ay", "Client content redact", "Sensitive preview yok."),
  entry("form_responses", "Hizmet devam ettigi surece", "24 ay", "Promptable values redact", "Schema snapshot kalabilir."),
  entry("structured_food_rules", "Hizmet devam ettigi surece", "24 ay", "Food-rule fields redact", "Phase 76D structured fields and exchange groups."),
  entry("client_update_proposals", "Hizmet devam ettigi surece", "24 ay", "Source text and patches redact", "Includes food_rule proposal patches."),
  entry("product_label_evidence", "Hizmet devam ettigi surece", "24 ay", "Raw label text redact", "Trusted-source metadata only in audit."),
  entry("dietitian_context_updates", "Hizmet devam ettigi surece", "24 ay", "Content redact", "Source authority olmaktan cikar."),
  entry("pinned_notes", "Hizmet devam ettigi surece", "24 ay", "Redact", "Prompt/source path'ten cikar."),
  entry("conversation_memories", "Hizmet devam ettigi surece", "12 ay", "Delete/redact", "Removed client memory prompt'a giremez."),
  entry("channel_identity", "Hizmet devam ettigi surece", "6 ay deactivation sonrasi", "Hard delete veya irreversible hash", "Telefon/Telegram ID kritik privacy."),
  entry("processed_inbound_ids", "Idempotency icin", "90 gun", "Hash/minimized kalabilir", "Raw payload yok."),
  entry("raw_webhook_payload", "Production'da kapali", "0-7 gun maksimum", "Delete", "Varsayilan kalici saklama yok."),
  entry("provider_metadata", "Provider active oldugunda", "12 ay", "Minimized audit only", "Raw prompt/completion yok."),
  entry("internal_copilot_tool_refs", "Hizmet devam ettigi surece", "12 ay", "Client refs redact", "Source refs minimized."),
  entry("audit_events", "Guvenlik/compliance", "5 yil", "Minimized non-identifying evidence", "Raw health content yok."),
  entry("dsar_deletion_evidence", "Talep kaniti", "5 yil", "Minimized evidence", "Talep ve islem kaniti."),
  entry("backups", "Operasyonel recovery", "30 gun rolling", "Expire by rotation", "Restore sonrasi redaction replay zorunlu."),
];

export const PHASE_74_EXPORT_EXCLUDED_CATEGORIES = [
  "raw_provider_prompt",
  "raw_provider_completion",
  "secrets_tokens_webhook_payloads",
  "other_tenants_or_clients",
  "internal_system_prompts",
  "dietitian_only_notes_default",
] as const;

export const PHASE_74_EXPORT_INCLUDED_FILES = [
  "manifest.json",
  "client_summary.html",
  "client_profile.json",
  "messages.jsonl",
  "messages.csv",
  "ai_decisions.jsonl",
  "handoffs.jsonl",
  "form_responses.json",
  "structured_food_rules.json",
  "client_update_proposals.json",
  "diet_plan_snapshots.json",
  "audit_events_minimized.jsonl",
  "checksums.sha256",
] as const;

export const PHASE_74_DSAR_SLA_POLICY: Phase74DsarSlaEntry[] = [
  { stage: "request_acknowledgement", targetDuration: "72 hours", maximumDuration: "5 business days" },
  { stage: "identity_authority_verification", targetDuration: "5 business days", maximumDuration: "10 business days" },
  { stage: "scope_definition", targetDuration: "5 business days", maximumDuration: "10 business days" },
  { stage: "export_preparation", targetDuration: "15 days", maximumDuration: "30 days" },
  { stage: "deletion_operational_block", targetDuration: "24 hours", maximumDuration: "3 business days" },
  { stage: "transactional_redaction", targetDuration: "7 days", maximumDuration: "30 days" },
  { stage: "final_response", targetDuration: "15 days target", maximumDuration: "30 days legal maximum" },
];

export const PHASE_74_TRANSACTIONAL_REDACTION_FIELDS = [
  "client_profile_identity",
  "channel_identities",
  "health_profile",
  "diet_plan_text",
  "form_responses",
  "messages",
  "ai_decisions_raw_context",
  "risk_assessment_detail_text",
  "handoffs_content",
  "notifications_content",
  "conversation_memories",
  "pinned_notes",
  "dietitian_context_updates",
  "internal_copilot_source_refs",
  "promptable_summaries",
  "search_index_cache_entries",
  ...PHASE_76N_TRANSACTIONAL_REDACTION_FIELDS,
] as const;

function entry(
  dataCategory: string,
  activeServiceRetention: string,
  inactiveClientRetention: string,
  postRemovalRetention: string,
  note: string,
): Phase74RetentionEntry {
  return {
    dataCategory,
    activeServiceRetention,
    inactiveClientRetention,
    postRemovalRetention,
    note,
    approvalStatus: DRAFT,
  };
}

export function evaluatePhase74PolicyReadiness(): { status: "pass" | "fail"; blockingReasons: string[] } {
  const blockingReasons: string[] = [];

  if (PHASE_74_RETENTION_POLICY.length < 20) {
    blockingReasons.push("retention policy incomplete");
  }
  if (PHASE_74_DSAR_SLA_POLICY.length < 7) {
    blockingReasons.push("DSAR SLA policy incomplete");
  }
  if (PHASE_74_TRANSACTIONAL_REDACTION_FIELDS.length < 10) {
    blockingReasons.push("transactional redaction field contract incomplete");
  }

  for (const record of PHASE_74_RETENTION_POLICY) {
    if (record.approvalStatus !== "draft") {
      blockingReasons.push(`retention entry ${record.dataCategory} is not draft`);
    }
  }

  return {
    status: blockingReasons.length === 0 ? "pass" : "fail",
    blockingReasons,
  };
}

export function isClientExcludedFromOperationalPaths(client: ClientRecord): boolean {
  if (client.lifecycleStatus === "removed_anonymized") {
    return true;
  }

  return (
    client.aiStatus === "passive" &&
    client.aiMode === "manual" &&
    client.channelPermission === "blocked" &&
    client.humanTakeoverLocked
  );
}

export function buildPhase74ImmediateOperationalRemovalPatch(_client: ClientRecord): Partial<ClientRecord> {
  return {
    aiStatus: "passive",
    aiMode: "manual",
    humanTakeoverLocked: true,
    channelPermission: "blocked",
    aiActiveFrom: null,
    aiActiveUntil: null,
  };
}

function invalidateClientDraftMessages(state: ManuAppState, clientId: string): ManuAppState {
  const conversationIds = new Set(
    state.conversations.filter((conversation) => conversation.clientId === clientId).map((conversation) => conversation.id),
  );

  return {
    ...state,
    messages: state.messages.map((message) =>
      conversationIds.has(message.conversationId) && message.status === "draft"
        ? ({
            ...message,
            status: "blocked",
            body: PHASE_74_REDACTION_MARKER,
          } satisfies MessageRecord)
        : message,
    ),
  };
}

function countAffectedRecords(state: ManuAppState, clientId: string): Record<string, number> {
  const conversationIds = new Set(
    state.conversations.filter((conversation) => conversation.clientId === clientId).map((conversation) => conversation.id),
  );

  return {
    clients: state.clients.filter((client) => client.id === clientId).length,
    conversations: state.conversations.filter((conversation) => conversation.clientId === clientId).length,
    messages: state.messages.filter((message) => conversationIds.has(message.conversationId)).length,
    form_responses: state.clientFormResponses.filter((response) => response.clientId === clientId).length,
    context_updates: state.clientContextUpdates.filter((update) => update.clientId === clientId).length,
    client_update_proposals: state.clientUpdateProposals.filter((proposal) => proposal.clientId === clientId).length,
    structured_food_rule_fields: state.clientFormResponses.filter((response) => response.clientId === clientId).length,
    ai_decisions: state.aiDecisions.filter((decision) => decision.clientId === clientId).length,
    handoffs: state.handoffCases.filter((handoff) => handoff.clientId === clientId).length,
  };
}

export function evaluatePhase74RedactionInvariants(
  state: ManuAppState,
  clientId: string,
): Phase74RedactionInvariantResult {
  const client = state.clients.find((item) => item.id === clientId);
  const blockingReasons: string[] = [];

  if (!client) {
    return { passed: false, blockingReasons: ["client_not_found"] };
  }

  if (client.aiStatus !== "passive") blockingReasons.push("client aiStatus must be passive");
  if (client.aiMode !== "manual") blockingReasons.push("client aiMode must be manual");
  if (!client.humanTakeoverLocked) blockingReasons.push("humanTakeoverLocked must be true");
  if (client.channelPermission !== "blocked") blockingReasons.push("channel permission must be blocked");
  if (client.channelUserId) blockingReasons.push("channel identity must be cleared");
  if (client.primaryPhoneE164) blockingReasons.push("primary phone must be cleared");
  if (client.pinnedNotes.length > 0) blockingReasons.push("pinned notes must be cleared");
  if (client.dietPlan.summary) blockingReasons.push("diet plan summary must be cleared");
  if (clientContainsUnredactedFoodRuleProfile(client)) {
    blockingReasons.push("client food-rule profile fields must be cleared");
  }

  const conversationIds = new Set(
    state.conversations.filter((conversation) => conversation.clientId === clientId).map((conversation) => conversation.id),
  );

  for (const conversation of state.conversations.filter((item) => conversationIds.has(item.id))) {
    if (conversation.rollingSummary) {
      blockingReasons.push("conversation memory must be cleared");
      break;
    }
  }

  const clientMessages = state.messages.filter((message) => conversationIds.has(message.conversationId));
  if (clientMessages.some((message) => message.body !== PHASE_74_REDACTION_MARKER)) {
    blockingReasons.push("all client messages must be redacted");
  }
  if (clientMessages.some((message) => message.status === "draft")) {
    blockingReasons.push("pending drafts must be invalidated");
  }

  for (const response of state.clientFormResponses.filter((item) => item.clientId === clientId)) {
    if (response.submittedPhoneE164) blockingReasons.push("form response phone must be cleared");
    if (answersContainUnredactedFoodRuleData(response.answers)) {
      blockingReasons.push("structured food rule form fields must be redacted");
    }
    if (JSON.stringify(response.answers).includes("health details")) {
      blockingReasons.push("form response answers must be redacted");
    }
  }

  for (const proposal of state.clientUpdateProposals.filter((item) => item.clientId === clientId)) {
    if (proposalContainsUnredactedFoodRuleData(proposal)) {
      blockingReasons.push("proposal source text and patches must be redacted");
    }
  }

  return {
    passed: blockingReasons.length === 0,
    blockingReasons,
  };
}

export function applyPhase74TransactionalRedactionInState(
  state: ManuAppState,
  clientId: string,
  requestType: "deletion" | "anonymization" = "deletion",
): { state: ManuAppState; evidence: Phase74RedactionEvidence } {
  const withDraftsInvalidated = invalidateClientDraftMessages(state, clientId);
  const redacted =
    requestType === "deletion"
      ? removeClientInState(withDraftsInvalidated, clientId)
      : anonymizeClientInState(withDraftsInvalidated, clientId);

  const invariants = evaluatePhase74RedactionInvariants(redacted, clientId);
  if (!invariants.passed) {
    throw new Error(`phase74_redaction_invariants_failed:${invariants.blockingReasons.join(",")}`);
  }

  const completedAt = new Date().toISOString();

  return {
    state: redacted,
    evidence: {
      policyVersion: PHASE_74_POLICY_VERSION,
      redactionVersion: PHASE_74_POLICY_VERSION,
      clientId,
      requestType,
      completedAt,
      affectedTableCounts: countAffectedRecords(redacted, clientId),
      minimizedEvidenceOnly: true,
    },
  };
}

function serializeMessagesJsonl(exportData: ClientScopedExport): string {
  return exportData.messages
    .map((message) =>
      JSON.stringify({
        id: message.id,
        conversationId: message.conversationId,
        origin: message.origin,
        sender: message.sender,
        status: message.status,
        body: message.body,
        createdAt: message.createdAt,
      }),
    )
    .join("\n");
}

function serializeMessagesCsv(exportData: ClientScopedExport): string {
  const header = "id,conversationId,origin,sender,status,createdAt";
  const rows = exportData.messages.map((message) =>
    [message.id, message.conversationId, message.origin, message.sender, message.status ?? "", message.createdAt].join(","),
  );
  return [header, ...rows].join("\n");
}

export function buildPhase74ExportPackage(
  state: ManuAppState,
  clientId: string,
  options: { requestId?: string; generatedBy?: string } = {},
): Phase74ExportPackage {
  const exportData = buildClientScopedExport(state, clientId);
  const generatedAt = exportData.generatedAt;
  const generatedBy = options.generatedBy ?? state.dietitian.id;

  const files: Record<string, string> = {
    "client_summary.html": `<html><body><h1>Client export</h1><p>Client ${exportData.client.id}</p></body></html>`,
    "client_profile.json": JSON.stringify(exportData.client, null, 2),
    "messages.jsonl": serializeMessagesJsonl(exportData),
    "messages.csv": serializeMessagesCsv(exportData),
    "ai_decisions.jsonl": exportData.aiDecisions.map((decision) => JSON.stringify(decision)).join("\n"),
    "handoffs.jsonl": exportData.handoffCases.map((handoff) => JSON.stringify(handoff)).join("\n"),
    "form_responses.json": JSON.stringify(exportData.clientFormResponses, null, 2),
    "structured_food_rules.json": JSON.stringify(
      {
        lifecycleVersion: PHASE_76N_LIFECYCLE_VERSION,
        categories: [...PHASE_76N_EXPORT_FOOD_RULE_CATEGORIES],
        ...buildFoodRuleExportSection(exportData.clientFormResponses),
      },
      null,
      2,
    ),
    "client_update_proposals.json": JSON.stringify(buildProposalExportSection(exportData.clientUpdateProposals), null, 2),
    "diet_plan_snapshots.json": JSON.stringify({ summary: exportData.client.dietPlan }, null, 2),
    "audit_events_minimized.jsonl": exportData.auditEvents.map((event) => JSON.stringify(event)).join("\n"),
  };

  const manifest: Phase74ExportManifest = {
    exportVersion: PHASE_74_EXPORT_VERSION,
    generatedAt,
    tenantId: exportData.tenantId,
    clientId: exportData.clientId,
    requestId: options.requestId ?? null,
    scope: "client_full_export",
    includedFiles: [...PHASE_74_EXPORT_INCLUDED_FILES],
    excludedCategories: [...PHASE_74_EXPORT_EXCLUDED_CATEGORIES],
    checksumAlgorithm: "sha256",
    containsRawHealthData: true,
    containsSecrets: false,
    generatedBy,
  };

  files["manifest.json"] = JSON.stringify(manifest, null, 2);

  const checksums = Object.fromEntries(
    Object.entries(files).map(([filename, content]) => [filename, createHash("sha256").update(content).digest("hex")]),
  );
  files["checksums.sha256"] = Object.entries(checksums)
    .map(([filename, checksum]) => `${checksum}  ${filename}`)
    .join("\n");

  return { manifest, files, checksums };
}

export function isPhase74ProductionDataLifecycleAllowed(): boolean {
  return process.env.MANU_ALLOW_PHASE_74_PRODUCTION_LIFECYCLE === "true";
}

export function buildPhase74LaunchGateEvidence(): LaunchGateEvidenceRecord[] {
  return [
    {
      gateId: "legal_privacy_review",
      artifactTitle: "Phase 74 retention, export, anonymization and DSAR policy pack",
      artifactRef: PHASE_74_POLICY_VERSION,
      approvalStatus: "draft",
      coveredEvidence: [
        "legal basis matrix",
        "privacy notice and client permission documents",
        "user-supplied dietitian/client form privacy and prompt-allowlist approval",
      ],
      sanitizedReference: true,
    },
    {
      gateId: "incident_response_runbook",
      artifactTitle: "Phase 74 DSAR/deletion SLA and transactional redaction contract",
      artifactRef: PHASE_74_POLICY_VERSION,
      approvalStatus: "draft",
      coveredEvidence: ["client deletion and export operating procedure"],
      sanitizedReference: true,
    },
  ];
}
