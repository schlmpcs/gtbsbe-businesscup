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
};

/** A row of radio buttons styled as segments. Arrow keys move between them (native radio group). */
export function Choice<T extends string>({ legend, name, value, options, onChange, hint }: ChoiceProps<T>) {
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
