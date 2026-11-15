'use client';

// S11 answer: the verdict card (pill, the answer in three words, the reason, a KPI strip that counts up,
// the with / without line over 10 years) and, collapsed, the other horizons and the cheapest way to pay.
// Every number comes from useAfford() (engine canAfford + affordComfort); nothing is computed here.
import { afford as t, forecast, workTime as wt } from '@/copy';
import type { ReactNode } from 'react';
import { Art, cx, EstimateTag, formatMoney, formatRate, Money, Tag } from '@/ui-kit';
import { CountUp, KpiStrip, type KpiItem } from '@/ui-kit/reports';
import { ToolLineChart } from '@/ui-kit/ToolLineChart';
import type { AffordResultVM, AffordRulesVM, AffordVM, PayWithChoice, VMError } from '../model/types';
import { Skeleton } from './controls';

const TIER_PILL: Record<AffordResultVM['tier'], string> = {
  comfortable: 'bg-positive text-on-primary',
  stretched: 'bg-warning text-ink',
  notYet: 'bg-negative text-on-primary',
};
const TIER_TEXT: Record<AffordResultVM['tier'], string> = {
  comfortable: 'text-positive',
  stretched: 'text-text',
  notYet: 'text-text',
};

/** "2.5" / "12": months of costs, one decimal under 10 (display rounding only). */
export function monthsText(n: number): string {
  if (n >= 24) return '24+';
  return n < 10 ? String(Math.round(n * 10) / 10) : String(Math.round(n));
}
const cushionText = (n: number | null) => (n === null ? t.result.kpis.cushionNone : t.result.kpis.cushionValue(monthsText(n)));
const loadText = (r: number | null) => (r === null ? t.result.kpis.noPay : formatRate(r, 0));

function failsOnText(failsOn: NonNullable<AffordResultVM['failsOn']>, rules: AffordRulesVM): string {
  switch (failsOn) {
    case 'cushion':
      return t.result.failsOn.cushion(t.result.cushionMonths(rules.cushionMonths));
    case 'debtLoad':
      return t.result.failsOn.debtLoad(formatRate(rules.debtLoadRed));
    case 'cardRevolves':
      return t.result.failsOn.cardRevolves;
  }
}

function errorText(error: VMError): string {
  return error.kind === 'notImplemented' ? t.result.errors.notImplemented : t.result.errors.other;
}

/** The reason under the answer; never blames the purchase for a plan that already breaks a rule. */
function Reason({ data, rules }: { data: AffordResultVM; rules: AffordRulesVM }) {
  const body = 'max-w-prose text-base text-text-muted sm:text-lg';
  const r = t.result.reasons;
  if (data.tier === 'comfortable')
    return <p className={body}>{r.comfortable(cushionText(data.cushion.after), loadText(data.debtLoad.after))}</p>;
  if (data.tier === 'stretched') {
    return (
      <p className={body}>
        {data.stretchedBy === 'debtLoad'
          ? r.stretchedDebt(loadText(data.debtLoad.after), formatRate(rules.debtLoadYellow, 0))
          : r.stretchedCushion(cushionText(data.cushion.after), t.result.kpis.cushionValue(String(rules.comfortableCushionMonths)))}
      </p>
    );
  }
  const reason = data.failsOn ? failsOnText(data.failsOn, rules) : null;
  if (data.verdict === 'wait') {
    return (
      <div className="flex flex-col gap-xs">
        <p className="text-lg font-semibold">{r.wait(data.waitMonths ?? 0)}</p>
        {data.baselineFails ? <p className={body}>{t.result.baseline.wait}</p> : reason && <p className={body}>{reason}</p>}
      </div>
    );
  }
  return data.baselineFails ? (
    <p className={body}>
      {t.result.baseline.no} {reason}
    </p>
  ) : (
    reason && <p className={body}>{reason}</p>
  );
}

/** The price in work time ("= 3 days of your work"), from take-home pay; tagged when pay is an estimate. */
function WorkTime({ data }: { data: AffordResultVM }) {
  const w = data.workTime;
  if (!w) return null;
  return (
    <p data-testid="afford-work-time" className="flex flex-wrap items-center gap-sm text-base font-semibold">
      <span>{wt.ofYourWork(w.unit, w.amount, w.per)}</span>
      {w.isEstimate && <EstimateTag />}
    </p>
  );
}

/** Who made the with / without numbers ("Rules-based estimate"): S10 may show another number from the AI model. */
function SourceLabel({ source, className }: { source: AffordResultVM['forecastSource']; className?: string }) {
  return (
    <Tag data-testid="afford-forecast-source" className={className}>
      {forecast.source[source]}
    </Tag>
  );
}

/** The goal effect in one sentence (only when a goal is set). */
function goalText(g: NonNullable<AffordResultVM['goalEffect']>): string {
  const target = formatMoney(g.target, { compact: true });
  if (g.reachYear === null || g.delayMonths === null) return t.result.goal.never(target);
  if (!g.onTime) return t.result.goal.late(target, g.reachYear, g.delayMonths);
  return g.delayMonths === 0 ? t.result.goal.sameTime(target, g.reachYear) : t.result.goal.later(target, g.reachYear, g.delayMonths);
}

