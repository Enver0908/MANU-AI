import { describe, expect, it } from "vitest";
import {
  PRODUCTION_STAGE_1_CODEX_ACTIONS_AFTER_OWNER_COMPLETION,
  PRODUCTION_STAGE_1_OWNER_ACTIONS_REQUIRED,
  assertProductionStage1HandoffClaimsAreConsistent,
  buildProductionStage1HandoffDecision,
  findProductionStage1HandoffContradictions,
} from "./production-stage-1-handoff-contracts";

describe("production stage 1 phase 6 handoff contracts", () => {
  it("closes local technical preparation without changing production NO-GO", () => {
    const decision = buildProductionStage1HandoffDecision();

    expect(decision.localTechnicalPreparationComplete).toBe(true);
    expect(decision.ownerHandoffReady).toBe(true);
    expect(decision.productionPilotGo).toBe(false);
    expect(decision.iphoneSafariPwaStatus).toBe("WAIVED_NOT_EXECUTED");
    expect(decision.liveActionsExecuted).toEqual([]);
    expect(decision.blockingReasons.length).toBeGreaterThan(0);
  });

  it("records Phase 1-5 evidence in order as local-only evidence", () => {
    const decision = buildProductionStage1HandoffDecision();

    expect(decision.phaseEvidence.map((phase) => phase.phase)).toEqual([1, 2, 3, 4, 5]);
    expect(decision.phaseEvidence.map((phase) => phase.status)).toEqual([
      "PHASE_1_LOCAL_COMPLETE",
      "PHASE_2_LOCAL_COMPLETE",
      "PHASE_3_LOCAL_COMPLETE",
      "PHASE_4_LOCAL_COMPLETE",
      "PHASE_5_LOCAL_COMPLETE",
    ]);
    expect(decision.phaseEvidence.every((phase) => phase.localOnly)).toBe(true);
    expect(decision.phaseEvidence.map((phase) => phase.evidencePath)).toEqual([
      "docs/PRODUCTION_READINESS_STAGE_1_PHASE_1_EVIDENCE.md",
      "docs/PRODUCTION_READINESS_STAGE_1_PHASE_2_EVIDENCE.md",
      "docs/PRODUCTION_READINESS_STAGE_1_PHASE_3_EVIDENCE.md",
      "docs/PRODUCTION_READINESS_STAGE_1_PHASE_4_EVIDENCE.md",
      "docs/PRODUCTION_READINESS_STAGE_1_PHASE_5_EVIDENCE.md",
    ]);
  });

  it("lists all owner-side blockers before Codex can perform production work", () => {
    const ownerActionIds = PRODUCTION_STAGE_1_OWNER_ACTIONS_REQUIRED.map((action) => action.id);

    expect(ownerActionIds).toEqual([
      "meta_whatsapp_business",
      "zai_glm_ai_provider",
      "production_secrets",
      "production_supabase_and_migrations",
      "manual_transfer_operations",
      "incident_monitoring_and_rollback",
      "explicit_production_release_approval",
    ]);
    expect(PRODUCTION_STAGE_1_OWNER_ACTIONS_REQUIRED.every((action) => action.status === "OWNER_PENDING")).toBe(true);
  });

  it("lists Codex follow-up work only after the owner-side actions are complete", () => {
    expect(PRODUCTION_STAGE_1_CODEX_ACTIONS_AFTER_OWNER_COMPLETION.map((action) => action.id)).toEqual([
      "apply_remote_migrations",
      "configure_production_env",
      "deploy_verified_release",
      "run_production_smoke_checks",
      "enable_real_webhooks_and_workers",
      "write_final_go_no_go_report",
    ]);
  });

  it("rejects contradictory handoff claims", () => {
    expect(
      findProductionStage1HandoffContradictions([
        "iPhone Safari/PWA PASS",
        "production GO approved",
        "live WhatsApp traffic enabled",
      ]),
    ).toEqual([
      "iphone_safari_pwa_must_remain_waived_not_executed",
      "production_go_must_remain_false_until_final_owner_gate",
      "live_provider_or_channel_work_must_not_be_claimed_executed",
    ]);

    expect(() =>
      assertProductionStage1HandoffClaimsAreConsistent([
        "Production remains NO-GO.",
        "iPhone Safari/PWA remains WAIVED_NOT_EXECUTED, not PASS.",
      ]),
    ).not.toThrow();
  });
});
