'use client';

// S14 Monthly check-in (Figma S14). A mock screen (T11): numbers come from the view-model (engine
// monthEnd / payoffOrder on fixtures, with labelled sample values in ../model until T9 lands).
import { mocks } from '@/copy';
import { Art, buttonClassName, Card, cx, formatMoney, formatRate, Money, Scoreboard, Sticker } from '@/ui-kit';
import { useId } from 'react';
import type { CheckinVM } from '../model/types';
import { PreviewBadge } from './PreviewBadge';

const t = mocks.checkin;
const TILTS = [-0.8, 0.6, -0.4, 0.8];

function headline(vm: CheckinVM): string {
  if (vm.direction === 'even') return t.titleEven;
  return vm.direction === 'over' ? t.titleOver(formatMoney(vm.difference)) : t.titleUnder(formatMoney(-vm.difference));
}

export function CheckinScreen({ vm }: { vm: CheckinVM }) {
  const tiles = [
    ...vm.drifts.map((d) => ({ category: d.category, delta: d.delta })),
    ...vm.onTrack.map((category) => ({ category, delta: 0 })),
  ];
  const driftId = useId();
  const progressPct = Math.min(100, Math.max(0, vm.move.progress * 100));

  return (
    <main className="mx-auto flex w-full max-w-(--container-7xl) flex-col gap-2xl px-lg py-xl">
      <header className="flex flex-col gap-lg sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-md">
          <PreviewBadge />
          <Sticker tone="ink">{t.eyebrow(vm.monthName)}</Sticker>
          <h1 className="max-w-(--container-4xl) text-4xl leading-display sm:text-display lg:text-[calc(var(--text-display)*1.5)]">
            {headline(vm)}
          </h1>
        </div>
        <Art name="checkin" framed tilt={4} className="w-1/2 max-w-(--container-3xs) shrink-0 self-end sm:w-full" />
      </header>

      <Scoreboard
        label={t.scoreLabel}
        items={[
          { id: 'projected', value: <Money value={vm.projected} />, label: t.projected },
          { id: 'average', value: <Money value={vm.average} />, label: t.average },
          {
            id: 'difference',
            value: <Money value={vm.difference} signed />,
            label: vm.direction === 'over' ? t.over : t.under,
            tone: vm.direction === 'over' ? 'primary' : 'positive',
          },
          { id: 'progress', value: formatRate(vm.move.progress, 0), label: t.progress, tone: 'positive' },
        ]}
      />

      <section aria-labelledby={driftId} className="flex flex-col gap-lg">
        <h2 id={driftId} className="text-3xl font-extrabold sm:text-4xl">
          {t.driftTitle}
        </h2>
        <ul className="grid grid-cols-1 gap-lg sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((d, i) => (
            <li key={d.category}>
              <Card className="flex h-full flex-col gap-xs" style={{ transform: `rotate(${TILTS[i % TILTS.length]}deg)` }}>
                <span className="text-lg font-semibold">{t.categories[d.category] ?? d.category}</span>
                <span
                  className={cx(
                    'font-display text-4xl font-extrabold leading-tight tabular-nums sm:text-display sm:leading-display',
                    d.delta > 0 ? 'text-primary' : d.delta < 0 ? 'text-positive' : 'text-text-muted',
                  )}
                >
                  <Money value={d.delta} signed={d.delta !== 0} />
                </span>
                <span className="text-sm text-text-muted">{d.delta === 0 ? t.onTrack : t.vsAverage}</span>
              </Card>
            </li>
          ))}
        </ul>
        {vm.source === 'fixture' && <p className="text-xs text-text-muted">{t.sampleSource}</p>}
      </section>

      <div className="grid grid-cols-1 items-center gap-xl lg:grid-cols-[2fr_1fr]">
        <Card as="section" aria-label={t.move.title} className="flex flex-col gap-md border-2 border-positive">
          <div className="flex flex-wrap items-center justify-between gap-md">
            <div className="flex items-center gap-md">
              <Sticker tone="positive">{t.move.sticker}</Sticker>
              <span className="text-xl font-bold">{t.move.title}</span>
            </div>
            <span className="font-bold tabular-nums">
              {t.move.ofTotal(formatMoney(vm.move.paid), formatMoney(vm.move.startBalance))}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={t.move.progressLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPct)}
            aria-valuetext={formatRate(vm.move.progress, 0)}
            className="h-md overflow-hidden rounded-full bg-surface-strong"
          >
            <div className="h-full rounded-full bg-positive" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-sm text-text-muted">
            {vm.move.monthsLeft === null ? t.move.never : t.move.pace(t.months(vm.move.monthsLeft))}
          </p>
        </Card>
        <a href={vm.uploadHref} className={buttonClassName({ size: 'lg', fullWidth: true })}>
          {t.addStatement(vm.nextStatementMonthName)}
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </main>
  );
}
