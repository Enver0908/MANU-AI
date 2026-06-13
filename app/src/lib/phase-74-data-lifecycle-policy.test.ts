import { describe, expect, it } from "vitest";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import { PHASE_74_REDACTION_MARKER } from "./data-governance";
import { saveFormResponseInState, simulateInState } from "./app-state-store";
import { createInitialState, DEMO_FORM_SCHEMA_ID } from "./seed-data";
import {
  PHASE_74_DSAR_SLA_POLICY,
  PHASE_74_EXPORT_INCLUDED_FILES,
  PHASE_74_RETENTION_POLICY,
  applyPhase74TransactionalRedactionInState,
  buildPhase74ExportPackage,
  buildPhase74LaunchGateEvidence,
  evaluatePhase74PolicyReadiness,
  evaluatePhase74RedactionInvariants,
  isClientExcludedFromOperationalPaths,
  isPhase74ProductionDataLifecycleAllowed,
} from "./phase-74-data-lifecycle-policy";

describe("phase 74 data lifecycle policy", () => {
  it("captures retention, DSAR SLA, and redaction policy artifacts as draft", () => {
    const readiness = evaluatePhase74PolicyReadiness();

    expect(readiness.status).toBe("pass");
    expect(PHASE_74_RETENTION_POLICY.length).toBeGreaterThanOrEqual(20);
    expect(PHASE_74_DSAR_SLA_POLICY.length).toBe(7);
    expect(PHASE_74_RETENTION_POLICY.every((entry) => entry.approvalStatus === "draft")).toBe(true);
  });

  it("builds a scoped export package with manifest and checksums", () => {
    const state = createInitialState();
    const exportPackage = buildPhase74ExportPackage(state, "client-mert");

    expect(exportPackage.manifest.exportVersion).toBe("phase74-export-v1.2");
    expect(exportPackage.files["personal_form_v2.json"]).toContain("phase-77j-data-lifecycle-v1.2");
    expect(exportPackage.files["catalog_version_refs.json"]).toContain("activeCatalog");
    expect(exportPackage.manifest.scope).toBe("client_full_export");
    expect(exportPackage.manifest.containsSecrets).toBe(false);
    expect(exportPackage.manifest.includedFiles).toEqual([...PHASE_74_EXPORT_INCLUDED_FILES]);
    expect(exportPackage.checksums["manifest.json"]).toMatch(/^[a-f0-9]{64}$/);
    expect(exportPackage.files["client_profile.json"]).toContain("client-mert");
  });

  it("applies transactional redaction with draft invalidation and invariant pass", async () => {
    const withFormResponse = saveFormResponseInState(createInitialState(), {
      clientId: "client-mert",
      schemaId: DEMO_FORM_SCHEMA_ID,
      submittedPhoneE164: "+905551110001",
      answers: {
        ...buildPhase70QualifiedClientAnswers(),
        primary_goal: "I eat breakfast at 8 with health details.",
      },
    });
    const withMessage = await simulateInState(withFormResponse, {
      clientId: "client-mert",
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: "phase74-redaction",
    });

    const { state, evidence } = applyPhase74TransactionalRedactionInState(withMessage, "client-mert", "deletion");
    const client = state.clients.find((item) => item.id === "client-mert");

    expect(evidence.minimizedEvidenceOnly).toBe(true);
    expect(client).toMatchObject({
      lifecycleStatus: "removed_anonymized",
      aiStatus: "passive",
      aiMode: "manual",
      humanTakeoverLocked: true,
      channelPermission: "blocked",
    });
    expect(evaluatePhase74RedactionInvariants(state, "client-mert").passed).toBe(true);
    expect(isClientExcludedFromOperationalPaths(client!)).toBe(true);
    expect(
      state.messages
        .filter((message) => message.conversationId === "conversation-client-mert")
        .every((message) => message.body === PHASE_74_REDACTION_MARKER),
    ).toBe(true);
  });

  it("blocks simulator access for removed clients and keeps production lifecycle disabled", async () => {
    const state = createInitialState();
    const { state: removed } = applyPhase74TransactionalRedactionInState(state, "client-mert", "deletion");

    await expect(
      simulateInState(removed, {
        clientId: "client-mert",
        body: "Merhaba",
        idempotencyKey: "phase74-removed",
      }),
    ).rejects.toThrowError(/client_removed_anonymized/);
    expect(isPhase74ProductionDataLifecycleAllowed()).toBe(false);
  });

  it("records draft legal and incident launch-gate evidence", () => {
    const evidence = buildPhase74LaunchGateEvidence();

    expect(evidence).toHaveLength(2);
    expect(evidence.every((record) => record.approvalStatus === "draft")).toBe(true);
    expect(evidence[1]?.coveredEvidence).toContain("client deletion and export operating procedure");
  });
});
