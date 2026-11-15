'use client';

// P2 Account detail (/accounts/[id]): the balance and its history, the summary, edits (balance, name,
// leave out, delete) and the account's transactions. Presentational: every value comes from useAccount;
// the route passes its Link component and the transactions list and add form (the Transactions
// feature's ui) as slots, so this screen never imports another feature.
import { useState, type ReactNode } from 'react';
import { accounts as t, planner } from '@/copy';
import { Button, buttonClassName, Card, cx, EstimateTag, Field, formatMoney, formatMonthYear, formatRate, Stack, Tag, useFieldControl } from '@/ui-kit';
import { Segmented } from '@/ui-kit/reports';
import type { AccountPeriod, AccountVM } from '../model/types';
import type { LinkComponent } from './AccountsScreen';
import { BalanceChart } from './BalanceChart';

export type AccountDetailScreenProps = {
  vm: AccountVM;
  links: { accounts: string };
  Link: LinkComponent;
  /** The account's lines (vm.account.transactions), rendered by the route. */
  transactions?: ReactNode;
  /** The add-a-line form, wired by the route to vm.addTransaction; `done` closes it. */
  renderAddLine?: (done: () => void) => ReactNode;
};

const PERIODS: AccountPeriod[] = ['1m', '3m', '1y', 'all'];

export function AccountDetailScreen({ vm, links, Link, transactions, renderAddLine }: AccountDetailScreenProps) {
  const back = (
    <Link href={links.accounts} className="text-sm font-semibold text-primary hover:underline">
      ← {t.detailScreen.backToAccounts}
    </Link>
  );
  return (
    <main className="page">
      <Stack gap="2xl">
        {back}
        {!vm.ready ? (
          <div role="status" aria-live="polite" className="h-80 animate-pulse rounded-xl bg-surface">
            <span className="sr-only">{t.detailScreen.loading}</span>
          </div>
        ) : !vm.found || vm.account === null ? (
          <Card data-testid="account-not-found" className="flex flex-col items-center gap-md text-center">
            <h1 className="font-display text-3xl font-extrabold">{t.detailScreen.notFoundTitle}</h1>
            <p className="max-w-prose text-text-muted">{t.detailScreen.notFoundBody}</p>
            <Link href={links.accounts} className={buttonClassName({ variant: 'primary' })}>
              {t.detailScreen.backToAccounts}
            </Link>
          </Card>
        ) : (
          <Detail vm={vm} account={vm.account} transactions={transactions} renderAddLine={renderAddLine} />
        )}
        <p className="text-xs text-text-muted">
          {t.screen.privacy} {planner.educational}
        </p>
      </Stack>
    </main>
  );
}

type Account = NonNullable<AccountVM['account']>;

function Detail({ vm, account, transactions, renderAddLine }: { vm: AccountVM; account: Account; transactions?: ReactNode; renderAddLine?: (done: () => void) => ReactNode }) {
  const [addingLine, setAddingLine] = useState(false);
  return (
    <>
      <header className="flex flex-col gap-sm" data-testid="account-header">
        <span className="flex flex-wrap items-center gap-sm text-sm text-text-muted">
          {t.groups[account.group]}
          <Tag>{t.sides[account.kind]}</Tag>
          {account.excluded && (
            <Tag variant="dashed" title={t.screen.excludedHint}>
              {t.screen.excludedTag}
            </Tag>
          )}
        </span>
        <h1 className="font-display text-4xl font-extrabold leading-tight break-words">{account.name}</h1>
        <p className="flex flex-wrap items-center gap-sm">
          <span className="font-display text-3xl font-extrabold tabular-nums" data-testid="account-balance">
            {formatMoney(account.balance)}
          </span>
          {account.isEstimate && <EstimateTag />}
        </p>
      </header>

      <Card className="flex flex-col gap-lg">
        <Segmented
          legend={t.screen.periodLabel}
          name="account-period"
          value={vm.period}
          options={PERIODS.map((p) => ({ value: p, label: t.periods[p] }))}
          onChange={vm.setPeriod}
        />
        <BalanceChart points={account.chart} label={t.detailScreen.chartLabel} tooFew={t.screen.chartTooFew} />
      </Card>

      <div className="grid grid-cols-1 gap-xl md:grid-cols-2">
        <Card title={t.detailScreen.summaryTitle} data-testid="account-summary">
          <SummaryList account={account} />
        </Card>
        <Card title={t.detailScreen.manage}>
          <Edits vm={vm} account={account} />
        </Card>
      </div>

      <Card
        title={t.detail.transactions}
        action={
          renderAddLine && !addingLine ? (
            <Button size="sm" variant="secondary" onClick={() => setAddingLine(true)} data-testid="account-add-transaction">
              {t.detailScreen.addTransaction}
            </Button>
          ) : undefined
        }
      >
        <Stack gap="lg">
          {addingLine && renderAddLine?.(() => setAddingLine(false))}
          {account.transactions.length === 0 ? <p className="text-text-muted">{t.detailScreen.noTransactions}</p> : transactions}
        </Stack>
      </Card>
    </>
  );
}

