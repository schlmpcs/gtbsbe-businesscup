// S8 add / edit form for one debt. Local draft state only; the view-model gets the values on Save.
// APR is typed as a percent and handed over as a decimal (NumberInput percent mode). An empty
// minimum payment is sent as null: the view-model then estimates it and tags it as an estimate.
import { useState } from 'react';
import { ladder } from '@/copy';
import { Button, Field, NumberInput, Row, Stack, useFieldControl } from '@/ui-kit';
import type { BalanceSheetVM, DebtInput } from '../model/types';

const t = ladder.balance;

type Kind = DebtInput['kind'];
type Draft = { kind: Kind; balance: number | null; apr: number | null; minPayment: number | null };

export type DebtFormProps = {
  title: string;
  kinds: readonly Kind[];
  bounds: BalanceSheetVM['debtBounds'];
  initial: Draft;
  onSave: (input: DebtInput) => void;
  onCancel: () => void;
};

function KindSelect({ value, kinds, onChange }: { value: Kind; kinds: readonly Kind[]; onChange: (k: Kind) => void }) {
  const control = useFieldControl();
  return (
    <select
      {...control}
      value={value}
      onChange={(e) => onChange(e.target.value as Kind)}
      className="w-full rounded-md border border-border bg-bg px-md py-md text-base"
    >
      {kinds.map((k) => (
        <option key={k} value={k}>
          {t.debtKinds[k]}
        </option>
      ))}
    </select>
  );
}

export function DebtForm({ title, kinds, bounds, initial, onSave, onCancel }: DebtFormProps) {
  const [draft, setDraft] = useState<Draft>(initial);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const complete = draft.balance !== null && draft.apr !== null;

  return (
    <form
      aria-label={title}
      className="flex flex-col gap-md rounded-md border border-border bg-bg p-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.balance === null || draft.apr === null) return;
        onSave({ kind: draft.kind, balance: draft.balance, apr: draft.apr, minPayment: draft.minPayment });
      }}
    >
      <h3 className="text-base font-semibold">{title}</h3>
      <Stack gap="md">
        <Field label={t.kindLabel}>
          <KindSelect value={draft.kind} kinds={kinds} onChange={(kind) => set({ kind })} />
        </Field>
        <Field label={t.balanceLabel}>
          <NumberInput
            value={draft.balance}
            min={bounds.balance.min}
            max={bounds.balance.max}
            prefix="$"
            onValueChange={(balance) => set({ balance })}
          />
        </Field>
        <Field label={t.aprLabel}>
          <NumberInput
            value={draft.apr}
            percent
            min={bounds.apr.min}
            max={bounds.apr.max}
            suffix="%"
            onValueChange={(apr) => set({ apr })}
          />
        </Field>
        <Field label={t.minPaymentLabel} hint={t.minPaymentHint} isEstimate={draft.minPayment === null}>
          <NumberInput
            value={draft.minPayment}
            min={bounds.minPayment.min}
            max={bounds.minPayment.max}
            prefix="$"
            suffix={t.perMonthSuffix}
            onValueChange={(minPayment) => set({ minPayment })}
          />
        </Field>
      </Stack>
      <Row gap="sm">
        <Button type="submit" variant="dark" disabled={!complete}>
          {t.save}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t.cancel}
        </Button>
      </Row>
    </form>
  );
}
