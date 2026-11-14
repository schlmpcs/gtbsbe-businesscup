// Server-only: "Together" shared plans (/together). A plan holds partner 1's numbers, partner 2's
// once they add them, and an optional shared goal; nothing else (no names, no statements, no anon
// ids). It lives under an unguessable id (16 random bytes, base64url): the link is the only key,
// and whoever holds it may read the plan and fill in partner 2. Plans expire TOGETHER_TTL_DAYS
// after they are created; an expired plan reads as not found and is deleted on the next write.
//
// The rules live here once; the Postgres and memory stores only load and write rows around them.
import { randomBytes } from 'node:crypto';
import {
  GoalSchema, TOGETHER_TTL_DAYS, TogetherIdSchema, TogetherPartnerSchema,
  type Goal, type TogetherPartner, type TogetherPlan,
} from '@lifeguessr/types';

export interface TogetherStore {
  /** A new plan with partner 1's numbers (and the goal, if any). */
  create(partner1: TogetherPartner, goal: Goal | null, now: Date): Promise<TogetherPlan>;
  /** The plan, or null when the id is unknown, malformed or expired. */
  get(id: string, now: Date): Promise<TogetherPlan | null>;
  /**
   * Sets (or replaces) partner 2's numbers; a goal given here replaces the plan's (undefined keeps
   * it). Null when the plan does not exist or expired.
   */
  setPartner2(id: string, partner2: TogetherPartner, goal: Goal | null | undefined, now: Date): Promise<TogetherPlan | null>;
}

export const newPlanId = (): string => randomBytes(16).toString('base64url');

export const isPlanId = (id: string): boolean => TogetherIdSchema.safeParse(id).success;

export function planExpiresAt(now: Date): Date {
  return new Date(now.getTime() + TOGETHER_TTL_DAYS * 86_400_000);
}

/** A fresh plan (pure apart from the id, which the caller may pass). */
export function newPlan(partner1: TogetherPartner, goal: Goal | null, now: Date, id = newPlanId()): TogetherPlan {
  return {
    id,
    partner1,
    partner2: null,
    goal,
    createdAt: now.toISOString(),
    expiresAt: planExpiresAt(now).toISOString(),
  };
}

/**
 * Reads stored JSON back through the current contracts. A row whose partner 1 no longer parses is
 * dropped (null); a broken partner 2 or goal reads as missing.
 */
export function decodePlan(row: {
  id: string; partner1: unknown; partner2: unknown; goal: unknown; createdAt: string; expiresAt: string;
}): TogetherPlan | null {
  const p1 = TogetherPartnerSchema.safeParse(row.partner1);
  if (!p1.success) {
    console.warn('[store] a saved together plan no longer matches the contract; ignoring it');
    return null;
  }
  const p2 = row.partner2 == null ? null : TogetherPartnerSchema.safeParse(row.partner2);
  const goal = row.goal == null ? null : GoalSchema.safeParse(row.goal);
  return {
    id: row.id,
    partner1: p1.data,
    partner2: p2?.success ? p2.data : null,
    goal: goal?.success ? goal.data : null,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}
