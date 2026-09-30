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
  const hasSave = Boolean(input.onSave);
  const hasDiscard = Boolean(input.onDiscard);
  const hasFocus = Boolean(input.onFocusField);
  saveRef.current = input.onSave;
  discardRef.current = input.onDiscard;
  focusRef.current = input.onFocusField;

  useEffect(() => {
    const save = () => saveRef.current?.() ?? Promise.resolve(false);
    const discard = () => discardRef.current?.();
    const focus = () => focusRef.current?.();
    shellDirtyRegistry.register({
      id: input.id,
      label: input.label,
      state: input.state,
      canSave: Boolean(input.canSave && hasSave),
      save: hasSave ? save : undefined,
      discard: hasDiscard ? discard : undefined,
      focus: hasFocus ? focus : undefined,
    });
    return () => {
      shellDirtyRegistry.unregister(input.id);
    };
    // Registration identity is the editor id. State and callbacks are updated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.id]);

  useEffect(() => {
    shellDirtyRegistry.update(input.id, {
      label: input.label,
      state: input.state,
      canSave: Boolean(input.canSave && hasSave),
      save: hasSave ? () => saveRef.current?.() ?? Promise.resolve(false) : undefined,
      discard: hasDiscard ? () => discardRef.current?.() : undefined,
      focus: hasFocus ? () => focusRef.current?.() : undefined,
    });
  }, [hasDiscard, hasFocus, hasSave, input.canSave, input.id, input.label, input.state]);
}
