import { afterEach, describe, expect, it, vi } from 'vitest';
import { linkedScreenIds, SCREEN_ROUTES, streamerGameHref } from './screens';

afterEach(() => vi.unstubAllEnvs());

describe('streamerGameHref: where a page opened in streamer mode sends people back to the game', () => {
  it('is the plain duel while /play is the duel: it has no streamer view, so no link names one', () => {
    expect(streamerGameHref('duel')).toBe(SCREEN_ROUTES.S2);
    expect(streamerGameHref('duel')).not.toContain('stream=');
  });

  it('is the slider game in streamer mode while /play is the slider game', () => {
    expect(streamerGameHref('slider')).toBe(SCREEN_ROUTES.S4);
    expect(streamerGameHref('slider')).toContain('stream=1');
  });

  it('follows NEXT_PUBLIC_GAME_MODE, which is the duel when unset', () => {
    expect(streamerGameHref()).toBe('/play');
    vi.stubEnv('NEXT_PUBLIC_GAME_MODE', 'slider');
    expect(streamerGameHref()).toBe('/play?stream=1');
  });
});

describe('no link in duel mode drops the mode', () => {
  it('lists no screen whose route carries ?stream=1 while /play is the duel', () => {
    const hrefs = linkedScreenIds('duel').map((id) => SCREEN_ROUTES[id] as string);
    expect(hrefs.filter((href) => href.includes('stream='))).toEqual([]);
  });

  it('lists the streamer screen only for the slider game', () => {
    expect(linkedScreenIds('slider').map((id) => SCREEN_ROUTES[id] as string)).toContain('/play?stream=1');
  });
});
