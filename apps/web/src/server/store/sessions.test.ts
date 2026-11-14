import type { Profile, Purchase } from '@lifeguessr/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import { createMemoryStore, type Store } from './index';
import {
  addsToWishlist, applySessionUpdate, canonicalJson, decodeStored, emptySession, type SessionState,
} from './sessions';
import { adminQuery, TEST_STORE_URL, testPostgresStore } from './testUtils';

const ANON = '0f8e2b4c-1d2e-4f5a-9b8c-7d6e5f4a3b2c';
const OTHER = '7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d';
const NOW = '2026-11-14T10:00:00.000Z';

const laptop: Purchase = { label: 'Laptop', amount: 1_400, recurring: false, payWith: 'card' };
const gym: Purchase = { label: 'Gym', amount: 30, recurring: 'monthly', payWith: 'cash' };
const car: Purchase = {
  label: 'Used car',
  amount: 18_000,
  recurring: false,
  payWith: { loan: { amount: 18_000, apr: 0.079, termMonths: 60, downPayment: 2_000 } },
};
const withAge = (age: number): Profile => ({ ...cloneProfileDemo(), age: { value: age, isEstimate: false } });

const PRO = { mayAddToWishlist: true };
const FREE = { mayAddToWishlist: false };

describe('canonicalJson', () => {
  it('ignores key order and undefined fields, keeps array order', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: undefined } })).toBe(canonicalJson({ a: { d: [2, 1] }, b: 1 }));
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
});

describe('addsToWishlist', () => {
  it('is false for the same items in any order, or fewer of them', () => {
    expect(addsToWishlist([laptop, gym, car], [car, laptop, gym])).toBe(false);
    expect(addsToWishlist([laptop, gym], [gym])).toBe(false);
    expect(addsToWishlist([laptop], [])).toBe(false);
  });

  it('matches purchases by value whatever order their keys were written in', () => {
    const reordered = JSON.parse('{"payWith":"card","recurring":false,"amount":1400,"label":"Laptop"}') as Purchase;
    expect(addsToWishlist([laptop], [reordered])).toBe(false);
  });

  it('is true for a new item, a changed one, or one more copy than saved', () => {
    expect(addsToWishlist([laptop], [laptop, gym])).toBe(true);
    expect(addsToWishlist([laptop], [{ ...laptop, amount: 1_401 }])).toBe(true);
    expect(addsToWishlist([laptop], [laptop, laptop])).toBe(true);
    expect(addsToWishlist([], [gym])).toBe(true);
  });
});

describe('applySessionUpdate', () => {
  const saved: SessionState = { profile: withAge(30), wishlist: [laptop, gym], revision: 4, updatedAt: '2026-11-13T00:00:00.000Z' };

  it('replaces each field it carries, keeps the others, and bumps the revision', () => {
    expect(applySessionUpdate(saved, { profile: withAge(31) }, FREE, NOW)).toEqual({
      ok: true,
      session: { profile: withAge(31), wishlist: [laptop, gym], revision: 5, updatedAt: NOW },
    });
    expect(applySessionUpdate(saved, { wishlist: [gym] }, FREE, NOW)).toEqual({
      ok: true,
      session: { profile: withAge(30), wishlist: [gym], revision: 5, updatedAt: NOW },
    });
  });

  it('treats an update without fields as a load', () => {
    expect(applySessionUpdate(saved, {}, FREE, NOW)).toEqual({ ok: true, session: saved });
  });

  it('refuses to add to the wishlist without Pro, but lets a free user keep or remove items', () => {
    expect(applySessionUpdate(saved, { wishlist: [laptop, gym, car] }, FREE, NOW)).toEqual({ ok: false, reason: 'wishlist_locked' });
    expect(applySessionUpdate(saved, { profile: withAge(40), wishlist: [car] }, FREE, NOW)).toEqual({ ok: false, reason: 'wishlist_locked' });
    expect(applySessionUpdate(saved, { wishlist: [gym, laptop] }, FREE, NOW).ok).toBe(true);
    expect(applySessionUpdate(saved, { wishlist: [] }, FREE, NOW).ok).toBe(true);
  });

  it('lets a Pro user add', () => {
    const result = applySessionUpdate(saved, { wishlist: [laptop, gym, car] }, PRO, NOW);
    expect(result.ok && result.session.wishlist).toEqual([laptop, gym, car]);
  });
});

