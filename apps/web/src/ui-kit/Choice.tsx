'use client';

import { cx } from './cx';

export type ChoiceOption<T extends string> = { value: T; label: string };

export type ChoiceProps<T extends string> = {
  /** The group's visible label (a <legend>). */
  legend: string;
  /** Radio group name; unique on the page. */
  name: string;
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
  hint?: string;
  /** Shown but not choosable (e.g. while its value loads): keeps its place, so nothing jumps when it turns on. */
  disabled?: boolean;
};

/** A row of radio buttons styled as segments. Arrow keys move between them (native radio group). */
export function Choice<T extends string>({ legend, name, value, options, onChange, hint, disabled }: ChoiceProps<T>) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-sm" disabled={disabled}>
      <legend className="mb-sm text-sm text-text-muted">{legend}</legend>
      <div className="flex flex-wrap gap-sm">
        {options.map((o) => (
          <label
            key={o.value}
            className={cx(
              'cursor-pointer rounded-full border-2 border-border bg-surface px-lg py-sm text-base font-medium leading-normal transition-colors',
              'hover:border-text has-checked:border-ink has-checked:bg-ink has-checked:text-on-primary',
              'has-disabled:cursor-default has-disabled:opacity-60 has-disabled:hover:border-border',
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
