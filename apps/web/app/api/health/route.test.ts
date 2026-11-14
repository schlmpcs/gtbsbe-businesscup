import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore, setStoreForTests, StoreUnavailableError, type Store } from '@/server/store';
import { GET } from './route';

afterEach(() => {
  setStoreForTests(null);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** The build's flags when none is set: the duel at /play, played in the browser. */
const DEFAULT_BUILD = { gameMode: 'duel', gameSource: 'fixtures', duelSource: 'fixtures' };

const unavailable = (check: Store['check']): Store => ({ ...createMemoryStore(), backend: 'postgres', check });

describe('GET /api/health', () => {
  it('answers 200 with the store ok, and is never cached', async () => {
    setStoreForTests(createMemoryStore());
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ ok: true, store: { status: 'ok', backend: 'memory' }, build: DEFAULT_BUILD });
  });

  it('says which game the build serves, from the flags Next inlined into it (the smoke check reads this)', async () => {
    setStoreForTests(createMemoryStore());
    expect((await (await GET()).json()).build).toEqual(DEFAULT_BUILD);
    // Production: the duel at /play, played against the server.
    vi.stubEnv('NEXT_PUBLIC_GAME_MODE', 'duel');
    vi.stubEnv('NEXT_PUBLIC_GAME_SOURCE', 'api');
    vi.stubEnv('NEXT_PUBLIC_DUEL_SOURCE', 'api');
    expect((await (await GET()).json()).build).toEqual({ gameMode: 'duel', gameSource: 'api', duelSource: 'api' });
    // The rollback: the slider game.
    vi.stubEnv('NEXT_PUBLIC_GAME_MODE', 'slider');
    expect((await (await GET()).json()).build).toEqual({ gameMode: 'slider', gameSource: 'api', duelSource: 'api' });
  });

  it('stays 200 (liveness) when the database is down, and says why without details', async () => {
    setStoreForTests(unavailable(async () => {
      throw new StoreUnavailableError('unreachable', 'the store is unreachable (ECONNREFUSED)');
    }));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, store: { status: 'unavailable', backend: 'postgres', reason: 'unreachable' }, build: DEFAULT_BUILD });
  });

  it('answers within its timeout when the database hangs', async () => {
    vi.useFakeTimers();
    try {
      setStoreForTests(unavailable(() => new Promise(() => {})));
      const pending = GET();
      await vi.advanceTimersByTimeAsync(2_000);
      const res = await pending;
      expect(await res.json()).toEqual({ ok: true, store: { status: 'unavailable', backend: 'postgres', reason: 'timeout' }, build: DEFAULT_BUILD });
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a production server without STORE_URL as not configured', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STORE_URL', '');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, store: { status: 'unavailable', backend: null, reason: 'not_configured' }, build: DEFAULT_BUILD });
  });
});
