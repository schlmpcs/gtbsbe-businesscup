import { z } from 'zod';
import { MAX_ID_LENGTH, SUBSCRIPTION_FINDINGS_MAX, SUBSCRIPTION_TICKS_MAX } from './constants';
import { MonthSchema } from './schemas';
import { SubscriptionAuditSchema } from './subscriptionAudit';
// Local settings only. Feature PRs extend their own slice; no tool state enters a server session.
/** A finding id, or a ticked service as `tick:<service>`: short, never empty. */
const choiceId = z.string().min(1).max(MAX_ID_LENGTH);
/** Ids of the findings (and ticked services) a person has made a choice about: at most all of them. */
const choiceIds = z.array(choiceId).max(SUBSCRIPTION_FINDINGS_MAX + SUBSCRIPTION_TICKS_MAX).default([]);
/**
 * What the subscription audit keeps in this browser (M5, #81). Merchant labels are in `audit`, which is
 * why none of it ever enters a session or the database.
 */
export const SubscriptionToolStateSchema = z.strictObject({
  /** The monthly guess (0 is a guess). Absent until one is entered. */
  guess: z.number().finite().nonnegative().optional(),
  /** The services ticked, with the plan chosen. One entry per service. */
  ticks: z.array(z.strictObject({ serviceId: choiceId, planId: choiceId })).max(SUBSCRIPTION_TICKS_MAX).default([]).refine(
    (ticks) => new Set(ticks.map((t) => t.serviceId)).size === ticks.length,
    { message: 'a service is ticked once' },
  ),
  /** Low-confidence findings the person said are subscriptions: they count once confirmed. */
  confirmed: choiceIds,
  /** Findings the person said are not subscriptions: hidden and never counted. */
  dismissed: choiceIds,
  /** Findings (and ticked services) marked to cancel in the plan. */
  cancelMarked: choiceIds,
  /** The last statement's findings, as the detector returned them (M3). */
  audit: SubscriptionAuditSchema.optional(),
});
export const OverpayingToolStateSchema = z.strictObject({
  zip: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  metro: z.string().max(100).optional(),
  tier: z.enum(['cheap', 'mid', 'expensive', 'suburb']).optional(),
  bedrooms: z.number().int().min(0).max(4).default(2),
  adults: z.number().int().min(1).max(4).default(1),
  kids: z
    .array(z.enum(['infant', 'toddler', 'preschool', 'schoolAge']))
    .max(20)
    .default([]),
  rent: z.number().finite().positive().optional(),
  carInsurance: z.number().finite().positive().optional(),
  groceries: z.number().finite().positive().optional(),
  childcare: z.number().finite().positive().optional(),
});
export const PayoffToolStateSchema = z.strictObject({
  method: z.enum(['avalanche', 'snowball']).default('avalanche'),
  extra: z.number().finite().nonnegative().default(0),
  /**
   * The month the person wants to be debt-free by, as 'YYYY-MM'. A calendar month, not a number of
   * months from the day it was saved: a count from the save date moves every time it is read back later.
   */
  targetMonth: MonthSchema.refine((m) => Number(m.slice(0, 4)) >= 2000 && Number(m.slice(0, 4)) <= 2200, {
    message: 'year out of range (2000 to 2200)',
  }).optional(),
});
export const ToolsStateSchema = z.strictObject({
  subscriptions: SubscriptionToolStateSchema.optional(),
  overpaying: OverpayingToolStateSchema.optional(),
  payoff: PayoffToolStateSchema.optional(),
});
export type ToolsState = z.infer<typeof ToolsStateSchema>;
