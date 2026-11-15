// /start onboarding. One round of today's duel (the warm-up, rendered by the route) → "What are you worth?" (a guess) → connect a bank → the answer → the plan to 90 → one
// decision. The bank connection is a demo (labelled as such on screen): any bank loads the sample life
// (profile.demo.json, its accounts and its plan, scenario.demo.json) and the sample statement, which goes
// through the real pipeline: parsed and masked in the browser, labels categorized by
// /api/statement/categorize, months summed by the engine and applied like an uploaded file. The answer is
// netWorthSummary() of the accounts; the future and the decision are the home Life line (useLifeLine).
// Between the connection and the answer, the analysis walks through what the statement holds (paycheck,
// rent, subscriptions, …): every amount is the engine's month totals of that statement.
import { netWorthSummary } from '@lifeguessr/engine';
import { COST_CATEGORIES } from '@lifeguessr/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { common, welcome as copy } from '@/copy';
import { fillFromStatement } from '@/features/bankDemo/model/fillAll';
import { useStatementUpload } from '@/features/ladder/model/useStatementUpload';
import type { StatementMonthVM, StatementReadVM } from '@/features/ladder/model/types';
import { useLifeLine } from '@/features/lifeline/model/useLifeLine';
import { writeRecord } from '@/features/onboarding/model/onboardingStore';
import { formatMoney } from '@/lib/format';
import { useAccountsStore } from '@/lib/model/accounts';
import { useAppReady, useAppStore } from '@/state';
import { merchantOf } from './merchants';
import type { MerchantVM } from './types';
import type { AnalysisIcon, AnalysisRowVM, AnalysisVM, BankVM, HouseArt, OnboardingStep, OnboardingVM, RevealVM } from './types';

/**
 * Banks on the picker, with their marks (public/banks, from Simple Icons, CC0). The connection is a
 * front-end demo: whichever bank is picked, the sample account and statement load (see the header).
 */
export const BANKS: BankVM[] = [
  { id: 'chase', name: 'Chase', logo: '/banks/chase.svg' },
  { id: 'bofa', name: 'Bank of America', logo: '/banks/bankofamerica.svg' },
  { id: 'wells', name: 'Wells Fargo', logo: '/banks/wellsfargo.svg' },
  { id: 'amex', name: 'American Express', logo: '/banks/americanexpress.svg' },
  { id: 'discover', name: 'Discover', logo: '/banks/discover.svg' },
  { id: 'cashapp', name: 'Cash App', logo: '/banks/cashapp.svg' },
];

export const GUESS = { min: -50_000, max: 250_000, step: 1_000, initial: 25_000 } as const;
/** How long each connect phase shows before the next (the reading phase waits for the real pipeline). */
export const PHASE_MS = 750;
/** One analysis row every ROW_MS; the answer follows HOLD_MS after the last one. */
export const ROW_MS = 1150;
export const HOLD_MS = 1400;
const STEPS: OnboardingStep[] = ['play', 'guess', 'connect', 'analyzing', 'reveal', 'future', 'decision'];
const READ_PHASE = 2;
const SORT_PHASE = 3;
const PHASES = copy.connecting.phases.length;

const money = (v: number) => formatMoney(v);

/** The reveal, from the accounts' net worth and the statement's latest full month. Pure (exported for tests). */
export function revealOf(
  summary: { netWorth: number; assets: number; liabilities: number },
  guess: number,
  month: StatementMonthVM | null,
): RevealVM {
  const off = guess - summary.netWorth;
  const offRounded = Math.round(Math.abs(off));
  const top = month
    ? COST_CATEGORIES.map((c) => ({ c, v: month.totals[c] }))
        .filter((x) => x.v > 0)
        .sort((a, b) => b.v - a.v)
        .slice(0, 3)
    : [];
  return {
    netWorth: summary.netWorth,
    netWorthLabel: money(summary.netWorth),
    guessLabel: copy.reveal.guessed(money(guess)),
    offLabel: offRounded < 1_000 ? copy.reveal.exact : copy.reveal.off(money(Math.abs(off)), off > 0 ? 'high' : 'low'),
    offTone: offRounded < 1_000 ? 'good' : 'bad',
    ownLabel: money(summary.assets),
    oweLabel: money(summary.liabilities),
    takeHomeLabel: month?.detectedPay ? money(month.detectedPay) : null,
    spendingLabel: month ? money(month.total) : null,
    topCategories: top.map(({ c, v }) => ({ label: common.categories[c], amountLabel: money(v), share: month && month.total > 0 ? v / month.total : 0 })),
  };
}

