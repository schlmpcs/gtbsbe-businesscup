'use client';

// S14 Monthly check-in (Figma Design v3, nodes 193:1567 / 203:2067). Presentational: every number
// comes from useCheckin() (engine monthEnd on the user's statements or the labelled sample statement;
// simulate / rankMoves for the move; the ranked suggestions say who made their numbers, at the year
// picked on S10).
import { useId, type ReactNode } from 'react';
import { common, forecast, mocks } from '@/copy';
import { Art, Button, buttonClassName, Card, Choice, cx, formatMoney, formatRate, Money, Sticker, Tag } from '@/ui-kit';
import type { CheckinCompareVM, CheckinMoveVM, CheckinVM, MoveProgressVM, MoveVM } from '../model/types';
import { PreviewBadge } from './PreviewBadge';
import { ErrorNote, Loading, type LinkComponent } from './shared';

const t = mocks.checkin;

/** Title of a move from its kind (and category). */
function moveTitle(move: Pick<MoveVM, 'kind' | 'category'>): string {
  return forecast.moves.title(move.kind, move.category ? common.categories[move.category] : undefined);
}

/** The sentence under the title: how the month compares with the usual one. */
function headline(vm: CheckinVM): string {
  const { month, compare } = vm;
  if (month.month === null) return t.titleNoData;
  const name = mocks.monthName(month.month);
  if (!compare) return month.inProgress ? t.titleNoAverage(name) : t.titleNoAverageDone(name);
  if (compare.direction === 'even') return t.titleEven;
  const amount = formatMoney(Math.abs(compare.difference));
  if (month.inProgress) return compare.direction === 'over' ? t.titleOver(amount) : t.titleUnder(amount);
  return compare.direction === 'over' ? t.titleWasOver(amount) : t.titleWasUnder(amount);
}

