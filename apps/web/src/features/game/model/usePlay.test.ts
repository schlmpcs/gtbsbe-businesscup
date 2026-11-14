// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from '@/state';
import { resetClientState, waitForReady } from '@/test/clientState';
import { createFixtureGameClient, type GameClient } from './client';
import { GUESS_DEFAULT, GUESS_MAX, GUESS_MIN } from './constants';
import { usePlay } from './usePlay';

let client: GameClient;
beforeEach(() => {
  resetClientState();
  client = createFixtureGameClient({ persist: false });
});
afterEach(() => vi.useRealTimers());

async function renderPlay(streamer = false) {
  const hook = renderHook(() => usePlay({ client, streamer, countdownSeconds: 3 }));
  await waitForReady(hook.result);
  return hook;
}

describe('usePlay (S2–S4) on fixtures', () => {
  it('loads today’s 5 homes and starts exploring the first', async () => {
    const { result } = await renderPlay();
    expect(result.current.status).toBe('ready');
    expect(result.current.source).toBe('fixtures');
    expect(result.current.phase).toBe('explore');
    expect(result.current.progress).toEqual({ index: 0, total: 5, guessed: 0 });
    const card = result.current.card!;
    expect(card.clues.map((c) => c.status)).toEqual(['closed', 'closed', 'closed', 'closed', 'closed']);
    expect(card.multiplier).toBe(1);
    expect(card.nextMultiplier).toBeCloseTo(0.9);
    expect(card.clueCost).toBe(0.1);
    expect(card.clues.every((c) => c.facts.length === 0)).toBe(true);
    expect(card.guess).toMatchObject({ value: GUESS_DEFAULT, min: GUESS_MIN, max: GUESS_MAX });
    expect(card.guess.position).toBeCloseTo(0.5, 2);
  });

  it('opens a clue, lowers the multiplier, and the reveal uses the server-side count', async () => {
    const { result } = await renderPlay();
    act(() => result.current.openClue('kitchen'));
    await waitFor(() => expect(result.current.card!.clues.find((c) => c.id === 'kitchen')!.status).toBe('open'));
    expect(result.current.card!.openedCount).toBe(1);
    expect(result.current.card!.multiplier).toBeCloseTo(0.9);
    expect(result.current.card!.clues.find((c) => c.id === 'kitchen')!.facts).toEqual([
      { kind: 'eatingOut', perWeek: expect.any(Number) },
    ]);

    act(() => result.current.setGuess(4321));
    expect(result.current.card!.guess.value).toBe(4320); // snapped to $10
    act(() => result.current.setGuessPosition(1));
    expect(result.current.card!.guess.value).toBe(GUESS_MAX);

    act(() => result.current.submitGuess());
    await waitFor(() => expect(result.current.phase).toBe('reveal'));
    const reveal = result.current.reveal!;
    expect(reveal.guess).toBe(GUESS_MAX);
    expect(reveal.result.multiplier).toBeCloseTo(0.9);
    expect(reveal.cluesOpened).toEqual(['kitchen']);
    expect(reveal.total.low).toBeLessThanOrEqual(reveal.total.mid);
    expect(reveal.items[0]!.amount).toBeGreaterThanOrEqual(reveal.items.at(-1)!.amount);
    expect(reveal.surprise?.category).toBe(reveal.categories[0]!.category);
    expect(reveal.categories[0]!.amount).toBeGreaterThanOrEqual(reveal.categories.at(-1)!.amount);
    expect(reveal.maxPoints).toBe(1000);
    expect(reveal.scale.guess).toBe(1); // guessed the slider max
    expect(reveal.cardFacts.map((f) => f.kind)).toContain('eatingOut');
    expect(reveal.shareImage).toBeNull(); // fixture mode has no share route
    expect(result.current.card!.guessed).toBe(true);
  });

  it('plays all 5 homes into the share grid', async () => {
    const { result } = await renderPlay();
    for (let i = 0; i < 5; i++) {
      act(() => result.current.setGuess(1000));
      act(() => result.current.submitGuess());
      await waitFor(() => expect(result.current.phase).toBe('reveal'));
      expect(result.current.reveal!.isLastCard).toBe(i === 4);
      act(() => result.current.next());
    }
    expect(result.current.phase).toBe('summary');
    const s = result.current.summary!;
    expect(s.played).toBe(5);
    expect(s.maxPoints).toBe(5000);
    expect(s.tiles).toHaveLength(5);
    expect(s.guessedLow + s.inRange + s.guessedHigh).toBe(5);
    expect(s.shareText.split('\n')[1]).toMatch(/^[🟩🟨🟥]{5}$/u);
    expect(s.mostSurprising).not.toBeNull();
    expect(result.current.card).toBeNull();
  });

  it('shares the summary text and reports the outcome', async () => {
    const share = vi.fn().mockResolvedValueOnce('copied').mockResolvedValueOnce('cancelled');
    const { result } = renderHook(() => usePlay({ client, share }));
    await waitForReady(result);
    act(() => result.current.share()); // not on the summary yet: ignored
    expect(share).not.toHaveBeenCalled();
    for (let i = 0; i < 5; i++) {
      act(() => result.current.submitGuess());
      await waitFor(() => expect(result.current.phase).toBe('reveal'));
      act(() => result.current.next());
    }
    expect(result.current.shareStatus).toBe('idle');
    act(() => result.current.share());
    expect(result.current.shareStatus).toBe('sharing');
    await waitFor(() => expect(result.current.shareStatus).toBe('copied'));
    expect(share).toHaveBeenCalledWith(result.current.summary!.shareText);
    act(() => result.current.share());
    await waitFor(() => expect(result.current.shareStatus).toBe('idle')); // closed the sheet
  });

  it('keeps progress in the persisted game store', async () => {
    const first = await renderPlay();
    act(() => first.result.current.submitGuess());
    await waitFor(() => expect(first.result.current.phase).toBe('reveal'));
    first.unmount();
    expect(Object.keys(useGameStore.getState().reveals)).toHaveLength(1);

    const again = await renderPlay();
    expect(again.result.current.phase).toBe('reveal');
    expect(again.result.current.progress.guessed).toBe(1);
  });

  it('reports a load failure and retries', async () => {
    const failing: GameClient = { ...client, daily: vi.fn().mockRejectedValueOnce(new Error('down')).mockImplementation(client.daily) };
    const { result } = renderHook(() => usePlay({ client: failing }));
    await waitForReady(result);
    expect(result.current.status).toBe('error');
    expect(result.current.error).toEqual({ kind: 'unknown', message: 'down' });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('S4 streamer mode: countdown locks the guess in at zero', async () => {
    const { result } = await renderPlay(true);
    expect(result.current.streamer).toMatchObject({ countdown: { total: 3, secondsLeft: 3, running: false }, locked: false });
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    act(() => result.current.streamer!.startCountdown());
    expect(result.current.streamer!.countdown.running).toBe(true);
    act(() => vi.advanceTimersByTime(1100));
    expect(result.current.streamer!.countdown.secondsLeft).toBe(2);
    act(() => vi.advanceTimersByTime(2000));
    vi.useRealTimers();
    await waitFor(() => expect(result.current.phase).toBe('reveal'));
    expect(result.current.streamer!.locked).toBe(true);
    expect(result.current.streamer!.countdown.running).toBe(false);
  });

  it('streamer is null outside S4', async () => {
    const { result } = await renderPlay(false);
    expect(result.current.streamer).toBeNull();
  });
});
