export const PRODUCTION_STAGE_1_PHASE_6_HANDOFF_VERSION =
  "production-readiness-stage-1-phase-6-handoff-v1";

export const PRODUCTION_STAGE_1_PLAN_NAME =
  "Birinci Asama: Canli Hesaplari Beklemeden Teknik Hazirlik";

export type ProductionStage1PhaseStatus =
  | "PHASE_1_LOCAL_COMPLETE"
  | "PHASE_2_LOCAL_COMPLETE"
  | "PHASE_3_LOCAL_COMPLETE"
  | "PHASE_4_LOCAL_COMPLETE"
  | "PHASE_5_LOCAL_COMPLETE";

export type ProductionStage1OwnerActionStatus = "OWNER_PENDING" | "OWNER_COMPLETE";

export type ProductionStage1OwnerAction = {
  id:
    | "meta_whatsapp_business"
    | "zai_glm_ai_provider"
    | "production_secrets"
    | "production_supabase_and_migrations"
    | "manual_transfer_operations"
    | "incident_monitoring_and_rollback"
    | "explicit_production_release_approval";
  label: string;
  requiredBefore: "production_go";
  status: ProductionStage1OwnerActionStatus;
};

export type ProductionStage1CodexAfterOwnerAction = {
  id:
    | "apply_remote_migrations"
    | "configure_production_env"
    | "deploy_verified_release"
    | "run_production_smoke_checks"
    | "enable_real_webhooks_and_workers"
    | "write_final_go_no_go_report";
  label: string;
};

export type ProductionStage1PhaseEvidence = {
  phase: 1 | 2 | 3 | 4 | 5;
  status: ProductionStage1PhaseStatus;
  evidencePath: string;
  localOnly: true;
};

export type ProductionStage1HandoffDecision = {
  schemaVersion: typeof PRODUCTION_STAGE_1_PHASE_6_HANDOFF_VERSION;
  planName: typeof PRODUCTION_STAGE_1_PLAN_NAME;
  date: "2026-08-30";
  branch: "codex/production-readiness-stage-1";
  phaseEvidence: ProductionStage1PhaseEvidence[];
  localTechnicalPreparationComplete: boolean;
  ownerHandoffReady: boolean;
  productionPilotGo: false;
  iphoneSafariPwaStatus: "WAIVED_NOT_EXECUTED";
  liveActionsExecuted: [];
  ownerActionsRequired: ProductionStage1OwnerAction[];
  codexActionsAfterOwnerCompletion: ProductionStage1CodexAfterOwnerAction[];
  blockingReasons: string[];
};

export const PRODUCTION_STAGE_1_PHASE_EVIDENCE: ProductionStage1PhaseEvidence[] = [
  {
    phase: 1,
    status: "PHASE_1_LOCAL_COMPLETE",
    evidencePath: "docs/PRODUCTION_READINESS_STAGE_1_PHASE_1_EVIDENCE.md",
    localOnly: true,
  },
  {
    phase: 2,
    status: "PHASE_2_LOCAL_COMPLETE",
    evidencePath: "docs/PRODUCTION_READINESS_STAGE_1_PHASE_2_EVIDENCE.md",
    localOnly: true,
  },
  {
    phase: 3,
    status: "PHASE_3_LOCAL_COMPLETE",
    evidencePath: "docs/PRODUCTION_READINESS_STAGE_1_PHASE_3_EVIDENCE.md",
    localOnly: true,
  },
  {
    phase: 4,
    status: "PHASE_4_LOCAL_COMPLETE",
    evidencePath: "docs/PRODUCTION_READINESS_STAGE_1_PHASE_4_EVIDENCE.md",
    localOnly: true,
  },
  {
    phase: 5,
    status: "PHASE_5_LOCAL_COMPLETE",
    evidencePath: "docs/PRODUCTION_READINESS_STAGE_1_PHASE_5_EVIDENCE.md",
    localOnly: true,
  },
];

export const PRODUCTION_STAGE_1_OWNER_ACTIONS_REQUIRED: ProductionStage1OwnerAction[] = [
  {
    id: "meta_whatsapp_business",
    label: "Meta Business, WABA, phone number, policy/template approval, and webhook target approval.",
    requiredBefore: "production_go",
    status: "OWNER_PENDING",
  },
  {
    id: "zai_glm_ai_provider",
    label: "Z.ai GLM-5.3-Flash provider account, vendor risk, privacy/legal, clinical safety, and retention/training approvals.",
    requiredBefore: "production_go",
    status: "OWNER_PENDING",
  },
  {
    id: "production_secrets",
    label: "Production secret manager values for Supabase, provider keys, webhook tokens, app secrets, and rotation owner.",
    requiredBefore: "production_go",
    status: "OWNER_PENDING",
  },
  {
    id: "production_supabase_and_migrations",
    label: "Production Supabase project, backup posture, and explicit approval to apply remote migrations.",
    requiredBefore: "production_go",
    status: "OWNER_PENDING",
  },
  {
    id: "manual_transfer_operations",
    label: "Manual bank-transfer SOP, receipt evidence rules, paid-through policy, and entitlement operator list.",
    requiredBefore: "production_go",
    status: "OWNER_PENDING",
  },
  {
    id: "incident_monitoring_and_rollback",
    label: "Incident channel, monitoring review path, rollback owner, and provider/channel disable procedure.",
    requiredBefore: "production_go",
    status: "OWNER_PENDING",
  },
  {
    id: "explicit_production_release_approval",
    label: "Owner approval for the exact release artifact, production deploy, worker start, and final GO/no-go decision.",
    requiredBefore: "production_go",
    status: "OWNER_PENDING",
  },
];

