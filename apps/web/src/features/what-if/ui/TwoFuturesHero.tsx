'use client';

// The What if? presets playing on the sample life, one every few seconds: a hero for S1 (not
// wired into a page yet). Presentational: everything comes from useTwoFuturesHero.
import { whatIf as t } from '@/copy';
import { buttonClassName, cx } from '@/ui-kit';
import type { TwoFuturesHeroVM } from '../model/types';
import { ChoiceCard } from './ChoiceCard';
import { ResultHeadline } from './ResultCard';
import { TwoFuturesChart } from './TwoFuturesChart';
import { VsBadge } from './WhatIfScreen';

export function TwoFuturesHero({ vm, className }: { vm: TwoFuturesHeroVM; className?: string }) {
  return (
    <section
      aria-roledescription="carousel"
      aria-label={t.hero.title}
      data-testid="two-futures-hero"
      className={cx('flex w-full min-w-0 flex-col gap-lg rounded-xl bg-surface p-lg shadow-lg sm:p-2xl', className)}
    >
      <div className="flex flex-wrap items-end justify-between gap-md">
        <div className="flex min-w-0 flex-col gap-xs">
          <h2 className="font-display text-3xl font-extrabold leading-display sm:text-4xl">{t.hero.title}</h2>
          <p className="text-text-muted">{t.hero.lead}</p>
        </div>
        <span className="rounded-full bg-surface-strong px-sm py-xs text-xs font-semibold text-text-muted">{t.hero.sample}</span>
      </div>

      <p aria-live="polite" className="text-sm font-bold text-text">
        {t.presets[vm.presetId]}
      </p>

      <div className="grid grid-cols-1 items-center gap-0 sm:grid-cols-[1fr_auto_1fr] sm:gap-sm">
        <ChoiceCard choice={vm.A} compact />
        <VsBadge className="-my-sm size-2xl justify-self-center text-sm sm:my-0" />
        <ChoiceCard choice={vm.B} compact />
      </div>

      <TwoFuturesChart chart={vm.chart} scrubber={false} size="md" />
      <ResultHeadline result={vm.result} size="md" />

      <div className="flex flex-wrap items-center justify-between gap-md">
        <div className="flex gap-xs" role="group" aria-label={t.presetsLabel}>
          {Array.from({ length: vm.count }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1} / ${vm.count}`}
              aria-current={i === vm.index}
              onClick={() => vm.select(i)}
              className={cx('h-sm rounded-full transition-all', i === vm.index ? 'w-xl bg-primary' : 'w-sm bg-border hover:bg-text-muted')}
            />
          ))}
        </div>
        <a href={vm.href} className={buttonClassName({ variant: 'primary' })}>
          {t.hero.cta}
        </a>
      </div>
      <p className="text-xs text-text-muted">{t.chart.range} {t.chart.rulesLabel}. {t.chart.todaysDollars}.</p>
    </section>
  );
}
