"use client";

import { useEffect, type ComponentProps } from "react";
import { recordPhase55BundleEvent } from "@/lib/phase-55-bundle-diagnostic";
import { MessagingPanel } from "./messaging-panel";

type MessagingPanelProps = ComponentProps<typeof MessagingPanel>;

export function Phase55MessagingPanel(props: MessagingPanelProps) {
  useEffect(() => {
    recordPhase55BundleEvent("panel_component_mounted", {
      loader: "eager",
      module: "messaging-panel",
    });
  }, []);

  return <MessagingPanel {...props} />;
}