export const PRODUCTION_STAGE_1_CODEX_ACTIONS_AFTER_OWNER_COMPLETION: ProductionStage1CodexAfterOwnerAction[] = [
  {
    id: "apply_remote_migrations",
    label: "Apply the approved remote migrations against the production Supabase project.",
  },
  {
    id: "configure_production_env",
    label: "Configure production environment variables and verify all demo/mock flags are disabled.",
  },
  {
    id: "deploy_verified_release",
    label: "Build, package, verify, and deploy the exact approved release artifact.",
  },
  {
    id: "run_production_smoke_checks",
    label: "Run release, auth, entitlement, webhook challenge, AI/file safety, and worker one-shot smoke checks.",
  },
  {
    id: "enable_real_webhooks_and_workers",
    label: "Enable real WhatsApp ingress and required workers only after smoke checks and owner approval.",
  },
  {
    id: "write_final_go_no_go_report",
    label: "Write the final dated production GO/no-go report with evidence and residual risks.",
  },
];

export function buildProductionStage1HandoffDecision(): ProductionStage1HandoffDecision {
  const localTechnicalPreparationComplete = PRODUCTION_STAGE_1_PHASE_EVIDENCE.every(
    (phase) => phase.localOnly && phase.status.endsWith("_LOCAL_COMPLETE"),
  );
  const ownerActionsRequired = PRODUCTION_STAGE_1_OWNER_ACTIONS_REQUIRED.map((action) => ({
    ...action,
  }));

  return {
    schemaVersion: PRODUCTION_STAGE_1_PHASE_6_HANDOFF_VERSION,
    planName: PRODUCTION_STAGE_1_PLAN_NAME,
    date: "2026-08-30",
    branch: "codex/production-readiness-stage-1",
    phaseEvidence: PRODUCTION_STAGE_1_PHASE_EVIDENCE.map((phase) => ({ ...phase })),
    localTechnicalPreparationComplete,
    ownerHandoffReady: localTechnicalPreparationComplete,
    productionPilotGo: false,
    iphoneSafariPwaStatus: "WAIVED_NOT_EXECUTED",
    liveActionsExecuted: [],
    ownerActionsRequired,
    codexActionsAfterOwnerCompletion:
      PRODUCTION_STAGE_1_CODEX_ACTIONS_AFTER_OWNER_COMPLETION.map((action) => ({ ...action })),
    blockingReasons: ownerActionsRequired.map((action) => `${action.id} is ${action.status}`),
  };
}

export function findProductionStage1HandoffContradictions(claims: string[]) {
  return claims.flatMap((claim) => {
    const normalized = claim.toLowerCase();
    const findings: string[] = [];
    const explicitlyNegatesPass = /\bnot\s+pass\b/.test(normalized);

    if (!explicitlyNegatesPass && /iphone\s+safari\/pwa.{0,80}\bpass\b/.test(normalized)) {
      findings.push("iphone_safari_pwa_must_remain_waived_not_executed");
    }
    if (!explicitlyNegatesPass && /physical\s+iphone.{0,80}\bpass\b/.test(normalized)) {
      findings.push("physical_iphone_must_not_be_claimed_pass");
    }
    if (/production(?:\s+pilot)?\s+go\s*(?:is|:|=)?\s*(true|approved|granted|ready)/.test(normalized)) {
      findings.push("production_go_must_remain_false_until_final_owner_gate");
    }
    if (/live\s+(provider|channel|whatsapp|zai|glm|ai).{0,80}(executed|enabled|approved|ready)/.test(normalized)) {
      findings.push("live_provider_or_channel_work_must_not_be_claimed_executed");
    }

    return findings;
  });
}

export function assertProductionStage1HandoffClaimsAreConsistent(claims: string[]) {
  const contradictions = findProductionStage1HandoffContradictions(claims);
  if (contradictions.length > 0) {
    throw new Error(`production_stage_1_handoff_contradictions:${contradictions.join(",")}`);
  }
}
