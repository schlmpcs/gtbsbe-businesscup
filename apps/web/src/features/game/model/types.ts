// View-model types for the game feature (S2–S4). Tasks: Y7 (model) / Y8 (ui).
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hook: usePlay({ streamer }) in ./usePlay.ts. S3 (reveal) and S4 (streamer) are states of /play.
import type {
  AreaData, ClueId, ClueReveal, CostCategory, GuessResult, KidAge, LifeCard, Money, Rate, SceneLayout, SceneProp, Source,
} from '@lifeguessr/types';
import type { GameSource } from '@/lib/config';
import type { SliderVM, VMError } from '@/lib/model/types';

export type { SliderVM, VMError } from '@/lib/model/types';
export type { GameSource } from '@/lib/config';
/** Contract types the presentational ui/ files need to type their props (they may import only this file). */
export type { ClueId, CostCategory, KidAge, Money, Rate, SceneLayout, SceneProp, Source } from '@lifeguessr/types';

/** Neighborhood tier shown on the mailbox clue. */
export type AreaTier = AreaData['tier'];

/**
 * One displayable fact from a clue room (or from the revealed card), already interpreted so the UI
 * only picks strings: e.g. whether the car is financed is decided here, not in the UI.
 */
export type ClueFactVM =
  | { kind: 'noCar' }
  | { kind: 'car'; price: Money; financed: boolean; termMonths: number; apr: Rate }
  /** Kids by age; an empty list means no kids (the room is a home office). */
  | { kind: 'kids'; ages: KidAge[] }
  | { kind: 'eatingOut'; perWeek: number }
  | { kind: 'household'; adults: number; kids: number }
  /** `tier` is null when only the ZIP is known (the revealed card carries no area tier). */
  | { kind: 'zip'; zip: string; tier: AreaTier | null };

export type CluePhase = 'closed' | 'opening' | 'open' | 'error';

/** One clue room on the house scene. */
export type ClueVM = {
  id: ClueId;
  status: CluePhase;
  /** Props and facts for the room once it is open. */
  reveal: ClueReveal | null;
  /** The open room's facts, ready to display (empty while closed). */
  facts: ClueFactVM[];
  error: VMError | null;
};

/** S2: the home being explored. */
export type ExploreCardVM = {
  id: string;
  metro: string;
  layout: SceneLayout;
  caption: string;
  decor: SceneProp[];
  /** Every clue room, in CLUE_IDS order. */
  clues: ClueVM[];
  openedCount: number;
  /** Score multiplier with the clues opened so far (engine scoreGuess). */
  multiplier: number;
  /** Multiplier if one more clue is opened (equal to `multiplier` at the floor). */
  nextMultiplier: number;
  /** Share of the full score the next clue takes away (`multiplier − nextMultiplier`; 0 at the floor). */
  clueCost: Rate;
  /** Log-scale guess slider ($1k–$15k a month). */
  guess: SliderVM;
  submitting: boolean;
  guessError: VMError | null;
  guessed: boolean;
};

/** One cost line on the reveal. */
export type CostItemVM = {
  category: CostCategory;
  amount: Money;     // monthly
  share: Rate;       // amount / total.mid
  source: Source;
  isEstimate: boolean;
};

/** One cost category on the reveal: the engine's cost lines for that category added up. */
export type CategoryCostVM = {
  category: CostCategory;
  amount: Money;     // monthly
  share: Rate;       // amount / total.mid
  /** True when any line in the category is an estimate. */
  isEstimate: boolean;
  /** Every distinct source behind the category's lines, in line order. */
  sources: Source[];
};

/**
 * The guess against the range on one log-scale track (positions 0–1). The track spans the guess
 * slider ($1k–$15k), widened when the range or the guess falls outside it.
 */
export type RevealScaleVM = {
  min: Money;
  max: Money;
  low: number;
  mid: number;
  high: number;
  guess: number;
};

/** S3: the reveal after a guess. */
export type RevealVM = {
  cardId: string;
  resultId: string;
  guess: Money;
  total: { low: Money; mid: Money; high: Money };
  /** Where the guess landed against the range. */
  direction: 'low' | 'in' | 'high';
  result: GuessResult;
  /** Points for a guess in range with no clues opened (the per-home maximum). */
  maxPoints: number;
  /** The guess and the range on one track. */
  scale: RevealScaleVM;
  /** Cost lines, largest first. */
  items: CostItemVM[];
  /** Cost lines added up per category, largest first (what the bar breakdown shows). */
  categories: CategoryCostVM[];
  /** The surprise line: the biggest category share of the month ("Rent was 54% of her month"). */
  surprise: { category: CostCategory; share: Rate } | null;
  card: LifeCard;
  /** The card's facts (car, kids, eating out, household, ZIP), ready to display. */
  cardFacts: ClueFactVM[];
  cluesOpened: ClueId[];
  /** Share-card PNG URLs (api mode only; fixture results have no stored image). */
  shareImage: { story: string; square: string } | null;
  isLastCard: boolean;
};

export type ShareTileColor = 'green' | 'yellow' | 'red';

/** After all homes: the spoiler-free share grid and the bridge to S5. */
export type SummaryVM = {
  tiles: { cardId: string; color: ShareTileColor; points: number }[];
  totalPoints: number;
  maxPoints: number;
  played: number;
  guessedLow: number;
  guessedHigh: number;
  inRange: number;
  /** Ready-to-copy text: header, emoji grid, score (strings from @/copy game.share). */
  shareText: string;
  /** The home with the biggest miss (for the 9:16 clip card). */
  mostSurprising: { cardId: string; resultId: string; shareImage: { story: string; square: string } | null } | null;
};

/** S4: streamer mode extras. */
export type StreamerVM = {
  countdown: { total: number; secondsLeft: number; running: boolean };
  startCountdown: () => void;
  stopCountdown: () => void;
  resetCountdown: () => void;
  /** The guess is locked in (submitted or submitting); the answer shows only after this. */
  locked: boolean;
  /** Lock in the current slider value (same as submitGuess). Also fires when the countdown ends. */
  lockIn: () => void;
};

export type PlayPhase = 'explore' | 'reveal' | 'summary';

/** Sharing the summary text: Web Share API first, clipboard as the fallback. */
export type ShareStatus = 'idle' | 'sharing' | 'shared' | 'copied' | 'failed';

/** usePlay(): everything /play renders (S2, S3, S4). */
export type PlayVM = {
  status: 'loading' | 'ready' | 'error';
  error: VMError | null;
  retry: () => void;
  source: GameSource;
  /** US Eastern date of the set. */
  date: string | null;
  phase: PlayPhase;
  progress: { index: number; total: number; guessed: number };
  /** The current home (also present during its reveal). Null on the summary. */
  card: ExploreCardVM | null;
  reveal: RevealVM | null;
  summary: SummaryVM | null;
  streamer: StreamerVM | null;
  openClue: (clue: ClueId) => void;
  setGuess: (value: Money) => void;
  /** Set the guess from a 0–1 slider position (log scale). */
  setGuessPosition: (position: number) => void;
  submitGuess: () => void;
  /** Next home, or the summary after the last one. */
  next: () => void;
  /** Share the summary text (Web Share API, else copy to the clipboard). No-op outside the summary. */
  share: () => void;
  shareStatus: ShareStatus;
};
