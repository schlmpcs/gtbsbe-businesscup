// @vitest-environment jsdom
// "Estimate with AI" for an account's yearly change (Add account and Account detail). The API client is
// mocked: no model is called. The AI only proposes the rate; it fills the field labeled "AI estimate" with
// its reason, the person can edit it, and an edited rate is no longer labeled.
import type { GrowthEstimateResponse } from '@lifeguessr/types';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_NOW, resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { ApiError } from '@/lib/api/http';
import { useAccountsStore } from '@/lib/model/accounts';
import { useAccount } from './useAccount';
import { useAddAccount } from './useAddAccount';

const { estimateGrowth } = vi.hoisted(() => ({ estimateGrowth: vi.fn() }));
vi.mock('@/lib/api/aiGrowth', () => ({ estimateGrowth }));

const TODAY = '2026-11-15';
const REASON = 'Luxury sedans lose about 12% a year after year 5.';
const ANSWER: GrowthEstimateResponse = { ok: true, source: 'ai', rejected: [], estimates: [{ group: 'vehicle', rate: -0.12, reason: REASON }] };

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXTURE_NOW);
  await resetFixtureStores();
  estimateGrowth.mockReset();
});
afterEach(() => vi.useRealTimers());

const stored = (id: string) => useAccountsStore.getState().accounts.find((a) => a.id === id)!;
type AddVM = ReturnType<typeof useAddAccount>;
const growthField = (vm: AddVM) => vm.fields.find((f) => f.id === 'growth')!;

function vehicleForm() {
  const hook = renderHook(() => useAddAccount({ today: TODAY }));
  act(() => hook.result.current.pickType('vehicle'));
  return hook;
}

describe('useAddAccount growthAi', () => {
  it('only asset types with a yearly-change field get the button', () => {
    const { result } = renderHook(() => useAddAccount({ today: TODAY }));
    for (const group of ['investments', 'retirement', 'realEstate', 'vehicle', 'otherAsset'] as const) {
      act(() => result.current.pickType(group));
      expect(result.current.growthAi).not.toBeNull();
    }
    for (const group of ['cash', 'creditCard', 'loan', 'mortgage'] as const) {
      act(() => result.current.pickType(group));
      expect(result.current.growthAi).toBeNull();
    }
  });

  it('needs a name and a value before it can ask', () => {
    const { result } = vehicleForm();
    expect(result.current.growthAi).toMatchObject({ status: 'idle', canAsk: false, message: null });
    act(() => result.current.setField('name', 'BMW 540i 2018'));
    expect(result.current.growthAi!.canAsk).toBe(false);
    act(() => result.current.setField('balance', '28,000'));
    expect(result.current.growthAi!.canAsk).toBe(true);
    act(() => result.current.setField('balance', 'lots'));
    expect(result.current.growthAi!.canAsk).toBe(false);
  });

  it('idle → loading → filled: the rate fills the field as a percent, labeled with its reason', async () => {
    let resolve!: (v: GrowthEstimateResponse) => void;
    estimateGrowth.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { result } = vehicleForm();
    act(() => result.current.setField('name', 'BMW 540i 2018'));
    act(() => result.current.setField('balance', '28,000'));
    act(() => result.current.growthAi!.ask());
    expect(result.current.growthAi!.status).toBe('loading');
    // Only the type, the name and the value are sent.
    expect(estimateGrowth.mock.calls[0]![0]).toEqual({ mode: 'account', account: { group: 'vehicle', name: 'BMW 540i 2018', value: 28_000 } });

    await act(async () => resolve(ANSWER));
    expect(result.current.growthAi!.status).toBe('filled');
    expect(growthField(result.current)).toMatchObject({ value: '-12', aiReason: REASON });
  });

  it('submit stores the AI rate on growth with its note', async () => {
    estimateGrowth.mockResolvedValueOnce(ANSWER);
    const { result } = vehicleForm();
    act(() => result.current.setField('name', 'BMW 540i 2018'));
    act(() => result.current.setField('balance', '28000'));
    await act(async () => result.current.growthAi!.ask());
    let id: string | null = null;
    act(() => void (id = result.current.submit()));
    expect(stored(id!)).toMatchObject({ growth: -0.12, growthNote: { source: 'ai', reason: REASON } });
  });

  it('an edited rate is the person’s own: no label, no note', async () => {
    estimateGrowth.mockResolvedValueOnce(ANSWER);
    const { result } = vehicleForm();
    act(() => result.current.setField('name', 'BMW 540i 2018'));
    act(() => result.current.setField('balance', '28000'));
    await act(async () => result.current.growthAi!.ask());
    act(() => result.current.setField('growth', '-10'));
    expect(growthField(result.current).aiReason).toBeNull();
    let id: string | null = null;
    act(() => void (id = result.current.submit()));
    expect(stored(id!).growth).toBe(-0.1);
    expect(stored(id!).growthNote).toBeUndefined();
  });

  it.each([
    ['no API key', new ApiError('x', 503, false, { ok: false, error: { code: 'unavailable' } }), /isn’t available/],
    ['too many requests', new ApiError('x', 429, false, { ok: false, error: { code: 'rate_limited' } }), /Too many/],
    ['answers that failed the checks', new ApiError('x', 422, false, { ok: false, error: { code: 'invalid_output' } }), /sensible/],
  ])('loading → error on %s: a friendly message, the field stays as it was', async (_name, error, message) => {
    estimateGrowth.mockRejectedValueOnce(error);
    const { result } = vehicleForm();
    act(() => result.current.setField('name', 'BMW 540i 2018'));
    act(() => result.current.setField('balance', '28000'));
    await act(async () => result.current.growthAi!.ask());
    expect(result.current.growthAi!.status).toBe('error');
    expect(result.current.growthAi!.message).toMatch(message);
    expect(growthField(result.current)).toMatchObject({ value: '', aiReason: null });
  });

  it('a rate outside the envelope never fills the field', async () => {
    estimateGrowth.mockResolvedValueOnce({ ...ANSWER, estimates: [{ group: 'vehicle', rate: 0.3, reason: 'Gains about 30% a year.' }] });
    const { result } = vehicleForm();
    act(() => result.current.setField('name', 'Car'));
    act(() => result.current.setField('balance', '1000'));
    await act(async () => result.current.growthAi!.ask());
    expect(result.current.growthAi!.status).toBe('error');
    expect(growthField(result.current).value).toBe('');
  });
});

