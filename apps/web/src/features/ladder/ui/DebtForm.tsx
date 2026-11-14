// S8 add / edit one debt, "confirm, not type" (JF17, Figma "JF13 + JF17 · closest life & debts"):
// tap a kind chip, type only the balance. The APR is prefilled with the view-model's default for
// that kind and the minimum with the engine estimate, both tagged estimate and editable inline.
// Local draft state only; the view-model gets the values on Save. APR is typed as a percent and
// handed over as a decimal (NumberInput percent mode). An untouched minimum is sent as null: the
// view-model then estimates it and keeps it tagged as an estimate.
import { useState } from 'react';
import { ladder } from '@/copy';
import { Button, Choice, Field, formatMoney, NumberInput, Row, Stack } from '@/ui-kit';
import type { BalanceSheetVM, DebtInput } from '../model/types';

const t = ladder.balance;

type Kind = DebtInput['kind'];
type Draft = { kind: Kind; balance: number | null; apr: number | null; minPayment: number | null };

export type DebtFormProps = {
  title: string;
  kinds: readonly Kind[];
  bounds: BalanceSheetVM['debtBounds'];
  initial: Draft;
  /** APR prefilled while the user hasn't typed one (shown as an estimate). */
  aprDefaults: BalanceSheetVM['debtAprDefaults'];
  estimateMinPayment: BalanceSheetVM['estimateMinPayment'];
  onSave: (input: DebtInput) => void;
  onCancel: () => void;
  /** A line under the title, e.g. "Read from your statement. Check the numbers." */
  note?: string;
};

export function DebtForm({ title, kinds, bounds, initial, aprDefaults, estimateMinPayment, onSave, onCancel, note }: DebtFormProps) {
  const [draft, setDraft] = useState<Draft>(initial);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const aprIsEstimate = draft.apr === null;
  const apr = draft.apr ?? aprDefaults[draft.kind];
  const minEstimate = draft.balance !== null ? estimateMinPayment(draft.balance, apr) : null;

  return (
    <form
      aria-label={title}
      className="flex flex-col gap-md rounded-lg bg-bg p-lg"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.balance === null) return;
        onSave({ kind: draft.kind, balance: draft.balance, apr, minPayment: draft.minPayment });
      }}
    >
      <h3 className="text-base font-semibold">{title}</h3>
      {note && <p className="text-sm text-text-muted">{note}</p>}
      <Stack gap="md">
        <Choice
          legend={t.kindLabel}
          name={`debt-kind-${title}`}
          value={draft.kind}
          options={kinds.map((k) => ({ value: k, label: t.debtKinds[k] }))}
          onChange={(kind) => set({ kind })}
        />
        <Field label={t.balanceLabel}>
          <NumberInput
            value={draft.balance}
            min={bounds.balance.min}
            max={bounds.balance.max}
            prefix="$"
            autoFocus
            className="font-display text-2xl font-extrabold [&_input]:text-2xl"
            onValueChange={(balance) => set({ balance })}
          />
        </Field>
        <div className="grid gap-md sm:grid-cols-2">
          <Field label={t.aprLabel} hint={aprIsEstimate ? t.aprPrefilledHint : undefined} isEstimate={aprIsEstimate}>
            <NumberInput
              value={apr}
              percent
              min={bounds.apr.min}
              max={bounds.apr.max}
              suffix="%"
              onValueChange={(v) => set({ apr: v })}
            />
          </Field>
          <Field
            label={t.minPaymentLabel}
            hint={
              draft.minPayment === null
                ? minEstimate !== null
                  ? t.minPaymentEstimated(formatMoney(minEstimate))
                  : t.minPaymentHint
                : undefined
            }
            isEstimate={draft.minPayment === null}
          >
            <NumberInput
              value={draft.minPayment}
              min={bounds.minPayment.min}
              max={bounds.minPayment.max}
              prefix="$"
              suffix={t.perMonthSuffix}
              onValueChange={(minPayment) => set({ minPayment })}
            />
          </Field>
        </div>
      </Stack>
      <Row gap="sm">
        <Button type="submit" variant="dark" disabled={draft.balance === null}>
          {t.save}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t.cancel}
        </Button>
      </Row>
    </form>
  );
}
