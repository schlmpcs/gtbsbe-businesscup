// View-model hooks for the mock screens (S13, S14). Both run on the demo profile fixture.
import { useMemo } from 'react';
import { buildCheckinVM } from './checkin';
import { buildDecideVM } from './decide';
import type { CheckinVM, DecideVM } from './types';

export function useDecide(): DecideVM {
  return useMemo(() => buildDecideVM(), []);
}

export function useCheckin(): CheckinVM {
  return useMemo(() => buildCheckinVM(), []);
}
