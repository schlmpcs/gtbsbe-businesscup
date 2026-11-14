// S8 Balance sheet (Design v3, Figma 202:2117): white cards for age and take-home pay, savings and
// debts, each value on a cream row (label left, number right; a skipped field shows an estimate tag,
// a typed one can be skipped back to our estimate). Debts: add / edit / remove (APR typed as a
// percent, stored as a decimal; a skipped minimum payment is estimated) with the debt-load gauge.
// Right: an ink card with today's net worth, then the house being built.
import { useId, useState, type ReactNode } from 'react';
import { ladder } from '@/copy';
import { Art, Button, cx, EstimateTag, formatMoney, formatRate, Gauge, NumberInput } from '@/ui-kit';
import type { BalanceFieldKey, BalanceSheetVM, DebtRowVM, LadderProgressVM } from '../model/types';
import { DebtForm } from './DebtForm';
import { LadderShell } from './LadderShell';

const t = ladder.balance;

export type BalanceSheetProps = {
  vm: BalanceSheetVM;
  progress: LadderProgressVM;
};

function SheetCard({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-md rounded-xl bg-surface p-xl shadow-md">
      <h2 id={id} className="text-lg font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function BalanceSheet({ vm, progress }: BalanceSheetProps) {
  // Which debt row is being edited ('new' = the add form).
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <LadderShell
      screen="S8"
      progress={progress}
      loading={vm.status === 'loading'}
      aside={
        <>
          <section aria-label={t.netWorthScore} className="flex flex-col gap-sm rounded-xl bg-ink p-xl text-on-primary shadow-md">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{t.netWorthScore}</p>
            <p className="font-display text-[length:calc(var(--text-display)*1.2)] font-extrabold leading-display tracking-tight tabular-nums">
              {formatMoney(vm.netWorth)}
            </p>
            <p className="text-sm text-on-primary/60">{t.netWorthNote}</p>
          </section>
          <Art name="house-build" className="mx-auto hidden w-full max-w-(--container-md) lg:block" />
        </>
      }
    >
      <SheetCard title={t.payTitle}>
        <BalanceField field="age" vm={vm} />
        <BalanceField field="takeHomePay" vm={vm} />
      </SheetCard>

      <SheetCard title={t.savingsTitle}>
        <BalanceField field="cash" vm={vm} />
        <BalanceField field="retirement" vm={vm} />
      </SheetCard>

      <SheetCard title={t.debtsTitle}>
        <div className="grid gap-xl md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-sm">
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
                initial={{ kind: vm.debtKinds[0]!, balance: null, apr: null, minPayment: null }}
                onSave={(input) => {
                  vm.addDebt(input);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div>
                <Button size="sm" variant="ghost" onClick={() => setEditing('new')}>
                  <span aria-hidden="true">+</span>
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
      </SheetCard>
    </LadderShell>
  );
}

function BalanceField({ field, vm }: { field: BalanceFieldKey; vm: BalanceSheetVM }) {
  const { value, isEstimate } = vm.fields[field];
  const bounds = vm.fieldBounds[field];
  const isAge = field === 'age';
  const inputId = useId();
  const hintId = useId();
  const hint = isEstimate ? t.estimatedHint : isAge ? undefined : t.hints[field];
  return (
    <div
      data-field={field}
      data-estimate={isEstimate ? 'true' : 'false'}
      className="flex flex-wrap items-center justify-between gap-md rounded-lg bg-bg px-lg py-md"
    >
      <div className="flex min-w-0 flex-col gap-xs">
        <span className="flex flex-wrap items-center gap-sm">
          <label htmlFor={inputId} className="text-base text-text-muted">
            {t.fields[field]}
          </label>
          {isEstimate && <EstimateTag className="bg-surface" />}
        </span>
        {hint && (
          <span id={hintId} className="text-xs text-text-muted">
            {hint}
          </span>
        )}
      </div>
      <div className="flex w-full items-center gap-sm sm:w-auto">
        {!isEstimate && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => vm.skipField(field)}
            aria-label={t.skipLabel(t.fields[field])}
          >
            {t.skip}
          </Button>
        )}
        <NumberInput
          id={inputId}
          aria-describedby={hint ? hintId : undefined}
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
            'min-w-0 flex-1 font-display sm:w-(--container-3xs) sm:flex-none text-2xl font-extrabold [&_input]:py-xs [&_input]:text-right [&_input]:text-2xl',
            isEstimate && '[&_input]:text-text-muted',
          )}
        />
      </div>
    </div>
  );
}

function DebtRow({ debt, onEdit, onRemove }: { debt: DebtRowVM; onEdit: () => void; onRemove: () => void }) {
  const kind = t.debtKinds[debt.kind];
  return (
    <div data-debt-id={debt.id} className="flex flex-col gap-xs rounded-lg bg-bg px-lg py-md">
      <div className="flex flex-wrap items-baseline justify-between gap-md">
        <span className="text-base text-text-muted tabular-nums">
          {kind} · {formatRate(debt.apr, 2)} {t.aprLabel}
        </span>
        <span className="font-display text-2xl font-extrabold tabular-nums">{formatMoney(debt.balance)}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <span className="flex flex-wrap items-center gap-sm text-xs text-text-muted tabular-nums">
          {t.minPaymentPerMonth(formatMoney(debt.minPayment))}
          {debt.minPaymentIsEstimate && <EstimateTag className="bg-surface" />}
        </span>
        <span className="flex gap-xs">
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label={t.editLabel(kind)}>
            {t.edit}
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove} aria-label={t.removeLabel(kind)}>
            {t.remove}
          </Button>
        </span>
      </div>
    </div>
  );
}
