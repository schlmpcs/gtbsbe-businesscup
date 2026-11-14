// zod schemas for the game contracts (docs/ARCHITECTURE.md → Contracts: PublicCard, ClueReveal,
// GuessReveal) and the T5 routes' requests and replies (/api/daily, /api/daily/clue,
// /api/daily/guess, /api/leaderboard). The routes validate their input with these, the browser
// validates the replies, and the game state restored from storage goes through them too.
// They live here, not in packages/types, so the shared contracts don't change in this task.
import {
  AnonIdSchema, AreaTierSchema, CLUE_IDS, CostCategorySchema, DuelHintSchema, DuelLetterSchema, KidAgeSchema, LifeCardSchema, MoneySchema,
  PickResultSchema, PublicDuelSchema, SourceSchema,
  type ClueReveal, type CostBreakdown, type GuessReveal, type Money, type PublicCard,
} from '@lifeguessr/types';
import { z } from 'zod';

export const ClueIdSchema = z.enum(CLUE_IDS);

export const ScenePropSchema = z.object({
  sprite: z.string(),
  room: z.string(),
  clue: ClueIdSchema.optional(),
});

export const PublicCardSchema = z.object({
  id: z.string().min(1),
  metro: z.string(),
  layout: z.enum(['studio', '1bed', '2bed', '3bed', '4bed']),
  caption: z.string(),
  decor: z.array(ScenePropSchema),
}) satisfies z.ZodType<PublicCard>;

export const ClueRevealSchema = z.object({
  cardId: z.string().min(1),
  clue: ClueIdSchema,
  props: z.array(ScenePropSchema),
  facts: z.object({
    car: LifeCardSchema.shape.car.optional(),
    kids: z.array(KidAgeSchema).optional(),
    eatingOutPerWeek: z.number().optional(),
    adults: z.union([z.literal(1), z.literal(2)]).optional(),
    zip: z.string().optional(),
    tier: AreaTierSchema.optional(),
  }),
}) satisfies z.ZodType<ClueReveal>;

export const CostBreakdownSchema = z.object({
  total: z.object({ low: MoneySchema, mid: MoneySchema, high: MoneySchema }),
  items: z.array(z.object({
    category: CostCategorySchema,
    amount: MoneySchema,
    source: SourceSchema,
    isEstimate: z.boolean(),
  })),
}) satisfies z.ZodType<CostBreakdown>;

export const GuessRevealSchema = z.object({
  resultId: z.string().min(1),
  cost: CostBreakdownSchema,
  result: z.object({
    points: z.number(),
    basePoints: z.number(),
    multiplier: z.number(),
    inRange: z.boolean(),
    // JSON has no Infinity: a guess ≤ 0 has logError = Infinity, which serializes as null.
    logError: z.number().nullable().transform((v) => v ?? Number.POSITIVE_INFINITY),
  }),
  card: LifeCardSchema,
  cluesOpened: z.array(ClueIdSchema),
}) satisfies z.ZodType<GuessReveal, unknown>;

// ----- T5 routes ---------------------------------------------------------------------------------

/** A daily set's US Eastern calendar date, 'YYYY-MM-DD'. */
export const PlayDateSchema = z.iso.date();

/** A life card id as the routes accept it (the catalog's ids look like `lc-001`). */
export const CardIdSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, 'not a card id');

/** Largest monthly guess the routes accept ($1M a month; the slider stops at $15k). */
export const MAX_GUESS: Money = 1_000_000;

/**
 * POST /api/daily/clue. `date` is the set's date from GET /api/daily; without it the server uses
 * today's. A set stays open for a short grace period after US Eastern midnight, then answers 409
 * `day_over`.
 */
export const ClueRequestSchema = z.strictObject({
  anonId: AnonIdSchema,
  cardId: CardIdSchema,
  clue: ClueIdSchema,
  date: PlayDateSchema.optional(),
});
export type ClueRequest = z.input<typeof ClueRequestSchema>;

/** POST /api/daily/guess: a monthly cost in dollars. The client never sends clues or a score. */
export const GuessRequestSchema = z.strictObject({
  anonId: AnonIdSchema,
  cardId: CardIdSchema,
  guess: z.number().positive().max(MAX_GUESS),
  date: PlayDateSchema.optional(),
});
export type GuessRequest = z.input<typeof GuessRequestSchema>;

/** A scored guess: the amount guessed and the server's reveal. */
export type PlayedGuess = { guess: Money; reveal: GuessReveal };

export const PlayedGuessSchema = z.object({ guess: MoneySchema, reveal: GuessRevealSchema });

/**
 * POST /api/daily/guess reply: the GuessReveal plus the amount it scored and whether it is a
 * stored result answered again (a repeated guess for the same card never scores twice).
 */
export const GuessReplySchema = GuessRevealSchema.extend({ guess: MoneySchema, replayed: z.boolean() });

/**
 * What the server already holds for this player today (GET /api/daily with x-anon-id): the clues
 * it recorded per card, in the order they were opened, and the guesses it scored. The browser
 * merges it in, so a cleared tab shows the same clues and results the server will count.
 */
export type DailyProgress = { clues: Record<string, ClueReveal[]>; guesses: Record<string, PlayedGuess> };

