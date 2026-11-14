// View-model types for the game feature (S2–S4). Tasks: Y7 (model) / Y8 (ui).
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hook: usePlay({ streamer }) in ./usePlay.ts. S3 (reveal) and S4 (streamer) are states of /play.
import type {
  ClueId, ClueReveal, CostCategory, GuessResult, LifeCard, Money, Rate, SceneLayout, SceneProp, Source,
} from '@lifeguessr/types';
import type { GameSource } from '@/lib/config';
import type { SliderVM, VMError } from '@/lib/model/types';

export type { SliderVM, VMError } from '@/lib/model/types';
export type { GameSource } from '@/lib/config';

export type CluePhase = 'closed' | 'opening' | 'open' | 'error';

/** One clue room on the house scene. */
export type ClueVM = {
  id: ClueId;
  status: CluePhase;
  /** Props and facts for the room once it is open. */
  reveal: ClueReveal | null;
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

/** S3: the reveal after a guess. */
export type RevealVM = {
  cardId: string;
  resultId: string;
  guess: Money;
  total: { low: Money; mid: Money; high: Money };
  /** Where the guess landed against the range. */
  direction: 'low' | 'in' | 'high';
  result: GuessResult;
  /** Cost lines, largest first. */
  items: CostItemVM[];
  /** The surprise line: the biggest share of the month ("Rent was 54% of her month"). */
  surprise: { category: CostCategory; share: Rate } | null;
  card: LifeCard;
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
};
