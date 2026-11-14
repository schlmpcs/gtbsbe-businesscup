// Server-only: together plans in process memory (tests, and `pnpm dev` without STORE_URL). Same
// rules as Postgres (./together.ts); values are copied in and out, like a database would.
import type { TogetherPlan } from '@lifeguessr/types';
import { isPlanId, newPlan, type TogetherStore } from './together';

export function createMemoryTogetherStore(): TogetherStore {
  const plans = new Map<string, TogetherPlan>();
  const purge = (now: Date) => {
    for (const [id, plan] of plans) if (Date.parse(plan.expiresAt) <= now.getTime()) plans.delete(id);
  };
  const live = (id: string, now: Date) => {
    if (!isPlanId(id)) return null;
    const plan = plans.get(id);
    return plan && Date.parse(plan.expiresAt) > now.getTime() ? plan : null;
  };

  return {
    async create(partner1, goal, now) {
      purge(now);
      const plan = newPlan(structuredClone(partner1), goal ? { ...goal } : null, now);
      plans.set(plan.id, plan);
      return structuredClone(plan);
    },

    async get(id, now) {
      const plan = live(id, now);
      return plan ? structuredClone(plan) : null;
    },

    async setPartner2(id, partner2, goal, now) {
      purge(now);
      const plan = live(id, now);
      if (!plan) return null;
      const next: TogetherPlan = {
        ...plan,
        partner2: structuredClone(partner2),
        goal: goal === undefined ? plan.goal : goal ? { ...goal } : null,
      };
      plans.set(id, next);
      return structuredClone(next);
    },
  };
}
