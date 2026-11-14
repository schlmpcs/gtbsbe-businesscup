'use client';

// S14 Monthly check-in. Presentational: every number comes from useCheckin() (engine simulateMonth,
// checkinRecord, checkinSummary, goalStatus, forecast). Layout follows the S14 design preview.
import type { ReactNode } from 'react';
import { checkin as t, common, forecast } from '@/copy';
import { Button, buttonClassName, Card, cx, formatMoney, formatMonth, formatRate, LockNotice, Money } from '@/ui-kit';
import type {
  CheckinGoalVM, CheckinHistoryRowVM, CheckinMonthVM, CheckinMoveVM, CheckinNumberVM, CheckinRow, CheckinValueVM, CheckinVM,
} from '../model/types';

type LinkComponent = (props: { href: string; className?: string; children?: ReactNode }) => ReactNode;

type PillTone = 'ink' | 'outline' | 'positive' | 'muted';
const PILL: Record<PillTone, string> = {
  ink: 'bg-ink text-on-primary',
  outline: 'border border-dashed border-text-muted text-text-muted',
  positive: 'bg-positive-soft text-positive',
  muted: 'bg-surface-strong text-text-muted',
};

/** A small sentence-case pill. */
function Pill({ children, tone = 'ink' }: { children: ReactNode; tone?: PillTone }) {
  return <span className={cx('inline-flex w-fit items-center gap-xs rounded-full px-md py-xs text-xs font-bold', PILL[tone])}>{children}</span>;
}

