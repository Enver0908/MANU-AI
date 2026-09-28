import type { ComponentType } from "react";

type PanelModule = typeof import("./phase-55-messaging-panel");

const panelModule =
  process.env.AIYA_PHASE55_BUNDLE_POLICY === "dynamic"
    // These branches must stay separate in the diagnostic A/B build graph.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ? (require("./phase-55-messaging-panel.dynamic") as PanelModule)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    : (require("./phase-55-messaging-panel") as PanelModule);

export const Phase55MessagingPanel = panelModule.Phase55MessagingPanel as ComponentType<
  React.ComponentProps<PanelModule["Phase55MessagingPanel"]>
>;
