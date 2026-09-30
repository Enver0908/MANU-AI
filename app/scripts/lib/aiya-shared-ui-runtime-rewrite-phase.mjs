import {
  defineResumablePhase,
  defineWorkUnit,
} from "../../../tools/phase-execution/phase-definition.template.mjs";

export const SHARED_UI_RUNTIME_REWRITE_PHASE_ID = "aiya-shared-ui-runtime-rewrite-v1";
export const SHARED_UI_RUNTIME_REWRITE_SCHEMA_VERSION = "aiya-shared-ui-runtime-rewrite-v1";

export const SHARED_UI_RUNTIME_REWRITE_PHASE_DEFINITION = defineResumablePhase({
  phaseId: SHARED_UI_RUNTIME_REWRITE_PHASE_ID,
  phaseSchemaVersion: SHARED_UI_RUNTIME_REWRITE_SCHEMA_VERSION,
  stages: [
    {
      stageId: "route-state-isolation",
      verify: (evidence) => evidence?.routeStateIsolation?.status === "PASS",
    },
    {
      stageId: "async-ownership",
      prerequisites: ["route-state-isolation"],
      verify: (evidence) => evidence?.asyncOwnership?.status === "PASS",
    },
    {
      stageId: "workflow-acceptance",
      prerequisites: ["async-ownership"],
      verify: (evidence) => evidence?.workflowAcceptance?.status === "PASS",
    },
  ],
});

export const SHARED_UI_RUNTIME_REWRITE_WORK_UNITS = [
  defineWorkUnit({
    unitId: "route-state-isolation",
    stageId: "route-state-isolation",
    inputIdentity: {
      source: "dashboard-app.tsx and use-aiya-state.ts",
      contract: SHARED_UI_RUNTIME_REWRITE_SCHEMA_VERSION,
    },
    outputPaths: [
      "app/src/components/dashboard-app.tsx",
      "app/src/components/dashboard/client-workspace-route.tsx",
      "app/src/components/dashboard/messages-route.tsx",
      "app/src/components/dashboard/inbox-route.tsx",
      "app/src/components/dashboard/forms-route.tsx",
      "app/src/components/dashboard/voice-route.tsx",
      "app/src/lib/use-aiya-state.ts",
    ],
    run: async () => undefined,
    verify: (evidence) => evidence?.routeStateIsolation?.status === "PASS",
  }),
  defineWorkUnit({
    unitId: "async-ownership",
    stageId: "async-ownership",
    inputIdentity: {
      source: "shell, inbox, messaging, AI Chat request owners",
      contract: SHARED_UI_RUNTIME_REWRITE_SCHEMA_VERSION,
    },
    outputPaths: [
      "app/src/components/dashboard/shell-provider.tsx",
      "app/src/lib/use-stage-4b-inbox.ts",
      "app/src/lib/use-stage-4b2-messaging.ts",
      "app/src/lib/use-ai-chat.ts",
    ],
    run: async () => undefined,
    verify: (evidence) => evidence?.asyncOwnership?.status === "PASS",
  }),
  defineWorkUnit({
    unitId: "workflow-acceptance",
    stageId: "workflow-acceptance",
    inputIdentity: {
      source: "production build and bounded desktop/mobile journeys",
      contract: SHARED_UI_RUNTIME_REWRITE_SCHEMA_VERSION,
    },
    outputPaths: [
      "docs/AIYA_SHARED_UI_RUNTIME_REWRITE_CONTINUATION_20260930T091345Z-4e4ecf63-4182-41ab-b0f5-8175d21b8b51_EVIDENCE.json",
    ],
    run: async () => undefined,
    verify: (evidence) => evidence?.workflowAcceptance?.status === "PASS",
  }),
];
