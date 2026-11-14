'use client';

// P2 Accounts (/accounts): net worth, its history, assets versus liabilities, the accounts by group and
// the add-account sheet. Presentational: every number comes from useAccounts / useAddAccount; the route
// passes its Link component and the import link.
import type { ComponentType, ReactNode } from 'react';
import { accounts as t, planner } from '@/copy';
import { Button, buttonClassName, Card, Choice, cx, EstimateTag, formatMoney, formatRate, PageHeader, Stack, Tag } from '@/ui-kit';
import type { AccountGroupVM, AccountPeriod, AccountsVM, AddAccountVM, SummaryBarVM, SummaryMode } from '../model/types';
import { AddAccountSheet } from './AddAccountSheet';
import { BalanceChart } from './BalanceChart';

export type LinkComponent = ComponentType<{ href: string; className?: string; children?: ReactNode }>;

export type AccountsScreenProps = {
  vm: AccountsVM;
  addVm: AddAccountVM;
  links: { upload: string };
  Link: LinkComponent;
};

const PERIODS: AccountPeriod[] = ['1m', '3m', '1y', 'all'];
const MODES: SummaryMode[] = ['totals', 'percent'];
/** Segment colors, in the order the view-model sorts the groups (largest first). */
const SEGMENT = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5', 'bg-chart-6'] as const;

export function AccountsScreen({ vm, addVm, links, Link }: AccountsScreenProps) {
  return (
    <main className="mx-auto w-full max-w-(--container-5xl) px-lg py-xl sm:py-3xl">
      <Stack gap="2xl">
        <PageHeader
          title={t.title}
          intro={t.screen.intro}
          aside={
            vm.ready && !vm.isEmpty ? (
              <Button onClick={vm.add} data-testid="accounts-add">
                {t.add}
              </Button>
            ) : undefined
          }
        />
        {!vm.ready ? (
          <div role="status" aria-live="polite" className="h-80 animate-pulse rounded-xl bg-surface">
            <span className="sr-only">{t.screen.loading}</span>
          </div>
        ) : vm.isEmpty ? (
          <Card data-testid="accounts-empty" className="flex flex-col items-center gap-md text-center">
            <h2 className="font-display text-3xl font-extrabold">{t.screen.emptyTitle}</h2>
            <p className="max-w-prose text-text-muted">{t.screen.emptyBody}</p>
            <div className="flex flex-wrap justify-center gap-sm">
              <Button onClick={vm.add} data-testid="accounts-add">
                {t.add}
              </Button>
              <Link href={links.upload} className={buttonClassName({ variant: 'secondary' })}>
                {t.screen.importCta}
              </Link>
            </div>
          </Card>
        ) : (
          <>
            <NetWorthCard vm={vm} />
            <SummaryCard vm={vm} />
            <section aria-labelledby="accounts-groups" className="flex flex-col gap-lg">
              <div className="flex flex-wrap items-center justify-between gap-sm">
                <h2 id="accounts-groups" className="text-xl font-bold">
                  {t.screen.groupsTitle}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => vm.exportCsv()}>
                  {t.exportCsv}
                </Button>
              </div>
              {vm.groups.map((g) => (
                <GroupCard key={g.group} group={g} Link={Link} />
              ))}
            </section>
          </>
        )}
        <p className="text-xs text-text-muted">
          {t.screen.privacy} {planner.educational}
        </p>
      </Stack>
      <AddAccountSheet open={vm.adding} vm={addVm} uploadHref={links.upload} Link={Link} />
    </main>
  );
}

/** A 1-month change. For a liability a balance going down is good news (`goodWhenDown`). */
function Change({ value, goodWhenDown = false, className }: { value: number | null; goodWhenDown?: boolean; className?: string }) {
  if (value === null) return <span className={cx('text-sm text-text-muted', className)}>{t.screen.noChange}</span>;
  const good = value === 0 || (value > 0) !== goodWhenDown;
  return (
    <span className={cx('text-sm font-semibold tabular-nums', good ? 'text-positive' : 'text-negative', className)}>
      {formatMoney(value, { signed: true })} <span className="font-normal text-text-muted">{t.screen.lastMonth}</span>
    </span>
  );
}

