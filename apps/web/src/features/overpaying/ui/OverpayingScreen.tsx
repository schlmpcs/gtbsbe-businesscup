'use client';

// S23 "Are you paying more than typical?": the inputs on the left, the answer on the right (verdict pill,
// one sentence, gap per year, where the biggest gap is), then each line as a range chart with what paying
// the typical middle does to your plan. All data and actions come from useOverpaying() and
// useOverpayingImpacts(); nothing is computed here.
import type { ComponentType, ReactNode } from 'react';
import { overpaying as t } from '@/copy';
import { Art, Card, PageHeader, Stack, Tag, buttonClassName, cx, formatMoney } from '@/ui-kit';
import { CountUp, KpiStrip, MOTION } from '@/ui-kit/reports';
import type { BenchmarkLine, OverpayingResultVM, OverpayingVM, PlanImpactVM, VMError } from '../model/types';
import { BenchmarkRow } from './BenchmarkRow';
import { CoverageNotice } from './CoverageNotice';
import { InputsForm } from './InputsForm';
import { MetroPicker } from './MetroPicker';

function Skeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-md">
      <span className="sr-only">{t.loading}</span>
      {[0, 1, 2].map((i) => (
        <div key={i} aria-hidden="true" className={cx('animate-pulse rounded-lg bg-surface', i === 0 ? 'h-3xl' : 'h-2xl')} />
      ))}
    </div>
  );
}

function errorText(error: VMError): string {
  if (error.kind === 'invalidResponse') return t.errors.invalidResponse;
  return t.errors.unknown;
}

const PILL: Record<OverpayingResultVM['summary']['verdict'], string> = {
  above: 'bg-negative/15 text-negative',
  typical: 'bg-positive/15 text-positive',
  below: 'bg-surface-strong text-text',
};

