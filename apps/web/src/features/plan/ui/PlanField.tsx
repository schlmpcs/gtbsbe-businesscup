'use client';

// One editable plan value (an event field or an assumption): picks the control from `kind` and shows the
// label, hint, estimate tag and source the view-model gives. Values go back untouched through onChange.
import { Field, NumberInput, Select, SourceNote, cx } from '@/ui-kit';
import type { EventFieldKind, PlanFieldValue, Source } from '../model/types';

export type PlanFieldProps = {
  field: {
    key: string;
    kind: EventFieldKind;
    label: string;
    value: PlanFieldValue;
    display: string;
    isEstimate: boolean;
    source?: Source;
    hint?: string;
    options?: { value: string | number; label: string }[];
    min?: number;
    max?: number;
  };
  onChange: (key: string, value: PlanFieldValue) => void;
  className?: string;
};

export function PlanField({ field: f, onChange, className }: PlanFieldProps) {
  if (f.kind === 'toggle') {
    return (
      <div className={cx('flex flex-col gap-xs', className)}>
        <label className="flex min-h-11 items-center justify-between gap-md text-sm font-medium">
          <span>{f.label}</span>
          <input
            type="checkbox"
            checked={f.value === true}
            onChange={(e) => onChange(f.key, e.target.checked)}
            className="size-lg accent-(--color-primary)"
          />
        </label>
        {f.hint && <p className="text-xs text-text-muted">{f.hint}</p>}
      </div>
    );
  }

  return (
    <div className={cx('flex flex-col gap-xs', className)}>
      <Field label={f.label} hint={f.hint} isEstimate={f.isEstimate}>
        {f.kind === 'choice' ? (
          <ChoiceSelect field={f} onChange={onChange} />
        ) : (
          <NumberInput
            value={typeof f.value === 'number' ? f.value : null}
            onValueChange={(v) => {
              if (v !== null) onChange(f.key, v);
            }}
            min={f.min ?? 0}
            {...(f.max !== undefined ? { max: f.max } : {})}
            percent={f.kind === 'rate'}
            maxFractionDigits={f.kind === 'rate' ? 3 : f.kind === 'money' ? 2 : 0}
            {...(f.kind === 'money' ? { prefix: '$' } : {})}
            {...(f.kind === 'rate' ? { suffix: '%' } : {})}
          />
        )}
      </Field>
      {f.source && <SourceNote source={f.source} />}
    </div>
  );
}

/** A native select wired to the surrounding <Field> label. Options keep their own type (15 vs '15'). */
function ChoiceSelect({ field: f, onChange }: { field: PlanFieldProps['field']; onChange: PlanFieldProps['onChange'] }) {
  const options = f.options ?? [];
  return (
    <Select
      value={String(f.value)}
      onChange={(e) => {
        const opt = options.find((o) => String(o.value) === e.target.value);
        if (opt) onChange(f.key, opt.value);
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
