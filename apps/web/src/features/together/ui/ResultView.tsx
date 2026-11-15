// The household view: the month in a KPI strip, "How do we split it?" as an animated split bar (by
// income or 50/50), "Us in 10 years" as a line from the engine's forecast, and the shared goal.
// Presentational: every number arrives computed in TogetherResultVM; the split mode is the VM's.
import { goal as goalCopy, together as t } from '@/copy';
import { EstimateTag, ForecastChart, Money, Sticker, Tag, cx, formatMoney, formatRate } from '@/ui-kit';
import { CountUp, KpiStrip, Meter, Panel, Segmented } from '@/ui-kit/reports';
import type { SplitMode, TogetherResultVM } from '../model/types';

const money = (v: number) => formatMoney(v);

export type ResultViewProps = {
  result: TogetherResultVM;
  names: { p1: string | null; p2: string | null };
  splitMode: SplitMode;
  onSplitMode: (mode: SplitMode) => void;
};

function SplitBar({ a, b, share, p1, p2 }: { a: string; b: string; share: number; p1: number; p2: number }) {
  const left = `${Math.min(100, Math.max(0, share * 100))}%`;
  return (
    <div className="flex flex-col gap-sm" data-testid="together-split-bar">
      <div aria-hidden="true" className="flex h-12 w-full overflow-hidden rounded-lg bg-surface-strong">
        <div
          className="flex h-full min-w-0 items-center justify-start bg-chart-1 px-md text-sm font-bold text-on-primary transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: left }}
        >
          <span className="truncate tabular-nums">{formatMoney(p1)}</span>
        </div>
        <div className="flex h-full min-w-0 flex-1 items-center justify-end bg-chart-2 px-md text-sm font-bold text-on-primary">
          <span className="truncate tabular-nums">{formatMoney(p2)}</span>
        </div>
      </div>
      <div className="flex justify-between gap-md text-sm">
        <span className="inline-flex min-w-0 items-center gap-xs">
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-chart-1" />
          <span className="truncate">{t.result.splitSide(a, formatRate(share, 0))}</span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-xs">
          <span className="truncate">{t.result.splitSide(b, formatRate(1 - share, 0))}</span>
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-chart-2" />
        </span>
      </div>
    </div>
  );
}