/** Spending rows in the order the analysis counts them (the categories a viewer recognises first). */
const ANALYSIS_ORDER = ['rentUtilities', 'subscriptions', 'eatingOut', 'debtPayments', 'car', 'groceries', 'childcare', 'other'] as const;
const ICONS: Record<(typeof ANALYSIS_ORDER)[number], AnalysisIcon> = {
  rentUtilities: 'home', subscriptions: 'repeat', eatingOut: 'fork', debtPayments: 'card', car: 'car', groceries: 'cart', childcare: 'kid', other: 'spark',
};
const SEGMENT_TONES = ['primary', 1, 2, 3, 4, 5, 6, 6] as const;
const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * The analysis of one statement month: the paycheck, each spending category with money in it, and what
 * is left (take-home − spending, the month's own totals). Pure (exported for tests).
 */
export type StatementLine = { month: string; day: number; label: string; amount: number; cls: string };
const MERCHANTS_SHOWN = 6;

/** The month's lines of class `cls`, summed per merchant, biggest first. */
export function merchantsOf(lines: readonly StatementLine[], month: string, cls: string): { merchants: MerchantVM[]; count: number } {
  const by = new Map<string, MerchantVM & { total: number }>();
  let count = 0;
  for (const l of lines) {
    if (l.month !== month || l.cls !== cls) continue;
    count++;
    const m = merchantOf(l.label);
    const cur = by.get(m.name) ?? { id: m.name, name: m.name, logo: m.logo, initials: m.initials, amountLabel: '', count: 0, total: 0 };
    cur.total += Math.abs(l.amount);
    cur.count++;
    by.set(m.name, cur);
  }
  const merchants = [...by.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, MERCHANTS_SHOWN)
    .map(({ total, ...m }) => ({ ...m, amountLabel: money(total) }));
  return { merchants, count };
}

export function analysisRows(month: StatementMonthVM, lines: readonly StatementLine[] = []): AnalysisRowVM[] {
  const a = copy.analyzing;
  const of = (cls: string) => merchantsOf(lines, month.month, cls);
  const pay = month.detectedPay && month.detectedPay > 0 ? month.detectedPay : null;
  const base = pay ?? month.total;
  const rows: AnalysisRowVM[] = [];
  if (pay) rows.push({ id: 'pay', icon: 'cash', label: a.rows.pay!, bucket: a.buckets.pay!, value: pay, valueLabel: a.perMonth(money(pay)), tone: 'good', share: 1, segment: null, ...of('pay') });
  let tone = 0;
  for (const c of ANALYSIS_ORDER) {
    const v = month.totals[c];
    if (!(v > 0)) continue;
    rows.push({
      id: c, icon: ICONS[c], label: a.rows[c]!, bucket: common.categories[c], ...of(c), value: v, valueLabel: a.perMonth(money(v)), tone: 'plain',
      share: base > 0 ? Math.min(1, v / base) : 0,
      segment: { share: month.total > 0 ? v / month.total : 0, tone: SEGMENT_TONES[tone++]! },
    });
  }
  if (pay) {
    const left = pay - month.total;
    rows.push({
      id: 'left', icon: 'piggy', label: a.rows.left!, bucket: a.buckets.left!, merchants: [], count: 0, value: left,
      valueLabel: a.perMonth(formatMoney(left, { signed: true })), tone: left >= 0 ? 'good' : 'bad',
      share: Math.min(1, Math.abs(left) / pay), segment: null,
    });
  }
  return rows;
}

export function useOnboarding(): OnboardingVM {
  const ready = useAppReady();
  const profileOrigin = useAppStore((s) => s.profileOrigin);
  const loadSampleLife = useAppStore((s) => s.loadSample);
  const accounts = useAccountsStore((s) => s.accounts);
  // The connected bank's statement goes through the CSV pipeline once and fills every screen (ledger,
  // Cash flow, Recurring, accounts, budget, goal: bankDemo/fillAll), named after the bank picked.
  const bankName = useRef('');
  const readAndFill = useCallback(
    (file: File, deps?: Parameters<typeof fillFromStatement>[2]) => fillFromStatement(file, bankName.current, deps).then((r) => r.read),
    [],
  );
  const upload = useStatementUpload({ readStatementFile: readAndFill });
  const lifeline = useLifeLine();

  const [step, setStep] = useState<OnboardingStep>('play');
  const [guess, setGuessState] = useState<number>(GUESS.initial);
  const [bankId, setBankId] = useState<string | null>(null);
  const [phase, setPhase] = useState(0);
  const [month, setMonth] = useState<StatementMonthVM | null>(null);
  const [read, setRead] = useState<StatementReadVM | null>(null);
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [analysisDone, setAnalysisDone] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const applied = useRef(false);
  const clearTimers = () => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const setGuess = useCallback((v: number) => setGuessState(Math.min(GUESS.max, Math.max(GUESS.min, Math.round(v / GUESS.step) * GUESS.step))), []);
  const lockGuess = useCallback(() => setStep('connect'), []);
  const finishWarmup = useCallback(() => setStep('guess'), []);

  const { trySample, apply } = upload;
  const start = useCallback(() => {
    clearTimers();
    applied.current = false;
    setPhase(0);
    setMonth(null);
    setRead(null);
    setAnalysisDone(0);
    timers.current.push(setTimeout(() => setPhase(1), PHASE_MS));
    timers.current.push(setTimeout(() => {
      setPhase(READ_PHASE);
      trySample();
    }, PHASE_MS * 2));
  }, [trySample]);

  const connect = useCallback(
    (id: string) => {
      if (!BANKS.some((b) => b.id === id)) return;
      // The sample life replaces only the starting profile, never one the person built.
      // (the plan store seeds the sample plan for the sample profile on its own)
      if (profileOrigin === 'demo') loadSampleLife();
      setBankId(id);
      bankName.current = BANKS.find((b) => b.id === id)?.name ?? '';
      setStep('connecting');
      start();
    },
    [profileOrigin, loadSampleLife, start],
  );

  // The statement is read: show the sorting phase, keep the latest month for the reveal, apply it.
  useEffect(() => {
    if (step !== 'connecting' || phase < READ_PHASE || applied.current || upload.status !== 'review') return;
    applied.current = true;
    const months = upload.pending;
    const picked = [...months].reverse().find((m) => m.averaged) ?? months.at(-1) ?? null;
    setMonth(picked);
    setRead(upload.lastRead);
    setLines(upload.lines);
    setPhase(SORT_PHASE);
    apply();
    const rows = picked ? analysisRows(picked, upload.lines).length : 0;
    const t0 = PHASE_MS * 1.5;
    timers.current.push(setTimeout(() => setPhase(PHASES), t0));
    timers.current.push(setTimeout(() => setStep('analyzing'), t0 + PHASE_MS));
    for (let i = 1; i <= rows; i++) timers.current.push(setTimeout(() => setAnalysisDone(i), t0 + PHASE_MS + i * ROW_MS));
    timers.current.push(setTimeout(() => setStep('reveal'), t0 + PHASE_MS + rows * ROW_MS + HOLD_MS));
  }, [step, phase, upload.status, upload.pending, upload.lastRead, upload.lines, apply]);

  const analysis = useMemo((): AnalysisVM | null => {
    if (step !== 'analyzing' || !month) return null;
    const rows = analysisRows(month, lines);
    const a = copy.analyzing;
    return {
      title: read ? a.title(read.transactions.toLocaleString('en-US')) : a.titleNoCount,
      rangeLabel: read ? a.range(shortDate(read.from), shortDate(read.to)) : null,
      rows,
      done: Math.min(analysisDone, rows.length),
      spent: month.total,
      spentLabel: money(month.total),
      ofLabel: month.detectedPay ? a.of(money(month.detectedPay)) : null,
      complete: analysisDone >= rows.length,
    };
  }, [step, month, read, analysisDone, lines]);

  // Reaching the decision finishes onboarding: the landing ("/") then opens the dashboard.
  useEffect(() => {
    if (step === 'decision') writeRecord({ done: true, chapter: 4 });
  }, [step]);

  const failed = step === 'connecting' && upload.status === 'error';

  const reveal = useMemo(() => {
    if (step === 'play' || step === 'guess' || step === 'connect' || step === 'connecting' || step === 'analyzing') return null;
    const s = netWorthSummary(accounts);
    return revealOf({ netWorth: s.netWorth, assets: s.assets.total, liabilities: s.liabilities.total }, guess, month);
  }, [step, accounts, guess, month]);

  const order = step === 'connecting' ? 'connect' : step;
  const stepIndex = STEPS.indexOf(order) + 1;
  const next = useCallback(() => {
    setStep((s) => (s === 'reveal' ? 'future' : s === 'future' ? 'decision' : s));
  }, []);
  const back = useCallback(() => {
    clearTimers();
    setStep((s) => (s === 'guess' ? 'play' : s === 'connect' || s === 'connecting' ? 'guess' : s === 'reveal' || s === 'analyzing' ? 'connect' : s === 'future' ? 'reveal' : s === 'decision' ? 'future' : s));
  }, []);

  const lifelineHouse = lifeline.status === 'ready' ? lifeline.house.art : 'house-build';
  const house: HouseArt =
    step === 'play' || step === 'guess' ? 'empty-plot'
      : step === 'connect' ? 'house-blueprint'
        : step === 'connecting' ? (phase >= SORT_PHASE ? 'house-build' : phase >= READ_PHASE ? 'house-crane' : 'house-blueprint')
          : step === 'analyzing' || step === 'reveal' ? 'house-build'
            : lifelineHouse;

  return {
    status: ready ? 'ready' : 'loading',
    step,
    stepIndex,
    stepCount: STEPS.length,
    house,
    guess: { value: guess, min: GUESS.min, max: GUESS.max, step: GUESS.step, label: copy.guess.label, formatValue: money },
    finishWarmup,
    setGuess,
    lockGuess,
    banks: BANKS,
    connect,
    connecting: step === 'connecting'
      ? {
          bankName: BANKS.find((b) => b.id === bankId)?.name ?? '',
          phase,
          readLabel: read ? copy.connecting.read(read.transactions.toLocaleString('en-US')) : null,
          failed,
        }
      : null,
    retry: start,
    analysis,
    reveal,
    lifeline,
    next,
    back,
  };
}
