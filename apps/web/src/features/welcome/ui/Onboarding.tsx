// /start onboarding screens. Presentational: everything comes from OnboardingVM; this file lays it out,
// animates entrances and counts numbers up to the value the model gives. No number is computed here.
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { welcome as t } from '@/copy';
import { Art, Button, cx, Icon, Sticker } from '@/ui-kit';
import type { AnalysisIcon, AnalysisRowVM, AnalysisVM, LifeLineKpiVM, OnboardingVM, RevealVM } from '../model/types';

type LinkComponent = (props: { href: string; className?: string; children: ReactNode }) => ReactNode;

export type OnboardingProps = {
  vm: OnboardingVM;
  Link: LinkComponent;
  /** Statement upload (S9), for "Rather upload a statement". */
  uploadHref: string;
  /** Where "Open my plan" goes (Home, with the Life line filled in). */
  doneHref: string;
  /** Step 1: one round of today's duel (the route renders the game's own warm-up). */
  warmup: ReactNode;
  /** Decision step: the Life line chart with the draggable "Buy a home" pill (the route renders it). */
  decisionChart?: ReactNode;
};

const DARK_STEPS = new Set(['analyzing', 'reveal', 'future']);

export function Onboarding({ vm, Link, uploadHref, doneHref, warmup, decisionChart }: OnboardingProps) {
  const dark = DARK_STEPS.has(vm.step);
  return (
    <main
      data-testid="onboarding"
      data-step={vm.step}
      className={cx('min-h-[calc(100dvh-64px)] transition-colors duration-700', dark ? 'bg-ink text-on-primary' : 'bg-bg')}
    >
      <div className="mx-auto grid w-full max-w-(--container-6xl) gap-xl px-lg py-xl lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-3xl lg:py-3xl">
        <div className="lg:hidden"><Progress vm={vm} dark={dark} /></div>
        {vm.step === 'decision' ? (
          <div className="order-2 flex min-w-0 flex-col gap-xl lg:col-span-2">
            <div className="hidden lg:block"><Progress vm={vm} dark={dark} /></div>
            <div key="decision" className="ob-fade-up"><DecisionStep vm={vm} Link={Link} doneHref={doneHref} chart={decisionChart} /></div>
          </div>
        ) : vm.step === 'play' ? (
          <div className="order-2 flex min-w-0 flex-col gap-xl lg:col-span-2">
            <div className="hidden lg:block"><Progress vm={vm} dark={dark} /></div>
            <div key="play" className="ob-fade-up">{warmup}</div>
          </div>
        ) : vm.step === 'analyzing' && vm.analysis ? (
          <div className="order-2 flex min-w-0 flex-col gap-xl lg:col-span-2">
            <div className="hidden lg:block"><Progress vm={vm} dark={dark} /></div>
            <AnalyzingStep analysis={vm.analysis} />
          </div>
        ) : (
        <div className="order-2 flex min-w-0 flex-col gap-lg lg:order-none">
          <div className="hidden lg:block"><Progress vm={vm} dark={dark} /></div>
          <div key={vm.step} className="ob-fade-up flex min-w-0 flex-col gap-lg">
            {vm.step === 'guess' && <GuessStep vm={vm} />}
            {vm.step === 'connect' && <ConnectStep vm={vm} Link={Link} uploadHref={uploadHref} />}
            {vm.step === 'connecting' && <ConnectingStep vm={vm} Link={Link} uploadHref={uploadHref} />}
            {vm.step === 'reveal' && vm.reveal && <RevealStep vm={vm} reveal={vm.reveal} />}
            {vm.step === 'future' && <FutureStep vm={vm} />}
          </div>
        </div>
        )}
        {vm.step !== 'analyzing' && vm.step !== 'play' && vm.step !== 'decision' && <House vm={vm} />}
      </div>
    </main>
  );
}

