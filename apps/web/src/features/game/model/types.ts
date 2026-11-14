// View-model types for the game feature (S2–S4). Tasks: Y7 (model) / Y8 (ui).
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hook: usePlay({ streamer }) in ./usePlay.ts. S3 (reveal) and S4 (streamer) are states of /play.
import type {
  AreaData, ClueId, ClueReveal, CostCategory, GuessResult, KidAge, LifeCard, Money, Rate, SceneLayout, SceneProp, Source,
} from '@lifeguessr/types';
import type { DuelLetter, DuelRound } from '@lifeguessr/types';
import type { DuelCopyStatus, DuelShareStatus, DuelTileColor } from '@/copy/duel';
import type { GameSource } from '@/lib/config';
import type { Loadable, SliderVM, VMError } from '@/lib/model/types';

export type { Loadable, SliderVM, VMError } from '@/lib/model/types';
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
  /** How far the guess was from the most likely cost (|guess − total.mid|, per month). */
  missBy: Money;
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

/** One home in today's strip: its points once guessed, and whether it is the one on screen. */
export type DayHomeVM = { cardId: string; points: number | null; current: boolean };

/** Today's running score (the score bar and the strip of homes on S2/S3). */
export type DayVM = {
  /** Points for a guess in range with no clues opened (the per-home maximum). */
  maxPerHome: number;
  /** Points scored so far today. */
  totalPoints: number;
  homes: DayHomeVM[];
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
  /** Today's running score and the strip of homes. */
  day: DayVM;
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

// ----- Duel game (S2 Duel round, S3 Reveal, S3 Day result): useDuel() in ./useDuel.ts --------

export type { DuelLetter, DuelRound } from '@lifeguessr/types';
export type { DuelCopyStatus, DuelShareStatus, DuelTileColor } from '@/copy/duel';

/**
 * How a duel card looks: `round` = open for a pick; `picked` = the pick is on its way; after the
 * reveal `winner` = the costlier life, `other` = the cheaper one.
 */
export type DuelCardState = 'round' | 'picked' | 'winner' | 'other';

/** One cost category on a revealed duel card (monthly). */
export type DuelCategoryVM = {
  category: CostCategory;
  amount: Money;
  /** Bar length: amount / the larger of the two totals (0–1), so both cards share one scale. */
  scale: Rate;
  isEstimate: boolean;
  sources: Source[];
};

export type DuelCardVM = {
  letter: DuelLetter;
  metro: string;
  household: string;
  caption: string;
  /** The 4 fact chips. */
  facts: string[];
  /** The hint's extra fact, once the hint is open. */
  hintFact: string | null;
  /** House sprite id for SpriteImage. */
  art: string;
  composite: true;
  state: DuelCardState;
  /** The player tapped this card (after the reveal). */
  pickedByYou: boolean;
  /** Monthly total, after the reveal only. */
  total: Money | null;
  /** Category bars, largest first; empty before the reveal. */
  categories: DuelCategoryVM[];
};

export type DuelHintVM = {
  used: boolean;
  status: 'idle' | 'opening' | 'error';
  /** Share of the round's points the hint takes away (0 at the floor). */
  cost: Rate;
  /** Points a right pick scores now / after one more hint. */
  pointsNow: number;
  pointsWithHint: number;
};

export type DuelRevealVM = {
  round: DuelRound;
  choice: DuelLetter;
  correct: boolean;
  points: number;
  /** Null when both lives cost the same. */
  costlier: DuelLetter | null;
  /** How much more the costlier life costs a month. */
  difference: Money;
  totals: Record<DuelLetter, Money>;
  /** The deciding category: what the costlier life (or A, on a tie) spends on it vs the other. */
  decidedBy: { category: CostCategory; amount: Money; otherAmount: Money; otherLetter: DuelLetter };
  lesson: string;
  /**
   * How other players picked: the letter most of them chose, its share (already rounded to the
   * whole percent shown, see buildDuelCrowd) and how many picks that is. Null = not enough picks yet.
   */
  crowd: { letter: DuelLetter; share: Rate; total: number } | null;
  /** Every source behind both breakdowns, by category. */
  sources: { category: CostCategory; sources: Source[] }[];
  isLastRound: boolean;
};

export type DuelDotVM = { round: DuelRound; state: 'current' | 'upcoming' | DuelTileColor };

export type DuelSummaryVM = {
  right: number;
  rounds: number;
  totalPoints: number;
  maxPoints: number;
  tiles: { round: DuelRound; color: DuelTileColor }[];
  /** The category behind most missed rounds (null when none was missed). */
  blindSpot: CostCategory | null;
  /** Absolute link a friend opens to play the same five: /duel?c={resultId}. */
  challengeUrl: string;
  shareText: string;
  /**
   * The day's share card PNG (GET /api/share): 9:16 for stories, 1:1 for feeds. Null when the duel
   * plays on fixtures, where the server has no picks to draw it from.
   */
  shareImage: { story: string; square: string } | null;
  /** Time left until the next set (New York midnight). */
  nextIn: { hours: number; minutes: number };
};

export type DuelPhase = 'round' | 'reveal' | 'summary';

/** A score on a day's five duels: right picks out of the rounds, the points and one tile per round. */
export type DuelScoreVM = {
  right: number;
  rounds: number;
  points: number;
  tiles: { round: DuelRound; color: DuelTileColor }[];
};

/** How you stand against a friend: more right picks win, then more points (a hint costs points). */
export type DuelOutcome = 'ahead' | 'tied' | 'behind';

/**
 * What a challenge link (/duel?c=…) says, once it is read:
 * - `friend`: your friend's score on today's five, the target before and during play. Once you have
 *   played all five, `comparison` holds yours next to it (null until then).
 * - `earlier`: the link is from another day, so its five duels are gone: no comparison. `dateLabel`
 *   is that day, formatted for the sentence ("Nov 14").
 * - `own`: your own link (this browser or this anonymous id): your result, not a comparison.
 * A link that names no stored day, or one whose day is unfinished, has no ChallengeVM (null).
 */
export type ChallengeVM =
  | { kind: 'friend'; friend: DuelScoreVM; comparison: { you: DuelScoreVM; outcome: DuelOutcome } | null }
  | { kind: 'earlier'; dateLabel: string }
  | { kind: 'own' };

/** useDuel(): everything the duel screen renders. */
export type DuelVM = {
  status: 'loading' | 'ready' | 'error';
  error: VMError | null;
  retry: () => void;
  source: GameSource;
  date: string | null;
  phase: DuelPhase;
  round: DuelRound | null;
  totalRounds: number;
  dots: DuelDotVM[];
  /** The current round's two cards (also during its reveal); null on the summary. */
  cards: [DuelCardVM, DuelCardVM] | null;
  hint: DuelHintVM | null;
  pickError: VMError | null;
  reveal: DuelRevealVM | null;
  summary: DuelSummaryVM | null;
  /** Opened from a challenge link (/duel?c=…), whatever it turned out to say. */
  challenged: boolean;
  /**
   * What the link says (see ChallengeVM). `ready` with null data: no link, or a link with nothing
   * to show for it (an id nobody holds, an unfinished day): with `challenged` the screen shows the
   * generic "a friend challenged you" line. `loading` until the link and the day are both read;
   * `error` when the server could not be asked (same generic line).
   */
  challenge: Loadable<ChallengeVM | null>;
  /**
   * The day on screen ended while it was played (the server answered 409 `day_over`), so these are
   * the new day's five: say so. Cleared by the next pick or hint.
   */
  newDay: boolean;
  pick: (letter: DuelLetter) => void;
  openHint: () => void;
  /** Next round, or the day result after round 5. */
  next: () => void;
  guessOwn: () => void;
  copyChallenge: () => void;
  copyStatus: DuelCopyStatus;
  share: () => void;
  shareStatus: DuelShareStatus;
};
