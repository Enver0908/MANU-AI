import {
  evaluateInboundPreflight,
  resolveAiActivation,
} from "dietitian-ai-assistant-architecture";
import { evaluateChannelAutomationRollback } from "./channel-adapter-rollback";
import { evaluateClientAutopilotQualification } from "./phase-70-form-hardening";
import {
  getMissingSafetyChecklistItems,
  isSafetyChecklistComplete,
  safetyChecklistLabels,
} from "./safety-checklist";
import type { AiMode, AiStatus, ClientRecord, ManuAppState } from "./types";

export const AI_STATUS_LABELS_TR: Record<AiStatus, string> = {
  active: "Aktif",
  passive: "Pasif",
};

export const AI_MODE_LABELS_TR: Record<AiMode, string> = {
  autopilot: "Autopilot",
  copilot: "Copilot",
  manual: "Manuel",
  paused: "Duraklatildi",
};

export type AiPreflightBlocker = {
  id: string;
  label: string;
  severity: "block" | "warn";
  code: string;
};

export type AutopilotReadinessSummary = {
  status: "qualified" | "incomplete" | "not_qualified";
  missingLabels: string[];
  ready: boolean;
  blocked: boolean;
};

const AUTOPILOT_MISSING_LABELS_TR: Record<string, string> = {
  client_not_found_or_removed: "Danisan bulunamadi veya kaldirildi",
  adult_status_not_adult: "Yas durumu yetiskin degil",
  communication_language_missing: "Iletisim dili eksik",
  channel_permission_not_ready: "Kanal izni hazir degil",
  ai_status_not_active: "AI durumu aktif degil",
  ai_mode_not_autopilot: "AI modu autopilot degil",
  safety_checklist_incomplete: "Guvenlik kontrol listesi tamamlanmadi",
  published_client_form_response_missing: "Yayinlanmis danisan form yaniti yok",
  sensitive_data_consent_not_approved: "Hassas veri onayi onaylanmadi",
  form_prompt_visibility_not_acknowledged: "Form prompt gorunurluk onayi eksik",
  form_channel_permission_not_ready: "Form kanal izni hazir degil",
  form_adult_status_not_adult: "Form yetiskin durumu onaylanmadi",
};

const ROLLBACK_LABELS_TR: Record<string, string> = {
  channel_automation_rollback_global: "Global kanal otomasyon geri alma aktif",
  channel_automation_rollback_tenant: "Tenant kanal otomasyon geri alma aktif",
  channel_automation_rollback_dietitian: "Diyetisyen kanal otomasyon geri alma aktif",
  channel_automation_rollback_client: "Danisan kanal otomasyon geri alma aktif",
};

const PREFLIGHT_LABELS_TR: Record<string, string> = {
  client_removed_anonymized: "Danisan kaldirildi ve anonimlestirildi",
  red_risk_reactivation_required: "Kirmizi risk kilidi nedeniyle yeniden aktivasyon gerekli",
  human_takeover_lock: "Diyetisyen devralma kilidi aktif",
  identity_quarantine_no_channel_id: "Kanal kimligi eksik",
  identity_quarantine_adult_status_unknown: "Yas durumu dogrulanmadi",
  mandatory_safety_fields_missing: "Autopilot icin guvenlik profili tamamlanmadi",
};

export function isRedRiskLockActive(client: ClientRecord) {
  return client.redRiskLock.status === "locked";
}

export function isYellowRiskHoldActive(client: ClientRecord) {
  return client.yellowRiskHold.status === "active";
}

export function isAiControlLockedByRedRisk(client: ClientRecord) {
  return isRedRiskLockActive(client);
}

export function isAiConfigurationLockedByRedRisk(client: ClientRecord) {
  return isRedRiskLockActive(client);
}

export type AiControlDisabledState = {
  activationDisabled: boolean;
  configurationDisabled: boolean;
};

export function resolveAiControlDisabledState(
  client: ClientRecord,
  input: { disabled?: boolean; isActivatingAi?: boolean } = {},
): AiControlDisabledState {
  const removed = client.lifecycleStatus === "removed_anonymized";
  const globallyDisabled = Boolean(input.disabled) || removed;
  return {
    activationDisabled: globallyDisabled || Boolean(input.isActivatingAi),
    configurationDisabled: globallyDisabled || isAiConfigurationLockedByRedRisk(client),
  };
}

export const RED_LOCK_ATOMIC_ACTIVATION_CTA_TR = "AI'yi etkinlestir ve kirmizi uyariyi kapat";

export function formatAutopilotMissingLabel(code: string) {
  if (AUTOPILOT_MISSING_LABELS_TR[code]) return AUTOPILOT_MISSING_LABELS_TR[code];
  if (code.startsWith("form_field_missing_")) {
    return `Form alani eksik: ${code.replace("form_field_missing_", "")}`;
  }
  if (code.startsWith("registry_field_missing_")) {
    return `Kayit alani eksik: ${code.replace("registry_field_missing_", "")}`;
  }
  return code.replaceAll("_", " ");
}

