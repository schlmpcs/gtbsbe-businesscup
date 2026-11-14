// "Your number": the S1 sample-life card and the S10 hero. Presentational: every number comes from the
// view-model (rules forecast, engine goalStatus / rankMoves); negative states stay neutral gray.
import { forecast as t } from '@/copy';
import { buttonClassName, Card, cx, EstimateTag, formatMoney, Money, Tag } from '@/ui-kit';
import type { Loadable, NumberHeroVM, SampleLifeVM, YourNumberGoalVM } from '../model/types';
import { ErrorNote, moveTitle, RangeText, Skeleton, type LinkComponent } from './shared';

/** Verdict and gap of a goal: "On track · $12,000 ahead" (gap ≤ 0) or "Behind · $40,000 short". */
function GoalLine({ goal, label, onArena = false }: { goal: YourNumberGoalVM; label: string; onArena?: boolean }) {
  const h = t.future.hero;
  const good = goal.verdict === 'onTrack';
  return (
    <div className="flex flex-col gap-xs" data-testid="number-goal" data-verdict={goal.verdict}>
      <p className="font-semibold">{label}</p>
      <p className="flex flex-wrap items-center gap-sm text-sm">
        <span
          className={cx(
            'rounded-full px-sm py-xs font-bold',
            onArena ? 'bg-ink text-on-primary' : good ? 'bg-positive-soft text-positive' : 'bg-surface-strong text-text-muted',
          )}
        >
          {h.verdict[goal.verdict]}
        </span>
        <span className={cx('tabular-nums', !onArena && !good && 'text-text-muted')}>
          {goal.gap > 0 ? h.short(formatMoney(goal.gap)) : h.ahead(formatMoney(-goal.gap))}
        </span>
      </p>
    </div>
  );
}

/** S1 first visit: the sample life, every number computed by the rules engine on the demo profile. */
export function SampleLifeCard({ vm, href, Link }: { vm: Loadable<SampleLifeVM>; href: string; Link: LinkComponent }) {
  const c = t.today.firstVisit.card;
  return (
    <Card data-testid="sample-life" className="flex w-full flex-col gap-lg shadow-lg">
      <div className="flex flex-col gap-xs">
        <h2 className="font-display text-2xl font-extrabold leading-tight">{c.computed}</h2>
        {vm.status === 'ready' && <p className="text-sm text-text-muted">{c.who(vm.data.age, formatMoney(vm.data.takeHome.value))}</p>}
      </div>
      {vm.status === 'loading' ? (
        <Skeleton lines={4} />
      ) : vm.status === 'error' ? (
        <ErrorNote error={vm.error} />
      ) : (
        <SampleLifeBody data={vm.data} />
      )}
      <Link href={href} className={cx(buttonClassName({ variant: 'secondary' }), 'self-start')}>
        {c.cta}
        <span aria-hidden="true">→</span>
      </Link>
    </Card>
  );
}

function SampleLifeBody({ data }: { data: SampleLifeVM }) {
  const c = t.today.firstVisit.card;
  return (
    <>
      <dl className="grid grid-cols-2 gap-md">
        <div className="flex flex-col gap-xs rounded-md bg-surface-strong p-md">
          <dt className="flex flex-wrap items-center gap-xs text-sm text-text-muted">
            {c.month}
            {data.month.isEstimate && <EstimateTag />}
          </dt>
          <dd className="font-display text-2xl font-extrabold tabular-nums" data-testid="sample-month">
            <Money value={data.month.value} />
          </dd>
          <dd className="text-xs text-text-muted">{c.monthHint}</dd>
        </div>
        <div className="flex flex-col gap-xs rounded-md bg-surface-strong p-md">
          <dt className="flex flex-wrap items-center gap-xs text-sm text-text-muted">
            {c.today}
            {data.todayIsEstimate && <EstimateTag />}
          </dt>
          <dd className="font-display text-2xl font-extrabold tabular-nums" data-testid="sample-today">
            <Money value={data.today} />
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-xs">
        <p className="flex flex-wrap items-center gap-sm text-sm text-text-muted">
          {c.number(data.year)}
          {data.isEstimate && <EstimateTag />}
        </p>
        <p className="font-display text-6xl font-extrabold leading-tight tabular-nums text-primary" data-testid="sample-number">
          <Money value={data.in10y.mid} />
        </p>
        <RangeText point={data.in10y} isZero={!data.isEstimate} />
        <p className="text-xs text-text-muted">{t.future.hero.source}</p>
      </div>

      {data.goal && <GoalLine goal={data.goal} label={c.goal(formatMoney(data.goal.target), data.goal.year)} />}

      {data.moves.length > 0 && (
        <div className="flex flex-col gap-sm">
          <h3 className="text-sm font-semibold text-text-muted">{c.moves}</h3>
          <ol className="flex flex-col gap-xs" data-testid="sample-moves">
            {data.moves.map((m) => (
              <li key={m.id} className="flex items-baseline justify-between gap-md border-t border-border pt-xs text-sm">
                <span>{moveTitle(m)}</span>
                <span className="shrink-0 font-bold text-positive tabular-nums">
                  {c.moveEffect(formatMoney(m.effect10y, { signed: true }))}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

/**
 * S10 hero on the orange band: "Your number in 2036" from the rules forecast (labeled so), today's net
 * worth next to it, and the goal's verdict and gap when there is a goal.
 */
export function NumberHero({ vm }: { vm: NumberHeroVM }) {
  const h = t.future.hero;
  if (vm.number.status === 'loading') return <Skeleton lines={3} className="max-w-(--container-md)" />;
  if (vm.number.status === 'error') return <ErrorNote error={vm.number.error} className="text-on-primary" />;
  const n = vm.number.data;
  return (
    <section data-testid="your-number" aria-label={h.number(n.year)} className="flex flex-col gap-lg">
      <div className="flex flex-col gap-xs">
        <p className="flex flex-wrap items-center gap-sm text-lg font-semibold">
          {h.number(n.year)}
          {n.isEstimate && <EstimateTag className="border-on-primary/60 text-on-primary" />}
        </p>
        <p className="font-display text-display leading-display font-extrabold tabular-nums break-words sm:text-8xl sm:leading-display">
          <Money value={n.in10y.mid} />
        </p>
        <RangeText point={n.in10y} isZero={!n.isEstimate} className="text-lg" />
        <Tag className="border-on-primary/60 text-on-primary" data-testid="number-source">
          {h.source}
        </Tag>
      </div>
      <div className="flex flex-wrap gap-x-2xl gap-y-lg border-t border-on-primary/40 pt-md">
        <div className="flex flex-col gap-xs">
          <p className="flex items-center gap-sm text-sm">
            {h.today}
            {n.todayIsEstimate && <EstimateTag className="border-on-primary/60 text-on-primary" />}
          </p>
          <p className="font-display text-3xl font-extrabold tabular-nums" data-testid="number-today">
            <Money value={n.today} />
          </p>
        </div>
        {n.goal && (
          <GoalLine
            goal={n.goal}
            onArena
            label={(vm.isSampleGoal ? h.sampleGoal : h.goal)(formatMoney(n.goal.target), n.goal.year)}
          />
        )}
      </div>
    </section>
  );
}
