// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { NotImplementedError } from '@lifeguessr/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHttpSessionAdapter, type SessionAdapter } from '@/lib/api/session';
import { cloneProfileDemo } from '@/fixtures';
import { setSessionAdapter, useAppReady, useAppStore } from '@/state';
import { resetClientState } from '@/test/clientState';
import { runEngine } from './errors';
import { logScale, snap } from './slider';
import { useParseConfirm } from './useParseConfirm';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(resetClientState);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('slider math', () => {
  it('log scale round-trips and snaps', () => {
    const s = logScale(1000, 15000);
    expect(s.toPosition(1000)).toBe(0);
    expect(s.toPosition(15000)).toBe(1);
    expect(s.fromPosition(s.toPosition(4321))).toBeCloseTo(4321, 6);
    expect(snap(4327, 1000, 15000, 10)).toBe(4330);
    expect(snap(99999, 1000, 15000, 10)).toBe(15000);
  });
});

describe('runEngine', () => {
  it('turns NotImplemented into an error state', () => {
    expect(runEngine(() => {
      throw new NotImplementedError('T9');
    })).toEqual({ status: 'error', error: { kind: 'notImplemented', task: 'T9' } });
    expect(runEngine(() => 2)).toEqual({ status: 'ready', data: 2 });
  });
});

describe('useParseConfirm against /api/ai/parse', () => {
  it('sends kind + text with the anon id header and reads { ok, value, inferred }', async () => {
    const fetchMock = vi.fn(async () =>
      json({ ok: true, kind: 'loan', value: { amount: 28000, apr: 0.069, termMonths: 60 }, needsConfirmation: true, inferred: ['termMonths'] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useParseConfirm('loan', onConfirm));
    act(() => result.current.setText('28k at 6.9% for 5 years'));
    act(() => result.current.submit());
    expect(result.current.status).toBe('parsing');
    await waitFor(() => expect(result.current.status).toBe('confirming'));
    expect(result.current.parsed).toEqual({ amount: 28000, apr: 0.069, termMonths: 60 });
    expect(result.current.inferred).toEqual(['termMonths']);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/ai/parse');
    expect(JSON.parse(init.body as string)).toEqual({ kind: 'loan', text: '28k at 6.9% for 5 years' });
    expect(new Headers(init.headers).get('x-anon-id')).toMatch(/^[0-9a-f-]{36}$/);

    expect(onConfirm).not.toHaveBeenCalled();
    act(() => result.current.confirm());
    expect(onConfirm).toHaveBeenCalledWith({ amount: 28000, apr: 0.069, termMonths: 60 });
    expect(result.current).toMatchObject({ status: 'idle', text: '', parsed: null });
  });

  it('maps the route error codes', async () => {
    const cases: [Response, unknown][] = [
      [json({ ok: false, error: { code: 'nothing_found' }, fallback: 'manualForm' }, 422), { kind: 'nothingFound' }],
      [json({ ok: false, error: { code: 'incomplete', missing: ['apr'] }, fallback: 'manualForm' }, 422), { kind: 'incomplete', missing: ['apr'] }],
      [json({ ok: false, error: { code: 'unavailable' }, fallback: 'manualForm' }, 503), { kind: 'unavailable' }],
      [json({ ok: false, error: { code: 'rate_limited' } }, 429), { kind: 'rateLimited' }],
      [json({ ok: true, kind: 'loan', value: { amount: 1, apr: 6.9, termMonths: 60 }, inferred: [] }), { kind: 'invalidResponse' }],
    ];
    for (const [response, error] of cases) {
      vi.stubGlobal('fetch', vi.fn(async () => response));
      const { result, unmount } = renderHook(() => useParseConfirm('loan', () => {}));
      act(() => result.current.setText('something'));
      act(() => result.current.submit());
      await waitFor(() => expect(result.current.status).toBe('error'));
      expect(result.current.error).toEqual(error);
      act(() => result.current.cancel());
      expect(result.current.status).toBe('idle');
      unmount();
    }
  });

  it('an empty life patch counts as nothing found', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ ok: true, kind: 'life', value: {}, inferred: [] })));
    const { result } = renderHook(() => useParseConfirm('life', () => {}));
    act(() => result.current.setText('hello'));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toEqual({ kind: 'nothingFound' });
  });
});

describe('session adapter and sync', () => {
  it('turns itself off when /api/session does not exist yet', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const a = createHttpSessionAdapter();
    expect(a.enabled).toBe(true);
    await a.save('id', { profile: cloneProfileDemo() });
    expect(a.enabled).toBe(false);
    await a.save('id', { profile: cloneProfileDemo() });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('restores a saved profile over the demo, then saves changes debounced', async () => {
    const saved = { ...cloneProfileDemo(), age: { value: 41, isEstimate: false } };
    const calls: unknown[] = [];
    const adapter: SessionAdapter = {
      enabled: true,
      load: vi.fn(async () => ({ profile: saved })),
      save: vi.fn(async (_id, payload) => {
        calls.push(payload);
      }),
    };
    setSessionAdapter(adapter);
    const { result } = renderHook(() => useAppReady());
    await waitFor(() => expect(result.current).toBe(true));
    await waitFor(() => expect(useAppStore.getState().profile.age.value).toBe(41));
    expect(useAppStore.getState().profileOrigin).toBe('user');

    vi.useFakeTimers();
    act(() => useAppStore.getState().setSpending('eatingOut', 100));
    act(() => useAppStore.getState().setSpending('eatingOut', 120));
    expect(adapter.save).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(adapter.save).toHaveBeenCalledTimes(1);
    expect((calls[0] as { profile: { spending: { eatingOut: { value: number } } } }).profile.spending.eatingOut.value).toBe(120);
  });
});