export function formatActivationWindowLabel(client: ClientRecord, now: Date = new Date()) {
  const activation = resolveAiActivation(client, now);
  switch (activation.status) {
    case "active":
      return "Aktivasyon penceresi acik";
    case "scheduled":
      return "Aktivasyon henuz baslamadi";
    case "expired":
      return "Aktivasyon penceresi suresi doldu";
    default:
      return "AI pasif";
  }
}

export function getActivationWindowTone(client: ClientRecord, now: Date = new Date()) {
  const activation = resolveAiActivation(client, now);
  if (activation.active) return "emerald" as const;
  if (activation.status === "scheduled") return "amber" as const;
  if (activation.status === "expired") return "red" as const;
  return "stone" as const;
}

export function summarizeAutopilotReadinessGate(state: ManuAppState, client: ClientRecord): AutopilotReadinessSummary {
  const qualification = evaluateClientAutopilotQualification(state, client.id);
  return {
    status: qualification.status,
    missingLabels: qualification.missing.map(formatAutopilotMissingLabel),
    ready: qualification.status === "qualified",
    blocked: qualification.status === "not_qualified",
  };
}

export function collectAiPreflightBlockers(state: ManuAppState, client: ClientRecord): AiPreflightBlocker[] {
  const blockers: AiPreflightBlocker[] = [];

  if (client.lifecycleStatus === "removed_anonymized") {
    blockers.push({
      id: "client_removed",
      label: PREFLIGHT_LABELS_TR.client_removed_anonymized,
      severity: "block",
      code: "client_removed_anonymized",
    });
    return blockers;
  }

  if (isRedRiskLockActive(client)) {
    blockers.push({
      id: "red_risk_lock",
      label: "Kirmizi risk kilidi aktif; atomik AI aktivasyonu ile kapanir",
      severity: "warn",
      code: "red_risk_lock_active",
    });
  }

  if (isYellowRiskHoldActive(client)) {
    blockers.push({
      id: "yellow_risk_hold",
      label: "Sari risk bekleme aktif; AI gonderimi bekletiliyor",
      severity: "warn",
      code: "yellow_risk_hold_active",
    });
  }

  const rollback = evaluateChannelAutomationRollback(state, client);
  if (rollback) {
    blockers.push({
      id: rollback.blockedReason,
      label: ROLLBACK_LABELS_TR[rollback.blockedReason] || rollback.blockedReason,
      severity: "block",
      code: rollback.blockedReason,
    });
  }

  const preflight = evaluateInboundPreflight(client, {
    safetyChecklistComplete: client.mandatorySafetyComplete && isSafetyChecklistComplete(client),
    missingSafetyChecklistItems: getMissingSafetyChecklistItems(client),
  });
  if (preflight) {
    blockers.push({
      id: preflight.blockedReason,
      label: PREFLIGHT_LABELS_TR[preflight.blockedReason] || preflight.blockedReason.replaceAll("_", " "),
      severity: "block",
      code: preflight.blockedReason,
    });
  }

  const activation = resolveAiActivation(client);
  if (client.aiStatus === "active" && !activation.active) {
    blockers.push({
      id: activation.reason || "activation_window_closed",
      label: formatActivationWindowLabel(client),
      severity: "warn",
      code: activation.reason || "activation_window_closed",
    });
  }

  if (client.aiMode === "autopilot") {
    const readiness = summarizeAutopilotReadinessGate(state, client);
    if (!readiness.ready) {
      for (const [index, label] of readiness.missingLabels.entries()) {
        blockers.push({
          id: `autopilot_missing_${index}`,
          label,
          severity: readiness.blocked ? "block" : "warn",
          code: readiness.status,
        });
      }
    }
  }

  return dedupeBlockers(blockers);
}

export function countAiControlBlockers(state: ManuAppState, client: ClientRecord) {
  return collectAiPreflightBlockers(state, client).filter((blocker) => blocker.severity === "block").length;
}

export function summarizeAiAssistantControl(state: ManuAppState, client: ClientRecord, now: Date = new Date()) {
  const blockers = collectAiPreflightBlockers(state, client);
  const readiness = summarizeAutopilotReadinessGate(state, client);
  const safetyMissing = getMissingSafetyChecklistItems(client).map((key) => safetyChecklistLabels[key]);

  return {
    activationLabel: formatActivationWindowLabel(client, now),
    activationTone: getActivationWindowTone(client, now),
    blockers,
    blockerCount: blockers.filter((blocker) => blocker.severity === "block").length,
    warningCount: blockers.filter((blocker) => blocker.severity === "warn").length,
    readiness,
    safetyMissing,
    safetyComplete: isSafetyChecklistComplete(client),
    redLockActive: isRedRiskLockActive(client),
    yellowHoldActive: isYellowRiskHoldActive(client),
    humanTakeoverLocked: client.humanTakeoverLocked,
  };
}

function dedupeBlockers(blockers: AiPreflightBlocker[]) {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.code}:${blocker.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
