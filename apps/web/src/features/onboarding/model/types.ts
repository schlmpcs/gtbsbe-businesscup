// View-model of the /start onboarding (useOnboarding). The contract with onboarding/ui/*, which may import
// only this file, @/ui-kit/** and @/copy. Numbers arrive formatted; raw values only where an animation
// counts up to them or a chart scales them.
import type { LifeLineVM } from '@/features/lifeline/model/types';

export type { LifeLineVM, LifeLineKpiVM, LifeLinePoint } from '@/features/lifeline/model/types';

export type OnboardingStep = 'play' | 'guess' | 'connect' | 'connecting' | 'analyzing' | 'reveal' | 'future' | 'decision';

/** `logo`: a public path to the bank's mark (public/banks, Simple Icons, CC0). */
export type BankVM = { id: string; name: string; logo: string };

export type HouseArt = 'empty-plot' | 'house-blueprint' | 'house-crane' | 'house-build' | 'home-large';

export type AnalysisIcon = 'cash' | 'home' | 'repeat' | 'fork' | 'card' | 'car' | 'cart' | 'kid' | 'spark' | 'piggy';
/** One merchant a row's money went to (or came from), the lines of that month summed. */
export type MerchantVM = { id: string; name: string; logo: string | null; initials: string; amountLabel: string; count: number };
export type AnalysisRowVM = {
  id: string;
  icon: AnalysisIcon;
  /** "Counting your subscriptions" while it runs. */
  label: string;
  /** Raw dollars a month (the count-up target) and the label it lands on ("$87/mo"). */
  value: number;
  valueLabel: string;
  tone: 'good' | 'bad' | 'plain';
  /** Share of take-home pay (or of spending without a paycheck), 0–1, for the bar. */
  share: number;
  /** The merchants behind the row, biggest first (at most 6); none for the "left" row. */
  merchants: MerchantVM[];
  /** Lines in the row this month. */
  count: number;
  /** "Rent + utilities" (the bucket's name, short). */
  bucket: string;
  /** The donut segment this row adds (spending rows only). */
  segment: { share: number; tone: 1 | 2 | 3 | 4 | 5 | 6 | 'primary' } | null;
};
export type AnalysisVM = {
  title: string;
  /** "Jul 1 – Nov 14". */
  rangeLabel: string | null;
  rows: AnalysisRowVM[];
  /** Rows finished so far (the next one is running); = rows.length when done. */
  done: number;
  /** Spending a month: count-up target and label, and what it is out of. */
  spent: number;
  spentLabel: string;
  ofLabel: string | null;
  complete: boolean;
};

export type RevealVM = {
  netWorth: number;
  netWorthLabel: string;
  guessLabel: string;
  /** "$43,103 too high", or "Spot on". */
  offLabel: string;
  offTone: 'good' | 'bad';
  ownLabel: string;
  oweLabel: string;
  takeHomeLabel: string | null;
  spendingLabel: string | null;
  /** The month's biggest categories, share of spending 0–1 for the bars. */
  topCategories: { label: string; amountLabel: string; share: number }[];
};

export type OnboardingVM = {
  status: 'loading' | 'ready';
  step: OnboardingStep;
  /** 1-based position for the progress bar (connecting counts as connect). */
  stepIndex: number;
  stepCount: number;
  house: HouseArt;
  guess: { value: number; min: number; max: number; step: number; label: string; formatValue: (v: number) => string };
  /** The warm-up duel round is done (or skipped): on to the guess. */
  finishWarmup: () => void;
  setGuess: (v: number) => void;
  lockGuess: () => void;
  banks: BankVM[];
  connect: (bankId: string) => void;
  connecting: {
    bankName: string;
    /** Index of the phase in progress (copy.onboarding.connecting.phases); = length when done. */
    phase: number;
    readLabel: string | null;
    failed: boolean;
  } | null;
  retry: () => void;
  analysis: AnalysisVM | null;
  reveal: RevealVM | null;
  /** Future and decision steps: the home Life line on the data just loaded. */
  lifeline: LifeLineVM;
  next: () => void;
  back: () => void;
};
