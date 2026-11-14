'use client';

// Small form controls S11 needs that the kit doesn't have yet: a text box and a loading skeleton.
// The segmented radio group moved to the kit (Choice); re-exported here for the afford files.
import { cx, useFieldControl } from '@/ui-kit';
import type { InputHTMLAttributes } from 'react';

export { Choice, type ChoiceOption } from '@/ui-kit';

/** A single-line text box that picks up its label, hint and error from the surrounding <Field>. */
export function TextInput({
  value,
  onValueChange,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const field = useFieldControl();
  return (
    <input
      {...field}
      {...rest}
      type="text"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={cx(
        'w-full rounded-md border bg-bg px-md py-md text-base',
        field['aria-invalid'] ? 'border-negative' : 'border-border',
        className,
      )}
    />
  );
}

/** Grey placeholder blocks while the plan loads. */
export function Skeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-md">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className={cx('animate-pulse rounded-lg bg-surface', i === 0 ? 'h-3xl' : 'h-2xl')} />
      ))}
    </div>
  );
}