/** The ink "value check" card: the month's totals from the engine (monthEnd), as big numbers. */
function ValueCheck({ vm }: { vm: CheckinVM }) {
  const { month, compare, move } = vm;
  if (month.result.status !== 'ready') return month.result.status === 'error' ? <ErrorNote error={month.result.error} /> : null;
  const items: { id: string; value: ReactNode; label: string; positive?: boolean }[] = [
    { id: 'projected', value: <Money value={month.result.data.projectedSpend} />, label: month.inProgress || !month.month ? t.projected : t.spent },
  ];
  // The difference is the headline, so the card shows only the two totals behind it.
  if (compare) items.push({ id: 'average', value: <Money value={compare.average} />, label: t.average });
  const p = move.progress?.status === 'ready' ? move.progress.data : null;
  if (p?.kind === 'cardPayoff') items.push({ id: 'progress', value: formatRate(p.share, 0), label: t.progress, positive: true });
  return (
    <section className="flex flex-col gap-lg rounded-xl bg-ink p-xl text-on-primary shadow-md">
      <span className="text-xs font-bold uppercase tracking-wide text-primary">{month.inProgress ? t.valueCheckSoFar : t.valueCheck}</span>
      <dl aria-label={month.inProgress ? t.scoreLabel : t.scoreLabelDone} className="flex flex-col gap-lg">
        {items.map((it) => (
          <div key={it.id} className="flex min-w-0 flex-col-reverse gap-xs">
            <dt className="text-sm text-on-primary/60">{it.label}</dt>
            <dd
              className={cx(
                'font-display text-4xl font-extrabold leading-tight tabular-nums sm:text-5xl',
                it.positive ? 'text-positive' : 'text-on-primary',
              )}
            >
              {it.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-on-primary/60">
        {compare ? t.valueNote[month.source] : month.month === null ? t.noDataHint : t.needHistory(month.historyMonths)}
      </p>
    </section>
  );
}

/** Two labelled bars (the 3-month average and this month) and the difference as a pill. */
function CompareCard({ compare, inProgress }: { compare: CheckinCompareVM; inProgress: boolean }) {
  const max = Math.max(compare.average, compare.projected, 1);
  const bars = [
    { id: 'usual', label: t.compareUsual, value: compare.average, fill: 'bg-border' },
    { id: 'this', label: inProgress ? t.compareThisSoFar : t.compareThis, value: compare.projected, fill: 'bg-primary' },
  ];
  const amount = formatMoney(Math.abs(compare.difference));
  const pill =
    compare.direction === 'even' ? t.comparePill.even : compare.direction === 'over' ? t.comparePill.over(amount) : t.comparePill.under(amount);
  return (
    <Card title={t.compareTitle} data-testid="checkin-compare">
      <div className="flex flex-col gap-md">
        {bars.map((b) => (
          <div key={b.id} className="flex flex-col gap-xs">
            <div className="flex items-baseline justify-between gap-md">
              <span className="text-sm text-text-muted">{b.label}</span>
              <Money value={b.value} className="text-xl font-extrabold" />
            </div>
            <div aria-hidden="true" className="h-sm overflow-hidden rounded-full bg-surface-strong">
              <div className={cx('h-full rounded-full', b.fill)} style={{ width: `${Math.max(0, (b.value / max) * 100)}%` }} />
            </div>
          </div>
        ))}
        <span
          className={cx(
            'w-fit rounded-full px-md py-xs text-xs font-bold',
            compare.direction === 'over' ? 'bg-primary-soft text-primary' : 'bg-positive-soft text-positive',
          )}
        >
          {pill}
        </span>
      </div>
    </Card>
  );
}

function Drifts({ compare }: { compare: CheckinCompareVM }) {
  const driftId = useId();
  const tiles = [
    ...compare.drifts.map((d) => ({ category: d.category, delta: d.delta as number | null })),
    ...compare.onTrack.map((category) => ({ category, delta: null })),
  ];
  return (
    <section aria-labelledby={driftId} className="flex flex-col gap-lg">
      <h2 id={driftId} className="font-display text-3xl font-extrabold sm:text-4xl">
        {t.driftTitle}
      </h2>
      <ul className="grid grid-cols-1 gap-lg sm:grid-cols-2 lg:grid-cols-4" data-testid="checkin-drifts">
        {tiles.map((d) => (
          <li key={d.category}>
            <Card className="flex h-full flex-col gap-xs">
              <span className="text-lg font-semibold">{t.categories[d.category] ?? d.category}</span>
              {d.delta === null ? (
                <span className="font-display text-2xl font-extrabold leading-tight text-text-muted">{t.onTrack}</span>
              ) : (
                <>
                  <span
                    className={cx(
                      'font-display text-4xl font-extrabold leading-tight tabular-nums',
                      d.delta > 0 ? 'text-primary' : 'text-positive',
                    )}
                  >
                    <Money value={d.delta} signed />
                  </span>
                  <span className="text-sm text-text-muted">{t.vsAverage}</span>
                </>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Progress({ progress }: { progress: MoveProgressVM }) {
  const m = t.move;
  if (progress.kind === 'cardPayoff') {
    const pct = Math.min(100, Math.max(0, progress.share * 100));
    const months = (n: number | null) => (n === null ? m.notWithin10y : t.months(n));
    return (
      <>
        <p className="flex flex-wrap items-baseline gap-x-sm">
          <span className="sr-only">{m.ofTotal(formatMoney(progress.paidThisMonth), formatMoney(progress.balance))}</span>
          <span aria-hidden="true" className="font-display text-5xl font-extrabold leading-display text-primary tabular-nums">
            {formatMoney(progress.paidThisMonth)}
          </span>
          <span aria-hidden="true" className="text-sm text-text-muted tabular-nums">
            {m.ofTotalRest(formatMoney(progress.balance))}
          </span>
        </p>
        <div
          role="progressbar"
          aria-label={m.progressLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-valuetext={formatRate(progress.share, 0)}
          className="h-sm overflow-hidden rounded-full bg-surface-strong"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-text-muted">{m.pace(months(progress.payoffMonthWith), months(progress.payoffMonthWithout))}</p>
      </>
    );
  }
  return (
    <>
      <Money value={progress.target} className="font-display text-5xl font-extrabold leading-display text-primary" />
      <p className="text-sm">
        {m.spendingTarget(common.categories[progress.category], formatMoney(progress.target), formatMoney(progress.planned))}
      </p>
      {progress.actual !== null && (
        <p className="text-sm">
          {m.actual(formatMoney(progress.actual))}{' '}
          <span
            className={cx(
              'rounded-full px-sm py-xs text-xs font-bold',
              progress.onTrack ? 'bg-positive-soft text-positive' : 'bg-primary-soft text-negative',
            )}
          >
            {progress.onTrack ? m.onTrack : m.offTrack}
          </span>
        </p>
      )}
    </>
  );
}

function MoveCard({ move, movesHref, Link }: { move: CheckinMoveVM; movesHref: string; Link: LinkComponent }) {
  const m = t.move;
  const seeAll = (
    <Link href={movesHref} className={cx(buttonClassName({ variant: 'ghost', size: 'sm' }), 'self-start')}>
      {m.seeAll}
    </Link>
  );

  if (move.answer === 'done' && move.doneMove) {
    return (
      <Card
        as="section"
        aria-label={m.doneTitle}
        data-testid="checkin-move"
        className="flex flex-col gap-sm inset-ring-3 inset-ring-positive"
      >
        <Sticker tone="positive">{m.doneTitle}</Sticker>
        <p className="text-xl font-bold">{m.doneBody(moveTitle(move.doneMove))}</p>
        {move.level === 2 && <p className="text-sm text-text-muted">{m.level2}</p>}
      </Card>
    );
  }

  if (move.committed) {
    const c = move.committed;
    const title = moveTitle(c);
    return (
      <Card as="section" aria-label={title} data-testid="checkin-move" className="flex flex-col gap-md">
        <div className="flex flex-wrap items-start justify-between gap-md">
          <div className="flex flex-col gap-xs">
            <span className="text-xl font-bold">{m.sticker}</span>
            <span className="text-text-muted">{title}</span>
          </div>
          <div className="flex flex-col items-end gap-xs">
            <span className="rounded-full bg-positive-soft px-md py-xs text-xs font-bold text-positive tabular-nums">
              {forecast.moves.effect(formatMoney(c.effect, { signed: true }), c.horizonYears)}
            </span>
            {c.source && (
              <Tag data-testid="forecast-source" data-source={c.source}>
                {forecast.source[c.source]}
              </Tag>
            )}
          </div>
        </div>
        {move.progress?.status === 'ready' && move.progress.data && <Progress progress={move.progress.data} />}
        {move.progress?.status === 'error' && <ErrorNote error={move.progress.error} />}
        {move.answer === 'keepGoing' ? (
          <p role="status" className="rounded-md bg-positive-soft p-md text-sm">
            {m.keepBody}
          </p>
        ) : (
          <div className="flex flex-col gap-sm">
            <p className="font-semibold">{m.question}</p>
            <div className="flex flex-wrap gap-sm">
              <Button onClick={move.markDone} disabled={move.actionsDisabled}>
                {m.done}
              </Button>
              <Button variant="secondary" onClick={move.keepGoing}>
                {m.keepGoing}
              </Button>
            </div>
          </div>
        )}
        {move.level === 2 && <p className="text-xs text-text-muted">{m.level2}</p>}
        {seeAll}
      </Card>
    );
  }

  return (
    <Card as="section" aria-label={m.noneTitle} data-testid="checkin-move" className="flex flex-col gap-md">
      <div className="flex flex-col gap-xs">
        <span className="text-xl font-bold">{m.sticker}</span>
        <span className="text-text-muted">{m.noneTitle}</span>
      </div>
      {move.suggestions.status === 'ready' ? (
        move.suggestions.data.length === 0 ? (
          <p className="text-sm text-text-muted">{m.noMoves}</p>
        ) : (
          <ul className="flex flex-col gap-sm">
            {move.suggestions.data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-sm rounded-lg bg-bg p-md">
                <div className="flex min-w-0 flex-col">
                  <span className="font-semibold">{moveTitle(s)}</span>
                  <span className="text-sm font-semibold text-positive tabular-nums">
                    {forecast.moves.effect(formatMoney(s.effect, { signed: true }), s.horizonYears)}
                  </span>
                  {s.source && (
                    <Tag data-testid="forecast-source" data-source={s.source} className="mt-xs">
                      {forecast.source[s.source]}
                    </Tag>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => move.commit(s.id)}
                  disabled={move.actionsDisabled}
                  aria-label={`${m.commit}: ${moveTitle(s)}`}
                >
                  {m.commit}
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : move.suggestions.status === 'error' ? (
        <ErrorNote error={move.suggestions.error} />
      ) : null}
      {seeAll}
    </Card>
  );
}

export function CheckinScreen({ vm, Link }: { vm: CheckinVM; Link: LinkComponent }) {
  const { month } = vm;
  const ready = vm.status === 'ready';
  const title = !ready ? mocks.screens.S14 : month.month ? t.eyebrow(mocks.monthName(month.month)) : t.titleNoData;
  const lead = ready && month.month ? headline(vm) : null;
  return (
    <main className="mx-auto flex w-full max-w-(--container-7xl) flex-col gap-2xl px-lg py-xl">
      <header className="flex flex-col gap-lg lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t.kicker}</span>
          <h1 className="font-display text-4xl font-extrabold leading-display sm:text-display lg:text-[length:calc(var(--text-display)*1.4)]">
            {title}
          </h1>
          {lead && <p className="max-w-prose text-xl font-semibold">{lead}</p>}
        </div>
        <PreviewBadge pro={vm.pro} Link={Link} />
      </header>

      {!ready ? (
        <Loading />
      ) : (
        <>
          <div className="flex flex-col gap-md" data-testid="checkin-month">
            {month.hasUploads ? (
              <Choice
                legend={t.sourceLabel}
                name="checkin-source"
                value={month.source}
                options={[
                  { value: 'uploads', label: t.sources.uploads },
                  { value: 'sample', label: t.sources.sample },
                ]}
                onChange={vm.setSource}
              />
            ) : null}
            {month.source === 'sample' && (
              <p role="note" className="rounded-lg border-2 border-dashed border-border p-md text-sm text-text-muted">
                {t.sampleNote}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 items-start gap-xl lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="flex min-w-0 flex-col gap-xl">
              {vm.compare && <CompareCard compare={vm.compare} inProgress={month.inProgress} />}
              <MoveCard move={vm.move} movesHref={vm.movesHref} Link={Link} />
            </div>
            <ValueCheck vm={vm} />
            <div className="flex flex-col items-center justify-center">
              <Art name="house-crane" className="w-2/3 max-w-(--container-3xs) lg:w-full" />
              {vm.move.answer === 'done' && (
                <Sticker tone="positive" tilt={-6} className="-mt-lg text-sm">
                  {t.floorSticker}
                </Sticker>
              )}
            </div>
          </div>

          {vm.compare && <Drifts compare={vm.compare} />}

          <div className="flex flex-wrap items-center gap-md">
            <Link href={vm.uploadHref} className={buttonClassName({ size: 'lg' })}>
              {t.addStatement(mocks.monthName(month.nextStatementMonth))}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