export const DailyProgressSchema = z.object({
  clues: z.record(z.string(), z.array(ClueRevealSchema)),
  guesses: z.record(z.string(), PlayedGuessSchema),
});

/** GET /api/daily: today's cards (bare array, or `{ date, cards, progress? }`). */
export const DailyResponseSchema = z.union([
  z.array(PublicCardSchema).transform((cards) => ({ date: null, cards, progress: null })),
  z.object({
    date: z.string().nullable().optional(),
    cards: z.array(PublicCardSchema),
    progress: DailyProgressSchema.optional(),
  }).transform((d) => ({ date: d.date ?? null, cards: d.cards, progress: d.progress ?? null })),
]);

// ----- GET /api/daily?game=duel (DU3, #112) ------------------------------------------------------

/** Which game GET /api/daily answers. A missing `game` parameter means 'slider'. */
export const DailyGameSchema = z.enum(['slider', 'duel']);
export type DailyGame = z.infer<typeof DailyGameSchema>;

/** A duel round as a JSON object key: JSON keys are strings (the browser's DuelProgress uses numbers). */
export const DuelRoundKeySchema = z.enum(['1', '2', '3', '4', '5']);

/**
 * What the server recorded for this player on the duel day (GET /api/daily?game=duel with
 * x-anon-id), keyed by round. Zod 4's `z.record(z.enum(...))` demands every key, so these are
 * `partialRecord`s: a round that was not picked (or hinted) has no entry.
 * - `resultId`: the day's result id (share and challenge links), null until the first pick.
 * - `picks`: the choice and the result as scored at pick time; its `crowd` is live (null until
 *   enough players picked), the rest is stored.
 * - `hints`: the TEXT of the hint of each round the server recorded a hint for, nothing else: the
 *   browser never gets a hint it did not ask for.
 * Maps onto the client's DuelProgress by turning the round keys into numbers (#115).
 */
export const DuelProgressWireSchema = z.object({
  resultId: z.string().regex(/^[0-9a-f]{32}$/).nullable(),
  picks: z.partialRecord(DuelRoundKeySchema, z.object({ choice: DuelLetterSchema, result: PickResultSchema })),
  hints: z.partialRecord(DuelRoundKeySchema, DuelHintSchema),
});
export type DuelProgressWire = z.infer<typeof DuelProgressWireSchema>;

/** GET /api/daily?game=duel: the day's five duels, and with `x-anon-id` the player's progress. */
export const DuelDailyResponseSchema = z.object({
  ok: z.literal(true),
  date: PlayDateSchema,
  duels: z.array(PublicDuelSchema).length(5),
  progress: DuelProgressWireSchema.optional(),
});
export type DuelDailyResponse = z.infer<typeof DuelDailyResponseSchema>;

/** One player on the day's leaderboard. `handle` is made up from a hash: no id, no PII. */
export const LeaderboardEntrySchema = z.object({
  rank: z.number().int().min(1),
  handle: z.string(),
  points: z.number().int().min(0),
  played: z.number().int().min(0),
  inRange: z.number().int().min(0),
  /** True on the caller's own row (when the request carried its x-anon-id). */
  you: z.boolean(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

/**
 * GET /api/leaderboard?date=YYYY-MM-DD (header x-anon-id optional): the day's players ranked by
 * the points of their stored guesses. Players with equal points share a rank; among them the one
 * who finished first is listed first. `rank` and `todayStats` are the caller's own (null without
 * an id, or before their first guess).
 */
export const LeaderboardResponseSchema = z.object({
  ok: z.literal(true),
  date: PlayDateSchema,
  players: z.number().int().min(0),
  entries: z.array(LeaderboardEntrySchema),
  rank: z.number().int().min(1).nullable(),
  todayStats: LeaderboardEntrySchema.omit({ rank: true, you: true }).nullable(),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

// ----- Duel routes (DU5, DU4) --------------------------------------------------------------------
// The requests are `DuelHintRequestSchema` and `DuelPickRequestSchema` in packages/types (strict:
// a client-sent score, hint count or total is a 400). Only the replies live here.

/**
 * POST /api/daily/hint reply: one more fact per life (the neighborhood tier) plus whether this
 * ask was recorded. `recorded: false` for a repeat or an ask after the pick: the text is the same,
 * the score is not affected.
 */
export const HintReplySchema = DuelHintSchema.extend({ recorded: z.boolean() });
export type HintReply = z.infer<typeof HintReplySchema>;

/**
 * POST /api/daily/pick reply: the round's result as the server scored it, plus whether it was
 * scored now (`replayed: false`) or is the stored result of an earlier pick of the same round
 * (`replayed: true`, even when the repeat named the other letter: the first pick is the one that
 * counts). `crowd` is live, so it can differ between a pick and its replay.
 */
export const PickReplySchema = PickResultSchema.extend({ replayed: z.boolean() });
export type PickReply = z.infer<typeof PickReplySchema>;

/** Error codes of the game routes (`{ ok: false, error: { code } }`). */
export const GAME_ERROR_CODES = [
  'bad_request', 'too_large', 'rate_limited', 'unavailable',
  'not_in_set',   // the card is not in that day's set (404)
  'day_over',     // the set's day has ended (409): load GET /api/daily again
  'not_found',    // /api/share: no stored result with that id (404)
] as const;
export type GameErrorCode = (typeof GAME_ERROR_CODES)[number];
