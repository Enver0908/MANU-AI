import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

const CONTROL_BASE =
  "w-full min-w-0 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink shadow-[0_1px_0_rgba(23,20,18,0.04)] outline-none transition placeholder:text-ink-subtle focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-surface-muted";

export function buildFieldDescribedBy(args: {
  error?: boolean;
  hint?: boolean;
  errorId: string;
  hintId: string;
}): string | undefined {
  if (args.error) return args.errorId;
  if (args.hint) return args.hintId;
  return undefined;
}

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
  const uid = useId();
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  const describedBy = buildFieldDescribedBy({
    error: Boolean(error),
    hint: Boolean(hint),
    errorId,
    hintId,
  });

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: (children.props as { id?: string }).id ?? htmlFor,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        "aria-required": required || undefined,
      })
    : children;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold text-ink-muted">
        {label}
        {required ? <span className="ml-0.5 text-warm">*</span> : null}
      </label>
      <div className="min-w-0">{control}</div>
      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
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
