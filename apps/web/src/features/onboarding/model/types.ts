// View-model types for the onboarding story ("/" landing and /start, 4 chapters). The contract with
// onboarding/ui/*, which may import only this file, @/ui-kit/** and @/copy (lint-enforced). The story
// reuses the ladder's and the plan's view-models (re-exported below), and adds its own: the practice
// duel (chapter 1), the month reveal (chapter 3) and the story's progress.
import type { CostCategory, DuelLetter, Money, Rate } from '@lifeguessr/types';
import type { SliderVM } from '@/lib/model/types';

export type { CostCategory, DuelLetter, Money, Rate } from '@lifeguessr/types';
export type { SliderVM } from '@/lib/model/types';
export type {
  ClosestLifeVM, GuessPayoffVM, GuessYourselfVM, QuickSlidersVM, StatementUploadError, StatementUploadVM,
} from '@/features/ladder/model/types';
export type { ChanceOfSuccessVM, PlanMovesVM, PlanVM, PlanChartPoint, PlanKpiVM } from '@/features/plan/model/types';

// ----- The story ------------------------------------------------------------------------------

/** The four chapters, in order. */
export type ChapterId = 1 | 2 | 3 | 4;

/** What is kept in this browser about the story (never a number of the person's month). */
export type OnboardingRecord = {
  /** The chapter the person reached last. */
  chapter: ChapterId;
  /** Chapter 4 was reached: "/" sends the person to /dashboard from now on. */
  done: boolean;
  /** The practice duel's average guess error (0–1), for the bridge line in chapter 2; null until played. */
  practiceError: Rate | null;
};

export type StoryVM = {
  status: 'loading' | 'ready';
  chapter: ChapterId;
  /** Chapters the person may jump back to (reached ones). */
  reached: ChapterId;
  goTo: (chapter: ChapterId) => void;
  /** Chapter 4 reached: mark the story finished (idempotent). */
  finish: () => void;
  practiceError: Rate | null;
  setPracticeError: (error: Rate) => void;
};

/** "/": what the landing does for this browser. */
export type LandingVM = {
  /**
   * loading: saved state not read yet (nothing shown but the frame). redirect: the story was finished
   * (or the person built a profile before it existed): go to `redirectTo`. continue: a story in
   * progress, resume at `resumeChapter`. fresh: a first visit.
   */
  mode: 'loading' | 'redirect' | 'continue' | 'fresh';
  redirectTo: string;
  startHref: string;
  /** Chapter 1 again ("Start over", for a story in progress). */
  restartHref: string;
  resumeChapter: ChapterId | null;
  sampleHref: string;
  /** Load the sample household before following `sampleHref` (the store refuses over a profile of one's own). */
  seeSample: () => void;
};

// ----- Chapter 1: the practice duel -------------------------------------------------------------

/** One category bar on a revealed card (monthly). `share` = amount / the larger card's total (0–1), for the bar width. */
export type PracticeBarVM = { category: CostCategory; amount: Money; share: Rate };

/** House cutout for a card, from the facts it shows (bedrooms, kids, car), never from its cost. */
export type PracticeArt = 'home-apartment' | 'home-apartment-nocar' | 'home-family' | 'home-suburb' | 'home-large' | 'home-cottage';

export type PracticeCardVM = {
  letter: DuelLetter;
  household: string;
  metro: string;
  caption: string;
  facts: string[];
  art: PracticeArt;
  /** Monthly total (engine costOfLife total.mid), after the reveal only. */
  total: Money | null;
  /** total / the larger total (0–1), after the reveal only: the total bar's width. */
  totalShare: Rate | null;
  /** Top categories, largest first, after the reveal only. */
  bars: PracticeBarVM[];
  /** After the reveal: this one costs more. */
  costlier: boolean;
  picked: boolean;
};

export type PracticeResultVM = {
  round: number;
  correct: boolean;
  /** Your number for the life you picked, and what it costs (monthly). */
  guess: Money;
  actual: Money;
  /** |guess − actual| / actual (0 = spot on). */
  error: Rate;
  /** guess below the actual cost. */
  low: boolean;
  /** What the costlier life outspends the other on the most. */
  decidedBy: CostCategory;
  /** How much more the costlier life costs a month. */
  gap: Money;
};

export type PracticeSummaryVM = {
  /** Mean of the rounds' errors (0–1). */
  averageError: Rate;
  right: number;
  rounds: PracticeResultVM[];
  /** More rounds guessed low than high. */
  mostlyLow: boolean;
};

export type PracticeVM = {
  /** pick: tap a life. guess: your number for it (the pick can still change). revealed: totals shown. summary: after the last round. */
  phase: 'pick' | 'guess' | 'revealed' | 'summary';
  round: number;
  rounds: number;
  cards: [PracticeCardVM, PracticeCardVM];
  choice: DuelLetter | null;
  guess: SliderVM;
  result: PracticeResultVM | null;
  summary: PracticeSummaryVM | null;
  pick: (letter: DuelLetter) => void;
  setGuess: (value: Money) => void;
  reveal: () => void;
  next: () => void;
  restart: () => void;
};

// ----- Chapter 3: the month reveal --------------------------------------------------------------

export type MonthCategoryVM = { category: CostCategory; amount: Money; share: Rate };

/** "Your guess $X" vs "Your real month $Y", the gap, and where the month goes. */
export type MonthRevealVM = {
  /** The chapter 2 guess; null when it was skipped (then there is no gap to show). */
  guess: Money | null;
  actual: Money;
  /** actual − guess (positive: the month costs more than guessed); null without a guess. */
  difference: Money | null;
  /** |difference| / guess (0–∞); null without a guess. */
  differenceShare: Rate | null;
  direction: 'more' | 'less' | 'exact' | null;
  /** guess / max(guess, actual) and actual / max(...): bar widths (0–1). */
  guessShare: Rate;
  actualShare: Rate;
  /** The month is still the typical one for the household (no statement, no slider moved). */
  isEstimate: boolean;
  /** Where the month came from. */
  from: 'statement' | 'sliders' | 'estimate';
  /** Spending categories and minimum debt payments, largest first (zeros left out); shares of `actual`. */
  categories: MonthCategoryVM[];
};