function SummaryList({ account }: { account: Account }) {
  const s = account.summary;
  const none = t.detailScreen.notSet;
  const rows: { id: string; label: string; value: ReactNode }[] = [
    { id: 'type', label: t.detail.type, value: t.groups[s.group] },
    ...(account.kind === 'liability'
      ? [
          { id: 'apr', label: t.detail.apr, value: s.apr === null ? none : formatRate(s.apr, 2) },
          {
            id: 'minPayment',
            label: t.detail.minPayment,
            value:
              s.minPayment === null ? (
                none
              ) : (
                <span className="inline-flex items-center gap-xs">
                  {formatMoney(s.minPayment.value, { cents: true })}
                  {s.minPayment.isEstimate && <EstimateTag />}
                </span>
              ),
          },
          ...(s.creditLimit === null
            ? []
            : [{ id: 'creditLimit', label: t.detail.creditLimit, value: formatMoney(s.creditLimit.value) }]),
          ...(s.debtKind !== null && s.debtKind in t.loanKinds
            ? [{ id: 'debtKind', label: t.fields.debtKind, value: t.loanKinds[s.debtKind as keyof typeof t.loanKinds] }]
            : []),
        ]
      : []),
    { id: 'lastUpdated', label: t.detail.lastUpdated, value: s.lastUpdated === null ? none : formatMonthYear(s.lastUpdated) },
    { id: 'created', label: t.detail.created, value: s.created === null ? none : formatMonthYear(s.created) },
  ];
  return (
    <dl className="flex flex-col divide-y divide-border">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-md py-sm">
          <dt className="text-sm text-text-muted">{r.label}</dt>
          <dd className="text-right font-medium tabular-nums">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const INPUT = 'w-full min-h-11 rounded-lg border-2 bg-surface px-md py-sm text-base';

function TextInput({ value, onChange, inputMode, invalid, testId }: { value: string; onChange: (v: string) => void; inputMode?: 'decimal'; invalid: boolean; testId: string }) {
  const control = useFieldControl();
  return (
    <input
      {...control}
      type="text"
      inputMode={inputMode}
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testId}
      className={cx(INPUT, invalid ? 'border-negative' : 'border-border')}
    />
  );
}

function Edits({ vm, account }: { vm: AccountVM; account: Account }) {
  const [balance, setBalance] = useState('');
  const [balanceError, setBalanceError] = useState(false);
  const [name, setName] = useState(account.name);
  const [nameError, setNameError] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <Stack gap="xl">
      <form
        noValidate
        className="flex flex-col gap-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const typed = balance.trim() === '' ? Number.NaN : Number(balance.replace(/[$,\s]/g, ''));
          const ok = vm.editBalance(typed);
          setBalanceError(!ok);
          if (ok) setBalance('');
        }}
      >
        <Field label={t.detailScreen.newBalance} error={balanceError ? t.detailScreen.invalidBalance : undefined}>
          <TextInput value={balance} onChange={setBalance} inputMode="decimal" invalid={balanceError} testId="account-new-balance" />
        </Field>
        <Button type="submit" size="sm" className="self-start" data-testid="account-save-balance">
          {t.detailScreen.saveBalance}
        </Button>
      </form>

      <form
        noValidate
        className="flex flex-col gap-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setNameError(!vm.rename(name));
        }}
      >
        <Field label={t.detailScreen.newName} error={nameError ? t.detailScreen.blankName : undefined}>
          <TextInput value={name} onChange={setName} invalid={nameError} testId="account-name" />
        </Field>
        <Button type="submit" size="sm" variant="secondary" className="self-start">
          {t.detailScreen.saveName}
        </Button>
      </form>

      <div className="flex flex-wrap gap-sm border-t border-border pt-lg">
        <Button size="sm" variant="secondary" onClick={() => vm.exclude()} data-testid="account-exclude">
          {account.excluded ? t.detailScreen.include : t.detailScreen.exclude}
        </Button>
        {!confirming ? (
          <Button size="sm" variant="ghost" className="text-negative" onClick={() => setConfirming(true)} data-testid="account-delete">
            {t.detailScreen.delete}
          </Button>
        ) : (
          <div role="alert" className="flex w-full flex-col gap-sm rounded-lg bg-surface-strong p-md">
            <p className="text-sm">{t.detailScreen.confirmDelete}</p>
            <div className="flex flex-wrap gap-sm">
              <Button size="sm" onClick={vm.delete} data-testid="account-delete-confirm">
                {t.detailScreen.confirmDeleteYes}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                {t.detailScreen.cancel}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Stack>
  );
}