function Progress({ vm, dark }: { vm: OnboardingVM; dark: boolean }) {
  return (
    <div className="flex items-center gap-md">
      {vm.step !== 'play' && (
        <button type="button" onClick={vm.back} aria-label={t.back}
          className={cx('flex size-10 shrink-0 items-center justify-center rounded-full', dark ? 'bg-on-primary/10' : 'bg-surface shadow-sm')}>
          <Icon name="arrowLeft" size={18} />
        </button>
      )}
      <div role="progressbar" aria-label={t.progressLabel(vm.stepIndex, vm.stepCount)} aria-valuemin={1} aria-valuemax={vm.stepCount}
        aria-valuenow={vm.stepIndex} className="flex flex-1 gap-xs">
        {Array.from({ length: vm.stepCount }, (_, i) => (
          <span key={i} className={cx('h-1.5 flex-1 rounded-full transition-colors duration-500',
            i < vm.stepIndex ? 'bg-primary' : dark ? 'bg-on-primary/15' : 'bg-border')} />
        ))}
      </div>
    </div>
  );
}

function House({ vm }: { vm: OnboardingVM }) {
  return (
    <div aria-hidden="true" className="relative order-1 mx-auto w-full max-w-48 sm:max-w-72 lg:order-none lg:max-w-(--container-md)">
      <div key={vm.house} className={cx('ob-pop', DARK_STEPS.has(vm.step) && 'rounded-xl bg-bg p-lg shadow-md')}>
        <Art name={vm.house} className="w-full" />
      </div>
    </div>
  );
}

// ----- 1. Guess --------------------------------------------------------------------------------

function GuessStep({ vm }: { vm: OnboardingVM }) {
  const g = vm.guess;
  const pct = ((g.value - g.min) / (g.max - g.min)) * 100;
  return (
    <>
      <Sticker tone="ink" tilt={-2} className="self-start text-sm">{t.guess.sticker}</Sticker>
      <p aria-hidden="true" className="font-display text-6xl font-extrabold tracking-tight text-text-muted/40 sm:text-8xl">{t.guess.mystery}</p>
      <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">{t.guess.title}</h1>
      <p className="max-w-(--container-xl) text-lg text-text-muted">{t.guess.body}</p>
      <div className="flex flex-col gap-md rounded-xl bg-surface p-xl shadow-md">
        <div className="flex items-baseline justify-between gap-md">
          <label htmlFor="ob-guess" className="text-xs font-bold uppercase tracking-wide text-text-muted">{g.label}</label>
          <output htmlFor="ob-guess" data-testid="onboarding-guess" className="font-display text-4xl font-extrabold tabular-nums">{g.formatValue(g.value)}</output>
        </div>
        <input
          id="ob-guess" type="range" min={g.min} max={g.max} step={g.step} value={g.value}
          aria-valuetext={g.formatValue(g.value)} onChange={(e) => vm.setGuess(Number(e.target.value))}
          className="w-full cursor-pointer accent-primary"
          style={{ background: `linear-gradient(90deg, var(--color-primary) ${pct}%, transparent ${pct}%)`, borderRadius: 999 }}
        />
        <div aria-hidden="true" className="flex justify-between text-xs text-text-muted tabular-nums">
          <span>{g.formatValue(g.min)}</span><span>{g.formatValue(g.max)}</span>
        </div>
      </div>
      <Button size="lg" onClick={vm.lockGuess} className="ob-pulse self-stretch sm:self-start" data-testid="onboarding-lock">
        {t.guess.cta} <Icon name="arrowRight" size={18} />
      </Button>
    </>
  );
}

// ----- 2. Connect ------------------------------------------------------------------------------

