import { togetherPartnerSample } from '@lifeguessr/data/fixtures';
import { TOGETHER_TTL_DAYS, TogetherPlanSchema, type TogetherPartner } from '@lifeguessr/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decodePlan, newPlanId, planExpiresAt } from './together';
import { createMemoryTogetherStore } from './together.memory';
import type { TogetherStore } from './together';
import { describePostgres, testPostgresStore } from './testUtils';

const partner = (): TogetherPartner => structuredClone(togetherPartnerSample) as TogetherPartner;
const DAY = 86_400_000;
const now = new Date('2026-11-14T12:00:00Z');

function contract(name: string, make: () => { store: TogetherStore; cleanup?: () => Promise<void> }) {
  describe(name, () => {
    let store: TogetherStore;
    let cleanup: (() => Promise<void>) | undefined;
    beforeAll(() => {
      ({ store, cleanup } = make());
    });
    afterAll(async () => cleanup?.());

    it('creates a plan under a random 22-character id that expires after the TTL', async () => {
      const plan = await store.create(partner(), { target: 50_000, years: 5 }, now);
      expect(TogetherPlanSchema.parse(plan)).toEqual(plan);
      expect(plan.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(plan.partner2).toBeNull();
      expect(Date.parse(plan.expiresAt) - Date.parse(plan.createdAt)).toBe(TOGETHER_TTL_DAYS * DAY);
      expect(await store.get(plan.id, now)).toEqual(plan);
      const other = await store.create(partner(), null, now);
      expect(other.id).not.toBe(plan.id);
      expect(other.goal).toBeNull();
    });

    it('adds partner 2, keeps the goal unless one is given, and can clear it', async () => {
      const plan = await store.create(partner(), { target: 50_000, years: 5 }, now);
      const p2 = { ...partner(), nickname: 'Alex' };
      const withP2 = await store.setPartner2(plan.id, p2, undefined, now);
      expect(withP2?.partner2).toEqual(p2);
      expect(withP2?.goal).toEqual({ target: 50_000, years: 5 });
      const newGoal = await store.setPartner2(plan.id, p2, { target: 90_000, years: 8 }, now);
      expect(newGoal?.goal).toEqual({ target: 90_000, years: 8 });
      expect((await store.get(plan.id, now))?.goal).toEqual({ target: 90_000, years: 8 });
      expect((await store.setPartner2(plan.id, p2, null, now))?.goal).toBeNull();
    });

    it('answers null for unknown, malformed and expired ids', async () => {
      expect(await store.get(newPlanId(), now)).toBeNull();
      expect(await store.get("x' OR 1=1 --", now)).toBeNull();
      expect(await store.setPartner2(newPlanId(), partner(), undefined, now)).toBeNull();
      const plan = await store.create(partner(), null, now);
      const later = new Date(now.getTime() + TOGETHER_TTL_DAYS * DAY);
      expect(await store.get(plan.id, later)).toBeNull();
      expect(await store.setPartner2(plan.id, partner(), undefined, later)).toBeNull();
    });
  });
}

contract('memory together store', () => ({ store: createMemoryTogetherStore() }));

describePostgres('postgres together store', () => {
  contract('on Postgres', () => {
    const harness = testPostgresStore();
    return { store: harness.store.together, cleanup: harness.cleanup };
  });
});

describe('together rules', () => {
  it('expires TOGETHER_TTL_DAYS after now', () => {
    expect(planExpiresAt(now).toISOString()).toBe('2026-12-14T12:00:00.000Z');
  });

  it('drops a stored plan whose partner 1 no longer parses, and a broken partner 2 or goal reads as missing', () => {
    const base = { id: newPlanId(), createdAt: now.toISOString(), expiresAt: planExpiresAt(now).toISOString() };
    expect(decodePlan({ ...base, partner1: { broken: true }, partner2: null, goal: null })).toBeNull();
    const plan = decodePlan({ ...base, partner1: partner(), partner2: { broken: true }, goal: { target: -1 } });
    expect(plan?.partner2).toBeNull();
    expect(plan?.goal).toBeNull();
  });
});
