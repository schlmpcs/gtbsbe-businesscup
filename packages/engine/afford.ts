// Y4 (Amir): Can I Afford It? Spec: docs/ENGINEERING.md → Can I Afford It?
/* eslint-disable @typescript-eslint/no-unused-vars -- signatures are fixed; Y4 replaces the bodies */
import type { AffordResult, Profile, Purchase } from '@lifeguessr/types';
import { notImplemented } from './errors';

/** Verdict (fits / wait / no) for a purchase over the next 12 months, with and without it. */
export function canAfford(p: Profile, x: Purchase): AffordResult {
  throw notImplemented('Y4');
}
