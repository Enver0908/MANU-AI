"use client";

import dynamic from "next/dynamic";
import { useEffect, type ComponentProps } from "react";
import type { MessagingPanel } from "./messaging-panel";
import { recordPhase55BundleEvent } from "@/lib/phase-55-bundle-diagnostic";

type MessagingPanelProps = ComponentProps<typeof MessagingPanel>;

const DynamicMessagingPanel = dynamic<MessagingPanelProps>(
  () =>
    import("./messaging-panel").then((module) => {
      recordPhase55BundleEvent("dynamic_import_resolved", {
        loader: "dynamic",
        module: "messaging-panel",
      });
      return {
        default: function Phase55DynamicMessagingPanel(props: MessagingPanelProps) {
          useEffect(() => {
            recordPhase55BundleEvent("panel_component_mounted", {
              loader: "dynamic",
              module: "messaging-panel",
            });
          }, []);

          return <module.MessagingPanel {...props} />;
        },
      };
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-0 flex-1 items-center justify-center" aria-busy="true" data-testid="messaging-panel-loading" />
    ),
  },
);

export function Phase55MessagingPanel(props: MessagingPanelProps) {
  useEffect(() => {
    recordPhase55BundleEvent("panel_loader_mounted", {
      loader: "dynamic",
      module: "messaging-panel",
    });
  }, []);

  return <DynamicMessagingPanel {...props} />;
}