/** The answer first: a status pill, one plain sentence, the key numbers and where the biggest gap is. */
function Summary({ data }: { data: OverpayingResultVM }) {
  const { summary } = data;
  const headline =
    summary.verdict === 'above' ? t.result.verdict.above(formatMoney(summary.gapPerYear)) : t.result.verdict[summary.verdict];
  return (
    <section data-testid="overpaying-summary" aria-label={t.result.summaryLabel} data-verdict={summary.verdict} className={cx('card card-pad flex flex-col gap-lg', MOTION.rise)}>
      <div className="flex flex-col gap-sm">
        <span className={cx('w-fit rounded-full px-md py-xs text-sm font-bold', PILL[summary.verdict])}>{t.result.verdict.pill[summary.verdict]}</span>
        <p className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{headline}</p>
        <p className="text-sm text-text-muted">{t.result.summaryLine(summary.compared, summary.above)}</p>
      </div>
      {summary.above > 0 && (
        <KpiStrip
          items={[
            { id: 'gap', label: t.result.gapPerYear, value: <CountUp value={summary.gapPerYear} format={(n) => formatMoney(n)} />, hint: t.result.gapPerYearHint, tone: 'negative' },
            { id: 'above', label: t.result.above, value: `${summary.above} / ${summary.compared}`, hint: t.result.compared },
          ]}
        />
      )}
      {summary.nextSteps.length > 0 && (
        <div className="flex flex-col gap-sm" data-testid="next-steps">
          <h3 className="text-base font-bold">{t.result.nextTitle}</h3>
          <ol className="flex flex-col gap-sm">
            {summary.nextSteps.map((step, i) => (
              <li key={step.line} className="flex gap-sm text-sm">
                <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <span>{t.result.next[step.line](formatMoney(step.mid))}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/** Which household the numbers are about: our assumption (with the estimate tag) until the person enters one. */
function HouseholdNote({ household }: { household: OverpayingVM['household'] }) {
  const what = t.result.household.describe(household.bedrooms, household.adults, household.kids);
  return (
    <p data-testid="household-note" data-household={household.source} className="flex flex-wrap items-center gap-x-sm gap-y-xs text-sm">
      {household.source === 'default' ? (
        <>
          <span>{t.result.household.default(what)}</span>
          <Tag variant="dashed" title={t.result.household.defaultWhy}>
            {t.result.estimate}
            <span className="sr-only">: {t.result.household.defaultWhy}</span>
          </Tag>
        </>
      ) : (
        <span>{t.result.household.entered(what)}</span>
      )}
    </p>
  );
}

function Skipped({ data }: { data: OverpayingResultVM }) {
  if (data.skipped.length === 0) return null;
  return (
    <section aria-label={t.result.skippedTitle} data-testid="skipped">
      <h3 className="mb-xs text-sm font-semibold text-text-muted">{t.result.skippedTitle}</h3>
      <ul className="flex flex-col gap-xs text-sm text-text-muted">
        {data.skipped.map((s) => (
          <li key={s.line} data-reason={s.reason}>
            {s.reason === 'noKids' ? t.result.skipped.noKids : t.result.skipped[s.reason](t.lines[s.line])}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Results({ vm, impacts, Link }: { vm: OverpayingVM; impacts: Partial<Record<BenchmarkLine, PlanImpactVM>>; Link?: LinkLike }) {
  const { result } = vm;
  if (result === null) {
    // A bad ZIP or amount already says so beside its box; a ZIP we do not cover is said by the coverage notice.
    const message = vm.invalidFields.length > 0 || vm.needs === 'metro' || vm.needs === null ? null : t.needs[vm.needs];
    return message ? (
      <p data-testid="needs" className="rounded-lg bg-surface p-lg text-sm text-text-muted">
        {message}
      </p>
    ) : null;
  }
  if (result.status !== 'ready') {
    return result.status === 'error' ? (
      <p role="alert" data-testid="overpaying-error" className="rounded-lg bg-surface p-lg text-sm font-medium text-negative">
        {errorText(result.error)}
      </p>
    ) : null;
  }
  const { data } = result;
  return (
    <Stack gap="lg" as="section" aria-labelledby="overpaying-result-title">
      <h2 id="overpaying-result-title" className="text-2xl font-bold leading-tight">
        {t.result.title}
      </h2>
      <HouseholdNote household={vm.household} />
      <Summary data={data} />
      {data.rows.length > 0 && (
        <ul className="flex flex-col gap-lg">
          {data.rows.map((row) => (
            <BenchmarkRow key={row.line} row={row} impact={impacts[row.line]} Link={Link} />
          ))}
        </ul>
      )}
      <Skipped data={data} />
      <p className="text-xs text-text-muted">{t.result.notAdvice}</p>
    </Stack>
  );
}

type LinkLike = ComponentType<{ href: string; className?: string; children?: ReactNode }>;

export type OverpayingScreenProps = {
  vm: OverpayingVM;
  /** Each line above its range measured on the plan (useOverpayingImpacts). */
  impacts?: Partial<Record<BenchmarkLine, PlanImpactVM>>;
  Link?: LinkLike;
};

const NO_IMPACTS: Partial<Record<BenchmarkLine, PlanImpactVM>> = {};

export function OverpayingScreen({ vm, impacts = NO_IMPACTS, Link }: OverpayingScreenProps) {
  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg pb-3xl pt-md">
      <Stack gap="2xl">
        <PageHeader
          eyebrow={vm.hidden ? undefined : t.eyebrow}
          title={t.screens.S23}
          intro={vm.hidden ? undefined : t.intro}
          aside={vm.hidden ? undefined : <Art name="coins" className="hidden h-28 w-28 items-center sm:flex" />}
        />
        {vm.hidden ? (
          <Card title={t.streamer.title} headingLevel={2} data-testid="streamer-notice">
            <Stack gap="md" align="start">
              <p className="text-text-muted">{t.streamer.body}</p>
              <a href={vm.playHref} className={buttonClassName({ variant: 'secondary' })}>
                {t.streamer.back}
              </a>
            </Stack>
          </Card>
        ) : vm.status === 'loading' ? (
          <Skeleton />
        ) : (
          <div className="grid grid-cols-1 items-start gap-2xl lg:grid-cols-[5fr_7fr]">
            <Stack gap="xl" className="min-w-0">
              <InputsForm vm={vm} />
              <CoverageNotice coverage={vm.coverage} counts={vm.coverageCounts} />
              {vm.metroPicker && <MetroPicker picker={vm.metroPicker} />}
            </Stack>
            <div className="min-w-0">
              <Results vm={vm} impacts={impacts} Link={Link} />
            </div>
          </div>
        )}
      </Stack>
    </main>
  );
}
