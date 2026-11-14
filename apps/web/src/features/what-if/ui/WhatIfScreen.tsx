'use client';

// /what-if: "Two choices. Two futures." Presentational: everything comes from useWhatIf.
import { whatIf as t } from '@/copy';
import { Button, LockNotice, cx, formatMoney } from '@/ui-kit';
import type { ChoiceVM, WhatIfVM } from '../model/types';
import { AskBox } from './AskBox';
import { ChoiceCard, LETTER_TEXT } from './ChoiceCard';
import { ResultCard } from './ResultCard';
import { SIDE_COLOR, TwoFuturesChart } from './TwoFuturesChart';

export function VsBadge({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'z-10 flex size-3xl shrink-0 items-center justify-center rounded-full bg-ink font-display text-lg font-extrabold text-on-primary shadow-lg ring-4 ring-bg',
        className,
      )}
    >
      {t.vs}
    </span>
  );
}

function EndValue({ choice, value, year }: { choice: ChoiceVM; value: number; year: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-xs">
      <span className="flex min-w-0 items-center gap-xs text-sm font-semibold text-text-muted">
        <span className={cx('font-extrabold', LETTER_TEXT[choice.letter])}>{choice.letter}</span>
        <span className="truncate">{choice.title}</span>
      </span>
      <span
        data-testid={`end-${choice.letter}`}
        className={cx(
          'font-display text-3xl font-extrabold leading-display whitespace-nowrap tabular-nums sm:text-display',
          value < 0 && 'text-text-muted',
        )}
        style={value < 0 ? undefined : { color: SIDE_COLOR[choice.letter] }}
      >
        {formatMoney(value, { compact: value >= 1e6 || value <= -1e6 })}
      </span>
      <span className="text-xs text-text-muted">{t.chart.endYear(year)}</span>
    </div>
  );
}

export function WhatIfScreen({ vm }: { vm: WhatIfVM }) {
  return (
    <main className="mx-auto flex w-full max-w-(--container-5xl) flex-col gap-xl px-lg py-xl sm:gap-2xl sm:py-2xl">
      <header className="flex flex-col gap-md">
        <h1 className="font-display text-4xl font-extrabold leading-display text-balance sm:text-display">{t.pageTitle}</h1>
        <p className="max-w-(--container-xl) text-lg text-text-muted">{t.pageLead}</p>
        {(vm.isSample || vm.homeAssumed) && (
          <p className="text-sm text-text-muted">{vm.homeAssumed ? t.homeAssumed(vm.homeAssumed) : t.sampleNote}</p>
        )}
      </header>

      <div role="group" aria-label={t.presetsLabel} className="-mx-lg flex gap-sm overflow-x-auto px-lg pb-xs sm:mx-0 sm:flex-wrap sm:px-0">
        {vm.presets.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.selected}
            onClick={() => vm.selectPreset(p.id)}
            className={cx(
              'shrink-0 rounded-full border-2 px-lg py-sm text-sm font-bold whitespace-nowrap transition-colors',
              p.selected ? 'border-ink bg-ink text-on-primary' : 'border-border bg-surface text-text hover:border-ink',
            )}
          >
            {t.presets[p.id] ?? p.id}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-stretch gap-0 md:grid-cols-[1fr_auto_1fr] md:gap-md">
        <ChoiceCard choice={vm.A} onEdit={() => vm.edit('A')} />
        <VsBadge className="-my-md self-center justify-self-center md:my-0" />
        <ChoiceCard choice={vm.B} onEdit={() => vm.edit('B')} />
      </div>

      <AskBox ask={vm.ask} target={vm.editTarget} />

      {vm.status === 'error' && (
        <p role="alert" className="rounded-lg bg-surface p-lg text-sm">
          {t.ask.errors.unknown}
        </p>
      )}

      {vm.status === 'loading' && <div aria-busy="true" className="h-[calc(var(--spacing-3xl)*8)] animate-pulse rounded-xl bg-surface" />}

      {vm.chart && vm.result && (
        <>
          <section aria-label={t.chart.title} className="flex flex-col gap-lg rounded-xl bg-surface p-lg shadow-md sm:p-2xl">
            <div className="grid grid-cols-2 gap-lg">
              <EndValue choice={vm.A} value={vm.chart.A.end.mid} year={vm.result.endYear} />
              <EndValue choice={vm.B} value={vm.chart.B.end.mid} year={vm.result.endYear} />
            </div>
            <TwoFuturesChart chart={vm.chart} />
            <p className="flex flex-wrap items-center gap-x-md gap-y-xs text-xs text-text-muted">
              <span className="inline-flex items-center gap-xs font-semibold text-text">
                <span aria-hidden="true" className="inline-block h-sm w-lg rounded-full bg-primary-soft" />
                {t.chart.range}
              </span>
              <span>{t.chart.rangeHint}</span>
              <span className="rounded-full bg-surface-strong px-sm py-xs font-semibold">{t.chart.rulesLabel}</span>
              <span>{t.chart.todaysDollars}</span>
            </p>
          </section>

          <ResultCard result={vm.result}>
            <div className="flex flex-col gap-md">
              {vm.saveLocked ? (
                <LockNotice title={t.save.lockTitle} body={t.save.lockBody} ctaLabel={t.save.lockCta} href={vm.proHref} />
              ) : (
                <div>
                  <Button onClick={vm.save} disabled={vm.saved}>
                    {vm.saved ? t.save.saved : t.save.cta}
                  </Button>
                </div>
              )}
              <div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    vm.tryAnother();
                    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  {t.tryAnother}
                </Button>
              </div>
              <p className="text-xs text-text-muted">{t.result.source}</p>
            </div>
          </ResultCard>
        </>
      )}

      {vm.savedChoices.length > 0 && (
        <section className="flex flex-col gap-sm">
          <h2 className="text-lg font-bold">{t.save.listTitle}</h2>
          <ul className="flex flex-col gap-xs">
            {vm.savedChoices.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-sm rounded-lg bg-surface px-lg py-md">
                <span className="min-w-0 font-semibold">
                  <span className="text-ink">{s.titleA}</span> <span className="text-text-muted">{t.vs.toLowerCase()}</span>{' '}
                  <span className="text-primary">{s.titleB}</span>
                </span>
                <span className="flex gap-xs">
                  <Button size="sm" variant="secondary" onClick={() => vm.openSaved(s.id)}>
                    {t.save.open}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => vm.removeSaved(s.id)}>
                    {t.save.remove}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
