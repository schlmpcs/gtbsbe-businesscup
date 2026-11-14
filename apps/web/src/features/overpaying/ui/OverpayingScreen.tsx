'use client';

// S23 Overpaying check (placeholder UI; the designer's frames replace it). All data and actions come
// from useOverpaying(); nothing is computed here.
import { overpaying as t } from '@/copy';
import { Card, Money, PageHeader, Stack, Stat, Tag, buttonClassName, cx } from '@/ui-kit';
import type { OverpayingResultVM, OverpayingVM, VMError } from '../model/types';
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
  if (error.kind === 'notImplemented') return t.errors.notImplemented;
  if (error.kind === 'invalidResponse') return t.errors.invalidResponse;
  return t.errors.unknown;
}

/** The note under the 10-year figure when there is no total. */
function EffectNote({ data, profileHref }: { data: OverpayingResultVM; profileHref: string }) {
  switch (data.summary.effectStatus) {
    case 'partial':
      return <>{t.result.effectPartial}</>;
    case 'none':
      return <>{t.result.effectNoneAbove}</>;
    default:
      return (
        <>
          {t.result.effectNeedsProfile}{' '}
          <a href={profileHref} className="underline underline-offset-2">
            {t.result.effectNeedsProfileLink}
          </a>
        </>
      );
  }
}

function Summary({ data, profileHref }: { data: OverpayingResultVM; profileHref: string }) {
  const { summary } = data;
  return (
    <Card tone="muted" data-testid="overpaying-summary" aria-label={t.result.summaryLabel}>
      <Stack gap="lg">
        <p className="text-lg font-semibold">{t.result.summaryLine(summary.compared, summary.above)}</p>
        {summary.above > 0 && (
          <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
            <Stat
              label={t.result.gapPerYear}
              value={<Money value={summary.gapPerYear} />}
              hint={t.result.gapPerYearHint}
            />
            {summary.effect10y !== null ? (
              <Stat
                label={
                  <>
                    {t.result.effect10y}{' '}
                    <Tag variant="dashed" title={t.result.effectEstimateWhy}>
                      {t.result.estimate}
                      <span className="sr-only">: {t.result.effectEstimateWhy}</span>
                    </Tag>
                  </>
                }
                value={<Money value={summary.effect10y} />}
                hint={t.result.effectHint}
              />
            ) : (
              <Stat label={t.result.effect10y} value={t.result.effectNone} hint={<EffectNote data={data} profileHref={profileHref} />} />
            )}
          </div>
        )}
      </Stack>
    </Card>
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

function Results({ vm }: { vm: OverpayingVM }) {
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
      <Summary data={data} profileHref={vm.profileHref} />
      {data.rows.length > 0 && (
        <ul className="flex flex-col gap-lg">
          {data.rows.map((row) => (
            <BenchmarkRow key={row.line} row={row} effectAvailable={data.effectAvailable} profileHref={vm.profileHref} />
          ))}
        </ul>
      )}
      <Skipped data={data} />
      <p className="text-xs text-text-muted">{t.result.notAdvice}</p>
    </Stack>
  );
}

export function OverpayingScreen({ vm }: { vm: OverpayingVM }) {
  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl">
      <Stack gap="2xl">
        <PageHeader title={t.screens.S23} intro={vm.hidden ? undefined : t.intro} />
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
              <Results vm={vm} />
            </div>
          </div>
        )}
      </Stack>
    </main>
  );
}
