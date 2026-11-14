// Test helpers for Pro (S15): a fake adapter with vi.fn methods and a clean Pro store per test.
// No request ever leaves the test: the store only talks to the adapter installed here.
import type { ProStatus } from '@lifeguessr/types';
import { vi, type Mock } from 'vitest';
import { setProAdapter, type ProAdapter, type ProStatusInfo } from '@/lib/api/pro';
import { resetProStore } from '@/state';

export type FakeProAdapter = { [K in keyof ProAdapter]: Mock<ProAdapter[K]> };

export const FREE: ProStatus = { pro: false };
export const PRO_DEMO: ProStatus = { pro: true, source: 'demo', since: '2026-11-14T12:00:00.000Z' };
export const PRO_STRIPE: ProStatus = { pro: true, source: 'stripe_test', plan: 'yearly', since: '2026-11-14T12:00:00.000Z' };

export function statusInfo(status: ProStatus = FREE, extra: Partial<ProStatusInfo> = {}): ProStatusInfo {
  return { status, checkoutAvailable: true, demo: { enabled: true, code: 'JURY2026' }, ...extra };
}

/**
 * Every call succeeds by default: free status with checkout and promo on; unlocks give Pro and,
 * like the real server, later status calls report it.
 */
export function fakeProAdapter(info: ProStatusInfo = statusInfo()): FakeProAdapter {
  let current = info;
  const grant = (status: ProStatus) => {
    current = { ...current, status };
    return { ok: true as const, value: status };
  };
  return {
    status: vi.fn<ProAdapter['status']>(async () => ({ ok: true, value: current })),
    startCheckout: vi.fn<ProAdapter['startCheckout']>(async () => ({ ok: true, value: 'https://checkout.stripe.com/c/pay/cs_test_abc12345' })),
    confirm: vi.fn<ProAdapter['confirm']>(async () => grant(PRO_STRIPE)),
    demoUnlock: vi.fn<ProAdapter['demoUnlock']>(async () => grant(PRO_DEMO)),
  };
}

/** Default Pro store, and `adapter` behind every Pro call. Call in beforeEach. */
export function resetProState(adapter: ProAdapter = fakeProAdapter()): void {
  resetProStore();
  setProAdapter(adapter);
}
