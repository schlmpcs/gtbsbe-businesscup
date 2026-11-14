'use client';

// The selected event's form: its year (the accessible way to move a chip) and its own fields.
import type { SelectHTMLAttributes } from 'react';
import { lifeEvents as t } from '@/copy';
import { Button, Card, Choice, Field, NumberInput, Stack, cx, useFieldControl } from '@/ui-kit';
import type { LifeEvent, LifeEventVM, LifeEventsVM } from '../model/types';
import { chipText } from './Timeline';

/** A native select that picks up its label from the surrounding <Field>. */
function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  const field = useFieldControl();
  return (
    <select
      {...field}
      {...rest}
      className={cx('w-full rounded-lg border-2 border-border bg-surface px-md py-sm text-base', className)}
    />
  );
}

const BEDROOMS = [0, 1, 2, 3, 4] as const;

function KindFields({ input, vm }: { input: LifeEvent; vm: LifeEventsVM }) {
  switch (input.kind) {
    case 'baby':
      return null;
    case 'move':
      return (
        <>
          <Field label={t.edit.metro}>
            <Select value={input.toZip} onChange={(e) => vm.update({ ...input, toZip: e.target.value })}>
              {vm.metros.map((m) => (
                <option key={m.zip} value={m.zip}>
                  {m.metro}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.edit.bedrooms}>
            <Select
              value={String(input.bedrooms ?? 2)}
              onChange={(e) => vm.update({ ...input, bedrooms: Number(e.target.value) as (typeof BEDROOMS)[number] })}
            >
              {BEDROOMS.map((n) => (
                <option key={n} value={n}>
                  {t.edit.bedroomOption(n)}
                </option>
              ))}
            </Select>
          </Field>
        </>
      );
    case 'car':
      return (
        <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
          <Field label={t.edit.price}>
            <NumberInput prefix="$" value={input.price} min={1} max={500_000} onValueChange={(v) => v !== null && v > 0 && vm.update({ ...input, price: v, downPayment: Math.min(input.downPayment, v) })} />
          </Field>
          <Field label={t.edit.downPayment}>
            <NumberInput prefix="$" value={input.downPayment} max={input.price} onValueChange={(v) => v !== null && vm.update({ ...input, downPayment: v })} />
          </Field>
          <Field label={t.edit.apr}>
            <NumberInput percent value={input.apr} max={0.5} suffix="%" onValueChange={(v) => v !== null && vm.update({ ...input, apr: v })} />
          </Field>
          <Field label={t.edit.term}>
            <NumberInput value={input.termMonths} min={1} max={120} maxFractionDigits={0} suffix={t.edit.termSuffix} onValueChange={(v) => v !== null && Number.isInteger(v) && v >= 1 && vm.update({ ...input, termMonths: v })} />
          </Field>
        </div>
      );
    case 'raise': {
      const by = input.change.by;
      return (
        <>
          <Choice
            legend={t.edit.raiseBy}
            name={`raise-by-${input.id}`}
            value={by}
            options={[
              { value: 'rate', label: t.edit.raiseByRate },
              { value: 'amount', label: t.edit.raiseByAmount },
            ]}
            onChange={(v) => vm.update({ ...input, change: v === 'rate' ? { by: 'rate', rate: 0.1 } : { by: 'amount', amount: 500 } })}
          />
          {input.change.by === 'rate' ? (
            <Field label={t.edit.raiseRate} hint={t.edit.raiseHint}>
              <NumberInput percent value={input.change.rate} min={-0.9} max={5} suffix="%" onValueChange={(v) => v !== null && vm.update({ ...input, change: { by: 'rate', rate: v } })} />
            </Field>
          ) : (
            <Field label={t.edit.raiseAmount} hint={t.edit.raiseHint}>
              <NumberInput prefix="$" value={input.change.amount} min={-100_000} max={100_000} onValueChange={(v) => v !== null && vm.update({ ...input, change: { by: 'amount', amount: v } })} />
            </Field>
          )}
        </>
      );
    }
    case 'purchase':
      return (
        <Field label={t.edit.amount}>
          <NumberInput prefix="$" value={input.amount} max={5_000_000} onValueChange={(v) => v !== null && vm.update({ ...input, amount: v })} />
        </Field>
      );
  }
}

export function EventEditor({ event, vm }: { event: LifeEventVM; vm: LifeEventsVM }) {
  const name = chipText(event);
  return (
    <Card title={t.edit.title(name)} headingLevel={2} tone="muted" data-testid="life-editor">
      <Stack gap="lg">
        <Field label={t.edit.year}>
          <Select value={String(event.startYear)} onChange={(e) => vm.setYear(event.id, Number(e.target.value))}>
            {vm.years.map((y) => (
              <option key={y} value={y}>
                {t.edit.yearOption(vm.currentYear + y, y)}
              </option>
            ))}
          </Select>
        </Field>
        <KindFields input={event.input} vm={vm} />
        {(event.kind === 'car' || event.kind === 'raise' || event.kind === 'purchase') && (
          <p className="text-sm text-text-muted">{t.edit.defaultsNote}</p>
        )}
        <div>
          <Button variant="secondary" size="sm" onClick={() => vm.remove(event.id)}>
            {t.edit.remove}
          </Button>
        </div>
      </Stack>
    </Card>
  );
}
