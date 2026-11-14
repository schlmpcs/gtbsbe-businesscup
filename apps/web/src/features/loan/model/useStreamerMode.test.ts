// @vitest-environment jsdom
// Streamer mode is `?stream=1` on the page (as /play?stream=1).
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useStreamerMode } from './useStreamerMode';

afterEach(() => window.history.pushState({}, '', '/'));

describe('useStreamerMode', () => {
  it('is on for ?stream=1 and off otherwise', () => {
    window.history.pushState({}, '', '/loan?stream=1');
    expect(renderHook(() => useStreamerMode()).result.current).toBe(true);
    window.history.pushState({}, '', '/loan');
    expect(renderHook(() => useStreamerMode()).result.current).toBe(false);
    window.history.pushState({}, '', '/loan?stream=0');
    expect(renderHook(() => useStreamerMode()).result.current).toBe(false);
    window.history.pushState({}, '', '/loan?stream=1&x=2');
    expect(renderHook(() => useStreamerMode()).result.current).toBe(true);
  });

  it('follows the back and forward buttons', () => {
    window.history.pushState({}, '', '/loan');
    const { result } = renderHook(() => useStreamerMode());
    expect(result.current).toBe(false);
    act(() => {
      window.history.pushState({}, '', '/loan?stream=1');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current).toBe(true);
  });
});
