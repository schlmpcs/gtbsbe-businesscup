// Y3 (Amir): Next Moves. Spec: docs/ENGINEERING.md → Next Moves.
/* eslint-disable @typescript-eslint/no-unused-vars -- signatures are fixed; Y3 replaces the bodies */
import type { Move, Profile } from '@lifeguessr/types';
import { notImplemented } from './errors';

/** Candidate moves for the profile's level, sorted by `effect10y` (descending), top 3. */
export function rankMoves(p: Profile): Move[] {
  throw notImplemented('Y3');
}
