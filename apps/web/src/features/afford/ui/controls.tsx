'use client';

// Small form controls S11 needs that the kit doesn't have yet (Design v3 look): a cream text box with a
// big bold value, a cream pill group (radio buttons) and a loading skeleton.
import { cx, useFieldControl } from '@/ui-kit';
import type { InputHTMLAttributes } from 'react';

export type ChoiceOption<T extends string> = { value: T; label: string };

/** Classes for a NumberInput in the S11 form: a cream box with a big bold value (Design v3). */
export const bigNumberInput = 'rounded-lg [&_input]:py-md [&_input]:text-2xl [&_input]:font-bold [&>span]:text-2xl [&>span]:font-bold';

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
        'w-full rounded-lg border bg-bg px-md py-md text-2xl font-bold placeholder:font-medium placeholder:text-text-muted',
        field['aria-invalid'] ? 'border-negative' : 'border-border',
        className,
      )}
    />
  );
}

/**
 * A radio group drawn as a cream pill with the chosen option in ink (Figma S11 "How often?" / "How would
 * you pay?"). Native radios, so arrow keys move between the options.
 */
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
    <fieldset className="flex min-w-0 flex-col gap-sm">
      <legend className="mb-sm text-sm font-medium text-text-muted">{legend}</legend>
      <div className="flex w-fit max-w-full flex-wrap gap-xs rounded-full bg-bg p-xs">
        {options.map((o) => (
          <label
            key={o.value}
            className={cx(
              'cursor-pointer rounded-full px-lg py-sm text-base font-semibold leading-normal text-text-muted transition-colors',
              'hover:text-text has-checked:bg-ink has-checked:text-on-primary',
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

/** Placeholder blocks while the plan loads. */
export function Skeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-md">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className={cx('animate-pulse rounded-lg bg-surface-strong', i === 0 ? 'h-3xl' : 'h-2xl')} />
      ))}
    </div>
  );
}
