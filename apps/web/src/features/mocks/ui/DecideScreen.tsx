'use client';

// S13 Decision, car example (Figma S13). A mock screen (T11): every number comes from the view-model
// (demo profile + engine forecast / payoffOrder; the lease terms are mock inputs in ../model).
import { mocks } from '@/copy';
import { Art, Card, cx, formatMoney, Money, Scoreboard, Sticker, type ArtName } from '@/ui-kit';
import type { ReactNode } from 'react';
import type { DecideVM } from '../model/types';
import { PreviewBadge } from './PreviewBadge';

const t = mocks.decide;

function PathTile({
  title,
  art,
  rows,
  effect,
  horizonYear,
  tilt,
  footnote,
}: {
  title: string;
  art: ArtName;
  rows: { label: string; value: ReactNode }[];
  effect: number;
  horizonYear: number;
  tilt: number;
  footnote?: string;
}) {
  return (
    <Card as="section" aria-label={title} className="flex min-w-0 flex-col gap-lg p-md sm:p-lg" style={{ transform: `rotate(${tilt}deg)` }}>
      <Art name={art} imgClassName="aspect-video" />
      <div className="flex flex-col gap-md px-sm pb-sm">
        <h2 className="text-2xl font-extrabold leading-tight sm:text-3xl">{title}</h2>
        <dl className="flex flex-col gap-xs">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-wrap items-baseline justify-between gap-x-md">
              <dt className="text-text-muted">{r.label}</dt>
              <dd className="text-right font-bold tabular-nums">{r.value}</dd>
            </div>
          ))}
        </dl>
        <p className="flex flex-wrap items-baseline gap-x-sm">
          <span
            className={cx(
              'font-display text-4xl font-extrabold leading-tight tabular-nums sm:text-display sm:leading-display',
              effect >= 0 ? 'text-positive' : 'text-primary',
            )}
          >
            <Money value={effect} signed />
          </span>
          <span className="text-text-muted">{t.byYear(horizonYear)}</span>
          <span className="sr-only">{t.vsOther}</span>
        </p>
        {footnote && <p className="text-xs text-text-muted">{footnote}</p>}
      </div>
    </Card>
  );
}

export function DecideScreen({ vm }: { vm: DecideVM }) {
  const { keep, lease } = vm;
  return (
    <main className="mx-auto flex w-full max-w-(--container-7xl) flex-col gap-2xl px-lg py-xl">
      <header className="flex flex-col items-center gap-md text-center">
        <PreviewBadge />
        <Sticker tone="ink">{t.eyebrow}</Sticker>
        <h1 className="text-4xl leading-display sm:text-display lg:text-[calc(var(--text-display)*1.4)]">{t.title}</h1>
      </header>

      <div className="grid grid-cols-1 items-center gap-xl lg:grid-cols-[1fr_auto_1fr]">
        <PathTile
          title={t.keep.title}
          art="austin"
          tilt={-1}
          horizonYear={vm.horizonYear}
          effect={vm.keepAdvantage10y}
          rows={[
            {
              label: t.keep.loanLeft,
              value: t.keep.loanLeftValue(formatMoney(keep.loanLeft), keep.monthsLeft === null ? t.never : t.months(keep.monthsLeft)),
            },
            { label: t.keep.payment, value: t.perMonth(formatMoney(keep.loanPayment)) },
            { label: t.keep.running, value: t.perMonth(formatMoney(keep.running)) },
            { label: t.keep.afterPayoff, value: t.keep.afterPayoffValue(formatMoney(keep.loanPayment)) },
          ]}
        />
        <div
          aria-hidden="true"
          className="mx-auto flex aspect-square w-fit items-center justify-center rounded-full bg-ink p-lg font-display text-xl font-extrabold text-on-primary sm:p-2xl sm:text-4xl"
        >
          {t.vs}
        </div>
        <PathTile
          title={t.lease.title}
          art="loan"
          tilt={1}
          horizonYear={vm.horizonYear}
          effect={-vm.keepAdvantage10y}
          footnote={t.lease.assumption}
          rows={[
            { label: t.lease.lease, value: t.lease.leaseValue(formatMoney(lease.monthly), t.months(lease.termMonths)) },
            { label: t.lease.dueAtSigning, value: <Money value={lease.dueAtSigning} /> },
            { label: t.lease.running, value: t.perMonth(formatMoney(lease.running)) },
          ]}
        />
      </div>

      <div className="flex flex-col gap-sm">
        <Scoreboard
          label={t.scoreLabel}
          className="sm:grid-cols-3"
          items={[
            {
              id: 'advantage',
              value: <Money value={vm.betterBy10y} signed />,
              label: t.score.advantage(vm.better === 'keep' ? t.score.keepVerb : t.score.leaseVerb),
              tone: 'positive',
            },
            {
              id: 'months',
              value: keep.monthsLeft === null ? t.never : t.score.monthsLeftValue(keep.monthsLeft),
              label: t.score.monthsLeft,
            },
            { id: 'saving', value: <Money value={vm.monthlySavingAfterPayoff} />, label: t.score.saving },
          ]}
        />
        <p className="text-xs text-text-muted">{t.footnote(vm.horizonYear)}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-sm">
        <span className="text-text-muted">{t.nextTitle}</span>
        {t.next.map((d) => (
          <span key={d} className="rounded-full border-2 border-border bg-surface px-lg py-sm font-medium">
            {d}
            <span className="sr-only"> ({t.nextSoon})</span>
          </span>
        ))}
      </div>
    </main>
  );
}