function ConnectStep({ vm, Link, uploadHref }: { vm: OnboardingVM; Link: LinkComponent; uploadHref: string }) {
  return (
    <>
      <Sticker tone="ink" tilt={-2} className="self-start text-sm">{t.connect.sticker}</Sticker>
      <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">{t.connect.title}</h1>
      <p className="max-w-(--container-xl) text-lg text-text-muted">{t.connect.body}</p>
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
        {vm.banks.map((b, i) => (
          <button
            key={b.id} type="button" onClick={() => vm.connect(b.id)} data-testid={`bank-${b.id}`}
            style={{ animationDelay: `${i * 60}ms` }}
            className="ob-fade-up group flex min-h-24 flex-col items-start justify-between gap-md rounded-lg border-2 border-transparent bg-surface p-lg text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:border-primary"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG mark */}
            <img src={b.logo} alt="" width={32} height={32} className="size-8 transition-transform group-hover:scale-110" />
            <span className="flex w-full items-center justify-between gap-sm text-sm font-bold leading-tight">
              {b.name}
              <Icon name="arrowRight" size={16} className="shrink-0 text-text-muted opacity-0 transition group-hover:opacity-100" />
            </span>
          </button>
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-lg gap-y-xs text-sm text-text-muted">
        {t.connect.privacy.map((p) => (
          <li key={p} className="flex items-center gap-xs"><Icon name="shield" size={16} className="text-positive" />{p}</li>
        ))}
      </ul>
      <Link href={uploadHref} className="self-start text-sm font-semibold text-primary hover:underline">{t.connect.upload}</Link>
    </>
  );
}

function ConnectingStep({ vm, Link, uploadHref }: { vm: OnboardingVM; Link: LinkComponent; uploadHref: string }) {
  const c = vm.connecting!;
  const bank = vm.banks.find((b) => b.name === c.bankName);
  return (
    <div className="flex flex-col gap-xl rounded-xl bg-surface p-xl shadow-md" data-testid="onboarding-connecting">
      <div className="flex items-center gap-md">
        {bank && (
          <span className="flex size-12 items-center justify-center rounded-md bg-surface-strong">
            {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG mark */}
            <img src={bank.logo} alt="" width={28} height={28} className="size-7" />
          </span>
        )}
        <span className="flex gap-xs text-primary" aria-hidden="true">
          {[0, 1, 2].map((i) => <span key={i} className="size-2 animate-pulse rounded-full bg-current" style={{ animationDelay: `${i * 150}ms` }} />)}
        </span>
        <span className="flex size-12 items-center justify-center rounded-md bg-ink text-on-primary"><Icon name="lock" size={22} /></span>
      </div>
      <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">{t.connecting.title(c.bankName)}</h1>
      <ol className="flex flex-col gap-md" aria-live="polite">
        {t.connecting.phases.map((label, i) => {
          const done = c.phase > i;
          const active = c.phase === i && !c.failed;
          return (
            <li key={label} className={cx('flex items-center gap-md text-base transition-opacity', c.phase < i && 'opacity-35')}>
              <span className={cx('flex size-7 shrink-0 items-center justify-center rounded-full',
                done ? 'bg-positive text-on-primary' : active ? 'border-2 border-primary border-t-transparent animate-spin' : 'border-2 border-border')}>
                {done && <Icon name="check" size={15} strokeWidth={3} />}
              </span>
              <span className={cx(done ? 'font-semibold' : active ? 'font-bold' : undefined)}>{label}</span>
              {i === 2 && c.readLabel && <span className="ml-auto whitespace-nowrap text-sm font-semibold text-positive tabular-nums">{c.readLabel}</span>}
            </li>
          );
        })}
      </ol>
      {c.failed && (
        <div className="flex flex-wrap items-center gap-md">
          <p className="text-sm text-negative">{t.connecting.error}</p>
          <Button onClick={vm.retry}>{t.connecting.retry}</Button>
          <Link href={uploadHref} className="text-sm font-semibold text-primary hover:underline">{t.connect.upload}</Link>
        </div>
      )}
    </div>
  );
}

// ----- 2b. Analyzing ----------------------------------------------------------------------------
// A statement feed on the left: the running row's merchants (their marks, how many lines, how much)
// slide in, then fly into that row's bucket on the right. Buckets fill, count up and keep the marks.

const ROW_ICON: Record<AnalysisIcon, Parameters<typeof Icon>[0]['name']> = {
  cash: 'cash', home: 'home', repeat: 'repeat', fork: 'fork', card: 'card', car: 'car', cart: 'cart', kid: 'kid', spark: 'spark', piggy: 'piggy',
};
const SEGMENT_COLOR: Record<string, string> = {
  primary: 'var(--color-primary)', 1: 'var(--color-chart-1)', 2: 'var(--color-chart-2)', 3: 'var(--color-chart-3)',
  4: 'var(--color-chart-4)', 5: 'var(--color-chart-5)', 6: 'var(--color-chart-6)',
};
const rowColor = (r: AnalysisRowVM) =>
  r.tone === 'good' ? 'var(--color-positive)' : r.tone === 'bad' ? 'var(--color-primary)' : SEGMENT_COLOR[String(r.segment?.tone ?? 'primary')]!;

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function AnalyzingStep({ analysis: a }: { analysis: AnalysisVM }) {
  const bucketRefs = useRef(new Map<string, HTMLElement>());
  const active = a.rows[a.done] ?? null;
  const pct = a.rows.length > 0 ? Math.round((a.done / a.rows.length) * 100) : 100;
  const spentSoFar = a.rows.slice(0, a.done).reduce((sum, r) => (r.segment ? sum + r.value : sum), 0);
  const spent = useCountUp(a.complete ? a.spent : spentSoFar, 600);
  const left = a.rows.find((r) => r.id === 'left');
  const buckets = a.rows.filter((r) => r.id !== 'left');
  return (
    <section data-testid="onboarding-analyzing" aria-live="polite" className="grid gap-xl lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-2xl">
      {/* Feed */}
      <div className="flex min-w-0 flex-col gap-md">
        <div className="flex flex-wrap items-center gap-sm">
          <Sticker tone="primary" tilt={-2} className="text-sm">{a.complete ? t.analyzing.complete : t.analyzing.progress(pct)}</Sticker>
          {a.rangeLabel && <span className="text-sm font-semibold text-chart-6">{a.rangeLabel}</span>}
        </div>
        <h1 className="font-display text-4xl font-extrabold leading-tight">{a.title}</h1>
        <div className="h-1 w-full overflow-hidden rounded-full bg-on-primary/10">
          <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
        </div>
        <div className="relative flex min-h-[340px] flex-col gap-sm overflow-hidden rounded-xl bg-on-primary/5 p-lg ring-1 ring-on-primary/10">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-chart-6">
            <span>{t.analyzing.feed}</span>
            {active && active.count > 0 && <span>{t.analyzing.lines(active.count)}</span>}
          </div>
          {active ? (
            <>
              <p key={`l-${active.id}`} className="ob-fade-up flex items-center gap-sm font-display text-2xl font-extrabold">
                <span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
                {active.label}
              </p>
              <FlyingChips key={active.id} row={active} target={() => bucketRefs.current.get(active.id) ?? null} />
            </>
          ) : (
            <div className="ob-pop flex flex-1 flex-col items-center justify-center gap-sm text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-positive"><Icon name="check" size={32} strokeWidth={3} /></span>
              <span className="font-display text-2xl font-extrabold">{t.analyzing.complete}</span>
            </div>
          )}
        </div>
      </div>

      {/* Buckets */}
      <div className="flex min-w-0 flex-col gap-md">
        <div className="flex items-end justify-between gap-md">
          <div>
            <span className="block text-xs font-bold uppercase tracking-wide text-chart-6">{t.analyzing.spent}</span>
            <span className="font-display text-5xl font-extrabold tabular-nums">{a.complete ? a.spentLabel : dollars(spent)}</span>
          </div>
          {a.ofLabel && <span className="pb-sm text-sm text-chart-6">{a.ofLabel}</span>}
        </div>
        <div className="grid grid-cols-2 gap-sm xl:grid-cols-3">
          {buckets.map((r) => {
            const i = a.rows.indexOf(r);
            return (
              <Bucket key={r.id} row={r} state={i < a.done ? 'done' : i === a.done ? 'active' : 'waiting'} wide={r.id === 'pay'}
                refCb={(el) => { if (el) bucketRefs.current.set(r.id, el); else bucketRefs.current.delete(r.id); }} />
            );
          })}
        </div>
        {left && (
          <div className={cx('flex items-center justify-between gap-md rounded-xl p-lg transition-all duration-700',
            a.complete ? 'ob-pop bg-positive/15 ring-2 ring-positive' : 'bg-on-primary/5 opacity-40')}>
            <span className="flex items-center gap-md font-semibold">
              <span className="flex size-10 items-center justify-center rounded-full bg-positive"><Icon name="piggy" size={20} /></span>
              {left.bucket}
            </span>
            <span className={cx('font-display text-3xl font-extrabold tabular-nums', left.tone === 'good' ? 'text-positive' : 'text-primary')}>
              {a.complete ? left.valueLabel : '…'}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function MerchantMark({ logo, initials, color, size = 36 }: { logo: string | null; initials: string; color: string; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface shadow-sm ring-2 ring-ink"
      style={{ width: size, height: size }}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small static SVG mark
        <img src={logo} alt="" width={size * 0.6} height={size * 0.6} style={{ width: size * 0.6, height: size * 0.6 }} />
      ) : (
        <span className="font-display text-xs font-extrabold" style={{ color }}>{initials}</span>
      )}
    </span>
  );
}

/** The row's merchants slide in one by one, then fly into the row's bucket (Web Animations). */
function FlyingChips({ row, target }: { row: AnalysisRowVM; target: () => HTMLElement | null }) {
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  const targetRef = useRef(target);
  useEffect(() => { targetRef.current = target; });
  const color = rowColor(row);
  // Once per row (the parent keys this by row id): later re-renders must not restart the flight.
  useEffect(() => {
    if (reducedMotion()) return;
    const anims: Animation[] = [];
    refs.current.forEach((el, i) => {
      if (!el) return;
      anims.push(el.animate(
        [{ opacity: 0, transform: 'translateX(-28px) scale(.96)' }, { opacity: 1, transform: 'none' }],
        { duration: 320, delay: i * 70, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' },
      ));
    });
    const fly = setTimeout(() => {
      const to = targetRef.current()?.getBoundingClientRect();
      if (!to) return;
      refs.current.forEach((el, i) => {
        if (!el) return;
        const from = el.getBoundingClientRect();
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);
        anims.push(el.animate(
          [
            { transform: 'none', opacity: 1 },
            { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 40}px) scale(.7) rotate(${i % 2 ? 6 : -6}deg)`, opacity: 1, offset: 0.55 },
            { transform: `translate(${dx}px, ${dy}px) scale(.25)`, opacity: 0 },
          ],
          { duration: 560, delay: i * 55, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' },
        ));
      });
    }, 560);
    return () => {
      clearTimeout(fly);
      anims.forEach((x) => x.cancel());
    };
  }, []);
  const chips = row.merchants.length > 0
    ? row.merchants
    : [{ id: row.id, name: row.bucket, logo: null, initials: '$', amountLabel: row.valueLabel, count: row.count }];
  return (
    <ul className="relative z-10 flex flex-col gap-xs">
      {chips.map((m, i) => (
        <li key={m.id} ref={(el) => { refs.current[i] = el; }}
          className="flex items-center gap-md rounded-full bg-on-primary/10 py-2 pl-2 pr-lg text-lg ring-1 ring-on-primary/10 will-change-transform">
          <MerchantMark logo={m.logo} initials={m.initials} color={color} size={44} />
          <span className="min-w-0 flex-1 truncate font-semibold">{m.name}</span>
          {m.count > 1 && <span className="text-xs text-chart-6">×{m.count}</span>}
          <span className="font-display font-extrabold tabular-nums">{m.amountLabel}</span>
        </li>
      ))}
    </ul>
  );
}

function Bucket({ row, state, wide, refCb }: { row: AnalysisRowVM; state: 'done' | 'active' | 'waiting'; wide: boolean; refCb: (el: HTMLElement | null) => void }) {
  const value = useCountUp(state === 'done' ? row.value : 0, 700);
  const color = rowColor(row);
  return (
    <div
      ref={refCb}
      className={cx(
        'relative flex min-h-24 flex-col justify-between gap-xs overflow-hidden rounded-lg p-md ring-1 transition-all duration-500',
        wide && 'col-span-2 xl:col-span-3',
        state === 'active' ? 'scale-[1.02] bg-on-primary/10 ring-2' : 'bg-on-primary/5 ring-on-primary/10',
        state === 'waiting' && 'opacity-45',
      )}
      style={state === 'active' ? { boxShadow: `0 0 0 2px ${color}, 0 0 36px -6px ${color}` } : undefined}
    >
      {/* The fill rises with the share of take-home this bucket takes. */}
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 transition-[height] duration-1000 ease-out"
        style={{ height: state === 'done' ? `${Math.max(6, Math.round(row.share * 100))}%` : '0%', background: color, opacity: 0.18 }} />
      <span className="relative flex items-center gap-sm text-sm font-semibold">
        <span className="flex size-7 items-center justify-center rounded-full" style={{ background: color }}>
          <Icon name={ROW_ICON[row.icon]} size={15} className="text-on-primary" />
        </span>
        <span className="truncate">{row.bucket}</span>
      </span>
      <span className="relative flex items-end justify-between gap-sm">
        <span className={cx('font-display text-xl font-extrabold tabular-nums', row.tone === 'good' && 'text-positive')}>
          {state === 'done' ? (Math.round(value) === Math.round(row.value) ? row.valueLabel : dollars(value)) : '—'}
        </span>
        {state === 'done' && row.merchants.length > 0 && (
          <span className="flex -space-x-2">
            {row.merchants.slice(0, 3).map((m, i) => (
              <span key={m.id} className="ob-pop" style={{ animationDelay: `${i * 80}ms` }}>
                <MerchantMark logo={m.logo} initials={m.initials} color={color} size={26} />
              </span>
            ))}
          </span>
        )}
      </span>
    </div>
  );
}

// ----- 3. Reveal -------------------------------------------------------------------------------

/** Counts from 0 to `target` (the model's number) for the reveal; shows `label` once it lands. */
function useCountUp(target: number, ms = 1400): number {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      raf.current = requestAnimationFrame(() => setV(target));
      return () => cancelAnimationFrame(raf.current);
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setV(target * (1 - (1 - k) ** 3));
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return v;
}

const dollars = (v: number) => `${v < 0 ? '−' : ''}$${Math.round(Math.abs(v)).toLocaleString('en-US')}`;

function RevealStep({ vm, reveal }: { vm: OnboardingVM; reveal: RevealVM }) {
  const shown = useCountUp(reveal.netWorth);
  const landed = Math.round(shown) === Math.round(reveal.netWorth);
  return (
    <>
      <Sticker tone="primary" tilt={-2} className="self-start text-sm">{t.reveal.sticker}</Sticker>
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{t.reveal.title}</h1>
      <p data-testid="onboarding-networth" className={cx('font-display text-6xl font-extrabold tabular-nums tracking-tight sm:text-8xl', reveal.netWorth < 0 && 'text-primary')}>
        {landed ? reveal.netWorthLabel : dollars(shown)}
      </p>
      <div className="ob-fade-up flex flex-wrap items-center gap-sm" style={{ animationDelay: '1.3s' }}>
        <span className="rounded-full bg-on-primary/10 px-md py-xs text-sm font-semibold">{reveal.guessLabel}</span>
        <span className={cx('rounded-full px-md py-xs text-sm font-bold', reveal.offTone === 'good' ? 'bg-positive' : 'bg-primary')}>{reveal.offLabel}</span>
      </div>
      <div className="ob-fade-up grid grid-cols-2 gap-sm" style={{ animationDelay: '1.6s' }}>
        <Fact label={t.reveal.own} value={reveal.ownLabel} />
        <Fact label={t.reveal.owe} value={reveal.oweLabel} />
        {reveal.takeHomeLabel && <Fact label={t.reveal.takeHome} value={`${reveal.takeHomeLabel}${t.reveal.perMonth}`} />}
        {reveal.spendingLabel && <Fact label={t.reveal.spending} value={`${reveal.spendingLabel}${t.reveal.perMonth}`} />}
      </div>
      {reveal.topCategories.length > 0 && (
        <div className="ob-fade-up flex flex-col gap-sm rounded-lg bg-on-primary/5 p-lg" style={{ animationDelay: '1.9s' }}>
          <span className="text-xs font-bold uppercase tracking-wide text-chart-6">{t.reveal.topCategories}</span>
          {reveal.topCategories.map((c) => (
            <div key={c.label} className="flex items-center gap-md text-sm">
              <span className="w-28 shrink-0 font-semibold">{c.label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-on-primary/10">
                <span className="block h-full rounded-full bg-primary transition-[width] duration-1000" style={{ width: `${Math.round(c.share * 100)}%` }} />
              </span>
              <span className="w-20 text-right tabular-nums">{c.amountLabel}</span>
            </div>
          ))}
        </div>
      )}
      <Button size="lg" onClick={vm.next} className="ob-fade-up self-stretch sm:self-start" style={{ animationDelay: '2.1s' }} data-testid="onboarding-next">
        {t.reveal.cta} <Icon name="arrowRight" size={18} />
      </Button>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-on-primary/5 p-md">
      <span className="block text-xs font-bold uppercase tracking-wide text-chart-6">{label}</span>
      <span className="font-display text-2xl font-extrabold tabular-nums">{value}</span>
    </div>
  );
}

// ----- 4. Future -------------------------------------------------------------------------------

function FutureStep({ vm }: { vm: OnboardingVM }) {
  const ll = vm.lifeline;
  if (ll.status !== 'ready') return <div className="h-80 animate-pulse rounded-xl bg-on-primary/5" />;
  const kAt = ll.kpis.find((k) => k.id === 'atRetirement')!;
  const kChance = ll.kpis.find((k) => k.id === 'chance')!;
  return (
    <>
      <Sticker tone="primary" tilt={-2} className="self-start text-sm">{t.future.sticker}</Sticker>
      <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-5xl">{t.future.title}</h1>
      <MiniChart points={ll.chart.selected} ageDomain={ll.chart.ageDomain} valueDomain={ll.chart.valueDomain} callout={ll.chart.retireCallout} />
      <div className="grid grid-cols-2 gap-sm">
        <DarkKpi kpi={kAt} />
        <DarkKpi kpi={kChance} measuring={t.future.measuring} />
      </div>
      <p className="ob-fade-up rounded-lg bg-on-primary/5 p-md text-sm text-chart-6" style={{ animationDelay: '1.8s' }}>{t.future.value}</p>
      <Button size="lg" onClick={vm.next} className="self-stretch sm:self-start" data-testid="onboarding-next">
        {t.future.cta} <Icon name="arrowRight" size={18} />
      </Button>
    </>
  );
}

function DarkKpi({ kpi, measuring }: { kpi: LifeLineKpiVM; measuring?: string }) {
  return (
    <div className="rounded-lg bg-on-primary/5 p-md">
      <span className="block text-xs font-bold uppercase tracking-wide text-chart-6">{kpi.label}</span>
      <span className={cx('font-display text-3xl font-extrabold tabular-nums', kpi.id === 'chance' && kpi.tone === 'bad' && 'text-primary')}>
        {kpi.value ?? <span className="text-base font-semibold text-chart-6">{measuring ?? kpi.note}</span>}
      </span>
    </div>
  );
}

function MiniChart({ points, ageDomain, valueDomain, callout }: {
  points: { age: number; netWorth: number }[];
  ageDomain: [number, number];
  valueDomain: [number, number];
  callout: { age: number; netWorth: number; label: string } | null;
}) {
  const W = 600;
  const H = 240;
  const x = (a: number) => 10 + ((a - ageDomain[0]) / Math.max(1, ageDomain[1] - ageDomain[0])) * (W - 20);
  const y = (v: number) => 16 + (1 - (v - valueDomain[0]) / Math.max(1, valueDomain[1] - valueDomain[0])) * (H - 40);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.age).toFixed(1)},${y(p.netWorth).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points.at(-1)!.age)},${H - 24} L${x(points[0]!.age)},${H - 24} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden="true">
      <defs>
        <linearGradient id="ob-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--color-primary)" stopOpacity="0.4" />
          <stop offset="1" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="10" x2={W - 10} y1={y(0)} y2={y(0)} stroke="currentColor" opacity="0.15" />
      <path d={area} fill="url(#ob-area)" className="ob-fade-up" style={{ animationDelay: '0.9s' }} />
      <path d={d} pathLength={1} fill="none" stroke="var(--color-primary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="ob-draw" />
      {callout && (
        <g className="ob-pop" style={{ animationDelay: '1.6s' }}>
          <circle cx={x(callout.age)} cy={y(callout.netWorth)} r="7" fill="var(--color-ink)" stroke="var(--color-primary)" strokeWidth="4" />
          <text x={Math.min(x(callout.age), W - 150)} y={y(callout.netWorth) - 16} className="fill-on-primary text-[16px] font-bold">{callout.label}</text>
        </g>
      )}
      <text x="10" y={H - 4} className="fill-current text-[12px] opacity-50">{ageDomain[0]}</text>
      <text x={W - 10} y={H - 4} textAnchor="end" className="fill-current text-[12px] opacity-50">{ageDomain[1]}</text>
    </svg>
  );
}

// ----- 5. Decision -----------------------------------------------------------------------------

function DecisionStep({ vm, Link, doneHref, chart }: { vm: OnboardingVM; Link: LinkComponent; doneHref: string; chart?: ReactNode }) {
  const ll = vm.lifeline;
  if (ll.status !== 'ready') return null;
  const s = ll.slider;
  const k = ll.kpis.find((x) => x.id === 'chance')!;
  return (
    <div className="grid gap-xl lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
      <div className="flex min-w-0 flex-col gap-lg">
        <Sticker tone="ink" tilt={-2} className="self-start text-sm">{t.decision.sticker}</Sticker>
        <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-5xl">
          {ll.headline.lead}
          {ll.headline.payoff && <>, <span className={ll.headline.payoffTone === 'bad' ? 'text-negative' : 'text-primary'}>{ll.headline.payoff}</span></>}
        </h1>
        <div className="relative flex flex-col gap-md rounded-xl bg-ink p-xl text-on-primary">
          <div className="flex items-end justify-between gap-md">
            <span className="font-display text-2xl font-extrabold">
              {s.title.replace(String(s.value), '')}<span className="text-primary">{s.value}</span>
            </span>
            <span className="text-right">
              <span className="block text-xs font-bold uppercase tracking-wide text-chart-6">{k.label}</span>
              <span className={cx('font-display text-4xl font-extrabold tabular-nums', k.tone === 'bad' ? 'text-primary' : k.tone === 'good' ? 'text-positive' : undefined)}>
                {k.value ?? k.note}
              </span>
            </span>
          </div>
          <label htmlFor="ob-decision" className="sr-only">{s.label}</label>
          <input id="ob-decision" data-testid="onboarding-decision" type="range" min={s.min} max={s.max} step={1} value={s.value}
            aria-valuetext={s.formatValue(s.value)} onChange={(e) => ll.setAge(Number(e.target.value))}
            className="w-full cursor-pointer accent-primary" />
          <div aria-hidden="true" className="flex justify-between text-xs text-chart-6 tabular-nums">
            <span>{s.min}</span><span>{s.max}</span>
          </div>
          {s.value === s.base && (
            <span aria-hidden="true" className="absolute -top-3 right-lg rotate-[-6deg] rounded-full bg-primary px-md py-xs text-sm font-extrabold">
              {t.decision.hint}
            </span>
          )}
        </div>
        <Link href={doneHref} className="inline-flex min-h-12 items-center justify-center gap-sm self-stretch rounded-full bg-primary px-xl text-lg font-bold text-on-primary sm:self-start">
          {t.decision.cta} <Icon name="arrowRight" size={18} />
        </Link>
      </div>
      {chart && <div className="min-w-0 rounded-xl bg-surface p-lg shadow-md">{chart}</div>}
    </div>
  );
}
