// @vitest-environment jsdom
import { PRO_PRICES } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProStore } from '@/state';
import { resetClientState } from '@/test/clientState';
import { PRO_DEMO, PRO_STRIPE, fakeProAdapter, resetProState, statusInfo, type FakeProAdapter } from '@/test/pro';
import { usePaywall, type CheckoutReturnParams } from './usePaywall';

const SESSION = 'cs_test_a1B2c3D4e5F6';

let adapter: FakeProAdapter;
let navigate: ReturnType<typeof vi.fn<(url: string) => void>>;

beforeEach(() => {
  resetClientState();
  window.history.replaceState(null, '', '/pro');
  adapter = fakeProAdapter();
  resetProState(adapter);
  navigate = vi.fn<(url: string) => void>();
});
afterEach(() => vi.useRealTimers());

/** The query the page hands to the hook, as app/pro/page.tsx reads it. */
function checkoutReturnOf(url: string): CheckoutReturnParams | undefined {
  const params = new URL(url, 'http://localhost').searchParams;
  const checkout = params.get('checkout') ?? undefined;
  return checkout ? { checkout, sessionId: params.get('session_id') ?? undefined } : undefined;
}

function mountPaywall(url = '/pro') {
  window.history.replaceState(null, '', url);
  const checkoutReturn = checkoutReturnOf(url);
  return renderHook(() => usePaywall({ checkoutReturn, navigate }));
}

async function renderPaywall(url = '/pro') {
  const hook = mountPaywall(url);
  await waitFor(() => expect(useProStore.getState().load).not.toBe('loading'));
  return hook;
}

/** Let resolved adapter promises run their callbacks (works under fake timers too). */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

