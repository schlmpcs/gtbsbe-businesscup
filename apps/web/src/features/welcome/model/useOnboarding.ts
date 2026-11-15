// /start onboarding. One round of today's duel (the warm-up, rendered by the route) → "About you" (age,
// ZIP, household, take-home pay) → "What are you worth?" (a guess) → "Add it up" (what you have and owe)
// → connect a bank for spending → the answer → the plan to 90 → one decision. Age, ZIP, household, pay,
// cash, retirement and debts are the person's own answers (./answers). The bank connection is a demo
// (labelled as such on screen): any bank loads the sample statement for the month's spending, which goes
// through the real pipeline: parsed and masked in the browser, labels categorized by
// /api/statement/categorize, months summed by the engine and applied like an uploaded file; the typed pay
// and balances are kept over what the statement shows. The answer is netWorthSummary() of the accounts
// (built from the answers); the future and the decision are the home Life line (useLifeLine).
// Between the connection and the answer, the analysis walks through what the statement holds (paycheck,
// rent, subscriptions, …): every amount is the engine's month totals of that statement.
import { netWorthSummary } from '@lifeguessr/engine';
import { COST_CATEGORIES, type PlanResult } from '@lifeguessr/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { common, lifeline as lifelineCopy, welcome as copy } from '@/copy';
import { fillFromStatement } from '@/features/bankDemo/model/fillAll';
import { useStatementUpload } from '@/features/ladder/model/useStatementUpload';
import type { StatementMonthVM, StatementReadVM } from '@/features/ladder/model/types';
import { useLifeLine } from '@/features/lifeline/model/useLifeLine';
import { NO_MOVES, planOf, usePlanInputs } from '@/features/plan/model/planEngine';
import { usePlanReady, usePlanStore } from '@/features/plan/model/planStore';
import { GOOD_SUCCESS_RATE, useChanceOfSuccess } from '@/features/plan/model/useChanceOfSuccess';
import { writeRecord } from '@/features/onboarding/model/onboardingStore';
import { formatMoney, formatRate } from '@/lib/format';
import { useAccountsStore } from '@/lib/model/accounts';
import { useAppReady, useAppStore } from '@/state';
import { liabilityEstimates } from '@/lib/model/addAccount';
import {
  AGE, BALANCE_FIELDS, EMPTY_ABOUT, EMPTY_BALANCES, MAX_KIDS, aboutErrors, answersFrom, applyAbout, applyBalances, parseMoney,
  type AboutAnswers, type BalanceAnswers, type BalanceField,
} from './answers';
import { merchantOf } from './merchants';
import type { MerchantVM } from './types';
import type { AboutVM, AnalysisIcon, AnalysisRowVM, AnalysisVM, BalancesVM, BankVM, FieldVM, FutureVM, HouseArt, OnboardingStep, OnboardingVM, RevealVM } from './types';

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
const STEPS: OnboardingStep[] = ['play', 'about', 'guess', 'balances', 'connect', 'analyzing', 'reveal', 'future', 'decision'];
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

/** The future step from one plan() result and its Chance of success (a rate, or why there is none yet). Pure (exported for tests). */
export function futureOf(r: PlanResult, chance: number | 'measuring' | 'error'): FutureVM {
  const compact = (v: number) => formatMoney(v, { compact: true });
  const points = r.years.map((y) => ({ age: y.age, netWorth: y.netWorth }));
  const values = points.map((p) => p.netWorth);
  const { retireAge, netWorthAtRetirement, shortfallAge } = r.kpis;
  const atRetire = points.find((p) => p.age === retireAge) ?? points.at(-1)!;
  const measured = typeof chance === 'number';
  return {
    points,
    ageDomain: [points[0]!.age, points.at(-1)!.age],
    valueDomain: [Math.min(0, ...values), Math.max(0, ...values)],
    callout: { age: atRetire.age, netWorth: atRetire.netWorth, label: lifelineCopy.chart.atRetirement(compact(atRetire.netWorth), atRetire.age) },
    atRetirement: { id: 'atRetirement', label: lifelineCopy.kpi.atRetirement(retireAge), value: compact(netWorthAtRetirement), was: null, delta: null, tone: 'neutral' },
    chance: {
      id: 'chance', label: lifelineCopy.kpi.chance, value: measured ? formatRate(chance, 0) : null, was: null, delta: null,
      tone: measured ? (chance >= GOOD_SUCCESS_RATE ? 'good' : 'bad') : 'neutral',
      note: chance === 'error' ? lifelineCopy.kpi.unavailable : null,
    },
    onTrack: measured ? chance >= GOOD_SUCCESS_RATE : shortfallAge === null,
  };
}

