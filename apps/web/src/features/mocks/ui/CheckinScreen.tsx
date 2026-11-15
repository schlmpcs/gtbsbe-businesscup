'use client';

// S14 Monthly check-in. Presentational: every number comes from useCheckin() (engine monthEndDetail on
// the person's transactions or statements, or on the labelled sample statement; simulate / rankMoves
// for the move). Layout: the month as a title and one sentence, where the months come from, a KPI
// strip (projection, usual month, difference, spent so far), the month-end pace, the category bars
// (usual vs this month, drift flags), one move to commit, and "How we calculate".
import type { ReactNode } from 'react';
import { common, forecast, mocks } from '@/copy';
import { Art, Button, buttonClassName, cx, formatMoney, formatRate, PageHeader, Sticker, Tag } from '@/ui-kit';
import { CountUp, KpiStrip, Meter, MOTION, Panel, Segmented, TONE_BG, type ChartTone, type KpiItem } from '@/ui-kit/reports';
import type { CategoryBarVM, CheckinCompareVM, CheckinMonthVM, CheckinMoveVM, CheckinVM, MoveProgressVM, MoveVM } from '../model/types';
import { ErrorNote, Loading, type LinkComponent } from './shared';

const t = mocks.checkin;
const money = (v: number) => formatMoney(v);

/** Title of a move from its kind (and category). */
function moveTitle(move: Pick<MoveVM, 'kind' | 'category'>): string {
  return forecast.moves.title(move.kind, move.category ? common.categories[move.category] : undefined);
}

/** The sentence under the title: how the month compares with the usual one. */
function lead(month: CheckinMonthVM, c: CheckinCompareVM | null): string | null {
  if (!c) return null;
  if (month.month === null) return t.lead.noData;
  const usual = c.usualFromHistory ? t.usualName.history : t.usualName.profile;
  const amount = formatMoney(Math.abs(c.difference));
  if (month.inProgress) {
    return c.direction === 'even' ? t.lead.even(usual) : c.direction === 'over' ? t.lead.over(amount, usual) : t.lead.under(amount, usual);
  }
  return c.direction === 'even' ? t.lead.wasEven(usual) : c.direction === 'over' ? t.lead.wasOver(amount, usual) : t.lead.wasUnder(amount, usual);
}

// ----- where the months come from --------------------------------------------------------------------

function SourceBar({ vm, Link }: { vm: CheckinVM; Link: LinkComponent }) {
  const { month } = vm;
  if (month.hasOwn) {
    return (
      <div data-testid="checkin-month" className="flex flex-wrap items-end justify-between gap-md">
        <Segmented
          legend={t.sourceLabel}
          showLegend
          name="checkin-source"
          value={month.source}
          options={[
            { value: 'mine', label: month.ownKind === 'uploads' ? t.sources.mineUploads : t.sources.mine },
            { value: 'sample', label: t.sources.sample },
          ]}
          onChange={vm.setSource}
        />
        {month.source === 'sample' && <SampleTag />}
      </div>
    );
  }
  return (
    <div role="note" data-testid="preview-note" className="card flex flex-wrap items-center justify-between gap-md px-lg py-md">
      <p className="flex min-w-0 flex-1 flex-wrap items-center gap-sm text-sm text-text-muted">
        <SampleTag />
        <span>{t.sampleNote}</span>
      </p>
      <Link href={vm.uploadHref} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
        {t.importCta}
      </Link>
    </div>
  );
}

function SampleTag() {
  return <span className="rounded-full bg-primary-soft px-sm py-xs text-xs font-bold uppercase tracking-wide text-primary">{t.samplePreview}</span>;
}

// ----- numbers ---------------------------------------------------------------------------------------

function Kpis({ month, c }: { month: CheckinMonthVM; c: CheckinCompareVM }) {
  const live = month.inProgress;
  const items: KpiItem[] = [
    {
      id: 'projected',
      label: live || month.month === null ? t.kpi.projected : t.kpi.spent,
      value: <CountUp value={c.projected} format={money} />,
      hint: live ? t.kpiHint.projected : undefined,
      dot: 'c1',
    },
    {
      id: 'usual',
      label: c.usualFromHistory ? t.kpi.usual : t.kpi.planned,
      value: <CountUp value={c.usual} format={money} />,
      hint: c.usualFromHistory ? t.kpiHint.usualHistory(month.historyNeeded) : t.kpiHint.usualProfile,
      dot: 'c6',
    },
    {
      id: 'difference',
      label: t.kpi.difference,
      value: <CountUp value={c.difference} format={(v) => formatMoney(v, { signed: true })} />,
      tone: c.direction === 'over' ? 'negative' : c.direction === 'under' ? 'positive' : 'default',
    },
  ];
  if (live && month.day !== null && month.daysInMonth !== null) {
    items.push({ id: 'soFar', label: t.kpi.soFar, value: <CountUp value={c.spentSoFar} format={money} />, hint: t.kpiHint.soFar(month.day, month.daysInMonth) });
  }
  return <KpiStrip items={items} aria-label={t.kpiLabel} data-testid="checkin-kpis" />;
}

