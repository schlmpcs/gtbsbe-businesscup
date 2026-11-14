// Test helpers for view-model hooks (jsdom tests only): a clean store and storage per test.
import { act, cleanup, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { resetForecastMemory } from '@/features/forecast/model/useForecastBundle';
import { createLocalSessionAdapter } from '@/lib/api/session';
import { initialAppData, initialGameData, resetProStore, setSessionAdapter, useAppStore, useGameStore } from '@/state';

/** Empty localStorage, default stores (Pro included), no remembered forecasts, session sync off. Call in beforeEach. */
export function resetClientState(): void {
  cleanup();
  localStorage.clear();
  resetForecastMemory();
  useAppStore.setState(initialAppData());
  useGameStore.setState(initialGameData());
  resetProStore();
  setSessionAdapter(createLocalSessionAdapter());
}

/** Wait until a hook result reports `status` other than 'loading'. */
export async function waitForReady(result: { current: { status: string } }): Promise<void> {
  await waitFor(() => expect(result.current.status).not.toBe('loading'));
}

/** Flush pending promise callbacks inside act(). */
export async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}
