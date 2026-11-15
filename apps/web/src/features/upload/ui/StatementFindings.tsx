// JF7, S9 "We found": the paychecks and debts found in the statement just read, one row each, to
// confirm or dismiss (issue #139; the same "found in your statement" card look as the S8 debt card,
// JF17). Pay is one tap. A debt asks only its balance: its monthly payment is measured, and its APR
// is a typical rate for the kind, shown with an estimate tag and where it comes from.
// Presentational: props in, events out. The only local state is the balance being typed.
import { useId, useState, type ReactNode } from 'react';
import { ladder, upload } from '@/copy';
import { Button, EstimateTag, formatMoney, formatRate, NumberInput, Sticker } from '@/ui-kit';
import type { FindingStatus, FoundDebtVM, FoundIncomeVM, StatementFindingsVM } from '../model/types';

const t = upload.findings;
const kindLabel = ladder.balance.debtKinds;

export type StatementFindingsProps = { vm: StatementFindingsVM };

export function StatementFindings({ vm }: StatementFindingsProps) {
  const titleId = useId();
  if (vm.status === 'hidden') return null;
  if (vm.status === 'none') {
    return (
      <p role="status" className="rounded-xl bg-surface p-lg text-sm text-text-muted shadow-md">
        {t.none}
      </p>
    );
  }
  const summary = [
    ...vm.income.map((i) => t.summaryPay(formatMoney(i.monthly))),
    ...vm.debts.map((d) => t.summaryDebt(d.creditor, d.kind)),
  ];
  return (
    <section
      aria-labelledby={titleId}
      className="relative flex flex-col gap-lg rounded-xl bg-surface p-xl pt-2xl shadow-md ring-2 ring-primary ring-inset"
    >
      <Sticker tilt={-4} className="absolute -top-sm left-lg text-xs">
        {t.sticker}
      </Sticker>
      <div className="flex flex-col gap-xs">
        <h2 id={titleId} className="sr-only">
          {t.title}
        </h2>
        <p className="text-lg font-bold" data-testid="findings-summary">
          {t.summary(summary)}
        </p>
        <p className="text-sm text-text-muted">{t.note}</p>
      </div>

      {vm.income.length > 0 && (
        <FindingGroup title={t.payTitle}>
          {vm.income.map((f) => (
            <IncomeRow key={f.id} finding={f} vm={vm} />
          ))}
          {vm.confirmedTakeHome !== null && (
            <p role="status" className="text-sm font-medium text-positive">
              {t.takeHomeSet(formatMoney(vm.confirmedTakeHome))}
            </p>
          )}
        </FindingGroup>
      )}

      {vm.debts.length > 0 && (
        <FindingGroup title={t.debtsTitle}>
          {vm.debts.map((f) => (
            <DebtRow key={f.id} finding={f} vm={vm} />
          ))}
        </FindingGroup>
      )}
    </section>
  );
}

function FindingGroup({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-sm">
      <h3 id={id} className="text-base font-semibold">
        {title}
      </h3>
      <ul aria-labelledby={id} className="flex flex-col gap-sm">
        {children}
      </ul>
    </div>
  );
}

/** The row's heading line: what it is on the left, the monthly amount on the right. */
function RowHead({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-md">
      <span className="min-w-0 break-words text-base font-semibold">{label}</span>
      <span className="font-display text-2xl font-extrabold tabular-nums">{t.perMonth(formatMoney(amount))}</span>
    </div>
  );
}

function Decided({ status, confirmed }: { status: FindingStatus; confirmed: string }) {
  if (status === 'pending') return null;
  return (
    <p className={status === 'confirmed' ? 'text-sm font-medium text-positive' : 'text-sm text-text-muted'}>
      {status === 'confirmed' ? confirmed : t.dismissed}
    </p>
  );
}

function IncomeRow({ finding: f, vm }: { finding: FoundIncomeVM; vm: StatementFindingsVM }) {
  const label = t.payLabel(f.payer, f.payroll);
  return (
    <li data-finding={f.id} data-status={f.status} aria-label={label} className="flex flex-col gap-sm rounded-lg bg-bg px-lg py-md">
      <RowHead label={label} amount={f.monthly} />
      <p className="text-xs text-text-muted tabular-nums">{t.payDetail(f.deposits, formatMoney(f.perDeposit), f.cadence)}</p>
      {f.status === 'pending' ? (
        <div className="flex flex-wrap gap-sm">
          <Button variant="dark" size="sm" onClick={() => vm.confirmIncome(f.id)}>
            {t.confirmPay}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => vm.dismissIncome(f.id)} aria-label={t.dismissPayLabel(label)}>
            {t.dismissPay}
          </Button>
        </div>
      ) : (
        <Decided status={f.status} confirmed={t.payConfirmed} />
      )}
    </li>
  );
}

function DebtRow({ finding: f, vm }: { finding: FoundDebtVM; vm: StatementFindingsVM }) {
  const [balance, setBalance] = useState<number | null>(null);
  const inputId = useId();
  const hintId = useId();
  const label = t.debtLabel(f.creditor, kindLabel[f.kind]);
  return (
    <li data-finding={f.id} data-status={f.status} aria-label={label} className="flex flex-col gap-sm rounded-lg bg-bg px-lg py-md">
      <RowHead label={label} amount={f.monthlyPayment} />
      <p className="text-xs text-text-muted tabular-nums">{t.debtDetail(f.payments, formatMoney(f.monthlyPayment))}</p>
      <p className="flex flex-wrap items-center gap-sm text-xs text-text-muted" data-testid="finding-apr">
        <span className="font-semibold text-text tabular-nums">{t.aprLine(formatRate(f.apr, 2))}</span>
        <EstimateTag className="bg-surface" />
        <span>{t.aprSource(f.aprSource.name)}</span>
      </p>
      {f.status === 'pending' ? (
        <>
          <div className="flex flex-col gap-xs">
            <label htmlFor={inputId} className="text-sm text-text-muted">
              {t.balanceLabel}
              <span className="sr-only"> ({label})</span>
            </label>
            <NumberInput
              id={inputId}
              aria-describedby={hintId}
              value={balance}
              min={vm.balanceBounds.min}
              max={vm.balanceBounds.max}
              prefix="$"
              onValueChange={setBalance}
              className="font-display text-xl font-extrabold [&_input]:text-xl"
            />
            <span id={hintId} className="text-xs text-text-muted">
              {t.balanceHint}
            </span>
          </div>
          <div className="flex flex-wrap gap-sm">
            <Button
              variant="dark"
              size="sm"
              disabled={balance === null}
              aria-label={t.confirmDebtLabel(label)}
              onClick={() => {
                if (balance !== null) vm.confirmDebt(f.id, balance);
              }}
            >
              {t.confirmDebt}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => vm.dismissDebt(f.id)} aria-label={t.dismissDebtLabel(label)}>
              {t.dismissDebt}
            </Button>
          </div>
        </>
      ) : (
        <Decided status={f.status} confirmed={t.debtConfirmed} />
      )}
    </li>
  );
}
