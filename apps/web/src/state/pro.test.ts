// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ProResult, ProStatusInfo } from '@/lib/api/pro';
import { resetClientState } from '@/test/clientState';
import { FREE, PRO_DEMO, PRO_DEMO_CHECKOUT, PRO_STRIPE, fakeProAdapter, resetProState, statusInfo } from '@/test/pro';
import { getAnonId } from './anonId';
import { PRO_CACHE_KEY, usePro, useProStore } from './pro';

beforeEach(() => resetClientState());

const writeHint = (status: unknown, anonId = getAnonId()) => localStorage.setItem(PRO_CACHE_KEY, JSON.stringify({ anonId, status }));
const readHint = () => JSON.parse(localStorage.getItem(PRO_CACHE_KEY) ?? 'null') as unknown;

/** A promise the test resolves by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('usePro', () => {
  it('starts free and unknown, then takes the server answer and caches it', async () => {
    const adapter = fakeProAdapter(statusInfo(PRO_DEMO, { checkoutAvailable: false }));
    resetProState(adapter);
    const { result } = renderHook(() => usePro());
    await waitFor(() => expect(result.current.load).toBe('ready'));
    expect(result.current).toMatchObject({ isPro: true, known: true, origin: 'server', checkoutAvailable: false, demo: { enabled: true, code: 'JURY2026' } });
    expect(readHint()).toEqual({ anonId: getAnonId(), status: PRO_DEMO });
  });

  it('shows the cached hint until the server answers, and the server wins', async () => {
    writeHint(PRO_STRIPE);
    const reply = deferred<ProResult<ProStatusInfo>>();
    const adapter = fakeProAdapter();
    adapter.status.mockReturnValueOnce(reply.promise);
    resetProState(adapter);

    const { result } = renderHook(() => usePro());
    await waitFor(() => expect(result.current.origin).toBe('cache'));
    expect(result.current).toMatchObject({ isPro: true, known: true, load: 'loading' });

    reply.resolve({ ok: true, value: statusInfo(FREE) });
    await waitFor(() => expect(result.current.origin).toBe('server'));
    expect(result.current.isPro).toBe(false);
    expect(readHint()).toEqual({ anonId: getAnonId(), status: FREE });
  });

  it('ignores a hint saved for another anonymous id, or a broken one', async () => {
    const adapter = fakeProAdapter();
    adapter.status.mockResolvedValue({ ok: false, error: { kind: 'network' } });
    for (const raw of [JSON.stringify({ anonId: 'someone-else', status: PRO_DEMO }), '{not json', JSON.stringify({ anonId: getAnonId(), status: { pro: 'yes' } })]) {
      localStorage.setItem(PRO_CACHE_KEY, raw);
      resetProState(adapter);
      const { result, unmount } = renderHook(() => usePro());
      await waitFor(() => expect(result.current.load).toBe('error'));
      expect(result.current).toMatchObject({ isPro: false, known: false, origin: 'default' });
      unmount();
    }
  });

  it('a failed refresh keeps the last status and reports the error', async () => {
    writeHint(PRO_DEMO);
    const adapter = fakeProAdapter();
    adapter.status.mockResolvedValue({ ok: false, error: { kind: 'rateLimited', retryAfterSeconds: 5 } });
    resetProState(adapter);
    const { result } = renderHook(() => usePro());
    await waitFor(() => expect(result.current.load).toBe('error'));
    expect(result.current).toMatchObject({ isPro: true, origin: 'cache', error: { kind: 'rateLimited', retryAfterSeconds: 5 } });
  });

  it('screens mounted together share one status request', async () => {
    const adapter = fakeProAdapter();
    resetProState(adapter);
    const a = renderHook(() => usePro());
    const b = renderHook(() => usePro());
    await waitFor(() => expect(a.result.current.load).toBe('ready'));
    expect(b.result.current.load).toBe('ready');
    expect(adapter.status).toHaveBeenCalledTimes(1);
  });
});

describe('useProStore unlocks', () => {
  it('a status reply requested before an unlock cannot undo it', async () => {
    const stale = deferred<ProResult<ProStatusInfo>>();
    const adapter = fakeProAdapter(statusInfo(PRO_DEMO));
    adapter.status.mockReturnValueOnce(stale.promise);
    resetProState(adapter);

    const pending = useProStore.getState().refresh();
    const res = await useProStore.getState().redeemCode('JURY2026');
    expect(res).toEqual({ ok: true, value: PRO_DEMO });
    expect(adapter.demoUnlock).toHaveBeenCalledWith('JURY2026');
    expect(useProStore.getState().status).toEqual(PRO_DEMO);

    stale.resolve({ ok: true, value: statusInfo(FREE) });
    await pending;
    await waitFor(() => expect(useProStore.getState().load).toBe('ready'));
    expect(useProStore.getState().status).toEqual(PRO_DEMO);
    expect(adapter.status).toHaveBeenCalledTimes(2); // the refresh after the unlock
    expect(readHint()).toEqual({ anonId: getAnonId(), status: PRO_DEMO });
  });

  it('a demo checkout stores the new status for the plan paid, caches it and refreshes', async () => {
    const adapter = fakeProAdapter();
    resetProState(adapter);
    const res = await useProStore.getState().demoCheckout('monthly');
    expect(res).toEqual({ ok: true, value: { ...PRO_DEMO_CHECKOUT, plan: 'monthly' } });
    expect(adapter.demoCheckout).toHaveBeenCalledWith('monthly');
    expect(useProStore.getState()).toMatchObject({ status: { source: 'demo_checkout', plan: 'monthly' }, origin: 'server' });
    expect(readHint()).toEqual({ anonId: getAnonId(), status: { ...PRO_DEMO_CHECKOUT, plan: 'monthly' } });
    await waitFor(() => expect(adapter.status).toHaveBeenCalledTimes(1));
  });

  it('a failed demo checkout leaves the status alone and returns the failure', async () => {
    const adapter = fakeProAdapter();
    adapter.demoCheckout.mockResolvedValue({ ok: false, error: { kind: 'unavailable' } });
    resetProState(adapter);
    expect(await useProStore.getState().demoCheckout('yearly')).toEqual({ ok: false, error: { kind: 'unavailable' } });
    expect(useProStore.getState()).toMatchObject({ status: FREE, origin: 'default' });
  });

  it('a failed confirm leaves the status alone and returns the failure', async () => {
    const adapter = fakeProAdapter();
    adapter.confirm.mockResolvedValue({ ok: false, error: { kind: 'notPaid' } });
    resetProState(adapter);
    expect(await useProStore.getState().confirmCheckout('cs_test_a1B2c3D4e5F6')).toEqual({ ok: false, error: { kind: 'notPaid' } });
    expect(useProStore.getState()).toMatchObject({ status: FREE, origin: 'default' });
    expect(adapter.status).not.toHaveBeenCalled();
  });

  it('an adapter that throws counts as a network failure', async () => {
    const adapter = fakeProAdapter();
    adapter.status.mockRejectedValue(new Error('boom'));
    adapter.demoUnlock.mockImplementation(() => {
      throw new Error('boom');
    });
    resetProState(adapter);
    await useProStore.getState().refresh();
    expect(useProStore.getState()).toMatchObject({ load: 'error', error: { kind: 'network' } });
    expect(await useProStore.getState().redeemCode('X')).toEqual({ ok: false, error: { kind: 'network' } });
  });
});
