// S8 Balance sheet (Figma S08): age, take-home pay, cash and retirement as big-number tiles (each
// skippable → estimate: dashed orange border and an ESTIMATE sticker), the debt list (add / edit /
// remove; APR typed as a percent, stored as a decimal; a skipped minimum payment is estimated) with
// the debt-load gauge, and today's net worth in the black score bar.
import { useState } from 'react';
import { ladder } from '@/copy';
import {
  Button,
  Card,
  cx,
  EstimateTag,
  Field,
  formatMoney,
  formatRate,
  Gauge,
  NumberInput,
  Scoreboard,
  Sticker,
} from '@/ui-kit';
import type { BalanceFieldKey, BalanceSheetVM, DebtRowVM, LadderProgressVM } from '../model/types';
import { DebtForm } from './DebtForm';
import { LadderShell } from './LadderShell';

const t = ladder.balance;
const FIELDS: readonly BalanceFieldKey[] = ['age', 'takeHomePay', 'cash', 'retirement'];
/** Small decorative tilts, as in the frame. */
const TILTS: Record<BalanceFieldKey, number> = {
  age: -0.6,
  takeHomePay: 0.5,
  cash: -0.4,
  retirement: 0.6,
};

export type BalanceSheetProps = {
  vm: BalanceSheetVM;
  progress: LadderProgressVM;
};

export function BalanceSheet({ vm, progress }: BalanceSheetProps) {
  // Which debt row is being edited ('new' = the add form).
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <LadderShell screen="S8" progress={progress} loading={vm.status === 'loading'}>
      <section aria-label={t.fieldsTitle} className="grid grid-cols-1 gap-xl sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((key) => (
          <BalanceField key={key} field={key} vm={vm} />
        ))}

        <Card title={t.debtsTitle} className="sm:col-span-2" style={{ transform: 'rotate(-0.3deg)' }}>
          <div className="grid gap-xl md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="flex flex-col gap-md">
              {vm.debts.length === 0 && editing !== 'new' && <p className="text-sm text-text-muted">{t.noDebts}</p>}
              {vm.debts.length > 0 && (
                <ul aria-label={t.debtsLabel} className="flex flex-col gap-sm">
                  {vm.debts.map((d) => (
                    <li key={d.id}>
                      {editing === d.id ? (
                        <DebtForm
                          title={t.formTitleEdit(t.debtKinds[d.kind])}
                          kinds={vm.debtKinds}
                          bounds={vm.debtBounds}
                          initial={{
                            kind: d.kind,
                            balance: d.balance,
                            apr: d.apr,
                            // A skipped minimum stays skipped unless the user types one.
                            minPayment: d.minPaymentIsEstimate ? null : d.minPayment,
                          }}
                          onSave={(input) => {
                            vm.updateDebt(d.id, input);
                            setEditing(null);
                          }}
                          onCancel={() => setEditing(null)}
                        />
                      ) : (
                        <DebtRow
                          debt={d}
                          onEdit={() => setEditing(d.id)}
                          onRemove={() => {
                            vm.removeDebt(d.id);
                            if (editing === d.id) setEditing(null);
                          }}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {editing === 'new' ? (
                <DebtForm
                  title={t.formTitleAdd}
                  kinds={vm.debtKinds}
                  bounds={vm.debtBounds}
                  initial={{
                    kind: vm.debtKinds[0]!,
                    balance: null,
                    apr: null,
                    minPayment: null,
                  }}
                  onSave={(input) => {
                    vm.addDebt(input);
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div>
                  <Button variant="secondary" onClick={() => setEditing('new')}>
                    {t.addDebt}
                  </Button>
                </div>
              )}
            </div>
            <Gauge
              label={t.debtLoadLabel}
              value={vm.debtLoad.value}
              thresholds={vm.debtLoad.thresholds}
              max={vm.debtLoadMax}
              formatValue={(v) => formatRate(v, 0)}
              zoneLabels={t.debtLoadZones}
              hint={t.debtLoadHint}
            />
          </div>
        </Card>
      </section>

      <Scoreboard
        label={t.scoreLabel}
        items={[
          {
            id: 'netWorth',
            value: formatMoney(vm.netWorth),
            label: (
              <>
                {t.netWorthScore} <span className="opacity-60">({t.netWorthNote})</span>
              </>
            ),
            tone: 'primary',
          },
        ]}
      />
    </LadderShell>
  );
}

function BalanceField({ field, vm }: { field: BalanceFieldKey; vm: BalanceSheetVM }) {
  const { value, isEstimate } = vm.fields[field];
  const bounds = vm.fieldBounds[field];
  const isAge = field === 'age';
  return (
    <div
      data-field={field}
      data-estimate={isEstimate ? 'true' : 'false'}
      style={{ transform: `rotate(${TILTS[field]}deg)` }}
      className={cx(
        'relative rounded-xl bg-surface p-xl shadow-md',
        isEstimate ? 'border-2 border-dashed border-primary' : 'border-2 border-transparent',
      )}
    >
      {isEstimate && (
        <Sticker tilt={-6} className="absolute -top-md right-lg">
          {t.estimateSticker}
        </Sticker>
      )}
      {!isEstimate && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => vm.skipField(field)}
          aria-label={t.skipLabel(t.fields[field])}
          className="absolute top-lg right-lg"
        >
          {t.skip}
        </Button>
      )}
      <Field
        label={t.fields[field]}
        hint={isEstimate ? t.estimatedHint : field === 'age' ? undefined : t.hints[field]}
        isEstimate={isEstimate}
        className="[&_label]:text-base [&_label]:text-text-muted"
      >
        <NumberInput
          value={value}
          min={bounds.min}
          max={bounds.max}
          maxFractionDigits={isAge ? 0 : 2}
          prefix={isAge ? undefined : '$'}
          suffix={isAge ? t.yearsSuffix : field === 'takeHomePay' ? t.perMonthSuffix : undefined}
          onValueChange={(v) => {
            if (v !== null) vm.setField(field, v);
          }}
          className={cx(
            'font-display text-3xl font-extrabold [&_input]:py-sm [&_input]:text-3xl',
            isEstimate && '[&_input]:text-text-muted',
          )}
        />
      </Field>
    </div>
  );
}

function DebtRow({ debt, onEdit, onRemove }: { debt: DebtRowVM; onEdit: () => void; onRemove: () => void }) {
  const kind = t.debtKinds[debt.kind];
  return (
    <div
      data-debt-id={debt.id}
      className="flex flex-wrap items-center justify-between gap-md rounded-lg bg-bg px-lg py-md"
    >
      <div className="flex min-w-0 flex-col gap-xs">
        <span className="text-sm text-text-muted">{kind}</span>
        <span className="font-display text-2xl font-extrabold tabular-nums">{formatMoney(debt.balance)}</span>
        <span className="text-sm tabular-nums">
          {formatRate(debt.apr, 2)} {t.aprLabel}
        </span>
        <span className="flex flex-wrap items-center gap-sm text-xs text-text-muted tabular-nums">
          {t.minPaymentPerMonth(formatMoney(debt.minPayment))}
          {debt.minPaymentIsEstimate && <EstimateTag />}
        </span>
      </div>
      <div className="flex gap-xs">
        <Button size="sm" variant="ghost" onClick={onEdit} aria-label={t.editLabel(kind)}>
          {t.edit}
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove} aria-label={t.removeLabel(kind)}>
          {t.remove}
        </Button>
      </div>
    </div>
  );
}
