// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import type { TogetherPartner } from '@lifeguessr/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { togetherPartnerSample } from '@/fixtures';
import { resetClientState } from '@/test/clientState';
import { createFixtureTogetherClient, rememberRole } from './client';
import { usePartnerForm } from './usePartnerForm';
import { COPIED_MS, useTogetherPlan } from './useTogetherPlan';

beforeEach(() => {
  resetClientState();
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('usePartnerForm', () => {
  it('shows a problem only once its field was touched, and counts the optional fields filled', () => {
    const { result } = renderHook(() => usePartnerForm());
    expect(result.current.vm.problem).toBe('takeHomePay');
    expect(result.current.vm.showProblem).toBe(false);
    act(() => result.current.vm.setQuick('takeHomePay', null));
    expect(result.current.vm.showProblem).toBe(true);
    act(() => result.current.vm.setQuick('takeHomePay', 4000));
    expect(result.current.vm.problem).toBeNull();
    expect(result.current.vm.filledOptional).toBe(0);
    act(() => result.current.vm.setQuick('cash', 500));
    act(() => result.current.vm.setQuick('rentUtilities', 900)); // an essential, not counted
    expect(result.current.vm.filledOptional).toBe(1);
  });
});

describe('useTogetherPlan share and split', () => {
  async function partner1Plan() {
    const client = createFixtureTogetherClient();
    const plan = await client.create(structuredClone(togetherPartnerSample) as TogetherPartner, null);
    rememberRole(plan.id, 'partner1');
    const hook = renderHook(() => useTogetherPlan(plan.id, client));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    return hook;
  }

  it('"Copied" shows after a copy and goes back after a few seconds', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { result } = await partner1Plan();
    vi.useFakeTimers();
    const ready = () => {
      const r = result.current;
      if (r.status !== 'ready') throw new Error(r.status);
      return r;
    };
    await act(async () => ready().share.copy());
    expect(writeText).toHaveBeenCalledWith(ready().share.url);
    expect(ready().share.copied).toBe(true);
    act(() => vi.advanceTimersByTime(COPIED_MS));
    expect(ready().share.copied).toBe(false);
    expect(ready().share.copyFailed).toBe(false);
  });

  it('a refused clipboard asks for a manual copy; the split mode starts by income', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('no')) }, configurable: true });
    const { result } = await partner1Plan();
    const r = () => {
      const v = result.current;
      if (v.status !== 'ready') throw new Error(v.status);
      return v;
    };
    await act(async () => r().share.copy());
    expect(r().share.copyFailed).toBe(true);
    expect(r().splitMode).toBe('income');
    act(() => r().setSplitMode('even'));
    expect(r().splitMode).toBe('even');
  });
});
