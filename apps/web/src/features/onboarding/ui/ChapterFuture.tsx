// Chapter 4, "Where it takes you.": the plan line to age 90 drawing in (the /plan view-model's chart
// points, scaled to the box here, never computed), the KPI strip, Chance of success as a ring gauge
// (the engine's Monte Carlo, run when the chapter opens), then "Your next move": the top 3 Next Moves
// ranked in dollars. Final CTAs: open the dashboard, or see the plan. Savings & debts is an optional
// "Make it exact" detour, not a step.
import type { CSSProperties, ReactNode } from 'react';
import { onboarding } from '@/copy';
import { Art, buttonClassName, cx, Tag } from '@/ui-kit';
import type { ChanceOfSuccessVM, PlanChartPoint, PlanMovesVM, PlanVM } from '../model/types';
import { Count } from './Count';
import type { StoryLink } from './StoryFrame';

const t = onboarding.future;

export type ChapterFutureProps = {
  plan: PlanVM;
  chance: ChanceOfSuccessVM;
  moves: PlanMovesVM;
  Link: StoryLink;
  links: { dashboard: string; plan: string; exact: string };
};

export function ChapterFuture({ plan, chance, moves, Link, links }: ChapterFutureProps) {
  return (
    <div className="flex flex-col gap-xl" data-testid="future">
      <p className="text-lg text-text-muted">{t.lead}</p>

      {plan.status === 'ready' && (
        <section aria-label={t.chartLabel} className="ob-enter flex flex-col gap-md rounded-xl bg-surface p-lg shadow-md sm:p-xl">
          <div className="flex flex-wrap items-center justify-between gap-sm">
            <h2 className="font-display text-2xl font-extrabold">{t.chartLabel}</h2>
            <Tag className="bg-bg">{t.rulesTag}</Tag>
          </div>
          <dl className="grid grid-cols-2 gap-md sm:grid-cols-4">
            {plan.kpis.map((k, i) => (
              <div key={k.id} className="ob-enter flex min-w-0 flex-col gap-xs" style={{ '--ob-delay': `${300 + i * 90}ms` } as CSSProperties}>
                <dt className="truncate text-xs font-semibold uppercase tracking-wide text-text-muted">{k.label}</dt>
                <dd className={cx('font-display text-xl font-extrabold tabular-nums sm:text-2xl', k.tone === 'bad' && 'text-negative')} data-kpi={k.id}>
                  {k.value}
                </dd>
              </div>
            ))}
          </dl>
          <PlanLine points={plan.chart.points} retireYear={plan.chart.retireYear} />
        </section>
      )}

      <div className="grid gap-xl lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <ChanceCard vm={chance} />
        <section aria-labelledby="story-moves" className="ob-enter flex flex-col gap-md rounded-xl bg-surface p-lg shadow-md sm:p-xl" style={{ '--ob-delay': '200ms' } as CSSProperties}>
          <h2 id="story-moves" className="font-display text-2xl font-extrabold">
            {t.movesTitle}
          </h2>
          <p className="text-sm text-text-muted">{t.movesLead}</p>
          {moves.moves.length === 0 ? (
            <p className="text-sm">{t.noMoves}</p>
          ) : (
            <ol className="flex flex-col gap-sm" data-testid="story-moves">
              {moves.moves.slice(0, 3).map((m, i) => (
                <li
                  key={m.id}
                  className="ob-enter flex items-center gap-md rounded-lg bg-bg p-md"
                  style={{ '--ob-delay': `${400 + i * 120}ms` } as CSSProperties}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink font-display font-extrabold text-on-primary">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-base font-semibold">{m.title}</span>
                  <span className={cx('shrink-0 font-display text-lg font-extrabold tabular-nums', m.tone === 'good' ? 'text-positive' : 'text-negative')}>
                    {m.effectAtRetirement}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <aside className="flex flex-col items-start gap-sm rounded-xl border-2 border-dashed border-border p-lg sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-xs">
          <h2 className="text-lg font-bold">{t.exactTitle}</h2>
          <p className="text-sm text-text-muted">{t.exactBody}</p>
        </div>
        <Link href={links.exact} className="min-h-11 shrink-0 content-center text-base font-semibold hover:text-primary">
          {t.exactLink}
        </Link>
      </aside>

      <div className="flex flex-col-reverse items-stretch gap-md sm:flex-row sm:items-center sm:justify-end">
        <Link href={links.plan} className={cx(buttonClassName({ variant: 'secondary', size: 'lg' }), 'ob-press text-center')}>
          {t.plan}
        </Link>
        <Link href={links.dashboard} className={cx(buttonClassName({ size: 'lg' }), 'ob-press text-center')}>
          {t.dashboard}
        </Link>
      </div>
      <Art name="house-build" className="ob-build mx-auto w-2/3 max-w-(--container-xs)" />
    </div>
  );
}

// ----- The plan line ----------------------------------------------------------------------------

const W = 640;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 12 };

/** The plan's net worth by age as a line that draws in; the zero line and the ages along the bottom. */
function PlanLine({ points, retireYear }: { points: PlanChartPoint[]; retireYear: number | null }): ReactNode {
  if (points.length < 2) return null;
  const values = points.map((p) => p.netWorth);
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / span) * (H - PAD.top - PAD.bottom);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.netWorth).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points.length - 1).toFixed(1)},${y(lo).toFixed(1)} L${x(0).toFixed(1)},${y(lo).toFixed(1)} Z`;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const retireIndex = retireYear === null ? -1 : points.findIndex((p) => p.year === retireYear);
  const ticks = points.map((p, i) => ({ p, i })).filter(({ p, i }) => i === 0 || i === points.length - 1 || p.age % 10 === 0);
  return (
    <figure className="flex flex-col gap-xs" data-testid="story-plan-line">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${t.chartLabel}: ${first.netWorthLabel} → ${last.netWorthLabel}`}>
        <defs>
          <linearGradient id="story-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#story-area)" className="ob-enter" style={{ '--ob-delay': '900ms' } as CSSProperties} />
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--color-border)" strokeDasharray="4 4" />
        {retireIndex >= 0 && (
          <line x1={x(retireIndex)} x2={x(retireIndex)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-text-muted)" strokeDasharray="2 4" />
        )}
        <path d={d} pathLength={1} fill="none" stroke="var(--color-primary)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" className="ob-draw" />
        <circle cx={x(points.length - 1)} cy={y(last.netWorth)} r={6} fill="var(--color-primary)" className="ob-pop" style={{ '--ob-delay': '1500ms' } as CSSProperties} />
        {ticks.map(({ p, i }) => (
          <text key={p.year} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} className="fill-text-muted text-[11px]">
            {i === 0 ? t.today : t.ageAxis(p.age)}
          </text>
        ))}
      </svg>
      <figcaption className="flex justify-between gap-md text-sm tabular-nums">
        <span>
          {t.today}: <strong>{first.netWorthLabel}</strong>
        </span>
        <span>
          {t.ageAxis(last.age)}: <strong className={last.belowZero ? 'text-negative' : 'text-primary'}>{last.netWorthLabel}</strong>
        </span>
      </figcaption>
    </figure>
  );
}

