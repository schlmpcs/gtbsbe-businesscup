// Each line above its typical range as a Next Move: the engine's overpayingPatch on the plan's profile.
import { describe, expect, it } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import { overpayingCandidates, overpayingMoveId } from './planMoves';
import { toResultVM } from './rows';
import { sampleOverpayingResult } from './testUtils';

describe('overpayingCandidates', () => {
  it('one cutCategory move per line above the range that the profile can absorb', () => {
    const profile = cloneProfileDemo();
    const { rows } = toResultVM(sampleOverpayingResult(), { profileUsed: false, kidCount: 1 });
    const moves = overpayingCandidates(rows, profile);
    // Rent is above ($3,000 vs a $2,230 middle): rent + utilities $1,950 − $770. Childcare is above too, but
    // the demo profile holds $0 for childcare: no move. Car insurance (below) and groceries (in range): none.
    expect(moves).toEqual([
      { id: overpayingMoveId('rent'), kind: 'cutCategory', level: 1, category: 'rentUtilities', patch: { spending: { rentUtilities: 1950 - 770 } } },
    ]);
  });
});