describe('useAccount growth (Account detail)', () => {
  it('shows the yearly change in the summary only for asset types with the field', () => {
    const car = renderHook(() => useAccount('vehicle-1', { today: TODAY }));
    expect(car.result.current.account!.summary.growth).toEqual({ rate: -0.15, aiReason: null });
    expect(car.result.current.growth).toMatchObject({ text: '-15', aiReason: null, error: false });
    const card = renderHook(() => useAccount('card-1', { today: TODAY }));
    expect(card.result.current.account!.summary.growth).toBeNull();
    expect(card.result.current.growth).toBeNull();
  });

  it('idle → loading → filled → saved: the AI rate fills the field; saving stores it with its note', async () => {
    let resolve!: (v: GrowthEstimateResponse) => void;
    estimateGrowth.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useAccount('vehicle-1', { today: TODAY }));
    expect(result.current.growth!.ai).toMatchObject({ status: 'idle', canAsk: true });
    act(() => result.current.growth!.ai.ask());
    expect(result.current.growth!.ai.status).toBe('loading');
    expect(estimateGrowth.mock.calls[0]![0]).toEqual({ mode: 'account', account: { group: 'vehicle', name: 'Car', value: stored('vehicle-1').balance.value } });

    await act(async () => resolve(ANSWER));
    expect(result.current.growth).toMatchObject({ text: '-12', aiReason: REASON });
    expect(stored('vehicle-1').growth).toBe(-0.15); // nothing is stored until the person saves

    let ok = false;
    act(() => void (ok = result.current.growth!.save()));
    expect(ok).toBe(true);
    expect(stored('vehicle-1')).toMatchObject({ growth: -0.12, growthNote: { source: 'ai', reason: REASON } });
    expect(result.current.account!.summary.growth).toEqual({ rate: -0.12, aiReason: REASON });
  });

  it('a typed rate drops the label; a blank one goes back to the default; text that is not a number is refused', () => {
    const { result } = renderHook(() => useAccount('vehicle-1', { today: TODAY }));
    act(() => result.current.growth!.setText('-20'));
    act(() => void result.current.growth!.save());
    expect(stored('vehicle-1').growth).toBe(-0.2);
    act(() => result.current.growth!.setText('fast'));
    let ok = true;
    act(() => void (ok = result.current.growth!.save()));
    expect(ok).toBe(false);
    expect(result.current.growth!.error).toBe(true);
    act(() => result.current.growth!.setText(''));
    act(() => void result.current.growth!.save());
    expect(stored('vehicle-1').growth).toBeUndefined();
  });

  it('loading → error: a friendly message, the stored rate and the field stay', async () => {
    estimateGrowth.mockRejectedValueOnce(new ApiError('x', 0));
    const { result } = renderHook(() => useAccount('vehicle-1', { today: TODAY }));
    await act(async () => result.current.growth!.ai.ask());
    expect(result.current.growth!.ai.status).toBe('error');
    expect(result.current.growth!.ai.message).toMatch(/default|stays/);
    expect(result.current.growth!.text).toBe('-15');
    expect(stored('vehicle-1').growth).toBe(-0.15);
  });
});