describe('usePaywall (S15)', () => {
  it('is loading until the status is known, then offers both plans with yearly preselected', async () => {
    const { result } = mountPaywall();
    expect(result.current.view).toBe('loading');
    await waitFor(() => expect(result.current.view).toBe('offer'));
    expect(result.current.plans).toEqual([
      { id: 'yearly', amount: PRO_PRICES.yearly.amount, interval: 'year', isEstimate: true, selected: true },
      { id: 'monthly', amount: PRO_PRICES.monthly.amount, interval: 'month', isEstimate: true, selected: false },
    ]);
    expect(result.current).toMatchObject({ checkoutAvailable: true, promoEnabled: true, promoCode: 'JURY2026', busy: null, error: null, pro: null });
  });

  it('starts checkout for the chosen plan and sends the browser to Stripe once, however many clicks', async () => {
    const { result } = await renderPaywall();
    act(() => result.current.selectPlan('monthly'));
    act(() => {
      result.current.startCheckout();
      result.current.startCheckout();
    });
    expect(result.current.busy).toBe('checkout');
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_abc12345'));
    expect(adapter.startCheckout).toHaveBeenCalledTimes(1);
    expect(adapter.startCheckout).toHaveBeenCalledWith('monthly');
    expect(result.current.busy).toBe('checkout'); // the page is leaving
  });

  it('without a Stripe test key the checkout is off and the promo code still works', async () => {
    resetProState((adapter = fakeProAdapter(statusInfo(undefined, { checkoutAvailable: false }))));
    const { result } = await renderPaywall();
    expect(result.current.checkoutAvailable).toBe(false);
    act(() => result.current.startCheckout());
    expect(adapter.startCheckout).not.toHaveBeenCalled();

    act(() => result.current.redeem());
    await waitFor(() => expect(result.current.view).toBe('success'));
    expect(adapter.demoUnlock).toHaveBeenCalledWith('JURY2026');
    expect(result.current.pro).toEqual({ source: 'demo', plan: null, sinceLabel: 'Nov 14, 2026' });
  });

  it('a checkout failure is shown on the checkout block and the button works again', async () => {
    adapter.startCheckout.mockResolvedValueOnce({ ok: false, error: { kind: 'upstream' } });
    const { result } = await renderPaywall();
    act(() => result.current.startCheckout());
    await waitFor(() => expect(result.current.busy).toBeNull());
    expect(result.current.error).toEqual({ where: 'checkout', key: 'upstream', retryAfterSeconds: null });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('back from Stripe: confirms the session, cleans the URL and shows success', async () => {
    const hook = mountPaywall(`/pro?checkout=success&session_id=${SESSION}&ref=tiktok#plans`);
    expect(hook.result.current.view).toBe('confirming');
    await waitFor(() => expect(hook.result.current.view).toBe('success'));
    expect(adapter.confirm).toHaveBeenCalledTimes(1);
    expect(adapter.confirm).toHaveBeenCalledWith(SESSION);
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe('/pro?ref=tiktok#plans');
    expect(hook.result.current.pro).toEqual({ source: 'stripe_test', plan: 'yearly', sinceLabel: 'Nov 14, 2026' });
    expect(useProStore.getState().status).toEqual(PRO_STRIPE);
  });

  it('a malformed session id is never sent', async () => {
    const { result } = await renderPaywall('/pro?checkout=success&session_id=cs_live_a1B2c3D4e5F6');
    expect(adapter.confirm).not.toHaveBeenCalled();
    expect(result.current.error).toEqual({ where: 'confirm', key: 'badReturn', retryAfterSeconds: null });
    expect(result.current.retry).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('a cancelled checkout says no charge was made', async () => {
    const { result } = await renderPaywall('/pro?checkout=cancelled');
    expect(result.current.cancelled).toBe(true);
    expect(result.current.view).toBe('offer');
    expect(window.location.search).toBe('');
  });

  it('a confirm that failed for a passing reason can be retried with the same session', async () => {
    adapter.confirm.mockResolvedValueOnce({ ok: false, error: { kind: 'network' } });
    const { result } = await renderPaywall(`/pro?checkout=success&session_id=${SESSION}`);
    await waitFor(() => expect(result.current.error).toEqual({ where: 'confirm', key: 'network', retryAfterSeconds: null }));
    expect(result.current.view).toBe('offer');
    expect(window.location.search).toBe('');

    act(() => result.current.retry!());
    await waitFor(() => expect(result.current.view).toBe('success'));
    expect(adapter.confirm).toHaveBeenNthCalledWith(2, SESSION);
    expect(result.current.error).toBeNull();
  });

  it('a session claimed by someone else cannot be retried', async () => {
    adapter.confirm.mockResolvedValueOnce({ ok: false, error: { kind: 'sessionMismatch' } });
    const { result } = await renderPaywall(`/pro?checkout=success&session_id=${SESSION}`);
    await waitFor(() => expect(result.current.error?.key).toBe('sessionMismatch'));
    expect(result.current.retry).toBeNull();
  });

  it('the promo code is editable; a wrong or empty code shows an error that editing clears', async () => {
    adapter.demoUnlock.mockResolvedValueOnce({ ok: false, error: { kind: 'invalidCode' } });
    const { result } = await renderPaywall();
    act(() => result.current.setPromoCode(' WRONG '));
    expect(result.current.promoCode).toBe(' WRONG ');
    act(() => result.current.redeem());
    await waitFor(() => expect(result.current.error).toEqual({ where: 'promo', key: 'invalidCode', retryAfterSeconds: null }));
    expect(adapter.demoUnlock).toHaveBeenCalledWith('WRONG');

    act(() => result.current.setPromoCode('   '));
    expect(result.current.error).toBeNull();
    act(() => result.current.redeem());
    expect(result.current.error).toEqual({ where: 'promo', key: 'emptyCode', retryAfterSeconds: null });
    expect(adapter.demoUnlock).toHaveBeenCalledTimes(1);
  });

  it('after a 429 every action waits out the retry-after window', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    adapter.demoUnlock.mockResolvedValueOnce({ ok: false, error: { kind: 'rateLimited', retryAfterSeconds: 3 } });
    const { result } = mountPaywall();
    await settle();
    act(() => result.current.redeem());
    await settle();
    expect(result.current).toMatchObject({ coolingDown: true, busy: null, error: { where: 'promo', key: 'rateLimited', retryAfterSeconds: 3 } });

    act(() => {
      result.current.redeem();
      result.current.startCheckout();
    });
    expect(adapter.demoUnlock).toHaveBeenCalledTimes(1);
    expect(adapter.startCheckout).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(3000));
    expect(result.current).toMatchObject({ coolingDown: false, error: null });
    act(() => result.current.redeem());
    await settle();
    expect(adapter.demoUnlock).toHaveBeenCalledTimes(2);
    expect(result.current.view).toBe('success');
  });

  it('already Pro: no offer, and the purchase actions do nothing', async () => {
    resetProState((adapter = fakeProAdapter(statusInfo(PRO_DEMO))));
    const { result } = await renderPaywall();
    expect(result.current.view).toBe('pro');
    expect(result.current.pro).toEqual({ source: 'demo', plan: null, sinceLabel: 'Nov 14, 2026' });
    act(() => {
      result.current.startCheckout();
      result.current.redeem();
    });
    expect(adapter.startCheckout).not.toHaveBeenCalled();
    expect(adapter.demoUnlock).not.toHaveBeenCalled();
  });

  it('when the status cannot be loaded it offers a retry', async () => {
    adapter.status.mockResolvedValueOnce({ ok: false, error: { kind: 'network' } });
    const { result } = await renderPaywall();
    expect(result.current.view).toBe('offer');
    expect(result.current.error).toEqual({ where: 'status', key: 'network', retryAfterSeconds: null });
    act(() => result.current.retry!());
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(adapter.status).toHaveBeenCalledTimes(2);
  });

  it('a page restored from the back-forward cache is usable again', async () => {
    const { result } = await renderPaywall();
    act(() => result.current.startCheckout());
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    act(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    expect(result.current.busy).toBeNull();
  });
});