function Kpis({ data }: { data: AffordResultVM }) {
  const k = t.result.kpis;
  const ten = data.horizons.find((h) => h.month === 120) ?? data.horizons.at(-1);
  const items: KpiItem[] = [
    {
      id: 'cushion',
      label: k.cushion,
      value: data.cushion.after === null ? k.cushionNone : <CountUp value={data.cushion.after} format={(v) => k.cushionValue(monthsText(v))} />,
      hint: data.cushion.before === null ? undefined : k.cushionNow(monthsText(data.cushion.before)),
      tone: data.tier === 'comfortable' ? 'positive' : data.stretchedBy === 'cushion' || data.failsOn === 'cushion' ? 'warning' : 'default',
    },
  ];
  if (ten) {
    items.push({
      id: 'netWorth',
      label: k.netWorth,
      value: <CountUp value={ten.with.mid} format={(v) => formatMoney(v)} />,
      hint: Math.abs(ten.deltaMid) < 1 ? k.netWorthSame : k.netWorthHint(formatMoney(ten.deltaMid, { signed: true })),
    });
  }
  items.push({
    id: 'debtLoad',
    label: k.debtLoad,
    value: loadText(data.debtLoad.after),
    hint: k.debtLoadNow(loadText(data.debtLoad.before)),
    tone: data.stretchedBy === 'debtLoad' || data.failsOn === 'debtLoad' ? 'warning' : 'default',
  });
  return <KpiStrip items={items} aria-label={k.label} data-testid="afford-kpis" className="shadow-none" />;
}

/** "It costs you about $43K of net worth in 10 years." */
function CostSentence({ data }: { data: AffordResultVM }) {
  const w = t.result.withVsWithout;
  const row = [...data.horizons].sort((a, b) => b.month - a.month)[0];
  if (!row) return null;
  const when = w.at[row.month]!;
  const diff = row.with.mid - row.without.mid;
  const sentence =
    Math.abs(diff) < 1
      ? w.same(when)
      : diff < 0
        ? w.costs(formatMoney(-diff, { compact: true }), when)
        : w.gains(formatMoney(diff, { compact: true }), when);
  return (
    <p data-testid="afford-cost" className="text-base font-semibold">
      {sentence}
    </p>
  );
}

/** How we decide: the rules behind the verdict and the tier. */
function HowWeDecide({ data, rules }: { data: AffordResultVM; rules: AffordRulesVM }) {
  return (
    <details className="text-sm text-text-muted">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium">{t.result.howTitle}</summary>
      <div className="flex flex-col gap-xs">
        <p>{t.result.how}</p>
        <p>{t.result.howTier(t.result.kpis.cushionValue(String(rules.comfortableCushionMonths)), formatRate(rules.debtLoadYellow, 0))}</p>
        {data.verdict === 'wait' && data.waitMonths !== null && <p>{t.result.waitBody(data.waitMonths)}</p>}
        <p>{t.result.cheapestHint}</p>
        {data.workTime && <p>{wt.hint(data.workTime.hoursPerWeek)}</p>}
      </div>
    </details>
  );
}

