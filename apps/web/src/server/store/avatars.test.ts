import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { cloneProfileDemo } from '@lifeguessr/data/fixtures';
import { AvatarPublicSchema } from '@lifeguessr/types';
import { createMemoryStore, type Store, anonKey } from './index';
import { TEST_STORE_URL, testPostgresStore } from './testUtils';
import { avatarExpiresOn } from './avatars';
type Harness = { store: Store; cleanup: () => Promise<void> };
const implementations: [string, () => Harness][] = [
  ['memory', () => ({ store: createMemoryStore(), cleanup: async () => {} })],
];
if (TEST_STORE_URL)
  implementations.push(['postgres', () => testPostgresStore()]);
describe.each(implementations)('%s avatar publishing', (name, make) => {
  let harness: Harness | undefined;
  afterEach(async () => {
    await harness?.cleanup();
  });
  const open = () => {
    harness = make();
    return harness.store;
  };
  const seed = async (store: Store, id = randomUUID()) => {
    await store.sessions.save(
      id,
      { profile: cloneProfileDemo() },
      { mayAddToWishlist: false },
    );
    return id;
  };
  it('publishes the exact preview, keeps one ID on republish and deletes on unpublish', async () => {
    const store = open(),
      id = await seed(store),
      draft = await store.avatars.preview(id);
    const published = await store.avatars.publish(
      id,
      '2026-11-14',
      draft.token,
    );
    expect(published.published).toEqual({
      ...draft.preview.payload,
      avatarId: published.published!.avatarId,
    });
    expect(published.published!.stamp).toBe('selfReported');
    expect(published.republish).toBe(false);
    const second = await store.avatars.publish(id, '2026-11-15', draft.token);
    expect(second.published!.avatarId).toBe(published.published!.avatarId);
    expect(second.republish).toBe(true);
    expect(JSON.stringify(second)).not.toMatch(/ownerKey|owner_key|anon/);
    expect(await store.avatars.unpublish(id)).toBe(true);
    expect(await store.avatars.unpublish(id)).toBe(false);
    expect((await store.avatars.status(id, '2026-11-15')).status).toEqual({
      state: 'none',
    });
    expect(
      (await store.avatars.publish(id, '2026-11-15', draft.token)).published!
        .avatarId,
    ).not.toBe(published.published!.avatarId);
  });
  it('rejects missing sessions, unknown metros, out-of-bounds values and stale previews', async () => {
    const store = open();
    await expect(store.avatars.preview(randomUUID())).rejects.toMatchObject({
      code: 'no_session',
    });
    const id = await seed(store),
      draft = await store.avatars.preview(id),
      p = cloneProfileDemo();
    p.cash.value = 99_000_000;
    await store.sessions.save(id, { profile: p }, { mayAddToWishlist: false });
    await expect(
      store.avatars.publish(id, '2026-11-14', draft.token),
    ).rejects.toMatchObject({ code: 'stale_preview' });
    const invalid = await store.avatars.preview(id);
    await expect(
      store.avatars.publish(id, '2026-11-14', invalid.token),
    ).rejects.toMatchObject({ code: 'out_of_bounds' });
    p.zip = '00000';
    await store.sessions.save(id, { profile: p }, { mayAddToWishlist: false });
    await expect(
      store.avatars.publish(
        id,
        '2026-11-14',
        (await store.avatars.preview(id)).token,
      ),
    ).rejects.toMatchObject({ code: 'no_metro' });
  });
  it('expires, refreshes and sweeps by calendar day, including leap years', async () => {
    expect(avatarExpiresOn('2026-11-14')).toBe('2027-02-12');
    expect(() => avatarExpiresOn('2026-02-30')).toThrow(RangeError);
    const store = open(),
      id = await seed(store),
      draft = await store.avatars.preview(id);
    await store.avatars.publish(id, '2026-11-14', draft.token);
    const refreshed = await store.avatars.status(id, '2027-02-12');
    expect(refreshed.status.state).toBe('published');
    expect((await store.avatars.status(id, '2027-05-14')).status.state).toBe(
      'none',
    );
  });
  it('keeps concurrent republishes under one owner and does not expose a small pool or the owner', async () => {
    const store = open(),
      owner = await seed(store),
      token = (await store.avatars.preview(owner)).token;
    const results = await Promise.all([
      store.avatars.publish(owner, '2026-11-14', token),
      store.avatars.publish(owner, '2026-11-14', token),
    ]);
    expect(results[0]!.published!.avatarId).toBe(
      results[1]!.published!.avatarId,
    );
    expect(await store.avatars.poolFor('2026-11-14')).toEqual([]);
    for (let i = 0; i < 19; i++) {
      const id = await seed(store);
      await store.avatars.publish(
        id,
        '2026-11-14',
        (await store.avatars.preview(id)).token,
      );
    }
    const pool = await store.avatars.poolFor('2026-11-14', anonKey(owner));
    expect(pool).toHaveLength(19);
    expect(
      pool.some((p) => p.avatarId === results[0]!.published!.avatarId),
    ).toBe(false);
    expect(pool.every((p) => AvatarPublicSchema.safeParse(p).success)).toBe(
      true,
    );
    expect(await store.avatars.poolFor('2027-02-13')).toEqual([]);
  });
});
