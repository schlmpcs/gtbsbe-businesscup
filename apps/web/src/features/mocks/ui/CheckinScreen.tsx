'use client';

// S14 Monthly check-in: three steps (your month, your move, your 10 years), then a summary.
// Presentational: every number comes from useCheckin(), which calls the engine (monthEnd, simulate,
// rankMoves, forecast).
import { common, forecast, mocks } from '@/copy';
import {
  Button, buttonClassName, Card, Choice, cx, EstimateTag, ForecastChart, formatMoney, Money, Row, Stack, Stat,
} from '@/ui-kit';
import type {
  CheckinMonthVM, CheckinMoveVM, CheckinVM, MonthEnd, MoveProgressVM, MoveVM,
} from '../model/types';
import { ErrorNote, Loading, RangeText, ScreenHeader, type LinkComponent } from './shared';

const t = mocks.checkin;

export type CheckinLinks = { upload: string; future: string };

export type CheckinScreenProps = { vm: CheckinVM; links: CheckinLinks; Link: LinkComponent };

/** Title of a move from its kind (and category). */
function moveTitle(move: Pick<MoveVM, 'kind' | 'category'>): string {
  return forecast.moves.title(move.kind, move.category ? common.categories[move.category] : undefined);
}

export function CheckinScreen({ vm, links, Link }: CheckinScreenProps) {
  return (
    <main className="mx-auto w-full max-w-(--container-2xl) px-lg py-xl">
      <Stack gap="xl">
        <ScreenHeader title={mocks.screens.S14} intro={t.intro} pro={vm.pro} Link={Link} />
        {vm.status === 'loading' ? (
          <Loading />
        ) : vm.finished ? (
          <Summary vm={vm} links={links} Link={Link} />
        ) : (
          <>
            <Stepper steps={vm.steps} step={vm.step} goTo={vm.goTo} />
            {vm.step === 'month' && <MonthStep month={vm.month} setSource={vm.setSource} uploadHref={links.upload} Link={Link} />}
            {vm.step === 'move' && <MoveStep move={vm.move} futureHref={links.future} Link={Link} />}
            {vm.step === 'future' && <FutureStep future={vm.future} />}
            <StepNav vm={vm} />
          </>
        )}
      </Stack>
    </main>
  );
}

