'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';
import { cx } from './cx';
import { EstimateTag } from './EstimateTag';

type FieldContextValue = { id: string; describedBy: string | undefined; invalid: boolean };

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * Props for the control inside a <Field>: its id (so the label points at it), aria-describedby
 * (hint + error) and aria-invalid. Outside a Field it returns a fresh id and nothing else, so the
 * control then needs its own aria-label.
 */
export function useFieldControl(): { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true } {
  const ctx = useContext(FieldContext);
  const fallbackId = useId();
  if (!ctx) return { id: fallbackId };
  return {
    id: ctx.id,
    ...(ctx.describedBy ? { 'aria-describedby': ctx.describedBy } : {}),
    ...(ctx.invalid ? { 'aria-invalid': true as const } : {}),
  };
}

export type FieldProps = {
  /** Visible label; every input needs one. */
  label: ReactNode;
  /** Help text under the control. */
  hint?: ReactNode;
  /** Error text; also marks the control aria-invalid. */
  error?: ReactNode;
  /** Shows an "estimate" tag next to the label (the current value was defaulted). */
  isEstimate?: boolean;
  /** Set the control id yourself (default: generated). */
  id?: string;
  className?: string;
  /** The control: <NumberInput />, or any input that calls useFieldControl(). */
  children: ReactNode;
};

/** Label + control + hint + error, wired together for screen readers. */
export function Field({ label, hint, error, isEstimate = false, id, className, children }: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx('flex flex-col gap-xs', className)}>
      <div className="flex flex-wrap items-center gap-sm">
        <label htmlFor={controlId} className="text-sm font-medium">
          {label}
        </label>
        {isEstimate && <EstimateTag />}
      </div>
      <FieldContext.Provider value={{ id: controlId, describedBy, invalid: Boolean(error) }}>
        {children}
      </FieldContext.Provider>
      {hint && (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
