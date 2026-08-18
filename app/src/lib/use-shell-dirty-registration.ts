"use client";

import { useEffect, useRef } from "react";
import {
  shellDirtyRegistry,
  type ShellDirtyEntryState,
} from "@/lib/phase-85-stage-5-shell-dirty-registry";

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
  saveRef.current = input.onSave;
  discardRef.current = input.onDiscard;
  focusRef.current = input.onFocusField;

  useEffect(() => {
    shellDirtyRegistry.register({
      id: input.id,
      label: input.label,
      state: input.state,
      canSave: Boolean(input.canSave && input.onSave),
      save: saveRef.current ? () => saveRef.current!() : undefined,
      discard: discardRef.current ? () => discardRef.current!() : undefined,
      focus: focusRef.current ? () => focusRef.current!() : undefined,
    });
    return () => {
      shellDirtyRegistry.unregister(input.id);
    };
  }, [input.canSave, input.id, input.label, input.onSave, input.state]);

  useEffect(() => {
    shellDirtyRegistry.update(input.id, {
      label: input.label,
      state: input.state,
      canSave: Boolean(input.canSave && saveRef.current),
      save: saveRef.current ? () => saveRef.current!() : undefined,
      discard: discardRef.current ? () => discardRef.current!() : undefined,
      focus: focusRef.current ? () => focusRef.current!() : undefined,
    });
  }, [input.canSave, input.id, input.label, input.state]);
}
