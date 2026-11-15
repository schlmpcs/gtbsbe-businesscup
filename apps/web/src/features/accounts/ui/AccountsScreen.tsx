'use client';

// P2 Accounts (/accounts): net worth, its history, assets versus liabilities, the accounts by group and
// the add-account sheet. Presentational: every number comes from useAccounts / useAddAccount; the route
// passes its Link component and the import link.
import type { ComponentType, ReactNode } from 'react';
import { accounts as t, planner } from '@/copy';
import { Button, buttonClassName, cx, EstimateTag, formatMoney, formatRate, PageHeader, Tag } from '@/ui-kit';
import { CountUp, CYCLE, EmptyState, Initials, MOTION, Panel, Segmented, TONE_BG } from '@/ui-kit/reports';
import type { AccountGroupVM, AccountPeriod, AccountsVM, AddAccountVM, SummaryBarVM, SummaryMode } from '../model/types';
import { AddAccountSheet } from './AddAccountSheet';
import { BalanceChart } from './BalanceChart';

export type LinkComponent = ComponentType<{ href: string; className?: string; children?: ReactNode }>;

export type AccountsScreenProps = {
  vm: AccountsVM;
  addVm: AddAccountVM;
  links: { upload: string };
  Link: LinkComponent;
  /** Opens the demo bank link from the add sheet (the route renders its sheet). */
  onConnectBank?: () => void;
};

const PERIODS: AccountPeriod[] = ['1m', '3m', '1y', 'all'];
const MODES: SummaryMode[] = ['totals', 'percent'];
/** Segment colors, in the order the view-model sorts the groups (largest first). */
const SEGMENT = CYCLE.map((tone) => TONE_BG[tone]);

export function AccountsScreen({ vm, addVm, links, Link, onConnectBank }: AccountsScreenProps) {
  return (
    <main className="page flex flex-col gap-xl">
      <PageHeader
        title={t.title}
        intro={t.screen.intro}
        aside={
          vm.ready && !vm.isEmpty ? (
            <div className="flex flex-wrap gap-sm">
              <Button variant="ghost" onClick={() => vm.exportCsv()}>
                {t.exportCsv}
              </Button>
              <Button onClick={vm.add} data-testid="accounts-add">
                {t.add}
              </Button>
            </div>
          ) : undefined
        }
      />
      {!vm.ready ? (
        <div role="status" aria-live="polite" className="h-80 animate-pulse rounded-(--card-radius) bg-surface">
          <span className="sr-only">{t.screen.loading}</span>
        </div>
      ) : vm.isEmpty ? (
        <EmptyState
          data-testid="accounts-empty"
          art="empty-plot"
          title={t.screen.emptyTitle}
          body={t.screen.emptyBody}
          actions={
            <>
              <Button onClick={vm.add} data-testid="accounts-add">
                {t.add}
              </Button>
              <Link href={links.upload} className={buttonClassName({ variant: 'secondary' })}>
                {t.screen.importCta}
              </Link>
            </>
          }
        />
      ) : (
        <>
          <NetWorthCard vm={vm} />
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-xl lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section aria-labelledby="accounts-groups" className="flex min-w-0 flex-col gap-lg">
              <h2 id="accounts-groups" className="section-label">
                {t.screen.groupsTitle}
              </h2>
              {vm.groups.map((g, i) => (
                <GroupCard key={g.group} group={g} Link={Link} delay={120 + i * 50} />
              ))}
            </section>
            <SummaryCard vm={vm} />
          </div>
        </>
      )}
      <p className="text-xs text-text-muted">
        {t.screen.privacy} {planner.educational}
      </p>
      <AddAccountSheet open={vm.adding} vm={addVm} uploadHref={links.upload} Link={Link} onConnectBank={onConnectBank} />
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
    <section data-testid="accounts-networth" aria-labelledby="accounts-networth-title" className={cx('card card-pad flex flex-col gap-lg', MOTION.rise)}>
      <div className="flex flex-wrap items-end justify-between gap-md">
        <div className="flex min-w-0 flex-col gap-xs">
          <h2 id="accounts-networth-title" className="section-label">
            {t.screen.netWorth}
          </h2>
          <p className="font-display text-4xl font-extrabold leading-tight tabular-nums sm:text-display sm:leading-display" data-testid="accounts-networth-value">
            <CountUp value={vm.netWorth} format={(v) => formatMoney(v)} />
          </p>
          <Change value={vm.change1m} />
        </div>
        <Segmented
          legend={t.screen.periodLabel}
          name="accounts-period"
          value={vm.period}
          options={PERIODS.map((p) => ({ value: p, label: t.periods[p] }))}
          onChange={vm.setPeriod}
        />
      </div>
      <BalanceChart key={vm.period} points={vm.chart} label={t.screen.chartLabel} tooFew={t.screen.chartTooFew} height={220} />
    </section>
  );
}

