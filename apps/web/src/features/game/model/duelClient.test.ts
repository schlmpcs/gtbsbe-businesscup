// Which duel source a build plays: NEXT_PUBLIC_DUEL_SOURCE, separate from NEXT_PUBLIC_GAME_SOURCE.
import { afterEach, describe, expect, it, vi } from 'vitest';

const DATE = '2026-11-14';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** duelClient as a build with these NEXT_PUBLIC_* values would have it (Next inlines them). */
async function build(env: Record<string, string>) {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  vi.resetModules();
  return import('./duelClient');
}

describe('createDuelClient source selection', () => {
  it('plays the duel in the browser by default', async () => {
    const { createDuelClient } = await build({});
    const client = createDuelClient();
    expect(client.source).toBe('fixtures');
    expect((await client.daily(DATE)).duels).toHaveLength(5);
  });

  it('still plays the duel in the browser in an API game build (NEXT_PUBLIC_GAME_SOURCE=api, production)', async () => {
    const { createDuelClient } = await build({ NEXT_PUBLIC_GAME_SOURCE: 'api' });
    const client = createDuelClient();
    expect(client.source).toBe('fixtures');
    expect((await client.daily(DATE)).duels).toHaveLength(5);
  });

  it('answers "unavailable" with NEXT_PUBLIC_DUEL_SOURCE=api until the duel routes land (#115), and has no fixture duel', async () => {
    const { createDuelClient } = await build({ NEXT_PUBLIC_DUEL_SOURCE: 'api' });
    const client = createDuelClient();
    expect(client.source).toBe('api');
    await expect(client.daily(DATE)).rejects.toMatchObject({ status: 501 });
    expect(() => createDuelClient('fixtures')).toThrow(/NEXT_PUBLIC_DUEL_SOURCE=api/);
  });
});