export function useOnboarding(): OnboardingVM {
  const ready = useAppReady();
  const setProfile = useAppStore((s) => s.setProfile);
  const accounts = useAccountsStore((s) => s.accounts);
  // The connected bank's statement goes through the CSV pipeline once and fills every screen (ledger,
  // Cash flow, Recurring, accounts, budget, goal: bankDemo/fillAll), named after the bank picked. The
  // pay and balances the person typed stay as typed.
  const bankName = useRef('');
  const typedPay = useRef<number | null>(null);
  const readAndFill = useCallback(
    (file: File, deps?: Parameters<typeof fillFromStatement>[2]) =>
      fillFromStatement(file, bankName.current, deps, typedPay.current !== null ? { keepTyped: { takeHomePay: typedPay.current } } : {})
        .then((r) => r.read),
    [],
  );
  const upload = useStatementUpload({ readStatementFile: readAndFill });
  const lifeline = useLifeLine();

  const [step, setStep] = useState<OnboardingStep>('play');
  const [about, setAbout] = useState<AboutAnswers>(EMPTY_ABOUT);
  const [balances, setBalances] = useState<BalanceAnswers>(EMPTY_BALANCES);
  const [aboutTouched, setAboutTouched] = useState(false);
  const prefilled = useRef(false);
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
  const lockGuess = useCallback(() => setStep('balances'), []);
  const finishWarmup = useCallback(() => {
    // A profile the person made earlier prefills the forms; the starting sample never does.
    if (!prefilled.current && useAppStore.getState().profileOrigin !== 'demo') {
      const a = answersFrom(useAppStore.getState().profile);
      setAbout(a.about);
      setBalances(a.balances);
    }
    prefilled.current = true;
    setStep('about');
  }, []);

  const errors = aboutErrors(about);
  const aboutOk = Object.keys(errors).length === 0;
  const submitAbout = useCallback(() => {
    setAboutTouched(true);
    if (Object.keys(aboutErrors(about)).length > 0) return;
    setProfile(applyAbout(useAppStore.getState().profile, about), 'user');
    typedPay.current = parseMoney(about.takeHome);
    writeRecord({ chapter: 2 });
    setStep('guess');
  }, [about, setProfile]);

  const balancesOk = BALANCE_FIELDS.every((f) => parseMoney(balances[f], true) !== null);
  const submitBalances = useCallback(() => {
    if (!BALANCE_FIELDS.every((f) => parseMoney(balances[f], true) !== null)) return;
    const aprOf = (kind: 'card' | 'auto' | 'student' | 'personal' | 'bnpl' | 'mortgage', balance: number) =>
      (kind === 'card' ? liabilityEstimates('creditCard', balance) : liabilityEstimates('loan', balance, { debtKind: kind === 'mortgage' ? 'personal' : kind })).apr.value;
    setProfile(applyBalances(useAppStore.getState().profile, balances, aprOf), 'user');
    setStep('connect');
  }, [balances, setProfile]);

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
      setBankId(id);
      bankName.current = BANKS.find((b) => b.id === id)?.name ?? '';
      setStep('connecting');
      start();
    },
    [start],
  );

  // The statement is read: show the sorting phase, keep the latest month for the reveal, apply it.
  useEffect(() => {
    if (step !== 'connecting' || phase < READ_PHASE || applied.current || upload.status !== 'review') return;
    applied.current = true;
    const months = upload.pending;
    const latest = [...months].reverse().find((m) => m.averaged) ?? months.at(-1) ?? null;
    // The paycheck is the take-home pay the person typed, not the demo statement's.
    const picked = latest && typedPay.current !== null ? { ...latest, detectedPay: typedPay.current } : latest;
    setMonth(picked);
    setRead(upload.lastRead);
    // The typed pay replaces the statement's paycheck, so its payroll lines are not shown.
    setLines(typedPay.current !== null ? upload.lines.filter((l) => l.cls !== 'pay') : upload.lines);
    setPhase(SORT_PHASE);
    apply();
    const rows = picked ? analysisRows(picked).length : 0;
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
    if (step === 'play' || step === 'about' || step === 'guess' || step === 'balances' || step === 'connect' || step === 'connecting' || step === 'analyzing') return null;
    const s = netWorthSummary(accounts);
    return revealOf({ netWorth: s.netWorth, assets: s.assets.total, liabilities: s.liabilities.total }, guess, month);
  }, [step, accounts, guess, month]);

  const f = copy.about;
  const field = (id: 'age' | 'zip' | 'takeHome', extra: Omit<FieldVM, 'id' | 'value' | 'invalid'>): FieldVM =>
    ({ id, value: about[id], invalid: aboutTouched && !!errors[id], ...extra });
  const aboutVM: AboutVM = {
    age: field('age', { label: f.age, hint: f.ageHint(AGE.min, AGE.max), inputMode: 'numeric', placeholder: '30' }),
    zip: field('zip', { label: f.zip, hint: f.zipHint, inputMode: 'numeric', placeholder: '10001' }),
    takeHome: field('takeHome', { label: f.takeHome, hint: f.takeHomeHint, prefix: '$', suffix: f.perMonth, inputMode: 'decimal', placeholder: '4,000' }),
    adults: about.adults,
    kids: about.kids,
    maxKids: MAX_KIDS,
    setField: (id, value) => setAbout((a) => ({ ...a, [id]: id === 'zip' ? value.replace(/\D/g, '').slice(0, 5) : value })),
    setAdults: (n) => setAbout((a) => ({ ...a, adults: n })),
    setKids: (n) => setAbout((a) => ({ ...a, kids: Math.max(0, Math.min(MAX_KIDS, n)) })),
    canSubmit: aboutOk,
    submit: submitAbout,
  };
  const b = copy.balances;
  const balanceField = (id: BalanceField): FieldVM => ({
    id, label: b.fields[id], value: balances[id], invalid: parseMoney(balances[id], true) === null,
    prefix: '$', inputMode: 'decimal', placeholder: '0',
  });
  const balancesVM: BalancesVM = {
    own: (['cash', 'retirement'] as const).map(balanceField),
    owe: (['card', 'student', 'auto', 'personal'] as const).map(balanceField),
    setField: (id, value) => setBalances((x) => (id in x ? { ...x, [id]: value } : x)),
    canSubmit: balancesOk,
    submit: submitBalances,
  };

  const order = step === 'connecting' ? 'connect' : step;
  const stepIndex = STEPS.indexOf(order) + 1;
  const next = useCallback(() => {
    setStep((s) => (s === 'reveal' ? 'future' : s === 'future' ? 'decision' : s));
  }, []);
  const back = useCallback(() => {
    clearTimers();
    setStep((s) => (s === 'about' ? 'play' : s === 'guess' ? 'about' : s === 'balances' ? 'guess' : s === 'connect' || s === 'connecting' ? 'balances' : s === 'reveal' || s === 'analyzing' ? 'connect' : s === 'future' ? 'reveal' : s === 'decision' ? 'future' : s));
  }, []);

  // The future step is the plan as it stands: the active scenario through planOf() and the plan store's
  // Chance of success run, the same two the dashboard's plan card and /plan read, so the numbers match.
  const planReady = usePlanReady();
  const planInputs = usePlanInputs();
  const scenario = usePlanStore((s) => s.scenarios.find((x) => x.id === s.activeId));
  const moves = usePlanStore((s) => s.movesApplied[s.activeId] ?? NO_MOVES);
  const chanceResult = usePlanStore((s) => s.chanceResult);
  const { status: chanceStatus, run: runChance } = useChanceOfSuccess();
  const onPlan = step === 'reveal' || step === 'future' || step === 'decision';
  useEffect(() => {
    if (onPlan && planReady && scenario && chanceStatus === 'idle') runChance();
  }, [onPlan, planReady, scenario, chanceStatus, runChance]);
  const future = useMemo((): FutureVM | null => {
    if (!onPlan || !planReady || !scenario || !planInputs.profile.asOf) return null;
    const r = planOf(planInputs, scenario, moves);
    if (r.years.length === 0) return null;
    return futureOf(r, chanceStatus === 'done' && chanceResult ? chanceResult.successRate : chanceStatus === 'error' ? 'error' : 'measuring');
  }, [onPlan, planReady, scenario, planInputs, moves, chanceStatus, chanceResult]);

  const lifelineHouse = step === 'future' ? (future?.onTrack === false ? 'house-build' : 'home-large') : lifeline.status === 'ready' ? lifeline.house.art : 'house-build';
  const house: HouseArt =
    step === 'play' || step === 'about' || step === 'guess' ? 'empty-plot'
      : step === 'balances' || step === 'connect' ? 'house-blueprint'
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
    about: aboutVM,
    balances: balancesVM,
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
    future,
    next,
    back,
  };
}