/** One category: two bars on one scale (usual, this month), a drift chip when monthEnd flagged it. */
function BarRow({ row, max, inProgress }: { row: CategoryBarVM; max: number; inProgress: boolean }) {
  const name = t.categories[row.category] ?? row.category;
  const over = (row.delta ?? 0) > 0;
  const thisTone: ChartTone = row.drift ? (over ? 'primary' : 'positive') : 'c1';
  const w = (v: number) => `${max > 0 ? Math.min(100, (v / max) * 100) : 0}%`;
  return (
    <li className="flex flex-col gap-xs" data-category={row.category} data-drift={row.drift || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-x-md gap-y-xs">
        <span className="flex items-center gap-sm font-semibold">
          {name}
          {row.drift && row.delta !== null && (
            <span
              className={cx(
                'rounded-full px-sm text-xs font-bold leading-normal tabular-nums',
                over ? 'bg-primary-soft text-primary' : 'bg-positive-soft text-positive',
              )}
            >
              <span className="sr-only">{t.driftLabel}: </span>
              {over ? t.driftOver(money(row.delta)) : t.driftUnder(money(-row.delta))}
            </span>
          )}
        </span>
        <span className="text-sm tabular-nums">
          <span className="text-text-muted">{money(row.usual)}</span>
          <span aria-hidden="true" className="px-xs text-text-muted">→</span>
          <span className="font-bold">{money(row.projected)}</span>
        </span>
      </div>
      <div aria-hidden="true" className="flex flex-col gap-0.5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-strong/50">
          <div className="h-full" style={{ width: w(row.usual) }}>
            <div className={cx('h-full rounded-full', TONE_BG.c6, MOTION.growX)} />
          </div>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-surface-strong/50">
          <div className="relative h-full" style={{ width: w(row.projected) }}>
            <div className={cx('h-full rounded-full', TONE_BG[thisTone], MOTION.growX, inProgress && 'opacity-60')} />
            {inProgress && row.projected > 0 && (
              <div
                className={cx('absolute inset-y-0 left-0 rounded-full', TONE_BG[thisTone], MOTION.growX)}
                style={{ width: `${Math.min(100, (row.soFar / row.projected) * 100)}%` }}
              />
            )}
          </div>
        </div>
      </div>
      <span className="sr-only">{t.barRow(name, money(row.usual), money(row.projected))}</span>
    </li>
  );
}

function Bars({ month, c }: { month: CheckinMonthVM; c: CheckinCompareVM }) {
  const max = Math.max(1, ...c.rows.map((r) => Math.max(r.usual, r.projected)));
  return (
    <Panel
      title={t.barsTitle}
      subtitle={t.barsSubtitle(month.inProgress)}
      data-testid="checkin-bars"
      action={
        <span className={cx('rounded-full px-md py-xs text-xs font-bold', c.driftCount > 0 ? 'bg-primary-soft text-primary' : 'bg-positive-soft text-positive')}>
          {t.driftCount(c.driftCount)}
        </span>
      }
    >
      <ul aria-hidden="true" className="mb-md flex flex-wrap gap-x-lg gap-y-xs text-xs text-text-muted">
        <li className="inline-flex items-center gap-xs">
          <span className={cx('h-2 w-4 rounded-full', TONE_BG.c6)} />
          {t.legendUsual}
        </li>
        <li className="inline-flex items-center gap-xs">
          <span className={cx('h-2 w-4 rounded-full', TONE_BG.c1)} />
          {t.legendThis(month.inProgress)}
        </li>
      </ul>
      <ul className="flex flex-col gap-lg" data-testid="checkin-drifts">
        {c.rows.map((r) => (
          <BarRow key={r.category} row={r} max={max} inProgress={month.inProgress} />
        ))}
      </ul>
      {!c.usualFromHistory && month.month !== null && <p className="mt-lg text-sm text-text-muted">{t.needHistory(month.historyMonths)}</p>}
    </Panel>
  );
}

// ----- the move --------------------------------------------------------------------------------------

function Progress({ progress }: { progress: MoveProgressVM }) {
  const m = t.move;
  if (progress.kind === 'cardPayoff') {
    const months = (n: number | null) => (n === null ? m.notWithin10y : t.months(n));
    return (
      <>
        <p className="flex flex-wrap items-baseline gap-x-sm">
          <span className="sr-only">{m.ofTotal(formatMoney(progress.paidThisMonth), formatMoney(progress.balance))}</span>
          <span aria-hidden="true" className="font-display text-4xl font-extrabold leading-display text-primary tabular-nums">
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
          aria-valuenow={Math.round(Math.min(1, Math.max(0, progress.share)) * 100)}
          aria-valuetext={formatRate(progress.share, 0)}
        >
          <Meter value={progress.share} tone="primary" size="md" />
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

function Effect({ move }: { move: MoveVM }) {
  return (
    <span className="flex flex-wrap items-center gap-sm">
      <span className="rounded-full bg-positive-soft px-md py-xs text-xs font-bold text-positive tabular-nums">
        {forecast.moves.effect(formatMoney(move.effect, { signed: true }), move.horizonYears)}
      </span>
      {move.source && (
        <Tag data-testid="forecast-source" data-source={move.source}>
          {forecast.source[move.source]}
        </Tag>
      )}
    </span>
  );
}

function MoveCard({ move, movesHref, Link }: { move: CheckinMoveVM; movesHref: string; Link: LinkComponent }) {
  const m = t.move;
  const seeAll = (
    <Link href={movesHref} className="self-start text-sm font-semibold text-primary underline-offset-2 hover:underline">
      {m.seeAll} <span aria-hidden="true">→</span>
    </Link>
  );
  let body: ReactNode;
  if (move.answer === 'done' && move.doneMove) {
    body = (
      <>
        <Sticker tone="positive">{m.doneTitle}</Sticker>
        <p className="text-lg font-bold">{m.doneBody(moveTitle(move.doneMove))}</p>
        {move.level === 2 && <p className="text-sm text-text-muted">{m.level2}</p>}
      </>
    );
  } else if (move.committed) {
    const c = move.committed;
    body = (
      <>
        <p className="text-lg font-bold">{moveTitle(c)}</p>
        <Effect move={c} />
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
      </>
    );
  } else if (move.suggestions.status === 'ready') {
    const top = move.suggestions.data[0];
    body = top ? (
      <>
        <p className="text-sm text-text-muted">{m.noneTitle}</p>
        <p className="text-lg font-bold">{moveTitle(top)}</p>
        <Effect move={top} />
        <Button className="self-start" onClick={() => move.commit(top.id)} disabled={move.actionsDisabled} aria-label={`${m.commit}: ${moveTitle(top)}`}>
          {m.commit}
        </Button>
      </>
    ) : (
      <p className="text-sm text-text-muted">{m.noMoves}</p>
    );
  } else {
    body = move.suggestions.status === 'error' ? <ErrorNote error={move.suggestions.error} /> : <div className="h-24 animate-pulse rounded-lg bg-surface-strong" />;
  }
  return (
    <section
      aria-label={m.sticker}
      data-testid="checkin-move"
      className={cx('card card-pad flex flex-col gap-md', MOTION.rise, move.answer === 'done' && 'inset-ring-3 inset-ring-positive')}
    >
      <h2 className="text-lg font-bold leading-tight">{m.sticker}</h2>
      {body}
      {seeAll}
    </section>
  );
}

function How() {
  return (
    <details className="card card-pad group" data-testid="checkin-how">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-md font-semibold">
        {t.howTitle}
        <span aria-hidden="true" className="text-text-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <ul className="mt-md flex list-disc flex-col gap-sm pl-lg text-sm text-text-muted">
        {t.how.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  );
}

export function CheckinScreen({ vm, Link }: { vm: CheckinVM; Link: LinkComponent }) {
  const { month, compare } = vm;
  const ready = vm.status === 'ready';
  const title = !ready ? mocks.screens.S14 : month.month ? t.eyebrow(mocks.monthName(month.month)) : t.titleNoData;
  return (
    <main className="page flex flex-col gap-xl">
      <PageHeader
        eyebrow={t.kicker}
        title={title}
        intro={ready ? lead(month, compare) : null}
        aside={<Art name="house-crane" className="hidden w-40 sm:block" />}
      />
      {!ready ? (
        <Loading />
      ) : (
        <>
          <SourceBar vm={vm} Link={Link} />
          {month.result.status === 'error' && <ErrorNote error={month.result.error} className="card card-pad" />}
          {compare && (
            <>
              <Kpis month={month} c={compare} />
              {month.inProgress && month.day !== null && month.daysInMonth !== null && (
                <div className="card card-pad flex flex-col gap-sm" data-testid="checkin-pace">
                  <div className="flex flex-wrap items-baseline justify-between gap-md text-sm">
                    <span className="font-semibold">{t.kpi.soFar}</span>
                    <span className="tabular-nums text-text-muted">
                      {money(compare.spentSoFar)} / {money(compare.projected)}
                    </span>
                  </div>
                  <Meter value={compare.projected > 0 ? compare.spentSoFar / compare.projected : 0} tone="c1" size="md" marker={month.day / month.daysInMonth} />
                  <span className="text-xs text-text-muted">{t.kpiHint.soFar(month.day, month.daysInMonth)}</span>
                </div>
              )}
              <div className="grid grid-cols-1 items-start gap-xl lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <Bars month={month} c={compare} />
                <div className="flex min-w-0 flex-col gap-xl">
                  <MoveCard move={vm.move} movesHref={vm.movesHref} Link={Link} />
                  {vm.move.answer === 'done' && (
                    <div className="flex flex-col items-center">
                      <Art name="house-crane" className="w-2/3 max-w-(--container-3xs)" />
                      <Sticker tone="positive" tilt={-6} className="-mt-lg text-sm">
                        {t.floorSticker}
                      </Sticker>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          <How />
          <div className="flex flex-wrap items-center gap-md">
            <Link href={vm.uploadHref} className={buttonClassName({ size: 'lg' })}>
              {month.inProgress ? t.importCta : t.addStatement(mocks.monthName(month.nextStatementMonth))}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