describe('decodeStored', () => {
  it('drops a profile that no longer matches the contract, and broken wishlist items', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(decodeStored({ age: 'old shape' }, [laptop, { label: '' }, gym])).toEqual({ wishlist: [laptop, gym] });
    expect(decodeStored(null, 'not a list')).toEqual({ wishlist: [] });
    expect(decodeStored(withAge(33), [])).toEqual({ profile: withAge(33), wishlist: [] });
    vi.restoreAllMocks();
  });
});

// ----- the same behaviour from both implementations ------------------------------------------

type Harness = { store: Store; cleanup: () => Promise<void> };
const implementations: [string, () => Harness][] = [['memory', () => ({ store: createMemoryStore(), cleanup: async () => {} })]];
if (TEST_STORE_URL) implementations.push(['postgres', () => testPostgresStore()]);

describe.each(implementations)('%s session store', (backend, make) => {
  let harness: Harness | undefined;
  const open = () => {
    harness = make();
    return harness.store.sessions;
  };
  afterEach(async () => {
    await harness?.cleanup();
    harness = undefined;
  });

  it('loads an empty session for an unknown id, without creating anything', async () => {
    const sessions = open();
    expect(await sessions.load(ANON)).toEqual(emptySession());
    expect(await sessions.save(ANON, {}, FREE)).toEqual({ ok: true, session: emptySession() });
    expect(await sessions.load(ANON)).toEqual(emptySession());
  });

  it('saves a profile and gives it back on the next load (the reload)', async () => {
    const sessions = open();
    const result = await sessions.save(ANON, { profile: withAge(37) }, FREE);
    expect(result).toEqual({ ok: true, session: { profile: withAge(37), wishlist: [], revision: 1, updatedAt: expect.any(String) } });
    const loaded = await sessions.load(ANON);
    expect(loaded).toEqual(result.ok && result.session);
    expect(Date.parse(loaded.updatedAt!)).not.toBeNaN();
    expect(await sessions.load(OTHER)).toEqual(emptySession());
  });

  it('round-trips every Purchase shape and a full profile exactly', async () => {
    const sessions = open();
    const profile: Profile = {
      ...withAge(29),
      zip: '75201',
      committedMoveId: 'payCardFirst:card-1',
      doneMoveIds: ['cutCategory:eatingOut'],
      cash: { value: -250.75, isEstimate: true },
    };
    await sessions.save(ANON, { profile, wishlist: [laptop, gym, car] }, PRO);
    expect(await sessions.load(ANON)).toMatchObject({ profile, wishlist: [laptop, gym, car], revision: 1 });
  });

  it('keeps the profile when only the wishlist is saved, and the reverse', async () => {
    const sessions = open();
    await sessions.save(ANON, { profile: withAge(30), wishlist: [laptop] }, PRO);
    await sessions.save(ANON, { wishlist: [] }, FREE);
    expect(await sessions.load(ANON)).toMatchObject({ profile: withAge(30), wishlist: [], revision: 2 });
    await sessions.save(ANON, { profile: withAge(31) }, FREE);
    expect(await sessions.load(ANON)).toMatchObject({ profile: withAge(31), wishlist: [], revision: 3 });
  });

  it('refuses a free save that adds to the wishlist, and changes nothing (not even the profile)', async () => {
    const sessions = open();
    await sessions.save(ANON, { profile: withAge(30), wishlist: [laptop] }, PRO);
    expect(await sessions.save(ANON, { profile: withAge(50), wishlist: [laptop, gym] }, FREE)).toEqual({ ok: false, reason: 'wishlist_locked' });
    expect(await sessions.load(ANON)).toMatchObject({ profile: withAge(30), wishlist: [laptop], revision: 1 });
    // A first save that is refused leaves no row behind either.
    expect(await sessions.save(OTHER, { wishlist: [gym] }, FREE)).toEqual({ ok: false, reason: 'wishlist_locked' });
    expect(await sessions.load(OTHER)).toEqual(emptySession());
  });

  it('does not let callers change stored state through returned objects', async () => {
    const sessions = open();
    const result = await sessions.save(ANON, { wishlist: [laptop] }, PRO);
    if (!result.ok) throw new Error('expected ok');
    result.session.wishlist.push(gym);
    expect((await sessions.load(ANON)).wishlist).toEqual([laptop]);
  });

  it('applies concurrent saves for one id one after the other: none is lost, none interleaves', async () => {
    const sessions = open();
    const n = 24;
    // Each request carries a profile and a wishlist that belong together (age 20+i ↔ i items).
    const requests = Array.from({ length: n }, (_, i) => ({
      profile: withAge(20 + i),
      wishlist: Array.from({ length: i % 5 }, (_, k) => ({ ...gym, label: `item ${i}.${k}` })),
    }));
    const results = await Promise.all(requests.map((r) => sessions.save(ANON, r, PRO)));

    const revisions = results.map((r) => (r.ok ? r.session.revision : -1)).sort((a, b) => a - b);
    expect(revisions).toEqual(Array.from({ length: n }, (_, i) => i + 1)); // every save saw the one before it
    const final = await sessions.load(ANON);
    expect(final.revision).toBe(n);
    const i = final.profile!.age.value - 20;
    expect(final.wishlist).toEqual(requests[i]!.wishlist); // both fields from the same request
    expect(results.find((r) => r.ok && r.session.revision === n)).toEqual({ ok: true, session: final });
  });

  it('serializes a profile-only and a wishlist-only save so both survive', async () => {
    const sessions = open();
    await Promise.all([
      sessions.save(ANON, { profile: withAge(44) }, FREE),
      sessions.save(ANON, { wishlist: [car] }, PRO),
    ]);
    expect(await sessions.load(ANON)).toMatchObject({ profile: withAge(44), wishlist: [car], revision: 2 });
  });

  if (backend === 'postgres') {
    it('stores the hash of the anonymous id, never the id itself', async () => {
      await open().save(ANON, { profile: withAge(30) }, FREE);
      const { store } = harness!;
      const { rows } = await store.db!.query<{ anon_key: string; dump: string }>('SELECT anon_key, sessions::text AS dump FROM sessions');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.anon_key).toMatch(/^[0-9a-f]{64}$/);
      expect(rows[0]!.dump).not.toContain(ANON);
    });

    it('ignores a stored profile that no longer parses instead of failing the load', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const sessions = open();
      await sessions.save(ANON, { profile: withAge(30), wishlist: [laptop] }, PRO);
      await harness!.store.db!.query(`UPDATE sessions SET profile = '{"age": "old"}'::jsonb`);
      expect(await sessions.load(ANON)).toMatchObject({ wishlist: [laptop], revision: 1 });
      expect((await sessions.load(ANON)).profile).toBeUndefined();
      vi.restoreAllMocks();
    });
  }
});

describe.skipIf(!TEST_STORE_URL)('postgres store isolation', () => {
  it('keeps test schemas apart (sanity check of the test harness)', async () => {
    const a = testPostgresStore();
    const b = testPostgresStore();
    try {
      await a.store.sessions.save(ANON, { profile: withAge(30) }, FREE);
      expect(await b.store.sessions.load(ANON)).toEqual(emptySession());
      const { rows } = await adminQuery('SELECT count(*)::int AS n FROM information_schema.schemata WHERE schema_name = ANY($1)', [[a.schema, b.schema]]);
      expect(rows[0].n).toBe(2);
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  });
});
