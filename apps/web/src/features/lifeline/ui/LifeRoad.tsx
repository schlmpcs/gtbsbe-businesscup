// The landing's hero: a sample life as a road from today to the end age, with the milestones of its plan
// standing along it. One of them moves: the arrows on "Buy a home" pick another year and every number
// (the chance, the net worth at retirement, when the cash runs out) is the engine's for that year.
// Presentational: everything comes from LifeLineVM. The illustration is decoration and carries no number.
'use client';

import type { CSSProperties } from 'react';
import { lifeline as t } from '@/copy';
import { cx, Icon } from '@/ui-kit';
import type { LifeLineVM } from '../model/types';

type Ready = Extract<LifeLineVM, { status: 'ready' }>;

/** Where each scene's label hangs over the illustration (share of its width and height). */
const SPOT = {
  today: { left: '10.6%', top: '45%' },
  home: { left: '37.2%', top: '40%' },
  retire: { left: '63.6%', top: '29%' },
  end: { left: '93.6%', top: '12.5%' },
} satisfies Record<string, CSSProperties>;

const LABEL = 'absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full px-sm py-xs text-xs font-bold shadow-md sm:px-md sm:text-sm';

function Stepper({ vm, className, testId, style }: { vm: Ready; className?: string; testId: string; style?: CSSProperties }) {
  const s = vm.slider;
  const arrow = 'flex size-9 shrink-0 items-center justify-center rounded-full transition hover:bg-on-primary/20 disabled:opacity-40';
  return (
    <div data-testid={testId} style={style} className={cx('items-center gap-xs rounded-full bg-primary p-xs text-on-primary shadow-lg', className)}>
      <button type="button" aria-label={t.road.sooner} disabled={s.value <= s.min} onClick={() => vm.setAge(s.value - 1)} className={arrow}>
        <Icon name="arrowLeft" size={16} />
      </button>
      <span className="px-xs text-sm font-extrabold tabular-nums sm:text-base">{t.road.home(s.value)}</span>
      <button type="button" aria-label={t.road.later} disabled={s.value >= s.max} onClick={() => vm.setAge(s.value + 1)} className={arrow}>
        <Icon name="arrowRight" size={16} />
      </button>
    </div>
  );
}

export function LifeRoad({ vm }: { vm: LifeLineVM }) {
  if (vm.status !== 'ready') {
    return <div aria-busy="true" className="aspect-video w-full animate-pulse rounded-xl bg-surface" />;
  }
  const chance = vm.kpis.find((k) => k.id === 'chance')!;
  const [firstAge, endAge] = vm.chart.ageDomain;
  const retire = vm.chart.markers.find((m) => m.id === 'retire');
  const good = vm.house.tone === 'good';
  const chanceTone = chance.value === null ? 'text-text-muted' : good ? 'text-positive' : 'text-negative';
  return (
    <section data-testid="life-road" aria-label={t.road.label} className="flex flex-col gap-md">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- one static illustration, decoration only */}
        <img src="/landing/life-road.webp" alt="" width={1536} height={864} className="block h-auto w-full select-none [mask-image:linear-gradient(to_right,transparent,#000_7%)]" draggable={false} />
        <span className={cx(LABEL, 'bg-surface text-text')} style={SPOT.today}>
          <span className="sm:hidden">{firstAge}</span><span className="hidden sm:inline">{t.road.today(firstAge)}</span>
        </span>
        {/* The home: the stepper itself on a wide screen; on a phone its age, with the stepper under the picture. */}
        <span className={cx(LABEL, 'bg-primary text-on-primary sm:hidden')} style={SPOT.home}>{vm.slider.value}</span>
        <Stepper vm={vm} testId="life-road-stepper" style={SPOT.home} className="absolute hidden -translate-x-1/2 -translate-y-full sm:flex" />
        {retire && (
          <span className={cx(LABEL, 'bg-surface text-text')} style={SPOT.retire}>
            <span className="sm:hidden">{retire.age}</span><span className="hidden sm:inline">{t.road.retire(retire.age)}</span>
          </span>
        )}
        <span className={cx(LABEL, 'bg-ink text-on-primary')} style={SPOT.end}>{t.road.end(endAge)}</span>
        <div className="absolute bottom-[5%] right-[3%] hidden flex-col items-end rounded-xl bg-surface px-lg py-md text-right shadow-lg ring-1 ring-border md:flex">
          <span className={cx('font-display text-4xl font-extrabold tabular-nums transition-colors lg:text-5xl', chanceTone)}>{chance.value ?? '…'}</span>
          <span className="max-w-40 text-xs font-semibold text-text-muted">{t.road.chanceCaption(endAge)}</span>
        </div>
      </div>
      <Stepper vm={vm} testId="life-road-stepper-phone" className="flex self-center sm:hidden" />
      <div className="flex flex-col items-center gap-sm text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-text-muted">{t.road.eyebrow}</p>
        <p className="font-display text-xl font-extrabold leading-tight sm:text-2xl" aria-live="polite" data-testid="life-road-headline">
          {vm.headline.lead}
          {vm.headline.payoff && (
            <span className={vm.headline.payoffTone === 'bad' ? 'text-negative' : 'text-primary'}>{`, ${vm.headline.payoff}`}</span>
          )}
        </p>
        <dl className="flex flex-wrap justify-center gap-sm">
          {vm.kpis.map((k) => (
            <div key={k.id} className="flex items-baseline gap-xs rounded-full bg-surface px-md py-xs shadow-sm ring-1 ring-border">
              <dt className="text-xs font-semibold text-text-muted">{k.label}</dt>
              <dd className={cx('text-sm font-extrabold tabular-nums', k.id === 'chance' && chanceTone)}>{k.value ?? k.note ?? '…'}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
