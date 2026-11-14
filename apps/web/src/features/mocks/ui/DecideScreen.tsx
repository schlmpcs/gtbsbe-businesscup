'use client';

// S13 Decision, car example (Figma Design v3, node 194:1866): keep the car or lease a new one. Presentational: every
// number comes from useDecide() (the user's profile through the engine's forecast / simulate; the
// lease terms are the user's, starting from an illustrative fixture).
import type { ReactNode } from 'react';
import { forecast, mocks } from '@/copy';
import {
  Art, Button, Card, cx, EstimateTag, Field, formatMoney, Money, NumberInput, Scoreboard, Sticker, Tag, type ArtName,
} from '@/ui-kit';
import type { DecideResultVM, DecideVM, LeaseField } from '../model/types';
import { PreviewBadge } from './PreviewBadge';
import { ErrorNote, Loading, type LinkComponent } from './shared';

const t = mocks.decide;

type Tone = 'better' | 'worse';

function PathTile({
  title,
  art,
  rows,
  effect,
  tone,
  horizonYear,
  footnote,
}: {
  title: string;
  art: ArtName;
  rows: { label: string; value: ReactNode }[];
  /** This path's own 10-year net worth (today's dollars, mid). */
  effect: number;
  tone: Tone;
  horizonYear: number;
  /** Collapsed under the rows: a summary label and the text. */
  footnote?: { title: string; body: string };
}) {
  const better = tone === 'better';
  return (
    <Card
      as="section"
      aria-label={title}
      data-better={better || undefined}
      className={cx('relative flex min-w-0 flex-col gap-lg p-xl sm:p-2xl', better && 'inset-ring-3 inset-ring-positive')}
    >
      {better && (
        <Sticker tone="positive" tilt={4} className="absolute -top-sm right-xl">
          {t.better}
        </Sticker>
      )}
      <Art name={art} className="mx-auto w-3/4 max-w-(--container-3xs)" />
      <div className="flex flex-col gap-md">
        <h2 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{title}</h2>
        <dl className="flex flex-col gap-xs text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-wrap items-baseline justify-between gap-x-md">
              <dt className="text-text-muted">{r.label}</dt>
              <dd className="text-right font-bold tabular-nums">{r.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-sm flex flex-col gap-xs">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t.effectLabel}</span>
          <p className="flex flex-wrap items-baseline gap-x-sm">
            <Money
              value={effect}
              compact
              className={cx(
                'font-display text-5xl font-extrabold leading-display tabular-nums sm:text-display',
                better ? 'text-positive' : 'text-primary',
              )}
            />
            <span className="text-sm text-text-muted">{t.effectBy(horizonYear)}</span>
          </p>
        </div>
        {footnote && (
          <details className="text-xs text-text-muted">
            <summary className="cursor-pointer font-medium">{footnote.title}</summary>
            <p className="mt-xs">{footnote.body}</p>
          </details>
        )}
      </div>
    </Card>
  );
}

function Paths({ vm, r }: { vm: DecideVM; r: DecideResultVM }) {
  const demo = vm.isDemoProfile;
  const { keep } = r;
  const f = vm.lease.form;
  const est = (field: LeaseField, value: ReactNode) => (
    <span className="inline-flex flex-wrap items-center justify-end gap-xs">
      {value}
      {vm.lease.isEstimate[field] && <EstimateTag />}
    </span>
  );
  return (
    <div className="grid grid-cols-1 gap-xl lg:grid-cols-2">
      <PathTile
        title={demo ? t.keep.title : t.keep.titleOwn}
        art="home-family"
        tone={r.better === 'keep' ? 'better' : 'worse'}
        effect={r.keep.in10y.mid}
        horizonYear={vm.horizonYear}
        rows={[
          {
            label: t.keep.loanLeft,
            value:
              keep.loanLeft > 0
                ? t.keep.loanLeftValue(formatMoney(keep.loanLeft), keep.monthsLeft === null ? t.never : t.months(keep.monthsLeft))
                : t.keep.noLoan,
          },
          { label: t.keep.payment, value: t.perMonth(formatMoney(keep.loanPayment)) },
          {
            label: t.keep.running,
            value: (
              <span className="inline-flex flex-wrap items-center justify-end gap-xs">
                {t.perMonth(formatMoney(keep.running))}
                {keep.runningIsEstimate && <EstimateTag />}
              </span>
            ),
          },
        ]}
      />
      <PathTile
        title={demo ? t.lease.title : t.lease.titleOwn}
        art="coins"
        tone={r.better === 'lease' ? 'better' : 'worse'}
        effect={r.lease.in10y.mid}
        horizonYear={vm.horizonYear}
        footnote={{ title: t.lease.assumptionTitle, body: t.lease.assumption(r.lease.signings) }}
        rows={[
          { label: t.lease.lease, value: est('monthly', t.lease.leaseValue(formatMoney(f.monthly ?? 0), t.months(f.termMonths ?? 0))) },
          { label: t.lease.dueAtSigning, value: est('dueAtSigning', <Money value={f.dueAtSigning ?? 0} />) },
          { label: t.lease.running, value: est('running', t.perMonth(formatMoney(f.running ?? 0))) },
        ]}
      />
    </div>
  );
}

/** The answer in one sentence: which path leaves you richer, and by how much (from the view-model). */
function Verdict({ vm, r }: { vm: DecideVM; r: DecideResultVM }) {
  const v = t.verdict;
  const demo = vm.isDemoProfile;
  const amount = formatMoney(r.betterBy10y, { compact: true });
  const path = r.better === 'keep' ? (demo ? v.keep : v.keepOwn) : demo ? v.lease : v.leaseOwn;
  return (
    <p data-testid="decide-verdict" className="text-center font-display text-2xl font-extrabold leading-tight sm:text-3xl">
      {amount === formatMoney(0, { compact: true }) ? v.same(vm.horizonYear) : v.richer(path, amount, vm.horizonYear)}
    </p>
  );
}

function Result({ vm, r }: { vm: DecideVM; r: DecideResultVM }) {
  const demo = vm.isDemoProfile;
  const verb = r.better === 'keep' ? (demo ? t.score.keepVerb : t.score.keepVerbOwn) : demo ? t.score.leaseVerb : t.score.leaseVerbOwn;
  return (
    <div className="flex flex-col gap-sm">
      <Scoreboard
        label={t.scoreLabel}
        className="sm:grid-cols-3"
        items={[
          { id: 'advantage', value: <Money value={r.betterBy10y} />, label: t.score.advantage(verb), tone: 'positive' },
          {
            id: 'months',
            value: r.keep.loanLeft <= 0 ? t.score.noLoan : r.keep.monthsLeft === null ? t.never : t.score.monthsLeftValue(r.keep.monthsLeft),
            label: t.score.monthsLeft,
          },
          {
            id: 'saving',
            value: <Money value={Math.abs(r.monthlySavingAfterPayoff)} />,
            label: r.monthlySavingAfterPayoff >= 0 ? t.score.saving : t.score.extra,
          },
        ]}
      />
      <p className="flex flex-wrap items-center gap-sm text-xs text-text-muted">
        {t.footnote(vm.horizonYear)}
        <Tag data-testid="decide-forecast-source" data-source={r.forecastSource}>
          {forecast.source[r.forecastSource]}
        </Tag>
        {r.isEstimate && <EstimateTag />}
      </p>
    </div>
  );
}

const FIELDS: { field: LeaseField; label: string; prefix?: string; suffix?: string; hint?: string; whole?: boolean; max?: number }[] = [
  { field: 'monthly', label: t.edit.monthly, prefix: '$', suffix: t.edit.monthlySuffix },
  { field: 'termMonths', label: t.edit.termMonths, suffix: t.edit.termSuffix, whole: true, max: 120 },
  { field: 'dueAtSigning', label: t.edit.dueAtSigning, prefix: '$' },
  { field: 'running', label: t.edit.running, prefix: '$', suffix: t.edit.monthlySuffix, hint: t.edit.runningHint },
];

function LeaseEditor({ vm }: { vm: DecideVM }) {
  const { form, isEstimate, invalidFields } = vm.lease;
  return (
    <Card
      title={t.edit.title}
      action={
        <Button size="sm" variant="ghost" onClick={vm.resetLease}>
          {t.edit.reset}
        </Button>
      }
    >
      <p className="mb-md text-sm text-text-muted">{t.edit.intro}</p>
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        {FIELDS.map((x) => (
          <Field
            key={x.field}
            label={x.label}
            hint={x.hint}
            isEstimate={isEstimate[x.field]}
            error={invalidFields.includes(x.field) ? t.edit.errors[x.field] : undefined}
          >
            <NumberInput
              name={`lease-${x.field}`}
              prefix={x.prefix}
              suffix={x.suffix}
              max={x.max}
              maxFractionDigits={x.whole ? 0 : 2}
              value={form[x.field]}
              onValueChange={(v) => vm.setLease({ [x.field]: v })}
            />
          </Field>
        ))}
      </div>
      {invalidFields.length > 0 && <p className="mt-md text-sm text-negative">{t.edit.fix}</p>}
    </Card>
  );
}

export function DecideScreen({ vm, Link }: { vm: DecideVM; Link: LinkComponent }) {
  const r = vm.result;
  return (
    <main className="mx-auto flex w-full max-w-(--container-7xl) flex-col gap-2xl px-lg py-xl">
      <header className="flex flex-col items-center gap-lg text-center">
        <PreviewBadge Link={Link} label={t.eyebrow} tone="ink" showPro={false} align="center" />
        <h1 className="font-display text-4xl font-extrabold leading-display sm:text-display lg:text-[length:calc(var(--text-display)*1.4)]">
          {vm.isDemoProfile ? t.title : t.titleOwn}
        </h1>
      </header>

      {vm.status === 'loading' ? (
        <Loading />
      ) : (
        <>
          {r?.status === 'ready' && (
            <>
              <Verdict vm={vm} r={r.data} />
              <Paths vm={vm} r={r.data} />
              <Result vm={vm} r={r.data} />
            </>
          )}
          {r?.status === 'error' && <ErrorNote error={r.error} />}
          <LeaseEditor vm={vm} />
        </>
      )}

    </main>
  );
}