export function ResultView({ result, names, splitMode, onSplitMode }: ResultViewProps) {
  const a = t.label(names.p1, 1);
  const b = t.label(names.p2, 2);
  const { month, split, future, goal } = result;
  const short = month.surplus < 0;
  // With no take-home pay entered for either, "by income" is already 50/50.
  const mode: SplitMode = split.basis === 'even' ? 'even' : splitMode;
  const shown = split.modes[mode];
  return (
    <div className="flex flex-col gap-lg" data-testid="together-result">
      <section data-testid="together-month" aria-label={t.result.kpis} className="flex flex-col gap-sm">
        <KpiStrip
          items={[
            { id: 'takeHome', label: t.result.takeHome, value: <CountUp value={month.takeHome} format={money} />, dot: 'positive' },
            {
              id: 'spending',
              label: t.result.spending,
              value: <CountUp value={month.spending + month.debtPayments} format={money} />,
              hint: `${t.result.debtPayments}: ${formatMoney(month.debtPayments)}`,
            },
            {
              id: 'surplus',
              label: short ? t.result.shortfall : t.result.surplus,
              value: <CountUp value={Math.abs(month.surplus)} format={money} />,
              tone: short ? 'negative' : 'positive',
            },
          ]}
        />
        <ul className="flex flex-col gap-xs px-xs text-sm text-text-muted">
          {result.partners.map((p, i) => (
            <li key={i}>{t.plan.partnerTotals(t.label(p.label, i === 0 ? 1 : 2), formatMoney(p.takeHome), formatMoney(p.spending + p.debtPayments))}</li>
          ))}
        </ul>
      </section>

      <Panel
        title={t.result.splitTitle}
        subtitle={mode === 'even' ? t.result.splitLeadEven : t.result.splitLead}
        data-testid="together-split"
        action={
          split.basis === 'income' ? (
            <Segmented
              legend={t.result.splitModes.legend}
              name="together-split-mode"
              value={mode}
              options={[
                { value: 'income', label: t.result.splitModes.income },
                { value: 'even', label: t.result.splitModes.even },
              ]}
              onChange={onSplitMode}
            />
          ) : undefined
        }
      >
        <div className="flex flex-col gap-lg">
          <p className="font-display text-2xl font-extrabold leading-tight sm:text-3xl" data-testid="together-split-line" aria-live="polite">
            {t.result.splitLine(a, formatMoney(shown.p1), b, formatMoney(shown.p2))}
          </p>
          <SplitBar a={a} b={b} share={shown.p1Share} p1={shown.p1} p2={shown.p2} />
          {split.basis === 'even' && <p className="text-sm">{t.result.splitEvenBasis}</p>}
          <dl className="grid gap-md rounded-lg bg-bg p-md text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-xs">
              <dt className="flex flex-wrap items-center gap-xs text-text-muted">
                {t.result.sharedTotal}
                {split.isEstimate && <EstimateTag />}
              </dt>
              <dd className="font-display text-xl font-extrabold tabular-nums"><Money value={split.total} /></dd>
            </div>
            {split.basis === 'income' && (
              <div className="flex flex-col gap-xs">
                <dt className="text-text-muted">{mode === 'income' ? t.result.evenTitle : t.result.byIncomeTitle}</dt>
                <dd className="font-display text-xl font-extrabold tabular-nums">
                  {mode === 'income'
                    ? t.result.evenLine(formatMoney(split.evenEach))
                    : t.result.byIncomeLine(a, formatMoney(split.p1), b, formatMoney(split.p2))}
                </dd>
              </div>
            )}
          </dl>
          {split.basis === 'income' && (
            <p className="text-sm text-text-muted">{t.result.splitShare(a, formatRate(split.p1Share, 0))}</p>
          )}
          {split.basis === 'income' && Math.round(split.p1VsEven) !== 0 && (
            <p className="text-sm" data-testid="together-vs-even">
              {t.result.vsEven(a, formatMoney(Math.abs(split.p1VsEven)), split.p1VsEven > 0)}
            </p>
          )}
        </div>
      </Panel>

      <Panel
        title={t.result.futureTitle}
        subtitle={t.result.futureLead}
        data-testid="together-future"
        action={
          <Tag variant="dashed" title={t.result.rulesWhy}>
            {t.result.rulesTag}
            <span className="sr-only">: {t.result.rulesWhy}</span>
          </Tag>
        }
      >
        <div className="flex flex-col gap-lg">
          <div className="grid grid-cols-2 gap-md">
            <div className="flex flex-col gap-xs">
              <span className="section-label">{t.result.futureToday}</span>
              <span className="font-display text-2xl font-extrabold tabular-nums sm:text-3xl"><Money value={future.today} /></span>
            </div>
            <div className="flex flex-col gap-xs">
              <span className="section-label">{t.result.futureMid}</span>
              <span className={cx('font-display text-2xl font-extrabold tabular-nums sm:text-3xl', future.mid >= future.today ? 'text-positive' : 'text-negative')}>
                <CountUp value={future.mid} format={money} />
              </span>
            </div>
          </div>
          <ForecastChart
            title={t.result.futureChart}
            hideTitle
            series={{ label: t.result.futureLine, points: future.points }}
            showBand={future.isEstimate}
            footnote={t.result.futureFootnote}
          />
          {future.isEstimate && <p className="text-sm">{t.result.futureRange(formatMoney(future.low), formatMoney(future.high))}</p>}
        </div>
      </Panel>

      <Panel title={t.result.goalTitle} data-testid="together-goal">
        {goal ? (
          <div className="flex flex-col gap-md">
            <div className="flex flex-wrap items-center gap-md">
              <p className="text-lg font-semibold">{t.result.goalLine(formatMoney(goal.target), goal.years)}</p>
              <Sticker tone={goal.verdict === 'onTrack' ? 'positive' : goal.verdict === 'behind' ? 'ink' : 'soft'}>
                {goalCopy.verdictLabel[goal.verdict]}
              </Sticker>
            </div>
            <Meter value={goal.progress} tone={goal.verdict === 'onTrack' ? 'positive' : 'primary'} size="md" />
            <p className="text-sm text-text-muted">{goalCopy.verdict[goal.verdict]}</p>
            <dl className="grid grid-cols-2 gap-md text-sm">
              <div className="flex flex-col gap-xs">
                <dt className="text-text-muted">{t.result.goalProjected}</dt>
                <dd className="font-display text-xl font-extrabold tabular-nums"><Money value={goal.projectedMid} /></dd>
              </div>
              {goal.gap > 0 && (
                <div className="flex flex-col gap-xs">
                  <dt className="text-text-muted">{t.result.goalGap}</dt>
                  <dd className="font-display text-xl font-extrabold tabular-nums"><Money value={goal.gap} /></dd>
                </div>
              )}
            </dl>
          </div>
        ) : (
          <p className="text-sm text-text-muted">{t.result.goalNone}</p>
        )}
      </Panel>

      <p className="text-xs text-text-muted">{t.result.disclaimer}</p>
    </div>
  );
}
