'use client';

// Small form controls S11 needs that the kit doesn't have yet: a segmented radio group, a text box
// and a loading skeleton. Presentational only.
import { cx, useFieldControl } from '@/ui-kit';
import type { InputHTMLAttributes } from 'react';

export type ChoiceOption<T extends string> = { value: T; label: string };

/** A row of radio buttons styled as segments. Arrow keys move between them (native radio group). */
export function Choice<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  hint,
}: {
  legend: string;
  name: string;
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
  hint?: string;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-xs">
      <legend className="mb-xs text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-xs">
        {options.map((o) => (
          <label
            key={o.value}
            className={cx(
              'cursor-pointer rounded-md border border-border bg-bg px-md py-md text-sm font-medium leading-normal transition-colors',
              'hover:bg-surface has-checked:border-primary has-checked:bg-primary has-checked:text-on-primary',
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </fieldset>
  );
}

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
