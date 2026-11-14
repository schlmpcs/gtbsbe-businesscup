// zod schemas for the game contracts (docs/ARCHITECTURE.md → Contracts: PublicCard, ClueReveal,
// GuessReveal). Used to validate /api/daily* responses and the game state restored from storage.
// They live here, not in packages/types, so the shared contracts don't change in this task.
import {
  AreaTierSchema, CLUE_IDS, CostCategorySchema, KidAgeSchema, LifeCardSchema, MoneySchema, SourceSchema,
  type ClueReveal, type CostBreakdown, type GuessReveal, type PublicCard,
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

/** GET /api/daily: today's cards (bare array, or `{ date, cards }`). */
export const DailyResponseSchema = z.union([
  z.array(PublicCardSchema).transform((cards) => ({ date: null, cards })),
  z.object({ date: z.string().nullable().optional(), cards: z.array(PublicCardSchema) })
    .transform((d) => ({ date: d.date ?? null, cards: d.cards })),
]);
