// Y1 (Amir): cost of a life card. Spec: docs/ENGINEERING.md → Cost of a life card.
/* eslint-disable @typescript-eslint/no-unused-vars -- signatures are fixed; Y1 replaces the bodies */
import type { AreaData, CostBreakdown, LifeCard, Profile } from '@lifeguessr/types';
import { notImplemented } from './errors';

/** Monthly cost of a life card in its area, with a low/mid/high range (low ≤ mid ≤ high). */
export function costOfLife(card: LifeCard, area: AreaData): CostBreakdown {
  throw notImplemented('Y1');
}

/** Closest Life: a life card as a Profile (car loan → `auto` debt; every field `isEstimate: true`). */
export function cardToProfile(card: LifeCard, area: AreaData): Profile {
  throw notImplemented('Y1');
}
