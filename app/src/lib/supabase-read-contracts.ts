export type SupabaseReadContractStatus =
  | "intentional_broad_read"
  | "scoped_mutation_read"
  | "future_paginated_read"
  | "phase69_paginated_contract";

export type SupabaseReadContract = {
  id: string;
  ownerPath: string;
  currentLoader: string;
  status: SupabaseReadContractStatus;
  currentScope: string;
  productionContract: string;
  reason: string;
  nextAction: string;
};

export const SUPABASE_READ_CONTRACTS: SupabaseReadContract[] = [
  {
    id: "dashboard_state_snapshot",
    ownerPath: "app/src/app/api/app-state/route.ts",
    currentLoader: "loadSupabaseState",
    status: "phase69_paginated_contract",
    currentScope: "tenant-wide dashboard snapshot across visible clients and related records",
    productionContract:
      "Use cursor-paginated client lists, bounded timeline windows, handoff/notification/audit list windows, and client-detail scoped reloads before production growth.",
    reason: "The local PWA dashboard needs a complete snapshot today, but this is the main production scale risk.",
    nextAction: "Implement runtime paginated route payloads after Phase 69 synthetic 100x50 rehearsal evidence is accepted.",
  },
  {
    id: "demo_reset_snapshot",
    ownerPath: "app/src/app/api/app-state/route.ts",
    currentLoader: "resetSupabaseState",
    status: "intentional_broad_read",
    currentScope: "demo tenant reset and reload",
    productionContract: "Keep dev/demo only; do not expose as a production tenant reset workflow.",
    reason: "Reset is a local prototype control and is not part of production tenant operations.",
    nextAction: "Keep guarded by existing environment and auth boundaries.",
  },
  {
    id: "client_export_legal_bundle",
    ownerPath: "app/src/app/api/clients/[id]/export/route.ts",
    currentLoader: "exportSupabaseClientData",
    status: "intentional_broad_read",
    currentScope: "tenant snapshot filtered into a client-scoped legal/audit export",
    productionContract:
      "Replace with a dedicated client-scoped export query bundle after legal approval defines final DSAR scope.",
    reason: "Export correctness is a legal/privacy concern and must keep full audit context until final scope is approved.",
    nextAction: "Design dedicated client legal bundle queries after DSAR owner, SLA, and legal-hold decisions are approved.",
  },
  {
    id: "client_anonymization_redaction",
    ownerPath: "app/src/app/api/clients/[id]/anonymize/route.ts",
    currentLoader: "anonymizeSupabaseClientData",
    status: "intentional_broad_read",
    currentScope: "tenant snapshot plus broad redaction writes for a target client",
    productionContract:
      "Move to a dedicated transactional redaction RPC after legal/privacy approves the final deletion contract.",
    reason: "Bulk minimization touches messages, forms, context, handoffs, notifications, AI decisions, and audit metadata.",
    nextAction: "Design the client removal/anonymization redaction payload before moving this lifecycle fully to RPC commits.",
  },
  {
    id: "client_removal_lifecycle",
    ownerPath: "app/src/app/api/clients/[id]/remove/route.ts",
    currentLoader: "removeSupabaseClientData",
    status: "intentional_broad_read",
    currentScope: "tenant snapshot plus broad removed-client legal/audit bundle updates",
    productionContract:
      "Move to a dedicated transactional redaction RPC after retention, hard-delete, and legal-hold decisions are approved.",
    reason: "Removal must preserve minimized export/audit evidence while hiding the client from normal workflows.",
    nextAction: "Phase 76N routes in-RPC-covered removal deltas through commit_client_removal_lifecycle; channel/memory redaction remains direct until a dedicated contract exists.",
  },
  {
    id: "voice_sample_workflow",
    ownerPath: "app/src/app/api/dietitian/voice/samples/route.ts",
    currentLoader: "updateSupabaseVoiceSamples",
    status: "intentional_broad_read",
    currentScope: "dietitian voice sample/profile workflow over visible tenant state",
    productionContract: "Use dietitian-scoped voice sample/profile queries with sample count and status filters.",
    reason: "Voice profile generation is dietitian-scoped admin work, not a high-frequency client mutation path.",
    nextAction: "Add dietitian-scoped pagination if sample volumes grow beyond local prototype use.",
  },
  {
    id: "voice_profile_generation",
    ownerPath: "app/src/app/api/dietitian/voice/generate/route.ts",
    currentLoader: "generateSupabaseVoiceProfile",
    status: "intentional_broad_read",
    currentScope: "dietitian voice profile generation over approved local samples",
    productionContract: "Use a dietitian-scoped approved-sample query and explicit sample limit.",
    reason: "Generation depends on the dietitian's own approved samples and remains local/mock only.",
    nextAction: "Define approved sample cap before any production onboarding scale work.",
  },
  {
    id: "form_schema_admin",
    ownerPath: "app/src/app/api/client-form-schemas/route.ts",
    currentLoader: "createSupabaseFormSchema",
    status: "intentional_broad_read",
    currentScope: "tenant form schema administration",
    productionContract: "Use schema-specific admin queries plus schema list pagination/filtering.",
    reason: "Schema administration is tenant-wide by nature and should not be mixed with client mutation loaders.",
    nextAction: "Define schema list filters by status, language, and version before production admin scale.",
  },
  {
    id: "form_schema_publish",
    ownerPath: "app/src/app/api/client-form-schemas/publish/route.ts",
    currentLoader: "publishSupabaseFormSchema",
    status: "intentional_broad_read",
    currentScope: "tenant form schema publish workflow",
    productionContract: "Use a schema-id scoped loader plus tenant schema version checks.",
    reason: "Publishing is low-frequency admin work and must preserve schema versioning semantics.",
    nextAction: "Add schema-id scoped publish loader when schema administration is paginated.",
  },
  {
    id: "internal_copilot_tools",
    ownerPath: "app/src/app/api/internal-copilot/messages/route.ts",
    currentLoader: "runSupabaseInternalCopilotMessage",
    status: "phase69_paginated_contract",
    currentScope: "visible tenant state for local/mock curated copilot tools",
    productionContract:
      "Use tool-specific bounded queries with per-tool limits, cursor windows, and source refs before any real provider egress.",
    reason: "The internal copilot is read-only today, but production scale and provider review require bounded tool reads.",
    nextAction: "Implement bounded tool loaders only after provider/vendor review allows any real egress.",
  },
  {
    id: "client_create_scaffold",
    ownerPath: "app/src/app/api/clients/route.ts",
    currentLoader: "createSupabaseClientRecord",
    status: "phase69_paginated_contract",
    currentScope: "tenant snapshot used to append a local client/conversation scaffold",
    productionContract: "Use direct insert plus a scoped client detail reload.",
    reason: "Client creation currently reuses local state helpers; production should avoid reloading tenant history.",
    nextAction: "Implement create-client RPC or insert bundle with scoped return payload before production onboarding.",
  },
  {
    id: "client_ai_control_patch",
    ownerPath: "app/src/app/api/clients/[id]/route.ts",
    currentLoader: "patchSupabaseClientRecord",
    status: "phase69_paginated_contract",
    currentScope: "tenant snapshot for AI-control/client profile patch",
    productionContract: "Use client-id scoped load plus existing optimistic context revision checks.",
    reason: "This path still uses the broad loader even though most mutation paths now use scoped operation loaders.",
    nextAction: "Move profile/AI-control patch to a client-scoped operation loader before production pilot.",
  },
  {
    id: "manual_reply_mutation",
    ownerPath: "app/src/app/api/messages/manual/route.ts",
    currentLoader: "loadSupabaseClientOperationState",
    status: "scoped_mutation_read",
    currentScope: "client-scoped messages, decisions, handoffs, forms, context, and processed event data",
    productionContract: "Keep scoped; tune per-table limits as usage grows.",
    reason: "This path was already narrowed and covered by transactional RPC/integration tests.",
    nextAction: "No broad-read action needed in this phase.",
  },
  {
    id: "inbound_simulation_mutation",
    ownerPath: "app/src/app/api/simulator/route.ts",
    currentLoader: "loadSupabaseClientOperationState",
    status: "scoped_mutation_read",
    currentScope: "client-scoped inbound simulation context plus processed event lookup",
    productionContract: "Keep scoped; real channel adapters must use equivalent client-scoped loaders.",
    reason: "This path was already narrowed and covered by transactional RPC/integration tests.",
    nextAction: "No broad-read action needed in this phase.",
  },
  {
    id: "draft_review_mutation",
    ownerPath: "app/src/app/api/messages/drafts/[id]/route.ts",
    currentLoader: "loadSupabaseDraftOperationState",
    status: "scoped_mutation_read",
    currentScope: "draft-message scoped loader that resolves the owning client context",
    productionContract: "Keep scoped and preserve required message/decision inclusion.",
    reason: "This path was already narrowed and covered by transactional RPC/integration tests.",
    nextAction: "No broad-read action needed in this phase.",
  },
  {
    id: "handoff_status_mutation",
    ownerPath: "app/src/app/api/handoffs/[id]/resolve/route.ts",
    currentLoader: "loadSupabaseHandoffOperationState",
    status: "scoped_mutation_read",
    currentScope: "handoff-id scoped loader that resolves the owning client context",
    productionContract: "Keep scoped and preserve required handoff inclusion.",
    reason: "This path was already narrowed and covered by transactional RPC/integration tests.",
    nextAction: "No broad-read action needed in this phase.",
  },
  {
    id: "context_update_mutation",
    ownerPath: "app/src/app/api/clients/[id]/context-updates/route.ts",
    currentLoader: "loadSupabaseClientOperationState",
    status: "scoped_mutation_read",
    currentScope: "client-scoped context update and draft invalidation data",
    productionContract: "Keep scoped and preserve draft invalidation semantics.",
    reason: "This path was already narrowed and covered by transactional RPC/integration tests.",
    nextAction: "No broad-read action needed in this phase.",
  },
  {
    id: "form_response_mutation",
    ownerPath: "app/src/app/api/clients/forms/route.ts",
    currentLoader: "loadSupabaseClientOperationState",
    status: "scoped_mutation_read",
    currentScope: "client-scoped form response and draft invalidation data",
    productionContract: "Keep scoped and preserve schema snapshot inclusion.",
    reason: "This path was already narrowed and covered by transactional RPC/integration tests.",
    nextAction: "No broad-read action needed in this phase.",
  },
  {
    id: "client_update_proposal_mutation",
    ownerPath: "app/src/app/api/clients/[id]/update-proposals/route.ts",
    currentLoader: "loadSupabaseClientOperationState",
    status: "scoped_mutation_read",
    currentScope: "client-scoped proposal create/apply with form response and context update deltas",
    productionContract: "Use commit_client_update_proposal transactional RPC for create/apply paths.",
    reason: "Phase 76N moved proposal mutations onto the shared state-delta RPC with food-rule redaction coverage.",
    nextAction: "Add integration coverage for food-rule proposal apply when local Supabase is available.",
  },
];

export function getSupabaseReadContractsByStatus(status: SupabaseReadContractStatus) {
  return SUPABASE_READ_CONTRACTS.filter((contract) => contract.status === status);
}