function SummaryCard({ vm }: { vm: AccountsVM }) {
  const { assets, liabilities } = vm.summary;
  const percent = vm.summaryMode === 'percent';
  return (
    <Panel
      title={t.screen.summaryTitle}
      data-testid="accounts-summary"
      delay={80}
      className="lg:sticky lg:top-lg"
      action={
        <Segmented
          legend={t.screen.summaryModeLabel}
          name="accounts-summary-mode"
          value={vm.summaryMode}
          options={MODES.map((m) => ({ value: m, label: t.summaryModes[m] }))}
          onChange={vm.setSummaryMode}
        />
      }
    >
      <div className="flex flex-col gap-xl">
        <div className="flex flex-col gap-sm">
          <div aria-hidden="true" className="flex h-4 w-full gap-1 overflow-hidden rounded-full bg-surface-strong" title={t.screen.splitLabel}>
            {assets.share > 0 && (
              <span className="h-full" style={{ width: `${assets.share * 100}%` }}>
                <span className={cx('block h-full rounded-full bg-positive', MOTION.growX)} />
              </span>
            )}
            {liabilities.share > 0 && (
              <span className="h-full" style={{ width: `${liabilities.share * 100}%` }}>
                <span className={cx('block h-full origin-right rounded-full bg-negative transition-transform duration-700 ease-out starting:scale-x-0 motion-reduce:transition-none')} />
              </span>
            )}
          </div>
          <div className="flex justify-between gap-md text-sm">
            <span className="flex items-center gap-xs">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-positive" />
              {planner.assets} <span className="tabular-nums text-text-muted">{formatRate(assets.share, 0)}</span>
            </span>
            <span className="flex items-center gap-xs">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-negative" />
              {planner.liabilities} <span className="tabular-nums text-text-muted">{formatRate(liabilities.share, 0)}</span>
            </span>
          </div>
        </div>
        <SummaryBar bar={assets} title={planner.assets} percent={percent} />
        <SummaryBar bar={liabilities} title={planner.liabilities} percent={percent} />
      </div>
    </Panel>
  );
}

function SummaryBar({ bar, title, percent }: { bar: SummaryBarVM; title: string; percent: boolean }) {
  return (
    <div className="flex flex-col gap-sm" data-testid={`accounts-summary-${bar.kind}`}>
      <div className="flex items-baseline justify-between gap-md">
        <h3 className="font-bold">{title}</h3>
        <span className="font-bold tabular-nums">{percent ? formatRate(bar.share) : formatMoney(bar.total)}</span>
      </div>
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-surface-strong" aria-hidden="true">
        {bar.segments.map((s, i) => (
          <span key={s.group} className="h-full" style={{ width: `${s.share * 100}%` }}>
            <span className={cx('block h-full', SEGMENT[i % SEGMENT.length], MOTION.growX)} style={{ transitionDelay: `${i * 80}ms` }} />
          </span>
        ))}
      </div>
      <ul className="flex flex-col gap-xs text-sm">
        {bar.segments.map((s, i) => (
          <li key={s.group} className="flex items-center justify-between gap-md">
            <span className="flex min-w-0 items-center gap-sm">
              <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full', SEGMENT[i % SEGMENT.length])} />
              {planner.accountGroups[s.group]}
            </span>
            <span className="tabular-nums text-text-muted">{percent ? formatRate(s.share) : formatMoney(s.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GroupCard({ group, Link, delay }: { group: AccountGroupVM; Link: LinkComponent; delay: number }) {
  return (
    <section
      aria-label={planner.accountGroups[group.group]}
      className={cx('card overflow-hidden', MOTION.rise)}
      style={{ transitionDelay: `${delay}ms` }}
      data-testid={`accounts-group-${group.group}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-sm border-b border-border bg-surface-strong/50 px-lg py-md">
        <div className="flex min-w-0 flex-col">
          <h3 className="text-base font-bold">{planner.accountGroups[group.group]}</h3>
          <span className="text-xs text-text-muted">{t.screen.groupCount(group.accounts.length)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-bold tabular-nums">{formatMoney(group.total)}</span>
          {group.change1m !== null && <Change value={group.change1m} goodWhenDown={group.kind === 'liability'} className="text-xs" />}
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {group.accounts.map((a) => (
          <li key={a.id}>
            <Link href={a.href} className="flex min-h-14 items-center justify-between gap-md px-lg py-sm transition-colors hover:bg-surface-strong/40">
              <span className="flex min-w-0 items-center gap-md">
                <Initials name={a.name} size="sm" />
                <span className="flex min-w-0 flex-wrap items-center gap-sm">
                  <span className="truncate font-medium">{a.name}</span>
                  {a.isEstimate && <EstimateTag />}
                  {a.excluded && (
                    <Tag variant="dashed" title={t.screen.excludedHint}>
                      {t.screen.excludedTag}
                    </Tag>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className={cx('font-semibold tabular-nums', a.excluded && 'text-text-muted line-through')}>{formatMoney(a.balance)}</span>
                {a.change1m !== null && a.change1m !== 0 && (
                  <span className={cx('text-xs tabular-nums', (a.change1m > 0) !== (a.kind === 'liability') ? 'text-positive' : 'text-negative')}>
                    {formatMoney(a.change1m, { signed: true })}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
