import {
  defineResumablePhase,
  defineWorkUnit,
} from "../../../tools/phase-execution/phase-definition.template.mjs";

export const SHARED_UI_DELIVERY_PHASE_ID = "aiya-shared-ui-delivery-v1";
export const SHARED_UI_DELIVERY_SCHEMA_VERSION = "aiya-shared-ui-delivery-v1";

export const SHARED_UI_DELIVERY_PHASE_DEFINITION = defineResumablePhase({
  phaseId: SHARED_UI_DELIVERY_PHASE_ID,
  phaseSchemaVersion: SHARED_UI_DELIVERY_SCHEMA_VERSION,
  stages: [
    {
      stageId: "project-integration",
      verify: (evidence) => evidence?.projectIntegration?.status === "PASS",
    },
    {
      stageId: "local-authenticated-validation",
      prerequisites: ["project-integration"],
      verify: (evidence) => evidence?.localAuthenticatedValidation?.status === "PASS",
    },
    {
      stageId: "release-identity-and-artifact",
      prerequisites: ["local-authenticated-validation"],
      verify: (evidence) => evidence?.releaseIdentityAndArtifact?.status === "PASS",
    },
    {
      stageId: "hosted-deploy",
      prerequisites: ["release-identity-and-artifact"],
      verify: (evidence) => evidence?.hostedDeploy?.status === "PASS",
    },
    {
      stageId: "real-device-acceptance",
      prerequisites: ["hosted-deploy"],
      verify: (evidence) => evidence?.realDeviceAcceptance?.status === "PASS",
    },
    {
      stageId: "delivery-closure",
      prerequisites: ["real-device-acceptance"],
      verify: (evidence) => evidence?.deliveryClosure?.status === "PASS",
    },
  ],
});

export const SHARED_UI_DELIVERY_WORK_UNITS = [
  defineWorkUnit({
    unitId: "project-integration",
    stageId: "project-integration",
    inputIdentity: {
      source: "shared-ui-runtime-rewrite-v1 isolated worktree",
      contract: SHARED_UI_DELIVERY_SCHEMA_VERSION,
    },
    outputPaths: [
      "app/src/components/dashboard-app.tsx",
      "app/src/components/dashboard/client-workspace-route.tsx",
      "app/src/components/dashboard/messages-route.tsx",
      "app/src/components/dashboard/inbox-route.tsx",
      "app/src/lib/use-aiya-state.ts",
    ],
    run: async () => undefined,
    verify: (evidence) => evidence?.projectIntegration?.status === "PASS",
  }),
  defineWorkUnit({
    unitId: "local-authenticated-validation",
    stageId: "local-authenticated-validation",
    inputIdentity: {
      source: "integrated main checkout and loopback Supabase",
      contract: SHARED_UI_DELIVERY_SCHEMA_VERSION,
    },
    outputPaths: ["app/.manu-runtime"],
    run: async () => undefined,
    verify: (evidence) => evidence?.localAuthenticatedValidation?.status === "PASS",
  }),
  defineWorkUnit({
    unitId: "release-identity-and-artifact",
    stageId: "release-identity-and-artifact",
    inputIdentity: {
      source: "integrated source, hosted release identity, migration fingerprint",
      contract: SHARED_UI_DELIVERY_SCHEMA_VERSION,
    },
    outputPaths: [".manu-runtime/hosted-sandbox/artifacts"],
    run: async () => undefined,
    verify: (evidence) => evidence?.releaseIdentityAndArtifact?.status === "PASS",
  }),
  defineWorkUnit({
    unitId: "hosted-deploy",
    stageId: "hosted-deploy",
    inputIdentity: {
      source: "artifact-gated hosted sandbox deployment wrapper",
      contract: SHARED_UI_DELIVERY_SCHEMA_VERSION,
    },
    outputPaths: ["docs/AIYA_SHARED_UI_RUNTIME_REWRITE_DELIVERY_20260930_EVIDENCE.json"],
    run: async () => undefined,
    verify: (evidence) => evidence?.hostedDeploy?.status === "PASS",
  }),
  defineWorkUnit({
    unitId: "real-device-acceptance",
    stageId: "real-device-acceptance",
    inputIdentity: {
      source: "deployed release, physical desktop browser, physical Android Chrome/PWA",
      contract: SHARED_UI_DELIVERY_SCHEMA_VERSION,
    },
    outputPaths: ["docs/stage-7-real-device"],
    run: async () => undefined,
    verify: (evidence) => evidence?.realDeviceAcceptance?.status === "PASS",
  }),
  defineWorkUnit({
    unitId: "delivery-closure",
    stageId: "delivery-closure",
    inputIdentity: {
      source: "release smoke, device evidence, rollback receipt",
      contract: SHARED_UI_DELIVERY_SCHEMA_VERSION,
    },
    outputPaths: ["HANDOFF_FOR_NEXT_CODEX.md", "docs/NEXT_PHASE_EXECUTION_PLAN.md"],
    run: async () => undefined,
    verify: (evidence) => evidence?.deliveryClosure?.status === "PASS",
  }),
];