function ProgressBar({ share, label }: { share: number; label: string }) {
  const pct = Math.min(100, Math.max(0, share * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={formatRate(share, 0)}
      className="h-md w-full overflow-hidden rounded-full bg-surface-strong"
    >
      <div className="h-full rounded-full bg-positive" style={{ width: `${pct}%` }} />
    </div>
  );
}

const monthName = (yyyyMm: string) => formatMonth(yyyyMm);

/** Over the forecast is neutral gray (never red); under is green. */
function Delta({ forecast: f, actual }: { forecast: number; actual: number }) {
  const d = actual - f;
  if (Math.abs(d) < 0.5) return <span className="text-text-muted">{t.compare.even}</span>;
  return d > 0 ? (
    <span className="text-text-muted">{t.compare.over(formatMoney(d))}</span>
  ) : (
    <span className="font-semibold text-positive">{t.compare.under(formatMoney(-d))}</span>
  );
}

function CompareBars({ month }: { month: CheckinMonthVM }) {
  const max = Math.max(1, ...month.rows.flatMap((r: CheckinRow) => [r.forecast, r.actual]));
  const w = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
  return (
    <Card title={t.compare.title} data-testid="checkin-compare">
      <div className="mb-md flex flex-wrap gap-lg text-xs text-text-muted" aria-hidden="true">
        <span className="flex items-center gap-xs">
          <span className="inline-block size-md rounded-full bg-chart-6" /> {t.compare.forecast}
        </span>
        <span className="flex items-center gap-xs">
          <span className="inline-block size-md rounded-full bg-primary" /> {t.compare.actual}
        </span>
      </div>
      <ul aria-label={t.compare.label(monthName(month.month))} className="flex flex-col gap-lg">
        {month.rows.map((r) => (
          <li key={r.category} className="flex flex-col gap-xs">
            <div className="flex flex-wrap items-baseline justify-between gap-x-md text-sm">
              <span className="font-semibold">{common.categories[r.category]}</span>
              <span className="tabular-nums">
                <Money value={r.actual} /> <span className="text-text-muted">/ {formatMoney(r.forecast)}</span>
              </span>
            </div>
            <div aria-hidden="true" className="flex flex-col gap-[2px]">
              <div className="h-sm rounded-full bg-chart-6" style={{ width: w(r.forecast) }} />
              <div className="h-sm rounded-full bg-primary" style={{ width: w(r.actual) }} />
            </div>
            <span className="text-xs">
              <Delta forecast={r.forecast} actual={r.actual} />
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-lg flex flex-wrap items-baseline justify-between gap-md border-t border-border pt-md">
        <span className="text-sm font-medium">{t.compare.total}</span>
        <span className="flex flex-col items-end">
          <span className="text-lg font-semibold tabular-nums" data-testid="checkin-total">
            <Money value={month.actualTotal} /> <span className="text-sm text-text-muted">/ {formatMoney(month.forecastTotal)}</span>
          </span>
          <span className="text-xs">
            <Delta forecast={month.forecastTotal} actual={month.actualTotal} />
          </span>
        </span>
      </div>
    </Card>
  );
}

function NumberCard({ n }: { n: CheckinNumberVM }) {
  const change = Math.round(n.change10y);
  return (
    <Card title={t.number.title} data-testid="checkin-number" action={<Pill tone="muted">{t.number.source}</Pill>}>
      <div className="grid grid-cols-2 gap-lg">
        <div className="flex min-w-0 flex-col gap-xs">
          <span className="text-sm text-text-muted">{t.number.today}</span>
          <span className="font-display text-2xl font-extrabold leading-tight tabular-nums sm:text-3xl">
            <Money value={n.today} />
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-xs">
          <span className="text-sm text-text-muted">{t.number.inYear(n.horizonYear)}</span>
          <span className="font-display text-2xl font-extrabold leading-tight tabular-nums sm:text-3xl" data-testid="checkin-number-10y">
            <Money value={n.in10y} />
          </span>
          {n.isEstimate && (
            <span className="text-xs text-text-muted tabular-nums">{t.number.range(formatMoney(n.low), formatMoney(n.high))}</span>
          )}
        </div>
      </div>
      <p className="mt-md text-sm font-semibold tabular-nums" data-testid="checkin-number-change">
        {!n.hasChange ? (
          <span className="font-normal text-text-muted">{t.number.before}</span>
        ) : change > 0 ? (
          <span className="text-positive">{t.number.up(formatMoney(change, { signed: true }))}</span>
        ) : change < 0 ? (
          <span className="text-text-muted">{t.number.down(formatMoney(change, { signed: true }))}</span>
        ) : (
          <span className="text-text-muted">{t.number.even}</span>
        )}
      </p>
      <p className="mt-xs text-xs text-text-muted">{t.number.explain}</p>
    </Card>
  );
}

function moveName(move: CheckinMoveVM): string {
  return forecast.moves.title(move.kind, move.category ? common.categories[move.category] : undefined);
}

function MoveCard({ move, futureHref, Link }: { move: CheckinMoveVM | null; futureHref: string; Link: LinkComponent }) {
  if (!move) {
    return (
      <Card title={t.move.title} data-testid="checkin-move" className="flex flex-col">
        <p className="text-sm text-text-muted">{t.move.none}</p>
        <Link href={futureHref} className={cx(buttonClassName({ variant: 'secondary', size: 'sm' }), 'mt-md self-start')}>
          {t.move.pick}
        </Link>
      </Card>
    );
  }
  const name = moveName(move);
  const p = move.progress;
  return (
    <Card title={t.move.title} data-testid="checkin-move" className="flex flex-col">
      <div className="flex flex-col gap-sm">
        <p className="text-lg font-bold">{name}</p>
        {p === null ? (
          <p className="text-sm text-text-muted">{t.move.before}</p>
        ) : p.kind === 'debtPayoff' ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-md">
              <span className="font-semibold tabular-nums">{t.move.paid(formatMoney(p.paid), formatMoney(p.startBalance))}</span>
              <span className="font-display text-2xl font-extrabold text-positive tabular-nums">{formatRate(p.share, 0)}</span>
            </div>
            <ProgressBar share={p.share} label={t.move.progressLabel(t.move.debtKinds[move.debtKind ?? 'card'] ?? name)} />
            <p className="text-sm text-text-muted">{t.move.payoff(p.payoffMonths)}</p>
          </>
        ) : (
          <>
            <p className="text-sm tabular-nums">{t.move.target(formatMoney(p.target), formatMoney(p.actual))}</p>
            <Pill tone={p.onTrack ? 'positive' : 'muted'}>{p.onTrack ? t.move.onTarget : t.move.overTarget}</Pill>
          </>
        )}
      </div>
    </Card>
  );
}

function GoalCard({ goal, futureHref, Link }: { goal: CheckinGoalVM | null; futureHref: string; Link: LinkComponent }) {
  if (!goal) {
    return (
      <Card title={t.goal.title} data-testid="checkin-goal" className="flex flex-col">
        <p className="text-sm text-text-muted">{t.goal.none}</p>
        <Link href={futureHref} className={cx(buttonClassName({ variant: 'secondary', size: 'sm' }), 'mt-md self-start')}>
          {t.goal.set}
        </Link>
      </Card>
    );
  }
  const tone: PillTone = goal.verdict === 'onTrack' ? 'positive' : 'muted';
  return (
    <Card title={t.goal.title} data-testid="checkin-goal" action={<Pill tone={tone}>{t.goal.verdicts[goal.verdict]}</Pill>}>
      <div className="flex flex-col gap-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-md">
          <span className="font-semibold tabular-nums">{t.goal.of(formatMoney(goal.projected), formatMoney(goal.target), goal.year)}</span>
          <span className="font-display text-2xl font-extrabold text-positive tabular-nums">{formatRate(goal.progress, 0)}</span>
        </div>
        <ProgressBar share={goal.progress} label={t.goal.progressLabel} />
        <p className="text-sm text-text-muted tabular-nums">
          {goal.gap > 0 ? t.goal.short(formatMoney(goal.gap)) : t.goal.reached(formatMoney(-goal.gap))}
        </p>
      </div>
    </Card>
  );
}

function ValueCard({ value, year }: { value: CheckinValueVM; year: number }) {
  return (
    <Card tone="arena" data-testid="checkin-value" className="flex flex-col gap-sm">
      <h2 className="text-xl font-bold leading-tight">{t.value.title}</h2>
      <ul className="flex flex-col gap-xs font-display text-2xl font-extrabold leading-tight tabular-nums sm:text-3xl">
        <li>{t.value.paidDown(formatMoney(value.debtPaidDown))}</li>
        <li>{t.value.vsForecast(formatMoney(value.vsForecast, { signed: true }))}</li>
        <li>{t.value.numberChange(formatMoney(value.numberChange, { signed: true }), year)}</li>
      </ul>
      <p className="text-sm text-text-muted">{t.value.hint(value.checkins)}</p>
    </Card>
  );
}

function History({ rows, year }: { rows: CheckinHistoryRowVM[]; year: number }) {
  return (
    <Card title={t.history.title} data-testid="checkin-history">
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">{t.history.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((r) => (
            <li key={r.month} className="flex flex-wrap items-baseline justify-between gap-x-md gap-y-xs py-sm" data-testid="checkin-history-row">
              <span className="font-semibold">{monthName(r.month)}</span>
              <span className="flex flex-col items-end tabular-nums">
                <span className="font-semibold">
                  <span className="sr-only">{t.history.number(year)}: </span>
                  <Money value={r.number10y} />
                </span>
                <span className={cx('text-xs', Math.round(r.change) > 0 ? 'text-positive' : 'text-text-muted')}>
                  {t.history.change(formatMoney(r.change, { signed: true }))}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function CheckinScreen({ vm, Link }: { vm: CheckinVM; Link: LinkComponent }) {
  const ready = vm.status === 'ready';
  const month = vm.current;
  const locked = vm.pro.known && !vm.pro.isPro;
  const number = vm.number.status === 'ready' ? vm.number.data : null;
  const horizonYear = number?.horizonYear ?? Number(vm.nextMonth.slice(0, 4)) + 10;
  return (
    <main className="mx-auto flex w-full max-w-(--container-4xl) flex-col gap-xl px-lg py-xl">
      <header className="flex min-w-0 flex-col gap-md">
        <Pill>{t.eyebrow(monthName(month?.month ?? vm.nextMonth))}</Pill>
        <h1 className="text-4xl leading-display sm:text-display">{t.title}</h1>
        <p className="max-w-prose text-lg text-text-muted">{t.intro}</p>
      </header>

      {!ready ? (
        <p role="status" className="text-text-muted">
          {t.loading}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-sm">
            <Button size="lg" onClick={vm.fastForward} disabled={!vm.canFastForward} className="w-full sm:w-fit">
              {t.fastForward}
            </Button>
            <p className="text-sm text-text-muted">
              {vm.canFastForward ? t.fastForwardHint : vm.pro.isPro ? t.saveFirst : t.freeOnce}
            </p>
          </div>

          {month ? (
            <>
              <div className="flex flex-wrap items-center gap-sm" data-testid="simulated-month">
                <Pill>{monthName(month.month)}</Pill>
                <Pill tone="outline">{t.simulatedTag}</Pill>
                {month.saved && <Pill tone="positive">{t.savedTag}</Pill>}
              </div>
              <CompareBars month={month} />
            </>
          ) : (
            <Card tone="muted" className="flex flex-col gap-xs border-2 border-dashed border-border" data-testid="checkin-empty">
              <h2 className="text-xl font-bold leading-tight">{t.emptyTitle}</h2>
              <p className="text-sm text-text-muted">{t.emptyBody(monthName(vm.nextMonth))}</p>
            </Card>
          )}

          {vm.number.status === 'error' ? (
            <p role="alert" className="text-sm text-text-muted">
              {t.error}
            </p>
          ) : number ? (
            <NumberCard n={number} />
          ) : null}

          <div className={cx('grid grid-cols-1 gap-xl', vm.pro.isPro && 'sm:grid-cols-2')}>
            <MoveCard move={vm.move} futureHref={vm.futureHref} Link={Link} />
            {vm.pro.isPro && vm.goal.status === 'ready' && <GoalCard goal={vm.goal.data} futureHref={vm.futureHref} Link={Link} />}
          </div>

          {vm.value && <ValueCard value={vm.value} year={horizonYear} />}

          {locked ? (
            <LockNotice
              title={t.paywall.title}
              body={t.paywall.body}
              ctaLabel={t.paywall.cta}
              href={vm.pro.href}
              headingLevel={2}
              className="border-2 border-primary shadow-md"
            />
          ) : vm.pro.isPro ? (
            <>
              <Button size="lg" variant="dark" onClick={vm.save} disabled={!vm.canSave} className="w-full sm:w-fit">
                {t.save}
              </Button>
              <History rows={vm.history} year={horizonYear} />
            </>
          ) : null}

          <div className="flex flex-col gap-xs">
            <Button size="lg" variant="secondary" onClick={vm.downloadCalendar} className="w-full sm:w-fit">
              {t.calendar.button}
            </Button>
            <p className="text-sm text-text-muted">{t.calendar.hint}</p>
          </div>

          <p role="status" className="min-h-lg text-sm text-text-muted">
            {vm.justSaved ? t.saved(monthName(vm.justSaved)) : null}
          </p>
        </>
      )}
    </main>
  );
}
