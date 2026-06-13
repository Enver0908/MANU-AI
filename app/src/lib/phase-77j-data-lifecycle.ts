import { PHASE_74_REDACTION_MARKER } from "./data-governance";
import { PHASE_77B_DEPRECATED_PROPOSAL_HEADLINE } from "./phase-77b-chat-mutation-boundary";
import { PHASE_77D_MASTER_FOOD_CATALOG } from "./phase-77d-master-food-catalog";
import { getPhase70RegistryField, PHASE_70_REGISTRY_VERSION } from "./phase-70-form-registry";
import type {
  ClientFoodRuleProfileV2Record,
  ClientFormResponseRecord,
  ClientMenuPlanV1Record,
  ClientUpdateProposalRecord,
  ManuAppState,
} from "./types";

export const PHASE_77J_LIFECYCLE_VERSION = "phase-77j-data-lifecycle-v1.2";

export function buildPersonalFormV2ExportSection(responses: ClientFormResponseRecord[]) {
  const latest = [...responses].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null;
  if (!latest) {
    return {
      lifecycleVersion: PHASE_77J_LIFECYCLE_VERSION,
      registryVersion: PHASE_70_REGISTRY_VERSION,
      schemaId: null,
      schemaVersion: null,
      fields: [] as Array<Record<string, unknown>>,
    };
  }

  return {
    lifecycleVersion: PHASE_77J_LIFECYCLE_VERSION,
    registryVersion: PHASE_70_REGISTRY_VERSION,
    schemaId: latest.schemaId,
    schemaVersion: latest.schemaVersion,
    updatedAt: latest.updatedAt,
    fields: Object.entries(latest.answers).map(([fieldId, value]) => {
      const registryField = getPhase70RegistryField(fieldId);
      const promptAccess = registryField?.promptAccess ?? "unknown";
      const sensitive = promptAccess === "sensitive_never_prompt" || promptAccess === "dietitian_only";
      return {
        fieldId,
        label: registryField?.label ?? fieldId,
        promptAccess,
        privacySensitivity: registryField?.privacySensitivity ?? "medium",
        valueIncluded: value !== undefined && value !== PHASE_74_REDACTION_MARKER,
        value: sensitive ? PHASE_74_REDACTION_MARKER : value,
      };
    }),
  };
}

export function buildCatalogVersionRefsExportSection(
  profiles: ClientFoodRuleProfileV2Record[],
  plans: ClientMenuPlanV1Record[],
) {
  const refs = new Map<string, { catalogVersion: string; catalogSourceSha256: string; catalogRecordSetSha256: string }>();

  for (const profile of profiles) {
    refs.set(profile.catalogVersion, {
      catalogVersion: profile.catalogVersion,
      catalogSourceSha256: profile.catalogSourceSha256,
      catalogRecordSetSha256: profile.catalogRecordSetSha256,
    });
  }
  for (const plan of plans) {
    refs.set(plan.catalogVersion, {
      catalogVersion: plan.catalogVersion,
      catalogSourceSha256: plan.catalogSourceSha256,
      catalogRecordSetSha256: plan.catalogRecordSetSha256,
    });
  }

  return {
    lifecycleVersion: PHASE_77J_LIFECYCLE_VERSION,
    activeCatalog: {
      version: PHASE_77D_MASTER_FOOD_CATALOG.metadata.version,
      sourceSha256: PHASE_77D_MASTER_FOOD_CATALOG.metadata.sourceWorkbookSha256,
      recordSetSha256: PHASE_77D_MASTER_FOOD_CATALOG.metadata.recordSetSha256,
    },
    clientBoundRefs: [...refs.values()],
  };
}

export function buildDeprecatedProposalExportSection(proposals: ClientUpdateProposalRecord[]) {
  return proposals.map((proposal) => ({
    id: proposal.id,
    status: proposal.status,
    deprecated: true,
    deprecationNote: PHASE_77B_DEPRECATED_PROPOSAL_HEADLINE,
    safetyFlags: proposal.safetyFlags,
    expectedContextRevision: proposal.expectedContextRevision,
    createdAt: proposal.createdAt,
    resolvedAt: proposal.resolvedAt,
    patchCategories: [...new Set(proposal.proposedPatches.map((patch) => patch.category))],
    patchCount: proposal.proposedPatches.length,
    sourceTextIncluded: proposal.sourceText.length > 0,
    proposedPatches: proposal.proposedPatches.map((patch) => ({
      target: patch.target,
      fieldId: patch.fieldId,
      category: patch.category,
      operation: patch.operation,
      value: patch.value,
    })),
  }));
}

export function buildPhase77JLifecycleSummary(state: ManuAppState, clientId: string) {
  const profiles = state.clientFoodRuleProfiles.filter((profile) => profile.clientId === clientId);
  const plans = state.clientMenuPlans.filter((plan) => plan.clientId === clientId);
  const responses = state.clientFormResponses.filter((response) => response.clientId === clientId);
  const proposals = state.clientUpdateProposals.filter((proposal) => proposal.clientId === clientId);

  return {
    lifecycleVersion: PHASE_77J_LIFECYCLE_VERSION,
    personalFormV2: buildPersonalFormV2ExportSection(responses),
    foodRuleProfileV2Count: profiles.length,
    menuPlanV1Count: plans.length,
    catalogVersionRefs: buildCatalogVersionRefsExportSection(profiles, plans),
    deprecatedProposalCount: proposals.length,
  };
}
