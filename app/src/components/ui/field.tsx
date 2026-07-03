import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const CONTROL_BASE =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none transition placeholder:text-ink-subtle focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 disabled:cursor-not-allowed disabled:bg-surface-muted";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold text-ink-muted">
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-700">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(CONTROL_BASE, "min-h-11", className)} {...rest} />;
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(CONTROL_BASE, "min-h-24 resize-y", className)} {...rest} />;
  },
);

export const SelectInput = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectInput({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn(CONTROL_BASE, "min-h-11", className)} {...rest}>
        {children}
      </select>
    );
  },
);

/** Convenience: labelled text field with a generated id linking label + input. */
export function LabelledInput({
  label,
  hint,
  error,
  required,
  className,
  ...inputProps
}: { label: ReactNode; hint?: ReactNode; error?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const id = inputProps.id ?? generatedId;
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} required={required} className={className}>
      <TextInput id={id} required={required} {...inputProps} />
    </Field>
  );
}
