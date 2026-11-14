import { randomUUID } from 'node:crypto';
import { SessionRequestSchema } from '@lifeguessr/types';
import { expect, it } from 'vitest';
import { createMemorySessionStore } from './sessions.memory';
import { decodeStored } from './sessions';
import { TEST_STORE_URL, testPostgresStore } from './testUtils';
const goal = { target: 250000, years: 10 },
  opts = { mayAddToWishlist: false };
it('saves, retains and clears a goal independently of the profile and wishlist', async () => {
  const store = createMemorySessionStore(),
    id = randomUUID();
  await store.save(id, { goal }, opts);
  expect((await store.load(id)).goal).toEqual(goal);
  await store.save(id, { wishlist: [] }, opts);
  expect((await store.load(id)).goal).toEqual(goal);
  await store.save(id, { goal: null }, opts);
  expect((await store.load(id)).goal).toBeNull();
  expect(SessionRequestSchema.safeParse({ anonId: id, goal }).success).toBe(
    true,
  );
  expect(
    SessionRequestSchema.safeParse({
      anonId: id,
      goal: { ...goal, target: -1 },
    }).success,
  ).toBe(false);
  expect(decodeStored(null, [], { target: 'broken' }).goal).toBeUndefined();
});
it.skipIf(!TEST_STORE_URL)(
  'persists goal updates and clears in Postgres',
  async () => {
    const harness = testPostgresStore(),
      id = randomUUID();
    try {
      const store = harness.store.sessions;
      await store.save(id, { goal }, opts);
      expect((await store.load(id)).goal).toEqual(goal);
      await store.save(id, { wishlist: [] }, opts);
      expect((await store.load(id)).goal).toEqual(goal);
      await store.save(id, { goal: null }, opts);
      expect((await store.load(id)).goal ?? null).toBeNull();
    } finally {
      await harness.cleanup();
    }
  },
);
