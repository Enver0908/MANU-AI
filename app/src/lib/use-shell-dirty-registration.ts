"use client";

import { useEffect, useRef } from "react";
import {
  shellDirtyRegistry,
  type ShellDirtyEntryState,
} from "@/lib/phase-85-stage-5-shell-dirty-registry";
import { recordPhase52ClientEvent } from "@/lib/phase-52-diagnostic";

/**
 * Registers a domain surface with the central dirty registry.
 * Automatically unregisters on unmount.
 */
export function useShellDirtyRegistration(input: {
  id: string;
  label: string;
  state: ShellDirtyEntryState;
  canSave?: boolean;
  onSave?: () => Promise<boolean>;
  onDiscard?: () => void;
  onFocusField?: () => void;
}) {
  const saveRef = useRef(input.onSave);
  const discardRef = useRef(input.onDiscard);
  const focusRef = useRef(input.onFocusField);
  const registrationPolicy =
    process.env.NEXT_PUBLIC_AIYA_PERF_SHELL_DIRTY_REGISTRATION_POLICY === "legacy"
      ? "legacy"
      : "stable";
  const registrationSaveDependency = registrationPolicy === "stable" ? saveRef : input.onSave;
  const hasSave = Boolean(input.onSave);
  const hasDiscard = Boolean(input.onDiscard);
  const hasFocus = Boolean(input.onFocusField);
  saveRef.current = input.onSave;
  discardRef.current = input.onDiscard;
  focusRef.current = input.onFocusField;

  useEffect(() => {
    recordPhase52ClientEvent("shell_dirty_registration_policy", { policy: registrationPolicy });
  }, [registrationPolicy]);

  useEffect(() => {
    shellDirtyRegistry.register({
      id: input.id,
      label: input.label,
      state: input.state,
      canSave: Boolean(input.canSave && hasSave),
      save: saveRef.current ? () => saveRef.current!() : undefined,
      discard: discardRef.current ? () => discardRef.current!() : undefined,
      focus: focusRef.current ? () => focusRef.current!() : undefined,
    });
    return () => {
      shellDirtyRegistry.unregister(input.id);
    };
  }, [hasDiscard, hasFocus, hasSave, input.canSave, input.id, input.label, input.state, registrationPolicy, registrationSaveDependency]);

  useEffect(() => {
    shellDirtyRegistry.update(input.id, {
      label: input.label,
      state: input.state,
      canSave: Boolean(input.canSave && hasSave),
      save: saveRef.current ? () => saveRef.current!() : undefined,
      discard: discardRef.current ? () => discardRef.current!() : undefined,
      focus: focusRef.current ? () => focusRef.current!() : undefined,
    });
  }, [hasDiscard, hasFocus, hasSave, input.canSave, input.id, input.label, input.state]);
}
