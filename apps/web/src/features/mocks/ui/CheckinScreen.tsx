'use client';

// S14 Monthly check-in (Figma S14). Presentational: every number comes from useCheckin() (engine
// monthEnd on the user's statements or the labelled sample statement; simulate / rankMoves for the
// move).
import { useId } from 'react';
import { common, forecast, mocks } from '@/copy';
import {
  Art, Button, buttonClassName, Card, Choice, cx, formatMoney, formatRate, Money, Scoreboard, Sticker, type ScoreboardItem,
} from '@/ui-kit';
import type { CheckinCompareVM, CheckinMoveVM, CheckinVM, MoveProgressVM, MoveVM } from '../model/types';
import { PreviewBadge } from './PreviewBadge';
import { ErrorNote, Loading, type LinkComponent } from './shared';

const t = mocks.checkin;
const TILTS = [-0.8, 0.6, -0.4, 0.8];

/** Title of a move from its kind (and category). */
function moveTitle(move: Pick<MoveVM, 'kind' | 'category'>): string {
  return forecast.moves.title(move.kind, move.category ? common.categories[move.category] : undefined);
}

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

function Score({ vm }: { vm: CheckinVM }) {
  const { month, compare, move } = vm;
  if (month.result.status !== 'ready') return month.result.status === 'error' ? <ErrorNote error={month.result.error} /> : null;
  const items: ScoreboardItem[] = [
    { id: 'projected', value: <Money value={month.result.data.projectedSpend} />, label: month.inProgress || !month.month ? t.projected : t.spent },
  ];
  // The difference is the headline, so the bar shows only the two totals behind it.
  if (compare) items.push({ id: 'average', value: <Money value={compare.average} />, label: t.average });
  const p = move.progress?.status === 'ready' ? move.progress.data : null;
  if (p?.kind === 'cardPayoff') items.push({ id: 'progress', value: formatRate(p.share, 0), label: t.progress, tone: 'positive' });
  return (
    <div className="flex flex-col gap-sm">
      <Scoreboard label={month.inProgress ? t.scoreLabel : t.scoreLabelDone} items={items} />
      {!compare && <p className="text-sm text-text-muted">{month.month === null ? t.noDataHint : t.needHistory(month.historyMonths)}</p>}
    </div>
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
      <h2 id={driftId} className="text-3xl font-extrabold sm:text-4xl">
        {t.driftTitle}
      </h2>
      <ul className="grid grid-cols-1 gap-lg sm:grid-cols-2 lg:grid-cols-4" data-testid="checkin-drifts">
        {tiles.map((d, i) => (
          <li key={d.category}>
            <Card className="flex h-full flex-col gap-xs" style={{ transform: `rotate(${TILTS[i % TILTS.length]}deg)` }}>
              <span className="text-lg font-semibold">{t.categories[d.category] ?? d.category}</span>
              {d.delta === null ? (
                <span className="font-display text-2xl font-extrabold leading-tight text-text-muted">{t.onTrack}</span>
              ) : (
                <>
                  <span
                    className={cx(
                      'font-display text-4xl font-extrabold leading-tight tabular-nums sm:text-display sm:leading-display',
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
        <p className="font-bold tabular-nums">{m.ofTotal(formatMoney(progress.paidThisMonth), formatMoney(progress.balance))}</p>
        <div
          role="progressbar"
          aria-label={m.progressLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-valuetext={formatRate(progress.share, 0)}
          className="h-md overflow-hidden rounded-full bg-surface-strong"
        >
          <div className="h-full rounded-full bg-positive" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-text-muted">{m.pace(months(progress.payoffMonthWith), months(progress.payoffMonthWithout))}</p>
      </>
    );
  }
  return (
    <>
      <p className="text-sm">
        {m.spendingTarget(common.categories[progress.category], formatMoney(progress.target), formatMoney(progress.planned))}
      </p>
      {progress.actual !== null && (
        <p className="text-sm">
          {m.actual(formatMoney(progress.actual))}{' '}
          <span className={cx('font-semibold', progress.onTrack ? 'text-positive' : 'text-negative')}>
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
      <Card as="section" aria-label={m.doneTitle} tone="arena" data-testid="checkin-move" className="flex flex-col gap-sm">
        <Sticker tone="ink">{m.doneTitle}</Sticker>
        <p className="text-xl font-bold">{m.doneBody(moveTitle(move.doneMove))}</p>
        {move.level === 2 && <p className="text-sm text-text-muted">{m.level2}</p>}
      </Card>
    );
  }

  if (move.committed) {
    const c = move.committed;
    const title = moveTitle(c);
    return (
      <Card as="section" aria-label={title} data-testid="checkin-move" className="flex flex-col gap-md border-2 border-positive">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <div className="flex items-center gap-md">
            <Sticker tone="positive">{m.sticker}</Sticker>
            <span className="text-xl font-bold">{title}</span>
          </div>
          <span className="text-sm font-semibold text-positive tabular-nums">{m.effect(formatMoney(c.effect10y, { signed: true }))}</span>
        </div>
        {move.progress?.status === 'ready' && move.progress.data && <Progress progress={move.progress.data} />}
        {move.progress?.status === 'error' && <ErrorNote error={move.progress.error} />}
        {move.answer === 'keepGoing' ? (
          <p role="status" className="rounded-md bg-surface p-md text-sm">
            {m.keepBody}
          </p>
        ) : (
          <div className="flex flex-col gap-sm">
            <p className="font-semibold">{m.question}</p>
            <div className="flex flex-wrap gap-sm">
              <Button onClick={move.markDone}>{m.done}</Button>
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
      <div className="flex items-center gap-md">
        <Sticker tone="positive">{m.sticker}</Sticker>
        <span className="text-xl font-bold">{m.noneTitle}</span>
      </div>
      {move.suggestions.status === 'ready' ? (
        move.suggestions.data.length === 0 ? (
          <p className="text-sm text-text-muted">{m.noMoves}</p>
        ) : (
          <ul className="flex flex-col gap-sm">
            {move.suggestions.data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-sm rounded-lg bg-surface-strong p-md">
                <div className="flex min-w-0 flex-col">
                  <span className="font-semibold">{moveTitle(s)}</span>
                  <span className="text-sm text-positive tabular-nums">{m.effect(formatMoney(s.effect10y, { signed: true }))}</span>
                </div>
                <Button size="sm" onClick={() => move.commit(s.id)} aria-label={`${m.commit}: ${moveTitle(s)}`}>
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
  return (
    <main className="mx-auto flex w-full max-w-(--container-7xl) flex-col gap-2xl px-lg py-xl">
      <header className="flex flex-col gap-lg sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-md">
          <PreviewBadge pro={vm.pro} Link={Link} />
          {ready && month.month && <Sticker tone="ink">{t.eyebrow(mocks.monthName(month.month))}</Sticker>}
          <h1 className="max-w-(--container-4xl) text-4xl leading-display sm:text-display lg:text-[calc(var(--text-display)*1.5)]">
            {ready ? headline(vm) : mocks.screens.S14}
          </h1>
        </div>
        <Art name="checkin" framed tilt={4} className="w-1/2 max-w-(--container-3xs) shrink-0 self-end sm:w-full" />
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
            <Score vm={vm} />
          </div>

          {vm.compare && <Drifts compare={vm.compare} />}

          <div className="grid grid-cols-1 items-center gap-xl lg:grid-cols-[2fr_1fr]">
            <MoveCard move={vm.move} movesHref={vm.movesHref} Link={Link} />
            <Link href={vm.uploadHref} className={buttonClassName({ size: 'lg', fullWidth: true })}>
              {t.addStatement(mocks.monthName(month.nextStatementMonth))}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
