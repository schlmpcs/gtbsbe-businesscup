'use client';

// For a ZIP we have no data for: choose the nearest metro, then the kind of area in it. Results are
// then labelled approximate.
import type { SelectHTMLAttributes } from 'react';
import { overpaying as t } from '@/copy';
import { Card, Choice, Field, Stack, cx, useFieldControl } from '@/ui-kit';
import type { MetroPickerVM } from '../model/types';

/** A native select that picks up its label from the surrounding <Field>. */
function MetroSelect({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  const field = useFieldControl();
  return (
    <select
      {...field}
      {...rest}
      className={cx('w-full rounded-lg border-2 border-border bg-surface px-md py-sm text-base', className)}
    />
  );
}

export function MetroPicker({ picker }: { picker: MetroPickerVM }) {
  return (
    <Card title={t.picker.title} headingLevel={2} tone="muted" data-testid="metro-picker">
      <Stack gap="lg">
        <Field label={t.picker.metro}>
          <MetroSelect value={picker.metro ?? ''} onChange={(e) => picker.setMetro(e.target.value === '' ? null : e.target.value)}>
            <option value="">{t.picker.choose}</option>
            {picker.options.map((o) => (
              <option key={o.metro} value={o.metro}>
                {o.metro}
              </option>
            ))}
          </MetroSelect>
        </Field>
        {picker.metro !== null && picker.tiers.length > 0 && (
          <Choice
            legend={t.picker.tier}
            name="overpaying-tier"
            value={picker.tier ?? ''}
            options={picker.tiers.map((tier) => ({ value: tier, label: t.picker.tiers[tier] }))}
            onChange={(tier) => picker.setTier(tier as NonNullable<MetroPickerVM['tier']>)}
          />
        )}
      </Stack>
    </Card>
  );
}
