'use client';
// /start: onboarding without typing. The statement is the only input, from one of three sources:
//   generated  GET /api/statement/generate (packages/data/statementGen.ts, public data for a ZIP)
//   bank       a simulated bank connection: no login, labeled on screen; it serves one of the invented
//              customers' CSV exports (packages/data/demoBanks.ts, GET /api/statement/demo-bank)
//   upload     the user's own CSV
// Every source then goes through the one statement pipeline (useStatementUpload → readStatementFile:
// parsed and masked in this browser, categorized by /api/statement/categorize, summed by the engine),
// so nothing here special-cases a generated file. While it reads, the user guesses the monthly
// spending (the game's habit); the reveal compares the guess with the measured month.
import { statementAverages } from '@lifeguessr/engine';
import { DEMO_BANKS, demoBankAccount } from '@lifeguessr/data/demoBanks';
import { generatorMetros, GEN_HOUSEHOLDS, GEN_PAY_BANDS, GEN_STYLES, HOUSEHOLD_SHAPE, planStatement, TAKE_HOME_BY_BAND } from '@lifeguessr/data/statementGen';
import { COST_CATEGORIES, type CategoryTotals, type CostCategory } from '@lifeguessr/types';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStatementUpload } from '@/features/ladder/model/useStatementUpload';
import { usEasternDate } from '@/lib/dates';
import { readStatementCsv, toStatementItems } from '@/lib/statement/read';
import { useAppStore } from '@/state';
import type {
  ConnectVM, GenHouseholdVM, GenPayVM, GenStyleVM, GenTierVM, GenerateVM, MaskedLineVM, ReadingVM, RevealVM, StartError,
  StartSource, StartStep, StartVM,
} from './types';

/** Where "Build my plan" goes. The planner screens replace /future in MP14; its redirect follows. */
export const START_NEXT_ROUTE = '/future';
/** Lines shown in "Everything that leaves this browser". */
export const MASKED_PREVIEW_LINES = 8;
/** Guess slider bounds (log scale), as in the game. */
export const GUESS_BOUNDS = { min: 1000, max: 15000, initial: 3500 } as const;
/** How long each reading step stays on screen at least, so the steps can be read (ms). */
const STEP_MS = 650;
/** How long the simulated bank connection "links" before the transactions come in (ms). */
const LINK_MS = 1400;

const METROS = generatorMetros();
const DEFAULT_METRO = METROS.find((m) => m.metro.startsWith('Austin'))?.metro ?? METROS[0]!.metro;

type Fetcher = (url: string, signal: AbortSignal) => Promise<string>;
const defaultFetch: Fetcher = async (url, signal) => {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
};

export type StartOptions = { fetchText?: Fetcher; today?: () => string };

