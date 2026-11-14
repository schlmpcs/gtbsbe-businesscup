// S8 Balance sheet: age, take-home pay, cash and retirement (each skippable → estimate), the debt
// list (add / edit / remove; APR typed as a percent, stored as a decimal; a skipped minimum payment
// is estimated), the debt-load gauge and today's net worth.
import { useState } from 'react';
import { ladder } from '@/copy';
import {
  Button, Card, EstimateTag, Field, formatMoney, formatRate, Gauge, NumberInput, Row, Stack, Stat,
} from '@/ui-kit';
import type { BalanceFieldKey, BalanceSheetVM, DebtRowVM, LadderProgressVM } from '../model/types';
import { DebtForm } from './DebtForm';
import { LadderShell } from './LadderShell';

const t = ladder.balance;
const FIELDS: readonly BalanceFieldKey[] = ['age', 'takeHomePay', 'cash', 'retirement'];

export type BalanceSheetProps = { vm: BalanceSheetVM; progress: LadderProgressVM };

export function BalanceSheet({ vm, progress }: BalanceSheetProps) {
  // Which debt row is being edited ('new' = the add form).
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <LadderShell screen="S8" progress={progress} loading={vm.status === 'loading'}>
      <Card title={t.fieldsTitle}>
        <Stack gap="lg">
          {FIELDS.map((key) => (
            <BalanceField key={key} field={key} vm={vm} />
          ))}
        </Stack>
      </Card>

      <Card title={t.debtsTitle}>
        <Stack gap="md">
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
            <Row>
              <Button variant="secondary" onClick={() => setEditing('new')}>
                {t.addDebt}
              </Button>
            </Row>
          )}
        </Stack>
      </Card>

      <Card>
        <Stack gap="lg">
          <Gauge
            label={t.debtLoadLabel}
            value={vm.debtLoad.value}
            thresholds={vm.debtLoad.thresholds}
            max={vm.debtLoadMax}
            formatValue={(v) => formatRate(v, 0)}
            zoneLabels={t.debtLoadZones}
            hint={t.debtLoadHint}
          />
          <Stat label={t.netWorthLabel} value={formatMoney(vm.netWorth)} hint={t.netWorthHint} />
        </Stack>
      </Card>
    </LadderShell>
  );
}

function BalanceField({ field, vm }: { field: BalanceFieldKey; vm: BalanceSheetVM }) {
  const { value, isEstimate } = vm.fields[field];
  const bounds = vm.fieldBounds[field];
  const isAge = field === 'age';
  return (
    <div className="flex flex-col gap-xs">
      <Field label={t.fields[field]} hint={isEstimate ? t.estimatedHint : t.hints[field]} isEstimate={isEstimate}>
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
        />
      </Field>
      {!isEstimate && (
        <Row>
          <Button size="sm" variant="ghost" onClick={() => vm.skipField(field)} aria-label={t.skipLabel(t.fields[field])}>
            {t.skip}
          </Button>
        </Row>
      )}
    </div>
  );
}

function DebtRow({ debt, onEdit, onRemove }: { debt: DebtRowVM; onEdit: () => void; onRemove: () => void }) {
  const kind = t.debtKinds[debt.kind];
  return (
    <div
      data-debt-id={debt.id}
      className="flex flex-wrap items-center justify-between gap-md rounded-md border border-border px-md py-sm"
    >
      <div className="flex min-w-0 flex-col gap-xs">
        <span className="text-sm font-semibold">{kind}</span>
        <span className="text-sm tabular-nums">
          {formatMoney(debt.balance)} · {formatRate(debt.apr, 2)} {t.aprLabel}
        </span>
        <span className="flex flex-wrap items-center gap-sm text-xs text-text-muted tabular-nums">
          {t.minPaymentPerMonth(formatMoney(debt.minPayment))}
          {debt.minPaymentIsEstimate && <EstimateTag />}
        </span>
      </div>
      <Row gap="xs">
        <Button size="sm" variant="ghost" onClick={onEdit} aria-label={t.editLabel(kind)}>
          {t.edit}
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove} aria-label={t.removeLabel(kind)}>
          {t.remove}
        </Button>
      </Row>
    </div>
  );
}
