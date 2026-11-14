// @vitest-environment jsdom
// While the saved profile is still loading the planner has nothing to say: no engine call, no events.
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as State from '@/state';
import { resetClientState } from '@/test/clientState';
import { plannerOptions } from './payoffTestUtils';
import { useLoanLab } from './useLoanLab';
import { usePayoffPlanner } from './usePayoffPlanner';

vi.mock('@/state', async (importOriginal) => ({ ...(await importOriginal<typeof State>()), useAppReady: () => false }));

beforeEach(resetClientState);

describe('usePayoffPlanner while the profile loads', () => {
  it('is loading, asks the engine nothing and sends no event', () => {
    const { options, comparePayoff, extraToFinishBy, track } = plannerOptions();
    const { result } = renderHook(() => {
      const lab = useLoanLab();
      return usePayoffPlanner(lab, options);
    });
    expect(result.current!.status).toBe('loading');
    expect(result.current!.comparison).toEqual({ status: 'loading' });
    expect(result.current!.selected).toBeNull();
    expect(result.current!.columns).toEqual([]);
    expect(comparePayoff).not.toHaveBeenCalled();
    expect(extraToFinishBy).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});
