// /start onboarding screens. Presentational: everything comes from OnboardingVM; this file lays it out,
// animates entrances and counts numbers up to the value the model gives. No number is computed here.
'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { welcome as t } from '@/copy';
import { Art, Button, cx, EstimateTag, Icon, Sticker, TweenText } from '@/ui-kit';
import type { AboutVM, AnalysisIcon, AnalysisRowVM, AnalysisVM, BalancesVM, FieldVM, LifeLineKpiVM, OnboardingVM, RevealVM } from '../model/types';

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

/** One headline scale for every step, so the story keeps its rhythm. */
const H1 = 'font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl';
const LEAD = 'max-w-(--container-lg) text-lg leading-relaxed text-text-muted';
/** Small caps labels on the dark steps. */
const DARK_LABEL = 'block text-xs font-bold uppercase tracking-wide text-chart-6';
/** A quiet panel on the dark steps. */
const DARK_PANEL = 'rounded-lg bg-on-primary/5 ring-1 ring-on-primary/10';

export function Onboarding({ vm, Link, uploadHref, doneHref, warmup, decisionChart }: OnboardingProps) {
  const dark = DARK_STEPS.has(vm.step);
  const wide = vm.step === 'play' || vm.step === 'decision' || (vm.step === 'analyzing' && !!vm.analysis);
  return (
    <main
      data-testid="onboarding"
      data-step={vm.step}
      className={cx('min-h-[calc(100dvh-64px)] transition-colors duration-700', dark ? 'text-on-primary' : 'text-text')}
    >
      <Backdrop dark={dark} />
      <div className="mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-(--container-6xl) flex-col px-lg pt-lg lg:pt-xl">
        <Progress vm={vm} dark={dark} />
        <div className={cx('grid flex-1 content-start gap-xl py-xl lg:content-center lg:py-3xl',
          !wide && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-3xl')}>
          {vm.step === 'play' ? (
            <div key="play" className="ob-fade-up min-w-0">{warmup}</div>
          ) : vm.step === 'decision' ? (
            <div key="decision" className="ob-fade-up min-w-0"><DecisionStep vm={vm} Link={Link} doneHref={doneHref} chart={decisionChart} /></div>
          ) : vm.step === 'analyzing' && vm.analysis ? (
            <AnalyzingStep analysis={vm.analysis} />
          ) : (
            <>
              <div key={vm.step} className="ob-fade-up order-2 flex min-w-0 max-w-(--container-xl) flex-col gap-lg lg:order-none">
                {vm.step === 'about' && <AboutStep about={vm.about} />}
                {vm.step === 'guess' && <GuessStep vm={vm} />}
                {vm.step === 'balances' && <BalancesStep balances={vm.balances} />}
                {vm.step === 'connect' && <ConnectStep vm={vm} Link={Link} uploadHref={uploadHref} />}
                {vm.step === 'connecting' && <ConnectingStep vm={vm} Link={Link} uploadHref={uploadHref} />}
                {vm.step === 'reveal' && vm.reveal && <RevealStep vm={vm} reveal={vm.reveal} />}
                {vm.step === 'future' && <FutureStep vm={vm} />}
              </div>
              <House vm={vm} dark={dark} badge={vm.step === 'guess' ? t.guess.mystery : null} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/** The page behind the story: warm paper with a soft glow, cross-fading to ink for the reveal. Fixed and
    behind everything, so the shell's footer sits on the same colour. */
function Backdrop({ dark }: { dark: boolean }) {
  const light: CSSProperties = {
    background:
      'radial-gradient(60% 55% at 78% 45%, var(--color-primary-soft) 0%, transparent 70%),' +
      ' radial-gradient(40% 40% at 8% 100%, var(--color-surface) 0%, transparent 70%), var(--color-bg)',
  };
  const ink: CSSProperties = {
    background:
      'radial-gradient(55% 50% at 78% 42%, color-mix(in srgb, var(--color-primary) 22%, transparent) 0%, transparent 70%),' +
      ' radial-gradient(45% 45% at 0% 0%, color-mix(in srgb, var(--color-on-primary) 6%, transparent) 0%, transparent 70%), var(--color-ink)',
  };
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0" style={light} />
      <div className={cx('absolute inset-0 transition-opacity duration-700', dark ? 'opacity-100' : 'opacity-0')} style={ink} />
    </div>
  );
}

function Progress({ vm, dark }: { vm: OnboardingVM; dark: boolean }) {
  return (
    <div className="flex items-center gap-md">
      {vm.step !== 'play' ? (
        <button type="button" onClick={vm.back} aria-label={t.back}
          className={cx('flex size-10 shrink-0 items-center justify-center rounded-full transition hover:-translate-x-0.5',
            dark ? 'bg-on-primary/10 ring-1 ring-on-primary/15 hover:bg-on-primary/15' : 'bg-surface shadow-sm ring-1 ring-border hover:shadow-md')}>
          <Icon name="arrowLeft" size={18} />
        </button>
      ) : <span aria-hidden="true" className="size-10 shrink-0" />}
      <div role="progressbar" aria-label={t.progressLabel(vm.stepIndex, vm.stepCount)} aria-valuemin={1} aria-valuemax={vm.stepCount}
        aria-valuenow={vm.stepIndex} className="flex flex-1 gap-xs">
        {Array.from({ length: vm.stepCount }, (_, i) => (
          <span key={i} className={cx('h-1.5 flex-1 overflow-hidden rounded-full transition-colors duration-500', dark ? 'bg-on-primary/15' : 'bg-border')}>
            <span className={cx('block h-full rounded-full bg-primary transition-[width] duration-700 ease-out', i < vm.stepIndex ? 'w-full' : 'w-0')} />
          </span>
        ))}
      </div>
      <span aria-hidden="true" className={cx('w-10 shrink-0 text-right text-xs font-bold tabular-nums', dark ? 'text-chart-6' : 'text-text-muted')}>
        {t.progressShort(vm.stepIndex, vm.stepCount)}
      </span>
    </div>
  );
}

/** The house that builds itself as the story goes, on a soft stage of light. */
function House({ vm, dark, badge }: { vm: OnboardingVM; dark: boolean; badge: string | null }) {
  return (
    <div aria-hidden="true" className={cx('relative order-1 mx-auto w-full lg:order-none lg:max-w-(--container-md)',
      dark ? 'max-w-40 sm:max-w-56' : 'max-w-52 sm:max-w-72')}>
      <span className={cx('absolute inset-[6%] rounded-full blur-2xl transition-colors duration-700',
        dark ? 'bg-on-primary/10' : 'bg-surface')} />
      {/* Ground: a shadow on paper, a pool of warm light on ink (it also hides the cutouts' pale baked shadow). */}
      <span className={cx('absolute inset-x-[8%] bottom-[2%] h-[16%] rounded-full blur-2xl transition-colors duration-700',
        dark ? 'bg-primary-soft/25' : 'bg-ink/20')} />
      <div className="ob-float relative">
        <div key={vm.house} className="ob-pop">
          {/* On ink the base fades into the glow (the cutouts carry a pale baked floor at their foot). */}
          <Art name={vm.house} loading="eager"
            className={cx('w-full', dark && '[mask-image:linear-gradient(to_bottom,#000_78%,transparent_96%)]')} />
        </div>
      </div>
      {badge && (
        <span className="ob-pop absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2" style={{ animationDelay: '300ms' }}>
          <Sticker tone="ink" tilt={-4} className="px-lg py-sm font-display text-2xl tracking-[0.2em] sm:text-3xl">{badge}</Sticker>
        </span>
      )}
    </div>
  );
}

// ----- 1. About you -----------------------------------------------------------------------------

const PANEL = 'mt-xs flex flex-col gap-lg rounded-xl bg-surface p-lg shadow-md ring-1 ring-border sm:p-xl';
const FIELD_LABEL = 'text-xs font-bold uppercase tracking-wide text-text-muted';

function TextField({ field, onChange, error }: { field: FieldVM; onChange: (v: string) => void; error?: string }) {
  const id = `ob-${field.id}`;
  return (
    <div className="flex min-w-0 flex-col gap-xs">
      <label htmlFor={id} className={FIELD_LABEL}>{field.label}</label>
      <div className={cx('flex min-h-12 items-center gap-xs rounded-lg bg-bg px-md ring-1 transition focus-within:ring-2 focus-within:ring-primary',
        field.invalid ? 'ring-2 ring-negative' : 'ring-border')}>
        {field.prefix && <span className="font-display text-xl font-extrabold text-text-muted">{field.prefix}</span>}
        <input id={id} data-testid={id} type="text" inputMode={field.inputMode} autoComplete="off" value={field.value}
          placeholder={field.placeholder} aria-invalid={field.invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent py-sm font-display text-xl font-extrabold tabular-nums outline-none placeholder:text-text-muted/50" />
        {field.suffix && <span className="text-sm font-semibold text-text-muted">{field.suffix}</span>}
      </div>
      {field.invalid && error ? <span className="text-xs font-semibold text-negative">{error}</span>
        : field.hint ? <span className="text-xs text-text-muted">{field.hint}</span> : null}
    </div>
  );
}

function AboutStep({ about: a }: { about: AboutVM }) {
  const c = t.about;
  return (
    <form className="contents" onSubmit={(e) => { e.preventDefault(); a.submit(); }} data-testid="onboarding-about">
      <Sticker tone="ink" tilt={-2} className="self-start text-sm">{c.sticker}</Sticker>
      <h1 className={H1}>{c.title}</h1>
      <p className={LEAD}>{c.body}</p>
      <div className={PANEL}>
        <div className="grid gap-lg sm:grid-cols-2">
          <TextField field={a.age} onChange={(v) => a.setField('age', v)} error={c.invalid.age} />
          <TextField field={a.zip} onChange={(v) => a.setField('zip', v)} error={c.invalid.zip} />
        </div>
        <TextField field={a.takeHome} onChange={(v) => a.setField('takeHome', v)} error={c.invalid.takeHome} />
        <fieldset className="flex flex-col gap-xs">
          <legend className={cx(FIELD_LABEL, 'mb-xs')}>{c.household}</legend>
          <div className="flex flex-wrap items-center gap-sm">
            {([1, 2] as const).map((n) => (
              <button key={n} type="button" aria-pressed={a.adults === n} onClick={() => a.setAdults(n)} data-testid={`ob-adults-${n}`}
                className={cx('min-h-11 rounded-full px-lg text-sm font-bold ring-1 transition',
                  a.adults === n ? 'bg-ink text-on-primary ring-ink' : 'bg-bg ring-border hover:ring-primary')}>
                {c.adults[n]}
              </button>
            ))}
            <span className="ml-auto flex items-center gap-sm">
              <span className="text-sm font-semibold">{c.kids}</span>
              <button type="button" aria-label={c.kidMinus} disabled={a.kids <= 0} onClick={() => a.setKids(a.kids - 1)}
                className="flex size-11 items-center justify-center rounded-full bg-bg text-xl font-bold ring-1 ring-border disabled:opacity-40">−</button>
              <output aria-live="polite" className="w-12 text-center font-display text-xl font-extrabold tabular-nums">{c.kidsValue(a.kids)}</output>
              <button type="button" aria-label={c.kidPlus} disabled={a.kids >= a.maxKids} onClick={() => a.setKids(a.kids + 1)}
                className="flex size-11 items-center justify-center rounded-full bg-bg text-xl font-bold ring-1 ring-border disabled:opacity-40">+</button>
            </span>
          </div>
        </fieldset>
      </div>
      <Button size="lg" type="submit" className={cx('self-stretch sm:self-start', a.canSubmit && 'ob-pulse')} data-testid="onboarding-about-next">
        {c.cta} <Icon name="arrowRight" size={18} />
      </Button>
    </form>
  );
}

// ----- 2b. Add it up ---------------------------------------------------------------------------

function BalancesStep({ balances: b }: { balances: BalancesVM }) {
  const c = t.balances;
  const group = (label: string, fields: FieldVM[], tone: string) => (
    <fieldset className="flex flex-col gap-md">
      <legend className={cx('mb-xs text-sm font-extrabold uppercase tracking-wide', tone)}>{label}</legend>
      <div className="grid gap-md sm:grid-cols-2">
        {fields.map((f) => <TextField key={f.id} field={f} onChange={(v) => b.setField(f.id, v)} error={c.invalid} />)}
      </div>
    </fieldset>
  );
  return (
    <form className="contents" onSubmit={(e) => { e.preventDefault(); b.submit(); }} data-testid="onboarding-balances">
      <Sticker tone="ink" tilt={-2} className="self-start text-sm">{c.sticker}</Sticker>
      <h1 className={H1}>{c.title}</h1>
      <p className={LEAD}>{c.body}</p>
      <div className={PANEL}>
        {group(c.own, b.own, 'text-positive')}
        {group(c.owe, b.owe, 'text-negative')}
      </div>
      <Button size="lg" type="submit" disabled={!b.canSubmit} className="ob-pulse self-stretch sm:self-start" data-testid="onboarding-balances-next">
        {c.cta} <Icon name="arrowRight" size={18} />
      </Button>
    </form>
  );
}

// ----- 2. Guess --------------------------------------------------------------------------------

function GuessStep({ vm }: { vm: OnboardingVM }) {
  const g = vm.guess;
  const pct = ((g.value - g.min) / (g.max - g.min)) * 100;
  return (
    <>
      <Sticker tone="ink" tilt={-2} className="self-start text-sm">{t.guess.sticker}</Sticker>
      <h1 className={H1}>{t.guess.title}</h1>
      <p className={LEAD}>{t.guess.body}</p>
      <div className="mt-xs flex flex-col gap-lg rounded-xl bg-surface p-xl shadow-md ring-1 ring-border">
        <div className="flex items-baseline justify-between gap-md">
          <label htmlFor="ob-guess" className="text-xs font-bold uppercase tracking-wide text-text-muted">{g.label}</label>
          <output htmlFor="ob-guess" data-testid="onboarding-guess" className="font-display text-4xl font-extrabold tabular-nums sm:text-5xl">{g.formatValue(g.value)}</output>
        </div>
        <input
          id="ob-guess" type="range" min={g.min} max={g.max} step={g.step} value={g.value}
          aria-valuetext={g.formatValue(g.value)} onChange={(e) => vm.setGuess(Number(e.target.value))}
          className="ob-range"
          style={{ '--ob-fill': `${pct}%` } as CSSProperties}
        />
        <div aria-hidden="true" className="flex justify-between text-xs font-semibold text-text-muted tabular-nums">
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
      <h1 className={H1}>{t.connect.title}</h1>
      <p className={LEAD}>{t.connect.body}</p>
      <div className="mt-xs grid grid-cols-2 gap-sm">
        {vm.banks.map((b, i) => (
          <button
            key={b.id} type="button" onClick={() => vm.connect(b.id)} data-testid={`bank-${b.id}`}
            style={{ animationDelay: `${i * 60}ms` }}
            className="ob-fade-up group flex min-h-16 items-center gap-sm rounded-lg bg-surface px-sm py-sm sm:gap-md sm:px-md text-left shadow-sm ring-1 ring-border transition hover:-translate-y-0.5 hover:shadow-md hover:ring-2 hover:ring-primary focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-strong sm:size-10">
              {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG mark */}
              <img src={b.logo} alt="" width={24} height={24} className="size-6 transition-transform group-hover:scale-110" />
            </span>
            <span className="min-w-0 flex-1 text-sm font-bold leading-tight sm:text-base">{b.name}</span>
            <Icon name="arrowRight" size={16} className="hidden shrink-0 text-text-muted sm:block transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-x-lg gap-y-xs text-xs font-semibold text-text-muted sm:flex-row sm:flex-wrap">
        {t.connect.privacy.map((p) => (
          <li key={p} className="flex items-center gap-xs"><Icon name="shield" size={14} className="shrink-0 text-positive" />{p}</li>
        ))}
      </ul>
      <Link href={uploadHref} className="self-start text-sm font-semibold text-primary underline-offset-4 hover:underline">{t.connect.upload}</Link>
    </>
  );
}

function ConnectingStep({ vm, Link, uploadHref }: { vm: OnboardingVM; Link: LinkComponent; uploadHref: string }) {
  const c = vm.connecting!;
  const bank = vm.banks.find((b) => b.name === c.bankName);
  const phases = t.connecting.phases;
  return (
    <div className="flex flex-col gap-lg" data-testid="onboarding-connecting">
      <Sticker tone="ink" tilt={-2} className="self-start text-sm"><Icon name="lock" size={14} />{t.connecting.sticker}</Sticker>
      <h1 className={H1}>{t.connecting.title(c.bankName)}</h1>
      <div className="mt-xs flex flex-col gap-xl rounded-xl bg-surface p-xl shadow-md ring-1 ring-border">
        <div className="flex items-center gap-md" aria-hidden="true">
          {bank && (
            <span className="flex size-12 items-center justify-center rounded-md bg-surface-strong">
              {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG mark */}
              <img src={bank.logo} alt="" width={28} height={28} className="size-7" />
            </span>
          )}
          <span className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-border">
            <span className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-700 ease-out"
              style={{ width: `${Math.min(100, (c.phase / phases.length) * 100)}%` }} />
          </span>
          <span className="flex size-12 items-center justify-center rounded-md bg-ink text-on-primary"><Icon name="lock" size={22} /></span>
        </div>
        <ol className="flex flex-col" aria-live="polite">
          {phases.map((label, i) => {
            const done = c.phase > i;
            const active = c.phase === i && !c.failed;
            const last = i === phases.length - 1;
            return (
              <li key={label} className={cx('relative flex gap-md transition-opacity duration-500', !last && 'pb-lg', c.phase < i && 'opacity-40')}>
                {!last && <span aria-hidden="true" className={cx('absolute left-3.5 top-8 bottom-1 w-0.5 -translate-x-1/2 rounded-full', done ? 'bg-positive' : 'bg-border')} />}
                <span className={cx('flex size-7 shrink-0 items-center justify-center rounded-full',
                  done ? 'bg-positive text-on-primary' : active ? 'border-2 border-primary border-t-transparent animate-spin' : 'border-2 border-border')}>
                  {done && <Icon name="check" size={15} strokeWidth={3} />}
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-md pt-0.5">
                  <span className={cx('text-base', done ? 'font-semibold' : active ? 'font-bold' : undefined)}>{label}</span>
                  {i === 2 && c.readLabel && <span className="whitespace-nowrap text-sm font-semibold text-positive tabular-nums">{c.readLabel}</span>}
                </span>
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
  // The last small bucket stretches over an otherwise empty end of the grid (2 columns, 3 from xl).
  const small = buckets.filter((r) => r.id !== 'pay').length;
  const lastSpan: BucketSpan = small % 2 === 1 ? (small % 3 === 1 ? 'full' : 'two-only') : small % 3 === 1 ? 'xl-full' : 'one';
  return (
    <section data-testid="onboarding-analyzing" aria-live="polite" className="grid gap-xl lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-2xl">
      {/* Feed */}
      <div className="flex min-w-0 flex-col gap-md">
        <div className="flex flex-wrap items-center gap-sm">
          <Sticker tone="primary" tilt={-2} className="text-sm">{a.complete ? t.analyzing.complete : t.analyzing.progress(pct)}</Sticker>
          {a.rangeLabel && <span className="text-sm font-semibold text-chart-6">{a.rangeLabel}</span>}
        </div>
        <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">{a.title}</h1>
        <div className="h-1 w-full overflow-hidden rounded-full bg-on-primary/10">
          <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
        </div>
        <div className="relative flex min-h-[340px] flex-1 flex-col gap-sm overflow-hidden rounded-xl bg-on-primary/5 p-lg ring-1 ring-on-primary/10">
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
            <span className={DARK_LABEL}>{t.analyzing.spent}</span>
            <span className="font-display text-5xl font-extrabold tabular-nums">{a.complete ? a.spentLabel : dollars(spent)}</span>
          </div>
          {a.ofLabel && <span className="pb-sm text-sm text-chart-6">{a.ofLabel}</span>}
        </div>
        <div className="grid grid-cols-2 gap-sm xl:grid-cols-3">
          {buckets.map((r, k) => {
            const i = a.rows.indexOf(r);
            return (
              <Bucket key={r.id} row={r} state={i < a.done ? 'done' : i === a.done ? 'active' : 'waiting'}
                span={r.id === 'pay' ? 'full' : k === buckets.length - 1 ? lastSpan : 'one'}
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

type BucketSpan = 'one' | 'full' | 'two-only' | 'xl-full';
const SPAN: Record<BucketSpan, string | undefined> = {
  one: undefined,
  full: 'col-span-2 xl:col-span-3',
  'two-only': 'col-span-2 xl:col-span-1',
  'xl-full': 'xl:col-span-3',
};

function Bucket({ row, state, span, refCb }: { row: AnalysisRowVM; state: 'done' | 'active' | 'waiting'; span: BucketSpan; refCb: (el: HTMLElement | null) => void }) {
  const value = useCountUp(state === 'done' ? row.value : 0, 700);
  const color = rowColor(row);
  return (
    <div
      ref={refCb}
      className={cx(
        'relative flex min-h-24 flex-col justify-between gap-xs overflow-hidden rounded-lg p-md ring-1 transition-all duration-500',
        SPAN[span],
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
      <div className="flex flex-col gap-xs">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t.reveal.title}</h1>
        <p data-testid="onboarding-networth" className={cx('font-display text-7xl font-extrabold leading-none tabular-nums tracking-tight sm:text-8xl lg:text-9xl', reveal.netWorth < 0 && 'text-primary')}>
          {landed ? reveal.netWorthLabel : dollars(shown)}
        </p>
      </div>
      <div className="ob-fade-up flex flex-wrap items-center gap-sm" style={{ animationDelay: '1.3s' }}>
        <span className="rounded-full bg-on-primary/10 px-md py-xs text-sm font-semibold ring-1 ring-on-primary/15">{reveal.guessLabel}</span>
        <span className={cx('rounded-full px-md py-xs text-sm font-bold text-on-primary', reveal.offTone === 'good' ? 'bg-positive' : 'bg-primary')}>{reveal.offLabel}</span>
      </div>
      <div className="ob-fade-up grid grid-cols-2 gap-sm" style={{ animationDelay: '1.6s' }}>
        <Fact label={t.reveal.own} value={reveal.ownLabel} />
        <Fact label={t.reveal.owe} value={reveal.oweLabel} />
        {reveal.takeHomeLabel && <Fact label={t.reveal.takeHome} value={`${reveal.takeHomeLabel}${t.reveal.perMonth}`} />}
        {reveal.spendingLabel && <Fact label={t.reveal.spending} value={`${reveal.spendingLabel}${t.reveal.perMonth}`} />}
      </div>
      {reveal.topCategories.length > 0 && (
        <div className={cx('ob-fade-up flex flex-col gap-sm p-lg', DARK_PANEL)} style={{ animationDelay: '1.9s' }}>
          <span className={DARK_LABEL}>{t.reveal.topCategories}</span>
          {reveal.topCategories.map((c) => (
            <div key={c.label} className="flex items-center gap-md text-sm">
              <span className="w-32 shrink-0 truncate font-semibold">{c.label}</span>
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
    <div className={cx('flex flex-col gap-xs px-lg py-md', DARK_PANEL)}>
      <span className={DARK_LABEL}>{label}</span>
      <span className="font-display text-2xl font-extrabold tabular-nums">{value}</span>
    </div>
  );
}

// ----- 4. Future -------------------------------------------------------------------------------

function FutureStep({ vm }: { vm: OnboardingVM }) {
  const f = vm.future;
  if (!f) return <div className={cx('h-96 animate-pulse rounded-xl', DARK_PANEL)} />;
  return (
    <>
      <Sticker tone="primary" tilt={-2} className="self-start text-sm">{t.future.sticker}</Sticker>
      <h1 className={H1}>{t.future.title}</h1>
      <div className={cx('mt-xs flex flex-col overflow-hidden rounded-xl', DARK_PANEL)}>
        <div className="px-md pt-lg">
          <MiniChart points={f.points} ageDomain={f.ageDomain} valueDomain={f.valueDomain} callout={f.callout} />
        </div>
        <div className="grid grid-cols-2 divide-x divide-on-primary/10 border-t border-on-primary/10">
          <DarkKpi kpi={f.atRetirement} />
          <DarkKpi kpi={f.chance} measuring={t.future.measuring} />
        </div>
      </div>
      <p className="ob-fade-up flex items-start gap-sm text-sm leading-relaxed text-chart-6" style={{ animationDelay: '1.8s' }}>
        <Icon name="spark" size={16} className="mt-0.5 shrink-0 text-primary" />{t.future.value}
      </p>
      <Button size="lg" onClick={vm.next} className="self-stretch sm:self-start" data-testid="onboarding-next">
        {t.future.cta} <Icon name="arrowRight" size={18} />
      </Button>
    </>
  );
}

function DarkKpi({ kpi, measuring }: { kpi: LifeLineKpiVM; measuring?: string }) {
  return (
    <div className="flex flex-col gap-xs px-lg py-md" data-testid={`onboarding-kpi-${kpi.id}`}>
      <span className={DARK_LABEL}>{kpi.label}</span>
      <span className={cx('font-display text-3xl font-extrabold tabular-nums sm:text-4xl', kpi.id === 'chance' && kpi.tone === 'bad' && 'text-primary')}>
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

/** Where a value sits on the decision slider's track: the thumb's centre (the .ob-range thumb is 1.75rem wide). */
const onTrack = (share: number) => `calc(0.875rem + (100% - 1.75rem) * ${share})`;

function DecisionStep({ vm, Link, doneHref, chart }: { vm: OnboardingVM; Link: LinkComponent; doneHref: string; chart?: ReactNode }) {
  const ll = vm.lifeline;
  if (ll.status !== 'ready') return null;
  const s = ll.slider;
  const k = ll.kpis.find((x) => x.id === 'chance')!;
  const span = Math.max(1, s.max - s.min);
  const share = (age: number) => (age - s.min) / span;
  const baseShare = share(s.base);
  const toneText = (tone: string) => (tone === 'bad' ? 'text-primary' : tone === 'good' ? 'text-positive' : 'text-chart-6');
  return (
    <div className="grid gap-xl lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
      <div className="flex min-w-0 flex-col gap-lg">
        <Sticker tone="ink" tilt={-2} className="self-start text-sm">{t.decision.sticker}</Sticker>
        {/* Room for three lines, so a longer headline never pushes the slider down mid-drag. */}
        <h1 className="min-h-[3lh] font-display text-3xl font-extrabold leading-tight sm:text-5xl">
          {ll.headline.lead}
          {ll.headline.payoff && <>, <span className={ll.headline.payoffTone === 'bad' ? 'text-negative' : 'text-primary'}><TweenText text={ll.headline.payoff} /></span></>}
        </h1>
        <p data-testid="onboarding-decision-why" className="-mt-sm min-h-[3lh] text-sm leading-relaxed text-text-muted">
          {ll.headline.why ?? t.decision.title}
        </p>
        <div className="relative flex flex-col gap-md rounded-xl bg-ink p-xl text-on-primary">
          <div className="flex items-end justify-between gap-md">
            <span className="font-display text-2xl font-extrabold">
              {s.title.replace(String(s.value), '')}<span className="text-primary">{s.value}</span>
            </span>
            <span className="text-right">
              <span className="block text-xs font-bold uppercase tracking-wide text-chart-6">{k.label}</span>
              <span className={cx('block font-display text-4xl font-extrabold tabular-nums', k.tone === 'bad' ? 'text-primary' : k.tone === 'good' ? 'text-positive' : undefined)}>
                {k.value ? <TweenText text={k.value} /> : k.note}
              </span>
              {/* Always one line tall: "▼ −100 pts", "same as your plan", or empty at the plan's age. */}
              <span className={cx('block min-h-[1lh] text-xs font-bold tabular-nums', toneText(k.tone))}>{k.delta}</span>
            </span>
          </div>
          <div className="relative pt-lg">
            {/* The plan's age: a tick on the track and its label above it. */}
            <span aria-hidden="true" className={cx('pointer-events-none absolute top-0 whitespace-nowrap text-xs font-bold text-chart-6',
              baseShare < 0.15 ? '-translate-x-[0.875rem]' : baseShare > 0.85 ? '-translate-x-[calc(100%-0.875rem)]' : '-translate-x-1/2')}
              style={{ left: onTrack(baseShare) }}>
              {s.baseLabel}
            </span>
            <span aria-hidden="true" className="pointer-events-none absolute top-[calc(var(--spacing-lg)-0.25rem)] h-[1.125rem] w-0.5 -translate-x-1/2 rounded-full bg-chart-6"
              style={{ left: onTrack(baseShare) }} />
            <label htmlFor="ob-decision" className="sr-only">{s.label}</label>
            <input id="ob-decision" data-testid="onboarding-decision" type="range" min={s.min} max={s.max} step={1} value={s.value}
              aria-valuetext={s.formatValue(s.value)} onChange={(e) => ll.setAge(Number(e.target.value))}
              className="ob-range relative" style={{ '--ob-fill': `${share(s.value) * 100}%` } as CSSProperties} />
          </div>
          {/* The Chance of success at every age on the slider, from the same simulations (fixed seed). */}
          <div className="flex flex-col gap-xs">
            <div className="relative h-4 mx-[0.875rem]" role={s.chances ? 'img' : undefined}
              aria-label={s.chances ? `${s.chancesLabel}: ${s.chances.map((c) => c.label).join(', ')}` : undefined}>
              {s.chances
                ? s.chances.map((c) => (
                  <span key={c.age} title={c.label}
                    className={cx('absolute bottom-0 -translate-x-1/2 rounded-sm transition-[height,opacity] duration-300',
                      c.tone === 'good' ? 'bg-positive' : 'bg-primary', c.age === s.value ? 'opacity-100' : 'opacity-45')}
                    style={{ left: `${share(c.age) * 100}%`, width: `calc(${100 / span}% - 3px)`, height: `${Math.max(12, c.pct)}%` }} />
                ))
                : <span className="absolute inset-x-0 bottom-0 h-1 animate-pulse rounded-full bg-on-primary/10" />}
            </div>
            <div aria-hidden="true" className="flex justify-between text-xs text-chart-6 tabular-nums">
              <span>{s.min}</span><span>{s.chancesLabel}</span><span>{s.max}</span>
            </div>
          </div>
          <div className="flex flex-col gap-sm border-t border-on-primary/10 pt-md">
            <span className="flex items-center gap-sm text-xs font-bold uppercase tracking-wide text-chart-6">
              <Icon name="home" size={14} />{s.origin}
              {s.isEstimate && <span className="ml-auto normal-case tracking-normal" title={s.estimateNote}><EstimateTag /></span>}
            </span>
            <ul className="flex flex-wrap gap-xs">
              {s.facts.map((f) => (
                <li key={f.label} className="rounded-full bg-on-primary/10 px-sm py-xs text-xs font-semibold tabular-nums">{f.label}</li>
              ))}
            </ul>
          </div>
          {s.value === s.base && (
            <span aria-hidden="true" className="ob-pop absolute -top-3 right-lg rotate-[-6deg] rounded-full bg-primary px-md py-xs text-sm font-extrabold">
              {t.decision.hint}
            </span>
          )}
        </div>
        <Link href={doneHref} className="inline-flex min-h-12 items-center justify-center gap-sm self-stretch rounded-full bg-primary px-xl text-lg font-bold text-on-primary sm:self-start">
          {t.decision.cta} <Icon name="arrowRight" size={18} />
        </Link>
        <p className="text-sm text-text-muted">{t.decision.note}</p>
      </div>
      {chart && <div className="min-w-0 rounded-xl bg-surface p-lg shadow-md">{chart}</div>}
    </div>
  );
}
