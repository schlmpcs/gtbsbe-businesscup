// The landing's live demo of the idea: one question, the chance of success, the house and the Life line
// chart with the "Buy a home" pill to drag. Presentational: everything comes from LifeLineVM.
'use client';

import { lifeline as t } from '@/copy';
import { Art, cx, Icon } from '@/ui-kit';
import type { LifeLineVM } from '../model/types';
import { LifeLineChart } from './LifeLineHero';

export function LifeLineTeaser({ vm }: { vm: LifeLineVM }) {
  if (vm.status !== 'ready') {
    return <div aria-busy="true" className="aspect-[4/3] w-full animate-pulse rounded-xl bg-surface shadow-md" />;
  }
  const chance = vm.kpis.find((k) => k.id === 'chance')!;
  const good = vm.house.tone === 'good';
  return (
    <section data-testid="lifeline-teaser" className="relative flex flex-col gap-md rounded-xl bg-surface p-lg shadow-lg ring-1 ring-border sm:p-xl">
      <div className="flex items-start justify-between gap-md">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-text-muted">{t.teaser.eyebrow}</p>
          <p className="font-display text-2xl font-extrabold leading-tight" aria-live="polite">
            {vm.headline.lead}
            {vm.headline.payoff && (
              <span className={vm.headline.payoffTone === 'bad' ? 'text-negative' : 'text-primary'}>{`, ${vm.headline.payoff}`}</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-sm">
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">{chance.label}</p>
            <p className={cx('font-display text-4xl font-extrabold tabular-nums transition-colors', chance.value === null ? 'text-text-muted' : good ? 'text-positive' : 'text-negative')}>
              {chance.value ?? '…'}
            </p>
          </div>
          <div key={vm.house.art} className="ob-pop hidden w-[96px] sm:block" aria-hidden="true">
            <Art name={vm.house.art} loading="eager" className="w-full" />
          </div>
        </div>
      </div>
      <LifeLineChart chart={vm.chart} drag={{ min: vm.slider.min, max: vm.slider.max, onAge: vm.setAge, hint: t.chart.dragHint }} />
      <p className="flex items-center gap-xs text-sm font-semibold text-primary">
        <Icon name="arrowLeft" size={14} /><Icon name="arrowRight" size={14} />
        {t.teaser.hint}
      </p>
    </section>
  );
}