export function useStart(opts: StartOptions = {}): StartVM {
  const fetchText = opts.fetchText ?? defaultFetch;
  const today = opts.today ?? usEasternDate;
  const router = useRouter();
  const statement = useStatementUpload();
  const setHouseholdFacts = useAppStore((s) => s.setHousehold);

  const [step, setStep] = useState<StartStep>('choose');
  const [source, setSource] = useState<StartSource | null>(null);
  const [bankId, setBankId] = useState<string | null>(null);
  const [connectStage, setConnectStage] = useState<ConnectVM['stage']>('pick');
  /** Connections made per demo bank: each new one serves the bank's next invented customer. */
  const [connections, setConnections] = useState<Record<string, number>>({});
  const [error, setError] = useState<StartError | null>(null);

  // Generator choices.
  const [metro, setMetroState] = useState(DEFAULT_METRO);
  const [tier, setTier] = useState<GenTierVM>('mid');
  const [household, setHousehold] = useState<GenHouseholdVM>('family');
  const [pay, setPay] = useState<GenPayVM>('steady');
  const [style, setStyle] = useState<GenStyleVM>('typical');
  const [seed, setSeed] = useState(1);

  // Reading.
  const [lines, setLines] = useState<MaskedLineVM[] | null>(null);
  const [lineCount, setLineCount] = useState<number | null>(null);
  const [phase, setPhase] = useState<ReadingVM['phase']>(0);
  const [done, setDone] = useState(false);
  const [guess, setGuess] = useState<number>(GUESS_BOUNDS.initial);
  const [guessLocked, setGuessLocked] = useState(false);
  const [guessSkipped, setGuessSkipped] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const lastAction = useRef<(() => void) | null>(null);
  const linkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    abort.current?.abort();
    if (linkTimer.current) clearTimeout(linkTimer.current);
  }, []);

  const tiers = useMemo(() => METROS.find((m) => m.metro === metro)?.tiers ?? [], [metro]);
  const zip = (tiers.find((t) => t.tier === tier) ?? tiers[0])!.zip;
  const setMetro = useCallback((m: string) => {
    if (METROS.some((x) => x.metro === m)) setMetroState(m);
  }, []);

  const preview = useMemo(() => {
    const plan = planStatement({ zip, household, pay, style, seed, asOf: '2026-01-31' });
    return {
      zip,
      bedrooms: plan.bedrooms,
      rentUtilities: plan.monthly.rentUtilities,
      childcare: plan.monthly.childcare > 0 ? plan.monthly.childcare : null,
      groceries: plan.monthly.groceries,
      car: plan.hasCar ? plan.monthly.car : null,
      transit: plan.hasCar ? null : plan.monthly.car,
      takeHome: plan.monthly.takeHome,
      sources: plan.sources,
    };
  }, [zip, household, pay, style, seed]);

  const payAmounts = useMemo(() => {
    const earners = HOUSEHOLD_SHAPE[household].earners;
    const out = {} as Record<GenPayVM, number>;
    for (const p of GEN_PAY_BANDS) out[p] = TAKE_HOME_BY_BAND[p] * (earners === 2 ? 1.8 : 1);
    return out;
  }, [household]);

  /** Read CSV text through the one pipeline, keeping a masked copy of what is sent for the screen. */
  const readText = useCallback((text: string, fileName: string) => {
    try {
      const items = toStatementItems(readStatementCsv(text).transactions);
      setLineCount(items.length);
      setLines(items.slice(0, MASKED_PREVIEW_LINES));
    } catch {
      setLineCount(null);
      setLines([]);
    }
    setPhase(1);
    statement.readFile?.(new File([text], fileName, { type: 'text/csv' }));
  }, [statement]);

  const begin = useCallback((src: StartSource) => {
    abort.current?.abort();
    setSource(src);
    setError(null);
    setLines(null);
    setLineCount(null);
    setPhase(0);
    setDone(false);
    setGuessLocked(false);
    setGuessSkipped(false);
    setGuess(GUESS_BOUNDS.initial);
    setStep('reading');
  }, []);

  const download = useCallback((url: string, src: 'generated' | 'bank', fileName: string) => {
    const run = () => {
      begin(src);
      const controller = new AbortController();
      abort.current = controller;
      fetchText(url, controller.signal).then(
        (text) => { if (!controller.signal.aborted) readText(text, fileName); },
        () => { if (!controller.signal.aborted) setError({ kind: 'generate' }); },
      );
    };
    lastAction.current = run;
    run();
  }, [begin, fetchText, readText]);

  const generate = useCallback(() => {
    const q = new URLSearchParams({ zip, household, pay, style, seed: String(seed), asOf: today() });
    download(`/api/statement/generate?${q}`, 'generated', 'statement.generated.csv');
    setSeed((s) => s + 1); // the next "Generate" draws a new statement
  }, [zip, household, pay, style, seed, today, download]);

  // Simulated bank connection: pick → accounts → linking → the account's transactions are read.
  const bank = DEMO_BANKS.find((b) => b.id === bankId) ?? null;
  const bankAccount = bank ? demoBankAccount(bank, connections[bank.id] ?? 0) : null;
  const confirmConnect = useCallback(() => {
    if (!bank) return;
    const n = connections[bank.id] ?? 0;
    setConnectStage('linking');
    if (linkTimer.current) clearTimeout(linkTimer.current);
    linkTimer.current = setTimeout(() => {
      download(`/api/statement/demo-bank?bank=${bank.id}&n=${n}`, 'bank', `${bank.id}-checking.csv`);
      setConnections((c) => ({ ...c, [bank.id]: n + 1 }));
    }, LINK_MS);
  }, [bank, connections, download]);

  const uploadFile = useCallback((file: File) => {
    const run = () => {
      begin('upload');
      file.text().then((text) => readText(text, file.name), () => setError({ kind: 'unreadable' }));
    };
    lastAction.current = run;
    run();
  }, [begin, readText]);

  // Reading steps: parse → mask → sort run on a timer once the file is in; "find" waits for the
  // categorizer; `done` shows a beat after it so the last step can be read.
  useEffect(() => {
    if (step !== 'reading' || phase === 0 || phase >= 3) return;
    const t = setTimeout(() => setPhase((p) => (p < 3 ? ((p + 1) as ReadingVM['phase']) : p)), STEP_MS);
    return () => clearTimeout(t);
  }, [step, phase]);
  // "find" ends when the categorizer has answered; `done` follows a beat later so it can be read.
  const categorized = step === 'reading' && phase >= 3 && statement.status === 'review';
  useEffect(() => {
    if (!categorized) return;
    const t = setTimeout(() => setDone(true), STEP_MS);
    return () => clearTimeout(t);
  }, [categorized]);
  const shownPhase: ReadingVM['phase'] = categorized ? 4 : phase;

  const pipelineError: StartError | null = step === 'reading' && statement.status === 'error'
    ? { kind: statement.error?.kind === 'unreadable' || statement.error?.kind === 'badInput' ? 'unreadable' : 'network' }
    : null;
  const shownError = error ?? pipelineError;

  // The review opens once the statement is read and the guess is locked (or skipped).
  const shownStep: StartStep = step === 'reading' && done && (guessLocked || guessSkipped) ? 'review' : step;

  const reveal = useMemo((): RevealVM | null => {
    if (shownStep !== 'review' || statement.pending.length === 0) return null;
    const used = statement.pending.filter((m) => m.averaged);
    const months: CategoryTotals[] = (used.length > 0 ? used : statement.pending).map((m) => ({
      month: m.month, totals: m.totals, oneOffs: [], ...(m.detectedPay != null && { detectedPay: m.detectedPay }),
    }));
    const avg = statementAverages(months);
    const breakdown = COST_CATEGORIES
      .map((category) => ({ category, amount: avg.spending[category] ?? 0 }))
      .filter((r) => r.amount > 0.5)
      .sort((a, b) => b.amount - a.amount);
    const monthlySpend = breakdown.reduce((s, r) => s + r.amount, 0);
    const top = breakdown[0];
    const g = guessLocked ? guess : null;
    return {
      guess: g,
      monthlySpend,
      diff: g == null ? null : monthlySpend - g,
      payIn: avg.takeHomePay,
      leftOver: avg.takeHomePay == null ? null : avg.takeHomePay - monthlySpend,
      breakdown,
      biggest: top && monthlySpend > 0 ? { category: top.category, share: top.amount / monthlySpend } : null,
      oneOffs: statement.pending.flatMap((m) => m.oneOffs).slice(0, 4),
      months: avg.months.length,
      categorizedBy: statement.lastRead?.categorizedBy ?? null,
    };
  }, [shownStep, statement.pending, statement.lastRead, guess, guessLocked]);

  const finish = useCallback(() => {
    statement.apply();
    // A generated statement knows its household and ZIP: keep them.
    if (source === 'generated') {
      const shape = HOUSEHOLD_SHAPE[household];
      setHouseholdFacts({ adults: shape.adults, kids: [...shape.kids], bedrooms: shape.bedrooms, hasCar: preview.car != null }, zip);
    }
    router.push(START_NEXT_ROUTE);
  }, [statement, source, household, zip, preview.car, setHouseholdFacts, router]);

  const restart = useCallback(() => {
    abort.current?.abort();
    if (linkTimer.current) clearTimeout(linkTimer.current);
    statement.discard();
    setStep('choose');
    setSource(null);
    setError(null);
    setBankId(null);
    setConnectStage('pick');
  }, [statement]);

  const back = useCallback(() => {
    if (step === 'connect' && connectStage === 'accounts') setConnectStage('pick');
    else if (step === 'connect' || step === 'generate') setStep('choose');
    else restart();
  }, [step, connectStage, restart]);

  const generator: GenerateVM = {
    metros: METROS.map((m) => m.metro),
    metro,
    setMetro,
    tiers: tiers.map((t) => t.tier),
    tier,
    setTier,
    households: [...GEN_HOUSEHOLDS],
    household,
    setHousehold,
    pays: [...GEN_PAY_BANDS],
    pay,
    setPay,
    payAmounts,
    styles: [...GEN_STYLES],
    style,
    setStyle,
    preview,
    generate,
  };

  const connect: ConnectVM = {
    stage: connectStage,
    banks: DEMO_BANKS.map(({ id, name, logo }) => ({ id, name, logo })),
    bank: bank ? { id: bank.id, name: bank.name, logo: bank.logo } : null,
    account: bank && bankAccount ? { label: bank.accountLabel, last4: bankAccount.last4, metro: bankAccount.metro } : null,
    pick: (id) => { if (DEMO_BANKS.some((b) => b.id === id)) { setBankId(id); setConnectStage('accounts'); } },
    confirm: confirmConnect,
    back,
  };

  return {
    ready: statement.status !== 'loading',
    step: shownStep,
    source,
    chooseConnect: () => { setBankId(null); setConnectStage('pick'); setStep('connect'); },
    chooseGenerate: () => setStep('generate'),
    uploadFile,
    back,
    connect,
    generator,
    reading: shownStep === 'reading' && source
      ? { source, bankName: source === 'bank' ? (bank?.name ?? null) : null, lineCount, masked: lines ?? [], phase: shownPhase, done }
      : null,
    guess: {
      value: guess,
      set: (v) => { if (!guessLocked) setGuess(Math.min(GUESS_BOUNDS.max, Math.max(GUESS_BOUNDS.min, v))); },
      locked: guessLocked,
      lock: () => setGuessLocked(true),
      min: GUESS_BOUNDS.min,
      max: GUESS_BOUNDS.max,
      own: source !== 'generated',
    },
    reveal,
    skipGuess: () => setGuessSkipped(true),
    questions: shownStep === 'review' ? statement.questions : [],
    answerCategory: statement.answerCategory,
    answerNone: (id) => statement.answerAmount(id, 0),
    skipQuestion: statement.skipQuestion,
    error: shownError,
    retry: () => lastAction.current?.(),
    finish,
    restart,
  };
}

export type { CostCategory };