// ----- Chance of success ------------------------------------------------------------------------

const R = 52;

function ChanceCard({ vm }: { vm: ChanceOfSuccessVM }) {
  const r = vm.result;
  return (
    <section aria-labelledby="story-chance" className="ob-enter flex flex-col items-center gap-md rounded-xl bg-ink p-lg text-on-primary shadow-md sm:p-xl" data-testid="story-chance" data-status={vm.status}>
      <h2 id="story-chance" className="self-start font-display text-2xl font-extrabold">
        {t.chanceTitle}
      </h2>
      <div className="relative size-44">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="12" />
          {r && (
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={r.tone === 'good' ? 'var(--color-positive)' : 'var(--color-primary)'}
              strokeWidth="12"
              strokeLinecap="round"
              pathLength={1}
              style={{ strokeDasharray: `${r.gaugePct / 100} 1` }}
              className="ob-ring"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" role="meter" aria-label={t.chanceLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={r?.gaugePct ?? 0} aria-valuetext={r?.gaugeLabel ?? t.chanceRunning}>
          {r ? (
            <Count value={r.gaugePct} format={(v) => `${Math.round(v)}%`} className="font-display text-5xl font-extrabold" data-testid="chance-value" />
          ) : vm.status === 'error' ? null : (
            <span aria-hidden="true" className="size-6 animate-ping rounded-full bg-primary" />
          )}
        </div>
      </div>
      {r && <p className="text-sm">{r.pathsLabel}</p>}
      {(vm.status === 'running' || vm.status === 'idle') && (
        <p role="status" className="text-sm text-on-primary/70">
          {t.chanceRunning}
        </p>
      )}
      {vm.status === 'error' && (
        <div role="alert" className="flex flex-col items-center gap-sm text-sm">
          <p>{t.chanceError}</p>
          <button type="button" onClick={vm.run} className="min-h-11 rounded-lg bg-surface px-lg font-semibold text-text">
            {t.chanceRetry}
          </button>
        </div>
      )}
      <p className="text-xs text-on-primary/60">{t.chanceNote}</p>
    </section>
  );
}