function NetWorthCard({ vm }: { vm: AccountsVM }) {
  return (
    <Card data-testid="accounts-networth" className="flex flex-col gap-lg">
      <div className="flex flex-wrap items-end justify-between gap-md">
        <div className="flex min-w-0 flex-col gap-xs">
          <h2 className="text-sm font-medium text-text-muted">{t.screen.netWorth}</h2>
          <p className="font-display text-4xl font-extrabold tabular-nums" data-testid="accounts-networth-value">
            {formatMoney(vm.netWorth)}
          </p>
          <Change value={vm.change1m} />
        </div>
        <Choice
          legend={t.screen.periodLabel}
          name="accounts-period"
          value={vm.period}
          options={PERIODS.map((p) => ({ value: p, label: t.periods[p] }))}
          onChange={vm.setPeriod}
        />
      </div>
      <BalanceChart points={vm.chart} label={t.screen.chartLabel} tooFew={t.screen.chartTooFew} />
    </Card>
  );
}

function SummaryCard({ vm }: { vm: AccountsVM }) {
  return (
    <Card title={t.screen.summaryTitle} data-testid="accounts-summary">
      <Stack gap="lg">
        <Choice
          legend={t.screen.summaryModeLabel}
          name="accounts-summary-mode"
          value={vm.summaryMode}
          options={MODES.map((m) => ({ value: m, label: t.summaryModes[m] }))}
          onChange={vm.setSummaryMode}
        />
        <SummaryBar bar={vm.summary.assets} title={planner.assets} mode={vm.summaryMode} />
        <SummaryBar bar={vm.summary.liabilities} title={planner.liabilities} mode={vm.summaryMode} />
      </Stack>
    </Card>
  );
}

function SummaryBar({ bar, title, mode }: { bar: SummaryBarVM; title: string; mode: SummaryMode }) {
  return (
    <div className="flex flex-col gap-sm" data-testid={`accounts-summary-${bar.kind}`}>
      <div className="flex items-baseline justify-between gap-md">
        <h3 className="font-bold">{title}</h3>
        <span className="font-bold tabular-nums">{mode === 'percent' ? formatRate(bar.share) : formatMoney(bar.total)}</span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-strong" aria-hidden="true">
        {bar.segments.map((s, i) => (
          <span key={s.group} className={SEGMENT[i % SEGMENT.length]} style={{ width: `${s.share * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-col gap-xs text-sm">
        {bar.segments.map((s, i) => (
          <li key={s.group} className="flex items-center justify-between gap-md">
            <span className="flex min-w-0 items-center gap-sm">
              <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full', SEGMENT[i % SEGMENT.length])} />
              {planner.accountGroups[s.group]}
            </span>
            <span className="tabular-nums text-text-muted">{mode === 'percent' ? formatRate(s.share) : formatMoney(s.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GroupCard({ group, Link }: { group: AccountGroupVM; Link: LinkComponent }) {
  return (
    <Card as="section" aria-label={planner.accountGroups[group.group]} className="p-lg sm:p-xl" data-testid={`accounts-group-${group.group}`}>
      <div className="mb-sm flex flex-wrap items-baseline justify-between gap-sm">
        <h3 className="text-lg font-bold">{planner.accountGroups[group.group]}</h3>
        <div className="flex flex-col items-end">
          <span className="font-bold tabular-nums">{formatMoney(group.total)}</span>
          {group.change1m !== null && <Change value={group.change1m} goodWhenDown={group.kind === 'liability'} className="text-xs" />}
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {group.accounts.map((a) => (
          <li key={a.id}>
            <Link href={a.href} className="flex min-h-11 items-center justify-between gap-md py-md hover:text-primary">
              <span className="flex min-w-0 flex-wrap items-center gap-sm">
                <span className="truncate font-medium">{a.name}</span>
                {a.isEstimate && <EstimateTag />}
                {a.excluded && (
                  <Tag variant="dashed" title={t.screen.excludedHint}>
                    {t.screen.excludedTag}
                  </Tag>
                )}
              </span>
              <span className={cx('shrink-0 tabular-nums', a.excluded && 'text-text-muted line-through')}>
                {formatMoney(a.balance)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