function Horizons({ data }: { data: AffordResultVM }) {
  const h = t.result.horizonHeaders;
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{t.result.horizonsCaption}</caption>
      <thead>
        <tr className="text-left text-xs text-text-muted">
          <th scope="col" className="py-xs pr-sm font-medium">{h.when}</th>
          <th scope="col" className="py-xs pr-sm text-right font-medium">{h.with}</th>
          <th scope="col" className="py-xs pr-sm text-right font-medium">{h.without}</th>
          <th scope="col" className="py-xs text-right font-medium">{h.delta}</th>
        </tr>
      </thead>
      <tbody>
        {data.horizons.map((row) => (
          <tr key={row.month} className="border-t border-border">
            <th scope="row" className="py-sm pr-sm text-left font-normal">{t.result.horizons[row.month]}</th>
            <td className="py-sm pr-sm text-right tabular-nums"><Money value={row.with.mid} compact /></td>
            <td className="py-sm pr-sm text-right tabular-nums"><Money value={row.without.mid} compact /></td>
            <td className={cx('py-sm text-right font-semibold tabular-nums', row.deltaMid < 0 ? 'text-negative' : 'text-text')}>
              <Money value={row.deltaMid} compact signed />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Collapsed: the other horizons and the cheapest way to pay. */
function Details({ data, chosenWay }: { data: AffordResultVM; chosenWay: PayWithChoice }) {
  const note = !data.cheapestWayFits ? t.result.cheapestNoneNote : data.cheapestWay === chosenWay ? t.result.cheapestSame : t.result.cheapestDifferent;
  return (
    <details className="group card card-pad">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-md font-semibold">
        <span>{t.result.detailsTitle}</span>
        <span aria-hidden="true" className="text-text-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div data-testid="afford-horizons" className="mt-md flex flex-col gap-lg">
        {data.horizons.length > 0 && <Horizons data={data} />}
        <SourceLabel source={data.forecastSource} />
        <dl className="flex flex-col gap-xs rounded-lg bg-bg p-md">
          <dt className="text-sm text-text-muted">{t.result.cheapestTitle}</dt>
          <dd className="font-display text-2xl font-extrabold">{data.cheapestWayFits ? t.result.cheapestWays[data.cheapestWay] : t.result.cheapestNone}</dd>
          <dd className="text-xs font-semibold text-primary">{note}</dd>
        </dl>
      </div>
    </details>
  );
}

export type AffordResultPanelProps = {
  result: AffordVM['result'];
  rules: AffordRulesVM;
  invalidFields: string[];
  /** The purchase name for the chart legend. */
  purchaseLabel: string;
  chosenWay: PayWithChoice;
};

function EmptyAnswer({ children }: { children: ReactNode }) {
  return (
    <section aria-label={t.result.title} className="card card-pad flex flex-col items-center gap-md py-2xl text-center">
      <Art name="afford-crane" className="w-32" />
      {children}
    </section>
  );
}

/** The answer: verdict card, then the details. */
export function AffordVerdictTile({ result, rules, invalidFields, chosenWay, purchaseLabel }: AffordResultPanelProps) {
  if (result === null) {
    return (
      <EmptyAnswer>
        <p className="font-display text-2xl font-extrabold leading-tight">{invalidFields.length > 0 ? t.form.fixFields : t.form.empty}</p>
      </EmptyAnswer>
    );
  }
  if (result.status === 'loading') {
    return (
      <EmptyAnswer>
        <div className="w-full">
          <Skeleton label={t.result.loading} />
        </div>
      </EmptyAnswer>
    );
  }
  if (result.status === 'error') {
    return (
      <EmptyAnswer>
        <p role="alert" className="text-lg">
          {errorText(result.error)}
        </p>
      </EmptyAnswer>
    );
  }

  const data = result.data;
  return (
    <div className="flex flex-col gap-lg">
      <section aria-label={t.result.title} aria-live="polite" className="card card-pad flex min-w-0 flex-col gap-lg">
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <span data-testid="afford-tier-pill" className={cx('rounded-full px-md py-xs text-sm font-bold', TIER_PILL[data.tier])}>
            {t.result.tierPills[data.tier]}
          </span>
          <WorkTime data={data} />
        </div>
        <p
          data-testid="afford-verdict"
          data-verdict={data.verdict}
          data-tier={data.tier}
          className={cx('font-display text-4xl font-extrabold leading-display tracking-tight sm:text-5xl', TIER_TEXT[data.tier])}
        >
          {t.result.tiers[data.tier]}
        </p>
        <Reason data={data} rules={rules} />
        {data.verdict === 'fits' && data.baselineFails && (
          <p role="note" className="rounded-lg bg-bg p-md text-sm">
            {t.result.baseline.fits}
          </p>
        )}
        <Kpis data={data} />
        <AffordChart data={data} purchaseLabel={purchaseLabel} />
        {data.goalEffect && (
          <p data-testid="afford-goal-effect" className="text-base">
            {goalText(data.goalEffect)}
          </p>
        )}
        <HowWeDecide data={data} rules={rules} />
      </section>
      <Details data={data} chosenWay={chosenWay} />
    </div>
  );
}

/** Net worth with vs without over 10 years (rules engine, labeled), and the cost in words. */
function AffordChart({ data, purchaseLabel }: { data: AffordResultVM; purchaseLabel: string }) {
  const c = t.result.chart;
  const last = data.chart.at(-1);
  return (
    <div data-testid="afford-chart" className="flex flex-col gap-sm">
      <ToolLineChart
        title={t.result.chartTitle(purchaseLabel)}
        summary={last ? c.summary(formatMoney(last.with), formatMoney(last.without)) : ''}
        series={[
          { id: 'without', label: t.result.chartWithout, tone: 'ink', dashed: true, points: data.chart.map((p) => ({ x: p.year, y: p.without })) },
          { id: 'with', label: t.result.chartWith(purchaseLabel), tone: 'primary', area: true, points: data.chart.map((p) => ({ x: p.year, y: p.with })) },
        ]}
        xTicks={[0, 2, 4, 6, 8, 10]}
        formatX={c.tick}
        formatY={(v) => formatMoney(v, { compact: true })}
      />
      <CostSentence data={data} />
      <div className="flex flex-wrap items-center gap-sm">
        <SourceLabel source={data.forecastSource} />
        <span className="text-xs text-text-muted">{c.note}</span>
      </div>
    </div>
  );
}

export function AffordResultPanel(props: AffordResultPanelProps) {
  return <AffordVerdictTile {...props} />;
}