function Stepper({ steps, step, goTo }: Pick<CheckinVM, 'steps' | 'step' | 'goTo'>) {
  const current = steps.indexOf(step);
  return (
    <nav aria-label={t.stepsLabel}>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t.stepOf(current + 1, steps.length)}</p>
      <ol className="mt-sm grid grid-cols-3 gap-xs">
        {steps.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              aria-current={s === step ? 'step' : undefined}
              onClick={() => goTo(s)}
              className={cx(
                'w-full rounded-md px-sm py-sm text-left text-sm font-semibold leading-tight transition-colors',
                s === step ? 'bg-primary text-on-primary' : i < current ? 'bg-surface-strong text-text' : 'bg-surface text-text-muted',
              )}
            >
              {t.steps[s]}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function StepNav({ vm }: { vm: CheckinVM }) {
  const i = vm.steps.indexOf(vm.step);
  const last = i === vm.steps.length - 1;
  return (
    <Row justify="between">
      <Button variant="ghost" onClick={vm.back} disabled={i === 0}>
        {t.back}
      </Button>
      {last ? <Button onClick={vm.finish}>{t.finish}</Button> : <Button onClick={vm.next}>{t.next}</Button>}
    </Row>
  );
}

// ----- Step 1: your month ---------------------------------------------------------------------

function MonthNumbers({ month, data }: { month: CheckinMonthVM; data: MonthEnd }) {
  const m = t.month;
  const enoughHistory = month.historyMonths >= month.historyNeeded;
  return (
    <Stack gap="md">
      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
        <Stat
          label={month.month === null ? m.projected : month.inProgress ? m.projectedInProgress : m.projected}
          value={<Money value={data.projectedSpend} />}
          size="lg"
          hint={month.month === null ? m.noDataHint : month.inProgress ? m.inProgressHint : m.completeHint}
        />
        {month.takeHome && (
          <Stat
            label={month.source === 'sample' ? m.takeHomeSample : m.takeHome}
            value={<Money value={month.takeHome.value} />}
            isEstimate={month.takeHome.isEstimate}
          />
        )}
      </div>
      {data.vsAverage !== null ? (
        <p className="text-sm" data-testid="checkin-vs-average">
          <span className="text-text-muted">{m.vsAverage}: </span>
          <span className={cx('font-semibold tabular-nums', data.vsAverage > 0 ? 'text-negative' : 'text-positive')}>
            {m.vsAverageValue(formatMoney(data.vsAverage, { signed: true }))}
          </span>
        </p>
      ) : (
        month.month !== null && !enoughHistory && <p className="text-sm text-text-muted">{m.needHistory(month.historyMonths)}</p>
      )}
      {data.vsAverage !== null && (
        <section aria-labelledby="checkin-drifts">
          <h3 id="checkin-drifts" className="text-base font-semibold">
            {m.driftsTitle}
          </h3>
          {data.drifts.length === 0 ? (
            <p className="mt-xs text-sm text-text-muted">{m.noDrifts}</p>
          ) : (
            <ul className="mt-xs flex flex-col gap-xs" data-testid="checkin-drifts">
              {data.drifts.map((d) => (
                <li key={d.category} className="flex items-center justify-between gap-sm rounded-md bg-surface px-md py-sm text-sm">
                  <span>{m.drift(common.categories[d.category], formatMoney(d.delta, { signed: true }))}</span>
                  <span className={cx('text-xs font-semibold uppercase', d.delta > 0 ? 'text-negative' : 'text-positive')}>
                    {d.delta > 0 ? m.over : m.under}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </Stack>
  );
}

function MonthStep({
  month,
  setSource,
  uploadHref,
  Link,
}: {
  month: CheckinMonthVM;
  setSource: CheckinVM['setSource'];
  uploadHref: string;
  Link: LinkComponent;
}) {
  const m = t.month;
  return (
    <Card title={month.month ? m.title(month.month) : m.titleNoData} data-testid="checkin-month">
      <Stack gap="lg">
        {month.hasUploads ? (
          <Choice
            legend={m.sourceLabel}
            name="checkin-source"
            value={month.source}
            options={[
              { value: 'uploads', label: m.sources.uploads },
              { value: 'sample', label: m.sources.sample },
            ]}
            onChange={setSource}
          />
        ) : (
          <p className="text-sm text-text-muted">{m.noUploads}</p>
        )}
        {month.source === 'sample' && (
          <div role="note" className="flex flex-col items-start gap-sm rounded-md border border-dashed border-text-muted p-md text-sm">
            <p>{m.sampleNote}</p>
            <Link href={uploadHref} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
              {m.upload}
            </Link>
          </div>
        )}
        {month.result.status === 'ready' ? (
          <MonthNumbers month={month} data={month.result.data} />
        ) : month.result.status === 'error' ? (
          <ErrorNote error={month.result.error} />
        ) : null}
      </Stack>
    </Card>
  );
}

// ----- Step 2: your move ----------------------------------------------------------------------

function Progress({ progress }: { progress: MoveProgressVM }) {
  const m = t.move;
  if (progress.kind === 'cardPayoff') {
    const months = (n: number | null) => (n === null ? m.notWithin10y : m.payoffMonths(n));
    return <p className="text-sm">{m.cardPayoff(months(progress.payoffMonthWith), months(progress.payoffMonthWithout))}</p>;
  }
  return (
    <Stack gap="xs">
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
    </Stack>
  );
}

function MoveStep({ move, futureHref, Link }: { move: CheckinMoveVM; futureHref: string; Link: LinkComponent }) {
  const m = t.move;
  const seeAll = (
    <Link href={futureHref} className={cx(buttonClassName({ variant: 'ghost', size: 'sm' }), 'self-start')}>
      {m.seeAll}
    </Link>
  );

  if (move.answer === 'done' && move.doneMove) {
    return (
      <Card title={m.doneTitle} tone="arena" data-testid="checkin-move">
        <Stack gap="sm">
          <p>{m.doneBody(moveTitle(move.doneMove))}</p>
          {move.level === 2 && <p className="text-sm text-text-muted">{m.level2}</p>}
        </Stack>
      </Card>
    );
  }

  if (move.committed) {
    const c = move.committed;
    return (
      <Card title={m.title} data-testid="checkin-move">
        <Stack gap="md">
          <Stat
            label={m.committedLabel}
            value={moveTitle(c)}
            hint={m.effect(formatMoney(c.effect10y, { signed: true }))}
          />
          {move.progress?.status === 'ready' && move.progress.data && <Progress progress={move.progress.data} />}
          {move.progress?.status === 'error' && <ErrorNote error={move.progress.error} />}
          {move.answer === 'keepGoing' ? (
            <div role="status" className="rounded-md bg-surface p-md text-sm">
              <p className="font-semibold">{m.keepTitle}</p>
              <p className="text-text-muted">{m.keepBody}</p>
            </div>
          ) : (
            <Stack gap="sm">
              <p className="font-semibold">{m.question}</p>
              <Row>
                <Button onClick={move.markDone}>{m.done}</Button>
                <Button variant="secondary" onClick={move.keepGoing}>
                  {m.keepGoing}
                </Button>
              </Row>
            </Stack>
          )}
          {move.level === 2 && <p className="text-xs text-text-muted">{m.level2}</p>}
          {seeAll}
        </Stack>
      </Card>
    );
  }

  return (
    <Card title={m.noneTitle} data-testid="checkin-move">
      <Stack gap="md">
        <p className="text-sm text-text-muted">{m.noneBody}</p>
        {move.suggestions.status === 'ready' ? (
          move.suggestions.data.length === 0 ? (
            <p className="text-sm text-text-muted">{m.noMoves}</p>
          ) : (
            <ul className="flex flex-col gap-sm">
              {move.suggestions.data.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-sm rounded-md bg-surface p-md">
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
      </Stack>
    </Card>
  );
}

// ----- Step 3: your 10 years ------------------------------------------------------------------

function FutureStep({ future }: { future: CheckinVM['future'] }) {
  const f = t.future;
  if (future.status === 'error') return <ErrorNote error={future.error} />;
  if (future.status !== 'ready') return null;
  const d = future.data;
  return (
    <Card title={f.title} data-testid="checkin-future">
      <Stack gap="md">
        <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
          <div>
            <Stat label={f.headline} value={<Money value={d.in10y.mid} />} size="lg" hint={f.hint} isEstimate={!d.bandIsZero} />
            <RangeText point={d.in10y} show={!d.bandIsZero} />
          </div>
          {d.withMove && (
            <Stat
              label={f.withMove}
              value={<Money value={d.withMove.in10y.mid} />}
              hint={moveTitle(d.withMove.move)}
              tone="positive"
            />
          )}
        </div>
        <ForecastChart
          title={f.chartTitle}
          series={{ label: f.seriesLabel, points: d.points }}
          compare={d.withMove ? { label: f.withMoveLabel(moveTitle(d.withMove.move)), points: d.withMove.points } : undefined}
          showBand={!d.bandIsZero}
          footnote={f.footnote}
        />
      </Stack>
    </Card>
  );
}

// ----- Summary --------------------------------------------------------------------------------

function Summary({ vm, links, Link }: { vm: CheckinVM; links: CheckinLinks; Link: LinkComponent }) {
  const s = t.summary;
  const { month, move, future } = vm;
  const moveLine =
    move.answer === 'done' && move.doneMove
      ? s.moveDone(moveTitle(move.doneMove))
      : move.committed
        ? s.moveKept(moveTitle(move.committed))
        : s.moveNone;
  return (
    <Card title={s.title} tone="arena" data-testid="checkin-summary">
      <Stack gap="lg">
        <dl className="grid grid-cols-1 gap-md sm:grid-cols-3">
          <div>
            <dt className="text-sm text-text-muted">{s.month}</dt>
            <dd className="font-display text-2xl font-extrabold tabular-nums">
              {month.result.status === 'ready' ? <Money value={month.result.data.projectedSpend} /> : '—'}
            </dd>
            {month.result.status === 'ready' && month.result.data.vsAverage !== null && (
              <dd className="text-sm">{t.month.vsAverageValue(formatMoney(month.result.data.vsAverage, { signed: true }))}</dd>
            )}
          </div>
          <div>
            <dt className="text-sm text-text-muted">{s.move}</dt>
            <dd className="font-semibold">{moveLine}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-sm text-sm text-text-muted">
              {s.future}
              {future.status === 'ready' && !future.data.bandIsZero && <EstimateTag />}
            </dt>
            <dd className="font-display text-2xl font-extrabold tabular-nums">
              {future.status === 'ready' ? <Money value={future.data.in10y.mid} /> : '—'}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-text-muted">{s.note}</p>
        <Row>
          <Link href={links.future} className={buttonClassName({ variant: 'dark' })}>
            {s.future10y}
          </Link>
          <Button variant="secondary" onClick={vm.restart}>
            {t.restart}
          </Button>
        </Row>
      </Stack>
    </Card>
  );
}
